/* TSN Formatter - processing engine (no AI, no network). */
import * as fflate from "fflate";

export type Block = { i: number; t: number; ts: string; who: string; text: string };
export type RangeBlock = { t: number; text: string };
export type SummaryCounsel = { name: string; roles: string };
export type SummaryResult = {
  caseType?: "Civil" | "Criminal";
  caseNo?: string;
  viceVersa?: boolean;
  plaintiffs?: string;
  defendants?: string;
  nature?: string;
  counsel?: SummaryCounsel[];
  status?: string;
  witness?: string;
  witnessDesc?: string;
  exam?: string;
};
export type VocabEntry = { key: string; name: string };
export type WordCaseStats = { lower: Map<string, number>; cap: Map<string, number> };
export type NameSuggestion = { from: string; to: string; count: number; score: number; on: boolean };
export type ReplacementRule = { from: string; to: string };
export type SuggestedRange = { start: number; end: number; hits: number[] };
export type TimedSentence = { text: string; t: number };
export type Unit = {
  text?: string;
  t?: number;
  start?: boolean;
  kind?: string;
  speaker?: string;
  exam?: string;
  changed?: boolean;
};
export type Row = {
  kind: string;
  speaker: string;
  text: string;
  t: number | null;
  first: number;
  n: number;
  exam?: string;
  label?: string;
};
export type PrintedRow = { label: string; text: string; bold?: boolean };
export type TemplateFragments = Record<string, string>;
export type DocxCaseInput = {
  caseType?: string;
  caseNo?: string;
  nature?: string;
  plaintiffs?: string;
  pDesig?: string;
  defendants?: string;
  dDesig?: string;
  viceVersa?: boolean;
  hdrP?: string;
  hdrD?: string;
  date?: string;
  time?: string;
  witness?: string;
  witnessDesc?: string;
  certDate?: string;
  orderTitle?: string;
};
export type DocxStaffInput = {
  judgeCover: string;
  judge: string;
  judgeTitle: string;
  interp: string;
  interpTitle: string;
  steno: string;
  stenoTitle: string;
  tsnBy: string;
  place: string;
  certPlace: string;
};
export type BuildDocxOptions = {
  case: DocxCaseInput;
  staff: DocxStaffInput;
  counsel: SummaryCounsel[];
  rows: Row[];
  cont: boolean;
  speakerLabel: (id: string) => string;
};

/* ------------------------------------------------------------------ text helpers */
export const LET = "A-Za-zÀ-ɏ";
export const norm = (s: string | null | undefined): string => String(s ?? "").replace(/\s+/g, " ").trim();

const STRIP_XML_CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");

export const escXml = (s: unknown): string =>
  String(s)
    .replace(STRIP_XML_CTRL, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export const typo = (s: unknown): string => String(s).replace(/'/g, "’");
const pad2 = (n: number): string => String(n).padStart(2, "0");

export const fmtTime = (sec: number | null | undefined): string => {
  if (sec == null || !Number.isFinite(sec)) return "";
  return pad2(Math.floor(sec / 3600)) + ":" + pad2(Math.floor(sec / 60) % 60) + ":" + pad2(sec % 60);
};

export const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ------------------------------------------------------------------ reading the recording */
export function docxParagraphs(u8: Uint8Array): string[] {
  let files: fflate.Unzipped;
  try {
    files = fflate.unzipSync(u8, { filter: (f) => f.name === "word/document.xml" });
  } catch {
    throw new Error("This file could not be opened as a Word document.");
  }
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("This file is not a Word .docx document.");
  const xml = fflate.strFromU8(doc);
  const out: string[] = [];
  const reP = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = reP.exec(xml))) {
    let t = "";
    const reT = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g;
    let k: RegExpExecArray | null;
    while ((k = reT.exec(m[0]))) t += k[1] !== undefined ? decodeXml(k[1]) : " ";
    out.push(t);
  }
  return out;
}

// Lines look like:  "Speaker [00:39:41]Good morning."   (label and text may also be on separate lines)
const STAMP = /^\s*(.{0,40}?)\s*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*:?\s*([\s\S]*)$/;

export function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\u00A0/g, " ");
    const m = STAMP.exec(line);
    if (m) {
      const t = m[4] !== undefined ? +m[2] * 3600 + +m[3] * 60 + +m[4] : +m[2] * 60 + +m[3];
      cur = { i: blocks.length, t, ts: fmtTime(t), who: norm(m[1]), text: norm(m[5]) };
      blocks.push(cur);
    } else if (cur && line.trim()) {
      cur.text = norm(cur.text + " " + line);
    }
  }
  return blocks.filter((b) => b.text.length).map((b, i) => ({ ...b, i }));
}

/* ------------------------------------------------------------------ case summary (pasted text) */
export const splitCaseNos = (s: string): string[] =>
  s.split(/\s*(?:,|&|\band\b)\s*/i).map(norm).filter(Boolean);

export function parseSummary(txt: string): SummaryResult {
  const s = norm(txt.replace(/[‘’]/g, "'"));
  const labels: [string, RegExp][] = [
    ["caseNo", /(Civil|Criminal|Crim\.?)\s+Case\s+no\/?s?\.?\s*:?/i],
    ["title", /Case\s+Title\s*:/i],
    ["nature", /\bFOR\s*:/],
    ["pc", /(?:Plaintiff|Prosecution|Complainant|Petitioner)(?:'?s'?|s')?\s+Counsel\s*:/i],
    ["dc", /(?:Defendant|Accused|Defense|Respondent)(?:'?s'?|s')?\s+Counsel\s*:/i],
    ["status", /Status\s*:/i],
  ];
  const found: { key: string; start: number; end: number; m: RegExpExecArray }[] = [];
  for (const [key, re] of labels) {
    const m = re.exec(s);
    if (m) found.push({ key, start: m.index, end: m.index + m[0].length, m });
  }
  found.sort((a, b) => a.start - b.start);
  const v: Record<string, string> = {};
  found.forEach((f, i) => {
    v[f.key] = norm(s.slice(f.end, i + 1 < found.length ? found[i + 1].start : s.length));
  });
  const res: SummaryResult = {};
  const cn = found.find((f) => f.key === "caseNo");
  if (cn) {
    res.caseType = /^crim/i.test(cn.m[1]) ? "Criminal" : "Civil";
    res.caseNo = v.caseNo;
  }
  if (v.title !== undefined) {
    let t = v.title;
    res.viceVersa = /\(\s*vice\s+versa\s*\)/i.test(t);
    t = t.replace(/\(\s*vice\s+versa\s*\)/gi, "").trim();
    const parts = t.split(/\s*-?\s*\b(?:versus|vs\.?)(?=\s|-|$)\s*-?\s*/i);
    res.plaintiffs = norm(parts[0] || "");
    res.defendants = norm(parts.slice(1).join(" versus ") || "");
  }
  if (v.nature !== undefined) res.nature = v.nature;
  const names = (x?: string): string[] => (x || "").split(/\s*\/\s*/).map(norm).filter(Boolean);
  const P = names(v.pc),
    D = names(v.dc);
  if (P.length || D.length) {
    const nums = splitCaseNos(res.caseNo || "");
    const perP = nums.length > 1 && P.length === nums.length;
    const perD = nums.length > 1 && D.length === nums.length;
    const map = new Map<string, string[]>();
    const add = (name: string, role: string) => {
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(role);
    };
    const isCrim = res.caseType === "Criminal";
    const kind = isCrim ? "Criminal" : "Civil";
    const pRole = isCrim ? "Prosecution Counsel" : "Plaintiff’s Counsel";
    const dRole = isCrim ? "Defense Counsel" : "Defendant’s Counsel";
    P.forEach((n, i) => add(n, pRole + (perP ? " (" + kind + " Case No. " + nums[i] + ")" : "")));
    D.forEach((n, i) => add(n, dRole + (perD ? " (" + kind + " Case No. " + nums[i] + ")" : "")));
    res.counsel = [...map.entries()].map(([name, roles]) => ({ name, roles: roles.join("\n") }));
  }
  if (v.status !== undefined) {
    res.status = v.status;
    const w = /\(([^)]+)\)/.exec(v.status);
    if (w) res.witness = norm(w[1]);
    res.witnessDesc = norm(
      v.status.replace(/\([^)]*\)/g, " ").replace(/\bAtty\.?\s+[A-Z][\w.À-ɏ-]*(\s+[A-Z][\w.À-ɏ-]*)*\s*$/, "")
    );
    const st = v.status.toLowerCase();
    res.exam = /re-?\s*cross/.test(st)
      ? "re-cross"
      : /re-?\s*direct/.test(st)
        ? "re-direct"
        : /cross/.test(st)
          ? "cross"
          : /direct/.test(st)
            ? "direct"
            : "";
  }
  return res;
}

/* ------------------------------------------------------------------ names */
const NAME_STOP = new Set(
  (
    "sps spouses atty attys and of the hrs heirs et al vs versus jr sr ii iii iv pros hon rep by minor mr mrs ms dr " +
    "de del dela la los represented her his their attorney-in-fact republic people philippines city inc corp co vice versa"
  ).split(" ")
);

export function nameVocab(texts: (string | undefined)[]): VocabEntry[] {
  const seen = new Map<string, string>();
  for (const t of texts) {
    const words = (t || "").match(new RegExp("[" + LET + "]+", "g")) || [];
    const good = words.map((w) => (w.length >= 3 && !NAME_STOP.has(w.toLowerCase()) ? w : null));
    good.forEach((w, i) => {
      if (!w) return;
      const proper = w[0].toUpperCase() + w.slice(1).toLowerCase();
      const disp = w === w.toUpperCase() ? proper : w;
      if (!seen.has(disp.toLowerCase())) seen.set(disp.toLowerCase(), disp);
      const nx = good[i + 1];
      if (nx) {
        const d2 = disp + " " + (nx === nx.toUpperCase() ? nx[0] + nx.slice(1).toLowerCase() : nx);
        const key = (disp + nx).toLowerCase();
        if (!seen.has(key)) seen.set(key, d2);
      }
    });
  }
  return [...seen.entries()].map(([key, name]) => ({ key, name }));
}

export function lev(a: string, b: string): number {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j),
    cur = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

const tokenRe = () => new RegExp("[" + LET + "]+", "g");

export function wordCaseStats(allText: string): WordCaseStats {
  const lower = new Map<string, number>();
  const cap = new Map<string, number>();
  for (const w of allText.match(tokenRe()) || []) {
    const lw = w.toLowerCase();
    if (w[0] === w[0].toLowerCase()) lower.set(lw, (lower.get(lw) ?? 0) + 1);
    else cap.set(lw, (cap.get(lw) ?? 0) + 1);
  }
  return { lower, cap };
}

export function lowercaseWords(allText: string): Set<string> {
  const set = new Set<string>();
  for (const w of allText.match(tokenRe()) || []) if (w[0] === w[0].toLowerCase()) set.add(w);
  return set;
}

// rough "sounds like" key: b/p/v/f, c/k/g/q, d/t, s/z and all vowels are treated alike
function sound(w: string): string {
  return w
    .toLowerCase()
    .replace(/[pvf]/g, "b")
    .replace(/[kgq]/g, "c")
    .replace(/t/g, "d")
    .replace(/z/g, "s")
    .replace(/[eiouy]/g, "a")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1");
}

const NOT_NAMES = new Set(
  (
    "january february march april may june july august september october november december monday tuesday wednesday " +
    "thursday friday saturday sunday court honor honour exhibit madam witness attorney civil criminal case lot deed sale title okay yes thank " +
    "your number judge counsel council sir maam order objection also all alone data plaintiff defendant"
  ).split(" ")
);

export function suggestNames(
  segmentText: string,
  vocab: VocabEntry[],
  caseFilter: Set<string> | WordCaseStats
): NameSuggestion[] {
  const counts = new Map<string, number>();
  for (const w of segmentText.match(tokenRe()) || []) counts.set(w, (counts.get(w) || 0) + 1);
  const isOrdinaryLower = (lw: string): boolean => {
    if (caseFilter instanceof Set) return caseFilter.has(lw);
    const lc = caseFilter.lower.get(lw) ?? 0;
    const cc = caseFilter.cap.get(lw) ?? 0;
    return lc > 0 && lc >= cc;
  };
  const out: NameSuggestion[] = [];
  for (const [w, count] of counts) {
    if (w.length < 3) continue;
    const lw = w.toLowerCase();
    const capital = w[0] !== w[0].toLowerCase();
    if (NOT_NAMES.has(lw)) continue;
    if (capital && isOrdinaryLower(lw)) continue; // ordinary word used lowercase at least as often as capitalized
    let best: "exact" | { v: VocabEntry; score: number } | null = null;
    const sw = sound(lw);
    for (const v of vocab) {
      if (v.key === lw) {
        best = v.name === w ? "exact" : { v, score: 1 };
        break;
      }
      if (lw === v.key + "s") {
        best = "exact";
        break;
      }
      const big = Math.max(lw.length, v.key.length);
      const ls = 1 - lev(lw, v.key) / big;
      const sv = sound(v.key);
      const ps = 1 - lev(sw, sv) / Math.max(sw.length, sv.length);
      const mix = (ls + ps) / 2;
      let ok: boolean, score: number;
      if (Math.min(lw.length, v.key.length) <= 4) {
        // short names (Alo, Ata, Jose): be strict
        ok =
          capital &&
          lw[0] === v.key[0] &&
          Math.abs(lw.length - v.key.length) <= 1 &&
          (ps === 1 || lev(lw, v.key) <= 1);
        score = ok ? Math.min(0.75, Math.max(ls, mix)) : 0;
      } else if (!capital) {
        ok = ls >= 0.8 && lw.length >= 6;
        score = ls;
      } else {
        ok = mix >= 0.6 || ls >= 0.75;
        score = Math.max(ls, mix);
      }
      if (ok && (!best || (typeof best !== "string" && score > best.score))) best = { v, score };
    }
    if (!best || best === "exact") continue;
    out.push({ from: w, to: best.v.name, count, score: Math.round(best.score * 100) / 100, on: best.score >= 0.8 });
  }
  out.sort((a, b) => b.score - a.score || b.count - a.count || a.from.localeCompare(b.from));
  return out;
}

export function applyReplacements(text: string, list: ReplacementRule[]): string {
  const byFrom = new Map<string, string>();
  for (const r of list) {
    const f = norm(r.from);
    if (!f || r.from === r.to || byFrom.has(f)) continue;
    byFrom.set(f, r.to);
  }
  if (!byFrom.size) return text;
  const keys = [...byFrom.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(
    "(?<![" + LET + "])(?:" + keys.map((k) => reEsc(k).replace(/\s+/g, "\\s+")).join("|") + ")(?![" + LET + "])",
    "g"
  );
  return text.replace(re, (m) => byFrom.get(norm(m)) ?? m);
}

export function countMatches(text: string, from: string): number {
  const f = norm(from);
  if (!f) return 0;
  const re = new RegExp("(?<![" + LET + "])" + reEsc(f).replace(/\s+/g, "\\s+") + "(?![" + LET + "])", "g");
  return (text.match(re) || []).length;
}

/* ------------------------------------------------------------------ where does the case start and end? */
const START_CUE = /\b(good morning|good afternoon|next case)\b/i;
const END_CUE = /o'?\s?clock in the|so ordered|notified in open court/i;

export function suggestRange(blocks: RangeBlock[], vocab: VocabEntry[]): SuggestedRange | null {
  const keys = new Set(vocab.filter((v) => !v.name.includes(" ")).map((v) => v.key));
  const hitN = blocks.map((b) => {
    let n = 0;
    for (const w of b.text.match(tokenRe()) || []) {
      if (w.length < 4 || w[0] === w[0].toLowerCase()) continue;
      const lw = w.toLowerCase();
      if (keys.has(lw)) n++;
      else {
        for (const k of keys) {
          if (k.length >= 6 && lev(lw, k) <= 1) {
            n++;
            break;
          }
        }
      }
    }
    return n;
  });
  const hits = hitN.map((n, i) => (n ? i : -1)).filter((i) => i >= 0);
  if (!hits.length) return null;
  const segs: [number, number][] = [];
  let s0 = 0;
  blocks.forEach((b, i) => {
    if (END_CUE.test(b.text)) {
      segs.push([s0, i]);
      s0 = i + 1;
    }
  });
  if (s0 < blocks.length) segs.push([s0, blocks.length - 1]);
  let best: { a: number; z: number; sum: number } | null = null;
  for (const [a, z] of segs) {
    let sum = 0;
    for (let i = a; i <= z; i++) sum += hitN[i];
    if (!best || sum > best.sum) best = { a, z, sum };
  }
  const bBest = best!;
  const first = hits.find((i) => i >= bBest.a) ?? bBest.a;
  const lastHit = [...hits].reverse().find((i) => i <= bBest.z) ?? bBest.z;
  let start = bBest.a;
  for (let i = first; i >= bBest.a; i--) {
    if (START_CUE.test(blocks[i].text)) {
      start = i;
      break;
    }
  }
  const end = END_CUE.test(blocks[bBest.z].text) ? bBest.z : lastHit;
  return { start, end, hits };
}

// the dictated order at the end of the segment: index of its first block (or blocks.length if none)
const ORDER_WORDS =
  /hereby|appeared as|witness stand|manifested|scheduled hearing|notified in open court|so ordered|o'?\s?clock in the/i;

export function findOrderStart(blocks: RangeBlock[]): { start: number; end: number } {
  let lastEnd = -1;
  blocks.forEach((b, i) => {
    if (END_CUE.test(b.text)) lastEnd = i;
  });
  if (lastEnd < 0) return { start: blocks.length, end: blocks.length - 1 };
  const tailBlocks = blocks.length - 1 - lastEnd;
  const tailSeconds = blocks[blocks.length - 1].t - blocks[lastEnd].t;
  const nearTail = tailBlocks < 4 || (tailBlocks <= 10 && tailSeconds <= 120);
  if (!nearTail) return { start: blocks.length, end: blocks.length - 1 };
  let s = lastEnd;
  while (s > 0 && ORDER_WORDS.test(blocks[s - 1].text) && blocks[s].t - blocks[s - 1].t < 150) s--;
  return { start: s, end: lastEnd };
}

/* ------------------------------------------------------------------ sentences */
const ABBR = new Set(
  "atty attys mr mrs ms dr sps hon jr sr st vs nos exh sec art brgy engr pros gov col gen lt capt sgt fr rev bro inc corp ltd etc".split(
    " "
  )
);
const DOTTED_ABBR = /(?:^|[\s(])(?:a\.m|p\.m|e\.g|i\.e|u\.s)$/i;
const ENDS = /[.?!…]["'”’)\]]*$/;

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  const re = /([.?!…]+["'”’)\]]*)(\s+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const end = m.index + m[1].length;
    const next = text[m.index + m[0].length];
    if (next === undefined) break;
    if (/[a-z]/.test(next)) continue; // "to donate? the to" stays together
    if (m[1][0] === "." && m[1].length === 1) {
      const before = text.slice(start, m.index);
      if (DOTTED_ABBR.test(before)) continue; // "9:00 a.m. The Court..."
      const w = (/([A-Za-z]+)$/.exec(before) || [])[1] || "";
      if (ABBR.has(w.toLowerCase())) continue;
      if (/^[A-Z]$/.test(w)) continue; // initials: "Joselito M. Alo"
      if (/^no$/i.test(w) && /\d/.test(next)) continue; // "Civil Case No. 964"
    }
    out.push(text.slice(start, end));
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

export function sentencesOf(blocks: RangeBlock[]): TimedSentence[] {
  const out: TimedSentence[] = [];
  let carry: TimedSentence | null = null;
  for (const b of blocks) {
    const parts = splitSentences(b.text);
    parts.forEach((p, i) => {
      if (i === 0 && carry) {
        carry.text += " " + p;
        return;
      }
      out.push({ text: p, t: b.t });
    });
    const last = out[out.length - 1];
    carry = last && !ENDS.test(last.text) ? last : null;
  }
  return out;
}

/* ------------------------------------------------------------------ first guess at who is speaking */
const RE_COURT =
  /\b(witness may answer|sustained|overruled|so ordered|next case|register the answer|you may proceed|proceed with your|let the witness|while that is noted|the court (will|knows|notes)|is hereby|objection (is )?(noted|sustained|overruled))\b/i;
const RE_OBJECT = /\b(objection|we object|i object|ground for objection|leading question|already answered|misleading)\b/i;
const RE_TO_COURT = /\byour hono(u)?rs?\b/i;
const RE_WITHDRAW = /\bwithdraw (the|my|that) question\b/i;
const RE_SHORT_A =
  /^(yes|no|yeah|yup|none|correct|oh,? yes|i don'?t (know|think)|i do not|that i do not|that we did not|not |never|maybe|i think|actually|in fact|well,|our |my |just lately|the same)\b/i;
const RE_LEAD =
  /^(now|so|and |but |all right|alright|okay|ok\b|madam witness|mr\.? witness|ma'?am|sir,|you\b|you're |you've |your claim|in your|i('d| would) like to|i am showing|i'm showing|let's|let us|during the|my question|thank you|did you|do you|were you|are you|is it|isn't it|would you|could you|can you|how |what |when |where |who |why )/i;

export function autoUnits(sentences: TimedSentence[], opt?: { examiner?: string; other?: string }): Unit[] {
  const examiner = opt?.examiner || "C0";
  const other = opt?.other || "C1";
  const units: Unit[] = [];
  let L: { kind: string; speaker: string; text: string } | null = null;
  const push = (kind: string, speaker: string, s: TimedSentence) => {
    if (L && L.kind === kind && L.speaker === speaker) {
      L.text += " " + s.text;
      units.push({ text: s.text, t: s.t, start: false });
    } else {
      L = { kind, speaker, text: s.text };
      units.push({ text: s.text, t: s.t, start: true, kind, speaker });
    }
  };
  const endsQ = (x: string) => /\?["'”’)]*$/.test(x);
  sentences.forEach((s) => {
    const x = s.text,
      isQ = endsQ(x);
    if (RE_COURT.test(x)) return push("sp", "COURT", s);
    if (RE_WITHDRAW.test(x)) return push("sp", examiner, s);
    if (RE_OBJECT.test(x) && !isQ) return push("sp", other, s);
    if (RE_TO_COURT.test(x)) {
      return push("sp", L && L.kind === "sp" && L.speaker !== "COURT" && L.speaker !== "WITNESS" ? L.speaker : examiner, s);
    }
    if (isQ) {
      if (L && L.kind === "sp" && L.speaker === "COURT" && !RE_LEAD.test(x)) return push("sp", "COURT", s);
      return push("q", "", s);
    }
    if (!L) return push("sp", "COURT", s);
    if (L.kind === "q") return endsQ(L.text) ? push("a", "", s) : push("q", "", s);
    if (L.kind === "a") return RE_LEAD.test(x) && !RE_SHORT_A.test(x) ? push("q", "", s) : push("a", "", s);
    if (RE_SHORT_A.test(x) && L.speaker !== "WITNESS" && endsQ(L.text)) return push("sp", "WITNESS", s);
    if (RE_LEAD.test(x) && L.speaker !== "WITNESS") return push("q", "", s);
    return push(L.kind, L.speaker, s);
  });
  return units;
}

export function groupRows(units: Unit[]): Row[] {
  const rows: Row[] = [];
  units.forEach((u, i) => {
    if (u.kind === "head") {
      rows.push({ kind: "head", exam: u.exam, speaker: u.speaker || "", text: "", t: null, first: i, n: 1 });
      return;
    }
    const L = rows[rows.length - 1];
    if (u.start || !L || L.kind === "head") {
      rows.push({ kind: u.kind || "sp", speaker: u.speaker || "", text: u.text || "", t: u.t ?? null, first: i, n: 1 });
    } else {
      L.text += " " + (u.text || "");
      L.n++;
    }
  });
  return rows;
}

/* ------------------------------------------------------------------ numbering for the printed table */
export const EXAMS: Record<string, string> = {
  direct: "direct",
  cross: "cross",
  "re-direct": "re-direct",
  "re-cross": "re-cross",
  additional: "additional direct",
  clarificatory: "clarificatory",
};

export function tableRows(rows: Row[], speakerLabel: (id: string) => string, opt?: { cont?: boolean }): PrintedRow[] {
  const out: PrintedRow[] = [];
  let n = 0,
    examiner: string | null = null,
    hadQ = false,
    prevKind: string | null = null;
  for (const r of rows) {
    if (r.kind === "order") continue;
    if (r.kind === "head") {
      examiner = r.speaker;
      n = 0;
      hadQ = false;
      out.push({ label: speakerLabel(r.speaker) + ":", text: "" });
      out.push({ label: "", text: "Questions to the witness for " + (EXAMS[r.exam || ""] || r.exam || "direct") + " examination.", bold: true });
      prevKind = "head";
      continue;
    }
    if (r.kind === "q") {
      if (opt && opt.cont && examiner && hadQ && prevKind === "sp") out.push({ label: speakerLabel(examiner) + ":", text: "CONT." });
      n++;
      hadQ = true;
      out.push({ label: "Q" + n + ":", text: r.text });
    } else if (r.kind === "a") {
      out.push({ label: "A" + (n || 1) + ":", text: r.text });
    } else {
      out.push({ label: speakerLabel(r.speaker) + ":", text: r.text });
    }
    prevKind = r.kind;
  }
  return out;
}

/* ------------------------------------------------------------------ Word output */
const FONT = "Lucida Bright";

function rPr(sz: number, bold?: boolean, italic?: boolean): string {
  return (
    '<w:rPr><w:rFonts w:ascii="' +
    FONT +
    '" w:hAnsi="' +
    FONT +
    '" w:cs="Lucida Grande Regular"/>' +
    (bold ? "<w:b/><w:bCs/>" : "") +
    (italic ? "<w:i/><w:iCs/>" : "") +
    '<w:sz w:val="' +
    sz +
    '"/><w:szCs w:val="' +
    sz +
    '"/></w:rPr>'
  );
}

function para(text: string, o?: { sz?: number; after?: number; jc?: string; bold?: boolean; italic?: boolean }): string {
  const opts = o || {};
  const sz = opts.sz || 26;
  return (
    '<w:p><w:pPr><w:spacing w:before="0" w:after="' +
    (opts.after || 0) +
    '" w:line="240" w:lineRule="auto"/>' +
    (opts.jc ? '<w:jc w:val="' + opts.jc + '"/>' : "") +
    "</w:pPr>" +
    (text ? "<w:r>" + rPr(sz, opts.bold, opts.italic) + '<w:t xml:space="preserve">' + escXml(typo(text)) + "</w:t></w:r>" : "") +
    "</w:p>"
  );
}

const NOB = '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>';
const cell = (w: number, inner: string) =>
  '<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>' + NOB + "</w:tcPr>" + inner + "</w:tc>";
const WIDTHS = [2550, 283, 286, 6798];

function tr(label: string, text: string, bold?: boolean): string {
  return (
    "<w:tr>" +
    cell(WIDTHS[0], para(label, { jc: "right", after: 140 })) +
    cell(WIDTHS[1], para("", { after: 140 })) +
    cell(WIDTHS[2], para("", { after: 140 })) +
    cell(WIDTHS[3], para(text, { jc: "both", after: 140, bold })) +
    "</w:tr>"
  );
}

function table(rowsXml: string[], widths: number[], ind: number): string {
  return (
    '<w:tbl><w:tblPr><w:tblW w:w="' +
    widths.reduce((a, b) => a + b, 0) +
    '" w:type="dxa"/><w:tblInd w:w="' +
    ind +
    '" w:type="dxa"/>' +
    '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>' +
    '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="55" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="55" w:type="dxa"/></w:tblCellMar>' +
    '<w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>' +
    widths.map((w) => '<w:gridCol w:w="' + w + '"/>').join("") +
    "</w:tblGrid>" +
    rowsXml.join("") +
    "</w:tbl>"
  );
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dateParts(iso?: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3] };
}

export const longDate = (iso?: string): string => {
  const p = dateParts(iso);
  return p ? MONTHS[p.mo - 1] + " " + p.d + ", " + p.y : "__________";
};

const orderDate = (iso?: string): string => {
  const p = dateParts(iso);
  return p ? p.d + " " + MONTHS[p.mo - 1].toUpperCase() + " " + p.y + "." : "__________";
};

const fileDate = (iso?: string): string => {
  const p = dateParts(iso);
  return p ? pad2(p.mo) + "." + pad2(p.d) + "." + String(p.y).slice(2) : "";
};

export function timePhrase(hhmm?: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return "____ o’clock";
  const h = +m[1],
    h12 = ((h + 11) % 12) + 1;
  return h12 + ":" + m[2] + " o’clock in the " + (h < 12 ? "morning" : h < 18 ? "afternoon" : "evening");
}

const caseLabel = (c: DocxCaseInput): string =>
  (c.caseType || "Civil").toUpperCase() + " CASE NO" + (splitCaseNos(c.caseNo || "").length > 1 ? "S" : "");

export function shortParty(t?: string): string {
  let s = norm(t || "");
  if (!s) return "";
  let first = s.split(",")[0];
  let more = first.length < s.length;
  if (/^sps\.?\s/i.test(first)) {
    const k = first.split(/\s+and\s+/i);
    if (k.length > 2 || first.length > 40) {
      first = k[0];
      more = true;
    }
  } else if (first.length > 45 && /\s+and\s+/i.test(first)) {
    first = first.split(/\s+and\s+/i)[0];
    more = true;
  }
  s = first.toUpperCase() + (more ? ", ET AL." : "");
  return s;
}

export function speakerLabelOf(counselName?: string): string {
  const words = norm(counselName || "").replace(/,/g, "").split(" ").filter(Boolean);
  if (!words.length) return "ATTY.";
  const pre = /^pros/i.test(words[0]) ? "PROS." : /^fiscal/i.test(words[0]) ? "FISCAL" : "ATTY.";
  let i = words.length - 1;
  while (i > 0 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(words[i])) i--;
  return pre + " " + words[i].toUpperCase();
}

export function fileName(c: DocxCaseInput): string {
  const nums = norm(c.caseNo || "");
  const cap = (s: string) =>
    s
      .toLowerCase()
      .replace(/(^|[\s.\-])([a-zà-ɏ])/g, (_m, a: string, b: string) => a + b.toUpperCase())
      .replace(/, Et Al\.?/i, "");
  const p = cap(c.hdrP || shortParty(c.plaintiffs)),
    d = cap(c.hdrD || shortParty(c.defendants));
  const base = ["TSN -", c.caseType === "Criminal" ? "Crim" : "CC", nums, p, p && d ? "vs." : "", d, fileDate(c.date)]
    .filter(Boolean)
    .join(" ");
  return base.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim() + ".docx";
}

export function buildDocx(templateU8: Uint8Array, F: TemplateFragments, S: BuildDocxOptions): Uint8Array {
  const c = S.case,
    st = S.staff;
  const tok = (frag: string, map: Record<string, string>) =>
    frag.replace(/@@([A-Z_]+)@@/g, (m, k: string) => (k in map ? escXml(typo(map[k])) : m));
  const nums = norm(c.caseNo || "");
  const left =
    para(norm(c.plaintiffs).toUpperCase() + ",", { sz: 24, bold: true, jc: "both" }) +
    para(c.pDesig || "Plaintiff,", { sz: 24, italic: true, jc: "right", after: 120 }) +
    para("-versus-", { sz: 24, jc: "center", after: 120 }) +
    para(norm(c.defendants).toUpperCase() + ",", { sz: 24, bold: true, jc: "both" }) +
    para(c.dDesig || "Defendant.", { sz: 24, italic: true, jc: "right", after: 60 }) +
    (c.viceVersa ? para("(vice versa)", { sz: 24, italic: true, after: 60 }) : "") +
    para("x ------------------------------/", { sz: 24 });
  const right =
    para(caseLabel(c) + ": " + nums, { sz: 24, bold: true, after: 60 }) +
    para("FOR: " + norm(c.nature || ""), { sz: 24, jc: "both" });
  const caption = table(
    ["<w:tr>" + cell(5000, left) + cell(300, para("", { sz: 24 })) + cell(4060, right) + "</w:tr>"],
    [5000, 300, 4060],
    0
  );

  const appear = (S.counsel || [])
    .filter((k) => norm(k.name))
    .map(
      (k) =>
        tok(F.appear_name, { T: norm(k.name) }) +
        String(k.roles || "")
          .split("\n")
          .map(norm)
          .filter(Boolean)
          .map((r) => tok(F.appear_role, { T: r }))
          .join("") +
        F.blank
    )
    .join("");

  const labelOf = (id: string) => S.speakerLabel(id);
  const rows = tableRows(S.rows, labelOf, { cont: S.cont }).map((r) => tr(r.label, r.text, r.bold));
  const orderParas = S.rows
    .filter((r) => r.kind === "order")
    .map((r) => norm(r.text))
    .filter(Boolean);

  let body =
    F.court +
    caption +
    para("") +
    F.cover1 +
    tok(F.witness, {
      WITNESS: norm(c.witness || ""),
      WITNESS_DESC: norm(c.witnessDesc || "") ? " - " + norm(c.witnessDesc) : "",
    }) +
    tok(F.dateline, { DATE_LINE: "On " + longDate(c.date) + ", at " + timePhrase(c.time) }) +
    tok(F.heard, {
      JUDGE_COVER: st.judgeCover,
      JUDGE_TITLE: st.judgeTitle,
      INTERP: st.interp,
      INTERP_TITLE: st.interpTitle,
      STENO: st.steno,
      STENO_TITLE: st.stenoTitle,
    }) +
    appear +
    para("") +
    table(rows.length ? rows : [tr("", "")], WIDTHS, -558) +
    para("") +
    para("");
  if (orderParas.length) {
    const B = F.order_blank;
    body +=
      tok(F.order_head, { T: c.orderTitle || (splitCaseNos(nums).length > 1 ? "JOINT ORDER" : "ORDER") }) +
      B +
      orderParas.map((p) => tok(F.order_body, { T: p }) + B).join("") +
      F.so_ordered +
      B +
      tok(F.order_date, { T: orderDate(c.date) }) +
      B +
      tok(F.order_place, { T: st.place }) +
      B +
      B +
      B +
      tok(F.judge_sign, { JUDGE: st.judge, JUDGE_TITLE: st.judgeTitle });
  }
  body +=
    F.xline +
    tok(F.cert, {
      CERT_LINE:
        (norm(c.certDate || "") || "____ day of __________ " + (dateParts(c.date)?.y || "____")) + " " + st.certPlace,
      STENO: st.steno,
      STENO_TITLE: st.stenoTitle,
    });

  const files = fflate.unzipSync(templateU8);
  const doc = fflate.strFromU8(files["word/document.xml"]);
  if (doc.indexOf("@@BODY@@") < 0) throw new Error("Template is damaged.");
  files["word/document.xml"] = fflate.strToU8(doc.replace("@@BODY@@", () => body));
  const hdr = fflate.strFromU8(files["word/header2.xml"]);
  files["word/header2.xml"] = fflate.strToU8(
    tok(hdr, {
      HDR_CASE: caseLabel(c).replace(/NO(S?)$/, "NO$1.") + " " + nums,
      HDR_P: c.hdrP || shortParty(c.plaintiffs),
      HDR_D: (c.hdrD || shortParty(c.defendants)) + (c.viceVersa ? " (VICE VERSA)" : ""),
      HDR_DATE: longDate(c.date),
      HDR_TSN: st.tsnBy,
    })
  );
  return fflate.zipSync(files, { level: 6 });
}

// does the edited table still read word for word like the recording?
export function verbatim(rows: Row[], sourceText: string): boolean {
  const a = norm(
    rows
      .filter((r) => r.kind !== "head")
      .map((r) => r.text)
      .join(" ")
  );
  return a === norm(sourceText);
}

const Core = {
  LET,
  norm,
  decodeXml,
  escXml,
  typo,
  fmtTime,
  reEsc,
  docxParagraphs,
  parseBlocks,
  parseSummary,
  splitCaseNos,
  nameVocab,
  suggestNames,
  wordCaseStats,
  lowercaseWords,
  applyReplacements,
  countMatches,
  suggestRange,
  findOrderStart,
  splitSentences,
  sentencesOf,
  autoUnits,
  groupRows,
  tableRows,
  EXAMS,
  buildDocx,
  shortParty,
  speakerLabelOf,
  fileName,
  longDate,
  timePhrase,
  verbatim,
  lev,
};

export default Core;
