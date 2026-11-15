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
  a: "A", "@": "A", "^": "U", "0": "schwa", c: "O", W: "OW", I: "I", e: "Eh", R: "ER", "9": "er", A: "A", i: "Eh", "1": "ih", E: "E", O: "O", Y: "OI", u: "U", U: "U",
};
// consonants
const CONS: Record<string, string> = {
  b: "B", C: "CH", d: "D", D: "TH", f: "F", g: "G", h: "H", J: "J", k: "K", l: "L", m: "M", n: "N", G: "NG", p: "P", r: "R", s: "S", S: "SH", t: "T", T: "TH", v: "V", w: "W", y: "Y", z: "S", Z: "SH",
};
export const isVowelCode = (c: string) => c in V;

export type Series = "centennial" | "simplified" | "anniversary";
export const SERIES: { id: Series; name: string; note: string }[] = [
  { id: "centennial", name: "Centennial (1988)", note: "The series of Gregg Shorthand College Book 2, Centennial Edition." },
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
const SHORT = new Set(["Eh", "schwa", "ih", "er", "U"]);
const ABBREV: Record<string, string> = {
  atty: "attorney", attys: "attorneys", hon: "honorable", mr: "mister", mrs: "missus", ms: "miss", dr: "doctor", sps: "spouses", hrs: "heirs",
  no: "number", nos: "numbers", vs: "versus", exh: "exhibit", brgy: "barangay", pros: "prosecutor", engr: "engineer", jr: "junior", sr: "senior",
  mtcc: "M T C C", rtc: "R T C", tsn: "T S N", pssg: "P S S G", pmsg: "P M S G", st: "street", ave: "avenue",
};
export const ABBREVIATIONS = ABBREV;

export function soundsToTokens(sounds: string[], series: Series): Token[] {
  // 1. decode into a list of {type:'c'|'v', code}
  type P = { c?: string; v?: string };
  const ph: P[] = sounds.map((s) => (s in CONS ? { c: CONS[s] } : { v: V[s] || "A" }));
  // suffix -ing / -ings
  let ing: "dot" | "dash" | null = null;
  const tail = (n: number) => ph.slice(-n).map((p) => p.c || p.v).join(" ");
  if (ph.length > 3 && (tail(2) === "ih NG" || tail(2) === "Eh NG")) { ph.splice(-2); ing = "dot"; }
  else if (ph.length > 4 && (tail(3) === "ih NG S" || tail(3) === "Eh NG S")) { ph.splice(-3); ing = "dash"; }
  // 2. vowel omission: schwa and unstressed ih/er between consonants are left out (Gregg minor-vowel rule)
  const kept: P[] = [];
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    if (p.v === "schwa" || p.v === "ih" || p.v === "er") {
      const prev = kept[kept.length - 1], next = ph[i + 1];
      const between = prev && prev.c && next && next.c;
      if (p.v === "er") { if (!between) kept.push({ v: "E" }); kept.push({ c: "R" }); continue; }
      if (between) continue;
      kept.push({ v: p.v === "schwa" ? (i === ph.length - 1 ? "A" : "U") : "E" });
      continue;
    }
    if (p.v === "ER") { kept.push({ v: "E" }, { c: "R" }); continue; }
    kept.push(p);
  }
  // 3. blends and special consonants
  const out: Token[] = [];
  const useBlends = true;
  for (let i = 0; i < kept.length; i++) {
    const p = kept[i], n = kept[i + 1], n2 = kept[i + 2];
    if (p.v) { out.push({ k: "v", v: (p.v === "Eh" ? "E" : p.v) as never }); continue; }
    const c = p.c!;
    if (c === "H") { out.push({ k: "h" }); continue; }
    if (c === "W") { out.push({ k: "v", v: "U" }); continue; }          // w = oo hook
    if (c === "Y") { if (n && n.v === "U") { out.push({ k: "v", v: "YU" }); i++; } else out.push({ k: "c", s: "Y" }); continue; }
    if (useBlends) {
      if ((c === "T" || c === "D") && n && n.v && SHORT.has(n.v) && n2 && n2.c === "N" && series !== "anniversary") { out.push({ k: "c", s: "TN" }); i += 2; continue; }
      if ((c === "T" || c === "D") && n && n.c === "N") { out.push({ k: "c", s: "TN" }); i += 1; continue; }
      if ((c === "T" || c === "D") && n && n.v && SHORT.has(n.v) && n2 && n2.c === "M") { out.push({ k: "c", s: "TM" }); i += 2; continue; }
      if (c === "M" && n && n.v && SHORT.has(n.v) && n2 && (n2.c === "N" || n2.c === "M")) { out.push({ k: "c", s: "MN" }); i += 2; continue; }
      if (c === "N" && n && (n.c === "T" || n.c === "D")) { out.push({ k: "c", s: "NT" }); i += 1; continue; }
      if (c === "M" && n && (n.c === "T" || n.c === "D")) { out.push({ k: "c", s: "MT" }); i += 1; continue; }
      if (c === "D" && n && n.v && SHORT.has(n.v) && n2 && (n2.c === "F" || n2.c === "V")) { out.push({ k: "c", s: "DF" }); i += 2; continue; }
      if (c === "T" && n && n.v === "Eh" && n2 && n2.c === "V" && i >= kept.length - 3) { out.push({ k: "c", s: "DF" }); i += 2; continue; } // -tive
      if (c === "NG" && n && n.c === "K") { out.push({ k: "c", s: "NK" }); i += 1; continue; }
    }
    if (c === "S") {
      // left s joins inside k, g, f, v and before/after circles; the comma s goes with p, b, r, l and straight strokes
      const nb = (n && n.c) || (kept[i - 1] && kept[i - 1].c) || "";
      out.push({ k: "c", s: ["K", "G", "F", "V", "SH", "CH", "J"].includes(nb) ? "SL" : "S" });
      continue;
    }
    out.push({ k: "c", s: c });
  }
  if (ing) out.push({ k: ing });
  return out;
}

/* ---------------- brief forms ---------------- */
// Written in a tiny code: consonant stroke keys and vowels (A E I O U OW OI YU), "." = -ing dot, "-" = dash, "h" = h dot.
const CENTENNIAL: Record<string, string> = {
  a: "A", an: "A", the: "TH", of: "O", and: "NT", to: "T", in: "N", not: "N", is: "S", his: "S", it: "T", at: "T",
  for: "F", you: "U", your: "U", i: "I", are: "R", our: "R", hour: "R", will: "L", well: "L", can: "K", good: "G",
  be: "B", by: "B", but: "B", have: "V", with: "TH", which: "CH", was: "U S", one: "U N", won: "U N", this: "TH S",
  there: "TH R", their: "TH R", they: "TH A", that: "TH A T", them: "TH M", then: "TH N", than: "TH N", think: "TH .", thing: "TH .",
  those: "TH O S", through: "TH R U", throughout: "TH R U T", about: "A B", after: "A F", am: "M", more: "M", any: "N E",
  before: "B F", between: "B T N", business: "B S", could: "K D", during: "D U", ever: "E V", every: "E V", from: "F R",
  general: "J N", gentlemen: "J", glad: "G L", govern: "G V", government: "G V MT", great: "G R", how: "OW", out: "OW T",
  importance: "M P", important: "M P", manufacture: "M F", morning: "M R", mr: "M R", mrs: "M R S", never: "N V",
  object: "O B", opinion: "O P N", order: "O D", organize: "O G", over: "O V", part: "P T", particular: "P T K",
  present: "P R", probable: "P R B", public: "P B", publish: "P B", purpose: "P R P", question: "K W", quantity: "K T",
  recognize: "R K", regard: "R G", regular: "R G L", request: "R K W", responsible: "R S P", satisfy: "S A T", satisfactory: "S A T",
  several: "S V", shall: "SH", ship: "SH", short: "SH T", should: "SH D", soon: "S N", speak: "S P", state: "S T",
  street: "S T R", subject: "S B", success: "S K", suggest: "S J", thank: "TH K", time: "T M", under: "N D", upon: "P N",
  usual: "U SH", value: "V L", very: "V E", want: "U NT", where: "U A R", wish: "U SH", why: "I", work: "R K", world: "R L D",
  would: "U D", year: "E R", yesterday: "E S T", yet: "E T", young: "U NG", when: "U N", where_: "", what: "U T", were: "U R",
  she: "SH", he: "E", we: "U E", me: "M E", my: "M I", us: "U S", so: "S O", no: "N O", do: "D U", go: "G O", if: "E F",
  or: "O R", as: "A S", has: "A S", had: "A D", been: "B N", did: "D D", does: "D S", done: "D N", get: "G T", give: "G V",
  know: "N O", let: "L T", like: "L I K", made: "M A D", make: "M A K", many: "M N E", may: "M A", much: "M CH", must: "M S T",
  other: "O TH R", own: "O N", say: "S A", see: "S E", still: "S T L", such: "S CH", take: "T A K", tell: "T L", these: "TH E S",
  use: "YU S", way: "U A", who: "H U", whom: "H U M", why_: "", yes: "E S", honor: "O N R", honorable: "O N R B", court: "K O R T",
  witness: "U T N S", counsel: "K N S L", exhibit: "K S B", objection: "O B J", sustained: "S S T N D", overruled: "O V R L D",
  plaintiff: "P L N T F", defendant: "D F N T", accused: "K YU S D", prosecution: "P R S K SH", testimony: "T S T M N E",
  attorney: "A T R N E", evidence: "E V D N S", hearing: "H E R .", case: "K A S", madam: "M D M", sir: "S R", correct: "K R K T",
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
  const base = { ...CENTENNIAL };
  if (series === "simplified" || series === "anniversary") Object.assign(base, SIMPLIFIED_EXTRA);
  if (series === "anniversary") Object.assign(base, ANNIVERSARY_EXTRA);
  for (const k of Object.keys(base)) if (!base[k] || k.endsWith("_")) delete base[k];
  return base;
}
const VOWEL_CODES = new Set(["A", "E", "I", "O", "U", "OW", "OI", "YU"]);
export function codeToTokens(code: string): Token[] {
  const out: Token[] = [];
  for (const part of code.trim().split(/\s+/)) {
    if (!part) continue;
    if (part === ".") out.push({ k: "dot" });
    else if (part === "-") out.push({ k: "dash" });
    else if (part === "h" || part === "H") out.push({ k: "h" });
    else if (VOWEL_CODES.has(part)) out.push({ k: "v", v: part as never });
    else out.push({ k: "c", s: part });
  }
  return out;
}
export function tokensToCode(tokens: Token[]): string {
  return tokens.map((t) => (t.k === "c" ? t.s : t.k === "v" ? t.v : t.k === "dot" ? "." : t.k === "dash" ? "-" : "h")).join(" ");
}
