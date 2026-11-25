/**
 * verify-tx.ts — read a QoreChain transaction back from the public REST
 * endpoint and extract the post-quantum proof:
 *   - tx_response.code (0 = success)
 *   - the PQCHybridSignature extension (holds the ML-DSA-87 signature,
 *     4,627 bytes, next to the 64-byte secp256k1 signature)
 *   - the `pqc_hybrid_verify` event with status=verified
 *
 * Usage: pnpm verify-tx <COSMOS_TX_HASH> [outFile]
 * The window-open hash printed by `pnpm window open` is the hybrid-signed
 * Quantum Pass transaction. Raw REST JSON is saved to proof/ as evidence.
 */
import { writeFileSync } from "node:fs";

const REST = process.env.QORE_REST ?? "https://api-testnet.qore.host";

function findKeys(value: unknown, needle: string, path = "$", hits: string[] = []): string[] {
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.includes(needle) || (typeof v === "string" && v.includes(needle))) hits.push(`${path}.${k}`);
      findKeys(v, needle, `${path}.${k}`, hits);
    }
  }
  return hits;
}

function b64Len(s: unknown): number | null {
  if (typeof s !== "string") return null;
  try {
    return Buffer.from(s, "base64").length;
  } catch {
    return null;
  }
}

async function main() {
  const hash = process.argv[2];
  if (!hash) throw new Error("Usage: pnpm verify-tx <COSMOS_TX_HASH> [outFile]");
  const out = process.argv[3] ?? `proof/tx-${hash.slice(0, 12)}.json`;

  const res = await fetch(`${REST}/cosmos/tx/v1beta1/txs/${hash}`);
  if (!res.ok) throw new Error(`REST ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  writeFileSync(out, JSON.stringify(data, null, 2));

  const txr = data.tx_response ?? {};
  const events = (txr.events ?? []) as Array<{ type: string; attributes: Array<{ key: string; value: string }> }>;
  const verifyEvents = events.filter((e) => e.type === "pqc_hybrid_verify");
  const hybridPaths = findKeys(data, "PQCHybridSignature");

  // Signature sizes: classical signatures live in tx.signatures (base64, 64 bytes each).
  const sigs: Array<number | null> = (data.tx?.signatures ?? []).map(b64Len);

  const summary = {
    hash: txr.txhash ?? hash,
    height: txr.height,
    code: txr.code,
    codespace: txr.codespace ?? "",
    hybridExtensionFoundAt: hybridPaths,
    classicalSignatureBytes: sigs,
    pqcHybridVerifyEvents: verifyEvents.map((e) => Object.fromEntries(e.attributes.map((a) => [a.key, a.value]))),
    verified: verifyEvents.some((e) => e.attributes.some((a) => a.key === "status" && a.value === "verified")),
    rawSavedTo: out,
    restEndpoint: `${REST}/cosmos/tx/v1beta1/txs/${hash}`,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.verified) {
    console.error("WARNING: no pqc_hybrid_verify event with status=verified found in this tx.");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
