# Gate 2 — Static scans, 2026-11-02

Tools (reused from SEVEN SIGMA / Agent Key Pass, not newly installed):
- Slither 0.11.6 (venv `~/.venvs/slither`), solc binary 0.8.26+commit.8a97fa7a (`~/.local/bin/solc`)
- Aderyn 0.6.8 (`~/.local/bin/aderyn`), remappings via `remappings.txt`
  (`@openzeppelin/=node_modules/@openzeppelin/`)
- Raw outputs: `scans/slither-2026-11-02.txt`, `scans/aderyn-2026-11-02.json` (+ `.log`)

## Slither 0.11.6 — 69 results total, 25 contracts analysed

Command: `slither contracts/AuraAgents.sol --solc ~/.local/bin/solc --solc-remaps "@openzeppelin/=node_modules/@openzeppelin/"`
(Slither exits 255 when findings exist — same as the NFOX/SIGMA/AKEY runs;
the output file is the evidence, not the exit code.)

- 64 of the 69 results are inside `node_modules/@openzeppelin/`
  (Math.mulDiv, Bytes, Strings, StorageSlot, Context, ERC2981, ERC721
  internals): incorrect-exp, divide-before-multiply, assembly,
  dead-code, too-many-digits, solc-version (broad OZ pragma ranges).
  Known, audited OpenZeppelin v5.6.1 library internals, identical to
  the NFOX, SIGMA and AKEY builds. No action.
- 5 results touch `contracts/AuraAgents.sol` itself, all
  informational/low, none a real vulnerability — same pattern as AKEY:

| Detector | Location | Verdict |
|---|---|---|
| reentrancy-no-eth | `mint()` — `_safeMint` in loop | Mitigated. `mint()` is `nonReentrant`; ALL state updates (`freeMinted`, `mintedCount`, `_freeCount`, `paidMinted`) happen BEFORE the loop; the id is assigned BEFORE `_safeMint` each iteration; loop max 10. |
| reentrancy-events | `withdraw()` — event emitted after the low-level call | Informational. `withdraw()` is `onlyOwner`; balance is read into `amount` BEFORE the call, so a re-entrant `withdraw` during the callback sees balance 0 and reverts on "nothing to withdraw". No double-spend. |
| low-level-calls | `withdraw()` — `owner().call{value: amount}()` | Known pattern, same as NFOX/SIGMA/AKEY. Return value checked (`require(ok)`). |
| costly-loop | `mint()` — `_nextId++` (SSTORE) inside loop | Intentional, max 10 iterations; paid x10 = 383,555 gas local. |
| pragma / solc-version | `^0.8.26` in AuraAgents | Not applicable to the deployed bytecode: the build pins solc to exactly 0.8.26. |

## Aderyn 0.6.8 — 2 high (1 real entry + 1 test-helper entry), 7 low

Caveat: Aderyn compiled with its own bundled solc v0.8.33 / EVM Prague,
not the project's pinned solc 0.8.26 / Cancun. Findings are pattern-based
and still valid for review. `issue_count: {high: 2, low: 7}` counts
detector entries (high_issues has 2 issue entries).

### High (2)
- `reentrancy-state-change` in `mint()` (line 142) and `freeMint()`
  (line 172). FALSE POSITIVE — same as SIGMA/AKEY. The hint lists
  `freeMinted[msg.sender] += freeQty`, `mintedCount[...] += ...`,
  `_freeCount += freeQty`, `paidMinted += paidQty`, `_nextId++` as
  "state changed after an external call". In the actual code those
  writes are ALL BEFORE `_safeMint` — i.e. the checks-effects-
  interactions pattern is followed — and both functions are
  `nonReentrant`. The only thing after the external call is the
  `FreeMinted`/`PaidMinted` event emit. No re-entrancy path exists.
- `contract-locks-ether` in `contracts/MintCaller.sol` line 12.
  NOT the main contract: MintCaller is a LOCAL TEST HELPER ONLY
  (proves the EOA-only gate). It forwards `msg.value` straight to
  `AuraAgents.mint{value:}` and never holds ether; it is never
  deployed to testnet or mainnet. No action.

### Low (7) — all known / intentional
- `centralization-risk`: documented owner powers (constructor royalty,
  `setBaseURI`, `withdraw`); mock `setAgent`/`setAgents` is testnet-only.
- `costly-loop` (`mint()` line 155; mock `setAgents`): intentional, max 10.
- `push-zero-opcode`: BSC supports Cancun/PUSH0.
- `require-revert-in-loop` (`mint()` line 155): `_safeMint` inside the
  loop is intentional — a failing mint MUST revert the whole tx.
- `state-change-without-event`: mock `setAgent`/`setAgents` (test-only);
  `setBaseURI` (line 80) changes `_base` without an event — same as
  NFOX/SIGMA/AKEY, accepted.
- `unspecific-solidity-pragma` (`^0.8.26`, compiler pinned to exactly 0.8.26).
- `unused-public-function`: the public view functions (`freeMintedCount`,
  `freeRemaining`, `paidRemaining`, `freeOpen`, `paidOpen`) are the
  radar/site API — intentionally public, called off-chain.

## Verdict

No new issues vs NFOX / SEVEN SIGMA / Agent Key Pass. No real
vulnerability found. Gate 2 passes with the same documented false
positive as SIGMA/AKEY, plus one test-helper-only high that never ships.

## Re-run 2026-11-02 ~16:57 GMT — mainnet prep (contract changed since first scan)

The contract was modified 16:02 (per-variant tokenURI override) AFTER the
first scans ran 15:39, so the scans were re-run on the exact current
`contracts/AuraAgents.sol` before mainnet. Raw outputs:
`scans/slither-2026-11-02-mainnet-prep.txt`,
`scans/aderyn-2026-11-02-mainnet-prep.md` (+ `.log`).

- Slither 0.11.6: detector counts IDENTICAL to the first run (same 69
  results by detector, verified by diff of detector counts). No new
  finding from the tokenURI override.
- Aderyn 0.6.8: 2 high, 8 low (was 2 high, 7 low). Highs unchanged:
  reentrancy-state-change (documented false positive — state changes
  all before `_safeMint`, both functions nonReentrant) and
  contract-locks-ether in MintCaller.sol (test helper only, never
  deployed). The ONE new low is L-6 "Unchecked Return" on
  AuraAgents.sol line 97 — `_requireOwned(tokenId)` inside the new
  `tokenURI()` override. FALSE POSITIVE: `_requireOwned` is the
  standard OpenZeppelin existence check; its return value (the owner
  address) is intentionally discarded — the call exists only to revert
  for nonexistent tokens. No action.
- Verdict unchanged: no real vulnerability. Gate 2 stands on the
  current contract bytes.
