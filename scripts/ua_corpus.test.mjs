// Checks the front-end's isValidOrchardAddress against the corpus emitted by the prover
// (zcash-name-prover/script/src/bin/gen_ua_corpus.rs).
//
// The two sides share no code: the circuit uses the `zcash_address` crate, the front-end
// uses its own f4jumble.js + bech32.js. Independent implementations of one rule drift, and
// a front-end looser than the circuit lets a user pay for a command the prover cannot
// prove, while a stricter one rejects valid addresses.
//
//   node scripts/ua_corpus.test.mjs
//   UA_CORPUS=/path/to/ua_corpus.json node scripts/ua_corpus.test.mjs
import fs from "node:fs";
import path from "node:path";
import { decodeUnifiedAddress } from "../js/vendor/f4jumble.js";

const corpusPath = process.env.UA_CORPUS
  ?? path.join(import.meta.dirname, "fixtures", "ua_corpus.json");
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));

// Lift the real validator out of app.js by marker, so this breaks loudly if the source
// moves rather than silently testing a stale copy.
const SRC = path.join(import.meta.dirname, "..", "js", "app.js");
const src = fs.readFileSync(SRC, "utf8");
const from = src.indexOf("const ZCASH_ADDRESS_HRP");
const end = src.indexOf("\n}", src.indexOf("function isValidOrchardAddress")) + 2;
if (from < 0 || end < from) throw new Error("markers not found — did app.js change?");

const factory = new Function("decodeUnifiedAddress", `${src.slice(from, end)}
  return { isValidOrchardAddress, setNetwork: (n) => { zcashNetwork = n; } };`);
const { isValidOrchardAddress, setNetwork } = factory(decodeUnifiedAddress);

let failed = 0;
for (const net of ["mainnet", "testnet"]) {
  setNetwork(net);
  const bad = [];
  for (const c of corpus) {
    // maxLength null: the corpus tests the address form, not the memo budget.
    const got = isValidOrchardAddress(c.addr, null);
    if (got !== c[net]) {
      bad.push(`${(c.addr || "(empty)").slice(0, 34)} [${c.why}]: expected ${c[net]}, got ${got}`);
    }
  }
  console.log(`  ${corpus.length} corpus cases (${net}): ${bad.length === 0 ? "all agree" : `${bad.length} DISAGREE`}`);
  for (const b of bad.slice(0, 12)) console.log(`    ${b}`);
  failed += bad.length;
}

process.exit(failed === 0 ? 0 : 1);
