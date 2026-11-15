/* Puts the pieces together: text -> words -> outlines, plus the dictionary loader. */
import { outlineFor, type Outline, type Token } from "./strokes";
import { ABBREVIATIONS, briefForms, codeToTokens, englishToSounds, filipinoToSounds, soundsToTokens, type Series } from "./rules";

export type Source = "brief" | "custom" | "dict" | "filipino" | "guess" | "plain";
export type Word = {
  text: string;            // as written, with punctuation
  word: string;            // the bare word that was looked up
  source: Source;
  tokens: Token[];
  outline: Outline | null; // null for plain text (numbers, symbols)
  sounds?: string[];
};

let DICT: Map<string, string> | null = null;
let loading: Promise<Map<string, string>> | null = null;
export function loadDictionary(url = "/dict/cmu.txt"): Promise<Map<string, string>> {
  if (DICT) return Promise.resolve(DICT);
  if (!loading) {
    loading = fetch(url).then((r) => { if (!r.ok) throw new Error("dictionary " + r.status); return r.text(); }).then((t) => {
      const m = new Map<string, string>();
      for (const line of t.split("\n")) { const i = line.indexOf(" "); if (i > 0) m.set(line.slice(0, i), line.slice(i + 1)); }
      DICT = m; return m;
    }).catch((e) => { loading = null; throw e; });
  }
  return loading;
}
export const dictionaryReady = () => !!DICT;

// Words that look like Filipino or Spanish names: capitalised, not in the dictionary, spelled with Spanish letter patterns.
const FILIPINO_HINT = /(ñ|^[A-Z][a-z]*(ng|ay|oy|ao|ia|io|ua|ue|ui|illa|illo|ez|es|ano|ino|ena|ina|ita|ito)$|^(?:Ma|Ca|Ba|Da|Ga|La|Pa|Sa|Ta|Na|Ra|Ja|Cab|Dal|Mag|Tal|Bal)[a-z]{3,})/;
export function looksFilipino(word: string) { return /^[A-ZÑ]/.test(word) && FILIPINO_HINT.test(word); }

export type Options = { series: Series; custom?: Record<string, string>; namesAsFilipino?: boolean };

export function renderWord(raw: string, opt: Options): Word {
  const text = raw;
  const m = /^([^A-Za-zÀ-ÿ0-9]*)([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'’-]*)?(.*)$/.exec(raw);
  const core = (m && m[2]) || "";
  if (!core || /\d/.test(core)) return { text, word: core, source: "plain", tokens: [], outline: null };
  const key = core.toLowerCase().replace(/’/g, "'").replace(/^'+|'+$/g, "");
  const briefs = briefForms(opt.series);
  const custom = opt.custom || {};
  let tokens: Token[] | null = null, source: Source = "dict", sounds: string[] | undefined;
  if (custom[key]) { tokens = codeToTokens(custom[key]); source = "custom"; }
  else if (briefs[key]) { tokens = codeToTokens(briefs[key]); source = "brief"; }
  else {
    // hyphenated and possessive words
    const base = key.replace(/'s$/, "");
    const plural = base !== key;
    const expand = ABBREVIATIONS[base];
    if (expand) {
      const parts = expand.toLowerCase().split(" ");
      tokens = parts.flatMap((p) => lookup(p, opt).tokens); source = "dict";
    } else {
      const r = lookup(base, opt); tokens = r.tokens; source = r.source; sounds = r.sounds;
    }
    if (plural) tokens = tokens.concat([{ k: "c", s: "S" }]);
  }
  const outline = tokens.length ? outlineFor(tokens) : null;
  return { text, word: core, source: outline ? source : "plain", tokens, outline, sounds };
}

function lookup(word: string, opt: Options): { tokens: Token[]; source: Source; sounds?: string[] } {
  const parts = word.split("-").filter(Boolean);
  if (parts.length > 1) {
    const rs = parts.map((p) => lookup(p, opt));
    return { tokens: rs.flatMap((r) => r.tokens), source: rs.some((r) => r.source === "guess") ? "guess" : rs.some((r) => r.source === "filipino") ? "filipino" : "dict" };
  }
  const entry = DICT && DICT.get(word);
  if (entry) return { tokens: soundsToTokens(entry.split(""), opt.series, word), source: "dict", sounds: entry.split("") };
  // single letters (initials): spell them out as the letter's name
  if (word.length === 1) { const e = DICT && DICT.get(word); return { tokens: e ? soundsToTokens(e.split(""), opt.series) : [], source: "guess" }; }
  const cap = word[0];
  const isName = opt.namesAsFilipino !== false && (looksFilipino(cap.toUpperCase() + word.slice(1)) || !/[aeiouy]{2}|th|wh|ck|gh|ee|oo/.test(word));
  const sounds = isName ? filipinoToSounds(word) : englishToSounds(word);
  return { tokens: soundsToTokens(sounds, opt.series, word), source: isName ? "filipino" : "guess", sounds };
}

/* ---------------- text -> paragraphs of words ---------------- */
export type Para = { words: Word[]; text: string };
export function renderText(text: string, opt: Options): Para[] {
  const paras = text.replace(/\r/g, "").split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  return paras.map((p) => ({ text: p, words: p.split(/\s+/).map((w) => renderWord(w, opt)) }));
}

/* ---------------- reading the source document ---------------- */
import * as fflate from "fflate";
export function docxText(u8: Uint8Array): string {
  const files = fflate.unzipSync(u8, { filter: (f) => f.name === "word/document.xml" });
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("This file is not a Word .docx document.");
  const xml = fflate.strFromU8(doc);
  const out: string[] = [];
  const reP = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  const dec = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");
  while ((m = reP.exec(xml))) {
    let t = "";
    const reT = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g;
    let k: RegExpExecArray | null;
    while ((k = reT.exec(m[0]))) t += k[1] !== undefined ? dec(k[1]) : " ";
    if (t.trim()) out.push(t.replace(/\s+/g, " ").trim());
  }
  return out.join("\n");
}
