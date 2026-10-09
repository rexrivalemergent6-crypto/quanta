import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const client = axios.create({ baseURL: API, timeout: 30000 });

export const getStats = () => client.get("/stats").then((r) => r.data);
export const getCoins = (params) => client.get("/coins", { params }).then((r) => r.data);
export const getCoin = (mint) => client.get(`/coins/${mint}`).then((r) => r.data);
export const getCandles = (mint, params) =>
  client.get(`/coins/${mint}/candles`, { params }).then((r) => r.data);
export const getTrades = (mint) => client.get(`/coins/${mint}/trades`).then((r) => r.data);
export const postTrade = (mint, body) =>
  client.post(`/coins/${mint}/trade`, body).then((r) => r.data);
export const verifyAttestation = (mint) =>
  client.get(`/coins/${mint}/attestation/verify`).then((r) => r.data);
export const launchCoin = (body) => client.post("/launch", body).then((r) => r.data);

export const fmtUsd = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
};
export const fmtNum = (n) => (n == null ? "—" : Number(n).toLocaleString());
export const shortMint = (m) => (m ? `${m.slice(0, 4)}…${m.slice(-4)}` : "");
