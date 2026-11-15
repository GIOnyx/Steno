"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { docxText, loadDictionary, renderText, type Para, type Source, type Word } from "@/lib/gregg/engine";
import { SERIES, briefForms, tokensToCode, type Series } from "@/lib/gregg/rules";
import { outlineSvg } from "@/lib/gregg/strokes";
import { EMBOLDEN } from "@/lib/gregg/grascii";
import { flow, type Line } from "@/lib/gregg/layout";
import { buildPdf, type PdfOptions } from "@/lib/gregg/pdf";

const KEY = "stenoTools.gregg.v1";
type Saved = { series: Series; gloss: boolean; colour: boolean; pageSize: PdfOptions["pageSize"]; names: boolean; custom: Record<Series, Record<string, string>>; text: string };
const DEFAULT: Saved = { series: "centennial", gloss: true, colour: true, pageSize: "steno", names: true, custom: { centennial: {}, simplified: {}, anniversary: {} }, text: "" };
const SAMPLE = "When called today for the continuation of trial, Atty. Nathaniel Clarus appeared as plaintiffs’ counsel in Civil Case No. 958.\nCalled to the witness stand is the fourth witness, Jessica M. Lomongo, whose testimony was completed today.";

const UNIT = 13;            // px per stroke unit on screen
const LINE_H = 52;          // px per ruled line

export function GreggApp() {
  const [s, setS] = useState<Saved>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [dictErr, setDictErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileErr, setFileErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "guess" | "brief">("guess");
  const [showText, setShowText] = useState(false);
  const [over, setOver] = useState(false);
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
  const wordCount = paras.reduce((n, p) => n + p.words.length, 0);
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
      const bytes = await buildPdf(paras, { pageSize: s.pageSize, gloss: s.gloss, colour: s.colour, series: SERIES.find((x) => x.id === s.series)!.name, title: fileName.replace(/\.[^.]+$/, "") });
      const name = (fileName ? fileName.replace(/\.[^.]+$/, "") : "shorthand") + " - Gregg.pdf";
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setMsg("Saved “" + name + "” to your Downloads folder.");
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
        <div className="pagehead">
          <h1>Gregg shorthand</h1>
          <p className="lede">Upload a Word or text file—or type or paste English text—to read it on a ruled steno pad and save it as a printable PDF.</p>
        </div>

        {s.text ? (
          <div className="gsrc" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}>
            <strong>{fileName || "Pasted text"}</strong>
            <span className="meta">{wordCount.toLocaleString()} words · {paras.length} paragraph{paras.length > 1 ? "s" : ""}</span>
            <span className="grow" />
            <button type="button" className="btn small" onClick={() => setShowText((v) => !v)}>{showText ? "Hide the text" : "Edit the text"}</button>
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>Choose another file</button>
            <button type="button" className="btn ghost small" onClick={() => { set("text", ""); setFileName(""); setShowText(false); }}>Clear</button>
          </div>
        ) : (
          <div className={"gsrc empty" + (over ? " over" : "")} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}>
            <strong>Drop a Word (.docx) or text (.txt) file here</strong>
            <span className="meta">Or click below to pick a file or type your own text. A sample transcript is previewed on the pad below.</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>Choose a file</button>
              <button type="button" className="btn" onClick={() => setShowText((v) => !v)}>{showText ? "Hide text box" : "Type or paste text"}</button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }} />
        {fileErr && <p className="error" role="alert">{fileErr}</p>}
        {showText && (
          <div className="gtext"><label className="f"><span>English text</span>
            <textarea value={s.text} placeholder={SAMPLE} onChange={(e) => set("text", e.target.value)} spellCheck={false} autoFocus />
            <small>{!s.text && "Showing a sample on the steno pad until you type or paste text here."}</small>
          </label></div>
        )}

        <div className="gbar" role="toolbar" aria-label="Options">
          <label className="f"><span>Series</span>
            <select value={s.series} onChange={(e) => set("series", e.target.value as Series)}>{SERIES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
          <label className="f"><span>PDF paper size</span>
            <select value={s.pageSize} onChange={(e) => set("pageSize", e.target.value as PdfOptions["pageSize"])}><option value="steno">Steno pad 6 × 9 in</option><option value="letter">Letter</option><option value="a4">A4</option></select>
          </label>
          <label className="check"><input type="checkbox" checked={s.gloss} onChange={(e) => set("gloss", e.target.checked)} /><span>English under each line</span></label>
          <label className="check"><input type="checkbox" checked={s.colour} onChange={(e) => set("colour", e.target.checked)} /><span>Colour by source</span></label>
          <label className="check" title="Unknown capitalised words are read as spelled, the way Filipino and Spanish names are pronounced"><input type="checkbox" checked={s.names} onChange={(e) => set("names", e.target.checked)} /><span>Read names as Filipino</span></label>
          <div className="right">
            <span className={"status-pill " + (dictErr ? "warn" : ready ? "ready" : "")}>
              {dictErr ? "Dictionary unavailable" : ready ? "Dictionary loaded" : "Loading dictionary…"}
            </span>
            <button type="button" className="btn primary" onClick={savePdf} disabled={busy || !paras.length}>{busy ? "Making the PDF…" : "Save the PDF"}</button>
          </div>
        </div>
        {msg && <div className="notice ok" style={{ marginBottom: 10 }} role="status"><p>{msg}</p></div>}
        <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 0" }}>
          {!s.text && <strong>Sample preview · </strong>}
          {SERIES.find((x) => x.id === s.series)!.note} ({Object.keys(briefs).length} brief forms active)
        </p>

        <div className={"pad" + (narrow ? " narrow" : "")} ref={padRef}>
          <div className="spiral" />
          <div className="centerline" />
          <div className="padcols">
            {(narrow ? [lines] : [lines.slice(0, half), lines.slice(half)]).map((colLines, ci) => (
              <div key={ci} style={{ padding: narrow ? "0 20px" : ci ? "0 20px 0 28px" : "0 28px 0 20px" }}>
                {colLines.map((ln, li) => <PadLine key={li} line={ln} first={li === 0} gloss={s.gloss} colour={s.colour} />)}
                {!narrow && ci === 1 && colLines.length < half && Array.from({ length: half - colLines.length }).map((_, i) => <div key={"e" + i} className="padline" />)}
              </div>
            ))}
          </div>
        </div>

        <div className="legend">
          <span><i style={{ background: "#1A2233" }} />1930 dictionary ({counts.gregg1930 || 0})</span>
          <span><i style={{ background: "#475A7A" }} />Sound-based ({counts.dict || 0})</span>
          <span><i style={{ background: "#16308F" }} />Brief form / custom ({(counts.brief || 0) + (counts.custom || 0)})</span>
          <span><i style={{ background: "#8A5A00" }} />Spelled out ({(counts.guess || 0) + (counts.filipino || 0)})</span>
          <span>Numbers & punctuation stay in longhand.</span>
        </div>

        <section className="wordlist">
          <div className="sub" style={{ display: "flex", alignItems: "end", gap: 18, flexWrap: "wrap" }}>
            <div>
              <h2>Word-by-word check</h2>
              <p>Inspect how each word was drawn. You can edit any outline’s stroke code on the right and it will be remembered for the {SERIES.find((x) => x.id === s.series)!.name.split(" ")[0]} series.</p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["guess", "brief", "all"] as const).map((f) => (
                <button key={f} type="button" className={"btn small" + (filter === f ? " primary" : "")} onClick={() => setFilter(f)}>
                  {f === "guess" ? "Spelled out" : f === "brief" ? "Brief forms" : "All words"}
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? <div className="empty">No words in this filter. Try switching to “All words” above.</div> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Word</th><th>Outline</th><th>Times</th><th>Source</th><th>Stroke code override</th></tr></thead>
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
                      <td className="muted">{sourceText(w.source)}{w.grascii ? <> · <code>{w.grascii}</code></> : w.sounds ? <> · sounds <code>{w.sounds.join("")}</code></> : null}</td>
                      <td>
                        <input
                          type="text"
                          aria-label={"Stroke code for " + w.word}
                          style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 13 }}
                          defaultValue={custom || tokensToCode(w.tokens)}
                          key={k + (custom || "")}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v !== tokensToCode(w.tokens) || custom) setCustom(k, v === tokensToCode(w.tokens) && !briefs[k] ? "" : v); }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}

          <details className="stroke-guide">
            <summary>Stroke code guide (for manual overrides)</summary>
            <p>Consonants: <code>K G R L N M T D TH P B F V SH CH J S X NG NK Y</code> · Blends: <code>TN TM MN NT MT DF</code> and <code>TD</code> (ted/ded/dit) · Vowels: <code>A</code> (large circle), <code>E</code> (small circle), <code>EF</code> (flattened e / -ily), <code>I O U OW OI YU</code> (add <code>_</code> after a vowel for medial w, e.g. <code>E_</code>) · Suffixes/dots: <code>.</code> (-ing dot / a / an), <code>~s</code> (-ings), <code>~e</code> (-ingly), <code>h</code> (h dot). Example: <code>K O R T</code> draws “court”.</p>
          </details>
        </section>
      </div>
      <div className="gfoot">
        <span className="hint">Nothing leaves this computer; the PDF is created directly in your browser.</span>
        <button type="button" className="btn primary" onClick={savePdf} disabled={busy}>Save the PDF</button>
      </div>
    </main>
  );
}

function rank(s: Source) { return s === "guess" ? 0 : s === "filipino" ? 1 : s === "custom" ? 2 : s === "brief" ? 3 : s === "dict" ? 4 : s === "gregg1930" ? 5 : 6; }
function sourceText(s: Source) {
  return s === "gregg1930" ? "1930 dictionary" : s === "dict" ? "From sounds" : s === "brief" ? "Brief form" : s === "custom" ? "Your override" : s === "filipino" ? "Filipino/Spanish spelling" : s === "guess" ? "Spelled out" : "Longhand";
}

function PadLine({ line, first, gloss, colour }: { line: Line; first: boolean; gloss: boolean; colour: boolean }) {
  const base = gloss ? LINE_H - 14 : LINE_H - 6; // the writing line; outlines rest on it
  return (
    <div className={"padline" + (first ? " first" : "")} style={{ height: LINE_H }}>
      <svg aria-hidden="true">
        {line.items.map((it, i) => {
          const w = it.word, x = it.x * UNIT;
          if (!w.outline) return <text key={i} x={x} y={base} fontSize={11} fill="#1A2233" fontFamily="var(--tsn)">{w.text}</text>;
          const o = w.outline;
          const cls = "outline" + (o.filled ? " filled" : "") + (!colour ? "" : w.source === "brief" || w.source === "custom" ? " brief" : w.source === "guess" || w.source === "filipino" ? " guess" : "");
          return (
            <g key={i} className={cls} transform={`translate(${x - o.minX * UNIT} ${base - (o.minY + o.h) * UNIT}) scale(${UNIT})`} strokeWidth={o.filled ? EMBOLDEN : 1.9 / UNIT}>
              <path d={o.d} />
              {o.dots.map((d, j) => <circle key={j} cx={d.x} cy={d.y} r={0.08} fill="currentColor" stroke="none" />)}
              {o.dashes.map((d, j) => o.filled ? <rect key={"d" + j} x={d.x} y={d.y - 0.035} width={0.45} height={0.07} rx={0.035} /> : <path key={"d" + j} d={`M${d.x} ${d.y}h0.45`} />)}
            </g>
          );
        })}
      </svg>
      {gloss && <div className="eng" title={line.gloss}>{line.gloss}</div>}
    </div>
  );
}
