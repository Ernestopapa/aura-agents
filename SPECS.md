# Aura Agents — Specs (Gate 0)

Name LOCKED 2026-11-02 (parent chat, QUIRKZ model): Aura Agents
Symbol LOCKED: AURA
Theme LOCKED: 16 pixel aura / mood agents. NEW theme — do NOT copy QUIRKZ name or art.
Token (planned): none. No token is promised. No date, no price, no airdrop.

## Locked by user 2026-11-02

- Total supply: 8,000
- Free supply: 7,200 (90%)
- Paid supply: 800 (10%)
- Single BLENDED mint(qty) — no separate paid phase, no separate free phase:
  first 2 per wallet FREE, every extra in the SAME tx paid.
  - 2 free per wallet ever, max 10 per wallet total.
  - Fresh wallet: mint(2) costs 0 BNB; mint(3) costs 0.0005 BNB;
    mint(10) costs 0.004 BNB (2 free + 8 paid).
  - Wallet that already used its 2 free: every further mint is all-paid
    at 0.0005 BNB each, up to 10 total per wallet.
  - Free allowance is also capped by the global free supply (7,200):
    once 7,200 free mints are used across all wallets, every further
    mint is all-paid (subject to the 800 paid cap).
- Paid price LOCKED: $0.35, coded as 0.0005 BNB
  - Price math (BNB ~$700, user-supplied): $0.35 / $700 = 0.0005 BNB exactly.
  - 1 paid mint $0.35, 3 paid mints $1.05, 8 paid mints (mint(10) fresh) $2.80.
  - Max paid revenue: 800 x $0.35 = $280.00 (800 x 0.0005 = 0.4 BNB).
- Max per wallet: 10 total (free + paid). Max per tx: 10 (enforced by the
  per-wallet cap; a single tx cannot exceed what the wallet may hold).
- Agent ID required for ALL mints (free AND paid): registry balanceOf > 0.
  This is the NFOX playbook M1 gate — both paths check the registry.
  Paid is NOT open to everyone (unlike SEVEN SIGMA / Agent Key Pass).
- Royalties: 5% ERC-2981 to owner, same as NFOX / SIGMA / AKEY.
  Note: not guaranteed — some marketplaces ignore ERC-2981
  (Element displayed 0% for NFOX).
- EOA-only mint: `msg.sender == tx.origin`. Contracts / bots calling
  through another contract cannot mint. A minter's own AI agent wallet
  is an EOA, so normal agent minting still works.
- Transferable: ERC-721, NOT soulbound. Auras can be sold / transferred.
- Art model LOCKED: 16 pixel aura variants, 500 tokens each
  (8,000 / 16 = 500). Variant of token N is `(N - 1) % 16` (see Gate 3).
  Same image for every token of a variant. No traits/rarity beyond the
  16 real auras, no delayed reveal. The Agent ID gate is the value.
- Model: QUIRKZ (8,000 total, 7,200 free, 800 paid at $0.35,
  2 free / max 10, 746/800 paid sold). AURA copies the NUMBERS only,
  not QUIRKZ's name, art, or contract.

## Paid-revenue split — OFF-CHAIN distribution (Gate 0 decision)

Copied from QUIRKZ as an incentive, NOT as on-chain logic:
- 30% of paid revenue received → daily pot raffle
- 20% of paid revenue received → referral rewards
- ~50% → owner (max ~$140 if all 800 paid sell: 0.4 BNB x 50% = 0.2 BNB)
- The contract does NOT run a raffle or pay referrers on-chain:
  no randomness, no daily-pot accounting, no referrer parameter in v1.
  Adding those to an unaudited contract would be new attack surface
  for a $280 max pot. The contract exposes `paidMinted` and its BNB
  balance, so the split is auditable from actual revenue received.
- Distribution happens OFF-CHAIN from withdrawn BNB only, capped at
  money actually received. No return, payout, or raffle win is promised
  to any minter or holder. The site states this in plain language.
- QUIRKZ's on-chain mechanism was NOT verified (its contract is not
  open-source per the 2026-10-31 watch note); AURA does not claim to
  replicate any on-chain pot/referral code. If the user wants on-chain
  referral/pot logic, that is a v2 design decision before testnet.

## Owner powers (plain language)

- Owner: user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403 (neongred.ai).
- Owner CAN: withdraw all BNB, change metadata via setBaseURI(),
  transfer/renounce ownership.
- Owner CANNOT: change supply (8,000), free supply (7,200), paid supply
  (800), price (0.0005 BNB), max 10 per wallet, free 2 per wallet, or the
  Agent ID registry, and cannot mint extra Auras, pause, freeze, burn,
  or take holders' Auras.
- Contract is NOT audited by a third party. Say so on the site.
  "Built on OpenZeppelin" is not an audit.
- Registry: real Binance Agent ID registry
  0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F.
  Testnet/local: deploy AgentIdRegistryMock first and pass its address.

## Views (kept for radars / site, same names as NFOX where possible)

- `totalSupply()`, `freeMintedCount()` (global, 0..7200),
  `freeRemaining()`, `paidRemaining()`, `freeOpen()` (free left),
  `paidOpen()` (paid left — paid is open from the START for qty beyond
  a wallet's free allowance; there is no separate paid phase, so
  paidOpen does NOT wait for free exhaustion — this is a deliberate
  deviation from NFOX/AKEY, where paidOpen was false until free sold out),
  `freeMinted(address)` (per-wallet free count, 0..2),
  `mintedCount(address)` (per-wallet total, 0..10),
  `quoteMint(address, qty)` → (freeQty, paidQty, value) for the checker.
- `freeMint()` exists as a thin wrapper = `mint(1)` through the same
  blended logic (radar compatibility only; it is NOT a separate free path).

## Facts carried forward (do not re-learn — playbook M23)

- Radars find verified contracts in minutes; mints can start before
  any announcement. Supply size does not change deploy cost — deploy
  cost is code size; minters pay their own mint gas.
- GitHub and Vercel are optional only, not required for launch.
- baw cannot deploy a contract directly; testnet/mainnet deploy uses
  a fresh throwaway deployer, owner = user wallet.
- Never promise floor price, returns, APY, a dated token/airdrop,
  a game, or merch.

## Hosting (NOT decided — Gate 4 is local only)

- No hosting site created in Gates 0-4. Netlify handled 6,666 files
  for NFOX; Cloudflare Pages was chosen for AKEY to stay under
  1,000 files. After the 2026-11-02 file reduction the deploy package
  is only 34 files (18 site + 16 metadata), so it fits any drag-and-drop
  host. Hosting NOT decided; no site created.
  Gate 4 ships extensionless metadata only (see Gate 3 note).

## Gate 1 — COMPLETE 2026-11-02 (local only, no deploy, no BNB spent)
- Contract: `contracts/AuraAgents.sol` (9,709 bytes after the 2026-11-02
  per-variant tokenURI override, ABI 62 entries),
  mock `contracts/AgentIdRegistryMock.sol`, test helper
  `contracts/MintCaller.sol` (local only, proves EOA-only gate).
- Stack: Solidity ^0.8.26, OpenZeppelin v5.6.1, Cancun, optimizer 200.
- Compile: `npm run compile` — clean. Deploy gas (local) 2,080,374
  (was 2,071,946 before the tokenURI override, +8,428).
- Per-VARIANT tokenURI (file-count reduction, 2026-11-02, user: "reduce
  anything that will increase the files"): tokenURI(tokenId) =
  baseURI + variant, variant = (tokenId-1) % 16 + 1 (1..16). All 500
  tokens of a variant share ONE metadata file (metadata/1..16). No
  per-token traits ever existed, so per-token files carried no
  information. Override is view-only (Strings.toString + _requireOwned,
  no state, no external calls) — no new Slither/Aderyn finding class,
  so scans were NOT re-run (Gate 2 results stand).
- Local tests: `npm run test:local` (Anvil) — **67/67 passed**,
  `allPassed: true`, results in `test-results.json`. Free supply
  exhausted FOR REAL (3,596 wallets x mint(2), 7,200/7,200) and paid
  cap filled FOR REAL (78 x mint(10) + 1 x mint(2), 800/800,
  totalSupply 8,000, contract held exactly 0.4 BNB, withdraw emptied
  it, gas 32,137). Blended pricing proven: mint(2) free 0 BNB,
  mint(3) 0.0005, mint(10) 0.004, 2nd mint all-paid, wallet cap 10,
  non-agent + contract-caller reverts, wrong price reverts,
  royaltyInfo 5%, quoteMint exact. tokenURI proven: (1)="1", (16)="16",
  (17)="1" (wraps), (7999)="15", (8000)="16", (27) and (8001) revert
  (nonexistent). Test-harness lesson (not a contract
  bug): Anvil returns a stale `pending` nonce for raw Wallet signers
  on their 2nd tx — multi-tx wallets use Anvil signer accounts instead.
  Second test-harness lesson, same run: the first 67-test run was 66/67 —
  tokenURI(21) "failed" because token #21 DOES exist (minted by wallet A
  in the mint(5) batch; totalSupply was 26, not 20). Test fixed to
  tokenURI(27); contract was correct throughout (tokenURI(8001) reverted
  in the same run).
- Mainnet cost estimate (0.05 gwei, BNB $700): deploy 0.0001040 BNB
  (~$0.07); mint(2) free ~$0.006; mint(10) ~$0.013.
## Gate 2 — COMPLETE 2026-11-02 (scans/SUMMARY.md)
- Slither 0.11.6: 69 results, 64 OpenZeppelin internals, 5 low/info in
  AuraAgents.sol (reentrancy-no-eth mint, reentrancy-events withdraw,
  low-level-call withdraw, costly-loop, solc-version) — all mitigated /
  intentional, no real vulnerability.
- Aderyn 0.6.8: issue_count {high: 2, low: 7}. Highs: reentrancy-
  state-change in mint()/freeMint() = documented FALSE POSITIVE
  (same as SIGMA/AKEY — state changes are all BEFORE _safeMint,
  both functions nonReentrant); contract-locks-ether in MintCaller.sol
  = test helper only, never deployed. Lows: centralization-risk,
  costly-loop, PUSH0, require-revert-in-loop, state-change-without-
  event, unspecific-pragma, unused-public-function — all known /
  intentional (public views are the radar/site API).
## Gate 3 — COMPLETE 2026-11-02, REDUCED same day (16 files, not 8,000)
- Art: 16 original pixel aura spirits, generated by
  `art/generate-art.py` (32x32 grid, deterministic seeds): Ember,
  Tide, Bloom, Volt, Frost, Shadow, Solar, Moss, Nova, Mist, Coral,
  Abyss, Honey, Jade, Crimson, Lunar. Variant of token N = (N-1) % 16 + 1.
- IPFS: uploaded to Pinata (custom.pinata, auth 200), 16 files,
  folder CID `bafybeibz3yd5p4euwfyjgpp423msz4dua4dlj5ycknrvy5t5fxsb44vqsa`,
  size 25,591 bytes. Gateway 200:
  gateway.pinata.cloud/ipfs/<CID>/aura-01.png.
  Image per token: ipfs://<CID>/aura-NN.png (NN = 01..16).
- Metadata (REDUCED 2026-11-02, user: "reduce anything that will
  increase the files"): `scripts/generate-metadata.mjs --cid <CID>` now
  writes ONLY 16 files (1..16, extensionless, one per variant; name
  "Aura Agents — <Aura> Aura", attributes Aura/Mood/Variant/Tokens
  sharing this variant 500). tokenURI(tokenId) = baseURI + variant, so
  all 500 tokens of a variant resolve to the same file. The 8,000
  per-token files (metadata/17..8000) were DELETED (regenerable from the
  script + CID; the v1 zip keeps them as an archive), and the duplicate
  staging copy ipfs-upload/ (16 PNGs duplicating art/) was deleted.
  metadata/ is now 16 files, 64K (was 8,000 files, 32M). Grep
  REPLACE_WITH_CID/TODO/PLACEHOLDER = 0. No Free/Paid per-id trait
  (free vs paid is per-wallet, not per-id — inventing one would be
  false data). No .json duplicates.
## Gate 4 — COMPLETE 2026-11-02 (local only, no hosting created)
- Site: `site/index.html` + `site/llms.txt` + 16 aura PNGs.
  Paste-address checker is the main flow (Agent ID via real mainnet
  registry); copy-paste agent prompt + llms.txt; browser mint collapsed
  and disabled (no contract yet); 16-aura gallery is the real art;
  pot/referral stated as off-chain from actual revenue; NOT audited;
  owner powers in plain language; no placeholder handles/links;
  no floor/returns/APY/token/airdrop/game/merch promises.
- Local HTTP check: homepage 200, /metadata/1 200, /metadata/16 200,
  /llms.txt 200, /aura-01.png 200 (see GATE-REPORT.md).
  /metadata/1.json is intentionally 404 — extensionless only (Gate 3).
  (Before the 2026-11-02 reduction the check also covered /metadata/8000;
  that URL no longer exists — token #8000 resolves to /metadata/16.)
- Package: `site-deploy-v2-2026-11-02-16-metadata-files.zip`, 34 files
  (18 site + 16 metadata), 152K staging. v1
  (`site-deploy-v1-2026-11-02-aura-agents.zip`, 8,018 files, 6.26 MB)
  is kept as an archive only. Hosting NOT decided: 34 files fits any
  drag-and-drop host (Netlify handled 6,666 for NFOX; Cloudflare Pages
  was chosen for AKEY to stay under 1,000); no site created in Gates 0-4.
## Gate 5 — COMPLETE 2026-11-02 (testnet deployed ~16:36 GMT, live tests 30/30,
Sourcify exact_match 58101142, BscScan testnet VERIFIED Exact Match via manual form
~16:46 GMT; testnet contract 0x3F59f5c912d23BA588cA11F108Cbe2439342d260, TESTNET ONLY,
superseded — see GATE-REPORT.md). setBaseURI on testnet SKIPPED by the user,
deferred to mainnet.
## Gate 6 — MAINNET DEPLOYED 2026-11-02 ~17:19 GMT (see GATE-REPORT.md "MAINNET
DEPLOYED" section): contract 0xacc6e2F1aaE42B2E5FF2758Ff078E4B1bfAc7DB1, deploy tx
0xdb9952622d783182c4084c71ee6a0bd73831f6877d0280c05c2ea18a82048f3a, gas 2,080,374,
block 131279735, post-deploy checks 9/9 OK, leftover 0.0008949313 BNB returned
tx 0xce5b167e823b73ce24abad727c1998461b659ad5795beb320288a97651be483e, deployer now
0.0 BNB. Sourcify mainnet VERIFIED exact_match matchId 58105492. BscScan mainnet
PENDING (API failed x2, manual form needs live browser). Site v4
site-deploy-v4-2026-11-02-mainnet.zip (34 files). setBaseURI PENDING — owner-only,
user wallet signs with preview + confirm.
## Gates 7-8 — NOT STARTED (launch/discoverability — hosting + launch post)
