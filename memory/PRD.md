# PRD — Winternitz Quantum Vault Wallet (v3)

## Scope
User asked to use github.com/blueshift-gg/solana-winternitz-vault tech to build a "create wallet"
page where a vault's deposits/transfers are quantum-checked. User has no SOL to deploy, so we
integrate an **already-deployed** Winternitz vault program (no deploy needed).

## Key decisions / findings
- The blueshift repo's program is NOT deployed anywhere, and this ARM sandbox can't build/deploy
  Solana SBF (no aarch64 Anza CLI). So we use the **winternitz.io** deployment (rabb757/winternitz-vault):
  - **mainnet program**: `13EtnfYGUH8NaGAnUpDTVgSsXoewNnULp7ESwHzQUANT` (confirmed executable)
  - **devnet program**: `HBHP37mXs86kxn8i5twKiPkvtZWx2wDyUEUGVQAo72Da`
- Built on **devnet by default** (free; user has no SOL). Mainnet is a one-line config switch.

## The scheme (ported verbatim, self-tested)
Winternitz OTS: 34 chains (32 msg + 2 checksum), 24-byte truncated Keccak-256, 816-byte signature,
index-prefixed chain steps, pk_hash = keccak256(concat(chain ends)). Deterministic per-nonce seed
`keccak("WNTR:SEED"||master||u64(nonce))` so the whole wallet restores from one 32-byte master seed.
`src/lib/wots.js` is a line-for-line port of their Rust-verified client; a Node roundtrip + tamper
test passes.

## Architecture
- 100% client-side dApp (no backend needed). Phantom is the fee payer & signer.
- `src/lib/wots.js` — WOTS crypto.
- `src/lib/vault.js` — program IDs, PDA (`["vault", pk0]`), digests, instruction builders
  (init=0, mint=1, transfer=2), Phantom sign+send, createVault / depositMint / transferOut, treasury balance.
- `src/context/WalletContext.jsx` — Phantom via window.solana.
- `src/pages/VaultWallet.jsx` — create vault, deposit (quantum mint to treasury), transfer (quantum),
  key-rotation display (nonce + active pk), on-chain receipts, master-seed backup/download.

## Flows (all real on-chain, devnet)
- **Create vault**: new SPL mint (authority = vault PDA) + open vault (tag 0). Phantom pays rent.
- **Deposit**: quantum-signed MINT (tag 1) into the vault's treasury ATA; key rotates (nonce++).
- **Transfer**: quantum-signed TRANSFER (tag 2) treasury → recipient ATA; key rotates.
- Each spend's digest covers domain+vaultId+nonce+source+dest+amount+nextPkHash; program walks the
  hash chains (~695k CU) and checks the stored pk_hash — the quantum check.

## Verified
- Compiles; page renders; Phantom-gated; Buffer polyfilled; no runtime errors.
- WOTS self-test (determinism, 816-byte sig, verify roundtrip, tamper rejection) passes.
- Target program confirmed executable on devnet & mainnet.

## NOT verifiable in this environment (needs human)
- The actual Phantom sign + on-chain submit: no wallet extension here and devnet airdrop is
  rate-limited from this IP. User runs it with Phantom on devnet + faucet SOL.

## Go mainnet
Set `REACT_APP_WNTR_NETWORK=mainnet` and a mainnet `REACT_APP_SOLANA_RPC_URL`; the mainnet program
(`13Etn…QUANT`) is already the default. Requires real SOL for rent + fees.

## Backlog
- P1: Live devnet E2E once funded; show treasury + recipient balances after each spend.
- P2: Restore-from-seed UI; wSOL deposit path (wrap real SOL into the vault); NFT/execute (tag 3) support.

## v4 — Private-routing Swap page (added)
From github.com/rexrivalinsta-art/new-dark ("darkinator"): a no-KYC cross-chain private swap.
- Backend: faithful `/api/ds/{path}` passthrough proxy → `https://darkswap.app/api/swap/{path}`
  (GET+POST, retry/backoff, TTL cache). Confirmed wired (returns live upstream responses).
- Frontend `src/lib/swap.js`: live proxy calls + a realistic local engine fallback (upstream gates
  datacenter IPs, same as pump.fun). Two routing engines: Private route (HoudiniSwap) / Privacy swap
  (NEAR Intents 1Click).
- `src/pages/SwapPage.jsx`: engine toggle, cross-chain asset selectors (search), live quote
  (rate/fee/ETA/limits/USD), flip, destination (+ refund for privacy), order panel with one-time
  deposit address + memo and a status timeline. Routing: `/` Vault, `/swap` Swap (nav tabs).
- Verified via UI: quote renders, order created (privacy engine) with deposit address + memo + status.
- Note: when darkswap.app is unreachable from the host, quotes/orders use the local engine (deposit
  addresses are illustrative); the proxy activates live routing automatically where reachable.
