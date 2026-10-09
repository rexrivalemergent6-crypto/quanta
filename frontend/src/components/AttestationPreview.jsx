import { useMemo } from "react";
import { keccak_256 } from "@noble/hashes/sha3";
import { Fingerprint, Lock, ShieldCheck } from "lucide-react";

const enc = (s) => new TextEncoder().encode(s);
const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

// Live, client-side preview of the hash-based attestation (keccak fingerprint).
function derive({ name, symbol, description }) {
  const base = `${name || ""}|${symbol || ""}|${description || ""}`;
  const digest = keccak_256(enc("AEGIS:ATTEST|" + base)); // 32 bytes
  const leafIndex = (keccak_256(enc("AEGIS:LEAF|" + base))[0] % 16);
  const leaf = keccak_256(enc("AEGIS:LEAFH|" + hex(digest)));
  const root = keccak_256(leaf);
  // 64 message nibbles + 3 checksum nibbles = 67
  const nibbles = [];
  for (const byte of digest) { nibbles.push(byte >> 4); nibbles.push(byte & 0x0f); }
  let sum = 0; for (const n of nibbles) sum += 15 - n;
  const cks = [(sum >> 8) & 0x0f, (sum >> 4) & 0x0f, sum & 0x0f];
  return { digest: hex(digest), leaf: hex(leaf), root: hex(root), leafIndex, nibbles, cks };
}

const Cell = ({ v, accent }) => (
  <span
    className="h-[14px] w-[14px] rounded-[2px] transition-colors duration-300"
    style={{
      background: accent
        ? `hsl(38 92% 55% / ${0.3 + (v / 15) * 0.7})`
        : `hsl(158 84% 46% / ${0.12 + (v / 15) * 0.8})`,
    }}
  />
);

const KV = ({ k, v, mono = true, accent }) => (
  <div className="flex items-center justify-between gap-4 py-1.5">
    <span className="text-xs text-muted-foreground">{k}</span>
    <span className={`${mono ? "font-mono" : ""} truncate text-xs ${accent ? "text-primary" : "text-foreground/90"}`}>{v}</span>
  </div>
);

export const AttestationPreview = ({ form, preview }) => {
  const a = useMemo(() => derive(form), [form.name, form.symbol, form.description]); // eslint-disable-line
  const name = form.name?.trim() || "Your coin";
  const sym = form.symbol?.trim() || "TICKER";

  return (
    <div className="card-premium rounded-xl p-5">
      {/* coin preview */}
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> :
            <div className="flex h-full w-full items-center justify-center font-display text-xl text-muted-foreground">{sym.slice(0, 1)}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-lg font-semibold text-foreground">{name}</h3>
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">quantum</span>
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">${sym} · leaf #{a.leafIndex}</div>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
          <Lock size={10} className="text-primary" /> dev-locked
        </div>
      </div>

      {/* live fingerprint */}
      <div className="mt-5 rounded-lg border border-border bg-background/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"><Fingerprint size={12} className="text-primary" /> attestation fingerprint</span>
          <span className="anim-shimmer font-mono text-[10px] text-primary">live</span>
        </div>
        <div className="flex flex-wrap gap-[3px]">
          {a.nibbles.map((v, i) => <Cell key={i} v={v} />)}
          {a.cks.map((v, i) => <Cell key={`c${i}`} v={v} accent />)}
        </div>
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
          67 base-16 digits (64 message + 3 checksum) covering name, ticker &amp; image. It shifts the instant you edit a field.
        </p>
      </div>

      {/* readouts */}
      <div className="mt-4 divide-y divide-border/60">
        <KV k="scheme" v={<span className="flex items-center gap-1.5"><ShieldCheck size={11} className="text-primary" /> WOTS(w=16) + Merkle(h=8)</span>} mono={false} />
        <KV k="signature" v="~2.1 KB" />
        <KV k="leaf" v={`#${a.leafIndex} · ${a.leaf.slice(0, 10)}…`} />
        <KV k="root" v={`${a.root.slice(0, 10)}…${a.root.slice(-6)}`} accent />
        <KV k="digest" v={`${a.digest.slice(0, 12)}…${a.digest.slice(-10)}`} />
      </div>
    </div>
  );
};
