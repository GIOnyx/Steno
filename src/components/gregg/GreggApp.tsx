"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { docxText, loadDictionary, renderText, type Para, type Source, type Word } from "@/lib/gregg/engine";
import { SERIES, briefForms, tokensToCode, type Series } from "@/lib/gregg/rules";
import { outlineSvg } from "@/lib/gregg/strokes";
import { flow, type Line } from "@/lib/gregg/layout";
import { buildPdf, type PdfOptions } from "@/lib/gregg/pdf";

const KEY = "stenoTools.gregg.v1";
type Saved = { series: Series; gloss: boolean; pageSize: PdfOptions["pageSize"]; names: boolean; custom: Record<Series, Record<string, string>>; text: string };
const DEFAULT: Saved = { series: "centennial", gloss: true, pageSize: "steno", names: true, custom: { centennial: {}, simplified: {}, anniversary: {} }, text: "" };
const SAMPLE = "When called today for the continuation of trial, Atty. Nathaniel Clarus appeared as plaintiffs’ counsel in Civil Case No. 958.\nCalled to the witness stand is the fourth witness, Jessica M. Lomongo, whose testimony was completed today.";

const UNIT = 11;            // px per stroke unit on screen
const LINE_H = 44;          // px per ruled line

export function GreggApp() {
  const [s, setS] = useState<Saved>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [dictErr, setDictErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileErr, setFileErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "guess" | "brief">("guess");
  const fileRef = useRef<HTMLInputElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const [padW, setPadW] = useState(760);
  const narrow = padW < 700;

  useEffect(() => {
    try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); if (j) setTimeout(() => setS({ ...DEFAULT, ...j, custom: { ...DEFAULT.custom, ...(j.custom || {}) } }), 0); } catch { /* ignore */ }
    loadDictionary().then(() => setReady(true)).catch((e) => setDictErr("The pronunciation dictionary could not be loaded (" + e.message + "). Words will be spelled out from their letters instead."));
    const ro = new ResizeObserver(() => { if (padRef.current) setPadW(padRef.current.clientWidth); });
    if (padRef.current) ro.observe(padRef.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);

  const set = <K extends keyof Saved>(k: K, v: Saved[K]) => setS((p) => ({ ...p, [k]: v }));
  const text = s.text || SAMPLE;
  const paras: Para[] = useMemo(() => {
    void ready; void dictErr;
    return renderText(text, { series: s.series, custom: s.custom[s.series], namesAsFilipino: s.names });
  }, [text, s.series, s.custom, s.names, ready, dictErr]);
  const colUnits = ((narrow ? padW : padW / 2) - 44) / UNIT;
  const lines: Line[] = useMemo(() => flow(paras, Math.max(8, colUnits)), [paras, colUnits]);
  const half = narrow ? lines.length : Math.ceil(lines.length / 2);

  const words = useMemo(() => {
    const m = new Map<string, Word & { n: number }>();
    for (const p of paras) for (const w of p.words) { if (!w.word) continue; const k = w.word.toLowerCase(); const e = m.get(k); if (e) e.n++; else m.set(k, { ...w, n: 1 }); }
    return [...m.values()].sort((a, b) => (rank(a.source) - rank(b.source)) || b.n - a.n);
  }, [paras]);
  const counts = useMemo(() => words.reduce((acc, w) => { acc[w.source] = (acc[w.source] || 0) + 1; return acc; }, {} as Record<string, number>), [words]);

  const loadFile = async (file: File) => {
    setFileErr("");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const t = /\.docx$/i.test(file.name) ? docxText(buf) : new TextDecoder().decode(buf);
      if (!t.trim()) throw new Error("No text was found in the file.");
      set("text", t); setFileName(file.name);
    } catch (e) { setFileErr((e as Error).message); }
  };
  const savePdf = async () => {
    setBusy(true); setMsg("");
    try {
      const bytes = await buildPdf(paras, { pageSize: s.pageSize, gloss: s.gloss, series: SERIES.find((x) => x.id === s.series)!.name, title: fileName.replace(/\.[^.]+$/, "") });
      const name = (fileName ? fileName.replace(/\.[^.]+$/, "") : "shorthand") + " - Gregg.pdf";
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setMsg("Saved “" + name + "” to your browser’s download folder.");
    } catch (e) { setMsg("The PDF could not be made: " + (e as Error).message); }
    setBusy(false);
  };
  const setCustom = (word: string, code: string) => setS((p) => {
    const c = { ...p.custom[p.series] };
    if (code.trim()) c[word] = code.trim(); else delete c[word];
    return { ...p, custom: { ...p.custom, [p.series]: c } };
  });

  const briefs = briefForms(s.series);
  const shown = words.filter((w) => filter === "all" ? true : filter === "guess" ? w.source === "guess" || w.source === "filipino" : w.source === "brief" || w.source === "custom");

  return (
    <main className="main">
      <div className="gwrap">
        <div className="pagehead"><h1>Gregg shorthand</h1><p className="lede">Drop a Word or text file, or paste text, and read it back in Gregg outlines on steno-pad lines. Outlines are built from each word’s sounds by rule, so they follow the system’s principles but will not always match the textbook form.</p></div>

        <div className="gtop">
          <div className="gsource">
            <div className={"drop"} style={{ padding: "18px 20px", marginBottom: 12 }}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}>
              <strong>{fileName || "Drop a .docx or .txt here"}</strong>
              <span className="muted" style={{ fontSize: 13.5 }}>{fileName ? "Loaded. Edit the text below if you like." : "A TSN, an order, or any English document."}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Choose a file</button>
                {s.text && <button type="button" className="btn ghost" onClick={() => { set("text", ""); setFileName(""); }}>Clear</button>}
              </div>
              <input ref={fileRef} type="file" accept=".docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
            </div>
            {fileErr && <p className="error" role="alert">{fileErr}</p>}
            <label className="f"><span>Text</span>
              <textarea value={s.text} placeholder={SAMPLE} onChange={(e) => { set("text", e.target.value); }} spellCheck={false} />
              <small>{paras.reduce((n, p) => n + p.words.length, 0)} words. {!s.text && "Showing a sample until you add text."}</small>
            </label>
          </div>
          <aside className="gopts" aria-label="Options">
            <label className="f"><span>Gregg series</span>
              <select value={s.series} onChange={(e) => set("series", e.target.value as Series)}>{SERIES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <small>{SERIES.find((x) => x.id === s.series)!.note} {Object.keys(briefs).length} brief forms.</small>
            </label>
            <label className="f"><span>Page</span>
              <select value={s.pageSize} onChange={(e) => set("pageSize", e.target.value as PdfOptions["pageSize"])}><option value="steno">Steno pad, 6 × 9 in</option><option value="letter">Letter</option><option value="a4">A4</option></select>
            </label>
            <label className="check" style={{ fontSize: 13.5 }}><input type="checkbox" checked={s.gloss} onChange={(e) => set("gloss", e.target.checked)} /><span>Print the English in small type under each line</span></label>
            <label className="check" style={{ fontSize: 13.5, alignItems: "start" }}><input type="checkbox" checked={s.names} onChange={(e) => set("names", e.target.checked)} /><span>Read unknown capitalised words as Filipino or Spanish names (Lomongo, Unabia, Carcar)</span></label>
            <button type="button" className="btn primary" onClick={savePdf} disabled={busy || !paras.length}>{busy ? "Making the PDF…" : "Save the PDF"}</button>
            {msg && <p className="muted" style={{ fontSize: 13 }} role="status">{msg}</p>}
            <p className="muted" style={{ fontSize: 12.5 }}>{dictErr ? dictErr : ready ? "Pronunciation dictionary loaded (125,000 words)." : "Loading the pronunciation dictionary (1.9 MB, once)…"}</p>
          </aside>
        </div>

        <div className="pad" ref={padRef}>
          <div className="spiral" />
          <div className="centerline" />
          <div className="padcols">
            {(narrow ? [lines] : [lines.slice(0, half), lines.slice(half)]).map((colLines, ci) => (
              <div key={ci} style={{ padding: ci ? "0 20px 0 28px" : "0 28px 0 20px" }}>
                {colLines.map((ln, li) => <PadLine key={li} line={ln} first={li === 0} gloss={s.gloss} />)}
                {!narrow && ci === 1 && colLines.length < half && Array.from({ length: half - colLines.length }).map((_, i) => <div key={"e" + i} className="padline" />)}
              </div>
            ))}
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: "#1A2233" }} />From the word’s sounds ({counts.dict || 0})</span>
          <span><i style={{ background: "#16308F" }} />Brief form ({(counts.brief || 0) + (counts.custom || 0)})</span>
          <span><i style={{ background: "#8A5A00" }} />Spelled out, not in the dictionary ({(counts.guess || 0) + (counts.filipino || 0)})</span>
          <span>Numbers and symbols stay in longhand.</span>
        </div>

        <section className="wordlist">
          <div className="sub" style={{ display: "flex", alignItems: "end", gap: 18, flexWrap: "wrap" }}>
            <div><h2>Words</h2><p>Check the outlines word by word. Type a stroke code to override one; your overrides are kept on this computer for the {SERIES.find((x) => x.id === s.series)!.name.split(" ")[0]} series.</p></div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {(["guess", "brief", "all"] as const).map((f) => <button key={f} type="button" className={"btn small" + (filter === f ? " primary" : "")} onClick={() => setFilter(f)}>{f === "guess" ? "Spelled out" : f === "brief" ? "Brief forms" : "All words"}</button>)}
            </div>
          </div>
          {shown.length === 0 ? <div className="empty">Nothing in this group.</div> : (
            <div style={{ overflowX: "auto" }}><table>
              <thead><tr><th>Word</th><th>Outline</th><th>Times</th><th>How it was made</th><th>Stroke code</th></tr></thead>
              <tbody>
                {shown.slice(0, 400).map((w) => {
                  const k = w.word.toLowerCase();
                  const custom = s.custom[s.series][k];
                  return (
                    <tr key={k}>
                      <td>{w.word}</td>
                      <td style={{ color: w.source === "brief" || w.source === "custom" ? "#16308F" : w.source === "guess" || w.source === "filipino" ? "#8A5A00" : "#1A2233" }}
                        dangerouslySetInnerHTML={{ __html: w.outline ? outlineSvg(w.outline, 10) : "<span class=muted>longhand</span>" }} />
                      <td>{w.n}</td>
                      <td className="muted">{sourceText(w.source)}{w.sounds ? <> · sounds <code>{w.sounds.join("")}</code></> : null}</td>
                      <td><input type="text" style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12.5 }} defaultValue={custom || tokensToCode(w.tokens)} key={k + (custom || "")}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v !== tokensToCode(w.tokens) || custom) setCustom(k, v === tokensToCode(w.tokens) && !briefs[k] ? "" : v); }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Stroke codes: K G R L N M T D TH P B F V SH CH J S X NG NK Y, blends TN TM MN NT MT DF, vowels A (large circle) E (small circle) I O U OW OI YU, “.” for the -ing dot, “-” for -ings, “h” for the h dot. Example: <code>K O R T</code> is “court”.</p>
        </section>
      </div>
      <div className="gfoot"><span className="hint">Nothing is uploaded. The PDF is made in this browser.</span><button type="button" className="btn primary" onClick={savePdf} disabled={busy}>Save the PDF</button></div>
    </main>
  );
}

function rank(s: Source) { return s === "guess" ? 0 : s === "filipino" ? 1 : s === "custom" ? 2 : s === "brief" ? 3 : s === "dict" ? 4 : 5; }
function sourceText(s: Source) {
  return s === "dict" ? "From its sounds" : s === "brief" ? "Brief form" : s === "custom" ? "Your override" : s === "filipino" ? "Spelled out as a Filipino/Spanish name" : s === "guess" ? "Spelled out (not in the dictionary)" : "Longhand";
}

function PadLine({ line, first, gloss }: { line: Line; first: boolean; gloss: boolean }) {
  const base = gloss ? LINE_H - 14 : LINE_H - 6; // the writing line; outlines rest on it
  return (
    <div className={"padline" + (first ? " first" : "")} style={{ height: LINE_H }}>
      <svg aria-hidden="true">
        {line.items.map((it, i) => {
          const w = it.word, x = it.x * UNIT;
          if (!w.outline) return <text key={i} x={x} y={base} fontSize={11} fill="#1A2233" fontFamily="var(--tsn)">{w.text}</text>;
          const o = w.outline;
          const cls = "outline" + (w.source === "brief" || w.source === "custom" ? " brief" : w.source === "guess" || w.source === "filipino" ? " guess" : "");
          return (
            <g key={i} className={cls} transform={`translate(${x - o.minX * UNIT} ${base - (o.minY + o.h) * UNIT}) scale(${UNIT})`} strokeWidth={1.6 / UNIT}>
              <path d={o.d} />
              {o.dots.map((d, j) => <circle key={j} cx={d.x} cy={d.y} r={0.07} fill="currentColor" stroke="none" />)}
              {o.dashes.map((d, j) => <path key={"d" + j} d={`M${d.x} ${d.y}h0.45`} />)}
            </g>
          );
        })}
      </svg>
      {gloss && <div className="eng" title={line.gloss}>{line.gloss}</div>}
    </div>
  );
}
