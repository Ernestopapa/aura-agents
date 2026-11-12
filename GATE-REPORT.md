# Aura Agents (AURA) — Gates 0–4 Report

Date: 2026-11-02. Workspace: `~/workspace/aura-agents/`.
Status: **Gates 0–4 COMPLETE. No testnet, no mainnet, no BNB spent,
no hosting created, no X login.** Testnet/mainnet need the user's
explicit go-ahead in this chat.

## FILE REDUCTION — 2026-11-02 ~16:00 GMT (user: "reduce anything that will increase the files")

Before / after (verified by count, not estimate):
| Location | Before | After | Change |
|---|---|---|---|
| metadata/ | 8,000 files, 32 MB | 16 files, 64 KB | −7,984 files, per-token files DELETED |
| ipfs-upload/ (staging dup of art/) | 16 PNGs | deleted | duplicate staging copy removed |
| site-deploy/ (extracted v1 package) | 8,018 files, 32 MB | 34 files, 152 KB | rebuilt for v2 |
| Deploy zip | v1 8,018 files, 6.26 MB | v2 34 files, 43 KB | new versioned name, v1 zip kept as archive |
| Workspace total (excl. node_modules) | 16,143 files | ~150 files | −~16,000 files |

How: `tokenURI(tokenId)` override in AuraAgents.sol now returns
baseURI + variant, variant = (tokenId-1) % 16 + 1 (1..16). All 500 tokens
of a variant share ONE metadata file (metadata/1..16, name
"Aura Agents — <Aura> Aura", attributes Aura/Mood/Variant/Tokens sharing
this variant 500). No per-token traits ever existed, so the 8,000
per-token files carried no information. `scripts/generate-metadata.mjs`
now generates 16 files. Site + llms.txt reference /metadata/<variant>
(1..16), not /metadata/<tokenId>. 16 aura PNGs unchanged on IPFS
(CID bafybeibz3yd5p4euwfyjgpp423msz4dua4dlj5ycknrvy5t5fxsb44vqsa).
Deleted files are regenerable (script + CID); the v1 zip is the archive.
Scans NOT re-run: the override is view-only (Strings.toString +
_requireOwned, no state, no external calls) — no new finding class;
Gate 2 results stand.

Re-test after the change: **67/67 passed, allPassed true**
(test-results.json). First 67-test run was 66/67 — tokenURI(21) "failed"
because token #21 DOES exist (minted by wallet A in the mint(5) batch;
totalSupply was 26, not 20). TEST bug, not a contract bug; fixed to
tokenURI(27). Contract was correct throughout (tokenURI(8001) reverted
in the same run). tokenURI proven: (1)="1", (16)="16", (17)="1" (wraps),
(7999)="15", (8000)="16", (27)/(8001) revert. Deploy gas 2,080,374
(was 2,071,946, +8,428); mint/withdraw gas unchanged.

## Gate 0 — Locked specs (SPECS.md)

- Aura Agents, AURA, 8,000 total = 7,200 free (90%) + 800 paid (10%).
- Blended `mint(qty)`: first 2/wallet FREE, every extra same-tx paid.
  Max 10/wallet. Agent ID required for ALL mints. EOA-only.
- Price: $0.35 / $700 BNB = **0.0005 BNB** exactly.
  Max paid revenue: 800 × $0.35 = **$280.00 (0.4 BNB)**.
  Split: 30% pot raffle / 20% referral / ~50% owner (~$140 max).
- Royalties 5% ERC-2981. Transferable ERC-721, not soulbound.
- Owner = user wallet 0x75d251Ba39dED2E456d9f6DD776f77d422864403.
  Owner CAN withdraw/setBaseURI/transfer ownership; CANNOT change
  supply/free/price/max/registry or mint/pause/freeze/burn/take.
- Not audited by a third party. No floor/returns/APY/token/airdrop/
  game/merch promises.

## Gate 1 — Contract + local tests: 60/60 PASSED

- `contracts/AuraAgents.sol` — Solidity ^0.8.26, OZ 5.6.1, Cancun,
  optimizer 200. Compiled clean: 9,670 bytes, ABI 62 entries.
- `npm run test:local` (Anvil) — **67/67 passed, allPassed true**
  (`test-results.json`), after the 2026-11-02 per-variant tokenURI change
  (was 60/60 before the change; +7 tokenURI tests).
- Free supply exhausted FOR REAL: 3,596 wallets × mint(2) = 7,200/7,200.
  Paid cap filled FOR REAL: 78 × mint(10) + 1 × mint(2) = 800/800,
  totalSupply 8,000, contract held exactly 0.4 BNB, owner withdraw
  emptied it (gas 32,137, raw eth_getBalance per M9).
- Blended pricing proven: mint(2) free 0 BNB; mint(3) 0.0005;
  mint(10) 0.004; 2nd mint all-paid; wallet cap 10 enforced;
  non-agent mint reverts "no Agent ID"; contract caller reverts
  "EOA only"; qty 0/11 revert; wrong price reverts; royaltyInfo 5%
  to owner; quoteMint exact; freeMint() wrapper = mint(1).
- Gas (local): deploy 2,080,374; mint(2) 181,231; mint(3) 194,016;
  mint(10) 383,555; withdraw 32,137; setBaseURI 91,541.
  Mainnet estimate (0.05 gwei, BNB $700): deploy ~0.000104 BNB (~$0.07).
- Test-harness lesson (NOT a contract bug): Anvil returns a stale
  `pending` nonce for raw `Wallet` signers on their 2nd tx (repro
  proven). Multi-tx wallets in the suite use Anvil signer accounts.

## Gate 2 — Scans: no real vulnerability (scans/SUMMARY.md)

- Slither 0.11.6: 69 results, 64 OpenZeppelin internals, 5 low/info
  in AuraAgents.sol — all mitigated/intentional.
- Aderyn 0.6.8: issue_count {high: 2, low: 7}. Highs: reentrancy-
  state-change = documented FALSE POSITIVE (same as SIGMA/AKEY —
  state changes all BEFORE _safeMint, nonReentrant); contract-locks-
  ether in MintCaller.sol = local test helper only, never deployed.
  Lows all known/intentional.

## Gate 3 — Art + metadata

- 16 original pixel aura spirits (`art/generate-art.py`, deterministic):
  Ember, Tide, Bloom, Volt, Frost, Shadow, Solar, Moss, Nova, Mist,
  Coral, Abyss, Honey, Jade, Crimson, Lunar. Variant = (N−1) % 16.
- IPFS via Pinata (auth 200): folder CID
  `bafybeibz3yd5p4euwfyjgpp423msz4dua4dlj5ycknrvy5t5fxsb44vqsa`,
  16 files, 25,591 bytes. Gateway 200 for aura-01.png
  (gateway.pinata.cloud; ipfs.io returned 403 for aura-16.png —
  gateway-specific, Pinata gateway is the verified one and the one
  the site links to).
  Image: `ipfs://<CID>/aura-NN.png`.
- Metadata: 16 extensionless files (1..16, one per variant — REDUCED
  2026-11-02 from 8,000 per-token files, see reduction section above),
  `grep REPLACE_WITH_CID/TODO/PLACEHOLDER` = 0. Variant mapping
  spot-checked (#1 Ember, #16 Lunar, #17 Ember, #8000 Lunar).
  No Free/Paid per-id trait (free vs paid is per-wallet, not per-id).
  No .json duplicates — 16,000 files would exceed any drag-and-drop
  host; tokenURI appends only the id.

## Gate 4 — Local site

- `site/index.html` + `site/llms.txt` + 16 aura PNGs. Paste-address
  checker is the main flow; copy-paste agent prompt; browser mint
  collapsed + disabled; "NOT DEPLOYED YET" stated 4× on the page;
  16-aura gallery is the real art; pot/referral stated as off-chain
  from actual revenue; NOT audited; owner powers in plain language;
  no placeholder handles/links (the one grep hit is the HTML input
  `placeholder` attribute); no console errors (0 `console.` calls);
  zero QUIRKZ/NFOX name or art in the site or contract (only
  model-attribution code comments).
- Local HTTP (python http.server, port 8903, v2 staging): `/` 200,
  `/metadata/1` 200, `/metadata/16` 200, `/metadata/17` 404 (correct —
  only variants 1..16 exist now), `/llms.txt` 200, `/aura-01.png` 200,
  `/aura-16.png` 200. `/metadata/1` = "Aura Agents — Ember Aura",
  `/metadata/16` = "Aura Agents — Lunar Aura", both with the IPFS image.
  `/metadata/1.json` 404 — intentional, extensionless-only (Gate 3).
  (v1 check on port 8901 also had /metadata/4000 and /metadata/8000 200;
  those URLs no longer exist after the reduction — token #8000 resolves
  to /metadata/16.)
- Package: `site-deploy-v2-2026-11-02-16-metadata-files.zip`, 34 files
  (18 site + 16 metadata), 43 KB, zip integrity OK. v1 (8,018 files,
  6.26 MB) kept as an archive only.

## Gate 5 — TESTNET COMPLETE 2026-11-02 ~16:36 GMT (Sourcify verified; BscScan verified Exact Match via manual form ~16:46 GMT — see Mainnet prep section)

- Deployer (fresh throwaway, .env.testnet chmod 600): 0x03414bc66B3D98C573a6d39c75D7Daa826bD5a98. Faucet claim landed 0.026 tBNB (verified on 2 RPC seeds before deploy); leftover after the run 0.0117214932 tBNB (re-checked on-chain).
- Mock registry: 0x7426B22C8546DB11b71C71bfc825C72946AAe602, deploy tx 0x0d068581dd7d16fae0afb6e91f502daf5b5f17e2e8cfd2a089de56c54080b918, gas 308,419.
- AuraAgents TESTNET: 0x3F59f5c912d23BA588cA11F108Cbe2439342d260, deploy tx 0x744e89eaa80fa6d331656ebadb6fcbef24528d797d5414ebd0db6991812218ca, gas 2,080,374. Owner = user wallet, registry = mock. TESTNET ONLY — superseded, never point minters at it.
- Live tests 30/30 passed (testnet-live-tests.json; original uncorrected file kept as testnet-live-tests-original.json): mint(2) free tokens #1-2 tx 0xc76d5b38db7c2cb1828ecb7e08300b6f670d040cb62147b24d296ee859fa9d1e; mint(3) blended 0.0005 tokens #3-5 tx 0x49adad8188ad12521b42bbaea2f6249528255c5d2bbf42436a1b8d0faed20da5; mint(10) 0.004 tokens #6-15 tx 0x056106e547be4c9f1643e7de36ccf9ef01c70ead43fcf14f53b473747a646a25; 2nd mint(2) all-paid 0.001 tokens #16-17 tx 0x83e3bf104ee6c9d23a0c703ac20e645806c0328d5c8ec828dc02083a78fc7de2; freeMint() x2 free (#18-19) then #3 paid 0.0005 (#20); non-agent mint reverts "no Agent ID"; contract caller reverts "EOA only" (MintCaller 0xbCDABfB0594AB0653cE5b4cAda944E709384376e, testnet only); qty 0 reverts; wrong price reverts; 10/wallet cap reverts; tokenURI(1)="1", (16)="16", (17)="1" (baseURI empty); royaltyInfo(1, 1 tBNB) = [user wallet, 0.05]; on-chain reads totalSupply 20, free 8/7,200, paid 12/800, freeRemaining 7,192, paidRemaining 788, contract holds 0.006 tBNB for the owner.
- 3 live-run FAILs were harness misses, NOT contract bugs (M9 lesson, proven via staticCall + raw eth_call, no state change): qty 11 failed with "insufficient funds" because agentB (0.00148 tBNB) could not attach the 0.005 tBNB value — proven "qty 1..10" from a funded caller; withdraw/setBaseURI "failed" because OZ Ownable reverts with custom error OwnableUnauthorizedAccount (data 0x118cdaa7 + deployer address, confirmed by raw eth_call) which the regex missed. Corrected tally 30/30.
- Owner-only calls: withdraw() and setBaseURI() CANNOT be executed live by the deployer (owner = user wallet) — live non-owner reverts proven for both. setBaseURI on testnet still needs the user wallet's signature; tokenURI is proven only with the empty baseURI so far. This is the one remaining live proof.
- Verification: Sourcify VERIFIED exact_match, matchId 58101142, verified 2026-11-02T16:37:17Z (verification/sourcify-result.json; standard-json.json saved). Sourcify's Etherscan forwarding hit the daily 500 limit, so BscScan was NOT verified that way. BscScan API submit FAILED: "Invalid API Key (#err2)" on chain 97, 4 attempts (3 in verify-bscscan-testnet-surrogate.py + 1 retry after 30s pause) — same chain-97 key rejection seen on NFOX/LUNA; chain 56 still works. Per the playbook, after 2 API failures use the MANUAL BscScan website form (Standard JSON, solc 0.8.26+commit.8a97fa7a, Cancun, optimizer 200, constructor args mock registry + user wallet, all in verification/standard-json.json) — that step needs a live browser and is NOT done in this run. BscScan testnet status: PENDING, do not claim verified.
- Site package v3: site-deploy-v3-2026-11-02-testnet-verified.zip, 34 files, 44 KB, TESTNET ONLY label, local HTTP 200 (/, /metadata/1, /metadata/16, /llms.txt, /aura-01.png, /aura-16.png; /metadata/17 404 correct). No hosting created. No mainnet, no real BNB spent, no X login.

## Open items / decisions for the user (before testnet)

1. **Pot + referral are OFF-CHAIN in v1** (SPECS.md Gate 0): no on-chain
   raffle or referrer payout — the contract only exposes paidMinted /
   balance so the split is auditable. QUIRKZ's on-chain mechanism was
   never verified (contract not open-source). If on-chain pot/referral
   is wanted, that is a v2 design decision before testnet.
2. **Hosting not decided**: 8,018 files. Netlify handled 6,666 for NFOX;
   Cloudflare Pages was chosen for AKEY to stay under 1,000 files.
   No site created in Gates 0–4.
3. **Real-phone checker test** still pending (audit sandbox blocks the
   RPC/CDN by design) — same as NFOX/AKEY, do it after a host exists.
4. **Testnet next**: needs user go-ahead in this chat + ~0.025 tBNB
   faucet claim for a fresh throwaway deployer (cannot be claimed
   programmatically — hCaptcha). Then: testnet deploy, live free AND
   paid tests, testnet baseURI proof, Sourcify + BscScan verification.

## Key files

- `SPECS.md`, `GATE-REPORT.md`, `test-results.json`
- `contracts/AuraAgents.sol`, `contracts/AgentIdRegistryMock.sol`,
  `contracts/MintCaller.sol` (test helper only)
- `scripts/compile.mjs`, `scripts/local-test.mjs`,
  `scripts/generate-metadata.mjs`, `art/generate-art.py`
- `scans/SUMMARY.md`, `scans/slither-2026-11-02.txt`,
  `scans/aderyn-2026-11-02.json`
- `art/aura-01.png` … `art/aura-16.png` (IPFS CID above)
- `metadata/1` … `metadata/16` (one per variant, after the 2026-11-02 reduction)
- `site/index.html`, `site/llms.txt`
- `site-deploy-v1-2026-11-02-aura-agents.zip` (archive, 8,018 files), `site-deploy-v2-2026-11-02-16-metadata-files.zip` (34 files), `site-deploy-v3-2026-11-02-testnet-verified.zip` (34 files, TESTNET ONLY)
- `deployment-testnet.json`, `testnet-live-tests.json` (+ `testnet-live-tests-original.json`), `verification/sourcify-result.json`, `verification/bscscan-result.json`, `verification/standard-json.json`

## Mainnet prep — 2026-11-02 ~17:07 GMT (user said "Go ahead" — mainnet approval in principle; NOT deployed yet)

Pre-deploy checklist (playbook Gate 7), all verified in one pass:
- Compile: `npm run compile` clean, AuraAgents bytecode 9,709 bytes, ABI 62.
- Local tests: `npm run test:local` (Anvil) — **67/67 passed, allPassed true**
  (test-results.json, finished 2026-11-02T17:07:30Z), on the exact current
  contract bytes. Free exhausted 7,200/7,200, paid filled 800/800,
  totalSupply 8,000, contract held exactly 0.4 BNB, withdraw emptied it.
- Scans RE-RUN (contract changed 16:02, after the first scans at 15:39):
  Slither 0.11.6 detector counts IDENTICAL to the first run; Aderyn 0.6.8
  2 high (same documented false positives) + 8 low (was 7 — the +1 is
  L-6 "Unchecked Return" on line 97, `_requireOwned(tokenId)` in the new
  tokenURI override, a false positive: the return is intentionally
  discarded, the call exists only to revert for nonexistent tokens).
  Raw outputs: scans/slither-2026-11-02-mainnet-prep.txt,
  scans/aderyn-2026-11-02-mainnet-prep.md (+ .log); verdicts appended to
  scans/SUMMARY.md. No real vulnerability. Gate 2 stands on current bytes.
- Testnet: contract 0x3F59f5c912d23BA588cA11F108Cbe2439342d260, live tests
  30/30, Sourcify exact_match 58101142 (re-verified live via Sourcify API
  this run), BscScan testnet VERIFIED Exact Match via manual form
  2026-11-02 ~16:46 GMT (parent browser task; deployment-testnet.json
  updated to record it — it previously still said PENDING).
- Metadata: 16 files, grep REPLACE_WITH_CID/TODO/PLACEHOLDER = 0.
- Site: v3 package is TESTNET-labelled (34 files); NO mainnet site package
  exists yet — it must be built AFTER deploy with the real address.
  NOTE (stale copy): site/index.html still says "BscScan testnet:
  verification pending" — the v4 mainnet rebuild must fix that line.
- Locked specs re-confirmed: 8,000 total, 7,200 free, 800 paid at
  0.0005 BNB ($0.35), 2 free / max 10 per wallet, Agent ID required for
  ALL mints, EOA-only, 5% royalties to owner (user wallet), pot/referral
  OFF-CHAIN from actual revenue, not audited, no floor/returns/APY/token/
  airdrop/game/merch promises. Owner = user wallet; owner powers as in
  SPECS.md. Hosting NOT chosen; no site created in this run.
- User wallet balance re-checked on 2 mainnet RPCs this run:
  0.005903077878033172 BNB; gas price 0.05 gwei.

Deploy script: scripts/deploy-mainnet.js (adapted from SIGMA's
deploy-mainnet.js + Aura deploy-testnet.js; deploy-testnet.js untouched).
Guards: chainId must be 56, registry constant asserted equal to the real
registry 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F, deployer must not be
the testnet deployer or the user wallet, balance >= 0.001 BNB, nonce 0.
Post-deploy checks: owner, registry, totalSupply 0, freeRemaining 7200,
paidRemaining 800, freeOpen true, paidOpen true (blended — no separate
phase), royaltyInfo 5%. Leftover deployer BNB is returned to the user
wallet by the script and the return tx recorded. One guard bug found and
fixed during --estimate: the registry-assert literal was missing one 'a'
("baa8b" vs "baaa8b"); the REGISTRY constant itself was always correct.
`node --check` passes; --estimate passes.

Fresh MAINNET throwaway deployer: 0xE37436839f777db585D9B65153A5C8103c18AD44
(key only in .env.mainnet, chmod 600 — NEW key, not the testnet key).
Balance 0.0 BNB and nonce 0 verified on TWO mainnet RPCs
(bsc-dataseed.binance.org + bsc-dataseed1.binance.org).
--estimate: deploy gas 2,098,052, cost 0.0001049026 BNB at 0.05 gwei.

STOP POINT: nothing deployed. Funding needed: user sends ~0.001 BNB from
the user wallet to 0xE37436839f777db585D9B65153A5C8103c18AD44; the landing
must be verified on-chain before `node scripts/deploy-mainnet.js` runs
(M10 — never assume it landed). Expected leftover after deploy:
~0.000895 BNB, returned to the user wallet by the script. setBaseURI is
owner-only and is NOT attempted by the deployer — user wallet signs it
after deploy with preview + confirm.

## MAINNET DEPLOYED — 2026-11-02 ~17:19 GMT

- Deployer (fresh throwaway, .env.mainnet chmod 600): 0xE37436839f777db585D9B65153A5C8103c18AD44.
  Funding 0.001 BNB from the user wallet verified on-chain before deploy (balance
  0x38d7ea4c68000, nonce 0, on 4 mainnet seeds; bsc-dataseed 403'd intermittently
  on single calls — cross-checked on dataseed1/2/3).
- **AuraAgents MAINNET: 0xacc6e2F1aaE42B2E5FF2758Ff078E4B1bfAc7DB1**, deploy tx
  0xdb9952622d783182c4084c71ee6a0bd73831f6877d0280c05c2ea18a82048f3a,
  gas 2,080,374, block 131279735. Owner = user wallet, registry = real registry.
- Post-deploy checks 9/9 OK (script + independent RPC re-check): owner user wallet,
  totalSupply 0, freeMintedCount 0, freeRemaining 7200, paidRemaining 800,
  freeOpen true, paidOpen true, royaltyInfo(1, 1 BNB) = [user wallet, 0.05 BNB].
- Leftover returned: 0.0008949313 BNB to the user wallet, tx
  0xce5b167e823b73ce24abad727c1998461b659ad5795beb320288a97651be483e,
  block 131279746. Deployer balance now 0.0 BNB (verified on 2 RPCs).
- Mints started within minutes (radars find verified contracts fast):
  totalSupply 5–7 on two RPCs right after deploy; **43–44 by ~17:22 GMT**.
- Verification: **Sourcify VERIFIED exact_match, matchId 58105492**,
  verified 2026-11-02T17:20:03Z (verification/sourcify-mainnet-result.json;
  script scripts/verify-sourcify-mainnet.mjs; Sourcify's Etherscan forwarding
  hit the daily 500 limit again). **BscScan mainnet PENDING — do NOT claim
  verified:** API submit failed TWICE with generic {"status":"0","message":
  "NOTOK","result":"Error!"} (no guid), 30s apart
  (verification/bscscan-mainnet-result.json; script
  scripts/verify-bscscan-mainnet-surrogate.py). Per playbook M11 the API loop
  was stopped; the manual BscScan website form needs a live browser task
  from the parent agent (Standard JSON in verification/standard-json-mainnet.json,
  solc 0.8.26+commit.8a97fa7a, Cancun, optimizer 200, constructor args =
  real registry + user wallet).
- Site package v4: site-deploy-v4-2026-11-02-mainnet.zip, 34 files, 46 KB,
  zip integrity OK. site/index.html + site/llms.txt updated to the mainnet
  contract everywhere; checker now reads the live contract (free left,
  AURA held, total minted); agent prompt updated; "NOT DEPLOYED YET" removed
  (grep = 0); "verification pending" now refers only to BscScan mainnet (true);
  testnet address appears only in do-NOT-mint warnings. Local HTTP 200:
  /, /metadata/1, /metadata/16, /llms.txt, /aura-01.png, /aura-16.png;
  /metadata/17 correctly 404. JS parses (node --check OK), 0 console calls.
  No hosting site created in this run — the user uploads the zip himself.
- **setBaseURI: PENDING** — owner-only, needs the user wallet's signature
  (preview + explicit confirm in the main chat). tokenURI currently returns
  only the variant number (empty baseURI); token images appear once setBaseURI
  is done. Do NOT attempt it from the deployer.
- Records: deployment-mainnet.json (deploy + verification + site package),
  verification/standard-json-mainnet.json, verification/sourcify-mainnet-result.json,
  verification/bscscan-mainnet-result.json.

## Site v5 — dark and bold rebuild (2026-11-02 ~17:46 GMT)
- User verdict on v4: "Worst site ive ever seen". Chose "Rebuild it dark and bold" from options.
- v5 index.html rewritten: true-black #050505, huge 900-weight gradient headline "YOUR AURA IS WAITING.", sticky top bar with pulsing LIVE badge, live minted count loaded from contract on page load (id liveMinted), big stat tiles, scrolling aura strip + 4-col aura grid, bold price cards (0 / 0.0005 / 0.004 BNB), numbered sections 01-04.
- Functionality unchanged: paste-address checker (registry + contract reads), copy-paste agent prompt (filled with checked address), browser mint still collapsed/disabled, llms.txt link, technical details, honest notes, no wallet-connect.
- Also fixed stale copy carried over from v4: BscScan now VERIFIED Exact Match everywhere (index.html + llms.txt, grep "verification pending" = 0). baseURI still NOT set (held until site live, per user).
- Local HTTP (site-deploy/): / /metadata/1 /metadata/16 /llms.txt /aura-01.png /aura-16.png all 200; /metadata/17 correctly 404.
- Package: site-deploy-v5-2026-11-02-dark-bold.zip, 35 files, 46 KB, files at zip root (extract straight to repo root for GitHub Pages — no wrapper folder, unlike v4). v4 superseded, do not upload.

## Site v6 — header nav (2026-11-02 ~18:07 GMT)
- User: "add the usual headers but not too many to make the site clumsy". Artifact preview first (artifact.edit): 4 links in sticky top bar — Check Wallet, How It Works, Auras, Agent Mint; desktop only, hidden below 880px on mobile; scroll-margin-top for sticky offset; audit passed.
- Synced into real site/index.html (same 4 links + id="how" / id="auras" targets + scroll-margin + mobile hide). Local HTTP (site-deploy/): / /metadata/1 /metadata/16 /llms.txt /aura-01.png all 200; served HTML contains nav link.
- Package: site-deploy-v6-2026-11-02-header-nav.zip, 35 files, 47 KB, files at zip root. v5 superseded, do not upload — upload v6 to GitHub Pages.

## setBaseURI mainnet — DONE 2026-11-02 ~18:36 GMT
- Site live https://aura-agents.pages.dev/ (Cloudflare Pages, v6). User confirmed twice ("Yes, set baseURI on mainnet now" ~17:23 GMT; "go ahead" ~18:35 GMT).
- Prep: baw 1.12.0 (installed via documented npm route, was not on PATH), devMode.enabled=true (expires 2026-11-09T08:12:08Z), wallet session valid to 2026-11-02T19:29:01Z.
- Preview requestId 38682b93d05445feb15778db7c873215, success true, simulation clean (000000000), risks [], authorityChanges [], requireConfirmation false, expires 2026-11-02T18:40:35Z. Saved verification/setbaseuri-preview.json. Executed before expiry.
- Execute: orderId 26110200002015839100, BROADCASTED, tx 0x319dc41d40967fe5e8f91986b2d77a59990d9630d75a029982939c7fa98a5532.
- Receipt: status 0x1, block 0x7d35367, gasUsed 0x165dd (91,541 — matches local test estimate exactly), from user wallet.
- Verified on-chain: tokenURI(1) = https://aura-agents.pages.dev/metadata/1 (decoded from eth_call); /metadata/1 live 200 (Ember JSON). Minted Auras now resolve art + metadata.
