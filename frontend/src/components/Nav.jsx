import { Link, useLocation } from "react-router-dom";
import { Shield, Terminal } from "lucide-react";

export const Nav = () => {
  const loc = useLocation();
  const active = (p) => loc.pathname === p;
  return (
    <header
      data-testid="main-nav"
      className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" data-testid="nav-logo" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center border border-primary/40 bg-primary/10 text-primary">
            <Shield size={16} className="transition-transform group-hover:scale-110" />
          </div>
          <span className="font-mono text-base font-bold tracking-tight text-foreground">
            pqc<span className="text-primary text-glow">.market</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            data-testid="nav-coins"
            className={`px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] transition-colors hover:text-primary ${
              active("/") ? "text-primary text-glow" : "text-muted-foreground"
            }`}
          >
            Coins
          </Link>
          <Link
            to="/docs"
            data-testid="nav-docs"
            className={`px-3 py-2 font-mono text-xs uppercase tracking-[0.15em] transition-colors hover:text-primary ${
              active("/docs") ? "text-primary text-glow" : "text-muted-foreground"
            }`}
          >
            Docs
          </Link>
          <Link
            to="/launch"
            data-testid="nav-launch-btn"
            className="ml-2 flex items-center gap-2 border border-primary bg-primary px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-black transition-all hover:bg-primary/80 hover:shadow-[0_0_15px_hsl(135_100%_50%/0.4)]"
          >
            <Terminal size={14} /> Launch
          </Link>
        </nav>
      </div>
    </header>
  );
};
