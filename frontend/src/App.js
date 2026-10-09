import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Nav } from "@/components/Nav";
import Home from "@/pages/Home";
import CoinDetail from "@/pages/CoinDetail";
import Launch from "@/pages/Launch";
import Docs from "@/pages/Docs";

const Footer = () => (
  <footer className="mt-16 border-t border-border">
    <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-8 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
      <div>
        <span className="text-primary">pqc.market</span> · hash-based, post-quantum attestations
      </div>
      <div className="flex items-center gap-4">
        <span>WOTS · Merkle · SHA-256</span>
        <span className="text-muted-foreground/50">live data proxied from pump.fun</span>
      </div>
    </div>
  </footer>
);

function App() {
  return (
    <div className="App min-h-screen">
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/coin/q/:mint" element={<CoinDetail />} />
          <Route path="/coin/:mint" element={<CoinDetail />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/docs" element={<Docs />} />
        </Routes>
        <Footer />
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#050606",
            border: "1px solid hsl(145 28% 14%)",
            color: "#E2F1E8",
            fontFamily: "JetBrains Mono, monospace",
            borderRadius: 0,
          },
        }}
      />
    </div>
  );
}

export default App;
