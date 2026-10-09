import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound, GitBranch, Anchor, ShieldAlert } from "lucide-react";

const Section = ({ icon: Icon, title, children }) => (
  <section className="border border-border bg-card p-6">
    <div className="mb-3 flex items-center gap-2 font-mono text-sm uppercase tracking-[0.15em] text-primary">
      <Icon size={16} /> {title}
    </div>
    <div className="space-y-3 font-sans text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Mono = ({ children }) => (
  <code className="border border-primary/20 bg-black px-1.5 py-0.5 font-mono text-xs text-primary">{children}</code>
);

export default function Docs() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-primary">
        <ArrowLeft size={14} /> All coins
      </Link>

      <h1 className="font-display text-4xl font-black uppercase tracking-tighter text-foreground">
        Bunker mode: <span className="text-primary text-glow">why hash-based keys matter now</span>
      </h1>
      <p className="mt-4 font-sans text-base leading-relaxed text-muted-foreground">
        A sufficiently large quantum computer breaks ECDSA — the signature scheme securing every Solana
        wallet. pqc.market signs each launch with a <span className="text-foreground">hash-based</span> one-time
        key whose security reduces only to the collision resistance of SHA-256. No elliptic curves, no Q-day.
      </p>

      <div className="mt-8 space-y-5">
        <Section icon={KeyRound} title="WOTS — Winternitz one-time signatures">
          <p>
            Each identity derives <Mono>67</Mono> independent hash chains (<Mono>w=16</Mono>, 16 steps each). The
            message digest is split into <Mono>64</Mono> base-16 digits plus <Mono>3</Mono> checksum digits.
          </p>
          <p>
            To <span className="text-foreground">sign</span>, chain <Mono>i</Mono> is walked <Mono>d[i]</Mono> steps
            from the secret start: <Mono>σ[i] = H^d[i](sk[i])</Mono>. To <span className="text-foreground">verify</span>,
            the remaining steps are finished: <Mono>pk[i] = H^(15-d[i])(σ[i])</Mono>.
          </p>
          <p>Each key signs exactly one message — reuse leaks the secret, so keys are strictly one-time.</p>
        </Section>

        <Section icon={GitBranch} title="Merkle identity">
          <p>
            The 67 one-time public keys are compressed into a leaf: <Mono>ℓ = H(pk[0] ‖ … ‖ pk[66])</Mono>. That
            leaf climbs <Mono>8</Mono> Merkle levels, hashing with a sibling at each step, up to a single root:
            <Mono>root = H(…H(ℓ ‖ a[0])… ‖ a[7])</Mono>.
          </p>
          <p>The root is a compact, collision-resistant fingerprint of the entire key hierarchy.</p>
        </Section>

        <Section icon={Anchor} title="On-chain anchor">
          <p>
            The Merkle root is registered as the coin's post-quantum anchor. Anyone can re-derive it from a
            signature in-browser and compare — the verification you see on each coin page walks the chains, rebuilds
            the leaf, climbs the tree and checks the root with zero trust in the server.
          </p>
        </Section>

        <Section icon={ShieldAlert} title="Standard vs Quantum">
          <p>
            <span className="text-foreground">Standard</span> coins are proxied live from pump.fun and tagged with an
            attestation digest. <span className="text-foreground">Quantum</span> coins are launched here with a full
            WOTS + Merkle attestation bound to the mint.
          </p>
        </Section>
      </div>

      <div className="mt-8 border border-primary/30 bg-black p-4 font-mono text-xs text-muted-foreground scanlines">
        <span className="text-primary">pqc@bunker:~$</span> provenance that outlives ECDSA.
        <span className="cursor-blink text-primary">▊</span>
      </div>
    </div>
  );
}
