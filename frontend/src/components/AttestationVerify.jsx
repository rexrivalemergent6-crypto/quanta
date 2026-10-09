import { useEffect, useState } from "react";
import { verifyAttestation } from "../lib/api";
import { ShieldCheck, Loader2, RefreshCw } from "lucide-react";

export const AttestationVerify = ({ mint }) => {
  const [res, setRes] = useState(null);
  const [visible, setVisible] = useState(0);
  const [loading, setLoading] = useState(true);

  const run = () => {
    setLoading(true);
    setVisible(0);
    setRes(null);
    verifyAttestation(mint)
      .then((d) => setRes(d))
      .catch(() => setRes({ verified: false, steps: [] }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mint]);

  useEffect(() => {
    if (!res || !res.steps.length) return;
    if (visible >= res.steps.length) return;
    const t = setTimeout(() => setVisible((v) => v + 1), 220);
    return () => clearTimeout(t);
  }, [res, visible]);

  return (
    <div data-testid="attestation-panel" className="scanlines border border-primary/30 bg-black">
      <div className="flex items-center justify-between border-b border-primary/20 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-primary">
          <ShieldCheck size={14} /> Attestation verified in your browser
        </div>
        <button
          data-testid="reverify-btn"
          onClick={run}
          className="flex items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground transition-colors hover:text-primary"
        >
          <RefreshCw size={11} /> re-verify
        </button>
      </div>

      <div className="space-y-2 p-4 font-mono text-xs">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> walking hash chains…
          </div>
        )}
        {res?.steps.slice(0, visible).map((s) => (
          <div key={s.n} className="anim-fadeup flex gap-3 border-l border-primary/20 pl-3">
            <span className="shrink-0 text-muted-foreground">{String(s.n).padStart(2, "0")}.</span>
            <div className="min-w-0">
              <div className={s.match !== undefined ? (s.match ? "text-primary text-glow" : "text-destructive") : "text-foreground"}>
                {s.title}
              </div>
              <div className="break-all text-muted-foreground">{s.detail}</div>
              {s.expected && (
                <div className="mt-1 break-all text-muted-foreground">
                  expected {s.expected.slice(0, 16)}…{s.expected.slice(-16)}
                </div>
              )}
            </div>
          </div>
        ))}
        {res && visible >= res.steps.length && (
          <div className="anim-fadeup pt-1">
            {res.verified ? (
              <span className="inline-block bg-primary px-2 py-1 font-bold text-black">
                [ OK ] MERKLE ROOT MATCHES REGISTERED ANCHOR
              </span>
            ) : (
              <span className="inline-block bg-destructive px-2 py-1 font-bold text-white">
                [ FAIL ] ROOT MISMATCH
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
