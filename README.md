# SegelQ — Quantum-Sealed Prediction Receipts

**Seal a prediction today. Prove later — word for word — that you called it.**

SegelQ is a small dApp on the QoreChain testnet (`qorechain-diana`, EVM chain
ID 9800) built for the **Build Before Q-Day Developer Fest — Quantum Pass**.
You write a short prediction, SegelQ hashes it (SHA-256) and stores only the
hash, a public label, your address and a timestamp in the `SegelQ` contract.
The plaintext never goes on chain. When the future arrives, you reveal the
text; anyone can re-hash it and match it against the on-chain receipt.

What makes the receipt special is *how it was authorised*: on QoreChain,
EVM transactions are admitted through an **EVM authorisation window** that is
opened by a **hybrid post-quantum transaction** — one transaction carrying
both a classical secp256k1 signature and a post-quantum **ML-DSA-87**
signature (NIST FIPS 204). The validators verify both, and the proof is
public: the `PQCHybridSignature` extension and the `pqc_hybrid_verify`
event with `status: verified`, readable by anyone from the chain's REST
endpoint. Every SegelQ seal therefore sits behind a quantum-resistant
signature, not just a classical one.

## Status

| Piece | State |
| --- | --- |
| Contract `SegelQ.sol` | ✅ written, compiled, unit-tested (6/6) |
| Receipt page (`web/`) | ✅ static page: hash, verify a hybrid tx, read a seal |
| Project testnet account | ✅ `qor1gxkwdc46c8z2rregvw4lx5n4j4gej2xggz9smx` / `0x41acE6E2BAC1C4A18f2863aBF3527595519928C8` |
| Funding | ✅ 10 QOR received 2026-11-25 (transfer from Eka's testnet wallet, tx `EE8BDE36…06CE5963`) |
| ML-DSA-87 key registration tx | ✅ `E751C9C92B8947C48D3CB87A46418F21B71A622B1DFB60CFC4ADC7D254BF3E52` (height 10705563, code 0) |
| Hybrid window-open tx (the Quantum Pass tx) | ✅ `46D849AC7A358CD821FEE250180370532C3030C0391EB8A869E7E72049A192B4` — `pqc_hybrid_verify: verified` |
| Contract deployment | ✅ `0xe2379181fbf982268F2d966c3a1725D3fe6EAdf9` (deploy tx below) |
| First seal + REST read-back proof | ✅ seal id 0 ("genesis"), read back via the receipt-page logic |

**Deployed contract address: `0xe2379181fbf982268F2d966c3a1725D3fe6EAdf9`**
on qorechain-diana (EVM chain ID 9800).
Deploy tx: `0x7d329b4485be19ba958de86b61e934be4d548a87c8a8609fab5995fa0a259d8f`
(EVM block 10705793, status success, gasUsed 484210).
Hybrid window-open tx (the Quantum Pass proof):
`46D849AC7A358CD821FEE250180370532C3030C0391EB8A869E7E72049A192B4` —
REST read-back: [`proof/window-open-tx.json`](proof/window-open-tx.json),
extracted summary: [`proof/window-open-summary.json`](proof/window-open-summary.json)
(`PQCHybridSignature` extension present, 64-byte secp256k1 signature,
`pqc_hybrid_verify` event with `algorithm_id: dilithium5`, `status: verified`).
First seal: [`proof/receipts/seal-0.json`](proof/receipts/seal-0.json) —
seal tx `0x18074cf46d4c7f0c0a459be55a4b22998e9cf121cabfc305be0efc5f627358d4`.
Deployment record: [`proof/deploy.json`](proof/deploy.json).
Verify any of it yourself:
`GET https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/<COSMOS_HASH>`,
or point the receipt page in [`web/`](web/) at the contract above.

## How the hybrid signature works

1. **Register once.** The account generates an ML-DSA-87 keypair (derived
   from a `QRC1` recovery code) and registers the public key on chain with
   `pnpm window register`. This one bootstrap transaction is signed
   classically only, because no PQ key exists yet. One-time fee ≈ 0.09 QOR.
2. **Open a window (the hybrid transaction).** `pnpm window open` sends a
   native-lane message signed with **both** keys: a 64-byte secp256k1
   signature and the ML-DSA-87 signature (4,627 bytes) carried in the
   `PQCHybridSignature` extension. Validators check both and emit
   `pqc_hybrid_verify` with `status: verified`. The window (default:
   600 blocks, up to 5 transactions) now admits the account's ordinary
   EVM transactions.
3. **Seal inside the window.** The contract deploy and each `seal()` call
   are normal EVM transactions admitted by that window — the quantum-
   resistant authorisation stands behind them.
4. **Anyone can verify.** `GET https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/<HASH>`
   returns the full record: `code: 0`, the `PQCHybridSignature` extension,
   and the `pqc_hybrid_verify` event. `scripts/verify-tx.ts` extracts
   exactly that, and the receipt page in `web/` renders it in a browser.

## The contract

`contracts/SegelQ.sol` — an append-only receipt registry:

- `seal(bytes32 textHash, string label)` → stores
  `{sealer, textHash, label, sealedAt, blockNumber}`, emits `Sealed`.
- `getSeal(id)`, `sealCount()`, `sealsOf(address)`, `isSealed(hash)`,
  `firstSealByHash(hash)` — public reads; the first seal of a hash is the
  canonical receipt for that text.

## Run it

Prerequisites: Node.js ≥ 22, pnpm. (Flow follows the official
[Workshop 1](https://docs.qorechain.io/build-before-qday/workshop-1/).)

```bash
pnpm install
pnpm test            # template + SegelQ unit tests (simulated chain)

# 1. Create a throwaway testnet account in .env (never commit .env):
#    PRIVATE_KEY (viem generatePrivateKey) + QORE_PQC_RECOVERY_CODE
#    from `pnpm window recovery-code`, then:
pnpm window status   # shows your 0x… and qor1… addresses

# 2. Fund it: dashboard.qorechain.io/faucet (sign in, Testnet,
#    paste the qor1… address, Request Tokens — 100 QOR)

# 3. Register the PQ key and open the hybrid window:
pnpm window register
pnpm window open     # <-- THE hybrid-signed transaction; save its hash

# 4. Deploy SegelQ inside the window:
pnpm deploy:segelq   # note the contract address

# 5. Seal a prediction (plaintext stays local, in proof/receipts/):
SEGELQ_ADDRESS=0x… pnpm seal "BTC above 150k before 2027" "BTC > 150k by 2027"

# 6. Read the hybrid proof back from the chain:
pnpm verify-tx <WINDOW_OPEN_TX_HASH>

# 7. Receipt page (static, no login): serve web/ any way you like, e.g.
npx serve web
```

Network facts (official docs + scaffold defaults): testnet
`qorechain-diana`, EVM chain ID **9800** · EVM RPC
`https://evm-testnet.qore.host` · REST `https://api-testnet.qore.host` ·
Explorer `https://explore.qore.network` (switch to Testnet).
Note: the event Rules page mentions chain ID 1011; every official doc,
the SDK and the scaffold use 9800 for diana — this project builds on 9800
(discrepancy recorded in the build log).

## Libraries & third-party credit

Original work in this repo: `contracts/SegelQ.sol`, `test/SegelQ.ts`,
`ignition/modules/SegelQ.ts`, `scripts/seal.ts`, `scripts/verify-tx.ts`,
`web/` (receipt page), this README. Everything else is credited below —
thank you to the authors.

| Library / tool | Version | License | Used for |
| --- | --- | --- | --- |
| create-qorechain-dapp (official QoreChain scaffolder) | 0.14.0 | see upstream | Project scaffold (hardhat template): `contracts/Counter.sol`, `scripts/window.ts`, config |
| @qorechain/sdk | ^0.14.0 | see upstream | ML-DSA-87 key derivation, PQC registration, window messages |
| @qorechain/evm | ^0.14.0 | see upstream | EVM window status/cost helpers, chain definitions |
| @cosmjs/stargate | ^0.39.0 | Apache-2.0 | Cosmos-side client in the window helper |
| Hardhat 3 + toolbox-viem, Ignition, node-test-runner | ^3.21.1 | MIT | Build, test, deploy |
| viem | ^2.47.6 | MIT | EVM client in scripts/tests |
| tsx | ^4.19.0 | MIT | Running TypeScript scripts |
| TypeScript | ^5.6.3 | Apache-2.0 | Language |
| QoreChain Workshop 1 guide (docs.qorechain.io) | — | QoreChain docs | The reference flow this project follows |

## License

MIT — see [LICENSE](LICENSE). (Template files originating from
create-qorechain-dapp keep their upstream notices.)
