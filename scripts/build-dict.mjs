// Builds public/dict/gregg1930.txt from the grascii/dictionaries "anniversary" source (MIT, based on the 1930 Gregg Shorthand Dictionary).
// Usage: node scripts/build-dict.mjs <folder containing a.txt ... z.txt>
// Output: one "word code" pair per line; entries with Grascii features the font cannot draw are skipped.
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) { console.error("usage: node scripts/build-dict.mjs <folder>"); process.exit(1); }
const UNSUPPORTED = /[\^~|.,\\]/;   // disjoiners, reversed/looped vowels, sound annotations, intersections
const seen = new Map();
let skipped = 0;
for (const f of fs.readdirSync(src).filter((n) => /^[a-z]\.txt$/.test(n)).sort()) {
  for (const line of fs.readFileSync(path.join(src, f), "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [code, word] = line.split("\t");
    if (!code || !word) continue;
    const w = word.trim().toLowerCase();
    if (!/^[a-z][a-z'-]*$/.test(w) || /\s/.test(code)) continue;
    if (UNSUPPORTED.test(code)) { skipped++; continue; }
    if (!seen.has(w)) seen.set(w, code.trim().toUpperCase());
  }
}
const out = [...seen].map(([w, c]) => w + " " + c).join("\n") + "\n";
fs.writeFileSync(path.join("public", "dict", "gregg1930.txt"), out);
console.log("words:", seen.size, "skipped (unsupported marks):", skipped);
