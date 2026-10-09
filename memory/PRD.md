# PRD — pqc.market clone (post-quantum coin launchpad)

## Original problem statement
"https://pqc.market/ crawl though it api github i want sane fully functional" + "full working try to proxy api upstream" + "try upstream proxy ill take the risk".

## What pqc.market is
A pump.fun-style meme-coin launchpad with a post-quantum crypto theme. Every coin is "signed" by a
one-time hash-based key (WOTS, w=16, SHA-256) with a Merkle-tree identity whose root is a registered
on-chain anchor. Tagline: "Launch coins that survive Q-day."

## Architecture
- **Frontend**: React (CRA), react-router, Tailwind, recharts, sonner. Dark terminal/bunker theme
  (JetBrains Mono / Cabinet Grotesk / IBM Plex Sans, cyber-green #00FF41 + amber #FFB000, scanlines).
- **Backend**: FastAPI proxy (`/api` prefix) + real Python PQC engine.
- **DB**: MongoDB — `pump_coins` (persistent snapshot fallback), `launches`, `sim_trades`.

### Upstream proxied (reverse-engineered, keys recovered from site JS)
- pump.fun live feed: `frontend-api-v3.pump.fun/coins` (sorts: created_timestamp/market_cap/last_trade_timestamp).
- pump.fun charts: `swap-api.pump.fun/v1/coins/{mint}/candles`.
- pqc.market's own Supabase (anon key): tables `coins` (quantum), `launches`, `pools`, `trades`, `holders`.
- Resilience: successful pump pulls are upserted into Mongo `pump_coins`; on 429 the feed serves the snapshot.

### Real PQC engine (`backend/pqc.py`)
WOTS+ one-time signatures (67 chains = 64 msg digits + 3 checksum, w=16, SHA-256) compressed into a
Merkle leaf climbing 8 levels to a root. `generate()` + `verify()` produce the 12-step in-browser
verification; root matches (verified:true), confirmed by tests.

## API
GET /api/stats · /api/coins (tab/sort/filter/offset/limit) · /api/coins/{mint} · /api/coins/{mint}/candles ·
/api/coins/{mint}/attestation/verify · /api/coins/{mint}/trades · POST /api/coins/{mint}/trade ·
POST /api/attestation/verify · POST /api/attestation/generate · POST /api/launch

## Implemented (2026-06) — v1, tested 100% (14/14 backend, frontend e2e)
- Home: hero + animated WOTS terminal, stats bar, live feed with All/Standard/Quantum tabs, sort, graduated filter, load more.
- Coin detail: live price chart (1H/1D/1W/1M), stats, bonding/graduated bar, demo buy/sell ledger + recent trades, attestation summary + animated verifier.
- Launch flow: form → generates real WOTS+Merkle attestation → success screen → view coin.
- Docs page explaining WOTS / Merkle / PQC.

## Personas
- Degen trader browsing/launching meme coins; crypto-curious user exploring post-quantum signatures.

## Known limitations / MOCKED
- **Trading is a demo off-chain ledger** (no real Solana settlement).
- **Launches stored in Mongo** (no real on-chain mint); the attestation crypto itself is real.
- pump.fun thumbnails may fail CORS (fallback initials render).

## Backlog (P1/P2)
- P1: Backend image proxy for coin thumbnails (remove CORS noise).
- P1: Live 24h volume/holders for standard coins (needs extra pump endpoints).
- P2: WebSocket live trade stream; wallet connect (Reown) for real launches; search bar; pagination on quantum tab.
- P2: Cache size cap / lifespan handler; add `wallet` to LaunchReq for creator attribution.
