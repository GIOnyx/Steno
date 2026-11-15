import fs from "node:fs";
import { outlineFor, outlineSvg } from "../src/lib/gregg/strokes.ts";
import { codeToTokens } from "../src/lib/gregg/rules.ts";
let h = "";
for (const code of ["O", "U", "N O", "O N", "T O", "O T", "S U N", "U N", "N U", "K U", "P O", "F U", "OW T", "OI L", "YU S", "h O M", "I"]) { const o = outlineFor(codeToTokens(code)); h += `<div style="display:inline-block;margin:10px;border:1px solid #ccc;color:#000">${outlineSvg(o, 60)}<br>${code}</div>`; }
fs.writeFileSync("scripts/dbg2.html", `<!doctype html><body>${h}</body>`);
