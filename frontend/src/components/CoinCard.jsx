import { Link } from "react-router-dom";
import { fmtUsd, fmtNum, shortMint } from "../lib/api";
import { Users, TrendingUp } from "lucide-react";

const Badge = ({ coin }) => {
  const quantum = coin.source === "quantum";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
        quantum
          ? "bg-primary text-black"
          : "border border-primary/30 bg-primary/10 text-primary"
      }`}
    >
      {quantum ? "QUANTUM" : coin.variant || "attestation"}
    </span>
  );
};

export const CoinCard = ({ coin }) => {
  const to = coin.source === "quantum" ? `/coin/q/${coin.mint}` : `/coin/${coin.mint}`;
  const progress = Math.min(100, coin.bonding_progress || 0);
  return (
    <Link
      to={to}
      data-testid={`coin-card-${coin.mint}`}
      className="group flex h-full flex-col border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_20px_hsl(135_100%_50%/0.15)]"
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden border border-border bg-secondary">
          {coin.image ? (
            <img
              src={coin.image}
              alt={coin.symbol}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
              {coin.symbol?.slice(0, 3)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary">
              {coin.name}
            </h3>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">${coin.symbol}</span>
            <Badge coin={coin} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div>
          <div className="text-muted-foreground">MCAP</div>
          <div className="text-right text-foreground sm:text-left">{fmtUsd(coin.market_cap_usd)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">VOL 24H</div>
          <div className="text-foreground">{coin.volume_24h != null ? fmtUsd(coin.volume_24h) : "—"}</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users size={10} /> HOLD
          </div>
          <div className="text-foreground">{coin.holders != null ? fmtNum(coin.holders) : "—"}</div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
          <span className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp size={10} /> {coin.graduated ? "Graduated" : "Bonding curve"}
          </span>
          <span className={coin.graduated ? "text-amber" : "text-primary"}>
            {progress.toFixed(1)}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-secondary">
          <div
            className={`h-full ${coin.graduated ? "bg-amber" : "bg-primary"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 font-mono text-[10px] text-muted-foreground/60">{shortMint(coin.mint)}</div>
      </div>
    </Link>
  );
};
