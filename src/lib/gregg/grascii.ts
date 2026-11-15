/*
 * Draws outlines with the Grascii font (SIL OFL, github.com/grascii/font). The engine still decides which
 * strokes a word has; this module writes them in Grascii notation, lets the font pick the joining shapes,
 * and returns the shaped glyph outlines as an SVG path in the same units the rest of the app uses.
 */
import type { Outline, Pt, Token } from "./strokes";
import type { Series } from "./rules";

type Info = { codepoint: number };
type Pos = { xAdvance: number; yAdvance: number; xOffset: number; yOffset: number };
type Font = { shape(text: string): { infos: Info[]; positions: Pos[] }; path(gid: number): string };

type HB = typeof import("harfbuzzjs");

/** Wraps a HarfBuzz font. The font needs real OpenType shaping: fontkit mispositions its cursive joins. */
export async function makeFont(bytes: Uint8Array, hb: HB): Promise<Font> {
  const f = new hb.Font(new hb.Face(new hb.Blob(bytes)));
  const buf = new hb.Buffer(); // reuse one buffer so long documents do not leak HarfBuzz allocations
  return {
    shape(text) {
      buf.reset();
      buf.addText(text);
      buf.guessSegmentProperties();
      hb.shape(f, buf);
      return { infos: buf.getGlyphInfos(), positions: buf.getGlyphPositions() };
    },
    path: (gid) => f.glyphToPath(gid),
  };
}

let font: Font | null = null;
let loading: Promise<Font | null> | null = null;

export function loadGrasciiFont(url = "/fonts/Grascii-Regular.otf"): Promise<Font | null> {
  if (font) return Promise.resolve(font);
  if (!loading) {
    loading = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("font " + res.status);
      // HarfBuzz is served from /public so the bundler leaves its WebAssembly loader alone
      const hb = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/hb/index.mjs" as string)) as HB;
      font = await makeFont(new Uint8Array(await res.arrayBuffer()), hb);
      return font;
    })().catch(() => { loading = null; return null; });
  }
  return loading;
}
export const setGrasciiFont = (f: Font | null) => { font = f; };
export const grasciiReady = () => !!font;

/** Extra stroke width (stroke units) added around the filled glyphs so the pen line reads at pad and PDF sizes. */
export const EMBOLDEN = 0.035;
const UNIT = 1 / 320; // font units -> stroke units (a Gregg L is about 2.6 units long)

const CONS: Record<string, string> = {
  K: "K", G: "G", R: "R", L: "L", N: "N", M: "M", MN: "MN", NG: "NG", NK: "NK", T: "T", D: "D",
  TN: "TN", TM: "TM", TD: "TD", NT: "NT", MT: "MT", TH: "TH", P: "P", B: "B", F: "F", V: "V", DF: "DF",
  SH: "SH", CH: "CH", J: "J", S: "S", SL: "S(", X: "X", Y: "E",
};
const VOW: Record<string, string> = { A: "A", E: "E", EF: "E", I: "I", O: "O", U: "U", OW: "AU", OI: "OE", YU: "EU" };
// Blends Grascii would read as one stroke if the letters touch; a boundary keeps two strokes apart.
const BLENDS = ["NT", "ND", "MT", "MD", "TN", "DN", "TM", "DM", "MN", "MM", "DT", "TD", "DD", "DF", "DV", "TV", "NG", "NK", "LD", "SS", "SH", "CH", "TH"];

function straddles(a: string, b: string): boolean {
  const j = a + b;
  return BLENDS.some((bl) => {
    for (let i = 0; i + bl.length <= j.length; i++) {
      if (j.startsWith(bl, i) && i < a.length && i + bl.length > a.length) return true;
    }
    return false;
  });
}

/** Tokens -> Grascii. `dot`/`dash`/`dis` hold marks the font cannot place (standalone dot, mid-word dot, -ings dash, disjoined endings). */
export function tokensToGrascii(tokens: Token[], series: Series): { code: string; dot: boolean; dash: boolean; dis: string | null } | null {
  let code = "", prevCons: string | null = null;
  let dot = false, dash = false, dis: string | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.k === "dot") {
      // A trailing -ing dot uses Grascii's positioned "'" mark; standalone ("a"/"an") or mid-word dots draw as circles.
      if (code && i === tokens.length - 1) { code += "'"; prevCons = null; } else { dot = true; }
      continue;
    }
    if (t.k === "dash") { dash = true; continue; }
    if (t.k === "dis") { dis = t.m === "s" ? "S(" : "E"; continue; }
    if (t.k === "h") { code += "'"; prevCons = null; continue; }
    if (t.k === "c") {
      if (t.s === "Y") {
        const next = tokens[i + 1];
        if (next && next.k === "v" && (next.v === "E" || next.v === "EF")) continue; // ye- is one small circle, not ee
      }
      const g = CONS[t.s];
      if (!g) return null;
      if (prevCons && (straddles(prevCons, g) || (prevCons === "SH" && g === "S("))) code += "-";
      code += g; prevCons = g;
      continue;
    }
    const v = VOW[t.v];
    if (!v) return null;
    code += v + (t.w ? "_" : ""); prevCons = null;
    // From Diamond Jubilee on, o is not placed on its side before r or l: a boundary after o stops the 1916 joining.
    if (t.v === "O" && series !== "anniversary") {
      const n = tokens[i + 1];
      if (n && n.k === "c" && (n.s === "R" || n.s === "L")) code += "-";
    }
  }
  return code || dot || dash || dis ? { code, dot, dash, dis } : null;
}

/** Shape `code` and return its outline as an SVG path (y down, baseline at y = 0) starting at x = x0. */
function shape(code: string, x0: number): { d: string; x1: number; box: [Pt, Pt] } | null {
  if (!font) return null;
  const { infos, positions } = font.shape(code.toLowerCase());
  let pen = 0, d = "";
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
  for (let i = 0; i < infos.length; i++) {
    const gid = infos[i].codepoint, p = positions[i];
    if (gid === 0) return null; // .notdef: the font cannot write this
    const ox = pen + p.xOffset, oy = p.yOffset;
    // glyph paths are absolute commands in font units, y up: shift to the pen, flip y, scale
    let k = 0;
    d += font.path(gid).replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (num) => {
      const v = parseFloat(num), isX = k++ % 2 === 0;
      const out = isX ? x0 + (ox + v) * UNIT : -(oy + v) * UNIT;
      if (isX) { minX = Math.min(minX, out); maxX = Math.max(maxX, out); } else { minY = Math.min(minY, out); maxY = Math.max(maxY, out); }
      return n(out);
    });
    pen += p.xAdvance;
  }
  if (!d || !isFinite(minX)) return null;
  return { d, x1: maxX, box: [{ x: minX, y: minY }, { x: maxX, y: maxY }] };
}

type Extras = { dot?: boolean; dash?: boolean; dis?: string | null };

/** Shape a Grascii string (plus the marks the font cannot write) into an outline. */
export function codeOutline(code: string, extras: Extras = {}): Outline | null {
  if (!font) return null;
  const main = code ? shape(code, 0) : null;
  if (code && !main) return null;
  let d = main ? main.d : "";
  let [lo, hi]: [Pt, Pt] = main ? main.box : [{ x: 0, y: -0.25 }, { x: 0, y: 0 }];
  const dots: Pt[] = [], dashes: Pt[] = [];
  const grow = (a: Pt, b: Pt) => { lo = { x: Math.min(lo.x, a.x), y: Math.min(lo.y, a.y) }; hi = { x: Math.max(hi.x, b.x), y: Math.max(hi.y, b.y) }; };
  if (extras.dis) {
    const extra = shape(extras.dis, (main ? main.x1 : 0) + 0.45);
    if (extra) { d += extra.d; grow(extra.box[0], extra.box[1]); }
  }
  const endX = main ? hi.x : 0;
  if (extras.dot) {
    const p = { x: main ? endX + 0.22 : 0.12, y: -0.14 };
    dots.push(p); grow({ x: p.x - 0.1, y: p.y - 0.1 }, { x: p.x + 0.1, y: p.y + 0.1 });
  }
  if (extras.dash) {
    const p = { x: endX + 0.18, y: -0.14 };
    dashes.push(p); grow({ x: p.x, y: p.y - 0.1 }, { x: p.x + 0.45, y: p.y + 0.1 });
  }
  if (!d && !dots.length && !dashes.length) return null;
  return { d, w: Math.max(hi.x - lo.x, 0.3), h: Math.max(hi.y - lo.y, 0.3), minX: lo.x, minY: lo.y, dots, dashes, filled: true };
}

export function grasciiOutline(tokens: Token[], series: Series): Outline | null {
  const g = tokensToGrascii(tokens, series);
  return g ? codeOutline(g.code, g) : null;
}

/* ---------------- the 1930 Anniversary dictionary (grascii/dictionaries, MIT) ---------------- */
let dict1930: Map<string, string> | null = null;
let dictLoading: Promise<Map<string, string> | null> | null = null;
export function parseDict1930(text: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const i = line.indexOf(" ");
    if (i > 0) m.set(line.slice(0, i), line.slice(i + 1).trim());
  }
  return m;
}
export function setDict1930(m: Map<string, string> | null) { dict1930 = m; dictLoading = null; }
export function loadDict1930(url = "/dict/gregg1930.txt"): Promise<Map<string, string> | null> {
  if (dict1930) return Promise.resolve(dict1930);
  if (!dictLoading) {
    dictLoading = fetch(url)
      .then((r) => { if (!r.ok) throw new Error("gregg1930 " + r.status); return r.text(); })
      .then((t) => (dict1930 = parseDict1930(t)))
      .catch(() => { dictLoading = null; return null; });
  }
  return dictLoading;
}
export const dict1930Ready = () => !!dict1930;

/** Grascii for `word` from the 1930 dictionary (including simple inflections), or null. Edition tweaks follow Centennial theory. */
export function lookup1930(word: string, series: Series): string | null {
  if (!dict1930) return null;
  const code = dict1930.get(word) ?? deriveFrom1930(word);
  if (!code) return null;
  return series === "anniversary" ? code : centennialCode(code);
}

/** Voiceless endings take t for -ed; everything else takes d. */
const VOICELESS_END = /(K|P|S|F|SH|CH|TH)$/;
/** Inflected forms written from a dictionary base: -s/-es/-ies, -ed, -ing (dot), -ly (e circle). Null when the base is unknown. */
export function deriveFrom1930(word: string, d: Map<string, string> | null = dict1930): string | null {
  if (!d) return null;
  const bases = (stem: string) => [
    stem,
    stem + "e",
    stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] ? stem.slice(0, -1) : "",
    stem.endsWith("i") ? stem.slice(0, -1) + "y" : "",
  ].filter(Boolean);
  const find = (stem: string) => { for (const b of bases(stem)) { const c = d.get(b); if (c) return c; } return null; };
  let m: RegExpExecArray | null;
  if ((m = /^(.{2,}?)ies$/.exec(word))) { const c = d.get(m[1] + "y"); if (c) return c + "S"; }
  if ((m = /^(.{2,}?)(?:es|s)$/.exec(word))) { const c = d.get(m[1]); if (c && !(word.endsWith("es") && !/(S|SH|CH|X)$/.test(c))) return c + "S"; }
  if ((m = /^(.{2,})ing$/.exec(word))) { const c = find(m[1]); if (c && !/NG$/.test(c)) return c + "'"; }
  if ((m = /^(.{2,})ed$/.exec(word))) { const c = find(m[1]); if (c && !/(T|D)$/.test(c)) return c + (VOICELESS_END.test(c) ? "T" : "D"); }
  if ((m = /^(.{2,})ly$/.exec(word))) { const c = d.get(m[1]); if (c && !/L$/.test(c)) return c + "E"; }
  return null;
}

/** Boundaries that undo the 1916 vowel joinings the font models, for the later editions. */
export function centennialCode(code: string): string {
  return code.replace(/O(?=R|L(?!D))/g, "O-");
}
