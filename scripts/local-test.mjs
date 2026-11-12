// Local dry-run: full test suite against a local Anvil chain (Cancun).
// No faucet, no real funds, no network. Proves the blended mint logic
// and measures real deployment + mint gas before any testnet spend.
// Anvil binary lives in tools/anvil (Foundry nightly, Cancun by default).
// Usage: node scripts/local-test.mjs
// Writes test-results.json.
//
// BLENDED MODEL (differs from NFOX/AKEY): single mint(qty), first 2 per
// wallet FREE, every extra in the same tx paid 0.0005 BNB. No separate
// paid phase — paidOpen() is true from the start (paid left > 0).
// Free exhaustion is proven FOR REAL: 3,596 fresh agent wallets x
// mint(2) = 7,192 free, taking the global free count from 8 to 7,200.
// Paid cap is proven FOR REAL: fresh agent wallets fill the remaining
// paid (78 x 10 + 1 x 2, after 18 paid used in early tests) to exactly 800.
import { spawn } from "node:child_process";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (n) => JSON.parse(fs.readFileSync(path.join(root, "build", `${n}.json`), "utf8"));
const ANVIL = path.join(root, "tools", "anvil");
const PORT = 8547;

const PRICE = "0.0005";
const results = { network: "anvil-local (dry run)", startedAt: new Date().toISOString(), tests: [] };
function check(name, ok, detail = "") {
  results.tests.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const anvil = spawn(ANVIL, ["--port", String(PORT), "--silent"], { stdio: "ignore" });
const fetchReq = new ethers.FetchRequest(`http://127.0.0.1:${PORT}`);
fetchReq.timeout = 60000;
const provider = new ethers.JsonRpcProvider(fetchReq);
const log = (m) => process.stderr.write(m + "\n");

async function expectRevert(promiseFn, label) {
  try {
    await (await promiseFn()).wait();
    check(label, false, "call succeeded — BUG");
  } catch (e) {
    check(label, true, String(e.shortMessage || e.message).slice(0, 100));
  }
}

// View calls return a value, not a tx — a separate helper so a
// non-reverting view cannot pass by throwing on a missing .wait().
async function expectViewRevert(promiseFn, label) {
  try {
    await promiseFn();
    check(label, false, "call succeeded — BUG");
  } catch (e) {
    check(label, true, String(e.shortMessage || e.message).slice(0, 100));
  }
}

try {
  for (let i = 0; i < 50; i++) {
    try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  await provider.getBlockNumber();

  const [deployer, agent, plain] = await Promise.all([0, 1, 2].map((i) => provider.getSigner(i)));
  const deployerAddr = await deployer.getAddress();
  const agentAddr = await agent.getAddress();
  const plainAddr = await plain.getAddress();

  const mockArt = load("AgentIdRegistryMock");
  const auraArt = load("AuraAgents");
  const callerArt = load("MintCaller");

  const mock = await new ethers.ContractFactory(mockArt.abi, mockArt.bytecode, deployer).deploy(deployerAddr);
  await mock.waitForDeployment();
  const mockRc = await (await mock.deploymentTransaction().wait());
  check("mock registry deploys", true, `gas ${mockRc.gasUsed}`);

  const aura = await new ethers.ContractFactory(auraArt.abi, auraArt.bytecode, deployer).deploy(await mock.getAddress(), deployerAddr);
  await aura.waitForDeployment();
  const auraRc = await (await aura.deploymentTransaction().wait());
  const auraAddr = await aura.getAddress();
  results.deployment = {
    mockAddress: await mock.getAddress(), mockDeployGas: mockRc.gasUsed.toString(),
    auraAddress: auraAddr, auraDeployGas: auraRc.gasUsed.toString(),
  };
  check("AuraAgents deploys", true, `gas ${auraRc.gasUsed} (local addr ${auraAddr})`);

  check("name/symbol", (await aura.name()) === "Aura Agents" && (await aura.symbol()) === "AURA");
  check("constants", (await aura.MAX_SUPPLY()) === 8000n && (await aura.FREE_SUPPLY()) === 7200n && (await aura.PAID_SUPPLY()) === 800n && (await aura.PAID_PRICE()) === ethers.parseEther(PRICE) && (await aura.MAX_PER_WALLET()) === 10n && (await aura.FREE_PER_WALLET()) === 2n);
  check("totalSupply starts 0", (await aura.totalSupply()) === 0n);
  check("freeRemaining 7200 / paidRemaining 800 at start", (await aura.freeRemaining()) === 7200n && (await aura.paidRemaining()) === 800n);
  check("freeOpen true at start", await aura.freeOpen());
  check("paidOpen true at start (blended: no separate paid phase)", await aura.paidOpen());
  check("owner is deployer", (await aura.owner()) === deployerAddr);
  check("registry is mock", (await aura.agentIdRegistry()) === (await mock.getAddress()));

  // quoteMint for a fresh wallet
  {
    const [f, p, v] = await aura.quoteMint(agentAddr, 3);
    check("quoteMint fresh wallet mint(3) = 2 free + 1 paid, 0.0005", f === 2n && p === 1n && v === ethers.parseEther(PRICE), `free ${f} paid ${p} value ${ethers.formatEther(v)}`);
    const [f10, p10, v10] = await aura.quoteMint(agentAddr, 10);
    check("quoteMint fresh wallet mint(10) = 2 free + 8 paid, 0.004", f10 === 2n && p10 === 8n && v10 === ethers.parseEther("0.004"));
  }

  // Non-agent mint must revert (registry check on ALL mints)
  check("plain wallet has no Agent ID", (await mock.balanceOf(plainAddr)) === 0n);
  await expectRevert(() => aura.connect(plain).mint(1, { value: 0 }), "non-agent mint(1) reverts");
  await expectRevert(() => aura.connect(plain).mint(3, { value: ethers.parseEther(PRICE) }), "non-agent mint(3) paid reverts");

  // EOA-only: a contract calling mint() must revert
  const caller = await new ethers.ContractFactory(callerArt.abi, callerArt.bytecode, deployer).deploy(auraAddr);
  await caller.waitForDeployment();
  await (await mock.setAgent(await caller.getAddress(), true)).wait(); // even WITH an Agent ID, contract must fail
  await expectRevert(() => caller.connect(deployer).callMint(1, { value: 0 }), "contract caller mint reverts (EOA only)");

  // Qty bounds
  await (await mock.setAgent(agentAddr, true)).wait();
  await expectRevert(() => aura.connect(agent).mint(0, { value: 0 }), "qty 0 reverts");
  await expectRevert(() => aura.connect(agent).mint(11, { value: ethers.parseEther("0.0045") }), "qty 11 reverts");

  // Fresh wallet mint(2) — entirely free, value 0
  const txA = await aura.connect(agent).mint(2, { value: 0 });
  const rcA = await txA.wait();
  results.mint2Free = { tx: txA.hash, gas: rcA.gasUsed.toString() };
  check("agent mint(2) free succeeds, tokens #1-2", (await aura.ownerOf(1)) === agentAddr && (await aura.ownerOf(2)) === agentAddr, `gas ${rcA.gasUsed}`);
  check("freeMinted(agent) = 2 after mint(2)", (await aura.freeMinted(agentAddr)) === 2n);
  check("mintedCount(agent) = 2", (await aura.mintedCount(agentAddr)) === 2n);
  check("freeMintedCount = 2", (await aura.freeMintedCount()) === 2n);

  // Second mint by same wallet is ALL paid: mint(3) costs 0.0015
  const txA2 = await aura.connect(agent).mint(3, { value: ethers.parseEther("0.0015") });
  const rcA2 = await txA2.wait();
  check("agent 2nd mint(3) all-paid 0.0015 succeeds", (await aura.totalSupply()) === 5n && (await aura.mintedCount(agentAddr)) === 5n, `gas ${rcA2.gasUsed}`);
  check("paidMinted = 3 after 2nd mint", (await aura.paidMinted()) === 3n);

  // Wrong price on an all-paid mint reverts
  await expectRevert(() => aura.connect(agent).mint(1, { value: ethers.parseEther("0.0004") }), "wrong-price mint reverts");
  await expectRevert(() => aura.connect(agent).mint(1, { value: 0 }), "free-value mint after free used reverts");

  // Fresh wallet B: mint(3) blended = 2 free + 1 paid, exactly 0.0005
  const walletB = await provider.getSigner(3);
  const walletBAddr = await walletB.getAddress();
  await (await mock.setAgent(walletBAddr, true)).wait();
  const txB = await aura.connect(walletB).mint(3, { value: ethers.parseEther(PRICE) });
  const rcB = await txB.wait();
  results.mint3Blended = { tx: txB.hash, gas: rcB.gasUsed.toString() };
  check("fresh wallet mint(3) blended 0.0005 succeeds", (await aura.mintedCount(walletBAddr)) === 3n, `gas ${rcB.gasUsed}`);
  check("paidMinted = 4 after blended mint(3)", (await aura.paidMinted()) === 4n);

  // Fresh wallet C: mint(10) = 2 free + 8 paid, exactly 0.004
  const walletC = await provider.getSigner(4);
  const walletCAddr = await walletC.getAddress();
  await (await mock.setAgent(walletCAddr, true)).wait();
  const txC = await aura.connect(walletC).mint(10, { value: ethers.parseEther("0.004") });
  const rcC = await txC.wait();
  results.mint10 = { tx: txC.hash, gas: rcC.gasUsed.toString() };
  check("fresh wallet mint(10) = 2 free + 8 paid, 0.004 succeeds", (await aura.mintedCount(walletCAddr)) === 10n, `gas ${rcC.gasUsed}`);
  check("paidMinted = 12 after mint(10)", (await aura.paidMinted()) === 12n);
  check("freeMintedCount = 6 after A+B+C", (await aura.freeMintedCount()) === 6n);

  // Wallet cap: C already holds 10, mint(1) must revert
  await expectRevert(() => aura.connect(walletC).mint(1, { value: ethers.parseEther(PRICE) }), "mint past 10/wallet reverts");
  // Agent holds 5; mint(6) would take it to 11 — reverts
  await expectRevert(() => aura.connect(agent).mint(6, { value: ethers.parseEther("0.003") }), "mint 6 when holding 5 reverts (cap 10)");
  // Agent mint(5) to exactly 10 succeeds (all paid, 0.0025)
  const txA3 = await aura.connect(agent).mint(5, { value: ethers.parseEther("0.0025") });
  await txA3.wait();
  check("agent mint(5) to exactly 10 succeeds", (await aura.mintedCount(agentAddr)) === 10n);
  check("paidMinted = 17", (await aura.paidMinted()) === 17n);

  // freeMint() wrapper: fresh wallet D — 1st + 2nd free, 3rd costs 0.0005
  const walletD = await provider.getSigner(5);
  const walletDAddr = await walletD.getAddress();
  await (await mock.setAgent(walletDAddr, true)).wait();
  await (await aura.connect(walletD).freeMint({ value: 0 })).wait();
  check("freeMint() #1 free succeeds", (await aura.freeMinted(walletDAddr)) === 1n);
  await (await aura.connect(walletD).freeMint({ value: 0 })).wait();
  check("freeMint() #2 free succeeds", (await aura.freeMinted(walletDAddr)) === 2n);
  await expectRevert(() => aura.connect(walletD).freeMint({ value: 0 }), "freeMint() #3 with value 0 reverts (free used)");
  const txD3 = await aura.connect(walletD).freeMint({ value: ethers.parseEther(PRICE) });
  await txD3.wait();
  check("freeMint() #3 paid 0.0005 succeeds (wrapper = mint(1))", (await aura.mintedCount(walletDAddr)) === 3n);
  await expectRevert(() => aura.connect(plain).freeMint({ value: 0 }), "non-agent freeMint() reverts");

  // ERC-2981 royalties: 5% to the owner on a 1 BNB sale
  const [royReceiver, royAmount] = await aura.royaltyInfo(1, ethers.parseEther("1"));
  results.royalty = { receiver: royReceiver, amountWei: royAmount.toString() };
  check("royaltyInfo 5% to owner", royReceiver === deployerAddr && royAmount === ethers.parseEther("0.05"), `receiver ${royReceiver}, amount ${ethers.formatEther(royAmount)} BNB on 1 BNB sale`);
  check("supportsInterface ERC2981", await aura.supportsInterface("0x2a55205a"));

  // setBaseURI: non-owner reverts, owner succeeds, tokenURI reflects it
  await expectRevert(() => aura.connect(agent).setBaseURI("https://example.invalid/metadata/"), "non-owner setBaseURI reverts");
  const txBase = await aura.connect(deployer).setBaseURI("https://example.invalid/metadata/");
  const rcBase = await txBase.wait();
  results.setBaseURI = { tx: txBase.hash, gas: rcBase.gasUsed.toString() };
  check("owner setBaseURI succeeds", rcBase.status === 1, `gas ${rcBase.gasUsed}`);
  // Per-VARIANT tokenURI (file-count reduction 2026-11-02): tokenURI =
  // baseURI + variant, variant = (tokenId-1) % 16 + 1. Tokens #1-20 exist here.
  check("tokenURI(1) = baseURI + variant 1", (await aura.tokenURI(1)) === "https://example.invalid/metadata/1");
  check("tokenURI(16) = baseURI + variant 16", (await aura.tokenURI(16)) === "https://example.invalid/metadata/16");
  check("tokenURI(17) = baseURI + variant 1 (wraps)", (await aura.tokenURI(17)) === "https://example.invalid/metadata/1");
  // Total minted so far: A 10 + B 3 + C 10 + D 3 = 26 (#1-26), so #27
  // is the first unminted token. (#21 DOES exist — it was minted by A
  // in the mint(5) batch; an earlier draft of this test wrongly used 21.)
  await expectViewRevert(() => aura.tokenURI(27), "tokenURI(27) reverts (not minted yet)");

  // --- Exhaust the FREE supply for real ---
  // Free used so far: A 2 + B 2 + C 2 + D 2 = 8. Remaining free:
  const freeLeft = Number(await aura.freeRemaining());
  const freeWalletsNeeded = freeLeft / 2;
  console.log(`Exhausting free supply: ${freeLeft} free left, ${freeWalletsNeeded} wallets x mint(2)...`);
  const t0 = Date.now();
  const BATCH = 100;
  const WORKERS = 20;
  for (let start = 0; start < freeWalletsNeeded; start += BATCH) {
    const n = Math.min(BATCH, freeWalletsNeeded - start);
    const wallets = Array.from({ length: n }, () => ethers.Wallet.createRandom().connect(provider));
    for (const w of wallets) await provider.send("anvil_setBalance", [w.address, "0x8ac7230489e80000"]);
    await (await mock.setAgents(wallets.map((w) => w.address), true)).wait();
    let next = 0;
    const mintOne = async (w) => {
      if ((await aura.freeMinted(w.address)) >= 2n) return;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const tx = await Promise.race([aura.connect(w).mint(2, { value: 0 }), new Promise((_, rej) => setTimeout(() => rej(new Error("send timeout")), 30000))]);
          await Promise.race([tx.wait(), new Promise((_, rej) => setTimeout(() => rej(new Error("wait timeout")), 30000))]);
          return;
        } catch (e) {
          log(`  free retry attempt ${attempt}: ${e.shortMessage || e.message}`);
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      throw new Error("free mint(2) failed 3x");
    };
    const workers = Array.from({ length: WORKERS }, async () => {
      while (next < wallets.length) { const j = next++; await mintOne(wallets[j]); }
    });
    await Promise.all(workers);
    console.log(`  ... ${start + n}/${freeWalletsNeeded} free wallets done (${((Date.now() - t0) / 1000).toFixed(0)}s, freeMintedCount=${await aura.freeMintedCount()})`);
  }
  check("free supply exhausted (7200/7200)", (await aura.freeMintedCount()) === 7200n, `took ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  check("freeOpen false after exhaustion", !(await aura.freeOpen()));
  check("freeRemaining 0 after exhaustion", (await aura.freeRemaining()) === 0n);
  check("paidOpen still true after free exhaustion", await aura.paidOpen());

  // After free exhaustion, a fresh agent's mint(1) is ALL paid
  const lateAgent = await provider.getSigner(6);
  const lateAgentAddr = await lateAgent.getAddress();
  await (await mock.setAgent(lateAgentAddr, true)).wait();
  await expectRevert(() => aura.connect(lateAgent).mint(1, { value: 0 }), "mint(1) value 0 after free exhaustion reverts");
  const [lf, lp, lv] = await aura.quoteMint(lateAgentAddr, 2);
  check("quoteMint after free exhaustion = 0 free + 2 paid", lf === 0n && lp === 2n && lv === ethers.parseEther("0.001"));

  // --- Fill the PAID supply for real ---
  const paidLeft = Number(await aura.paidRemaining());
  console.log(`Filling paid supply: ${paidLeft} paid left...`);
  const t1 = Date.now();
  const paidWallets = [];
  const fullTx = Math.floor(paidLeft / 10);
  const remainder = paidLeft % 10;
  for (let i = 0; i < fullTx + (remainder ? 1 : 0); i++) {
    const w = ethers.Wallet.createRandom().connect(provider);
    paidWallets.push(w);
    await provider.send("anvil_setBalance", [w.address, "0x8ac7230489e80000"]);
  }
  await (await mock.setAgents(paidWallets.map((w) => w.address), true)).wait();
  let pNext = 0;
  const paidOne = async (w, qty) => {
    if ((await aura.mintedCount(w.address)) > 0n) return;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tx = await Promise.race([aura.connect(w).mint(qty, { value: ethers.parseEther(PRICE) * BigInt(qty) }), new Promise((_, rej) => setTimeout(() => rej(new Error("send timeout")), 30000))]);
        await Promise.race([tx.wait(), new Promise((_, rej) => setTimeout(() => rej(new Error("wait timeout")), 30000))]);
        return;
      } catch (e) {
        log(`  paid retry attempt ${attempt}: ${e.shortMessage || e.message}`);
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    throw new Error("paid mint failed 3x");
  };
  const pWorkers = Array.from({ length: WORKERS }, async () => {
    while (pNext < paidWallets.length) {
      const j = pNext++;
      const qty = j < fullTx ? 10 : remainder;
      await paidOne(paidWallets[j], qty);
    }
  });
  await Promise.all(pWorkers);
  console.log(`  paid fill done in ${((Date.now() - t1) / 1000).toFixed(0)}s`);
  check("totalSupply reaches cap 8000", (await aura.totalSupply()) === 8000n, `in ${((Date.now() - t1) / 1000).toFixed(0)}s`);
  check("paidMinted = 800 at cap", (await aura.paidMinted()) === 800n);
  check("paidRemaining 0 at cap", (await aura.paidRemaining()) === 0n);
  check("paidOpen false at cap", !(await aura.paidOpen()));
  check("freeMintedCount still 7200 at cap", (await aura.freeMintedCount()) === 7200n);
  // Per-variant tokenURI at the cap: token #8000 is variant 16, #7999 variant 15.
  check("tokenURI(8000) = baseURI + variant 16", (await aura.tokenURI(8000)) === "https://example.invalid/metadata/16");
  check("tokenURI(7999) = baseURI + variant 15", (await aura.tokenURI(7999)) === "https://example.invalid/metadata/15");
  await expectViewRevert(() => aura.tokenURI(8001), "tokenURI(8001) reverts (above cap)");

  // One more mint must revert (exceeds max supply)
  const extra = await provider.getSigner(7);
  const extraAddr = await extra.getAddress();
  await (await mock.setAgent(extraAddr, true)).wait();
  await expectRevert(() => aura.connect(extra).mint(1, { value: ethers.parseEther(PRICE) }), "mint past cap 8000 reverts");

  // Withdraw: contract holds exactly 800 x 0.0005 = 0.4 BNB.
  // Balance read with RAW eth_getBalance + retries (NFOX M9 lesson).
  const expectedPaid = ethers.parseEther("0.4");
  const balBefore = await provider.send("eth_getBalance", [auraAddr, "latest"]);
  check("contract holds paid BNB 0.4", BigInt(balBefore) === expectedPaid, `${ethers.formatEther(balBefore)} BNB`);
  const txW = await aura.connect(deployer).withdraw();
  const rcW = await txW.wait();
  check("withdraw tx succeeds", rcW.status === 1, `gas ${rcW.gasUsed}`);
  let balAfter = null;
  for (let i = 0; i < 5; i++) {
    balAfter = BigInt(await provider.send("eth_getBalance", [auraAddr, "latest"]));
    if (balAfter === 0n) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  results.withdraw = { tx: txW.hash, gas: rcW.gasUsed.toString(), balanceAfter: balAfter.toString() };
  check("owner withdraw empties contract", balAfter === 0n, `${ethers.formatEther(balAfter ?? 0n)} BNB left`);

  // Non-owner withdraw must revert (onlyOwner check fires before balance check)
  await expectRevert(() => aura.connect(agent).withdraw(), "non-owner withdraw reverts");

  // Mainnet cost estimate from REAL measured gas (BSC ~0.05 gwei, BNB $700)
  const bnb = (gas) => ethers.formatEther(BigInt(gas) * 50_000_000n);
  const usd = (gas) => (parseFloat(bnb(gas)) * 700).toFixed(4);
  results.mainnetCostEstimate = {
    gasPriceAssumption: "0.05 gwei", bnbPriceAssumptionUsd: 700,
    auraDeployGas: auraRc.gasUsed.toString(),
    auraDeployBnb: bnb(auraRc.gasUsed), auraDeployUsd: usd(auraRc.gasUsed),
    mint2FreeGas: rcA.gasUsed.toString(), mint2FreeBnb: bnb(rcA.gasUsed), mint2FreeUsd: usd(rcA.gasUsed),
    mint3BlendedGas: rcB.gasUsed.toString(), mint3BlendedBnb: bnb(rcB.gasUsed), mint3BlendedUsd: usd(rcB.gasUsed),
    mint10Gas: rcC.gasUsed.toString(), mint10Bnb: bnb(rcC.gasUsed), mint10Usd: usd(rcC.gasUsed),
    withdrawGas: rcW.gasUsed.toString(), withdrawBnb: bnb(rcW.gasUsed), withdrawUsd: usd(rcW.gasUsed),
    setBaseURIGas: rcBase.gasUsed.toString(), setBaseURIBnb: bnb(rcBase.gasUsed), setBaseURIUsd: usd(rcBase.gasUsed),
    note: "Mock is local-only; mainnet uses the real registry, so mainnet deployment = AuraAgents deploy only (+ setBaseURI tx).",
  };
  console.log("\nMainnet cost estimate (0.05 gwei, BNB $700):");
  console.log(`  deploy AuraAgents: ${results.mainnetCostEstimate.auraDeployBnb} BNB (~$${results.mainnetCostEstimate.auraDeployUsd})`);
  console.log(`  mint(2) free (minter pays gas): ${results.mainnetCostEstimate.mint2FreeBnb} BNB (~$${results.mainnetCostEstimate.mint2FreeUsd})`);
  console.log(`  mint(10) (minter pays gas): ${results.mainnetCostEstimate.mint10Bnb} BNB (~$${results.mainnetCostEstimate.mint10Usd})`);

  results.finishedAt = new Date().toISOString();
  results.allPassed = results.tests.every((t) => t.ok);
  fs.writeFileSync(path.join(root, "test-results.json"), JSON.stringify(results, null, 2));
  console.log(`\n${results.tests.filter((t) => t.ok).length}/${results.tests.length} tests passed. Saved test-results.json`);
  if (!results.allPassed) process.exitCode = 1;
} finally {
  anvil.kill("SIGTERM");
}
