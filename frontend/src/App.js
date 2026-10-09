import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { WalletProvider } from "@/context/WalletContext";
import VaultWallet from "@/pages/VaultWallet";
import SwapPage from "@/pages/SwapPage";

function App() {
  return (
    <div className="App min-h-screen">
      <BrowserRouter>
        <WalletProvider>
          <Routes>
            <Route path="/" element={<VaultWallet />} />
            <Route path="/swap" element={<SwapPage />} />
          </Routes>
        </WalletProvider>
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
