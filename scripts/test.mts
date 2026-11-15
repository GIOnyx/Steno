import assert from "node:assert/strict";
import fs from "node:fs";
import * as hb from "harfbuzzjs";
import { loadDictionary, renderText, renderWord } from "../src/lib/gregg/engine.ts";
import {
  centennialCode,
  codeOutline,
  loadDict1930,
  makeFont,
  setDict1930,
  setGrasciiFont,
  tokensToGrascii,
} from "../src/lib/gregg/grascii.ts";
import { buildPdf } from "../src/lib/gregg/pdf.ts";
import { briefForms, codeToTokens, tokensToCode, type Series } from "../src/lib/gregg/rules.ts";

// Load local dictionaries and font directly from disk without a dev server.
globalThis.fetch = (async (url: string | URL) => {
  const s = String(url);
  if (s.endsWith("cmu.txt")) return { ok: true, text: async () => fs.readFileSync("public/dict/cmu.txt", "utf8") };
  if (s.endsWith("gregg1930.txt")) return { ok: true, text: async () => fs.readFileSync("public/dict/gregg1930.txt", "utf8") };
  throw new Error("unexpected fetch: " + s);
}) as typeof fetch;

const font = await makeFont(fs.readFileSync("public/fonts/Grascii-Regular.otf"), hb);
setGrasciiFont(font);
await loadDictionary();
await loadDict1930();

// 1. Edition boundaries (1916 -> Diamond Jubilee / Centennial)
assert.equal(centennialCode("OR"), "O-R");
assert.equal(centennialCode("KORT"), "KO-RT");
assert.equal(centennialCode("OLD"), "OLD");
assert.equal(centennialCode("OL"), "O-L");

// 2. Rules -> tokens -> Grascii notation (testing with 1930 dict temporarily disabled)
setDict1930(null);
const ruleCode = (w: string, series: Series = "centennial") => {
  const r = renderWord(w, { series, namesAsFilipino: true });
  return tokensToGrascii(r.tokens, series)?.code ?? null;
};
assert.equal(ruleCode("aback"), "ABAK");
assert.equal(ruleCode("block"), "BLOK");
assert.equal(ruleCode("hot"), "'OT");
assert.equal(ruleCode("quick"), "KE_K");
assert.equal(ruleCode("dwell"), "DE_L");
assert.equal(ruleCode("yes"), "ES");
assert.equal(ruleCode("boxed"), "BOXT");
assert.equal(ruleCode("working"), "RK'");
assert.equal(ruleCode("hearing"), "'ER'");
assert.equal(ruleCode("a"), ""); // standalone dot uses codeOutline dot, not Grascii text
assert.equal(renderWord("a", { series: "centennial" }).outline?.filled, true);
assert.equal(renderWord("an", { series: "centennial" }).outline?.filled, true);
assert.equal(renderWord("Lomongo", { series: "centennial", namesAsFilipino: true }).source, "filipino");

// Round-trip stroke code with w-dash
assert.equal(tokensToCode(codeToTokens("K E_ K")), "K E_ K");

// Re-enable 1930 dictionary and verify precedence: custom > brief > gregg1930 > rules
await loadDict1930();
assert.equal(renderWord("order", { series: "centennial" }).source, "brief");
assert.equal(renderWord("court", { series: "centennial" }).source, "gregg1930");
assert.equal(renderWord("court", { series: "centennial" }).grascii, "KOT");
assert.equal(renderWord("moral", { series: "centennial" }).grascii, "MO-RL");
assert.equal(renderWord("moral", { series: "anniversary" }).grascii, "MORL");
assert.equal(renderWord("court", { series: "centennial", custom: { court: "K O R T" } }).source, "custom");

// 3. All brief forms across all three series shape cleanly with zero fallbacks
for (const series of ["centennial", "simplified", "anniversary"] as const) {
  const bf = briefForms(series);
  for (const word of Object.keys(bf)) {
    const r = renderWord(word, { series });
    assert.ok(r.outline?.filled, `brief form fallback for ${series}:${word}`);
  }
}

// 4. Every entry in public/dict/gregg1930.txt shapes cleanly with no .notdef glyphs
const entries = fs.readFileSync("public/dict/gregg1930.txt", "utf8").split("\n").filter(Boolean);
let shapedCount = 0;
for (const line of entries) {
  const i = line.indexOf(" ");
  if (i <= 0) continue;
  const code = centennialCode(line.slice(i + 1).trim());
  assert.ok(codeOutline(code), `failed to shape 1930 entry: ${line}`);
  shapedCount++;
}
assert.ok(shapedCount > 13000, "expected >13000 1930 dictionary entries");

// 5. PDF export produces a valid PDF
const paras = renderText("When called today for the continuation of trial, Atty. Clarus appeared.", { series: "centennial" });
const pdf = await buildPdf(paras, { pageSize: "steno", gloss: true, colour: true, series: "Centennial (1988)" });
assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
assert.ok(pdf.length > 1000);

console.log(`PASS: rules, ${shapedCount} 1930 entries, all brief forms, and PDF export verified.`);
