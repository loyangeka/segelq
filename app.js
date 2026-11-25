// SegelQ receipt page — plain static JS, no build step, no wallet, no login.
// Reads only: QoreChain REST (hybrid tx proof) + EVM JSON-RPC (contract reads).
const CONFIG = {
  // Deployed SegelQ contract on qorechain-diana (EVM 9800). Filled in at deploy time.
  contract: "0xe2379181fbf982268F2d966c3a1725D3fe6EAdf9",
  rest: "https://api-testnet.qore.host",
  evmRpc: "https://evm-testnet.qore.host",
  explorer: "https://explore.qore.network",
};

// Function selectors for SegelQ.sol (computed from the ABI with viem).
const SEL = {
  sealCount: "0x726804ab", // sealCount()
  getSeal: "0x2c945c75", // getSeal(uint256)
  isSealed: "0x0646e2be", // isSealed(bytes32)
  firstSealByHash: "0x40fb4ab8", // firstSealByHash(bytes32)
};

const $ = (id) => document.getElementById(id);
const deployed = () => !/^0x0{40}$/.test(CONFIG.contract);

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return "0x" + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ethCall(data) {
  const res = await fetch(CONFIG.evmRpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: CONFIG.contract, data }, "latest"] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "eth_call failed");
  return json.result;
}

const word = (hex, i) => hex.slice(2 + i * 64, 2 + (i + 1) * 64);
const wordToBig = (hex, i) => BigInt("0x" + word(hex, i));

function decodeSeal(hex) {
  // getSeal returns a single struct, ABI-encoded as a tuple: word 0 is the
  // byte offset of the tuple body (0x20), the fields follow inside the
  // tuple, and the string offset is relative to the tuple start.
  // (Verified against the live contract 2026-11-25 — see BUILD-LOG.)
  const base = Number(wordToBig(hex, 0)); // tuple start, in bytes (32)
  const at = (i) => word(hex, base / 32 + i);
  const atBig = (i) => BigInt("0x" + at(i));
  const sealer = "0x" + at(0).slice(24);
  const textHash = "0x" + at(1);
  const strOff = Number(atBig(2));
  const sealedAt = atBig(3);
  const blockNumber = atBig(4);
  const strStart = 2 + (base + strOff) * 2;
  const len = Number(BigInt("0x" + hex.slice(strStart, strStart + 64)));
  const bytes = hex.slice(strStart + 64, strStart + 64 + len * 2);
  const label = new TextDecoder().decode(Uint8Array.from(bytes.match(/../g).map((h) => parseInt(h, 16))));
  return { sealer, textHash, label, sealedAt, blockNumber };
}

async function refreshCount() {
  if (!deployed()) { $("countBadge").textContent = "contract: pending deployment"; return; }
  try {
    const n = await ethCall(SEL.sealCount);
    $("countBadge").textContent = `seals on chain: ${BigInt(n)}`;
    $("contractAddr").textContent = CONFIG.contract;
  } catch { $("countBadge").textContent = "seals on chain: (RPC unreachable)"; }
}

$("hashBtn").onclick = async () => {
  const text = $("predText").value.trim();
  if (!text) return;
  $("hashOut").innerHTML = `SHA-256: <span class="mono">${await sha256Hex(text)}</span>`;
};

$("checkBtn").onclick = async () => {
  const text = $("predText").value.trim();
  if (!text) return;
  const hash = await sha256Hex(text);
  if (!deployed()) { $("hashOut").innerHTML = `Hash: <span class="mono">${hash}</span><br/>Contract not deployed yet — seal check unavailable.`; return; }
  try {
    const sealed = await ethCall(SEL.isSealed + hash.slice(2));
    if (BigInt(sealed) === 0n) {
      $("hashOut").innerHTML = `Hash: <span class="mono">${hash}</span><br/>Not sealed yet — this prediction is still free to claim.`;
    } else {
      const first = await ethCall(SEL.firstSealByHash + hash.slice(2));
      $("hashOut").innerHTML = `Hash: <span class="mono">${hash}</span><br/><span class="ok">Already sealed</span> — first seal id ${BigInt(first) - 1n}.`;
    }
  } catch (e) { $("hashOut").textContent = `Check failed: ${e.message}`; }
};

$("verifyBtn").onclick = async () => {
  const hash = $("txHash").value.trim();
  const out = $("verifyOut");
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) { out.textContent = "That does not look like a transaction hash (64 hex chars)."; return; }
  out.textContent = "Reading the transaction from the chain…";
  try {
    const res = await fetch(`${CONFIG.rest}/cosmos/tx/v1beta1/txs/${hash}`);
    if (!res.ok) throw new Error(`REST ${res.status}`);
    const data = await res.json();
    const txr = data.tx_response ?? {};
    const events = txr.events ?? [];
    const verify = events.filter((e) => e.type === "pqc_hybrid_verify");
    const status = verify.flatMap((e) => e.attributes).find((a) => a.key === "status")?.value;
    const hasHybrid = JSON.stringify(data).includes("PQCHybridSignature");
    const sigBytes = (data.tx?.signatures ?? []).map((s) => { try { return atob(s).length; } catch { return "?"; } });
    out.innerHTML = `<dl class="kv">
      <dt>Result</dt><dd>${txr.code === 0 ? '<span class="ok">success (code 0)</span>' : `<span class="bad">code ${txr.code}</span>`}</dd>
      <dt>Block height</dt><dd>${txr.height ?? "?"}</dd>
      <dt>Classical signature</dt><dd>secp256k1 · ${sigBytes.join(", ") || "?"} bytes</dd>
      <dt>Post-quantum signature</dt><dd>${hasHybrid ? "ML-DSA-87 (FIPS 204) · PQCHybridSignature extension present" : "not found in this tx"}</dd>
      <dt>pqc_hybrid_verify</dt><dd>${status === "verified" ? '<span class="ok">verified</span> — both signatures checked by validators' : (status ?? "event not found")}</dd>
      <dt>Explorer</dt><dd><a href="${CONFIG.explorer}" target="_blank" rel="noreferrer">open explorer (Testnet) and search this hash</a></dd>
    </dl>`;
  } catch (e) { out.textContent = `Could not read the tx (network/CORS): ${e.message}. Try the explorer link in the footer.`; }
};

$("readBtn").onclick = async () => {
  const id = $("sealId").value.trim();
  const out = $("readOut");
  if (!deployed()) { out.textContent = "Contract not deployed yet."; return; }
  if (!/^\d+$/.test(id)) { out.textContent = "Seal id must be a number."; return; }
  try {
    const data = SEL.getSeal + BigInt(id).toString(16).padStart(64, "0");
    const seal = decodeSeal(await ethCall(data));
    out.innerHTML = `<dl class="kv">
      <dt>Sealer</dt><dd class="mono">${seal.sealer}</dd>
      <dt>Text hash (SHA-256)</dt><dd class="mono">${seal.textHash}</dd>
      <dt>Label</dt><dd>${seal.label}</dd>
      <dt>Sealed at</dt><dd>${new Date(Number(seal.sealedAt) * 1000).toISOString()} (block ${seal.blockNumber})</dd>
    </dl>`;
  } catch (e) { out.textContent = `Read failed: ${e.message}`; }
};

refreshCount();
