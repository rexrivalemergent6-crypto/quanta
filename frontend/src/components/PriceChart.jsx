import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getCandles } from "../lib/api";

const TF = {
  "1H": { interval: "1m", limit: 60 },
  "1D": { interval: "5m", limit: 288 },
  "1W": { interval: "1h", limit: 168 },
  "1M": { interval: "1h", limit: 720 },
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="border border-primary/40 bg-black px-3 py-2 font-mono text-xs">
      <div className="text-primary">${p.c < 0.01 ? p.c.toExponential(3) : p.c.toFixed(6)}</div>
      <div className="text-muted-foreground">{p.label}</div>
    </div>
  );
};

export const PriceChart = ({ mint }) => {
  const [tf, setTf] = useState("1D");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getCandles(mint, TF[tf])
      .then((d) => {
        if (!alive) return;
        const rows = (d.candles || []).map((c) => ({
          ...c,
          label: new Date(c.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        }));
        setData(rows);
      })
      .catch(() => alive && setData([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mint, tf]);

  const up = data.length > 1 && data[data.length - 1].c >= data[0].c;
  const color = up ? "#00FF41" : "#FF4D4D";

  return (
    <div data-testid="price-chart" className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Price · USD</span>
        <div className="flex">
          {Object.keys(TF).map((k) => (
            <button
              key={k}
              data-testid={`chart-tf-${k}`}
              onClick={() => setTf(k)}
              className={`px-2.5 py-1 font-mono text-xs transition-colors ${
                tf === k ? "bg-primary text-black" : "text-muted-foreground hover:text-primary"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[320px] w-full p-2">
        {loading ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
            <span className="cursor-blink">▊</span>&nbsp;loading candles…
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs text-muted-foreground">
            no chart data from upstream for this interval
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(145 28% 14%)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" hide />
              <YAxis
                orientation="right"
                width={64}
                tick={{ fill: "#849D8E", fontSize: 10, fontFamily: "JetBrains Mono" }}
                tickFormatter={(v) => (v < 0.01 ? v.toExponential(1) : v.toFixed(4))}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="c" stroke={color} strokeWidth={1.5} fill="url(#pg)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
