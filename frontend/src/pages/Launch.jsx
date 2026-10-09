import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { launchCoin } from "../lib/api";
import { Loader2, Rocket, ShieldCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const Field = ({ label, children, hint }) => (
  <div>
    <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</label>
    {children}
    {hint && <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">{hint}</p>}
  </div>
);

const inputCls =
  "mt-1 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none placeholder:text-muted-foreground/40";

export default function Launch() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", symbol: "", description: "", image: "",
    twitter: "", telegram: "", website: "", fee_pct: 1, quantum: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name.trim() || !form.symbol.trim()) return toast.error("Name and ticker are required");
    setSubmitting(true);
    try {
      const res = await launchCoin({ ...form, fee_pct: parseFloat(form.fee_pct) || 1 });
      setResult(res);
      toast.success("Coin launched", { description: `WOTS attestation anchored · leaf #${res.attestation.leaf_index ?? ""}` });
    } catch {
      toast.error("Launch failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const a = result.attestation;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <div className="scanlines border border-primary/40 bg-black p-6 border-glow">
          <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-[0.15em] text-primary">
            <ShieldCheck size={16} /> Launch signed &amp; anchored
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
            {result.coin.name} <span className="text-muted-foreground">${result.coin.symbol}</span>
          </h1>
          <div className="mt-5 space-y-2 font-mono text-xs">
            <KV k="mint" v={result.mint} />
            <KV k="merkle leaf" v={`#${a.leaf_index} · ${a.leaf}`} />
            <KV k="registered root" v={a.root} accent />
            <KV k="signature" v={`${a.signature_bytes} bytes · WOTS+ / SHA-256`} />
          </div>
          <div className="mt-6 flex gap-3">
            <button
              data-testid="view-coin-btn"
              onClick={() => nav(`/coin/q/${result.mint}`)}
              className="flex items-center gap-2 border border-primary bg-primary px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80"
            >
              View coin <ArrowRight size={14} />
            </button>
            <button
              onClick={() => { setResult(null); setForm({ name: "", symbol: "", description: "", image: "", twitter: "", telegram: "", website: "", fee_pct: 1, quantum: true }); }}
              className="border border-primary/40 px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10"
            >
              Launch another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">
        <Rocket size={14} /> New launch
      </div>
      <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tighter text-foreground">
        Launch a <span className="text-primary text-glow">quantum-safe</span> coin
      </h1>
      <p className="mt-3 font-sans text-sm text-muted-foreground">
        A one-time WOTS key is derived from your launch and compressed into a Merkle identity. The root is
        registered as your coin's post-quantum anchor.
      </p>

      <div className="mt-8 space-y-5 border border-border bg-card p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Name *">
            <input data-testid="launch-name" className={inputCls} value={form.name} onChange={set("name")} placeholder="Quantum Doge" />
          </Field>
          <Field label="Ticker *">
            <input data-testid="launch-symbol" className={inputCls} value={form.symbol} onChange={set("symbol")} placeholder="QDOGE" />
          </Field>
        </div>
        <Field label="Description">
          <textarea data-testid="launch-description" rows={3} className={inputCls} value={form.description} onChange={set("description")} placeholder="Post-quantum meme reserve…" />
        </Field>
        <Field label="Image URL" hint="Paste a hosted image / IPFS link">
          <input data-testid="launch-image" className={inputCls} value={form.image} onChange={set("image")} placeholder="https://… / ipfs://…" />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Twitter">
            <input className={inputCls} value={form.twitter} onChange={set("twitter")} placeholder="https://x.com/…" />
          </Field>
          <Field label="Telegram">
            <input className={inputCls} value={form.telegram} onChange={set("telegram")} placeholder="https://t.me/…" />
          </Field>
          <Field label="Website">
            <input className={inputCls} value={form.website} onChange={set("website")} placeholder="https://…" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Creator fee %">
            <input data-testid="launch-fee" type="number" step="0.1" min="0" className={inputCls} value={form.fee_pct} onChange={set("fee_pct")} />
          </Field>
          <Field label="Attestation mode">
            <div className="mt-1 flex border border-border">
              <button onClick={() => setForm((f) => ({ ...f, quantum: true }))} className={`flex-1 py-2.5 font-mono text-xs uppercase ${form.quantum ? "bg-primary text-black" : "text-muted-foreground"}`}>Quantum</button>
              <button onClick={() => setForm((f) => ({ ...f, quantum: false }))} className={`flex-1 py-2.5 font-mono text-xs uppercase ${!form.quantum ? "bg-primary text-black" : "text-muted-foreground"}`}>Hybrid</button>
            </div>
          </Field>
        </div>

        <button
          data-testid="launch-submit"
          onClick={submit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 border border-primary bg-primary py-3.5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 hover:shadow-[0_0_18px_hsl(135_100%_50%/0.45)] disabled:opacity-50"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          Sign &amp; launch
        </button>
      </div>
    </div>
  );
}

const KV = ({ k, v, accent }) => (
  <div className="flex flex-col gap-0.5 border-b border-border/50 pb-2 sm:flex-row sm:items-center sm:justify-between">
    <span className="text-muted-foreground">{k}</span>
    <span className={`break-all ${accent ? "text-primary" : "text-foreground"}`}>{v}</span>
  </div>
);
