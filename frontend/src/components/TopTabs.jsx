import { Link, useLocation } from "react-router-dom";
import { Shield, Wallet, Loader2, X } from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { toast } from "sonner";

const TABS = [
  { to: "/", label: "Vault" },
  { to: "/launch", label: "Launch" },
  { to: "/swap", label: "Swap" },
];
const NETWORK = process.env.REACT_APP_WNTR_NETWORK || "mainnet";
const short = (s) => (s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "");

export const TopTabs = ({ brand = "quantum", accent = ".sol", wallet = true }) => {
  const { pathname } = useLocation();
  const w = useWallet();
  const connectWallet = async () => {
    try { await w.connect(); toast.success("Phantom connected"); }
    catch (e) { toast.error(e.message || "Connect failed"); }
  };
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center border border-primary/40 bg-primary/10 text-primary"><Shield size={16} /></div>
          <span className="font-mono text-base font-bold tracking-tight">{brand}<span className="text-primary text-glow">{accent}</span></span>
          <span className="hidden border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-primary sm:inline">{NETWORK}</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <nav className="flex items-center">
            {TABS.map((t) => {
              const active = pathname === t.to;
              return (
                <Link key={t.to} to={t.to} data-testid={`nav-${t.label.toLowerCase()}`}
                  className={`px-2.5 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors sm:px-3 ${active ? "text-primary text-glow" : "text-muted-foreground hover:text-primary"}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
          {wallet && (w.connected ? (
            <button data-testid="wallet-button" onClick={w.disconnect} className="flex items-center gap-2 border border-primary/40 bg-primary/5 px-3 py-2 font-mono text-xs text-primary transition-colors hover:bg-primary/10">
              <span className="inline-block h-2 w-2 animate-pulse bg-primary" /> {short(w.publicKey)} <X size={12} />
            </button>
          ) : (
            <button data-testid="wallet-button" onClick={connectWallet} disabled={w.connecting} className="flex items-center gap-2 border border-primary bg-primary px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-black transition-all hover:bg-primary/80 disabled:opacity-50">
              {w.connecting ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}{w.hasPhantom ? "Connect" : "Get Phantom"}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
