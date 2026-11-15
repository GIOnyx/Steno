"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, EXAM_NAMES, Unit, buildUnits, isVerbatim, repsKey, speakerLabel, speakers } from "./state";

type Row = { kind: string; speaker: string; text: string; t: number | null; first: number; n: number; exam?: string; label?: string };

export function StepSpeakers({ ctx }: { ctx: Ctx }) {
  const { S, update, undoRef } = ctx;
  const [menu, setMenu] = useState<{ i: number; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState<{ i: number; value: string } | null>(null);
  const [xName, setXName] = useState("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const scrollSel = useRef(false);

  const rows: Row[] = C.groupRows(S.units);
  let n = 0;
  rows.forEach((r) => {
    if (r.kind === "head") { n = 0; r.label = speakerLabel(S, r.speaker) + ":"; }
    else if (r.kind === "q") { n++; r.label = "Q" + n + ":"; }
    else if (r.kind === "a") r.label = "A" + (n || 1) + ":";
    else if (r.kind === "order") r.label = "Order ¶";
    else r.label = speakerLabel(S, r.speaker) + ":";
  });
  const sp = speakers(S);
  const stale = S.unitsKey !== repsKey(S);
  const ok = isVerbatim(S);
  const edited = S.units.filter((u) => u.changed).length;

  const snap = useCallback(() => { undoRef.current.push(JSON.stringify(ctx.S.units)); if (undoRef.current.length > 150) undoRef.current.shift(); }, [undoRef, ctx.S.units]);
  const rowStart = (units: Unit[], i: number) => { let j = i; while (j > 0 && !units[j].start && units[j].kind !== "head") j--; return j; };

  const act = {
    label(kind: string, speaker: string) {
      const u = S.units[S.sel]; if (!u || u.kind === "head") return;
      snap(); scrollSel.current = true;
      update((s) => { const x = s.units[s.sel]; x.start = true; x.kind = kind; x.speaker = speaker || ""; if (s.sel < s.units.length - 1) s.sel++; });
    },
    join() {
      const i = S.sel, u = S.units[i];
      if (!u || i === 0 || u.kind === "head" || S.units[i - 1].kind === "head" || !u.start) return;
      snap(); update((s) => { const x = s.units[i]; x.start = false; delete x.kind; delete x.speaker; });
    },
    head() {
      const i = S.sel, u = S.units[i]; if (!u || u.kind === "head") return;
      snap(); scrollSel.current = true;
      update((s) => {
        const x = s.units[i];
        if (!x.start) { const o = s.units[rowStart(s.units, i)]; x.start = true; x.kind = o.kind; x.speaker = o.speaker; }
        const heads = s.units.slice(0, i).filter((y) => y.kind === "head"), last = heads[heads.length - 1];
        const nextExam: Record<string, string> = { direct: "cross", cross: "re-direct", "re-direct": "re-cross", "re-cross": "re-direct" };
        const ids = speakers(s).filter((y) => /^C\d/.test(y.id)).map((y) => y.id);
        const who = last ? (ids.find((y) => y !== last.speaker) || last.speaker) : "C" + (s.case.examiner || 0);
        s.units.splice(i, 0, { kind: "head", exam: last ? (nextExam[last.exam || ""] || "direct") : (s.case.exam || "direct"), speaker: who });
      });
    },
    remove() {
      const i = S.sel, u = S.units[i]; if (!u) return;
      snap();
      update((s) => {
        const nx = s.units[i + 1];
        if (u.kind !== "head" && u.start && nx && !nx.start && nx.kind !== "head") { nx.start = true; nx.kind = u.kind; nx.speaker = u.speaker; }
        s.units.splice(i, 1);
        const after = s.units[i];
        if (u.kind === "head" && after && !after.start) { after.start = true; after.kind = after.kind || "sp"; after.speaker = after.speaker || "COURT"; }
        s.sel = Math.max(0, Math.min(s.sel, s.units.length - 1));
      });
    },
    undo() {
      if (!undoRef.current.length) return;
      const prev = JSON.parse(undoRef.current.pop()!);
      update((s) => { s.units = prev; s.sel = Math.min(s.sel, s.units.length - 1); });
    },
    move(d: number) { const t = S.sel + d; if (t < 0 || t >= S.units.length) return; scrollSel.current = true; update((s) => { s.sel = t; }); },
    edit() { const u = S.units[S.sel]; if (!u || u.kind === "head") return; setEditing({ i: S.sel, value: u.text || "" }); },
  };
  const doAct = (a: string) => {
    if (a === "q" || a === "a") act.label(a, "");
    else if (a === "order") act.label("order", "");
    else if (a.startsWith("sp:")) act.label("sp", a.slice(3));
    else if (a === "join") act.join(); else if (a === "head") act.head(); else if (a === "remove") act.remove(); else if (a === "undo") act.undo(); else if (a === "edit") act.edit();
  };

  // keyboard
  const actRef = useRef(doAct);
  const moveRef = useRef(act.move);
  useEffect(() => { actRef.current = doAct; moveRef.current = act.move; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenu(null); return; }
      const tag = ((e.target as HTMLElement).tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.target as HTMLElement).closest?.(".menu")) return;
      const k = e.key;
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === "z") { e.preventDefault(); actRef.current("undo"); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (tag === "button" && (k === "Enter" || k === " ")) return;
      const low = k.toLowerCase();
      const spk = speakers(ctx.S).find((x) => x.key && x.key.toLowerCase() === low);
      let did = true;
      if (k === "ArrowDown" || low === "j") moveRef.current(1);
      else if (k === "ArrowUp" || low === "k") moveRef.current(-1);
      else if (low === "q") actRef.current("q");
      else if (low === "a") actRef.current("a");
      else if (low === "o") actRef.current("order");
      else if (spk) actRef.current("sp:" + spk.id);
      else if (low === "m" || k === "Backspace") actRef.current("join");
      else if (low === "h") actRef.current("head");
      else if (low === "e" || k === "Enter" || k === "F2") actRef.current("edit");
      else if (k === "Delete") actRef.current("remove");
      else did = false;
      if (did) e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ctx]);

  // keep the selected sentence in view after keyboard moves
  useLayoutEffect(() => {
    if (!scrollSel.current || !sheetRef.current) return;
    scrollSel.current = false;
    const el = sheetRef.current.querySelector(".u.sel, .txt.sel");
    if (el) el.scrollIntoView({ block: "nearest" });
  });
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".menu")) setMenu(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  useEffect(() => {
    if (editing && taRef.current) { const ta = taRef.current; ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, [editing?.i]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishEdit = (save: boolean) => {
    if (!editing) return;
    const { i, value } = editing;
    setEditing(null);
    const v = C.norm(value);
    if (save && v && v !== S.units[i].text) { snap(); update((s) => { s.units[i].text = v; s.units[i].changed = true; }); }
  };
  const splitEdit = (pos: number) => {
    if (!editing) return;
    const { i, value } = editing;
    const a = C.norm(value.slice(0, pos)), b = C.norm(value.slice(pos));
    if (!a || !b) return finishEdit(true);
    setEditing(null); snap();
    update((s) => {
      const u = s.units[i];
      const wasEdited = C.norm(value) !== u.text || u.changed;
      u.text = a; if (wasEdited) u.changed = true;
      s.units.splice(i + 1, 0, Object.assign({ text: b, t: u.t, start: false }, wasEdited ? { changed: true } : {}));
      s.sel = i + 1;
    });
  };

  const select = (i: number) => { if (editing) return; update((s) => { s.sel = i; }); };
  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, i: number) => {
    const r = e.currentTarget.getBoundingClientRect();
    update((s) => { s.sel = i; });
    setMenu({ i, x: Math.max(8, r.left + window.scrollX), y: r.bottom + window.scrollY + 4 });
  };
  const key = (k: string, text: string, a: string) => <button type="button" key={a} onClick={() => doAct(a)}><kbd>{k}</kbd><span>{text}</span></button>;

  const menuItems: [string, string][] = menu && S.units[menu.i]?.kind === "head" ? [["remove", "Remove this heading"]]
    : ([["q", "Question"], ["a", "Answer"]] as [string, string][]).concat(sp.map((x) => ["sp:" + x.id, x.label] as [string, string]), [["order", "Part of the court’s order"]]);

  return (
    <>
      <div className="pagehead"><h1>Speakers</h1><p className="lede">Scriptix does not say who is talking, so this is a first guess. Click a sentence, then press a key to say who speaks it. A new row starts at that sentence.</p></div>
      {stale && (
        <div className="notice warn">
          <p>The case range or the name fixes changed after these rows were made.</p>
          <button type="button" className="btn primary" onClick={() => { undoRef.current = []; update((s) => buildUnits(s)); }}>Rebuild the rows</button>
          <button type="button" className="btn" onClick={() => update((s) => { s.unitsKey = repsKey(s); })}>Keep these rows</button>
        </div>
      )}
      <div className="work">
        <div className="sheet" ref={sheetRef}>
          {rows.map((r) => {
            if (r.kind === "head") {
              return (
                <div className="row head" key={"h" + r.first}>
                  <div className="ts"></div>
                  <button type="button" className="lab" onClick={(e) => openMenu(e, r.first)}>{r.label}</button>
                  <div className={"txt" + (S.sel === r.first ? " sel" : "")} onClick={(e) => { if (!(e.target as HTMLElement).closest("select")) select(r.first); }}>
                    Questions to the witness for{" "}
                    <select aria-label="Kind of examination" value={r.exam} onChange={(e) => { snap(); update((s) => { s.units[r.first].exam = e.target.value; }); }}>
                      {Object.entries(EXAM_NAMES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>{" "}examination.{" "}
                    <span className="muted" style={{ fontWeight: 400 }}>Asked by</span>{" "}
                    <select aria-label="Asked by" value={r.speaker} onChange={(e) => { snap(); update((s) => { s.units[r.first].speaker = e.target.value; }); }}>
                      {sp.filter((x) => /^[CX]\d/.test(x.id)).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                  </div>
                </div>
              );
            }
            const spans = [];
            for (let i = r.first; i < r.first + r.n; i++) {
              const u = S.units[i];
              if (editing && editing.i === i) {
                spans.push(
                  <span key={i}>
                    <span className="edithelp">Enter to finish, Esc to cancel, Ctrl+Enter to split here</span>
                    <textarea ref={taRef} aria-label="Edit the words" value={editing.value}
                      onChange={(e) => { setEditing({ i, value: e.target.value }); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + 2 + "px"; }}
                      onBlur={() => finishEdit(true)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Escape") { e.preventDefault(); finishEdit(false); }
                        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); splitEdit(e.currentTarget.selectionStart); }
                        else if (e.key === "Enter") { e.preventDefault(); finishEdit(true); }
                      }} />
                  </span>);
              } else {
                spans.push(<span key={i} className={"u" + (i === S.sel ? " sel" : "") + (u.changed ? " changed" : "")}
                  onClick={() => select(i)} onDoubleClick={() => { update((s) => { s.sel = i; }); setEditing({ i, value: u.text || "" }); }}>{u.text}</span>, " ");
              }
            }
            return (
              <div className={"row " + r.kind} key={r.first}>
                <div className="ts">{C.fmtTime(r.t)}</div>
                <button type="button" className="lab" title="Change who is speaking" onClick={(e) => openMenu(e, r.first)}>{r.label}</button>
                <div className="txt">{spans}</div>
              </div>
            );
          })}
        </div>
        <aside className="panel" aria-label="Row tools">
          <div className={"badge " + (ok ? "ok" : "note")}>{ok ? "Every word matches the recording, in order." : (edited ? edited + " sentence" + (edited > 1 ? "s" : "") + " edited by hand. " : "") + "The wording now differs from the Scriptix text."}</div>
          <div><h3>Who says the highlighted sentence</h3><div className="keys">
            {key("Q", "Question", "q")}{key("A", "Answer", "a")}
            {sp.map((x) => key(x.key || "•", x.label, "sp:" + x.id))}
            {key("O", "Part of the court’s order", "order")}
          </div></div>
          <div><h3>Fix the rows</h3><div className="keys">
            {key("M", "Join to the row above", "join")}{key("E", "Edit the words", "edit")}
            {key("H", "Add an examination heading", "head")}{key("Del", "Remove this sentence", "remove")}{key("Ctrl+Z", "Undo", "undo")}
          </div><p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Move with the arrow keys. While editing, Ctrl+Enter splits the sentence where the cursor is.</p></div>
          <label className="check" style={{ fontSize: 13.5, alignItems: "start" }}><input type="checkbox" checked={S.cont} onChange={(e) => update((s) => { s.cont = e.target.checked; })} /><span>Print a “CONT.” line when counsel resumes after an interruption</span></label>
          <div><h3>Someone else speaks</h3><div style={{ display: "flex", gap: 6 }}>
            <input type="text" placeholder="PROS. EJEM" aria-label="New speaker label" value={xName} onChange={(e) => setXName(e.target.value)} />
            <button type="button" className="btn small" onClick={() => { const v = C.norm(xName).replace(/:$/, "").toUpperCase(); if (v && !S.extras.includes(v)) update((s) => { s.extras.push(v); }); setXName(""); }}>Add</button>
          </div></div>
        </aside>
      </div>
      {menu && (
        <div className="menu" role="menu" style={{ left: menu.x, top: menu.y }}>
          {menuItems.map(([a, t]) => <button type="button" role="menuitem" key={a} onClick={() => { setMenu(null); doAct(a); }}>{t}</button>)}
        </div>
      )}
    </>
  );
}
