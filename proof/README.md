# proof/

On-chain evidence for SegelQ, captured from the public QoreChain testnet
REST endpoint (https://api-testnet.qore.host) and the deployed contract.

Expected files (filled in during the deploy phase, after faucet funding):

- `register-tx.json` — raw REST record of the ML-DSA-87 key registration tx.
- `window-open-tx.json` — raw REST record of the HYBRID-SIGNED window-open tx
  (the Quantum Pass transaction): contains the `PQCHybridSignature`
  extension (ML-DSA-87 signature, 4,627 bytes, next to the 64-byte
  secp256k1 signature) and the `pqc_hybrid_verify` event, status `verified`.
- `window-open-summary.json` — extracted summary from scripts/verify-tx.ts.
- `deploy.json` — SegelQ deployment: contract address, deploy tx, block.
- `receipts/seal-<id>.json` — one file per seal made by scripts/seal.ts:
  the plaintext prediction, its SHA-256, label, sealer, seal tx hash.
