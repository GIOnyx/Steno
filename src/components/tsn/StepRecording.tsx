"use client";
import { useEffect, useRef, useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, vocab, readRecordingFile } from "./state";

const LET = "A-Za-zÀ-ɏ";

export function StepRecording({ ctx }: { ctx: Ctx }) {
  const { S, update } = ctx;
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [scrollTo, setScrollTo] = useState<"s" | "e" | null>(null);

  const names: string[] = vocab(S).filter((v: { name: string; key: string }) => !v.name.includes(" ") && v.key.length >= 4).map((v: { key: string }) => v.key);
  const markRe = names.length ? new RegExp("(?<![" + LET + "])(" + names.join("|") + ")(?![" + LET + "])", "gi") : null;
  const mark = (text: string) => (markRe ? text.split(markRe).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part)) : text);

  const load = async (file: File) => {
    setErr("");
    try {
      const lines = await readRecordingFile(file);
      const blocks = C.parseBlocks(lines);
      if (!blocks.length) { setErr("No time stamps like [00:39:41] were found in “" + file.name + "”. Choose the transcript exported from Scriptix."); return; }
      update((s) => {
        s.blocks = blocks; s.fileName = file.name;
        s.suggested = C.suggestRange(blocks, vocab(s));
        s.range = s.suggested ? { start: s.suggested.start, end: s.suggested.end } : { start: 0, end: blocks.length - 1 };
        s.units = []; s.sugg = []; s.suggKey = ""; s.reached = Math.min(s.reached, 1);
      });
      setScrollTo("s");
    } catch (e) { setErr((e as Error).message); }
  };

  useEffect(() => {
    if (!scrollTo || !listRef.current) return;
    const el = listRef.current.querySelector(scrollTo === "s" ? ".blk.edge-s" : ".blk.edge-e");
    if (el) el.scrollIntoView({ block: "center" });
    setScrollTo(null);
  }, [scrollTo, S.range]);

  const picker = <input ref={fileRef} type="file" accept=".docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />;
  const head = <div className="pagehead"><h1>Recording</h1><p className="lede">Load the Scriptix transcript of the whole hearing, then mark where this case starts and ends. One recording often holds several cases.</p></div>;

  if (!S.blocks.length) {
    return (
      <>
        {head}
        <div className={"drop" + (over ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) load(f); }}>
          <strong>Drop the Scriptix file here</strong>
          <span className="muted">A Word file (.docx) or text file exported from Scriptix</span>
          <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>Choose the file</button>
          {picker}
        </div>
        {err && <p className="error" role="alert">{err}</p>}
      </>
    );
  }

  const r = S.range!, a = S.blocks[r.start], z = S.blocks[r.end];
  const sug = S.suggested, isSug = !!sug && sug.start === r.start && sug.end === r.end;
  return (
    <>
      {head}
      <p className="muted" style={{ marginBottom: 6 }}>{S.fileName}, {S.blocks.length} time-stamped parts. <button type="button" className="linkbtn" onClick={() => fileRef.current?.click()}>Choose a different file</button>{picker}</p>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="rangebar">
        <span className="span">{a.ts} to {z.ts}<small>{r.end - r.start + 1} parts selected{isSug ? ", suggested from the case names" : ""}</small></span>
        {sug && !isSug && <button type="button" className="btn small" onClick={() => update((s) => { s.range = { start: sug.start, end: sug.end }; })}>Use the suggested range</button>}
        <button type="button" className="btn small" onClick={() => setScrollTo("s")}>Show the start</button>
        <button type="button" className="btn small" onClick={() => setScrollTo("e")}>Show the end</button>
      </div>
      {!sug && <div className="notice warn" style={{ marginTop: 14 }}><p>None of the case names were found in this recording, so the whole file is selected. Hover over a part and choose “Start here” or “End here”.</p></div>}
      <ul className="blocks" ref={listRef}>
        {S.blocks.map((b, i) => {
          const inn = i >= r.start && i <= r.end;
          return (
            <li key={i} className={"blk" + (inn ? " in" : "") + (i === r.start ? " edge-s" : "") + (i === r.end ? " edge-e" : "")}>
              <time>{b.ts}</time>
              <p>{i === r.start && <span className="tag">Start</span>}{i === r.end && <span className="tag">End</span>}{mark(b.text)}</p>
              <span className="acts">
                <button type="button" className="btn small" onClick={() => update((s) => { s.range!.start = i; if (s.range!.end < i) s.range!.end = i; })}>Start here</button>
                <button type="button" className="btn small" onClick={() => update((s) => { s.range!.end = i; if (s.range!.start > i) s.range!.start = i; })}>End here</button>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
