"""Hash-based post-quantum attestation engine.

Implements a Winternitz One-Time Signature (WOTS, w=16, SHA-256) plus a
Merkle identity tree, matching the pqc.market scheme:
  - message digest -> 64 base-16 digits + 3 checksum digits = 67 chains
  - each chain has 16 steps (0..15)
  - 67 one-time public keys compressed into a Merkle leaf
  - leaf climbs 8 Merkle levels to a registered root
"""
import hashlib

N = 32            # hash output bytes (SHA-256)
W = 16            # Winternitz parameter
CHAIN_LEN = W - 1  # 15 steps max per chain
MSG_DIGITS = 2 * N  # 64 base-16 digits
CKSUM_DIGITS = 3    # ceil(log_16(64*15)) = 3
TOTAL_CHAINS = MSG_DIGITS + CKSUM_DIGITS  # 67
MERKLE_LEVELS = 8


def _h(*parts: bytes) -> bytes:
    m = hashlib.sha256()
    for p in parts:
        m.update(p)
    return m.digest()


def _chain(x: bytes, steps: int) -> bytes:
    """Walk a hash chain `steps` times."""
    out = x
    for _ in range(steps):
        out = _h(out)
    return out


def _digits(digest: bytes):
    """Message digits (64 base-16) + checksum digits (3)."""
    d = []
    for b in digest:
        d.append(b >> 4)
        d.append(b & 0x0F)
    checksum = sum(CHAIN_LEN - x for x in d)
    cks = []
    for i in range(CKSUM_DIGITS):
        shift = 4 * (CKSUM_DIGITS - 1 - i)
        cks.append((checksum >> shift) & 0x0F)
    return d + cks, checksum


def _secret_chains(seed: str):
    base = seed.encode()
    return [_h(base, b"sk", i.to_bytes(2, "big")) for i in range(TOTAL_CHAINS)]


def _merkle_siblings(seed: str):
    base = seed.encode()
    return [_h(base, b"sib", lvl.to_bytes(1, "big")) for lvl in range(MERKLE_LEVELS)]


def _leaf_index(seed: str) -> int:
    return int.from_bytes(_h(seed.encode(), b"idx")[:2], "big") % 16 + 1


def generate(seed: str, message: str | None = None) -> dict:
    """Produce a full attestation package for an identity `seed`.

    Returns signature + the registered Merkle root + the public verification
    material so a client can re-derive and compare.
    """
    message = message or seed
    digest = _h(message.encode())
    digits, checksum = _digits(digest)
    sk = _secret_chains(seed)
    # one-time signature: walk each chain d_i steps from the secret start
    sig = [_chain(sk[i], digits[i]) for i in range(TOTAL_CHAINS)]
    # public key: finish the remaining steps
    pk = [_chain(sig[i], CHAIN_LEN - digits[i]) for i in range(TOTAL_CHAINS)]
    leaf = _h(*pk)
    leaf_index = _leaf_index(seed)
    siblings = _merkle_siblings(seed)
    node = leaf
    path = []
    idx = leaf_index
    for lvl in range(MERKLE_LEVELS):
        sib = siblings[lvl]
        # order by current index bit for a faithful climb
        if idx & 1:
            combined = _h(sib, node)
        else:
            combined = _h(node, sib)
        path.append({"level": lvl + 1, "sibling": sib.hex(), "result": combined.hex()})
        node = combined
        idx >>= 1
    root = node
    verify_calls = sum(CHAIN_LEN - x for x in digits)
    return {
        "seed": seed,
        "scheme": "WOTS+ / SHA-256 / Merkle",
        "w": W,
        "chains": TOTAL_CHAINS,
        "msg_digits": MSG_DIGITS,
        "checksum_digits": CKSUM_DIGITS,
        "checksum": checksum,
        "signature_bytes": TOTAL_CHAINS * N,
        "message_digest": digest.hex(),
        "digits": digits,
        "signature": [s.hex() for s in sig],
        "leaf": leaf.hex(),
        "leaf_index": leaf_index,
        "merkle_path": path,
        "root": root.hex(),
        "verify_hash_calls": verify_calls,
    }


def verify(seed: str, signature_hex: list[str], expected_root: str,
           leaf_index: int, message: str | None = None) -> dict:
    """Recompute the root from a signature and compare to the registered root.

    Returns an ordered list of human-readable verification steps plus the
    boolean result (mirrors the in-browser verifier on the detail page).
    """
    message = message or seed
    digest = _h(message.encode())
    digits, checksum = _digits(digest)
    sig = [bytes.fromhex(s) for s in signature_hex]
    pk = [_chain(sig[i], CHAIN_LEN - digits[i]) for i in range(TOTAL_CHAINS)]
    leaf = _h(*pk)
    siblings = _merkle_siblings(seed)
    verify_calls = sum(CHAIN_LEN - x for x in digits)

    steps = [
        {
            "n": 1,
            "title": "Message digest -> 64 digits + 3 checksum",
            "detail": f"{digest.hex()[:16]}...{digest.hex()[-16:]}",
        },
        {
            "n": 2,
            "title": f"Finish {TOTAL_CHAINS} hash chains ({verify_calls} SHA-256 calls)",
            "detail": f"Each chain i is walked from step d_i to {CHAIN_LEN}, rebuilding the one-time public key.",
        },
        {
            "n": 3,
            "title": f"Compress into leaf #{leaf_index}",
            "detail": f"{leaf.hex()[:16]}...{leaf.hex()[-16:]}",
        },
    ]
    node = leaf
    idx = leaf_index
    n = 4
    for lvl in range(MERKLE_LEVELS):
        sib = siblings[lvl]
        if idx & 1:
            combined = _h(sib, node)
        else:
            combined = _h(node, sib)
        steps.append({
            "n": n,
            "title": f"Level {lvl + 1} \u00b7 node 0",
            "detail": f"sibling {sib.hex()[:8]}...{sib.hex()[-6:]} -> {combined.hex()[:8]}...{combined.hex()[-6:]}",
        })
        node = combined
        idx >>= 1
        n += 1
    computed = node.hex()
    ok = computed == expected_root
    steps.append({
        "n": n,
        "title": "Compare with registered root",
        "detail": f"computed {computed[:16]}...{computed[-16:]}",
        "computed": computed,
        "expected": expected_root,
        "match": ok,
    })
    return {"verified": ok, "computed_root": computed, "expected_root": expected_root, "steps": steps}
