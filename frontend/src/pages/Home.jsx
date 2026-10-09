import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getCoins, getStats } from "../lib/api";
import { CoinCard } from "../components/CoinCard";
import { WotsTerminal } from "../components/WotsTerminal";
import { ArrowRight, BookOpen, Loader2, ChevronDown } from "lucide-react";

const TABS = [
  { k: "all", label: "All coins" },
  { k: "standard", label: "Standard" },
  { k: "quantum", label: "Quantum" },
];
const SORTS = [
  { k: "newest", label: "Newest" },
  { k: "marketcap", label: "Market cap" },
  { k: "volume", label: "Volume" },
  { k: "holders", label: "Holders" },
];

const StatBox = ({ label, value, accent }) => (
  <div className="border border-border bg-card px-4 py-3">
    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    <div className={`mt-1 font-mono text-lg font-bold ${accent ? "text-primary text-glow" : "text-foreground"}`}>
      {value}
    </div>
  </div>
);

export default function Home() {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("marketcap");
  const [grad, setGrad] = useState(false);
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(48);
  const feedRef = useRef(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    getCoins({ tab, sort, filter: grad ? "graduated" : "all", limit })
      .then((d) => setCoins(d.coins || []))
      .catch(() => setCoins([]))
      .finally(() => setLoading(false));
  }, [tab, sort, grad, limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      {/* HERO */}
      <section className="grid-dots border-b border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-5">
            <Link to="/docs" className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10">
              <BookOpen size={12} /> Bunker mode: why hash-based keys matter now
            </Link>
            <h1 className="mt-6 font-display text-5xl font-black uppercase leading-[0.95] tracking-tighter text-foreground sm:text-6xl">
              Launch coins that <span className="text-primary text-glow">survive Q-day.</span>
            </h1>
            <p className="mt-5 max-w-md font-sans text-base leading-relaxed text-muted-foreground">
              Every coin is signed by a one-time, hash-based key derived from your wallet. Live on pump.fun,
              with provenance that outlives ECDSA.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/launch"
                data-testid="hero-launch-btn"
                className="flex items-center gap-2 border border-primary bg-primary px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 hover:shadow-[0_0_18px_hsl(135_100%_50%/0.45)]"
              >
                Launch a coin <ArrowRight size={14} />
              </Link>
              <Link
                to="/docs"
                data-testid="hero-docs-btn"
                className="flex items-center gap-2 border border-primary/40 px-5 py-3 font-mono text-xs uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10"
              >
                How it works
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-3">
              <StatBox label="signature" value={stats ? `${stats.signature_bytes} B` : "—"} />
              <StatBox label="keys / id" value="256" />
              <StatBox label="assumption" value={stats?.hash || "SHA-256"} accent />
            </div>
          </div>
          <div className="lg:col-span-7">
            <WotsTerminal />
          </div>
        </div>
      </section>

      {/* FEED */}
      <section ref={feedRef} className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Every pqc.market launch</h2>
            <div className="mt-1 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 animate-pulse bg-primary" /> live · proxied upstream
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* tabs */}
            <div className="flex border border-border">
              {TABS.map((t) => (
                <button
                  key={t.k}
                  data-testid={`tab-${t.k}`}
                  onClick={() => setTab(t.k)}
                  className={`px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                    tab === t.k ? "bg-primary text-black" : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* graduated filter */}
            <button
              data-testid="filter-graduated"
              onClick={() => setGrad((g) => !g)}
              className={`border px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                grad ? "border-amber bg-amber/20 text-amber" : "border-border text-muted-foreground hover:text-primary"
              }`}
            >
              {grad ? "Graduated ✓" : "Graduated"}
            </button>
            {/* sort */}
            <div className="relative">
              <select
                data-testid="sort-select"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="appearance-none border border-border bg-card py-2 pl-3 pr-8 font-mono text-xs uppercase tracking-wider text-foreground focus:border-primary focus:outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.k} value={s.k} className="bg-card">
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 font-mono text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={16} /> fetching feed…
          </div>
        ) : coins.length === 0 ? (
          <div className="py-24 text-center font-mono text-sm text-muted-foreground">no coins found</div>
        ) : (
          <>
            <div data-testid="coin-feed" className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {coins.map((c) => (
                <CoinCard key={c.mint} coin={c} />
              ))}
            </div>
            {tab !== "quantum" && (
              <div className="mt-8 flex justify-center">
                <button
                  data-testid="load-more-btn"
                  onClick={() => setLimit((l) => l + 48)}
                  className="border border-primary/40 px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] text-primary transition-colors hover:bg-primary/10"
                >
                  Load more coins
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
