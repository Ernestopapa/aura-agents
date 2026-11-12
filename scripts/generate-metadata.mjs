// Generate Aura Agents metadata: 16 extensionless files ONLY (1..16),
// one per aura variant. tokenURI(tokenId) = baseURI + variant, where
// variant = (tokenId - 1) % 16 + 1, so all 500 tokens of a variant share
// one file. No per-token metadata: there are no per-token traits, so
// 8,000 per-token files carried no information (deleted 2026-11-02 on
// the user's "reduce anything that will increase the files").
// No .json duplicates. Image: 16 pixel auras on IPFS (Pinata folder CID
// passed via --cid). No Free/Paid per-variant trait: free vs paid is
// per-WALLET, not per-variant, so inventing one would be false data
// (playbook: do not invent traits).
// Usage: node scripts/generate-metadata.mjs --cid <CID>
// Writes metadata/1 .. metadata/16 (extensionless, JSON content).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const cidIdx = args.indexOf("--cid");
const CID = cidIdx >= 0 ? args[cidIdx + 1] : process.env.AURA_CID;
if (!CID || !/^bafybei|^bafkrei/.test(CID)) {
  console.error("Usage: node scripts/generate-metadata.mjs --cid <IPFS CID>");
  process.exit(1);
}

const AURAS = [
  ["Ember", "determined"], ["Tide", "calm"], ["Bloom", "joyful"],
  ["Volt", "excited"], ["Frost", "serene"], ["Shadow", "mysterious"],
  ["Solar", "radiant"], ["Moss", "grounded"], ["Nova", "bold"],
  ["Mist", "dreamy"], ["Coral", "playful"], ["Abyss", "thoughtful"],
  ["Honey", "warm"], ["Jade", "balanced"], ["Crimson", "fierce"],
  ["Lunar", "lunar"],
];

const dir = path.join(root, "metadata");
fs.mkdirSync(dir, { recursive: true });
for (let v = 1; v <= 16; v++) {
  const [aura, mood] = AURAS[v - 1];
  const meta = {
    name: `Aura Agents — ${aura} Aura`,
    description:
      "Aura Agents (AURA) — 8,000 pixel aura agents on BNB Smart Chain. " +
      `This metadata file is shared by all 500 tokens of the ${aura} aura ` +
      `(variant ${v} of 16); tokenURI(tokenId) returns this file for every ` +
      "token whose variant is (tokenId - 1) % 16 + 1. " +
      "First 2 per wallet free for Binance Agent ID holders, every extra in " +
      "the same mint paid at 0.0005 BNB (~$0.35) each, max 10 per wallet. " +
      "Agent ID required for all mints. " +
      "30% of paid revenue received goes to a daily pot raffle and 20% to " +
      "referral rewards, distributed off-chain from actual revenue received; " +
      "no payout or win is promised. Points are a score, not a token, and do " +
      "not entitle anyone to tokens or payouts. The contract is not audited " +
      "by a third party. No floor price, returns, APY, dated token or airdrop, " +
      "game, or merch is promised.",
    image: `ipfs://${CID}/aura-${String(v).padStart(2, "0")}.png`,
    attributes: [
      { trait_type: "Collection", value: "Aura Agents" },
      { trait_type: "Aura", value: aura },
      { trait_type: "Mood", value: mood },
      { trait_type: "Variant", value: v },
      { trait_type: "Tokens sharing this variant", value: 500 },
    ],
  };
  fs.writeFileSync(path.join(dir, String(v)), JSON.stringify(meta, null, 2) + "\n");
}
const files = fs.readdirSync(dir).filter((f) => Number(f) >= 1 && Number(f) <= 16);
console.log(`Wrote ${files.length} metadata files to metadata/ (1..16, extensionless only)`);
console.log(`Images: ipfs://${CID}/aura-01.png .. aura-16.png`);
