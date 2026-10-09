import { useEffect, useRef, useState } from "react";

const CHAINS = [
  { id: "c00", d: 8 }, { id: "c01", d: 1 }, { id: "c02", d: 4 },
  { id: "c03", d: 10 }, { id: "c04", d: 10 }, { id: "c05", d: 3 },
  { id: "c06", d: 14 }, { id: "c07", d: 6 },
];

const rndHex = (n) =>
  Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const bar = (filled) => {
  const total = 15;
  const f = Math.max(0, Math.min(total, filled));
  return "■".repeat(f) + (f < total ? "█" : "") + "·".repeat(Math.max(0, total - f - 1));
};

export const WotsTerminal = () => {
  const [progress, setProgress] = useState(0);
  const [tick, setTick] = useState(0);
  const [done, setDone] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => {
      setProgress((p) => {
        if (p >= 16) {
          setDone(true);
          return 0; // loop
        }
        return p + 1;
      });
      setTick((t) => t + 1);
    }, 320);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      ref={ref}
      data-testid="wots-terminal"
      className="scanlines relative h-full border border-primary/30 bg-black p-4 font-mono text-[11px] leading-relaxed text-primary/90 sm:text-xs"
    >
      <div className="mb-3 flex items-center justify-between border-b border-primary/20 pb-2">
        <span className="text-muted-foreground">pqc@bunker: ~/verify</span>
        <span className="text-secondary">wots-sha256 · w=16</span>
      </div>

      <div className="space-y-0.5">
        <div className="text-foreground">
          <span className="text-primary">pqc@bunker:~$</span> wots verify --live
          <span className="cursor-blink">▊</span>
        </div>
        <div className="text-muted-foreground"># sign&nbsp;&nbsp;&nbsp;σ[i] = H^d[i](sk[i])</div>
        <div className="text-muted-foreground"># verify&nbsp;pk[i] =? H^(15-d[i])(σ[i])</div>
        <div className="text-muted-foreground"># compress ℓ = H(pk[0] ‖ … ‖ pk[66])</div>
        <div className="text-muted-foreground"># climb&nbsp;&nbsp;root =? H(…H(ℓ ‖ a[0])… ‖ a[7])</div>
      </div>

      <div className="mt-3 space-y-0.5">
        {CHAINS.map((c, i) => {
          const filled = Math.min(15, Math.max(0, progress - i));
          const active = progress - i >= 0 && progress - i <= 15;
          return (
            <div key={c.id} className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-muted-foreground">{c.id}</span>
              <span className="text-secondary">d={c.d.toString(16)}</span>
              <span className={active ? "text-primary text-glow" : "text-primary/70"}>
                {bar(filled)}
              </span>
              <span className="text-muted-foreground/70">{rndHex(8)}</span>
            </div>
          );
        })}
        <div className="text-muted-foreground/60">… 59 more chains</div>
      </div>

      <div className="mt-3 space-y-0.5 border-t border-primary/20 pt-2">
        <div className="text-muted-foreground">
          msg&nbsp;&nbsp;<span className="text-foreground/80">0x{rndHex(24)}…</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">leaf</span>
          <span className="text-primary">{"-".repeat(28)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">root {progress}/8</span>
          <span className="text-primary">{"-".repeat(28)}</span>
        </div>
        <div className="pt-1">
          {done ? (
            <span className="bg-primary px-2 py-0.5 font-bold text-black">[ OK ] root verified</span>
          ) : (
            <span className="text-secondary text-glow-amber">[ .. ] signing message</span>
          )}
        </div>
      </div>
    </div>
  );
};
