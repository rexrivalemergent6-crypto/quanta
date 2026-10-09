import { keccak_256 } from "@noble/hashes/sha3";

// Winternitz OTS — verbatim port of rabb757/winternitz-vault client/src/wots.ts
export const N = 24;
export const MSG_CHUNKS = 32;
export const SUM_CHUNKS = 2;
export const CHUNKS = MSG_CHUNKS + SUM_CHUNKS; // 34
export const SIG_LEN = CHUNKS * N; // 816
export const CHAIN_MAX = 255;

export const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
export const utf8 = (s) => new TextEncoder().encode(s);
export const u64 = (v) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
  return b;
};
export const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

function step(index, value) {
  const buf = new Uint8Array(1 + N);
  buf[0] = index;
  buf.set(value, 1);
  return keccak_256(buf).slice(0, N);
}
export function walk(index, start, times) {
  let cur = start;
  for (let i = 0; i < times; i++) cur = step(index, cur);
  return cur;
}
export function secret(seed, i) {
  return keccak_256(cat(utf8("WNTR:SK"), seed, Uint8Array.of(i))).slice(0, N);
}
export function publicKeyHash(seed) {
  const ends = new Uint8Array(SIG_LEN);
  for (let i = 0; i < CHUNKS; i++) ends.set(walk(i, secret(seed, i), CHAIN_MAX), i * N);
  return keccak_256(ends);
}
export function chunksOf(digest) {
  const out = new Uint8Array(CHUNKS);
  out.set(digest, 0);
  let sum = 0;
  for (const b of digest) sum += CHAIN_MAX - b;
  out[MSG_CHUNKS] = (sum >> 8) & 0xff;
  out[MSG_CHUNKS + 1] = sum & 0xff;
  return out;
}
export function sign(seed, digest) {
  const counts = chunksOf(digest);
  const sig = new Uint8Array(SIG_LEN);
  for (let i = 0; i < CHUNKS; i++) sig.set(walk(i, secret(seed, i), counts[i]), i * N);
  return sig;
}
export function verify(pkHash, digest, sig) {
  if (sig.length !== SIG_LEN) return false;
  const counts = chunksOf(digest);
  const ends = new Uint8Array(SIG_LEN);
  for (let i = 0; i < CHUNKS; i++) {
    ends.set(walk(i, sig.slice(i * N, (i + 1) * N), CHAIN_MAX - counts[i]), i * N);
  }
  return hex(keccak_256(ends)) === hex(pkHash);
}

// Deterministic per-nonce seed so the whole wallet restores from one master seed.
export function deriveSeed(master, nonce) {
  return keccak_256(cat(utf8("WNTR:SEED"), master, u64(nonce)));
}
