import { useState, useRef, useEffect } from "react";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { useWallet } from "@/context/WalletContext";
import { TopTabs } from "@/components/TopTabs";
import { AttestationPreview } from "@/components/AttestationPreview";
import { toast } from "sonner";
import {
  Rocket, Loader2, ShieldCheck, ExternalLink, Upload, Copy, AlertTriangle,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const RPC = process.env.REACT_APP_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const short = (s, n = 4) => (s ? `${s.slice(0, n)}…${s.slice(-n)}` : "");
const inputCls = "mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 font-mono text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40";

const Field = ({ label, children, hint }) => (
  <div>
    <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</label>
    {children}
    {hint && <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">{hint}</p>}
  </div>
);

export default function Launch() {
  const { publicKey, connected, provider } = useWallet();
  const [form, setForm] = useState({ name: "", symbol: "", description: "", twitter: "", telegram: "", website: "", amount: "0.01", slippage: "10", priorityFee: "0.00005" });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const logRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const addLog = (msg, kind = "info") => setLog((l) => [...l, { msg, kind, t: new Date().toLocaleTimeString() }]);

  useEffect(() => { logRef.current?.scrollTo(0, logRef.current.scrollHeight); }, [log]);

  const onFile = (e) => { const f = e.target.files?.[0]; if (!f) return; setFile(f); setPreview(URL.createObjectURL(f)); };

  const launch = async () => {
    if (!connected) return toast.error("Connect your wallet first");
    if (!form.name.trim() || !form.symbol.trim()) return toast.error("Name and ticker are required");
    if (!file) return toast.error("Choose a token image");
    setBusy(true); setResult(null); setLog([]);
    try {
      addLog("uploading image + metadata to IPFS…");
      const fd = new FormData();
      ["name", "symbol", "description", "twitter", "telegram", "website"].forEach((k) => fd.append(k, form[k]));
      fd.append("file", file);
      const metaRes = await fetch(`${API}/metadata`, { method: "POST", body: fd });
      if (!metaRes.ok) throw new Error(`metadata: ${await metaRes.text()}`);
      const meta = await metaRes.json();
      addLog(`metadata uri -> ${meta.metadataUri}`, "ok");

      const mint = Keypair.generate();
      addLog(`mint -> ${mint.publicKey.toBase58()}`);

      addLog("building the launch transaction…");
      const tradeRes = await fetch(`${API}/trade-local`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey, action: "create",
          tokenMetadata: { name: form.name, symbol: form.symbol, uri: meta.metadataUri },
          mint: mint.publicKey.toBase58(), denominatedInSol: "true",
          amount: Number(form.amount) || 0, slippage: Number(form.slippage) || 10,
          priorityFee: Number(form.priorityFee) || 0.00005, pool: "pump",
        }),
      });
      if (!tradeRes.ok) throw new Error(`pumpportal: ${await tradeRes.text()}`);
      const tx = VersionedTransaction.deserialize(new Uint8Array(await tradeRes.arrayBuffer()));
      addLog("signing with mint key…");
      tx.sign([mint]);

      addLog("approve the transaction in Phantom…", "warn");
      const connection = new Connection(RPC, "confirmed");
      let signature;
      if (provider.signAndSendTransaction) {
        const res = await provider.signAndSendTransaction(tx);
        signature = res.signature || res;
      } else {
        const signed = await provider.signTransaction(tx);
        signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
      }
      addLog(`submitted -> ${signature}`, "ok");
      const latest = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction({ signature, ...latest }, "confirmed");
      addLog("confirmed ✓ token is live on-chain", "ok");

      const rec = await fetch(`${API}/launches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: mint.publicKey.toBase58(), signature, creator: publicKey, name: form.name, symbol: form.symbol, metadataUri: meta.metadataUri, image: meta.metadata?.image || preview, network: "mainnet-beta" }),
      }).then((r) => r.json());

      setResult({ mint: mint.publicKey.toBase58(), signature, attestation: rec.attestation, image: meta.metadata?.image });
      toast.success("Coin launched on mainnet", { description: `${form.name} ($${form.symbol})` });
    } catch (e) {
      const msg = e?.message || String(e);
      addLog(`error: ${msg}`, "err");
      toast.error(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen">
      <TopTabs brand="AEGIS" accent="" />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-primary"><Rocket size={13} /> quantum-safe launchpad · mainnet</div>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl">Launch a token that<br /><span className="text-primary text-glow">survives Q-day.</span></h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Your wallet signs and pays. The mint is created on-chain and bound to a hash-based WOTS + Merkle attestation — a post-quantum fingerprint no elliptic-curve break can forge.</p>
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/5 px-4 py-2.5 font-mono text-xs text-amber"><AlertTriangle size={14} /> Mainnet · real SOL. Dev-buy + network fees are spent from your wallet.</div>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card-premium space-y-5 rounded-xl p-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Name *"><input data-testid="launch-name" className={inputCls} value={form.name} onChange={set("name")} placeholder="Quantum Doge" /></Field>
              <Field label="Ticker *"><input data-testid="launch-symbol" className={inputCls} value={form.symbol} maxLength={10} onChange={set("symbol")} placeholder="QDOGE" /></Field>
            </div>
            <Field label="Image *" hint="PNG / JPG / GIF / WEBP · max 10MB">
              <div className="mt-1 flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 border border-border bg-background px-3 py-2.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  <Upload size={14} /> Choose file
                  <input data-testid="launch-image" type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onFile} />
                </label>
                {preview && <img src={preview} alt="preview" className="h-11 w-11 border border-border object-cover" />}
                {file && <span className="truncate font-mono text-[11px] text-muted-foreground">{file.name}</span>}
              </div>
            </Field>
            <Field label="Description"><textarea data-testid="launch-description" rows={3} className={inputCls} value={form.description} onChange={set("description")} placeholder="Post-quantum meme reserve…" /></Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field label="Twitter"><input className={inputCls} value={form.twitter} onChange={set("twitter")} placeholder="https://x.com/…" /></Field>
              <Field label="Telegram"><input className={inputCls} value={form.telegram} onChange={set("telegram")} placeholder="https://t.me/…" /></Field>
              <Field label="Website"><input className={inputCls} value={form.website} onChange={set("website")} placeholder="https://…" /></Field>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field label="Dev buy (SOL)" hint="initial buy"><input data-testid="launch-amount" type="number" step="0.001" min="0" className={inputCls} value={form.amount} onChange={set("amount")} /></Field>
              <Field label="Slippage %"><input type="number" step="0.5" min="0" className={inputCls} value={form.slippage} onChange={set("slippage")} /></Field>
              <Field label="Priority fee (SOL)"><input type="number" step="0.00001" min="0" className={inputCls} value={form.priorityFee} onChange={set("priorityFee")} /></Field>
            </div>
            <button data-testid="launch-submit" onClick={launch} disabled={busy || !connected} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 font-mono text-sm font-semibold uppercase tracking-[0.15em] text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_10px_40px_-12px_hsl(158_84%_46%/0.5)] disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}{connected ? "Sign & launch on mainnet" : "Connect wallet to launch"}
            </button>
          </div>

          <div className="space-y-6">
            {result ? (
              <div data-testid="launch-result" className="scanlines border border-primary/40 bg-black p-6 border-glow">
                <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.15em] text-primary"><ShieldCheck size={16} /> Live on mainnet</div>
                <div className="mt-4 flex items-center gap-3">
                  {result.image && <img src={result.image} alt="" referrerPolicy="no-referrer" className="h-12 w-12 border border-border object-cover" />}
                  <div className="font-display text-2xl font-bold">{form.name} <span className="text-muted-foreground">${form.symbol}</span></div>
                </div>
                <div className="mt-5 space-y-2 font-mono text-xs">
                  <KV k="mint" v={result.mint} onCopy />
                  <KV k="tx" v={result.signature} onCopy />
                  {result.attestation && <>
                    <KV k="merkle leaf" v={`#${result.attestation.leaf_index} · ${short(result.attestation.leaf, 8)}`} />
                    <KV k="registered root" v={short(result.attestation.root, 10)} accent />
                  </>}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a data-testid="view-pump" href={`https://pump.fun/coin/${result.mint}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90">View token <ExternalLink size={13} /></a>
                  <a href={`https://solscan.io/tx/${result.signature}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 border border-primary/40 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-primary hover:bg-primary/10">Solscan <ExternalLink size={13} /></a>
                  <button onClick={() => { setResult(null); setLog([]); }} className="border border-border px-4 py-2.5 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-primary">Launch another</button>
                </div>
              </div>
            ) : busy || log.length ? (
              <div className="scanlines h-full border border-primary/30 bg-black p-4 font-mono text-[11px] sm:text-xs">
                <div className="mb-2 flex items-center justify-between border-b border-primary/20 pb-2 text-muted-foreground"><span>aegis@node: ~/launch</span><span className="text-primary/70">mainnet</span></div>
                <div ref={logRef} className="max-h-[520px] space-y-1 overflow-auto">
                  {log.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="shrink-0 text-muted-foreground/50">{l.t}</span>
                      <span className={l.kind === "ok" ? "text-primary" : l.kind === "err" ? "text-destructive" : l.kind === "warn" ? "text-amber" : "text-foreground/80"}>{l.kind === "ok" ? "✓ " : l.kind === "err" ? "✗ " : "» "}{l.msg}</span>
                    </div>
                  ))}
                  {busy && <div className="text-primary">▊<span className="cursor-blink">_</span></div>}
                </div>
              </div>
            ) : (<AttestationPreview form={form} preview={preview} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

const KV = ({ k, v, accent, onCopy }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2">
    <span className="text-muted-foreground">{k}</span>
    <span className="flex items-center gap-1.5">
      <span className={`truncate ${accent ? "text-primary" : "text-foreground"}`}>{v}</span>
      {onCopy && <button onClick={() => { navigator.clipboard.writeText(v); toast.success(`${k} copied`); }} className="text-muted-foreground hover:text-primary"><Copy size={11} /></button>}
    </span>
  </div>
);
