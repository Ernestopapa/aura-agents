// Deploy AuraAgents to BSC MAINNET (chain 56).
// MAINNET ONLY. No mock registry — constructor args are the REAL Agent ID
// registry and the USER wallet as initialOwner. These are IMMUTABLE once
// deployed: triple-check them before running. The deployer is a FRESH
// throwaway wallet (key only in .env.mainnet, chmod 600); it pays gas only.
// It is NOT the testnet deployer (0x03414bc66B3D98C573a6d39c75D7Daa826bD5a98),
// never fund it with testnet keys, never use the testnet deployer here.
//
// Usage:
//   node scripts/deploy-mainnet.js            # deploy (needs >= 0.001 BNB)
//   node scripts/deploy-mainnet.js --estimate # gas estimate only, no deploy
// Funding: user sends ~0.001 BNB to the deployer address from the user
// wallet. Deploy costs ~2,080,374 gas (testnet-measured); at 0.05 gwei
// that is ~0.000104 BNB. 0.001 BNB leaves ample margin plus the
// leftover-return tx. Verify the top-up ON CHAIN before running (M10
// lesson: never assume a transfer landed — this script reads the balance
// first and exits if < 0.001 BNB, and the balance + nonce are verified
// on two RPCs before the run).
// After deploy the script runs the post-deploy checks, then returns the
// leftover deployer BNB to the user wallet and records the return tx.
// setBaseURI is owner-only: the USER wallet signs it via baw with a
// preview + explicit confirm (M15 lesson), NOT the deployer.
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "https://bsc-dataseed.binance.org/";
const RPC2 = "https://bsc-dataseed1.binance.org/";
const CHAIN_ID = 56;
const ENV_FILE = path.join(root, ".env.mainnet");
const DEPLOY_FILE = path.join(root, "deployment-mainnet.json");
const MIN_BALANCE = ethers.parseEther("0.001");
// REAL Binance Agent ID registry — immutable in the deployed bytecode.
// Triple-checked against SPECS.md / Gate 0. NEVER change this address.
const REGISTRY = "0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F";
const OWNER = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";
const TESTNET_DEPLOYER = "0x03414bc66B3D98C573a6d39c75D7Daa826bD5a98";

if (REGISTRY.toLowerCase() !== "0x60b9262456de011f7d15a54cdd8c48baaa8b022f") {
  console.log("BLOCKED: REGISTRY constant is not the real Agent ID registry.");
  process.exit(2);
}

function loadArtifact(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "build", `${name}.json`), "utf8"));
}
function loadEnv() {
  const out = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

const provider = new ethers.JsonRpcProvider(RPC, CHAIN_ID);
const env = loadEnv();
if (!env.DEPLOYER_PRIVATE_KEY) {
  console.log("BLOCKED: .env.mainnet missing DEPLOYER_PRIVATE_KEY. Generate the fresh mainnet deployer first; never reuse the testnet key.");
  process.exit(2);
}
const deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
if (deployer.address.toLowerCase() === TESTNET_DEPLOYER.toLowerCase()) {
  console.log("BLOCKED: deployer is the TESTNET deployer. Never use the testnet key on mainnet.");
  process.exit(2);
}
if (deployer.address.toLowerCase() === OWNER.toLowerCase()) {
  console.log("BLOCKED: deployer must be a throwaway, not the user wallet.");
  process.exit(2);
}
const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) {
  console.log(`BLOCKED: connected chainId is ${network.chainId}, expected ${CHAIN_ID}. Refusing to deploy.`);
  process.exit(2);
}
console.log("Network chainId:", network.chainId, "(BSC mainnet)");
console.log("Deployer address:", deployer.address);
console.log("Registry (real):", REGISTRY);
console.log("Owner (user wallet):", OWNER);

const balance = await provider.getBalance(deployer.address);
const nonce = await provider.getTransactionCount(deployer.address);
console.log("Deployer BNB balance (on-chain):", ethers.formatEther(balance));
console.log("Deployer nonce (on-chain):", nonce);
const feeData = await provider.getFeeData();
console.log("Mainnet gas price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "n/a");

const auraArt = loadArtifact("AuraAgents");
const auraFactory = new ethers.ContractFactory(auraArt.abi, auraArt.bytecode, deployer);
try {
  const auraTx = await auraFactory.getDeployTransaction(REGISTRY, OWNER);
  const auraGas = await provider.estimateGas({ ...auraTx, from: deployer.address });
  const price = feeData.gasPrice ?? 50_000_000n;
  console.log(`Est. deploy gas: ${auraGas}`);
  console.log(`Est. deploy cost at ${ethers.formatUnits(price, "gwei")} gwei: ${ethers.formatEther(auraGas * price)} BNB`);
} catch (e) {
  console.log("Gas estimate failed:", e.message);
}

if (process.argv.includes("--estimate")) process.exit(0);

if (balance < MIN_BALANCE) {
  console.log("\n=== BLOCKED: mainnet deployer needs BNB ===");
  console.log(`1. Send ~0.001 BNB (from the user wallet ${OWNER}) to: ${deployer.address}`);
  console.log("2. Verify the balance on-chain, then re-run: node scripts/deploy-mainnet.js");
  console.log("   (Key is saved in .env.mainnet — never share it.)");
  process.exit(2);
}
if (nonce !== 0) {
  console.log(`\n=== BLOCKED: deployer nonce is ${nonce}, expected 0 for a fresh throwaway. Do not deploy from a used wallet. ===`);
  process.exit(2);
}

console.log("\nDeploying AuraAgents to BSC MAINNET (owner = user wallet, registry = real)...");
const aura = await auraFactory.deploy(REGISTRY, OWNER);
await aura.waitForDeployment();
const auraAddr = await aura.getAddress();
const deployTx = aura.deploymentTransaction();
const auraRc = await deployTx.wait();
console.log("AuraAgents deployed:", auraAddr, "tx", deployTx.hash, "gas", auraRc.gasUsed.toString(), "block", auraRc.blockNumber);

// --- On-chain reads, asserted against the locked Gate 0 expectations ---
// Aura has NO separate paid phase (blended mint): paidOpen is true from
// the start while paid supply remains — unlike NFOX/AKEY where paidOpen
// was false until free sold out. Do NOT "fix" paidOpen true here.
const reads = {
  owner: await aura.owner(),
  totalSupply: (await aura.totalSupply()).toString(),
  freeMintedCount: (await aura.freeMintedCount()).toString(),
  freeRemaining: (await aura.freeRemaining()).toString(),
  paidRemaining: (await aura.paidRemaining()).toString(),
  freeOpen: await aura.freeOpen(),
  paidOpen: await aura.paidOpen(),
  registry: await aura.agentIdRegistry(),
  royalty: await aura.royaltyInfo(1, ethers.parseEther("1")),
};
console.log("\nOn-chain reads:", JSON.stringify({ ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] }, null, 2));

const checks = [
  ["owner is user wallet", reads.owner.toLowerCase() === OWNER.toLowerCase()],
  ["registry is real registry", reads.registry.toLowerCase() === REGISTRY.toLowerCase()],
  ["totalSupply 0", reads.totalSupply === "0"],
  ["freeMintedCount 0", reads.freeMintedCount === "0"],
  ["freeRemaining 7200", reads.freeRemaining === "7200"],
  ["paidRemaining 800", reads.paidRemaining === "800"],
  ["freeOpen true", reads.freeOpen === true],
  ["paidOpen true (blended, no separate phase)", reads.paidOpen === true],
  ["royaltyInfo 5% to owner", reads.royalty[1] === ethers.parseEther("0.05") && reads.royalty[0].toLowerCase() === OWNER.toLowerCase()],
];
for (const [name, ok] of checks) console.log(`CHECK ${name}: ${ok ? "OK" : "FAIL"}`);

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.log(`\n${failed.length} POST-DEPLOY CHECK(S) FAILED — do not proceed to launch. Leftover BNB NOT returned yet; it stays in the deployer for investigation.`);
  process.exit(1);
}

// --- Return leftover deployer BNB to the user wallet (M16 lesson) ---
let returnTxHash = null;
const leftover = await provider.getBalance(deployer.address);
const returnGasPrice = (await provider.getFeeData()).gasPrice ?? 50_000_000n;
const returnGasCost = 21000n * returnGasPrice;
if (leftover > returnGasCost) {
  const returnValue = leftover - returnGasCost;
  console.log(`\nReturning leftover ${ethers.formatEther(returnValue)} BNB to user wallet ${OWNER} (gas ${ethers.formatEther(returnGasCost)} BNB)...`);
  const returnTx = await deployer.sendTransaction({ to: OWNER, value: returnValue, gasLimit: 21000 });
  const returnRc = await returnTx.wait();
  returnTxHash = returnTx.hash;
  console.log("Leftover returned, tx", returnTxHash, "gas", returnRc.gasUsed.toString(), "block", returnRc.blockNumber);
  console.log("Deployer balance now:", ethers.formatEther(await provider.getBalance(deployer.address)), "BNB");
} else {
  console.log(`\nLeftover ${ethers.formatEther(leftover)} BNB is below the return-tx gas cost ${ethers.formatEther(returnGasCost)} BNB — nothing to return.`);
}

const deployment = {
  network: "BSC mainnet",
  chainId: CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  registry: REGISTRY,
  owner: OWNER,
  auraAgents: auraAddr,
  auraAgentsDeployTx: deployTx.hash,
  auraAgentsDeployGas: auraRc.gasUsed.toString(),
  blockNumber: auraRc.blockNumber,
  deployerBalanceBefore: ethers.formatEther(balance),
  onChainReads: { ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] },
  checks: Object.fromEntries(checks),
  leftoverReturnTx: returnTxHash,
  status: "deployed",
  note: "MAINNET. baseURI NOT yet set (owner-only; user wallet signs via baw with preview + explicit confirm). Verify on Sourcify + BscScan next, then update site with this address.",
};
fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployment, null, 2));
console.log("\nSaved:", DEPLOY_FILE);
console.log("Verify on BscScan: https://bscscan.com/address/" + auraAddr);
console.log("\nAll post-deploy checks passed. Next: verify Sourcify + BscScan, owner setBaseURI, update site with this address.");
