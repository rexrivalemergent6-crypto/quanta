"""Backend tests for pqc.market launcher (metadata, trade-local, launches)."""
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pqc-sane-market.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
SYS_ID = "11111111111111111111111111111111"


def _tiny_png() -> bytes:
    sig = b"\x89PNG\r\n\x1a\n"
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    raw = b"\x00\xff\x00\x00"
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="session")
def tiny_png():
    return _tiny_png()


class TestMetadata:
    def test_metadata_upload_success(self, tiny_png):
        files = {"file": ("t.png", tiny_png, "image/png")}
        data = {"name": "TEST_PQC", "symbol": "TPQC", "description": "test"}
        r = requests.post(f"{API}/metadata", data=data, files=files, timeout=90)
        if r.status_code == 502:
            # retry once per instructions
            r = requests.post(f"{API}/metadata", data=data, files=files, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("metadataUri"), j
        assert isinstance(j.get("metadata"), dict)

    def test_metadata_oversize_413(self):
        big = b"\x00" * (10 * 1024 * 1024 + 10)
        files = {"file": ("big.png", big, "image/png")}
        data = {"name": "TEST", "symbol": "T", "description": ""}
        r = requests.post(f"{API}/metadata", data=data, files=files, timeout=60)
        assert r.status_code == 413, r.status_code


class TestTradeLocal:
    def test_trade_local_returns_tx_bytes(self):
        body = {
            "publicKey": SYS_ID, "action": "create",
            "tokenMetadata": {"name": "TPQC", "symbol": "TPQC", "uri": "https://example.com/x.json"},
            "mint": SYS_ID, "denominatedInSol": "true",
            "amount": 0.0, "slippage": 10, "priorityFee": 0.00005, "pool": "pump",
        }
        r = requests.post(f"{API}/trade-local", json=body, timeout=60)
        assert r.status_code == 200, r.text
        assert "application/octet-stream" in r.headers.get("content-type", "")
        assert len(r.content) > 0

    def test_trade_local_missing_uri_422(self):
        body = {
            "publicKey": SYS_ID, "action": "create",
            "tokenMetadata": {"name": "x", "symbol": "x"},
            "mint": SYS_ID, "denominatedInSol": "true",
            "amount": 0.0, "slippage": 10, "priorityFee": 0.00005, "pool": "pump",
        }
        r = requests.post(f"{API}/trade-local", json=body, timeout=30)
        assert r.status_code == 422, r.status_code


class TestLaunches:
    MINT = "TEST_MINT_" + "A" * 32

    def test_record_launch_attestation(self):
        body = {
            "mint": self.MINT, "signature": "TEST_SIG_abc", "creator": SYS_ID,
            "name": "TPQC", "symbol": "TPQC",
            "metadataUri": "https://example.com/x.json", "network": "mainnet-beta",
        }
        r = requests.post(f"{API}/launches", json=body, timeout=30)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        att = j.get("attestation")
        assert att and att.get("chains") == 67
        assert att.get("w") == 16
        for k in ("leaf", "leaf_index", "root", "signature_bytes"):
            assert k in att

    def test_launches_list_idempotent(self):
        body = {
            "mint": self.MINT, "signature": "TEST_SIG_abc", "creator": SYS_ID,
            "name": "TPQC", "symbol": "TPQC",
            "metadataUri": "https://example.com/x.json", "network": "mainnet-beta",
        }
        r1 = requests.post(f"{API}/launches", json=body, timeout=30)
        assert r1.status_code == 200
        r = requests.get(f"{API}/launches", timeout=30)
        assert r.status_code == 200
        launches = r.json().get("launches", [])
        matches = [l for l in launches if l.get("mint") == self.MINT]
        assert len(matches) == 1, f"expected idempotent upsert, got {len(matches)}"
