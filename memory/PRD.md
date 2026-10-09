# PRD — pqc.market REAL launcher (pump.fun token launch, launch-only)

## Current scope (v2 — pivot)
User asked to strip the app to **only the Launch page** and make it a **REAL on-chain launcher**:
Phantom wallet signs in the browser, PumpPortal's Local Transaction API builds the create-token
transaction, pump.fun mints on Solana **mainnet**. No private keys on the server.

## Architecture
- **Frontend** (React/CRA, launch-only, bunker/terminal theme):
  - `src/pages/Launch.jsx` — the only page. Phantom connect, launch form, live terminal log, result screen with mint/tx/attestation + pump.fun & Solscan links.
  - `src/context/WalletContext.jsx` — Phantom via `window.solana` (connect/disconnect/publicKey, eager onlyIfTrusted).
  - `src/index.js` — Buffer/global polyfill; `craco.config.js` — webpack fallbacks + ProvidePlugin(Buffer) for @solana/web3.js.
  - Signing: `tx.sign([mint])` then Phantom `signAndSendTransaction` (fallback `signTransaction` + `connection.sendRawTransaction`), confirmed via `REACT_APP_SOLANA_RPC_URL`.
- **Backend** (FastAPI, proxy only — no signing):
  - `POST /api/metadata` → proxies `https://pump.fun/api/ipfs` (multipart), returns `metadataUri`.
  - `POST /api/trade-local` → proxies `https://pumpportal.fun/api/trade-local`, returns raw serialized VersionedTransaction bytes.
  - `POST /api/launches` → records confirmed launch in Mongo + attaches a WOTS+Merkle attestation (`pqc.py`).
  - `GET /api/launches` → recent launches.
- **DB**: MongoDB `launches` (upsert by mint).

## Integration
PumpPortal Local Transaction API + Phantom browser signing (per integration_expert playbook).
- No PumpPortal API key needed (local tx is keyless on their side).
- `REACT_APP_SOLANA_RPC_URL` defaults to public `api.mainnet-beta.solana.com`.

## Implemented & tested (2026-06, v2) — backend 6/6, frontend render/gating 100%
- Real IPFS metadata upload (verified: returns real ipfs.io URI).
- Real PumpPortal create-tx (verified: returns tx bytes).
- Launch record + WOTS attestation (chains=67, w=16).
- Launch page renders, Phantom-gated, no runtime/Buffer errors.

## NOT verifiable automatically (requires real funded Phantom wallet + mainnet SOL)
- The actual Phantom sign + on-chain broadcast/confirm step. Logic follows the verified playbook but
  a human must do a real launch to confirm end-to-end.

## Known limitations / recommendations
- Public mainnet RPC frequently rate-limits `sendTransaction`; using Phantom's `signAndSendTransaction`
  (primary path) mitigates this. For reliability, set `REACT_APP_SOLANA_RPC_URL` to a Helius/QuickNode URL.
- pump.fun `/api/ipfs` may intermittently 500; retry.
- Mainnet only (pump.fun has no devnet) — launches cost real SOL.

## Backlog (P1/P2)
- P1: Dedicated/paid RPC env for reliable broadcast; surface clear "insufficient SOL" errors.
- P2: "Your launches" list on the page (GET /api/launches); Pinata IPFS fallback if pump.fun IPFS fails.
- P2: In-browser attestation verifier on the result screen.
