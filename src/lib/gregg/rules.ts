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

export function soundsToTokens(sounds: string[], series: Series, spelling = ""): Token[] {
  type P = { c?: string; v?: string };
  const ph: P[] = sounds.map((x) => (x in CONS ? { c: CONS[x] } : { v: V[x] || "A" }));
  let sp = spelling.toLowerCase();
  const tail = (n: number) => ph.slice(-n).map((q) => q.c || q.v).join(" ");
  const head = (n: number) => ph.slice(0, n).map((q) => q.c || q.v).join(" ");
  const isShort = (v?: string) => !!v && SHORT_V.has(v);

  /* ---- word endings (Diamond Jubilee / Centennial theory). Applied from the end inwards. */
  const ending: Token[] = [];
  const put = (...t: Token[]) => ending.unshift(...t);
  for (let pass = 0; pass < 3; pass++) {
    const t2 = tail(2), t3 = tail(3), t4 = tail(4);
    if (/ingly$/.test(sp) && ph.length > 4 && /^(ih|Eh) NG L (E|Eh)$/.test(t4)) { ph.splice(-4); sp = sp.slice(0, -5); put({ k: "dis", m: "e" }); }
    else if (/[^aeiou]ily$/.test(sp) && ph.length > 3 && /^L (E|Eh)$/.test(t2)) { ph.splice(-2); if (ph.length > 1 && isShort(ph[ph.length - 1].v)) ph.splice(-1); sp = sp.slice(0, -3); put({ k: "v", v: "EF" }); }
    else if (/ly$/.test(sp) && ph.length > 2 && /^L (E|Eh)$/.test(t2)) { ph.splice(-2); sp = sp.slice(0, -2); put({ k: "v", v: "E" }); }
    else if (/ings$/.test(sp) && ph.length > 4 && /^(ih|Eh) NG S$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -4); put({ k: "dis", m: "s" }); }
    else if (/ing$/.test(sp) && ph.length > 3 && /^(ih|Eh) NG$/.test(t2)) { ph.splice(-2); sp = sp.slice(0, -3); put({ k: "dot" }); }
    else if (/[st]ions?$/.test(sp) && ph.length > 3 && (/^SH (schwa|Eh|ih) N$/.test(t3) || /^SH (schwa|Eh|ih) N S$/.test(tail(4)))) { const pl = /s$/.test(sp); ph.splice(pl ? -4 : -3); sp = sp.replace(/[st]ions?$/, ""); put({ k: "c", s: "SH" }, ...(pl ? [{ k: "c", s: "S" } as Token] : [])); }
    else if (/[st]ion$/.test(sp) && ph.length > 2 && /^SH N$/.test(t2)) { ph.splice(-2); sp = sp.replace(/[st]ion$/, ""); put({ k: "c", s: "SH" }); }
    else if (/ful$/.test(sp) && ph.length > 3 && /^F (schwa|U|Uh|ih|Eh) L$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -3); put({ k: "c", s: "F" }); }
    else if (/ble$/.test(sp) && ph.length > 3 && /^B (schwa|U|Uh|ih|Eh) L$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -3); put({ k: "c", s: "B" }); }
    else if (/ther$/.test(sp) && ph.length > 2 && /^TH (er|ER)$/.test(t2)) { ph.splice(-2); sp = sp.slice(0, -4); put({ k: "c", s: "TH" }); }
    else if (/ship$/.test(sp) && ph.length > 3 && /^SH (ih|Eh) P$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -4); put({ k: "c", s: "SH" }); }
    else if (/ward$/.test(sp) && ph.length > 3 && /^W (er|ER|O) D$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -4); put({ k: "c", s: "D" }); }
    else if (/hood$/.test(sp) && ph.length > 3 && /^H U D$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -4); put({ k: "c", s: "D" }); }
    else if (/selves$/.test(sp) && ph.length > 5 && /^S (Eh|E) L V S$/.test(tail(5))) { ph.splice(-5); sp = sp.slice(0, -6); put({ k: "c", s: "S" }, { k: "c", s: "S" }); }
    else if (/self$/.test(sp) && ph.length > 4 && /^S (Eh|E) L F$/.test(t4)) { ph.splice(-4); sp = sp.slice(0, -4); put({ k: "c", s: "S" }); }
    else if (/[ct]ial$/.test(sp) && ph.length > 3 && /^SH (schwa|U|Uh|ih|Eh) L$/.test(t3)) { ph.splice(-3); sp = sp.replace(/[ct]ial$/, ""); put({ k: "c", s: "SH" }); }
    else if (/(lity|rity)$/.test(sp) && ph.length > 4 && /^(L|R) (ih|Eh|schwa) T (E|Eh)$/.test(t4)) { const c = ph[ph.length - 4].c!; ph.splice(-4); sp = sp.slice(0, -4); put({ k: "c", s: c }); }
    else if (/(cal|cle)$/.test(sp) && ph.length > 3 && /^K (schwa|U|Uh|ih|Eh) L$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -3); put({ k: "c", s: "K" }); }
    else if (/ual$/.test(sp) && ph.length > 3 && /^(U|YU|W) (schwa|U|Uh) L$/.test(t3)) { ph.splice(-3); sp = sp.slice(0, -3); put({ k: "c", s: "L" }); }
    else break;
  }

  /* ---- word beginnings */
  const h3 = head(3), h2 = head(2);
  if (/^co[nm]/.test(sp) && /^K (schwa|U|Uh|O|A) (N|M)$/.test(h3) && ph[3] && ph[3].c) ph.splice(1, 2);                 // con-, com- = k
  else if (/^e[xg]/.test(sp) && /^(Eh|E|ih) (K|G) S$/.test(h3)) ph.splice(1, 1);                                     // ex- = e s
  else if (/^(in|en|un|im|em)/.test(sp) && /^(Eh|ih|U|Uh|schwa|E) (N|M) (T|D)$/.test(h3)) ph.splice(0, 1);             // inter-, ent-, ind- = nt blend
  else if (/^(in|en|un|im|em)/.test(sp) && /^(Eh|ih|U|Uh|schwa|E) (N|M)$/.test(h2) && ph[2] && ph[2].c) ph.splice(0, 1); // in-, en-, un- = n
  else if (/^al[^aeiouy]/.test(sp) && /^(O|A) L$/.test(h2) && ph[2] && ph[2].c) ph.splice(0, 2, { v: "O" });        // al- = o
  else if (/^(be|de|re|pro|per|pur|for|fur|mis|dis|des)[^aeiouy]/.test(sp) && ph[0] && ph[0].c && ph[1] && ph[1].v && isShort(ph[1].v) && ph[2] && ph[2].c) ph.splice(1, 1); // prefix vowel omitted

  /* ---- vowel omission: unstressed minor vowels between consonants; short u before n and m */
  const kept: P[] = [];
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    if (p.v === "schwa" || p.v === "ih" || p.v === "er") {
      const prev = kept[kept.length - 1], next = ph[i + 1];
      const between = prev && prev.c && next && next.c;
      if (p.v === "er") { if (!prev) kept.push({ v: "Eh" }); kept.push({ c: "R" }); continue; } // letter, summer: r alone
      if (between) continue;
      kept.push({ v: p.v === "schwa" ? (i === ph.length - 1 ? "A" : "U") : "Eh" });
      continue;
    }
    if (p.v === "ER") { kept.push({ v: "Eh" }, { c: "R" }); continue; }
    if (p.v === "Uh" && kept.length && kept[kept.length - 1].c && ph[i + 1] && (ph[i + 1].c === "N" || ph[i + 1].c === "M")) continue; // son, come, summer
    kept.push(p);
  }

  /* ---- blends and special consonants */
  const out: Token[] = [];
  for (let i = 0; i < kept.length; i++) {
    const p = kept[i], n = kept[i + 1], n2 = kept[i + 2];
    if (p.v) { out.push({ k: "v", v: (p.v === "Eh" ? "E" : p.v === "Uh" ? "U" : p.v) as never }); continue; }
    const c = p.c!;
    if (c === "H") { out.push({ k: "h" }); continue; }
    if (c === "W") { out.push({ k: "v", v: "U" }); continue; }
    if (c === "Y") { if (n && n.v === "U") { out.push({ k: "v", v: "YU" }); i++; } else out.push({ k: "c", s: "Y" }); continue; }
    const TD = (x?: P) => !!x && (x.c === "T" || x.c === "D");
    if (TD(p) && n && isShort(n.v) && TD(n2)) { out.push({ k: "c", s: "TD" }); i += 2; continue; }
    if (TD(p) && TD(n)) { out.push({ k: "c", s: "TD" }); i += 1; continue; }
    if (TD(p) && n && isShort(n.v) && n2 && n2.c === "N") { out.push({ k: "c", s: "TN" }); i += 2; continue; }
    if (TD(p) && n && n.c === "N") { out.push({ k: "c", s: "TN" }); i += 1; continue; }
    if (TD(p) && n && isShort(n.v) && n2 && n2.c === "M") { out.push({ k: "c", s: "TM" }); i += 2; continue; }
    if (TD(p) && n && n.c === "M") { out.push({ k: "c", s: "TM" }); i += 1; continue; }
    if (c === "M" && n && isShort(n.v) && n2 && (n2.c === "N" || n2.c === "M")) { out.push({ k: "c", s: "MN" }); i += 2; continue; }
    if (c === "M" && n && (n.c === "N" || n.c === "M")) { out.push({ k: "c", s: "MN" }); i += 1; continue; }
    if (c === "N" && TD(n)) { out.push({ k: "c", s: "NT" }); i += 1; continue; }
    if (c === "M" && TD(n)) { out.push({ k: "c", s: "MT" }); i += 1; continue; }
    if (c === "D" && n && isShort(n.v) && n2 && (n2.c === "F" || n2.c === "V")) { out.push({ k: "c", s: "DF" }); i += 2; continue; }
    if (c === "D" && n && (n.c === "F" || n.c === "V")) { out.push({ k: "c", s: "DF" }); i += 1; continue; }
    if (c === "T" && n && n.v === "Eh" && n2 && n2.c === "V" && i >= kept.length - 3) { out.push({ k: "c", s: "DF" }); i += 2; continue; } // -tive
    if (c === "NG" && n && n.c === "K") { out.push({ k: "c", s: "NK" }); i += 1; continue; }
    if (c === "S") {
      const nb = (n && n.c) || (kept[i - 1] && kept[i - 1].c) || "";
      out.push({ k: "c", s: ["K", "G", "F", "V", "SH", "CH", "J"].includes(nb) ? "SL" : "S" });
      continue;
    }
    out.push({ k: "c", s: c });
  }
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
    else if (VOWEL_CODES.has(part)) out.push({ k: "v", v: part as never });
    else out.push({ k: "c", s: part });
  }
  return out;
}
export function tokensToCode(tokens: Token[]): string {
  return tokens.map((t) => (t.k === "c" ? t.s : t.k === "v" ? t.v : t.k === "dot" ? "." : t.k === "dash" ? "-" : t.k === "dis" ? "~" + t.m : "h")).join(" ");
}
