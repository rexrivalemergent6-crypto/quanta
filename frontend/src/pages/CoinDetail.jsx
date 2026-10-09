import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getCoin, getTrades, postTrade, fmtUsd, fmtNum, shortMint } from "../lib/api";
import { PriceChart } from "../components/PriceChart";
import { AttestationVerify } from "../components/AttestationVerify";
import { ArrowLeft, Twitter, Globe, Send, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Stat = ({ label, value, accent }) => (
  <div className="border border-border bg-card px-3 py-2.5">
    <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
    <div className={`mt-0.5 font-mono text-sm font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
  </div>
);

export default function CoinDetail() {
  const { mint } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState([]);
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("0.5");
  const [submitting, setSubmitting] = useState(false);

  const loadTrades = () => getTrades(mint).then((d) => setTrades(d.trades || [])).catch(() => {});

  useEffect(() => {
    setLoading(true);
    getCoin(mint)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    loadTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint]);

  const submitTrade = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid SOL amount");
    setSubmitting(true);
    try {
      const res = await postTrade(mint, { side, sol_amount: amt, wallet: "demo-wallet" });
      toast.success(`${side.toUpperCase()} ${amt} SOL recorded`, {
        description: `≈ ${fmtUsd(res.trade.usd_amount)} · demo ledger`,
      });
      setTrades((t) => [res.trade, ...t]);
    } catch {
      toast.error("Trade failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 py-40 font-mono text-sm text-muted-foreground">
        <Loader2 className="animate-spin" size={16} /> loading coin…
      </div>
    );
  if (!data)
    return (
      <div className="py-40 text-center font-mono text-sm text-muted-foreground">
        coin not found ·{" "}
        <Link to="/" className="text-primary">
          back
        </Link>
      </div>
    );

  const c = data.coin;
  const att = data.attestation;
  const progress = Math.min(100, c.bonding_progress || 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link to="/" data-testid="back-link" className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft size={14} /> All coins
      </Link>

      {/* header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <div className="h-16 w-16 shrink-0 overflow-hidden border border-border bg-secondary">
          {c.image ? (
            <img src={c.image} alt={c.symbol} referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-muted-foreground">{c.symbol?.slice(0, 3)}</div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{c.name}</h1>
            <span className="font-mono text-sm text-muted-foreground">${c.symbol}</span>
            <span className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${c.source === "quantum" ? "bg-primary text-black" : "border border-primary/30 text-primary"}`}>
              {c.source === "quantum" ? "QUANTUM" : c.variant}
            </span>
          </div>
          <button
            data-testid="copy-mint"
            onClick={() => {
              navigator.clipboard.writeText(c.mint);
              toast.success("Mint copied");
            }}
            className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            {shortMint(c.mint)} <Copy size={11} />
          </button>
        </div>
        <div className="flex gap-2">
          {c.twitter && (
            <a href={c.twitter} target="_blank" rel="noreferrer" className="border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Twitter size={14} />
            </a>
          )}
          {c.telegram && (
            <a href={c.telegram} target="_blank" rel="noreferrer" className="border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Send size={14} />
            </a>
          )}
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer" className="border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Globe size={14} />
            </a>
          )}
        </div>
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Market cap" value={fmtUsd(c.market_cap_usd)} accent />
        <Stat label="Volume 24h" value={c.volume_24h != null ? fmtUsd(c.volume_24h) : "—"} />
        <Stat label="Holders" value={c.holders != null ? fmtNum(c.holders) : "—"} />
        <Stat label="Status" value={c.graduated ? "Graduated" : `${progress.toFixed(1)}%`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* left: chart + trades */}
        <div className="space-y-6 lg:col-span-2">
          <PriceChart mint={c.mint} />

          {/* bonding */}
          <div className="border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between font-mono text-xs uppercase tracking-[0.15em]">
              <span className="text-muted-foreground">{c.graduated ? "Graduated" : "Bonding curve progress"}</span>
              <span className={c.graduated ? "text-amber" : "text-primary"}>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full bg-secondary">
              <div className={`h-full ${c.graduated ? "bg-amber" : "bg-primary"}`} style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* trades */}
          <div className="border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Recent trades
            </div>
            <div className="max-h-72 overflow-auto">
              {trades.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                  no trades yet · place one on the demo ledger
                </div>
              ) : (
                <table className="w-full font-mono text-xs">
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2">
                          <span className={t.side === "buy" ? "text-primary" : "text-destructive"}>{t.side.toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-foreground">{t.sol_amount} SOL</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{fmtUsd(t.usd_amount)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground/60">{t.wallet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* right: trade panel + attestation */}
        <div className="space-y-6">
          <div data-testid="trade-panel" className="border border-border bg-card p-4">
            <div className="mb-3 grid grid-cols-2 gap-0 border border-border">
              <button
                data-testid="side-buy"
                onClick={() => setSide("buy")}
                className={`py-2 font-mono text-xs font-bold uppercase transition-colors ${side === "buy" ? "bg-primary text-black" : "text-muted-foreground hover:text-primary"}`}
              >
                Buy
              </button>
              <button
                data-testid="side-sell"
                onClick={() => setSide("sell")}
                className={`py-2 font-mono text-xs font-bold uppercase transition-colors ${side === "sell" ? "bg-destructive text-white" : "text-muted-foreground hover:text-destructive"}`}
              >
                Sell
              </button>
            </div>
            <label className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Amount (SOL)</label>
            <input
              data-testid="trade-amount"
              type="number"
              value={amount}
              step="0.1"
              min="0"
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <div className="mt-2 flex gap-1.5">
              {[0.1, 0.5, 1, 5].map((v) => (
                <button key={v} onClick={() => setAmount(String(v))} className="flex-1 border border-border py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                  {v}
                </button>
              ))}
            </div>
            <button
              data-testid="submit-trade"
              onClick={submitTrade}
              disabled={submitting}
              className={`mt-3 flex w-full items-center justify-center gap-2 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-all disabled:opacity-50 ${side === "buy" ? "bg-primary hover:bg-primary/80" : "bg-destructive text-white hover:bg-destructive/80"}`}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {side === "buy" ? "Place buy" : "Place sell"}
            </button>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
              Demo ledger · trades are recorded off-chain to showcase the flow. Live trading settles on pump.fun.
            </p>
          </div>

          {/* attestation summary */}
          <div className="border border-border bg-card p-4 font-mono text-xs">
            <div className="mb-2 uppercase tracking-[0.2em] text-muted-foreground">Hash-based attestation</div>
            <div className="space-y-1.5">
              <Row k="scheme" v={att.scheme} />
              <Row k="w" v={att.w} />
              <Row k="chains" v={att.chains} />
              <Row k="sig size" v={`${att.signature_bytes} B`} />
              <Row k="leaf" v={`#${att.leaf_index} ${att.leaf.slice(0, 10)}…`} />
              <Row k="root" v={`${att.root.slice(0, 10)}…${att.root.slice(-6)}`} accent />
              <Row k="verify" v={`${att.verify_hash_calls} SHA-256`} />
            </div>
          </div>

          <AttestationVerify mint={c.mint} />
        </div>
      </div>
    </div>
  );
}

const Row = ({ k, v, accent }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-muted-foreground">{k}</span>
    <span className={`truncate ${accent ? "text-primary" : "text-foreground"}`}>{v}</span>
  </div>
);
