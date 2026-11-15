"use client";
import { useEffect, useRef, useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, vocab, readRecordingFile } from "./state";

export function StepRecording({ ctx }: { ctx: Ctx }) {
  const { S, update } = ctx;
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [scrollTo, setScrollTo] = useState<"s" | "e" | null>(null);

  const names: string[] = vocab(S).filter((v) => !v.name.includes(" ") && v.key.length >= 4).map((v) => C.reEsc(v.key));
  const markRe = names.length ? new RegExp("(?<![" + C.LET + "])(" + names.join("|") + ")(?![" + C.LET + "])", "gi") : null;
  const mark = (text: string) => (markRe ? text.split(markRe).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part)) : text);

  const load = async (file: File) => {
    setErr("");
    try {
      const lines = await readRecordingFile(file);
      const blocks = C.parseBlocks(lines);
      if (!blocks.length) {
        setErr("No time stamps like [00:39:41] were found in “" + file.name + "”. Make sure you exported the Scriptix transcript with timestamps.");
        return;
      }
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
  const head = (
    <div className="pagehead">
      <div className="step-kicker">Step 2 of 5</div>
      <h1>Recording</h1>
      <p className="lede">Load the Scriptix export (.docx or .txt). If the recording holds several cases, use <strong>Start here</strong> and <strong>End here</strong> to mark only this case.</p>
    </div>
  );

  if (!S.blocks.length) {
    return (
      <>
        {head}
        <div
          className={"drop" + (over ? " over" : "")}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) load(f); }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 16V4m0 0-4 4m4-4 4 4" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <strong>Drop your Scriptix file here</strong>
          <span className="muted">Accepts Word (.docx) or plain text (.txt) files exported from Scriptix</span>
          <button type="button" className="btn primary" onClick={() => fileRef.current?.click()}>Choose the file from your computer</button>
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
      <div className="notice" style={{ marginBottom: 14 }}>
        <p><strong>Loaded:</strong> {S.fileName} ({S.blocks.length} time-stamped parts). Highlighted yellow words match names from Case details.</p>
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>Choose a different file</button>
        {picker}
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="rangebar">
        <span className="span">
          {a.ts} to {z.ts}
          <small>{r.end - r.start + 1} of {S.blocks.length} parts included{isSug ? " · auto-selected from case names" : ""}</small>
        </span>
        {sug && !isSug && (
          <button type="button" className="btn small" onClick={() => { update((s) => { s.range = { start: sug.start, end: sug.end }; }); setScrollTo("s"); }}>
            Reset to suggested
          </button>
        )}
        <button type="button" className="btn small" onClick={() => setScrollTo("s")}>Jump to Start</button>
        <button type="button" className="btn small" onClick={() => setScrollTo("e")}>Jump to End</button>
      </div>
      {!sug && (
        <div className="notice warn" style={{ marginTop: 10 }}>
          <p>None of the case names were found automatically, so the whole file is selected. Click <strong>Start here</strong> or <strong>End here</strong> on any line below to trim it.</p>
        </div>
      )}
      <ul className="blocks" ref={listRef}>
        {S.blocks.map((b, i) => {
          const inn = i >= r.start && i <= r.end;
          const isStart = i === r.start;
          const isEnd = i === r.end;
          return (
            <li key={i} className={"blk" + (inn ? " in" : "") + (isStart ? " edge-s" : "") + (isEnd ? " edge-e" : "")}>
              <time>{b.ts}</time>
              <p>{isStart && <span className="tag">Start</span>}{isEnd && <span className="tag">End</span>}{mark(b.text)}</p>
              <span className="acts">
                <button
                  type="button"
                  className={"btn small" + (isStart ? " active" : "")}
                  onClick={() => update((s) => { s.range!.start = i; if (s.range!.end < i) s.range!.end = i; })}
                >
                  Start here
                </button>
                <button
                  type="button"
                  className={"btn small" + (isEnd ? " active" : "")}
                  onClick={() => update((s) => { s.range!.end = i; if (s.range!.start > i) s.range!.start = i; })}
                >
                  End here
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
