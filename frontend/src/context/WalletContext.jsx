import { createContext, useContext, useCallback, useEffect, useState } from "react";

const WalletCtx = createContext(null);

const getProvider = () => {
  if (typeof window === "undefined") return null;
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  return null;
};

export const WalletProvider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [publicKey, setPublicKey] = useState(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const p = getProvider();
    setProvider(p);
    if (!p) return;
    const onConnect = (pk) => setPublicKey(pk?.toString?.() || p.publicKey?.toString() || null);
    const onDisconnect = () => setPublicKey(null);
    const onAccountChanged = (pk) => setPublicKey(pk ? pk.toString() : null);
    p.on?.("connect", onConnect);
    p.on?.("disconnect", onDisconnect);
    p.on?.("accountChanged", onAccountChanged);
    // eager connect if previously trusted
    p.connect?.({ onlyIfTrusted: true })
      .then((res) => setPublicKey(res.publicKey.toString()))
      .catch(() => {});
    return () => {
      p.off?.("connect", onConnect);
      p.off?.("disconnect", onDisconnect);
      p.off?.("accountChanged", onAccountChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    const p = getProvider();
    if (!p) {
      window.open("https://phantom.app/", "_blank");
      throw new Error("Phantom wallet not found");
    }
    setConnecting(true);
    try {
      const res = await p.connect();
      setProvider(p);
      setPublicKey(res.publicKey.toString());
      return res.publicKey.toString();
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const p = getProvider();
    await p?.disconnect?.();
    setPublicKey(null);
  }, []);

  return (
    <WalletCtx.Provider
      value={{ provider, publicKey, connected: !!publicKey, connecting, connect, disconnect, hasPhantom: !!getProvider() }}
    >
      {children}
    </WalletCtx.Provider>
  );
};

export const useWallet = () => {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
};
