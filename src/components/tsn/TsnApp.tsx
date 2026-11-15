"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { C, STEPS, State, fresh, store, SETTINGS_KEY, SESSION_KEY, canGo, ensureSuggestions, buildUnits, download } from "./state";
import { StepCase } from "./StepCase";
import { StepRecording } from "./StepRecording";
import { StepNames } from "./StepNames";
import { StepSpeakers } from "./StepSpeakers";
import { StepSave } from "./StepSave";

export type Ctx = {
  S: State;
  update: (fn: (s: State) => void) => void;
  go: (i: number) => void;
  undoRef: React.RefObject<string[]>;
  saveSettings: () => void;
};

export function TsnApp() {
  const [S, setS] = useState<State>(() => fresh());
  const ref = useRef<State>(S);
  const undoRef = useRef<string[]>([]);
  const [resume, setResume] = useState<{ at: number; state: State } | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const sessionFile = useRef<HTMLInputElement>(null);

  // mutate the latest state outside React's updater (safe under StrictMode), then publish a new reference
  const update = useCallback((fn: (s: State) => void) => {
    fn(ref.current);
    const n = { ...ref.current };
    ref.current = n;
    setS(n);
  }, []);

  // settings and an unfinished session live in this browser only
  useEffect(() => {
    const set = store.get<{ staff?: State["staff"]; custom?: { from: string; to: string }[] }>(SETTINGS_KEY);
    if (set) update((s) => { s.staff = { ...s.staff, ...(set.staff || {}) }; s.custom = (set.custom || []).map((x) => ({ from: x.from, to: x.to, on: true })); });
    const sess = store.get<{ at: number; state: State }>(SESSION_KEY);
    if (sess && sess.state && (C.norm((sess.state.case && sess.state.case.caseNo) || "") || (sess.state.blocks || []).length)) {
      // defer: reading storage is the external system here, the offer is shown on the next tick
      const id = setTimeout(() => setResume(sess), 0);
      return () => clearTimeout(id);
    }
  }, [update]);

  // debounced autosave
  useEffect(() => {
    if (!S.blocks.length && !C.norm(S.case.caseNo) && !C.norm(S.case.plaintiffs)) return;
    const t = setTimeout(() => {
      const ok = store.set(SESSION_KEY, { at: Date.now(), state: S });
      setSavedMsg(ok ? "Work saved in this browser at " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "This browser is not keeping a copy. Use “Save progress to a file”.");
    }, 600);
    return () => clearTimeout(t);
  }, [S]);

  const saveSettings = useCallback(() => {
    const s = ref.current;
    store.set(SETTINGS_KEY, { staff: s.staff, custom: s.custom.map((x) => ({ from: x.from, to: x.to })) });
  }, []);

  const go = useCallback((i: number) => {
    const s = ref.current;
    if (i < 0 || i >= STEPS.length || !canGo(s, i)) return;
    update((d) => {
      if (i === 2) ensureSuggestions(d);
      if (i >= 3) { ensureSuggestions(d); if (!d.units.length) { buildUnits(d); undoRef.current = []; } }
      d.step = i; d.reached = Math.max(d.reached, i);
    });
    window.scrollTo(0, 0);
  }, [update]);

  const ctx: Ctx = { S, update, go, undoRef, saveSettings };

  const openSession = (file: File) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const j = JSON.parse(String(fr.result));
        if (j.app !== "tsn-formatter" || !j.state) throw new Error("bad");
        const n = Object.assign(fresh(), j.state) as State;
        ref.current = n; undoRef.current = []; setResume(null); setS(n);
      } catch { window.alert("That file is not a progress file from this tool."); }
    };
    fr.readAsText(file);
  };

  const hints = ["Next: load the Scriptix file.", S.blocks.length ? "Next: check the names." : "Load the recording to continue.", "Next: check who is speaking.", "Next: save the Word file.", ""];

  return (
    <div className="app">
      <nav className="rail" aria-label="Steps">
        <div className="brand">TSN from Scriptix<small>Turns a Scriptix transcript into a formatted Transcript of Stenographic Notes</small></div>
        <ol className="steps">
          {STEPS.map((name, i) => {
            const done = i < S.reached && i !== S.step;
            return (
              <li key={name} className={done ? "done" : ""}>
                <button type="button" onClick={() => go(i)} aria-current={i === S.step ? "step" : undefined} disabled={!canGo(S, i)}>
                  <span className="num">{done ? <svg className="tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5c2 1.6 3.4 3.3 4.6 5.3C11.2 12.6 14.8 8 20.5 4.2" /></svg> : i + 1}</span>
                  <span>{name}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="rail-foot">
          <span className="saved" role="status">{savedMsg}</span>
          <button type="button" className="linkbtn" onClick={() => download(JSON.stringify({ app: "tsn-formatter", v: 1, state: S }), "TSN progress " + (S.case.caseNo || "untitled") + ".json", "application/json")}>Save progress to a file</button>
          <button type="button" className="linkbtn" onClick={() => sessionFile.current?.click()}>Open a progress file</button>
          <input ref={sessionFile} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openSession(f); e.target.value = ""; }} />
          <button type="button" className="linkbtn" onClick={() => { if (window.confirm("Start a new transcript? The current one will be cleared from this browser.")) { store.del(SESSION_KEY); const n = fresh({ staff: S.staff, custom: S.custom }); ref.current = n; undoRef.current = []; setS(n); setSavedMsg(""); } }}>Start a new transcript</button>
          <span>Works offline. Nothing leaves this computer.</span>
        </div>
      </nav>
      <main className="main">
        <div className={"page" + (S.step === 3 ? " wide" : "")}>
          {S.step === 0 && resume && (
            <div className="notice">
              <p>You have unfinished work{resume.state.case.caseNo ? " on Case No. " + resume.state.case.caseNo : ""}, saved {new Date(resume.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.</p>
              <button type="button" className="btn primary" onClick={() => { const n = Object.assign(fresh(), resume.state) as State; ref.current = n; undoRef.current = []; setS(n); setResume(null); }}>Continue that transcript</button>
              <button type="button" className="btn" onClick={() => { setResume(null); store.del(SESSION_KEY); }}>Start a new one</button>
            </div>
          )}
          {S.step === 0 && <StepCase ctx={ctx} />}
          {S.step === 1 && <StepRecording ctx={ctx} />}
          {S.step === 2 && <StepNames ctx={ctx} />}
          {S.step === 3 && <StepSpeakers ctx={ctx} />}
          {S.step === 4 && <StepSave ctx={ctx} />}
        </div>
      </main>
      <div className="footbar">
        <span className="hint">{hints[S.step]}</span>
        {S.step > 0 && <button type="button" className="btn" onClick={() => go(S.step - 1)}>Back</button>}
        {S.step < STEPS.length - 1 && <button type="button" className="btn primary" onClick={() => go(S.step + 1)} disabled={!canGo(S, S.step + 1)}>Continue</button>}
      </div>
    </div>
  );
}
