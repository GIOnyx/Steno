import fs from "node:fs";
import * as hb from "harfbuzzjs";
import { loadDictionary, renderWord } from "../src/lib/gregg/engine.ts";
import { makeFont, setGrasciiFont, tokensToGrascii } from "../src/lib/gregg/grascii.ts";
import { outlineFor, outlineSvg } from "../src/lib/gregg/strokes.ts";

globalThis.fetch = (async () => ({ ok: true, text: async () => fs.readFileSync("public/dict/cmu.txt", "utf8") })) as typeof fetch;
await loadDictionary();
setGrasciiFont(await makeFont(fs.readFileSync("public/fonts/Grascii-Regular.otf"), hb));
const words = (process.argv[2] || "can name mean take care rate today family detail court order witness honorable hearing plaintiff defendant question testimony").split(" ");
let rows = "";
for (const w of words) {
  const r = renderWord(w, { series: "centennial" });
  const g = tokensToGrascii(r.tokens, "centennial");
  const before = r.tokens.length ? outlineSvg(outlineFor(r.tokens), 22) : "";
  const o = r.outline;
  const after = o ? outlineSvg(o, 22) : "";
  rows += `<tr><td>${w}</td><td>${before}</td><td>${after}</td><td><code>${g ? g.code : "-"}</code> ${o?.filled ? "" : "(fallback)"}</td></tr>`;
}
fs.writeFileSync("scripts/compare.html", `<!doctype html><body style="font:14px sans-serif;color:#1A2233"><table cellpadding=8 border=1 style="border-collapse:collapse"><tr><th>word</th><th>before (geometric)</th><th>after (Grascii font)</th><th>code</th></tr>${rows}</table></body>`);
console.log("ok", words.length);
