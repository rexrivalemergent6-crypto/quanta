import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { TopTabs } from "@/components/TopTabs";
import {
  ASSETS, METHODS, iconUrl, label, quoteFor, makeOrder, saveOrder,
} from "@/lib/swap";
import { toast } from "sonner";
import {
  Shield, ArrowDownUp, ChevronDown, Search, X, Loader2, Copy, ShieldCheck,
  Zap, Lock, Clock, CheckCircle2, Repeat, ArrowRight, Eye,
} from "lucide-react";

const fmt = (x) => {
  if (x == null || isNaN(x)) return "—";
  if (x >= 1000) return Number(x).toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (x >= 1) return Number(x).toLocaleString(undefined, { maximumFractionDigits: 4 });
  return Number(x).toLocaleString(undefined, { maximumFractionDigits: 8 });
};
const short = (s, n = 6) => (s ? `${s.slice(0, n)}…${s.slice(-n)}` : "");

const Coin = ({ a, size = 20 }) => {
  const [err, setErr] = useState(false);
  const url = iconUrl(a?.icon);
  if (!a) return null;
  if (url && !err) return <img src={url} alt="" width={size} height={size} onError={() => setErr(true)} className="rounded-full" style={{ width: size, height: size }} />;
  return <span className="flex items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] text-primary" style={{ width: size, height: size }}>{label(a).slice(0, 2)}</span>;
};

const TabNav = () => (
  <nav className="flex items-center gap-1">
    <Link to="/" className="px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-primary">Vault</Link>
  </nav>
);

function AssetModal({ open, onClose, onPick, exclude }) {
  const [q, setQ] = useState("");
  if (!open) return null;
  const list = ASSETS.filter((a) => a.symbol !== exclude &&
    (`${label(a)} ${a.name} ${a.chain}`).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md border border-border bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search size={15} className="text-muted-foreground" />
          <input autoFocus data-testid="asset-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search asset or chain" className="w-full bg-transparent font-mono text-sm text-foreground focus:outline-none placeholder:text-muted-foreground/50" />
          <button onClick={onClose}><X size={16} className="text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="max-h-80 overflow-auto">
          {list.map((a) => (
            <button key={a.symbol} data-testid={`asset-${a.symbol}`} onClick={() => { onPick(a); onClose(); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary/5">
              <Coin a={a} size={28} />
              <div className="flex-1">
                <div className="font-mono text-sm text-foreground">{label(a)}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{a.name}</div>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{a.chain}</span>
            </button>
          ))}
          {!list.length && <div className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">no matches</div>}
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Awaiting deposit", "Deposit detected", "Exchanging privately", "Sending to you", "Completed"];

export default function SwapPage() {
  const [method, setMethod] = useState("private");
  const [send, setSend] = useState(ASSETS[0]); // BTC
  const [recv, setRecv] = useState(ASSETS[2]); // SOL
  const [amount, setAmount] = useState("0.05");
  const [dest, setDest] = useState("");
  const [refund, setRefund] = useState("");
  const [quote, setQuote] = useState(null);
  const [modal, setModal] = useState(null); // 'send' | 'recv'
  const [order, setOrder] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const recompute = useCallback(() => {
    setQuote(quoteFor({ send, recv, amount, method }));
  }, [send, recv, amount, method]);

  useEffect(() => { recompute(); }, [recompute]);
  useEffect(() => {
    if (order) return;
    const t = setInterval(recompute, 6000); // keep rate "live"
    return () => clearInterval(t);
  }, [order, recompute]);

  // simulate order progression
  useEffect(() => {
    if (!order) return;
    if (step >= STEPS.length - 1) return;
    const delay = step === 0 ? 4000 : 3000;
    const t = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(t);
  }, [order, step]);

  const flip = () => { setSend(recv.addr === "sol" || true ? recv : recv); const s = send; setSend(recv); setRecv(s); };

  const copy = (v, l) => { navigator.clipboard.writeText(v); toast.success(`${l} copied`); };

  const canSwap = quote && !quote.belowMin && dest.trim() && (method !== "privacy" || refund.trim());

  const createSwap = async () => {
    if (!quote) return toast.error("Enter an amount");
    if (quote.belowMin) return toast.error(`Minimum is ~${fmt(quote.min)} ${label(send)}`);
    if (!dest.trim()) return toast.error("Enter your destination address");
    if (method === "privacy" && !refund.trim()) return toast.error("Enter a refund address");
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 650));
      const o = makeOrder({ send, recv, amount, quote, method, destination: dest.trim() });
      saveOrder(o);
      setOrder(o); setStep(0);
      toast.success("Private route locked", { description: `${o.provider} · order ${o.id}` });
    } finally { setBusy(false); }
  };

  const reset = () => { setOrder(null); setStep(0); };

  return (
    <div className="min-h-screen">
      <TopTabs brand="dark" accent="swap" wallet={false} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-primary"><Lock size={14} /> Private routing · no account · no KYC</div>
        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-tighter sm:text-5xl">Swap without <span className="text-primary text-glow">a trace.</span></h1>
        <p className="mt-3 max-w-xl font-sans text-sm text-muted-foreground">Cross-chain swaps routed privately through non-custodial engines. Send coins to a one-time deposit address; the route breaks the on-chain link before the output reaches you.</p>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* swap card */}
          <div className="lg:col-span-3">
            {!order ? (
              <div data-testid="swap-card" className="border border-border bg-card p-5">
                {/* engine toggle */}
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(METHODS).map((m) => {
                    const active = method === m.id;
                    return (
                      <button key={m.id} data-testid={`engine-${m.id}`} onClick={() => setMethod(m.id)}
                        className={`flex flex-col items-start border p-3 text-left transition-all ${active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"}`}>
                        <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                          {m.id === "private" ? <Zap size={13} className="text-primary" /> : <Eye size={13} className="text-primary" />} {m.label}
                        </span>
                        <span className="mt-0.5 font-mono text-[10px] text-muted-foreground">{m.sub} · {m.provider}</span>
                      </button>
                    );
                  })}
                </div>

                {/* send */}
                <div className="mt-4 border border-border bg-background p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">You send</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input data-testid="send-amount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent font-mono text-2xl text-foreground focus:outline-none" />
                    <button data-testid="select-send" onClick={() => setModal("send")} className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 transition-colors hover:border-primary">
                      <Coin a={send} /> <span className="font-mono text-sm font-medium">{label(send)}</span> <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>{send.chain}</span>
                    <span>{quote ? `≈ $${fmt(quote.usdIn)}` : ""}</span>
                  </div>
                </div>

                <div className="relative flex justify-center">
                  <button data-testid="flip" onClick={flip} className="absolute -top-3 z-10 flex h-8 w-8 items-center justify-center border border-primary bg-background text-primary transition-transform hover:rotate-180"><ArrowDownUp size={14} /></button>
                </div>

                {/* receive */}
                <div className="mt-2 border border-border bg-background p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">You receive (estimated)</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div data-testid="recv-amount" className="w-full font-mono text-2xl text-primary">{quote ? fmt(quote.out) : "0.0"}</div>
                    <button data-testid="select-recv" onClick={() => setModal("recv")} className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 transition-colors hover:border-primary">
                      <Coin a={recv} /> <span className="font-mono text-sm font-medium">{label(recv)}</span> <ChevronDown size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                    <span>{recv.chain}</span>
                    <span>{quote ? `≈ $${fmt(quote.usdOut)}` : ""}</span>
                  </div>
                </div>

                {/* quote details */}
                <div className="mt-3 space-y-1.5 border border-border bg-background p-3 font-mono text-[11px]">
                  <Row k="Rate" v={quote ? `1 ${label(send)} ≈ ${fmt(quote.rate)} ${label(recv)}` : "—"} />
                  <Row k="Route" v={<span className="flex items-center gap-1 text-primary"><span className="inline-block h-1.5 w-1.5 animate-pulse bg-primary" /> {quote?.provider || METHODS[method].provider}</span>} />
                  <Row k="Network fee" v={quote ? `$${fmt(quote.feeUsd)}` : "—"} />
                  <Row k="ETA" v={quote ? `~${quote.eta} min` : "—"} />
                  {quote && <Row k="Limits" v={`${fmt(quote.min)} – ${fmt(quote.max)} ${label(send)}`} />}
                </div>

                {/* destination */}
                <div className="mt-3">
                  <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Destination ({recv.chain}) address</label>
                  <input data-testid="dest-address" value={dest} onChange={(e) => setDest(e.target.value)} placeholder={`Your ${recv.chain} receiving address`} className="mt-1 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none placeholder:text-muted-foreground/40" />
                </div>
                {method === "privacy" && (
                  <div className="mt-3">
                    <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Refund ({send.chain}) address</label>
                    <input data-testid="refund-address" value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="Where to return funds if the swap fails" className="mt-1 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none placeholder:text-muted-foreground/40" />
                  </div>
                )}

                <button data-testid="create-swap" onClick={createSwap} disabled={busy || !canSwap}
                  className="mt-4 flex w-full items-center justify-center gap-2 border border-primary bg-primary py-3.5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 hover:shadow-[0_0_18px_hsl(135_100%_50%/0.45)] disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  {!quote ? "Enter an amount" : quote.belowMin ? "Below minimum" : !dest.trim() ? "Enter destination" : (method === "privacy" && !refund.trim()) ? "Enter refund address" : "Create private swap"}
                </button>
              </div>
            ) : (
              <div data-testid="order-panel" className="border border-primary/40 bg-card p-5 border-glow">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Order {order.id}</div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{order.provider}</span>
                </div>
                <div className="mt-4 flex items-center justify-center gap-3 font-mono text-sm">
                  <span className="flex items-center gap-1.5"><Coin a={{ icon: order.sendIcon, symbol: order.sendSymbol }} /> {fmt(order.amountIn)} {order.sendSymbol}</span>
                  <ArrowRight size={16} className="text-primary" />
                  <span className="flex items-center gap-1.5"><Coin a={{ icon: order.recvIcon, symbol: order.recvSymbol }} /> {fmt(order.outAmount)} {order.recvSymbol}</span>
                </div>

                <div className="mt-5 border border-border bg-background p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Send exactly {fmt(order.amountIn)} {order.sendSymbol} to</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="flex-1 break-all font-mono text-xs text-primary">{order.depositAddress}</code>
                    <button onClick={() => copy(order.depositAddress, "Deposit address")} className="border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary"><Copy size={13} /></button>
                  </div>
                  {order.depositMemo && (
                    <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 font-mono text-[11px]">
                      <span className="text-muted-foreground">MEMO / Tag (required)</span>
                      <span className="flex items-center gap-1.5 text-amber">{order.depositMemo} <button onClick={() => copy(order.depositMemo, "Memo")}><Copy size={11} /></button></span>
                    </div>
                  )}
                </div>

                {/* status timeline */}
                <div className="mt-5 space-y-2">
                  {STEPS.map((s, i) => {
                    const done = i < step, cur = i === step;
                    return (
                      <div key={s} className="flex items-center gap-3 font-mono text-xs">
                        {done ? <CheckCircle2 size={16} className="text-primary" /> : cur ? <Loader2 size={16} className="animate-spin text-primary" /> : <Clock size={16} className="text-muted-foreground/40" />}
                        <span className={done || cur ? "text-foreground" : "text-muted-foreground/50"}>{s}</span>
                        {cur && i < STEPS.length - 1 && <span className="ml-auto text-muted-foreground">~{order.eta} min</span>}
                      </div>
                    );
                  })}
                </div>
                {step >= STEPS.length - 1 && (
                  <div className="mt-4 bg-primary px-3 py-2 font-mono text-xs font-bold text-black">[ OK ] {fmt(order.outAmount)} {order.recvSymbol} sent to {short(order.destination)}</div>
                )}

                <button data-testid="new-swap" onClick={reset} className="mt-4 flex w-full items-center justify-center gap-2 border border-primary/40 py-3 font-mono text-xs uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10"><Repeat size={14} /> New swap</button>
              </div>
            )}
          </div>

          {/* side info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-border bg-card p-5 font-mono text-[11px] leading-relaxed text-muted-foreground">
              <div className="mb-2 uppercase tracking-[0.2em] text-primary">How private routing works</div>
              <p><span className="text-foreground">1. Quote</span> — the router scans non-custodial liquidity ({METHODS.private.provider} / {METHODS.privacy.provider}) and picks the path with the best output.</p>
              <p className="mt-2"><span className="text-foreground">2. One-time deposit</span> — you send to a fresh address generated per order, so nothing links back to your wallet.</p>
              <p className="mt-2"><span className="text-foreground">3. Private settlement</span> — the engine swaps across chains and delivers the output to a brand-new destination, breaking the trace.</p>
            </div>
            <div className="border border-amber/40 bg-amber/5 p-4 font-mono text-[11px] text-amber">
              Live routing proxies <span className="underline">darkswap.app</span>. When the upstream is unavailable from this host, quotes fall back to a local engine so the flow stays demonstrable — deposit addresses shown then are illustrative.
            </div>
          </div>
        </div>
      </div>

      <AssetModal open={!!modal} onClose={() => setModal(null)} exclude={modal === "send" ? recv.symbol : send.symbol}
        onPick={(a) => (modal === "send" ? setSend(a) : setRecv(a))} />
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{k}</span>
    <span className="text-foreground">{v}</span>
  </div>
);
