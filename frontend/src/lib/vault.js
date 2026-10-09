import {
  Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram,
  Keypair, ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, MINT_SIZE, createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { keccak_256 } from "@noble/hashes/sha3";
import { publicKeyHash, sign, deriveSeed, cat, utf8, u64, hex, SIG_LEN } from "./wots";

export const NETWORK = process.env.REACT_APP_WNTR_NETWORK || "devnet";
export const RPC = process.env.REACT_APP_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_IDS = {
  devnet: "HBHP37mXs86kxn8i5twKiPkvtZWx2wDyUEUGVQAo72Da",
  mainnet: "13EtnfYGUH8NaGAnUpDTVgSsXoewNnULp7ESwHzQUANT",
};
export const PROGRAM_ID = new PublicKey(process.env.REACT_APP_WNTR_PROGRAM || PROGRAM_IDS[NETWORK]);
export const DECIMALS = 6;
const SEED_PREFIX = utf8("vault");

export const getConnection = () => new Connection(RPC, "confirmed");
export const explorerTx = (sig) => `https://explorer.solana.com/tx/${sig}${NETWORK === "devnet" ? "?cluster=devnet" : ""}`;
export const explorerAddr = (a) => `https://explorer.solana.com/address/${a}${NETWORK === "devnet" ? "?cluster=devnet" : ""}`;

export const toRaw = (amt) => BigInt(Math.round(Number(amt) * 10 ** DECIMALS));
export const fromRaw = (raw) => Number(raw) / 10 ** DECIMALS;

export const vaultPda = (pkHash) =>
  PublicKey.findProgramAddressSync([SEED_PREFIX, Buffer.from(pkHash)], PROGRAM_ID);

export const randomMaster = () => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
};

function spendDigest(domain, vaultId, nonce, source, dest, amount, nextPk) {
  return keccak_256(cat(utf8(domain), vaultId, u64(nonce), source.toBytes(), dest.toBytes(), u64(amount), nextPk));
}

function openIx(payer, vault, mint, pkHash) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.of(0), Buffer.from(pkHash)]),
  });
}

function spendIx(tag, vault, source, dest, amount, nextPk, sig) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([Buffer.of(tag), Buffer.from(u64(amount)), Buffer.from(nextPk), Buffer.from(sig)]),
  });
}

export function parseVault(data) {
  const b = Buffer.from(data);
  return {
    bump: b[1],
    nonce: b.readBigUInt64LE(2),
    vaultId: new Uint8Array(b.subarray(10, 42)),
    pkHash: new Uint8Array(b.subarray(42, 74)),
    mint: new PublicKey(b.subarray(74, 106)),
  };
}

export async function readVault(connection, vault) {
  const info = await connection.getAccountInfo(vault);
  if (!info) return null;
  return parseVault(info.data);
}

async function signSend(connection, provider, payerPk, ixs, extraSigners = []) {
  const tx = new Transaction();
  ixs.forEach((ix) => tx.add(ix));
  tx.feePayer = payerPk;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  if (extraSigners.length) tx.partialSign(...extraSigners);
  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

// Create a quantum vault: new SPL mint whose authority is the vault PDA, then open the vault.
export async function createVault(connection, provider, payerStr) {
  const payer = new PublicKey(payerStr);
  const master = randomMaster();
  const seed0 = deriveSeed(master, 0);
  const pk0 = publicKeyHash(seed0);
  const [vault] = vaultPda(pk0);
  const mint = Keypair.generate();
  const rent = await getMinimumBalanceForRentExemptMint(connection);
  const ixs = [
    SystemProgram.createAccount({
      fromPubkey: payer, newAccountPubkey: mint.publicKey,
      lamports: rent, space: MINT_SIZE, programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(mint.publicKey, DECIMALS, vault, null),
    openIx(payer, vault, mint.publicKey, pk0),
  ];
  const sig = await signSend(connection, provider, payer, ixs, [mint]);
  return {
    master: hex(master),
    mint: mint.publicKey.toBase58(),
    vault: vault.toBase58(),
    pk0: hex(pk0),
    sig,
  };
}

async function ensureAta(connection, provider, payerPk, mint, owner, allowOffCurve) {
  const ata = getAssociatedTokenAddressSync(mint, owner, allowOffCurve);
  const info = await connection.getAccountInfo(ata);
  if (info) return { ata, created: null };
  const ix = createAssociatedTokenAccountInstruction(payerPk, ata, owner, mint);
  const sig = await signSend(connection, provider, payerPk, [ix]);
  return { ata, created: sig };
}

const budget = () => ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

// Deposit = quantum-signed MINT of tokens into the vault's own treasury account.
export async function depositMint(connection, provider, payerStr, master, amount) {
  const payer = new PublicKey(payerStr);
  const seed0 = deriveSeed(master, 0);
  const pk0 = publicKeyHash(seed0);
  const [vault] = vaultPda(pk0);
  const v = await readVault(connection, vault);
  if (!v) throw new Error("vault not found");
  const { ata: treasury } = await ensureAta(connection, provider, payer, v.mint, vault, true);
  const n = v.nonce;
  const curSeed = deriveSeed(master, Number(n));
  const nextPk = publicKeyHash(deriveSeed(master, Number(n) + 1));
  const raw = toRaw(amount);
  const digest = spendDigest("WNTR:MINT", v.vaultId, n, v.mint, treasury, raw, nextPk);
  const sig = sign(curSeed, digest);
  const txSig = await signSend(connection, provider, payer, [budget(), spendIx(1, vault, v.mint, treasury, raw, nextPk, sig)]);
  return { txSig, treasury: treasury.toBase58(), nonce: Number(n) };
}

// Transfer = quantum-signed TRANSFER of treasury tokens to any recipient.
export async function transferOut(connection, provider, payerStr, master, destOwnerStr, amount) {
  const payer = new PublicKey(payerStr);
  const destOwner = new PublicKey(destOwnerStr);
  const seed0 = deriveSeed(master, 0);
  const pk0 = publicKeyHash(seed0);
  const [vault] = vaultPda(pk0);
  const v = await readVault(connection, vault);
  if (!v) throw new Error("vault not found");
  const treasury = getAssociatedTokenAddressSync(v.mint, vault, true);
  const { ata: destAta } = await ensureAta(connection, provider, payer, v.mint, destOwner, false);
  const n = v.nonce;
  const curSeed = deriveSeed(master, Number(n));
  const nextPk = publicKeyHash(deriveSeed(master, Number(n) + 1));
  const raw = toRaw(amount);
  const digest = spendDigest("WNTR:XFER", v.vaultId, n, treasury, destAta, raw, nextPk);
  const sig = sign(curSeed, digest);
  const txSig = await signSend(connection, provider, payer, [budget(), spendIx(2, vault, treasury, destAta, raw, nextPk, sig)]);
  return { txSig, destAta: destAta.toBase58(), nonce: Number(n) };
}

export { hex };

export const treasuryAta = (mintStr, vaultStr) =>
  getAssociatedTokenAddressSync(new PublicKey(mintStr), new PublicKey(vaultStr), true).toBase58();

export async function tokenBalance(connection, ataStr) {
  try {
    const r = await connection.getTokenAccountBalance(new PublicKey(ataStr));
    return Number(r.value.uiAmount || 0);
  } catch {
    return 0;
  }
}
