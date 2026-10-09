from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import httpx

import pqc

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

PUMP_IPFS_URL = os.environ['PUMP_IPFS_URL']
PUMPPORTAL_URL = os.environ['PUMPPORTAL_URL']

app = FastAPI(title="pqc.market launcher")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger("pqc")
logging.basicConfig(level=logging.INFO)


class TradeRequest(BaseModel):
    publicKey: str
    action: str = Field(pattern="^create$")
    tokenMetadata: dict
    mint: str
    denominatedInSol: str = Field(pattern="^(true|false)$")
    amount: float = Field(ge=0)
    slippage: float = Field(ge=0)
    priorityFee: float = Field(ge=0)
    pool: str = "pump"


class LaunchRecord(BaseModel):
    mint: str
    signature: str
    creator: str
    name: Optional[str] = None
    symbol: Optional[str] = None
    metadataUri: Optional[str] = None
    image: Optional[str] = None
    network: str = "mainnet-beta"


@api_router.get("/")
async def root():
    return {"service": "pqc.market launcher", "ok": True}


@api_router.post("/metadata")
async def upload_metadata(
    name: str = Form(...),
    symbol: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    twitter: Optional[str] = Form(None),
    telegram: Optional[str] = Form(None),
    website: Optional[str] = Form(None),
):
    """Proxy the token image + metadata to pump.fun IPFS, return the metadata URI."""
    image = await file.read()
    if len(image) > 10 * 1024 * 1024:
        raise HTTPException(413, "image too large (max 10MB)")
    fields = {
        "name": name, "symbol": symbol, "description": description or "",
        "showName": "true", "twitter": twitter or "",
        "telegram": telegram or "", "website": website or "",
    }
    files = {"file": (file.filename or "token.png", image,
                      file.content_type or "application/octet-stream")}
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            r = await c.post(PUMP_IPFS_URL, data=fields, files=files,
                             headers={"user-agent": "Mozilla/5.0", "accept": "application/json"})
    except Exception as e:
        raise HTTPException(502, f"metadata upload failed to reach pump.fun: {e}")
    if r.status_code >= 400:
        raise HTTPException(502, f"pump.fun metadata upload failed ({r.status_code}): {r.text[:300]}")
    try:
        result = r.json()
    except Exception:
        raise HTTPException(502, f"pump.fun returned non-JSON metadata: {r.text[:200]}")
    if not result.get("metadataUri"):
        raise HTTPException(502, f"metadataUri missing in response: {str(result)[:200]}")
    return result


@api_router.post("/trade-local")
async def trade_local(body: TradeRequest):
    """Proxy PumpPortal local create. Returns the raw serialized VersionedTransaction bytes."""
    if {"name", "symbol", "uri"} - set(body.tokenMetadata):
        raise HTTPException(422, "tokenMetadata requires name, symbol, uri")
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(PUMPPORTAL_URL, json=body.model_dump(),
                             headers={"Content-Type": "application/json"})
    except Exception as e:
        raise HTTPException(502, f"could not reach PumpPortal: {e}")
    if r.status_code != 200:
        raise HTTPException(502, f"PumpPortal rejected request ({r.status_code}): {r.text[:300]}")
    return Response(content=r.content, media_type="application/octet-stream")


@api_router.post("/launches")
async def record_launch(body: LaunchRecord):
    """Persist a confirmed launch and attach a hash-based PQC attestation for the new mint."""
    att = pqc.generate(body.mint, message=f"{body.name or ''}:{body.symbol or ''}:{body.mint}")
    doc = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "attestation": {
            "scheme": att["scheme"], "w": att["w"], "chains": att["chains"],
            "signature_bytes": att["signature_bytes"], "leaf": att["leaf"],
            "leaf_index": att["leaf_index"], "root": att["root"],
            "verify_hash_calls": att["verify_hash_calls"],
        },
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await db.launches.update_one({"mint": body.mint}, {"$set": dict(doc)}, upsert=True)
    doc.pop("_id", None)
    return {"ok": True, "launch": doc, "attestation": doc["attestation"]}


@api_router.get("/launches")
async def list_launches(limit: int = 20):
    docs = await db.launches.find({}, {"_id": 0}).sort("createdAt", -1).to_list(limit)
    return {"launches": docs}


# --------------------------------------------------------------------------
# DarkSwap private-routing passthrough proxy (server-side -> avoids CORS)
#   /api/ds/<path>  ->  https://darkswap.app/api/swap/<path>
# --------------------------------------------------------------------------
from fastapi import Request
import asyncio
import time as _time

DS_BASE = "https://darkswap.app/api/swap"
DS_HEADERS = {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    "origin": "https://darkswap.app",
    "referer": "https://darkswap.app/swap",
    "user-agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
}
DS_ALLOWED = ("tokens", "chains", "quotes", "orders", "near")
_DS_RETRY = {429, 500, 502, 503, 504}
_ds_client = None
_ds_cache = {}


def _ds_get_client():
    global _ds_client
    if _ds_client is None or _ds_client.is_closed:
        _ds_client = httpx.AsyncClient(
            timeout=httpx.Timeout(45.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50, keepalive_expiry=30.0),
            headers=DS_HEADERS, follow_redirects=True)
    return _ds_client


def _ds_allowed(path):
    return path.split("/")[0] in DS_ALLOWED


def _ds_ttl(path):
    base = path.split("?")[0]
    if base.endswith("tokens") or base == "tokens":
        return 60
    if base.endswith("chains") or base == "chains":
        return 300
    return 0


async def _ds_request(method, url, params=None, content=None, retries=2):
    client = _ds_get_client()
    resp = None
    for attempt in range(retries + 1):
        try:
            resp = await client.request(method, url, params=params, content=content)
            if resp.status_code in _DS_RETRY and attempt < retries:
                await asyncio.sleep(0.4 * (2 ** attempt))
                continue
            return resp
        except httpx.HTTPError:
            if attempt < retries:
                await asyncio.sleep(0.4 * (2 ** attempt))
                continue
            raise
    return resp


@api_router.get("/ds/{path:path}")
async def ds_proxy_get(path: str, request: Request):
    if not _ds_allowed(path):
        return Response('{"error":"path not allowed"}', 403, media_type="application/json")
    params = dict(request.query_params)
    ttl = _ds_ttl(path)
    key = f"GET {path}?{sorted(params.items())}"
    now = _time.time()
    if ttl and key in _ds_cache and now - _ds_cache[key][0] < ttl:
        _, status, body = _ds_cache[key]
        return Response(body, status, media_type="application/json")
    try:
        r = await _ds_request("GET", f"{DS_BASE}/{path}", params=params)
    except httpx.HTTPError as e:
        logger.error(f"ds GET {path}: {e}")
        if key in _ds_cache:
            _, status, body = _ds_cache[key]
            return Response(body, status, media_type="application/json")
        return Response('{"error":"upstream unreachable"}', 502, media_type="application/json")
    if ttl and r.status_code == 200:
        _ds_cache[key] = (now, r.status_code, r.content)
    return Response(r.content, r.status_code, media_type="application/json")


@api_router.post("/ds/{path:path}")
async def ds_proxy_post(path: str, request: Request):
    if not _ds_allowed(path):
        return Response('{"error":"path not allowed"}', 403, media_type="application/json")
    body = await request.body()
    try:
        r = await _ds_request("POST", f"{DS_BASE}/{path}", content=body)
        return Response(r.content, r.status_code, media_type="application/json")
    except httpx.HTTPError as e:
        logger.error(f"ds POST {path}: {e}")
        return Response('{"error":"upstream unreachable"}', 502, media_type="application/json")


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
