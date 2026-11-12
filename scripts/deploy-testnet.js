// Deploy AuraAgents + AgentIdRegistryMock to BSC TESTNET (chain 97).
// TESTNET ONLY. Never point this at mainnet, never use the user's real
// wallet key. The deployer is a FRESH throwaway wallet generated locally
// and stored in .env.testnet (chmod 600). Only its ADDRESS is recorded
// in deployment-testnet.json / SPECS.md / reports.
//
// Owner on testnet = user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403
// (same as mainnet will be). Consequence: withdraw() and setBaseURI()
// are owner-only, so they CANNOT be executed live on testnet by the
// deployer — they are proven locally (Anvil suite) and the live script
// records the non-owner revert + the contract's held balance instead.
// setBaseURI is NOT attempted here at all (site is not live yet).
// NOTE: tokenURI is per-VARIANT (2026-11-02 file reduction):
// tokenURI(tokenId) = baseURI + variant, variant = (tokenId-1)%16+1.
// With baseURI still empty on testnet, tokenURI(1) == "1",
// tokenURI(16) == "16", tokenURI(17) == "1" — that alone proves the
// variant mapping live, before the owner ever sets baseURI.
//
// MintCaller (EOA-gate test helper) IS deployed on testnet here, ONLY
// to prove the EOA-only revert live. Its header says "never deploy on
// testnet" — that was written before Gate 5 required the live EOA test.
// Testnet-only throwaway, never mainnet, never a mint path for users.
//
// Usage:
//   node scripts/deploy-testnet.js            # deploy + run live tests
//   node scripts/deploy-testnet.js --estimate # gas estimate only, no deploy
// The deployer needs >= 0.02 tBNB: deploys (~2.4M gas) + setAgents +
// funding 4 agent test wallets + 1 plain wallet (0.014 tBNB value).
// One faucet claim (~0.1 tBNB) is more than enough. If the balance is
// lower the script stops (exit 2) with faucet instructions. Fund it,
// then re-run. Faucet: https://testnet.bnbchain.org/faucet-smart
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const CHAIN_ID = 97;
const FAUCET = "https://testnet.bnbchain.org/faucet-smart";
const ENV_FILE = path.join(root, ".env.testnet");
const DEPLOY_FILE = path.join(root, "deployment-testnet.json");
const TESTS_FILE = path.join(root, "testnet-live-tests.json");
const WALLETS_FILE = path.join(root, "test-wallets-testnet.json");
// Stop below ~0.02 tBNB (Gate 5 brief). Funding value alone is 0.014
// tBNB; deploys + mints + transfers are gas on top. Do NOT lower this.
const MIN_BALANCE = ethers.parseEther("0.02");
const PAID_PRICE = ethers.parseEther("0.0005");
const USER_WALLET = "0x75d251Ba39dED2E456d9f6DD776f77d422864403";
// Funding per test wallet (value; gas is extra, ~0.1 gwei on testnet).
const FUND = {
  agentA: ethers.parseEther("0.003"), // mint(2) free + mint(2) all-paid 0.001
  agentB: ethers.parseEther("0.002"), // mint(3) blended 0.0005
  agentC: ethers.parseEther("0.006"), // mint(10) blended 0.004
  agentD: ethers.parseEther("0.002"), // freeMint() x2 free + x1 paid 0.0005
  plain: ethers.parseEther("0.001"), // revert attempts (gas only)
};
const FUND_TOTAL = Object.values(FUND).reduce((a, b) => a + b, 0n);

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
let deployer;
if (env.DEPLOYER_PRIVATE_KEY) {
  deployer = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
} else {
  deployer = ethers.Wallet.createRandom().connect(provider);
  fs.writeFileSync(
    ENV_FILE,
    `# TESTNET-ONLY throwaway deployer — never fund with real BNB, never use on mainnet.\n# Address: ${deployer.address}\nDEPLOYER_PRIVATE_KEY=${deployer.privateKey}\n`,
    { mode: 0o600 }
  );
  console.log("Generated fresh throwaway testnet deployer.");
}
console.log("Deployer address:", deployer.address);

const balance = await provider.getBalance(deployer.address);
console.log("Deployer tBNB balance (on-chain):", ethers.formatEther(balance));
const feeData = await provider.getFeeData();
console.log("Testnet gas price:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "n/a");

const mockArt = loadArtifact("AgentIdRegistryMock");
const auraArt = loadArtifact("AuraAgents");
const callerArt = loadArtifact("MintCaller");
const mockFactory = new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, deployer);
const auraFactory = new ethers.ContractFactory(auraArt.abi, auraArt.bytecode, deployer);
const callerFactory = new ethers.ContractFactory(callerArt.abi, callerArt.bytecode, deployer);
let estDeployCost = 0n;
try {
  const mockTx = await mockFactory.getDeployTransaction(deployer.address);
  const auraTx = await auraFactory.getDeployTransaction(deployer.address, USER_WALLET);
  const mockGas = await provider.estimateGas({ ...mockTx, from: deployer.address });
  const auraGas = await provider.estimateGas({ ...auraTx, from: deployer.address });
  const price = feeData.gasPrice ?? 3_000_000_000n;
  estDeployCost = (mockGas + auraGas) * price;
  console.log(`Est. deploy gas: mock ${mockGas}, AuraAgents ${auraGas} (total ${mockGas + auraGas})`);
  console.log(`Est. deploy cost at ${ethers.formatUnits(price, "gwei")} gwei: ${ethers.formatEther(estDeployCost)} tBNB`);
  console.log(`Plus funding ${ethers.formatEther(FUND_TOTAL)} tBNB to test wallets + mint/setAgents gas. Total needed: ~0.02 tBNB (one faucet claim of ~0.1 tBNB is plenty).`);
} catch (e) {
  console.log("Gas estimate failed (RPC may need a funded from-address):", e.message);
}

if (process.argv.includes("--estimate")) process.exit(0);

if (balance < MIN_BALANCE) {
  console.log("\n=== BLOCKED: testnet deployer needs tBNB ===");
  console.log(`1. Open ${FAUCET}`);
  console.log(`2. Paste this address: ${deployer.address}`);
  console.log(`3. Claim testnet BNB (faucet gives ~0.1 tBNB per claim; one claim is plenty).`);
  console.log("4. Re-run: node scripts/deploy-testnet.js");
  console.log("   (Key is saved in .env.testnet — never share it, never fund it with real BNB.)");
  console.log("   Verify the balance on-chain before re-running: the script reads it first.");
  process.exit(2);
}
// Dynamic safety: even at >= 0.02 tBNB, refuse if the estimate says the
// run itself (deploys + funding + a gas buffer) costs more than the balance.
const estTotal = estDeployCost + FUND_TOTAL + ethers.parseEther("0.002");
if (estDeployCost > 0n && balance < estTotal) {
  console.log(`\n=== BLOCKED: balance ${ethers.formatEther(balance)} tBNB is below the estimated run cost ${ethers.formatEther(estTotal)} tBNB at the current gas price ===`);
  console.log(`Top the deployer up at ${FAUCET} (address ${deployer.address}), then re-run.`);
  process.exit(2);
}

const tests = [];
function record(name, ok, detail) {
  tests.push({ name, ok, detail });
  console.log(`TEST ${name}: ${ok ? "OK" : "FAIL"}${detail ? " — " + detail : ""}`);
}

// 4 agent test wallets (A, B, C, D) + 1 plain wallet (never an agent).
const [agentA, agentB, agentC, agentD] = Array.from({ length: 4 }, () => ethers.Wallet.createRandom().connect(provider));
const plainWallet = ethers.Wallet.createRandom().connect(provider);
console.log("Agent test wallets:", [agentA, agentB, agentC, agentD].map((w) => w.address).join(" "));
console.log("Plain test wallet:", plainWallet.address);
// Persist test wallets IMMEDIATELY (lesson from the 2026-11-02 SIGMA crash).
fs.writeFileSync(
  WALLETS_FILE,
  JSON.stringify(
    {
      note: "TESTNET-ONLY throwaway wallets. Never use on mainnet, never fund with real BNB.",
      agents: { A: { address: agentA.address, privateKey: agentA.privateKey }, B: { address: agentB.address, privateKey: agentB.privateKey }, C: { address: agentC.address, privateKey: agentC.privateKey }, D: { address: agentD.address, privateKey: agentD.privateKey } },
      plain: { address: plainWallet.address, privateKey: plainWallet.privateKey },
    },
    null,
    2
  ),
  { mode: 0o600 }
);
console.log("Test wallets saved to test-wallets-testnet.json (before any deploy).");

console.log("\nDeploying AgentIdRegistryMock...");
const mock = await mockFactory.deploy(deployer.address);
await mock.waitForDeployment();
const mockAddr = await mock.getAddress();
const mockRc = await (await mock.deploymentTransaction().wait());
console.log("Mock deployed:", mockAddr, "tx", mock.deploymentTransaction().hash, "gas", mockRc.gasUsed.toString());

await (await mock.setAgents([agentA.address, agentB.address, agentC.address, agentD.address], true)).wait();
console.log("Mock: 4 agent wallets marked as Agent ID holders.");

console.log(`Deploying AuraAgents (owner = user wallet ${USER_WALLET}, TESTNET ONLY)...`);
const aura = await auraFactory.deploy(mockAddr, USER_WALLET);
await aura.waitForDeployment();
const auraAddr = await aura.getAddress();
const auraRc = await (await aura.deploymentTransaction().wait());
console.log("AuraAgents deployed:", auraAddr, "tx", aura.deploymentTransaction().hash, "gas", auraRc.gasUsed.toString());

// On-chain constants / owner check right after deploy
record("name/symbol", (await aura.name()) === "Aura Agents" && (await aura.symbol()) === "AURA", `${await aura.name()} / ${await aura.symbol()}`);
record(
  "constants + owner is user wallet",
  (await aura.MAX_SUPPLY()) === 8000n && (await aura.FREE_SUPPLY()) === 7200n && (await aura.PAID_SUPPLY()) === 800n && (await aura.PAID_PRICE()) === PAID_PRICE && (await aura.MAX_PER_WALLET()) === 10n && (await aura.FREE_PER_WALLET()) === 2n && (await aura.owner()) === USER_WALLET,
  `owner ${await aura.owner()}`
);
record(
  "totalSupply 0 / freeOpen true / paidOpen true (blended, no separate phase) / freeRemaining 7200 / paidRemaining 800",
  (await aura.totalSupply()) === 0n && (await aura.freeOpen()) === true && (await aura.paidOpen()) === true && (await aura.freeRemaining()) === 7200n && (await aura.paidRemaining()) === 800n,
  ""
);

// Fund test wallets
for (const [w, v] of [[agentA, FUND.agentA], [agentB, FUND.agentB], [agentC, FUND.agentC], [agentD, FUND.agentD], [plainWallet, FUND.plain]]) {
  await (await deployer.sendTransaction({ to: w.address, value: v })).wait();
}
console.log("Test wallets funded (total 0.014 tBNB).");

// --- Live test: quoteMint for a fresh wallet ---
{
  const [f, p, v] = await aura.quoteMint(agentB.address, 3);
  record("quoteMint fresh wallet mint(3) = 2 free + 1 paid, 0.0005", f === 2n && p === 1n && v === PAID_PRICE, `free ${f} paid ${p} value ${ethers.formatEther(v)}`);
  const [f10, p10, v10] = await aura.quoteMint(agentC.address, 10);
  record("quoteMint fresh wallet mint(10) = 2 free + 8 paid, 0.004", f10 === 2n && p10 === 8n && v10 === ethers.parseEther("0.004"), "");
}

// --- Live test 1: agent A mint(2) free, value 0 -> tokens #1-2 ---
const txA = await aura.connect(agentA).mint(2, { value: 0 });
const rcA = await txA.wait();
record("agent mint(2) free succeeds, tokens #1-2", (await aura.ownerOf(1)) === agentA.address && (await aura.ownerOf(2)) === agentA.address, `tx ${txA.hash} gas ${rcA.gasUsed}`);

// --- Live test 2: agent B mint(3) blended, exactly 0.0005 -> tokens #3-5 ---
const txB = await aura.connect(agentB).mint(3, { value: PAID_PRICE });
const rcB = await txB.wait();
record("agent mint(3) blended 0.0005 succeeds, tokens #3-5", (await aura.ownerOf(5)) === agentB.address && (await aura.mintedCount(agentB.address)) === 3n, `tx ${txB.hash} gas ${rcB.gasUsed}`);

// --- Live test 3: agent C mint(10), exactly 0.004 -> tokens #6-15 ---
const txC = await aura.connect(agentC).mint(10, { value: ethers.parseEther("0.004") });
const rcC = await txC.wait();
record("agent mint(10) 0.004 succeeds, tokens #6-15", (await aura.ownerOf(15)) === agentC.address && (await aura.mintedCount(agentC.address)) === 10n, `tx ${txC.hash} gas ${rcC.gasUsed}`);

// --- Live test 4: agent A second mint(2) is ALL-paid, 0.001 -> tokens #16-17 ---
const txA2 = await aura.connect(agentA).mint(2, { value: ethers.parseEther("0.001") });
const rcA2 = await txA2.wait();
record(
  "agent 2nd mint(2) all-paid 0.001 succeeds, tokens #16-17",
  (await aura.ownerOf(17)) === agentA.address && (await aura.freeMinted(agentA.address)) === 2n && (await aura.mintedCount(agentA.address)) === 4n,
  `tx ${txA2.hash} gas ${rcA2.gasUsed}`
);

// --- Live test 5: freeMint() wrapper for agent D ---
const txD1 = await aura.connect(agentD).freeMint({ value: 0 });
await txD1.wait();
record("freeMint() #1 free succeeds (token #18)", (await aura.ownerOf(18)) === agentD.address, `tx ${txD1.hash}`);
const txD2 = await aura.connect(agentD).freeMint({ value: 0 });
await txD2.wait();
record("freeMint() #2 free succeeds (token #19)", (await aura.freeMinted(agentD.address)) === 2n, `tx ${txD2.hash}`);
try {
  await (await aura.connect(agentD).freeMint({ value: 0 })).wait();
  record("freeMint() #3 value 0 reverts (free used)", false, "succeeded (BUG)");
} catch (e) {
  record("freeMint() #3 value 0 reverts (free used)", /wrong price/.test(e.message), String(e.message).slice(0, 100));
}
const txD3 = await aura.connect(agentD).freeMint({ value: PAID_PRICE });
await txD3.wait();
record("freeMint() #3 paid 0.0005 succeeds (token #20)", (await aura.mintedCount(agentD.address)) === 3n, `tx ${txD3.hash}`);

// --- Live test 6: non-agent mint reverts ---
try {
  await (await aura.connect(plainWallet).mint(1, { value: 0 })).wait();
  record("non-agent mint(1) reverts", false, "non-agent minted (BUG)");
} catch (e) {
  record("non-agent mint(1) reverts", /no Agent ID/.test(e.message), String(e.message).slice(0, 100));
}
try {
  await (await aura.connect(plainWallet).mint(3, { value: PAID_PRICE })).wait();
  record("non-agent mint(3) paid reverts", false, "non-agent minted (BUG)");
} catch (e) {
  record("non-agent mint(3) paid reverts", /no Agent ID/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 7: contract caller reverts (EOA only) ---
// MintCaller deployed on TESTNET ONLY for this test (see header note).
const caller = await callerFactory.deploy(auraAddr);
await caller.waitForDeployment();
const callerAddr = await caller.getAddress();
await (await mock.setAgent(callerAddr, true)).wait(); // even WITH an Agent ID, contract must fail
try {
  await (await caller.connect(deployer).callMint(1, { value: 0 })).wait();
  record("contract caller mint reverts (EOA only)", false, "contract minted (BUG)");
} catch (e) {
  record("contract caller mint reverts (EOA only)", /EOA only/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 8: qty bounds ---
try {
  await (await aura.connect(agentB).mint(0, { value: 0 })).wait();
  record("qty 0 reverts", false, "qty 0 succeeded (BUG)");
} catch (e) {
  record("qty 0 reverts", /qty 1\.\.10/.test(e.message), String(e.message).slice(0, 100));
}
try {
  await (await aura.connect(agentB).mint(11, { value: ethers.parseEther("0.005") })).wait();
  record("qty 11 reverts", false, "qty 11 succeeded (BUG)");
} catch (e) {
  record("qty 11 reverts", /qty 1\.\.10/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 9: wrong price reverts ---
// agentB holds 3, free used 2 -> mint(1) costs 0.0005; send 0.0004.
try {
  await (await aura.connect(agentB).mint(1, { value: ethers.parseEther("0.0004") })).wait();
  record("wrong price reverts", false, "wrong price succeeded (BUG)");
} catch (e) {
  record("wrong price reverts", /wrong price/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 10: 10/wallet cap (agent C already holds 10) ---
try {
  await (await aura.connect(agentC).mint(1, { value: PAID_PRICE })).wait();
  record("mint past 10/wallet reverts", false, "cap exceeded (BUG)");
} catch (e) {
  record("mint past 10/wallet reverts", /max 10 per wallet/.test(e.message), String(e.message).slice(0, 100));
}

// --- Live test 11: per-variant tokenURI (baseURI still empty on testnet) ---
record("tokenURI(1) = variant 1 (baseURI empty)", (await aura.tokenURI(1)) === "1", await aura.tokenURI(1));
record("tokenURI(16) = variant 16", (await aura.tokenURI(16)) === "16", await aura.tokenURI(16));
record("tokenURI(17) = variant 1 (wraps)", (await aura.tokenURI(17)) === "1", await aura.tokenURI(17));
try {
  await aura.tokenURI(21);
  record("tokenURI(21) reverts (not minted)", false, "returned a URI (BUG)");
} catch (e) {
  record("tokenURI(21) reverts (not minted)", true, String(e.shortMessage || e.message).slice(0, 100));
}

// --- On-chain reads ---
const reads = {
  owner: await aura.owner(),
  totalSupply: (await aura.totalSupply()).toString(),
  freeMintedCount: (await aura.freeMintedCount()).toString(),
  freeRemaining: (await aura.freeRemaining()).toString(),
  paidMinted: (await aura.paidMinted()).toString(),
  paidRemaining: (await aura.paidRemaining()).toString(),
  freeOpen: await aura.freeOpen(),
  paidOpen: await aura.paidOpen(),
  royalty: await aura.royaltyInfo(1, ethers.parseEther("1")),
};
console.log("\nOn-chain reads:", JSON.stringify({ ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] }, null, 2));
record(
  "on-chain reads correct (totalSupply 20, free 8, paid 12, freeRemaining 7192, paidRemaining 788)",
  reads.totalSupply === "20" && reads.freeMintedCount === "8" && reads.paidMinted === "12" && reads.freeRemaining === "7192" && reads.paidRemaining === "788",
  ""
);
record("royaltyInfo 5% to owner (user wallet)", reads.royalty[1] === ethers.parseEther("0.05") && reads.royalty[0] === USER_WALLET, `receiver ${reads.royalty[0]} amount ${ethers.formatEther(reads.royalty[1])} tBNB on 1 tBNB sale`);

// --- Withdraw / setBaseURI: owner is the USER wallet, deployer is NOT owner ---
// Live withdraw by the deployer must revert (onlyOwner). The owner
// withdraw itself is proven locally (Anvil suite) and cannot be signed
// live without the user wallet. Contract balance after the live tests
// should be 0.0005 + 0.004 + 0.001 + 0.0005 = 0.006 tBNB, held for the owner.
const contractBal = await provider.send("eth_getBalance", [auraAddr, "latest"]);
record("contract holds paid tBNB 0.006 for owner", BigInt(contractBal) === ethers.parseEther("0.006"), `${ethers.formatEther(contractBal)} tBNB`);
try {
  await (await aura.connect(deployer).withdraw()).wait();
  record("non-owner (deployer) withdraw reverts", false, "withdraw succeeded (BUG)");
} catch (e) {
  record("non-owner (deployer) withdraw reverts", /OwnableUnauthorizedAccount/.test(e.message), String(e.message).slice(0, 120));
}
try {
  await (await aura.connect(deployer).setBaseURI("https://example.invalid/metadata/")).wait();
  record("non-owner (deployer) setBaseURI reverts", false, "setBaseURI succeeded (BUG)");
} catch (e) {
  record("non-owner (deployer) setBaseURI reverts", /OwnableUnauthorizedAccount/.test(e.message), String(e.message).slice(0, 120));
}
record("tokenURI baseURI empty on testnet (owner setBaseURI pending user wallet)", (await aura.tokenURI(1)) === "1", "setBaseURI needs the user wallet to sign; NOT attempted from the deployer");

const deployment = {
  network: "BSC testnet",
  chainId: CHAIN_ID,
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  mockRegistry: mockAddr,
  mockDeployTx: mock.deploymentTransaction().hash,
  mockDeployGas: mockRc.gasUsed.toString(),
  auraAgents: auraAddr,
  auraAgentsDeployTx: aura.deploymentTransaction().hash,
  auraAgentsDeployGas: auraRc.gasUsed.toString(),
  mintCallerTestHelper: callerAddr,
  owner: USER_WALLET,
  agentTestWallets: { A: agentA.address, B: agentB.address, C: agentC.address, D: agentD.address },
  plainTestWallet: plainWallet.address,
  freeMintsUsedLive: 8,
  paidMintsUsedLive: 12,
  totalSupplyAfterTests: 20,
  contractBalanceAfterTestsTBNB: ethers.formatEther(contractBal),
  onChainReads: { ...reads, royalty: [reads.royalty[0], reads.royalty[1].toString()] },
  tokenURI: "per-variant: tokenURI(tokenId) = baseURI + ((tokenId-1) % 16 + 1); baseURI empty on testnet (owner-only setBaseURI pending user wallet)",
  note: "TESTNET ONLY — SUPERSEDED contract, never point minters at it. Private keys are in .env.testnet / test-wallets-testnet.json (throwaway wallets). Never use on mainnet. Owner is the user wallet, so withdraw/setBaseURI need the user wallet to sign.",
};
fs.writeFileSync(DEPLOY_FILE, JSON.stringify(deployment, null, 2));
fs.writeFileSync(TESTS_FILE, JSON.stringify({ network: "BSC testnet", chainId: CHAIN_ID, at: new Date().toISOString(), tests }, null, 2));
console.log("\nSaved:", DEPLOY_FILE, "and", TESTS_FILE);
console.log("Verify on BscScan testnet: https://testnet.bscscan.com/address/" + auraAddr);
const failed = tests.filter((t) => !t.ok);
if (failed.length) {
  console.log(`\n${failed.length} LIVE TEST(S) FAILED — do not proceed to mainnet.`);
  process.exit(1);
}
console.log(`\nAll ${tests.length} live tests passed.`);
