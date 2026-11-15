// Copies the HarfBuzz JS/WASM assets from node_modules/harfbuzzjs/dist into public/hb.
// Run after upgrading harfbuzzjs: npm run sync:assets
import fs from "node:fs";
import path from "node:path";

const src = path.join("node_modules", "harfbuzzjs", "dist");
const dst = path.join("public", "hb");
fs.mkdirSync(dst, { recursive: true });
for (const f of ["index.mjs", "harfbuzz.js", "harfbuzz.wasm"]) {
  fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
fs.copyFileSync(path.join("node_modules", "harfbuzzjs", "LICENSE"), path.join(dst, "LICENSE"));
console.log("Synced HarfBuzz assets to", dst);
