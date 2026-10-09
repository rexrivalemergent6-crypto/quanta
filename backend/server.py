from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import time
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import httpx

import pqc

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

PUMP_API = os.environ['PUMP_API_BASE']
PUMP_SWAP = os.environ['PUMP_SWAP_API']
SUPA_URL = os.environ['PQC_SUPABASE_URL']
SUPA_KEY = os.environ['PQC_SUPABASE_ANON_KEY']
GRAD_THRESHOLD = float(os.environ.get('GRAD_THRESHOLD_USD', '69000'))

PUMP_HEADERS = {"accept": "*/*", "origin": "https://pump.fun", "referer": "https://pump.fun/",
                "user-agent": "Mozilla/5.0"}
SUPA_HEADERS = {"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}

app = FastAPI(title="pqc.market proxy")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger("pqc")
logging.basicConfig(level=logging.INFO)

# simple in-process TTL cache for upstream responses
_cache: dict = {}


def cache_get(key, ttl):
    v = _cache.get(key)
    if v and (time.time() - v[0]) < ttl:
        return v[1]
    return None


def cache_set(key, val):
    _cache[key] = (time.time(), val)


async def http_get(url, headers, params=None, timeout=15):
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.get(url, headers=headers, params=params)
        r.raise_for_status()
        return r.json()


async def fetch_pump_list(sort, offset, limit):
    """Live pump.fun feed with a persistent Mongo snapshot fallback for 429s."""
    try:
        data = await http_get(f"{PUMP_API}/coins", PUMP_HEADERS, {
            "offset": offset, "limit": limit, "sort": sort,
            "order": "DESC", "includeNsfw": "false"})
        normd = [norm_pump(c) for c in data if c.get("mint")]
        now = datetime.now(timezone.utc).isoformat()
        for c in normd:
            c["_sort_cache"] = sort
            await db.pump_coins.update_one(
                {"mint": c["mint"]},
                {"$set": {**c, "fetched_at": now}}, upsert=True)
        return normd, True
    except Exception as e:
        logger.warning(f"pump list failed ({e}); serving snapshot")
        field = {"market_cap": "market_cap_usd", "created_timestamp": "created_at",
                 "last_trade_timestamp": "fetched_at"}.get(sort, "market_cap_usd")
        docs = await db.pump_coins.find({}, {"_id": 0}).sort(field, -1).skip(offset).limit(limit).to_list(limit)
        return docs, False


# ----- normalization -----

def norm_pump(c: dict) -> dict:
    mcap = c.get("usd_market_cap") or c.get("market_cap_usd") or c.get("market_cap") or 0
    complete = bool(c.get("complete"))
    progress = 100.0 if complete else min(100.0, (float(mcap) / GRAD_THRESHOLD) * 100.0) if mcap else 0.0
    ts = c.get("created_timestamp")
    created = datetime.fromtimestamp(ts / 1000, timezone.utc).isoformat() if ts else None
    return {
        "mint": c.get("mint"),
        "name": c.get("name"),
        "symbol": c.get("symbol"),
        "description": c.get("description"),
        "image": c.get("image_uri"),
        "creator": c.get("creator"),
        "market_cap_usd": round(float(mcap), 2) if mcap else 0,
        "volume_24h": None,
        "holders": c.get("reply_count"),
        "bonding_progress": round(progress, 1),
        "graduated": complete,
        "price_change_24h": None,
        "created_at": created,
        "source": "standard",
        "variant": "attestation digest",
        "twitter": c.get("twitter"),
        "telegram": c.get("telegram"),
        "website": c.get("website"),
    }


def _leaf_label(mint: str) -> str:
    return f"leaf #{(int.from_bytes(__import__('hashlib').sha256(mint.encode()).digest()[:2],'big') % 10) + 1}"


def norm_quantum(c: dict) -> dict:
    mcap = c.get("mcap_usd") or 0
    return {
        "mint": c.get("mint"),
        "name": c.get("name"),
        "symbol": c.get("symbol"),
        "description": c.get("description"),
        "image": c.get("image_url") or c.get("image"),
        "creator": c.get("creator"),
        "market_cap_usd": round(float(mcap), 2) if mcap else 0,
        "volume_24h": c.get("volume_24h_sol"),
        "holders": c.get("holders"),
        "bonding_progress": round(float(c.get("bonding_progress") or 0), 1),
        "graduated": bool(c.get("graduated")),
        "price_change_24h": c.get("price_change_24h"),
        "price_sol": c.get("price_sol"),
        "created_at": c.get("created_at"),
        "source": "quantum",
        "variant": "QUANTUM",
        "twitter": c.get("twitter"),
        "telegram": c.get("telegram"),
        "website": c.get("website"),
        "paired_stock": c.get("paired_stock"),
        "hook_params": c.get("hook_params"),
    }


# ----- models -----
class LaunchReq(BaseModel):
    name: str
    symbol: str
    description: Optional[str] = ""
    image: Optional[str] = None
    twitter: Optional[str] = None
    telegram: Optional[str] = None
    website: Optional[str] = None
    fee_pct: Optional[float] = 1.0
    quantum: bool = True


class TradeReq(BaseModel):
    side: str  # buy | sell
    sol_amount: float
    wallet: Optional[str] = "demo-wallet"


class VerifyReq(BaseModel):
    seed: str
    message: Optional[str] = None


# ----- routes -----
@api_router.get("/")
async def root():
    return {"service": "pqc.market proxy", "ok": True}


@api_router.get("/stats")
async def stats():
    try:
        q = await http_get(f"{SUPA_URL}/rest/v1/coins", SUPA_HEADERS, {"select": "mint,graduated"})
    except Exception:
        q = []
    launches = await db.launches.count_documents({})
    grad = sum(1 for c in q if c.get("graduated"))
    return {
        "quantum_coins": len(q) + launches,
        "graduated": grad,
        "signature_bytes": pqc.TOTAL_CHAINS * pqc.N,
        "keys_per_identity": 256,
        "hash": "SHA-256",
        "w": pqc.W,
        "chains": pqc.TOTAL_CHAINS,
    }


@api_router.get("/coins")
async def list_coins(tab: str = "all", sort: str = "newest", filter: str = "all",
                     offset: int = 0, limit: int = 48):
    tab = (tab or "all").lower()
    results: List[dict] = []

    # quantum coins from pqc.market's own backend
    if tab in ("all", "quantum"):
        try:
            order = {"newest": "created_at.desc", "marketcap": "mcap_usd.desc",
                     "volume": "volume_24h_sol.desc", "holders": "holders.desc"}.get(sort, "created_at.desc")
            params = {"select": "*", "order": order}
            qd = await http_get(f"{SUPA_URL}/rest/v1/coins", SUPA_HEADERS, params)
            results += [norm_quantum(c) for c in qd if c.get("mint")]
        except Exception as e:
            logger.warning(f"supabase coins failed: {e}")
        # our own launches
        async for doc in db.launches.find({}, {"_id": 0}).sort("created_at", -1):
            results.append(doc["coin"])

    # standard coins proxied live from pump.fun (with snapshot fallback)
    if tab in ("all", "standard"):
        pump_sort = {"newest": "created_timestamp", "marketcap": "market_cap",
                     "volume": "last_trade_timestamp", "holders": "market_cap"}.get(sort, "created_timestamp")
        normd, live = await fetch_pump_list(pump_sort, offset, limit)
        for c in normd:
            c.pop("_sort_cache", None)
            cache_set(f"coin:{c['mint']}", c)
        results += normd

    if filter == "graduated":
        results = [c for c in results if c.get("graduated")]

    # sort combined
    if sort == "marketcap":
        results.sort(key=lambda c: c.get("market_cap_usd") or 0, reverse=True)
    elif sort == "holders":
        results.sort(key=lambda c: c.get("holders") or 0, reverse=True)
    elif sort == "volume":
        results.sort(key=lambda c: c.get("volume_24h") or 0, reverse=True)

    return {"coins": results, "count": len(results)}


@api_router.get("/coins/{mint}")
async def coin_detail(mint: str):
    # 1. our own launches
    doc = await db.launches.find_one({"coin.mint": mint}, {"_id": 0})
    if doc:
        coin = doc["coin"]
    else:
        coin = None
        # 2. pqc.market quantum coins
        try:
            qd = await http_get(f"{SUPA_URL}/rest/v1/coins", SUPA_HEADERS,
                                {"select": "*", "mint": f"eq.{mint}", "limit": 1})
            if qd:
                coin = norm_quantum(qd[0])
        except Exception:
            pass
        # 3. cached standard coin from the live feed (in-proc then persistent)
        if coin is None:
            coin = cache_get(f"coin:{mint}", 600)
        if coin is None:
            doc2 = await db.pump_coins.find_one({"mint": mint}, {"_id": 0})
            if doc2:
                doc2.pop("_sort_cache", None)
                coin = doc2
        # 4. direct pump search fallback
        if coin is None:
            try:
                sd = await http_get(f"{PUMP_API}/coins", PUMP_HEADERS,
                                    {"searchTerm": mint, "offset": 0, "limit": 1, "includeNsfw": "false"})
                if sd:
                    coin = norm_pump(sd[0])
            except Exception:
                pass
    if coin is None:
        raise HTTPException(404, "coin not found")

    att = pqc.generate(mint, message=mint)
    attestation = {
        "scheme": att["scheme"], "w": att["w"], "chains": att["chains"],
        "signature_bytes": att["signature_bytes"], "message_digest": att["message_digest"],
        "leaf": att["leaf"], "leaf_index": att["leaf_index"], "root": att["root"],
        "verify_hash_calls": att["verify_hash_calls"], "merkle_levels": len(att["merkle_path"]),
    }
    return {"coin": coin, "attestation": attestation}


@api_router.get("/coins/{mint}/candles")
async def candles(mint: str, interval: str = "5m", limit: int = 120):
    ckey = f"candles:{mint}:{interval}:{limit}"
    cached = cache_get(ckey, 15)
    if cached is not None:
        return {"candles": cached}
    try:
        data = await http_get(f"{PUMP_SWAP}/v1/coins/{mint}/candles", PUMP_HEADERS,
                              {"interval": interval, "limit": limit, "currency": "USD"})
        out = [{
            "t": c["timestamp"],
            "o": float(c["open"]), "h": float(c["high"]),
            "l": float(c["low"]), "c": float(c["close"]), "v": float(c["volume"]),
        } for c in data]
    except Exception as e:
        logger.warning(f"candles failed {mint}: {e}")
        out = []
    cache_set(ckey, out)
    return {"candles": out}


@api_router.get("/coins/{mint}/attestation/verify")
async def coin_attestation_verify(mint: str):
    att = pqc.generate(mint, message=mint)
    res = pqc.verify(mint, att["signature"], att["root"], att["leaf_index"], message=mint)
    return res


@api_router.get("/coins/{mint}/trades")
async def coin_trades(mint: str, limit: int = 30):
    trades = await db.sim_trades.find({"mint": mint}, {"_id": 0}).sort("ts", -1).to_list(limit)
    return {"trades": trades}


@api_router.post("/coins/{mint}/trade")
async def coin_trade(mint: str, body: TradeReq):
    if body.side not in ("buy", "sell"):
        raise HTTPException(400, "side must be buy or sell")
    sol_price = 150.0  # reference USD/SOL for the demo ledger
    trade = {
        "id": str(uuid.uuid4()),
        "mint": mint,
        "side": body.side,
        "sol_amount": round(body.sol_amount, 4),
        "usd_amount": round(body.sol_amount * sol_price, 2),
        "wallet": body.wallet,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await db.sim_trades.insert_one(dict(trade))
    return {"ok": True, "trade": trade}


@api_router.post("/attestation/verify")
async def attestation_verify(body: VerifyReq):
    att = pqc.generate(body.seed, message=body.message)
    return pqc.verify(body.seed, att["signature"], att["root"], att["leaf_index"], message=body.message)


@api_router.post("/attestation/generate")
async def attestation_generate(body: VerifyReq):
    return pqc.generate(body.seed, message=body.message)


@api_router.post("/launch")
async def launch(body: LaunchReq):
    mint = "q" + uuid.uuid4().hex[:40]
    att = pqc.generate(mint, message=f"{body.name}:{body.symbol}")
    coin = {
        "mint": mint,
        "name": body.name,
        "symbol": body.symbol,
        "description": body.description,
        "image": body.image,
        "creator": body.wallet if hasattr(body, "wallet") else "pqc-launcher",
        "market_cap_usd": 3000.0,
        "volume_24h": 0,
        "holders": 1,
        "bonding_progress": 0.0,
        "graduated": False,
        "price_change_24h": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "quantum" if body.quantum else "standard",
        "variant": "QUANTUM" if body.quantum else "attestation digest",
        "twitter": body.twitter,
        "telegram": body.telegram,
        "website": body.website,
        "hook_params": {"feePct": body.fee_pct},
    }
    doc = {
        "id": str(uuid.uuid4()),
        "coin": coin,
        "attestation": {"leaf": att["leaf"], "leaf_index": att["leaf_index"],
                        "root": att["root"], "signature_bytes": att["signature_bytes"]},
        "created_at": coin["created_at"],
    }
    await db.launches.insert_one(dict(doc))
    doc.pop("_id", None)
    return {"ok": True, "coin": coin, "mint": mint, "attestation": doc["attestation"]}


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
