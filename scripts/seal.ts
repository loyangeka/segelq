/**
 * seal.ts — seal a prediction text on the deployed SegelQ contract.
 *
 * Usage:
 *   SEGELQ_ADDRESS=0x... pnpm seal "BTC above 150k before 2027" "BTC > 150k by 2027"
 *   (second argument = public label; defaults to the first 48 chars of the text)
 *
 * The plaintext never goes on chain: only its SHA-256 (bytes32), the label,
 * the sealer address and the timestamp are stored by the contract. The exact
 * text + hash are saved to proof/receipts/ locally so the prediction can be
 * revealed and re-hashed later for verification.
 *
 * Prerequisites (QoreChain EVM): the account's ML-DSA-87 key is registered
 * and an EVM authorisation window is open (`pnpm window register`,
 * `pnpm window open`). The window-open transaction is the hybrid-signed
 * (secp256k1 + ML-DSA-87) transaction verified in proof/.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const segelqAbi = [
  {
    type: "function",
    name: "seal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "textHash", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [{ name: "sealId", type: "uint256" }],
  },
  {
    type: "function",
    name: "sealCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const qorechainTestnet = defineChain({
  id: 9800,
  name: "QoreChain Testnet (qorechain-diana)",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: ["https://evm-testnet.qore.host"] } },
  blockExplorers: { default: { name: "Qore Explorer", url: "https://explore.qore.network" } },
});

async function main() {
  const [text, labelArg] = process.argv.slice(2);
  if (!text) throw new Error('Usage: pnpm seal "<prediction text>" ["<public label>"]');
  const label = labelArg ?? text.slice(0, 48);

  const contract = process.env.SEGELQ_ADDRESS as Address | undefined;
  if (!contract || !/^0x[0-9a-fA-F]{40}$/.test(contract)) {
    throw new Error("Set SEGELQ_ADDRESS to the deployed SegelQ contract address.");
  }
  const key = process.env.PRIVATE_KEY?.trim();
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Set PRIVATE_KEY (0x + 64 hex) in .env");
  }

  const textHash = `0x${createHash("sha256").update(text, "utf8").digest("hex")}` as Hex;
  const account = privateKeyToAccount(key as Hex);
  const wallet = createWalletClient({ account, chain: qorechainTestnet, transport: http() });
  const pub = createPublicClient({ chain: qorechainTestnet, transport: http() });

  const before = await pub.readContract({ address: contract, abi: segelqAbi, functionName: "sealCount" });
  const txHash = await wallet.writeContract({
    address: contract,
    abi: segelqAbi,
    functionName: "seal",
    args: [textHash, label],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  const after = await pub.readContract({ address: contract, abi: segelqAbi, functionName: "sealCount" });

  const record = {
    sealId: Number(before),
    text,
    label,
    textHashSha256: textHash,
    sealer: account.address,
    contract,
    txHash,
    blockNumber: Number(receipt.blockNumber),
    status: receipt.status,
    network: "qorechain-diana (EVM chain ID 9800)",
    sealedAtUtc: new Date().toISOString(),
  };
  mkdirSync("proof/receipts", { recursive: true });
  const file = `proof/receipts/seal-${record.sealId}.json`;
  writeFileSync(file, JSON.stringify(record, null, 2));

  console.log(`sealed: id=${record.sealId} count ${before} -> ${after}`);
  console.log(`tx:     ${txHash}`);
  console.log(`hash:   ${textHash} (sha256 of the text)`);
  console.log(`saved:  ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
