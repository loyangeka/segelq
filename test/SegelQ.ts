import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { createHash } from "node:crypto";

import { parseEventLogs } from "viem";

describe("SegelQ", async () => {
  // Runs on Hardhat's simulated network; no QoreChain endpoint is needed.
  const { viem } = await network.create();
  const [alice, bob] = await viem.getWalletClients();

  const hashOf = (text: string) =>
    `0x${createHash("sha256").update(text, "utf8").digest("hex")}` as const;

  it("starts empty", async () => {
    const segelq = await viem.deployContract("SegelQ");
    assert.equal(await segelq.read.sealCount(), 0n);
  });

  it("seals a hash and reads the receipt back", async () => {
    const segelq = await viem.deployContract("SegelQ");
    const textHash = hashOf("BTC above 150k before 2027");

    const pub = await viem.getPublicClient();
    const txHash = await segelq.write.seal([textHash, "BTC > 150k by 2027"]);
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
    const [event] = parseEventLogs({ abi: segelq.abi, logs: receipt.logs, eventName: "Sealed" }) as unknown as Array<{
      args: { sealId: bigint; sealer: string; textHash: string; label: string; sealedAt: bigint };
    }>;
    assert.equal(event.args.sealId, 0n);
    assert.equal(event.args.sealer.toLowerCase(), alice.account.address.toLowerCase());
    assert.equal(event.args.textHash, textHash);
    assert.equal(event.args.label, "BTC > 150k by 2027");
    assert.ok(event.args.sealedAt > 0n);

    assert.equal(await segelq.read.sealCount(), 1n);
    const seal = (await segelq.read.getSeal([0n])) as {
      sealer: string;
      textHash: string;
      label: string;
      sealedAt: bigint;
      blockNumber: bigint;
    };
    assert.equal(seal.sealer.toLowerCase(), alice.account.address.toLowerCase());
    assert.equal(seal.textHash, textHash);
    assert.equal(seal.label, "BTC > 150k by 2027");
    assert.ok(seal.sealedAt > 0n);
    assert.equal(await segelq.read.isSealed([textHash]), true);
    assert.equal(await segelq.read.firstSealByHash([textHash]), 1n);
  });

  it("tracks seals per account and keeps the first seal indexed for a hash", async () => {
    const segelq = await viem.deployContract("SegelQ");
    const shared = hashOf("ETH flips BTC market cap in 2027");

    await segelq.write.seal([shared, "the flippening"], { account: alice.account });
    await segelq.write.seal([shared, "same text, second sealer"], { account: bob.account });
    await segelq.write.seal([hashOf("a different prediction"), "other"], { account: bob.account });

    assert.equal(await segelq.read.sealCount(), 3n);
    // first seal of a hash stays the canonical receipt for that hash
    assert.equal(await segelq.read.firstSealByHash([shared]), 1n);
    assert.deepEqual(await segelq.read.sealsOf([alice.account.address]), [0n]);
    assert.deepEqual(await segelq.read.sealsOf([bob.account.address]), [1n, 2n]);
  });

  it("rejects an empty label", async () => {
    const segelq = await viem.deployContract("SegelQ");
    await assert.rejects(segelq.write.seal([hashOf("x"), ""]));
    assert.equal(await segelq.read.sealCount(), 0n);
  });
});
