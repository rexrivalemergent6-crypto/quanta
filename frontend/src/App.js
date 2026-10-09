import "@/App.css";
import { Toaster } from "sonner";
import { WalletProvider } from "@/context/WalletContext";
import Launch from "@/pages/Launch";

function App() {
  return (
    <div className="App min-h-screen">
      <WalletProvider>
        <Launch />
      </WalletProvider>
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
