import fs from "node:fs";
import { outlineFor, outlineSvg } from "../src/lib/gregg/strokes.ts";
import { renderWord, loadDictionary } from "../src/lib/gregg/engine.ts";
(globalThis as any).fetch = async () => ({ ok: true, text: async () => fs.readFileSync("public/dict/cmu.txt", "utf8") });
await loadDictionary();
const words = (process.argv[2] || "can name mean tan deed keep gag page pay bay fee day aim eat ate tea may knee need made take care rate late hearing daily family today detail court order witness honorable Lomongo Unabia plaintiff defendant").split(" ");
let cells = "";
for (const w of words) {
  const r = renderWord(w, { series: "centennial" });
  const svg = r.outline ? outlineSvg(r.outline, 14) : "";
  cells += `<div style="display:inline-block;margin:6px;padding:6px;border:1px solid #ddd;text-align:center;font:12px sans-serif;color:#1A2233"><div style="height:80px;display:flex;align-items:center;justify-content:center">${svg}</div>${w}<br><small style="color:#888">${r.source} ${(r.sounds||[]).join("")}</small><br><small>${r.tokens.map(t=>t.k==='c'?t.s:t.k==='v'?t.v.toLowerCase():t.k).join(" ")}</small></div>`;
}
fs.writeFileSync("scripts/gregg-test.html", `<!doctype html><body style="background:#fff">${cells}</body>`);
console.log("ok", words.length);
