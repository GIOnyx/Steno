/*
 * English word -> Gregg tokens.
 *   1. sounds: the pronunciation dictionary (CMU, compact encoding) or a spelling-to-sound fallback
 *      (Filipino/Spanish-style for names, English-style otherwise)
 *   2. tokens: Gregg strokes, with the blends, vowel omissions and suffix marks of the chosen series
 *   3. brief forms: a per-series table of word -> tokens that overrides the rules
 */
import type { Token } from "./strokes";

/* ---------------- compact phoneme codes (see public/dict/cmu.txt) ---------------- */
// vowels
// Eh = short e / short i (small circle, takes part in the men/ten blends); E = long e (small circle)
const V: Record<string, string> = {
  a: "A", "@": "A", "^": "Uh", "0": "schwa", c: "O", W: "OW", I: "I", e: "Eh", R: "ER", "9": "er", A: "A", i: "Eh", "1": "ih", E: "E", O: "O", Y: "OI", u: "U", U: "U",
};
// consonants
const CONS: Record<string, string> = {
  b: "B", C: "CH", d: "D", D: "TH", f: "F", g: "G", h: "H", J: "J", k: "K", l: "L", m: "M", n: "N", G: "NG", p: "P", r: "R", s: "S", S: "SH", t: "T", T: "TH", v: "V", w: "W", y: "Y", z: "S", Z: "SH",
};
export const isVowelCode = (c: string) => c in V;

export type Series = "centennial" | "simplified" | "anniversary";
export const SERIES: { id: Series; name: string; note: string }[] = [
  { id: "centennial", name: "Centennial (1988)", note: "The series of Gregg Shorthand College Book 2, Centennial Edition. All 139 brief forms (162 words)." },
  { id: "simplified", name: "Simplified (1949)", note: "Centennial table plus the Simplified extras. Partial." },
  { id: "anniversary", name: "Anniversary (1929)", note: "Simplified table plus a few Anniversary forms. Partial." },
];

/* ---------------- spelling to sound ---------------- */
// Filipino and Spanish names are read as spelled: pure vowels, c = k/s, j = h, ñ = ny, qu = k, ll = ly.
export function filipinoToSounds(word: string): string[] {
  const w = word.toLowerCase().replace(/ñ/g, "ny");
  const out: string[] = [];
  const vow = (c: string) => "aeiou".includes(c);
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1] || "", p = w[i - 1] || "";
    if (c === "a") out.push("a");
    else if (c === "e") out.push("e");
    else if (c === "i") out.push(vow(n) ? "y" : "E");
    else if (c === "o") out.push("O");
    else if (c === "u") { if (p === "q" || (p === "g" && (n === "e" || n === "i"))) continue; out.push(vow(n) ? "w" : "U"); }
    else if (c === "y") out.push(vow(n) || vow(p) ? "y" : "E");
    else if (c === "c") out.push(n === "h" ? "C" : n === "e" || n === "i" ? "s" : "k");
    else if (c === "h") { if (p === "c") continue; if (p === "s") continue; out.push("h"); }
    else if (c === "j") out.push("h");
    else if (c === "l") { if (n === "l") { out.push("l", "y"); i++; } else out.push("l"); }
    else if (c === "r") { if (n === "r") i++; out.push("r"); }
    else if (c === "q") out.push("k");
    else if (c === "x") out.push("k", "s");
    else if (c === "z") out.push("s");
    else if (c === "g") out.push(n === "e" || n === "i" ? "h" : "g");
    else if (c === "v") out.push("b");
    else if (c === "n" && n === "g") { out.push("G"); i++; if (w[i + 1] && vow(w[i + 1])) out.push("g"); }
    else if (c === "s" && n === "h") { out.push("S"); i++; }
    else if (c === "t" && n === "h") { out.push("t"); i++; }
    else if (c === "p" && n === "h") { out.push("f"); i++; }
    else if (/[bdfgkmnprstvwz]/.test(c)) { if (n === c) i++; out.push(c === "w" ? "w" : c); }
  }
  return out;
}
// A very plain English fallback for words the dictionary lacks.
export function englishToSounds(word: string): string[] {
  const w = word.toLowerCase();
  const out: string[] = [];
  const vow = (c: string) => "aeiouy".includes(c);
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1] || "", n2 = w[i + 2] || "", p = w[i - 1] || "";
    const final = i === w.length - 1;
    if (c === "e" && final && out.length > 1) continue;           // silent e
    if (c === "a") out.push(n === "y" || n === "i" ? "A" : "@");
    else if (c === "e") { if (n === "e" || n === "a") { out.push("E"); i++; } else out.push(final ? "E" : "e"); }
    else if (c === "i") out.push(n === "g" && n2 === "h" ? "I" : n && !vow(n) && w[i + 2] === "e" && i + 2 === w.length - 1 ? "I" : "i");
    else if (c === "o") { if (n === "o") { out.push("U"); i++; } else if (n === "u" || n === "w") { out.push("W"); i++; } else out.push("O"); }
    else if (c === "u") out.push("^");
    else if (c === "y") out.push(i === 0 ? "y" : final ? "E" : "i");
    else if (c === "c") { if (n === "h") { out.push("C"); i++; } else if (n === "k") { out.push("k"); i++; } else out.push("eiy".includes(n) ? "s" : "k"); }
    else if (c === "g") { if (n === "h") { i++; continue; } out.push("eiy".includes(n) ? "J" : "g"); }
    else if (c === "j") out.push("J");
    else if (c === "x") out.push("k", "s");
    else if (c === "q") { out.push("k", "w"); if (n === "u") i++; }
    else if (c === "s") { if (n === "h") { out.push("S"); i++; } else out.push("s"); }
    else if (c === "t") { if (n === "h") { out.push("T"); i++; } else if (n === "i" && n2 === "o") { out.push("S"); i++; } else out.push("t"); }
    else if (c === "p" && n === "h") { out.push("f"); i++; }
    else if (c === "w" && n === "h") { out.push("w"); i++; }
    else if (c === "n" && n === "g" && (final || !vow(n2))) { out.push("G"); i++; }
    else if (c === "k" && i === 0 && n === "n") continue;
    else if (/[bdfhklmnprstvwz]/.test(c)) { if (n === c) i++; out.push(c); }
    else if (p && p === c) continue;
  }
  return out;
}

/* ---------------- sounds -> tokens ---------------- */
const SHORT_V = new Set(["Eh", "schwa", "ih", "er", "Uh", "E"]);
const ABBREV: Record<string, string> = {
  atty: "attorney", attys: "attorneys", hon: "honorable", mr: "mister", mrs: "missus", ms: "miss", dr: "doctor", sps: "spouses", hrs: "heirs",
  no: "number", nos: "numbers", vs: "versus", exh: "exhibit", brgy: "barangay", pros: "prosecutor", engr: "engineer", jr: "junior", sr: "senior",
  mtcc: "M T C C", rtc: "R T C", tsn: "T S N", pssg: "P S S G", pmsg: "P M S G", st: "street", ave: "avenue",
};
export const ABBREVIATIONS = ABBREV;

type Ph = { c?: string; v?: string; aa?: boolean };
type VowelCode = "A" | "E" | "EF" | "I" | "O" | "U" | "OW" | "OI" | "YU";

const SUFFIX_RULES: Array<[RegExp, RegExp, (ph: Ph[], sp: string) => { sp: string; tok: Token[] }]> = [
  [/ingly$/, /^(ih|Eh) NG L (E|Eh)$/, (ph, sp) => { ph.splice(-4); return { sp: sp.slice(0, -5), tok: [{ k: "dis", m: "e" }] }; }],
  [/[^aeiou]ily$/, /^L (E|Eh)$/, (ph, sp) => {
    ph.splice(-2);
    if (ph.length > 1 && isShort(ph[ph.length - 1].v)) ph.splice(-1);
    return { sp: sp.slice(0, -3), tok: [{ k: "v", v: "EF" }] };
  }],
  [/ly$/, /^L (E|Eh)$/, (ph, sp) => { ph.splice(-2); return { sp: sp.slice(0, -2), tok: [{ k: "v", v: "E" }] }; }],
  [/ings$/, /^(ih|Eh) NG S$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -4), tok: [{ k: "dis", m: "s" }] }; }],
  [/ing$/, /^(ih|Eh) NG$/, (ph, sp) => { ph.splice(-2); return { sp: sp.slice(0, -3), tok: [{ k: "dot" }] }; }],
  [/[st]ions?$/, /^SH (schwa|Eh|ih) N( S)?$/, (ph, sp) => {
    const pl = sp.endsWith("s");
    ph.splice(pl ? -4 : -3);
    return { sp: sp.replace(/[st]ions?$/, ""), tok: pl ? [{ k: "c", s: "SH" }, { k: "c", s: "S" }] : [{ k: "c", s: "SH" }] };
  }],
  [/[st]ion$/, /^SH N$/, (ph, sp) => { ph.splice(-2); return { sp: sp.replace(/[st]ion$/, ""), tok: [{ k: "c", s: "SH" }] }; }],
  [/ful$/, /^F (schwa|U|Uh|ih|Eh) L$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -3), tok: [{ k: "c", s: "F" }] }; }],
  [/ble$/, /^B (schwa|U|Uh|ih|Eh) L$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -3), tok: [{ k: "c", s: "B" }] }; }],
  [/ther$/, /^TH (er|ER)$/, (ph, sp) => { ph.splice(-2); return { sp: sp.slice(0, -4), tok: [{ k: "c", s: "TH" }] }; }],
  [/ship$/, /^SH (ih|Eh) P$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -4), tok: [{ k: "c", s: "SH" }] }; }],
  [/ward$/, /^W (er|ER|O) D$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -4), tok: [{ k: "c", s: "D" }] }; }],
  [/hood$/, /^H U D$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -4), tok: [{ k: "c", s: "D" }] }; }],
  [/selves$/, /^S (Eh|E) L V S$/, (ph, sp) => { ph.splice(-5); return { sp: sp.slice(0, -6), tok: [{ k: "c", s: "S" }, { k: "c", s: "S" }] }; }],
  [/self$/, /^S (Eh|E) L F$/, (ph, sp) => { ph.splice(-4); return { sp: sp.slice(0, -4), tok: [{ k: "c", s: "S" }] }; }],
  [/[ct]ial$/, /^SH (schwa|U|Uh|ih|Eh) L$/, (ph, sp) => { ph.splice(-3); return { sp: sp.replace(/[ct]ial$/, ""), tok: [{ k: "c", s: "SH" }] }; }],
  [/(lity|rity)$/, /^(L|R) (ih|Eh|schwa) T (E|Eh)$/, (ph, sp) => {
    const c = ph[ph.length - 4].c!;
    ph.splice(-4);
    return { sp: sp.slice(0, -4), tok: [{ k: "c", s: c }] };
  }],
  [/(cal|cle)$/, /^K (schwa|U|Uh|ih|Eh) L$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -3), tok: [{ k: "c", s: "K" }] }; }],
  [/ual$/, /^(U|YU|W) (schwa|U|Uh) L$/, (ph, sp) => { ph.splice(-3); return { sp: sp.slice(0, -3), tok: [{ k: "c", s: "L" }] }; }],
];

const isShort = (v?: string) => !!v && SHORT_V.has(v);
const isTD = (x?: Ph) => !!x && (x.c === "T" || x.c === "D");
const SL_NEIGHBORS = new Set(["K", "G", "F", "V", "SH", "CH", "J"]);
const BROAD_A_SPELLING = /(?:alm|alf|ather|aha|ama|spa|aza)/;
const W_VOWELS = new Set(["A", "Eh", "E", "I", "O", "U", "Uh"]);

function stripSuffixes(ph: Ph[], sp: string): { sp: string; ending: Token[] } {
  const ending: Token[] = [];
  for (let pass = 0; pass < 3; pass++) {
    let matched = false;
    for (const [spRe, phRe, apply] of SUFFIX_RULES) {
      if (!spRe.test(sp)) continue;
      // Match the longest tail window (2..5 phonemes) that fits the phonetic suffix
      for (const n of [5, 4, 3, 2]) {
        if (ph.length <= n) continue;
        const tailStr = ph.slice(-n).map((q) => q.c || q.v).join(" ");
        if (!phRe.test(tailStr)) continue;
        const res = apply(ph, sp);
        sp = res.sp;
        ending.unshift(...res.tok);
        matched = true;
        break;
      }
      if (matched) break;
    }
    if (!matched) break;
  }
  return { sp, ending };
}

function stripPrefixes(ph: Ph[], sp: string): void {
  const head = (n: number) => ph.slice(0, n).map((q) => q.c || q.v).join(" ");
  const h3 = head(3), h2 = head(2);
  if (/^co[nm]/.test(sp) && /^K (schwa|U|Uh|O|A) (N|M)$/.test(h3) && ph[3]?.c) ph.splice(1, 2);
  else if (/^e[xg]/.test(sp) && /^(Eh|E|ih) (K|G) S$/.test(h3)) ph.splice(1, 1);
  else if (/^(in|en|un|im|em)/.test(sp) && /^(Eh|ih|U|Uh|schwa|E) (N|M) (T|D)$/.test(h3)) ph.splice(0, 1);
  else if (/^(in|en|un|im|em)/.test(sp) && /^(Eh|ih|U|Uh|schwa|E) (N|M)$/.test(h2) && ph[2]?.c) ph.splice(0, 1);
  else if (/^al[^aeiouy]/.test(sp) && /^(O|A) L$/.test(h2) && ph[2]?.c) ph.splice(0, 2, { v: "O" });
  else if (/^(be|de|re|pro|per|pur|for|fur|mis|dis|des)[^aeiouy]/.test(sp) && ph[0]?.c && ph[1]?.v && isShort(ph[1].v) && ph[2]?.c) ph.splice(1, 1);
}

function normalizeAndOmitVowels(ph: Ph[], sp: string): Ph[] {
  const kept: Ph[] = [];
  const oShapedAA = (/(?:o|(?:w|qu)a)/.test(sp)) && !BROAD_A_SPELLING.test(sp);
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    const prev = kept[kept.length - 1], next = ph[i + 1];
    // American AA (hot, block, abdominal, want) is the Gregg O hook unless before r (car) or broad-a words
    if (p.aa && next?.c !== "R" && oShapedAA) { kept.push({ v: "O" }); continue; }
    if (p.v === "schwa" || p.v === "ih" || p.v === "er") {
      if (p.v === "er") { if (!prev) kept.push({ v: "Eh" }); kept.push({ c: "R" }); continue; }
      if (prev && (prev.c || prev.v === "I") && next?.c) continue;
      if (p.v === "schwa") {
        const init = i === 0 ? (sp.startsWith("a") ? "A" : sp.startsWith("o") ? "O" : "U") : i === ph.length - 1 ? "A" : "U";
        kept.push({ v: init });
      } else {
        kept.push({ v: "Eh" });
      }
      continue;
    }
    if (p.v === "ER") { kept.push({ v: "Eh" }, { c: "R" }); continue; }
    if (p.v === "Uh" && prev?.c && (next?.c === "N" || next?.c === "M")) continue; // son, come, summer
    kept.push(p);
  }
  return kept;
}

const toVowelCode = (v: string): VowelCode => (v === "Eh" ? "E" : v === "Uh" ? "U" : v) as VowelCode;

function applyBlends(kept: Ph[], sp: string): Token[] {
  const out: Token[] = [];
  const hasX = sp.includes("x");
  for (let i = 0; i < kept.length; i++) {
    const p = kept[i], n = kept[i + 1], n2 = kept[i + 2];
    if (p.v) { out.push({ k: "v", v: toVowelCode(p.v) }); continue; }
    const c = p.c!;
    if (c === "H") { out.push({ k: "h" }); continue; }
    if (c === "W") {
      // Medial w after a consonant before a vowel writes the w-dash under the vowel (quick, dwell)
      if (kept[i - 1]?.c && n?.v && W_VOWELS.has(n.v)) { out.push({ k: "v", v: toVowelCode(n.v), w: true }); i++; }
      else out.push({ k: "v", v: "U" });
      continue;
    }
    if (c === "Y") { if (n?.v === "U") { out.push({ k: "v", v: "YU" }); i++; } else out.push({ k: "c", s: "Y" }); continue; }
    if (isTD(p) && n && isShort(n.v) && isTD(n2)) { out.push({ k: "c", s: "TD" }); i += 2; continue; }
    if (isTD(p) && isTD(n)) { out.push({ k: "c", s: "TD" }); i += 1; continue; }
    if (isTD(p) && n && isShort(n.v) && n2?.c === "N") { out.push({ k: "c", s: "TN" }); i += 2; continue; }
    if (isTD(p) && n?.c === "N") { out.push({ k: "c", s: "TN" }); i += 1; continue; }
    if (isTD(p) && n && isShort(n.v) && n2?.c === "M") { out.push({ k: "c", s: "TM" }); i += 2; continue; }
    if (isTD(p) && n?.c === "M") { out.push({ k: "c", s: "TM" }); i += 1; continue; }
    if (c === "M" && n && isShort(n.v) && (n2?.c === "N" || n2?.c === "M")) { out.push({ k: "c", s: "MN" }); i += 2; continue; }
    if (c === "M" && (n?.c === "N" || n?.c === "M")) { out.push({ k: "c", s: "MN" }); i += 1; continue; }
    if (c === "N" && isTD(n)) { out.push({ k: "c", s: "NT" }); i += 1; continue; }
    if (c === "M" && isTD(n)) { out.push({ k: "c", s: "MT" }); i += 1; continue; }
    if (c === "D" && n && isShort(n.v) && (n2?.c === "F" || n2?.c === "V")) { out.push({ k: "c", s: "DF" }); i += 2; continue; }
    if (c === "D" && (n?.c === "F" || n?.c === "V")) { out.push({ k: "c", s: "DF" }); i += 1; continue; }
    if (c === "T" && n?.v === "Eh" && n2?.c === "V" && i >= kept.length - 3) { out.push({ k: "c", s: "DF" }); i += 2; continue; }
    if (c === "NG" && n?.c === "K") { out.push({ k: "c", s: "NK" }); i += 1; continue; }
    if (c === "K" && n?.c === "S" && hasX) { out.push({ k: "c", s: "X" }); i += 1; continue; }
    if (c === "S") {
      const prevC = kept[i - 1]?.c || "";
      const left = (n?.c && SL_NEIGHBORS.has(n.c)) || (!n?.v && SL_NEIGHBORS.has(prevC));
      out.push({ k: "c", s: left ? "SL" : "S" });
      continue;
    }
    out.push({ k: "c", s: c });
  }
  return out;
}

export function soundsToTokens(sounds: string[], series: Series, spelling = ""): Token[] {
  const ph: Ph[] = sounds.map((x) => (x in CONS ? { c: CONS[x] } : { v: V[x] || "A", aa: x === "a" }));
  const { sp, ending } = stripSuffixes(ph, spelling.toLowerCase());
  stripPrefixes(ph, sp);
  const kept = normalizeAndOmitVowels(ph, sp);
  const out = applyBlends(kept, sp);
  out.push(...ending);
  void series;
  return out;
}

/* ---------------- brief forms ---------------- */
// Written in a tiny code: consonant stroke keys and vowels (A E I O U OW OI YU), "." = -ing dot, "-" = dash, "h" = h dot.
// The 139 Centennial brief forms (162 words), as listed at greggshorthand.github.io/cenbfs.html, in this file's stroke codes.
const CENTENNIAL: Record<string, string> = {
  a: ".", an: ".", about: "A B", acknowledge: "A K", advantage: "A V", advertise: "A V T I S", after: "A F T", am: "M", and: "NT",
  anniversary: "A N E V", any: "N E", appropriate: "A P R O P", are: "R", our: "R", hour: "R", at: "T", it: "T", be: "B", by: "B",
  between: "B TN", business: "B S", but: "B T", can: "K", character: "K A K", circular: "S E R K", circumstance: "S TN S",
  communicate: "K K A T", company: "K P", convenience: "K V E N", convenient: "K V E N", correspond: "K R E S", correspondence: "K R E S",
  could: "K D", difficult: "DF K", direct: "D R K", during: "D R", dr: "D R", doctor: "D R", electric: "E L", enclose: "N K",
  envelope: "N V L", equip: "E K P", equivalent: "E K E V", ever: "E V", every: "E V", executive: "E S E K V", experience: "E S P",
  for: "F", from: "F M", general: "J E N", gentlemen: "J MN", glad: "G L", good: "G", govern: "G V", have: "V", his: "S", is: "S",
  however: "A U V", i: "A", idea: "A D E", immediate: "E M E", important: "M P", importance: "M P", in: "N", not: "N", include: "E D",
  incorporate: "E NK", insurance: "N SH", insure: "N SH", manufacture: "MN F", memorandum: "M E M O", morning: "MN .", mr: "M R",
  mrs: "M R S", ms: "M S", never: "N V", newspaper: "N S P", next: "N E S", object: "O B K", of: "O", office: "O F", opinion: "O P N",
  opportunity: "O P R", order: "O D", ordinary: "O TN", organize: "O G", over: "O", part: "P T", particular: "P A T", present: "P R",
  privilege: "P R E V", probable: "P R B", product: "P R O D", program: "P R O G", progress: "P R G", property: "P R P T E", public: "P B",
  publish: "P B SH", publication: "P B SH", quantity: "K T", question: "K SH", recognize: "R K N I S", recommend: "R E K", regard: "R E G D",
  regular: "R E G", reluctance: "R E L U K", reluctant: "R E L U K", request: "R K E S T", responsible: "R S P", satisfy: "S A T E S",
  satisfactory: "S A T E S", send: "S E N", several: "S E V", short: "SH T", should: "SH D", significant: "S E G N E F", significance: "S E G N E F",
  soon: "S N", speak: "S P", state: "S T", statistic: "S T A T", street: "S T R", subject: "S J", success: "S U K", suggest: "S U G",
  than: "TH N", thank: "TH .", that: "TH A", the: "TH", their: "TH", there: "TH", them: "TH M", they: "TH E", thing: "TH .", think: "TH .",
  this: "TH S", throughout: "TH R A U", time: "T E M", under: "U", usual: "E U SH", value: "V L", very: "V E", was: "O S", well: "L", will: "L",
  were: "E R", what: "O T", when: "E N", where: "A R", which: "CH", wish: "U SH", with: "E TH", won: "U N", one: "U N", work: "R K",
  world: "U U", worth: "U U TH", would: "D", yesterday: "E S T", you: "U", your: "U",
};
// Derivatives the book writes from the brief forms (Lesson 1 and common court words)
const CENTENNIAL_DERIVED: Record<string, string> = {
  acknowledgment: "A K M", disadvantage: "D S A V", advertisement: "A V T I S M", afternoon: "A F T N", appropriately: "A P R O P E",
  thanks: "TH . S", things: "TH . S", businesses: "B S S", ordered: "O D D", orders: "O D S", parts: "P T S", states: "S T S", questions: "K SH S",
  directed: "D R K TD", directly: "D R K E", generally: "J E N E", usually: "E U SH E", immediately: "E M E E", particularly: "P A T E",
  regularly: "R E G E", shortly: "SH T E", timely: "T E M E", worked: "R K T", works: "R K S", working: "R K .", speaking: "S P .",
  presented: "P R N TD", presence: "P R S", hours: "R S", years: "E R S", witness: "U E T N S", witnesses: "U E T N S S",
};
const SIMPLIFIED_EXTRA: Record<string, string> = {
  acknowledge: "A K", advantage: "A V J", advertise: "A V T", circular: "S K L", company: "K M P", correspond: "K R S", difficult: "D F K",
  enclose: "N K L", envelope: "N V", experience: "K S P R", idea: "I D", immediate: "M D", newspaper: "N P", next: "N E K S T",
  ordinary: "O D N", progress: "P R G", railroad: "R R", represent: "R P", stand: "S T N", wonder: "U N D", worth: "R TH",
};
const ANNIVERSARY_EXTRA: Record<string, string> = {
  according: "A K", accordingly: "A K E", agree: "A G R", allow: "A L", among: "M .", appear: "P R", appreciate: "P R SH", approximate: "P R K S",
  arrange: "A R J", assist: "A S", attention: "A T N", believe: "B L", bring: "B R .", character: "K R K", charge: "CH J",
  collect: "K L", consider: "K S", definite: "D F", deliver: "D L", desire: "D S", determine: "D T M", difference: "D F R",
  direct: "D R", doctor: "D K", effect: "E F", especially: "E S P", establish: "E S T", examine: "K S M", explain: "K S P L",
  familiar: "F M", favor: "F V", friend: "F R N D", future: "F U", history: "H S T", house: "H OW S", include: "N K L",
  individual: "N D V", influence: "N F L", inform: "N F", instruct: "N S T R", insurance: "N SH R", intelligence: "N T L",
  interest: "N T R", knowledge: "N L", language: "L NG", letter: "L T R", material: "M T R", matter: "M T R", member: "M B R",
  memorandum: "M M", merchandise: "M CH", million: "M L", nevertheless: "N V TH L", notwithstanding: "N TH S", number: "N M",
  obtain: "O B T", office: "O F S", opportunity: "O P T N", perfect: "P R F", perhaps: "P R H P S", piece: "P E S",
  please: "P L S", poor: "P R", possible: "P S B", president: "P R S D", principal: "P R N S", prove: "P R V", receive: "R S V",
  remember: "R M B R", return: "R T N", satisfied: "S A T", secretary: "S K R", special: "S P SH", standard: "S T N D",
  strength: "S T R NG", surprise: "S P R S", system: "S S T", throughout_: "", together: "T G", unable: "N B", wonderful: "U N D F",
};
export function briefForms(series: Series): Record<string, string> {
  const base = { ...CENTENNIAL, ...CENTENNIAL_DERIVED };
  if (series === "simplified" || series === "anniversary") Object.assign(base, SIMPLIFIED_EXTRA);
  if (series === "anniversary") Object.assign(base, ANNIVERSARY_EXTRA);
  for (const k of Object.keys(base)) if (!base[k] || k.endsWith("_")) delete base[k];
  return base;
}
const VOWEL_CODES = new Set(["A", "E", "EF", "I", "O", "U", "OW", "OI", "YU"]);
export function codeToTokens(code: string): Token[] {
  const out: Token[] = [];
  for (const part of code.trim().split(/\s+/)) {
    if (!part) continue;
    if (part === ".") out.push({ k: "dot" });
    else if (part === "-") out.push({ k: "dash" });
    else if (part === "h" || part === "H") out.push({ k: "h" });
    else if (part === "~s") out.push({ k: "dis", m: "s" });
    else if (part === "~e") out.push({ k: "dis", m: "e" });
    else if (part.endsWith("_") && VOWEL_CODES.has(part.slice(0, -1))) out.push({ k: "v", v: part.slice(0, -1) as never, w: true });
    else if (VOWEL_CODES.has(part)) out.push({ k: "v", v: part as never });
    else out.push({ k: "c", s: part });
  }
  return out;
}
export function tokensToCode(tokens: Token[]): string {
  return tokens.map((t) => (t.k === "c" ? t.s : t.k === "v" ? t.v + (t.w ? "_" : "") : t.k === "dot" ? "." : t.k === "dash" ? "-" : t.k === "dis" ? "~" + t.m : "h")).join(" ");
}
