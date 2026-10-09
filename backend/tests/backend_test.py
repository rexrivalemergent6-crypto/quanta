"""Backend tests for pqc.market clone."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://pqc-sane-market.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
REF_MINT = "HQowBX7JqXUEDPWHB4bS6q6KEzvSdfDPXv6qefipump"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


# ----- stats -----
def test_stats(s):
    r = s.get(f"{API}/stats", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ["signature_bytes", "hash", "chains", "quantum_coins"]:
        assert k in d, f"missing {k}"
    assert d["hash"] == "SHA-256"
    assert d["chains"] == 67


# ----- coin list -----
def test_coins_all_marketcap(s):
    r = s.get(f"{API}/coins", params={"tab": "all", "sort": "marketcap"}, timeout=60)
    assert r.status_code == 200
    data = r.json()
    coins = data["coins"]
    assert len(coins) > 0
    first = coins[0]
    for k in ["mint", "name", "symbol", "market_cap_usd", "bonding_progress", "graduated", "source"]:
        assert k in first, f"missing {k} in coin"
    # descending by market cap
    caps = [c.get("market_cap_usd") or 0 for c in coins]
    assert caps == sorted(caps, reverse=True)


def test_coins_quantum(s):
    r = s.get(f"{API}/coins", params={"tab": "quantum"}, timeout=60)
    assert r.status_code == 200
    coins = r.json()["coins"]
    for c in coins:
        assert c["source"] == "quantum"


def test_coins_standard(s):
    r = s.get(f"{API}/coins", params={"tab": "standard"}, timeout=60)
    assert r.status_code == 200
    coins = r.json()["coins"]
    assert len(coins) > 0
    for c in coins:
        assert c["source"] == "standard"


def test_coins_filter_graduated(s):
    r = s.get(f"{API}/coins", params={"filter": "graduated"}, timeout=60)
    assert r.status_code == 200
    for c in r.json()["coins"]:
        assert c["graduated"] is True


@pytest.mark.parametrize("sort", ["newest", "holders", "volume", "marketcap"])
def test_coins_sorts(s, sort):
    r = s.get(f"{API}/coins", params={"sort": sort}, timeout=60)
    assert r.status_code == 200
    assert len(r.json()["coins"]) > 0


# ----- coin detail + attestation -----
def test_coin_detail(s):
    r = s.get(f"{API}/coins/{REF_MINT}", timeout=60)
    assert r.status_code == 200
    d = r.json()
    assert d["coin"]["mint"] == REF_MINT
    att = d["attestation"]
    assert att["chains"] == 67
    assert att["w"] == 16
    assert "leaf" in att and "root" in att and "leaf_index" in att
    assert "verify_hash_calls" in att


def test_coin_candles(s):
    r = s.get(f"{API}/coins/{REF_MINT}/candles", params={"interval": "1d", "limit": 60}, timeout=60)
    assert r.status_code == 200
    candles = r.json()["candles"]
    # may be empty depending on upstream; try 1h fallback
    if not candles:
        r2 = s.get(f"{API}/coins/{REF_MINT}/candles", params={"interval": "5m"}, timeout=60)
        candles = r2.json()["candles"]
    assert len(candles) > 0
    c = candles[0]
    for k in ["t", "o", "h", "l", "c", "v"]:
        assert k in c


def test_attestation_verify_core(s):
    """Core PQC correctness: computed_root must equal expected_root."""
    r = s.get(f"{API}/coins/{REF_MINT}/attestation/verify", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["verified"] is True, f"attestation not verified: {d}"
    assert d["computed_root"] == d["expected_root"]
    assert len(d["steps"]) == 12, f"expected 12 steps, got {len(d['steps'])}"


# ----- trade -----
def test_trade_and_fetch(s):
    r = s.post(f"{API}/coins/{REF_MINT}/trade",
               json={"side": "buy", "sol_amount": 0.5, "wallet": "demo-wallet"}, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    trade = d["trade"]
    assert trade["side"] == "buy"
    assert trade["sol_amount"] == 0.5

    r2 = s.get(f"{API}/coins/{REF_MINT}/trades", timeout=30)
    assert r2.status_code == 200
    trades = r2.json()["trades"]
    assert any(t["id"] == trade["id"] for t in trades)


# ----- launch -----
def test_launch_and_retrieve(s):
    payload = {"name": "TEST_PQCoin", "symbol": "TPQC",
               "description": "test coin", "quantum": True}
    r = s.post(f"{API}/launch", json=payload, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["mint"].startswith("q")
    assert "leaf" in d["attestation"] and "root" in d["attestation"]

    r2 = s.get(f"{API}/coins/{d['mint']}", timeout=30)
    assert r2.status_code == 200
    coin = r2.json()["coin"]
    assert coin["name"] == payload["name"]
    assert coin["symbol"] == payload["symbol"]
