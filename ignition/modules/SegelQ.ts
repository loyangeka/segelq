import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys SegelQ. On QoreChain the deployer needs a registered ML-DSA-87 key
 * and a live EVM authorisation window first (see README: pnpm window open).
 * The window-open transaction is the hybrid-signed (secp256k1 + ML-DSA-87)
 * Quantum Pass transaction; this deploy is admitted inside that window.
 */
export default buildModule("SegelQModule", (m) => {
  const segelq = m.contract("SegelQ", []);
  return { segelq };
});
