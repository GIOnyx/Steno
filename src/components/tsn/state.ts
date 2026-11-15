/* State shape and pure helpers for the TSN tool. All processing happens in lib/tsn/core.ts. */
import Core, { type Block, type NameSuggestion, type Row, type TimedSentence, type Unit, type VocabEntry } from "@/lib/tsn/core";

export const C = Core;

export type { Block, Row, Unit, VocabEntry };
export type Sugg = NameSuggestion;
export type Counsel = { name: string; roles: string; label: string };
export type Custom = { from: string; to: string; on: boolean };
export type CaseInfo = {
  caseType: string; caseNo: string; nature: string; plaintiffs: string; pDesig: string; defendants: string; dDesig: string;
  viceVersa: boolean; hdrP: string; hdrD: string; date: string; time: string; witness: string; witnessDesc: string;
  exam: string; examiner: number; certDate: string;
};
export type Staff = {
  judgeCover: string; judge: string; judgeTitle: string; interp: string; interpTitle: string; steno: string; stenoTitle: string;
  tsnBy: string; place: string; certPlace: string;
};
export type State = {
  step: number; reached: number; case: CaseInfo; counsel: Counsel[]; staff: Staff; custom: Custom[];
  blocks: Block[]; fileName: string; range: { start: number; end: number } | null; suggested: { start: number; end: number; hits: number[] } | null;
  sugg: Sugg[]; suggKey: string; units: Unit[]; unitsKey: string; sourceText: string; extras: string[]; cont: boolean; sel: number; outName: string;
};

export const SETTINGS_KEY = "stenoTools.tsn.settings.v1";
export const SESSION_KEY = "stenoTools.tsn.session.v1";
export const STEPS = ["Case details", "Recording", "Names", "Speakers", "Save"];
export const EXAM_NAMES: Record<string, string> = { direct: "direct", cross: "cross", "re-direct": "re-direct", "re-cross": "re-cross", additional: "additional direct", clarificatory: "clarificatory" };
export const DEFAULT_STAFF: Staff = {
  judgeCover: "HON. PHILLINE ROSAMAE P. RELUYA-YU", judge: "PHILLINE ROSAMAE P. RELUYA-YU", judgeTitle: "Presiding Judge",
  interp: "MITZFEL C. CAÑARES", interpTitle: "Acting Court Interpreter", steno: "ZYLYN M. BADINAS", stenoTitle: "Acting Court Stenographer",
  tsnBy: "Z. M. Badinas", place: "Carcar City, Cebu, Philippines.", certPlace: "Carcar City, Cebu,",
};

export const store = {
  get<T = unknown>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } },
  set(k: string, v: unknown): boolean { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

export function fresh(settings?: { staff?: Partial<Staff>; custom?: { from: string; to: string }[] } | null): State {
  const set = settings || {};
  return {
    step: 0, reached: 0,
    case: { caseType: "Civil", caseNo: "", nature: "", plaintiffs: "", pDesig: "Plaintiff,", defendants: "", dDesig: "Defendant.", viceVersa: false,
      hdrP: "", hdrD: "", date: "", time: "", witness: "", witnessDesc: "", exam: "direct", examiner: 0, certDate: "" },
    counsel: [{ name: "", roles: "Plaintiff’s Counsel", label: "" }, { name: "", roles: "Defendant’s Counsel", label: "" }],
    staff: { ...DEFAULT_STAFF, ...(set.staff || {}) },
    custom: (set.custom || []).map((x) => ({ from: x.from, to: x.to, on: true })),
    blocks: [], fileName: "", range: null, suggested: null,
    sugg: [], suggKey: "", units: [], unitsKey: "", sourceText: "", extras: [], cont: true, sel: 0, outName: "",
  };
}

export const counselLabel = (k: Counsel) => C.norm(k.label || "") || C.speakerLabelOf(k.name);
export type Speaker = { id: string; label: string; key: string };
export function speakers(S: State): Speaker[] {
  const list: Speaker[] = [{ id: "COURT", label: "COURT", key: "C" }, { id: "WITNESS", label: "WITNESS", key: "W" }, { id: "INTERP", label: "COURT INTERPRETER", key: "I" }];
  let n = 1;
  S.counsel.forEach((k, i) => { if (C.norm(k.name)) list.push({ id: "C" + i, label: counselLabel(k), key: n <= 9 ? String(n++) : "" }); });
  S.extras.forEach((x, i) => list.push({ id: "X" + i, label: x, key: n <= 9 ? String(n++) : "" }));
  return list;
}
export function speakerLabel(S: State, id: string) {
  const s = speakers(S).find((x) => x.id === id);
  if (s) return s.label;
  if (/^C\d+$/.test(id || "")) return counselLabel(S.counsel[+id.slice(1)] || { name: "", roles: "", label: "" });
  return "SPEAKER";
}
export const vocab = (S: State) => C.nameVocab([S.case.plaintiffs, S.case.defendants, S.case.witness].concat(S.counsel.map((k) => k.name)));
export const segBlocks = (S: State) => (S.range ? S.blocks.slice(S.range.start, S.range.end + 1) : []);
export const activeReps = (S: State) => S.custom.filter((x) => x.on && x.from).map((x) => ({ from: x.from, to: x.to }))
  .concat(S.sugg.filter((x) => x.on && x.to).map((x) => ({ from: x.from, to: x.to })));
export const repsKey = (S: State) => JSON.stringify([S.fileName, S.range, activeReps(S)]);
export const canGo = (S: State, i: number) => i <= 1 || (S.blocks.length > 0 && !!S.range);
export const isVerbatim = (S: State) => C.verbatim(C.groupRows(S.units), S.sourceText);

export function ensureSuggestions(S: State) {
  const v = vocab(S);
  const key = JSON.stringify([S.fileName, S.range, v.map((x: VocabEntry) => x.key)]);
  if (key === S.suggKey) return;
  const all = S.blocks.map((b) => b.text).join(" ");
  const segText = segBlocks(S).map((b) => b.text).join(" ");
  const old = new Map(S.sugg.map((x) => [x.from, x]));
  S.sugg = C.suggestNames(segText, v, C.wordCaseStats(all)).map((x: Sugg) => {
    const o = old.get(x.from);
    return o ? Object.assign(x, { on: o.on, to: o.to }) : x;
  });
  S.suggKey = key;
}

export function buildUnits(S: State) {
  const reps = activeReps(S);
  const blocks = segBlocks(S).map((b) => ({ t: b.t, text: C.applyReplacements(b.text, reps) }));
  const o = C.findOrderStart(blocks);
  const examiner = "C" + (S.case.examiner || 0);
  const otherIdx = S.counsel.findIndex((k, i) => i !== (S.case.examiner || 0) && C.norm(k.name));
  const opts = { examiner, other: otherIdx >= 0 ? "C" + otherIdx : examiner };
  const pre: Unit[] = C.autoUnits(C.sentencesOf(blocks.slice(0, o.start)), opts);
  const fq = pre.findIndex((u) => u.start && u.kind === "q");
  if (fq >= 0) pre.splice(fq, 0, { kind: "head", exam: S.case.exam || "direct", speaker: examiner });
  const order: Unit[] = [];
  let prevT: number | null = null; // one order paragraph per time-stamped part
  C.sentencesOf(blocks.slice(o.start, o.end + 1)).forEach((s: TimedSentence) => {
    order.push(s.t !== prevT ? { text: s.text, t: s.t, start: true, kind: "order", speaker: "" } : { text: s.text, t: s.t, start: false });
    prevT = s.t;
  });
  const tail: Unit[] = C.autoUnits(C.sentencesOf(blocks.slice(o.end + 1)), opts);
  S.units = pre.concat(order, tail);
  S.unitsKey = repsKey(S);
  S.sourceText = blocks.map((b) => b.text).join(" ");
  S.sel = 0;
}

export function missing(S: State) {
  const c = S.case, m: string[] = [];
  if (!C.norm(c.caseNo)) m.push("case number");
  if (!C.norm(c.plaintiffs) || !C.norm(c.defendants)) m.push("parties");
  if (!c.date) m.push("hearing date");
  if (!c.time) m.push("time the case was called");
  if (!C.norm(c.witness)) m.push("witness");
  if (!S.counsel.some((k) => C.norm(k.name))) m.push("counsel");
  return m;
}

export function download(bytes: Uint8Array | string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function b64ToBytes(s: string) {
  const bin = atob(s); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/* Reads a Scriptix export: .docx or .txt. Resolves with the lines. */
export function readRecordingFile(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("The file could not be read."));
    if (/\.docx$/i.test(file.name)) {
      fr.onload = () => { try { resolve(C.docxParagraphs(new Uint8Array(fr.result as ArrayBuffer))); } catch (e) { reject(e); } };
      fr.readAsArrayBuffer(file);
    } else {
      fr.onload = () => resolve(String(fr.result).split(/\r?\n/));
      fr.readAsText(file);
    }
  });
}
