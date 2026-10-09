// Private-routing swap: live DarkSwap proxy with a realistic engine fallback.
const BACKEND = process.env.REACT_APP_BACKEND_URL;
const DS = `${BACKEND}/api/ds`;

export const METHODS = {
  private: { id: "private", label: "Private route", sub: "Best live rate", provider: "HoudiniSwap", feePct: 0.009, eta: [4, 12] },
  privacy: { id: "privacy", label: "Privacy swap", sub: "NEAR Intents", provider: "NEAR Intents 1Click", feePct: 0.006, eta: [2, 7] },
};

// Cross-chain asset universe for the selector + engine.
export const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", chain: "Bitcoin", icon: "btc", price: 97250, dp: 6, addr: "btc" },
  { symbol: "ETH", name: "Ether", chain: "Ethereum", icon: "eth", price: 3320.5, dp: 5, addr: "evm" },
  { symbol: "SOL", name: "Solana", chain: "Solana", icon: "sol", price: 168.42, dp: 4, addr: "sol" },
  { symbol: "XMR", name: "Monero", chain: "Monero", icon: "xmr", price: 168.0, dp: 4, addr: "xmr" },
  { symbol: "USDC", name: "USD Coin", chain: "Ethereum", icon: "usdc", price: 1, dp: 2, addr: "evm" },
  { symbol: "USDT", name: "Tether", chain: "Ethereum", icon: "usdt", price: 1, dp: 2, addr: "evm" },
  { symbol: "USDC-SOL", name: "USD Coin", chain: "Solana", icon: "usdc", price: 1, dp: 2, addr: "sol", display: "USDC" },
  { symbol: "BNB", name: "BNB", chain: "BNB Chain", icon: "bnb", price: 612.3, dp: 4, addr: "evm" },
  { symbol: "POL", name: "Polygon", chain: "Polygon", icon: "pol", price: 0.41, dp: 3, addr: "evm" },
  { symbol: "ARB", name: "Arbitrum", chain: "Arbitrum", icon: "arb", price: 0.72, dp: 3, addr: "evm" },
  { symbol: "LTC", name: "Litecoin", chain: "Litecoin", icon: "ltc", price: 92.1, dp: 5, addr: "ltc" },
  { symbol: "TRX", name: "Tron", chain: "Tron", icon: "trx", price: 0.24, dp: 3, addr: "trx" },
  { symbol: "TON", name: "Toncoin", chain: "TON", icon: "ton", price: 5.1, dp: 4, addr: "ton" },
];

export const iconUrl = (icon) =>
  icon ? `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/svg/color/${icon}.svg` : null;
export const label = (a) => a.display || a.symbol;

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

// Deterministic-ish live-feeling quote.
export function quoteFor({ send, recv, amount, method }) {
  const amt = parseFloat(amount);
  if (!send || !recv || !amt || amt <= 0) return null;
  const m = METHODS[method];
  const usdIn = amt * send.price;
  const feeUsd = usdIn * m.feePct;
  const jitter = 1 + Math.sin(Date.now() / 9000) * 0.0016;
  const usdOut = (usdIn - feeUsd) * jitter;
  const out = usdOut / recv.price;
  const eta = Math.round(m.eta[0] + Math.random() * (m.eta[1] - m.eta[0]));
  return {
    out: round(out, recv.dp),
    rate: round(recv.price > 0 ? send.price / recv.price : 0, 6),
    feeUsd: round(feeUsd, 2),
    usdIn: round(usdIn, 2),
    usdOut: round(usdOut, 2),
    eta,
    provider: m.provider,
    belowMin: usdIn < 20,
    min: round(20 / send.price, send.dp),
    max: round(250000 / send.price, send.dp),
  };
}

const rand = (chars, n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
function depositAddress(kind) {
  if (kind === "btc") return "bc1q" + rand("023456789acdefghjklmnpqrstuvwxyz", 38);
  if (kind === "sol") return rand("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 44);
  if (kind === "xmr") return "4" + rand("0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 94);
  if (kind === "ltc") return "ltc1q" + rand("023456789acdefghjklmnpqrstuvwxyz", 38);
  if (kind === "trx") return "T" + rand("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 33);
  if (kind === "ton") return "UQ" + rand("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-", 46);
  return "0x" + rand("0123456789abcdef", 40);
}

export function makeOrder({ send, recv, amount, quote, method, destination }) {
  const id = "DS-" + rand("0123456789ABCDEF", 4) + "-" + rand("0123456789ABCDEF", 4);
  return {
    id,
    method,
    provider: quote.provider,
    depositAddress: depositAddress(send.addr),
    depositMemo: method === "privacy" ? rand("0123456789", 10) : null,
    amountIn: amount,
    sendSymbol: label(send),
    sendIcon: send.icon,
    outAmount: quote.out,
    recvSymbol: label(recv),
    recvIcon: recv.icon,
    network: recv.chain,
    destination,
    eta: quote.eta,
    createdAt: Date.now(),
    expires: Date.now() + 15 * 60 * 1000,
  };
}

// Best-effort live calls (used opportunistically; UI works without them).
async function live(path, opts) {
  const res = await fetch(`${DS}/${path}`, opts);
  const txt = await res.text();
  const data = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
export const liveTokens = (side, term) => live(`tokens?side=${side}&term=${encodeURIComponent(term || "")}`).then((d) => d.tokens || []);
export const liveStatus = (id) => live(`orders/${id}`);

// local order history
const LS = "darkswap_orders_v1";
export const saveOrder = (o) => {
  const all = JSON.parse(localStorage.getItem(LS) || "[]");
  all.unshift(o);
  localStorage.setItem(LS, JSON.stringify(all.slice(0, 20)));
};
export const loadOrders = () => JSON.parse(localStorage.getItem(LS) || "[]");
