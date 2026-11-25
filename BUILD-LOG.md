# SegelQ — BUILD LOG
Project: SegelQ — Quantum-Sealed Prediction Receipts (QoreChain "Build Before Q-Day" Developer Fest, Quantum Pass, solo)
Build started: 2026-11-25 (Asia/Jakarta), Gas from Eka 09:49 WIB.
Deadline: submission 2 Dec 2026 23:59 UTC = 3 Dec 06:59 WIB. Building window 4 Nov–2 Dec 2026 (only commits from 4 Nov count).

## Chain-ID resolution (pinned at build start)
- Official Workshop 1 guide (docs.qorechain.io/build-before-qday/workshop-1/, checked against scaffolder 0.14.0) and the
  create-qorechain-dapp hardhat template defaults both use: testnet `qorechain-diana`, **EVM chain ID 9800**.
- Endpoints (Workshop 1): RPC https://rpc-testnet.qore.host · REST https://api-testnet.qore.host ·
  EVM JSON-RPC https://evm-testnet.qore.host · Explorer https://explore.qore.network (Testnet) ·
  Faucet https://dashboard.qorechain.io/faucet (sign-in required, 100 QOR / 24 h / account).
- DISCREPANCY: the event Rules page mentions testnet chain ID **1011**. No official doc page uses 1011 for diana;
  docs + scaffold + SDK all consistently use EVM 9800 / qorechain-diana. **Decision: build on 9800 / qorechain-diana**
  (per instruction: official docs win; discrepancy recorded here).
- Flow (Workshop 1): scaffold hardhat template -> throwaway account (.env PRIVATE_KEY + QORE_PQC_RECOVERY_CODE)
  -> faucet -> `pnpm window register` (registers ML-DSA-87 key, ~0.09 QOR, classical-signed bootstrap)
  -> `pnpm window open` (THE hybrid-signed tx: secp256k1 + ML-DSA-87; opens EVM authorisation window, default 600 blocks / 5 txs)
  -> deploy + EVM txs inside window -> verify the open-tx via REST: PQCHybridSignature extension (ML-DSA-87 sig = 4,627 bytes)
  + event `pqc_hybrid_verify` status=verified.

## Steps
- Faucet (docs.qorechain.io/dashboard/faucet/): **Dashboard sign-in REQUIRED** ("Sign in to access the faucet";
  no wallet connection needed; any qor1... address can be pasted). Pays 100 QOR + fest tokens (1000 fUSD, 0.5 fETH, 0.02 fBTC),
  1 claim / 24 h per account AND per address. => Funding step needs Eka's own dashboard sign-in (his step); see Blockers.

## Log
- 2026-11-25 ~09:50 WIB: build start; docs pinned (above). Installing pnpm + scaffolding.
- 2026-11-25 ~09:57 WIB: scaffold OK after pnpm-12 fix (`pnpm approve-builds esbuild` -> allowBuilds in
  pnpm-workspace.yaml). Template tests pass (2 passing, matches Workshop 1 step 2).
- SegelQ.sol written (seal(bytes32,string), getSeal/sealsOf/isSealed/firstSealByHash, Sealed event),
  compiled with solc 0.8.28; unit tests 6/6 passing (incl. template Counter); typecheck clean.
  Hash function: SHA-256 of the UTF-8 text (reproducible in any browser via SubtleCrypto).
- Project testnet account created (Workshop 1 step 3 flow; secrets written by script directly to
  segelq/.env and ~/workspace/qorechain/project.env, both mode 600, values never printed/logged):
  - EVM address:    0x41acE6E2BAC1C4A18f2863aBF3527595519928C8
  - Native address: qor1gxkwdc46c8z2rregvw4lx5n4j4gej2xggz9smx
  - `pnpm window status`: PQC key not registered, window none (expected pre-funding).
- Balance check via REST: account not yet on chain / zero balance -> needs faucet funding.

## BLOCKER — faucet funding needs Eka (dashboard sign-in)
The only official faucet (dashboard.qorechain.io/faucet) requires signing in to a personal
QoreChain Dashboard account first (docs: "Sign in to access the faucet"). No CLI/API faucet exists
in the official docs. Exactly what Eka needs to do (2 minutes, in his browser):
  1. Open https://dashboard.qorechain.io/faucet and sign in with his Dashboard account.
  2. Make sure the header network switch is on **Testnet**.
  3. Paste this address into Wallet Address: qor1gxkwdc46c8z2rregvw4lx5n4j4gej2xggz9smx
  4. Click **Request Tokens** -> expect "Tokens Sent!" (100 QOR + fest tokens).
Then the build continues automatically: window register -> window open (hybrid tx) -> deploy ->
seal -> REST verification. NOTE: his hackathon registration also needs HIS OWN QoreX qor1 address;
this project account is the build/deploy account — the parent agent should confirm with Eka which
qor1 address goes into the submission form (prize payout address is locked to the registered account).
- 2026-11-25 ~10:0x WIB: frontend receipt page built (segelq/web/: hash a prediction via SHA-256,
  verify a hybrid tx from REST, read a seal via EVM eth_call; static, no login, no build step).
  README.md drafted (concept, hybrid-signature explainer, run instructions, library credits, MIT).
  Alternative-faucet check: official FAQ + RDK docs confirm the Dashboard faucet is the ONLY
  published faucet (no fixed public faucet endpoint exists) -> blocker stands as recorded above.

## Status at end of this phase (2026-11-25)
DONE: repo + MIT license + scaffold · SegelQ.sol compiled, 6/6 unit tests, typecheck clean ·
project testnet account created (project.env mode 600) · frontend receipt page · README draft ·
chain ID pinned (9800 / qorechain-diana; Rules' 1011 discrepancy recorded).
BLOCKED on Eka's faucet sign-in: funding -> register -> window open (hybrid tx) -> deploy -> seal
-> REST read-back proof. Everything downstream is scripted and ready to run in minutes once funded.

## Remaining steps to the six mandatory submission fields
1. [Eka] Faucet: sign in at dashboard.qorechain.io/faucet (Testnet) and send 100 QOR to
   qor1gxkwdc46c8z2rregvw4lx5n4j4gej2xggz9smx. (Also: Eka's build.qorechain.io registration —
   GitHub loyangeka + X @midut1995 + his QoreX testnet address — is his device-side step;
   parent agent to confirm which qor1 address is the submission/payout address.)
2. [Agent, post-funding] `pnpm window register` (save tx) -> `pnpm window open` (save HYBRID tx hash)
   -> `pnpm verify-tx <hash>` -> save raw REST JSON + summary into segelq/proof/.
3. [Agent] `pnpm deploy:segelq` -> contract address into README + web/app.js CONFIG + proof/deploy.json.
4. [Agent] Open a fresh window if needed, `pnpm seal` one real prediction -> receipt in
   proof/receipts/; read the seal back via the receipt page logic (eth_call getSeal).
5. [Later phase] Push repo to a PUBLIC GitHub repo (loyangeka) — not done this phase by instruction.
6. [Later phase] Host web/ at a public demo URL (no login); fill contract address in app.js first.
7. [Later phase] Record the 2–4 min demo video (EN subtitles/narration): seal a prediction ->
   receipt page verifies the hybrid tx (pqc_hybrid_verify: verified) -> read the seal back -> explorer.
8. [Eka + agent] Submit on build.qorechain.io before 2 Dec 2026 23:59 UTC with all six fields:
   public GitHub repo · demo URL · video URL · qor1 testnet address · contract address · description+README.
KNOWN DEMO CONSIDERATION: the receipt page calls the public REST/EVM endpoints directly from the
browser; if the demo host hits CORS limits, serve it with a tiny /lcd proxy (per official docs
troubleshooting) — decide in the hosting phase.
