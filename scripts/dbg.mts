import { outlineFor } from "../src/lib/gregg/strokes.ts";
import { codeToTokens } from "../src/lib/gregg/rules.ts";
for (const code of ["N A M", "T A N", "K E P"]) { const o = outlineFor(codeToTokens(code)); console.log(code, o.d, JSON.stringify([o.minX,o.minY,o.w,o.h])); }
