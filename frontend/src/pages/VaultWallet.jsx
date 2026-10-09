import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@/context/WalletContext";
import {
  getConnection, createVault, depositMint, transferOut, readVault,
  treasuryAta, tokenBalance, explorerTx, explorerAddr, NETWORK, PROGRAM_ID,
} from "@/lib/vault";
import { WotsTerminal } from "@/components/WotsTerminal";
import { toast } from "sonner";
import {
  Shield, Wallet, KeyRound, Loader2, Copy, Download, Plus, ArrowUpRight,
  AlertTriangle, ExternalLink, RotateCcw, Droplet, Hash, X,
} from "lucide-react";

const LS_KEY = "wntr_wallet_v1";
const short = (s, n = 4) => (s ? `${s.slice(0, n)}…${s.slice(-n)}` : "");
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } };
const save = (w) => localStorage.setItem(LS_KEY, JSON.stringify(w));
const fromHex = (h) => Uint8Array.from(h.match(/.{2}/g).map((x) => parseInt(x, 16)));

const Stat = ({ label, value, accent }) => (
  <div className="border border-border bg-card px-3 py-2.5">
    <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
    <div className={`mt-0.5 break-all font-mono text-sm font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
  </div>
);
const input = "mt-1 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none placeholder:text-muted-foreground/40";

export default function VaultWallet() {
  const { publicKey, connected, connecting, connect, disconnect, hasPhantom } = useWallet();
  const conn = getConnection();
  const [wallet, setWallet] = useState(load());
  const [vaultState, setVaultState] = useState(null);
  const [sol, setSol] = useState(null);
  const [treasury, setTreasury] = useState(0);
  const [busy, setBusy] = useState("");
  const [dep, setDep] = useState("1000");
  const [dest, setDest] = useState("");
  const [amt, setAmt] = useState("100");
  const [receipts, setReceipts] = useState([]);
  const [showSeed, setShowSeed] = useState(false);

  const addReceipt = (label, sig) => setReceipts((r) => [{ label, sig, t: new Date().toLocaleTimeString() }, ...r]);

  const refreshSol = useCallback(async () => {
    if (!publicKey) return;
    try { const b = await conn.getBalance(await window.solana.publicKey); setSol(b / 1e9); }
    catch { try { const { PublicKey } = await import("@solana/web3.js"); setSol((await conn.getBalance(new PublicKey(publicKey))) / 1e9); } catch {} }
  }, [publicKey]); // eslint-disable-line

  const refreshVault = useCallback(async () => {
    if (!wallet) return;
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const v = await readVault(conn, new PublicKey(wallet.vault));
      setVaultState(v);
      const ata = treasuryAta(wallet.mint, wallet.vault);
      setTreasury(await tokenBalance(conn, ata));
    } catch (e) { /* noop */ }
  }, [wallet]); // eslint-disable-line

  useEffect(() => { if (connected) refreshSol(); }, [connected, refreshSol]);
  useEffect(() => { refreshVault(); }, [wallet, refreshVault]);

  const connectWallet = async () => {
    try { await connect(); toast.success("Phantom connected"); }
    catch (e) { toast.error(e.message || "Connect failed"); }
  };

  const guard = () => {
    if (!connected) { toast.error("Connect Phantom (devnet) first"); return false; }
    return true;
  };

  const handleCreate = async () => {
    if (!guard()) return;
    setBusy("create");
    try {
      const provider = window.phantom?.solana || window.solana;
      const res = await createVault(conn, provider, publicKey);
      save(res); setWallet(res); setShowSeed(true);
      addReceipt("vault opened", res.sig);
      toast.success("Quantum vault created", { description: `mint ${short(res.mint)}` });
      await refreshVault(); await refreshSol();
    } catch (e) { toast.error((e.message || String(e)).slice(0, 140)); }
    finally { setBusy(""); }
  };

  const handleDeposit = async () => {
    if (!guard() || !wallet) return;
    setBusy("deposit");
    try {
      const provider = window.phantom?.solana || window.solana;
      const res = await depositMint(conn, provider, publicKey, fromHex(wallet.master), dep);
      addReceipt(`mint ${dep} (quantum · nonce ${res.nonce})`, res.txSig);
      toast.success("Quantum mint confirmed · key rotated", { description: explorerTx(res.txSig) });
      await refreshVault(); await refreshSol();
    } catch (e) { toast.error((e.message || String(e)).slice(0, 140)); }
    finally { setBusy(""); }
  };

  const handleTransfer = async () => {
    if (!guard() || !wallet) return;
    if (!dest.trim()) { toast.error("Enter a recipient address"); return; }
    setBusy("transfer");
    try {
      const provider = window.phantom?.solana || window.solana;
      const res = await transferOut(conn, provider, publicKey, fromHex(wallet.master), dest.trim(), amt);
      addReceipt(`transfer ${amt} (quantum · nonce ${res.nonce})`, res.txSig);
      toast.success("Quantum transfer confirmed · key rotated", { description: explorerTx(res.txSig) });
      await refreshVault(); await refreshSol();
    } catch (e) { toast.error((e.message || String(e)).slice(0, 140)); }
    finally { setBusy(""); }
  };

  const downloadBackup = () => {
    if (!wallet) return;
    const blob = new Blob([JSON.stringify(wallet, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `winternitz-vault-${short(wallet.vault)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const forget = () => {
    if (!window.confirm("Remove this vault from this browser? Make sure you've backed up the master seed.")) return;
    localStorage.removeItem(LS_KEY); setWallet(null); setVaultState(null); setReceipts([]);
  };

  const copy = (v, label) => { navigator.clipboard.writeText(v); toast.success(`${label} copied`); };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center border border-primary/40 bg-primary/10 text-primary"><Shield size={16} /></div>
            <span className="font-mono text-base font-bold tracking-tight">
              winternitz<span className="text-primary text-glow">.vault</span>
              <span className="ml-2 hidden rounded-none border border-primary/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary sm:inline">{NETWORK}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 sm:flex">
              <Link to="/" data-testid="nav-vault" className="px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-primary text-glow">Vault</Link>
              <Link to="/swap" data-testid="nav-swap" className="px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary">Swap</Link>
            </nav>
          {connected ? (
            <button data-testid="wallet-button" onClick={disconnect} className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-3 py-2 font-mono text-xs text-primary transition-colors hover:bg-primary/10">
              <span className="inline-block h-2 w-2 animate-pulse bg-primary" /> {short(publicKey)} · {sol != null ? `${sol.toFixed(2)} SOL` : "…"} <X size={12} />
            </button>
          ) : (
            <button data-testid="wallet-button" onClick={connectWallet} disabled={connecting} className="flex items-center gap-2 border border-primary bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 disabled:opacity-50">
              {connecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}{hasPhantom ? "Connect Phantom" : "Get Phantom"}
            </button>
          )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-primary"><KeyRound size={14} /> Winternitz one-time-signature vault · live program</div>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tighter sm:text-5xl">A wallet a quantum<br />computer <span className="text-primary text-glow">can't empty.</span></h1>
        <p className="mt-3 max-w-xl font-sans text-sm text-muted-foreground">
          Create a vault whose authority is a hash-based one-time key. Every deposit and transfer is verified on-chain by
          walking Keccak-256 chains — and the key rotates in the same instruction, so it can never be reused.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="border border-border px-2 py-1">program <a className="text-primary hover:underline" href={explorerAddr(PROGRAM_ID.toBase58())} target="_blank" rel="noreferrer">{short(PROGRAM_ID.toBase58(), 6)} <ExternalLink size={9} className="inline" /></a></span>
          {NETWORK === "devnet" && <a className="flex items-center gap-1 border border-amber/40 bg-amber/5 px-2 py-1 text-amber hover:bg-amber/10" href="https://faucet.solana.com/" target="_blank" rel="noreferrer"><Droplet size={11} /> get devnet SOL</a>}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT: vault + actions */}
          <div className="space-y-6">
            {!wallet ? (
              <div className="border border-border bg-card p-6">
                <div className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">No vault on this device</div>
                <p className="mt-2 font-sans text-sm text-muted-foreground">Creating a vault mints a new quantum-guarded SPL token (vault = mint authority) and opens the on-chain account. Your Phantom pays the small devnet rent.</p>
                <button data-testid="create-vault-btn" onClick={handleCreate} disabled={busy === "create"} className="mt-4 flex w-full items-center justify-center gap-2 border border-primary bg-primary py-3.5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 disabled:opacity-50">
                  {busy === "create" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create quantum vault
                </button>
              </div>
            ) : (
              <>
                <div data-testid="vault-card" className="border border-border bg-card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Your vault</div>
                    <div className="flex gap-2">
                      <button onClick={downloadBackup} title="Backup master seed" className="border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"><Download size={13} /></button>
                      <button onClick={forget} title="Forget on this device" className="border border-border p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive"><RotateCcw size={13} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Treasury balance" value={`${treasury.toLocaleString()} tok`} accent />
                    <Stat label="Key rotations (nonce)" value={vaultState ? String(vaultState.nonce) : "…"} />
                  </div>
                  <div className="mt-3 space-y-1.5 font-mono text-[11px]">
                    <Row k="vault" v={wallet.vault} onCopy={copy} link={explorerAddr(wallet.vault)} />
                    <Row k="mint" v={wallet.mint} onCopy={copy} link={explorerAddr(wallet.mint)} />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">active pk</span>
                      <span className="flex items-center gap-1 text-primary"><Hash size={10} /> {vaultState ? short(Array.from(vaultState.pkHash).map((x) => x.toString(16).padStart(2, "0")).join(""), 8) : "…"}</span>
                    </div>
                  </div>
                </div>

                {/* deposit */}
                <div className="border border-border bg-card p-5">
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Deposit · quantum mint into treasury</div>
                  <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Amount</label>
                  <input data-testid="deposit-amount" className={input} type="number" min="0" value={dep} onChange={(e) => setDep(e.target.value)} />
                  <button data-testid="deposit-btn" onClick={handleDeposit} disabled={busy === "deposit"} className="mt-3 flex w-full items-center justify-center gap-2 border border-primary bg-primary py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 disabled:opacity-50">
                    {busy === "deposit" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Sign with Winternitz &amp; deposit
                  </button>
                </div>

                {/* transfer */}
                <div className="border border-border bg-card p-5">
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Transfer · quantum-signed</div>
                  <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Recipient wallet address</label>
                  <input data-testid="transfer-dest" className={input} value={dest} onChange={(e) => setDest(e.target.value)} placeholder="recipient Solana address" />
                  <label className="mt-3 block font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Amount</label>
                  <input data-testid="transfer-amount" className={input} type="number" min="0" value={amt} onChange={(e) => setAmt(e.target.value)} />
                  <button data-testid="transfer-btn" onClick={handleTransfer} disabled={busy === "transfer"} className="mt-3 flex w-full items-center justify-center gap-2 border border-primary bg-primary py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 disabled:opacity-50">
                    {busy === "transfer" ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />} Sign with Winternitz &amp; transfer
                  </button>
                </div>
              </>
            )}

            {receipts.length > 0 && (
              <div className="border border-border bg-card">
                <div className="border-b border-border px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">On-chain receipts</div>
                <div className="max-h-64 overflow-auto">
                  {receipts.map((r, i) => (
                    <a key={i} href={explorerTx(r.sig)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 border-b border-border/40 px-4 py-2 font-mono text-[11px] transition-colors last:border-0 hover:bg-primary/5">
                      <span className="text-foreground">{r.label}</span>
                      <span className="flex items-center gap-1 text-primary">{short(r.sig, 6)} <ExternalLink size={10} /></span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: terminal + seed */}
          <div className="space-y-6">
            {showSeed && wallet && (
              <div className="scanlines border border-amber/50 bg-black p-5">
                <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-amber"><AlertTriangle size={14} /> Back up your master seed now</div>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">This 32-byte seed restores the entire vault. It is stored in this browser only. Lose it and the vault's authority is gone forever.</p>
                <div className="mt-3 break-all border border-border bg-background p-3 font-mono text-[11px] text-primary">{wallet.master}</div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => copy(wallet.master, "Master seed")} className="flex items-center gap-1.5 border border-primary/40 px-3 py-2 font-mono text-[11px] uppercase text-primary hover:bg-primary/10"><Copy size={12} /> copy</button>
                  <button onClick={downloadBackup} className="flex items-center gap-1.5 border border-primary/40 px-3 py-2 font-mono text-[11px] uppercase text-primary hover:bg-primary/10"><Download size={12} /> download</button>
                  <button onClick={() => setShowSeed(false)} className="ml-auto border border-border px-3 py-2 font-mono text-[11px] uppercase text-muted-foreground hover:text-foreground">saved it</button>
                </div>
              </div>
            )}
            <WotsTerminal />
            <div className="border border-border bg-card p-5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              <div className="mb-2 uppercase tracking-[0.2em] text-primary">How the quantum check works</div>
              <p>Each spend signs a Keccak-256 digest of <span className="text-foreground">domain + vault id + nonce + source + destination + amount + next key</span>. The on-chain program walks every hash chain to its end and checks they hash to the stored public key — ~695k compute units of pure hashing, nothing an elliptic-curve break can touch.</p>
              <p className="mt-2">The signature also commits to the <span className="text-foreground">next</span> public key, so the vault rotates in the same instruction. Reusing a key doesn't weaken it — it fails, because the key it would verify against no longer exists.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v, onCopy, link }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5">
    <span className="text-muted-foreground">{k}</span>
    <span className="flex items-center gap-1.5">
      <a href={link} target="_blank" rel="noreferrer" className="truncate text-foreground hover:text-primary">{short(v, 6)}</a>
      <button onClick={() => onCopy(v, k)} className="text-muted-foreground hover:text-primary"><Copy size={11} /></button>
    </span>
  </div>
);
