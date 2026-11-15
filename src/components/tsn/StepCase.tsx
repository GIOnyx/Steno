"use client";
import { useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, EXAM_NAMES, CaseInfo, Staff } from "./state";

type Span = "" | "s2" | "s3" | "s4";
function Field({
  span = "",
  label,
  hint,
  tag,
  children,
}: {
  span?: Span;
  label: string;
  hint?: string;
  tag?: "required" | "optional";
  children: React.ReactNode;
}) {
  return (
    <label className={"f " + span}>
      <span>
        {label}
        {tag === "required" && <span className="req-pill">Required</span>}
        {tag === "optional" && <span className="opt-pill">Optional</span>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function StepCase({ ctx }: { ctx: Ctx }) {
  const { S, update, saveSettings } = ctx;
  const c = S.case;
  const [paste, setPaste] = useState("");
  const [fillNote, setFillNote] = useState<{ text: string; warn?: boolean } | null>(null);
  const setCase = <K extends keyof CaseInfo>(k: K, v: CaseInfo[K]) => update((s) => { s.case[k] = v; });
  const setStaff = (k: keyof Staff, v: string) => { update((s) => { s.staff[k] = v; }); saveSettings(); };

  const fill = () => {
    const r = C.parseSummary(paste || "");
    const count =
      (r.caseNo ? 1 : 0) +
      (r.plaintiffs ? 1 : 0) +
      (r.defendants ? 1 : 0) +
      (r.nature ? 1 : 0) +
      (r.witness ? 1 : 0) +
      (r.counsel?.length ? 1 : 0);

    if (!count) {
      setFillNote({
        text: "Could not recognize calendar labels (like “Civil Case no.”, “Case Title:”, or “FOR:”). Check what you pasted or type details below.",
        warn: true,
      });
      return;
    }

    update((s) => {
      const cs = s.case;
      if (r.caseType) cs.caseType = r.caseType;
      (["caseNo", "nature", "plaintiffs", "defendants", "witness", "witnessDesc"] as const).forEach((k) => {
        const val = r[k];
        if (val) cs[k] = val;
      });
      if (r.viceVersa !== undefined) cs.viceVersa = r.viceVersa;
      if (r.exam) cs.exam = r.exam;
      const many = (t: string) => /,|\band\b|\bsps\b|\bhrs\b|\bheirs\b|et\.? al/i.test(t || "");
      if (r.plaintiffs) cs.pDesig = many(r.plaintiffs) ? "Plaintiffs," : "Plaintiff,";
      if (r.defendants) cs.dDesig = cs.caseType === "Criminal" ? "Accused." : many(r.defendants) ? "Defendants." : "Defendant.";
      if (r.counsel && r.counsel.length) s.counsel = r.counsel.map((k: { name: string; roles: string }) => ({ name: k.name, roles: k.roles, label: "" }));
      cs.hdrP = ""; cs.hdrD = "";
    });
    setFillNote({ text: `Filled ${count} section${count > 1 ? "s" : ""} below. Review them and add the date & time.` });
  };

  return (
    <>
      <div className="pagehead">
        <div className="step-kicker">Step 1 of 5</div>
        <h1>Case details</h1>
        <p className="lede">Enter the details for your TSN cover page and page headers. Start with the quick-fill box if you have the court calendar entry copied.</p>
      </div>

      <section className="quick" aria-label="Quick fill">
        <header>
          <h2>Quick fill from calendar</h2>
          <p>Save typing by pasting a case entry from the court calendar.</p>
          <ol className="quick-steps">
            <li>Copy the case block from the calendar.</li>
            <li>Paste it into the box on the right.</li>
            <li>Click <strong>Fill in the form</strong>.</li>
          </ol>
        </header>
        <div>
          <textarea
            rows={4}
            value={paste}
            aria-label="Calendar entry"
            onChange={(e) => { setPaste(e.target.value); if (fillNote) setFillNote(null); }}
            placeholder={"Civil Case no/s. 958 and 964\nCase Title: … -versus- …\nFOR: …\nPlaintiff’s Counsel: …\nDefendant’s Counsel: …\nStatus: …"}
          />
          <div className="row">
            <button type="button" className="btn primary" onClick={fill} disabled={!paste.trim()}>Fill in the form</button>
            {paste.trim() && <button type="button" className="btn ghost small" onClick={() => { setPaste(""); setFillNote(null); }}>Clear box</button>}
            {fillNote && <span className={"fill-msg" + (fillNote.warn ? " warn" : "")} role="status">{fillNote.text}</span>}
          </div>
        </div>
      </section>

      <section className="group">
        <header>
          <h2><span className="sec-num">1</span>Case</h2>
          <p>Case type, docket number, and nature of action.</p>
        </header>
        <div className="fields">
          <Field span="s2" label="Kind of case">
            <select value={c.caseType} onChange={(e) => setCase("caseType", e.target.value)}><option>Civil</option><option>Criminal</option></select>
          </Field>
          <Field span="s4" label="Case number or numbers" tag="required">
            <input type="text" value={c.caseNo} placeholder="e.g. 958 and 964" onChange={(e) => setCase("caseNo", e.target.value)} />
          </Field>
          <Field label="For (Nature of the case)" hint="Text shown after “FOR:” in the caption.">
            <textarea rows={2} value={c.nature} placeholder="e.g. Recovery of Possession and other relief…" onChange={(e) => setCase("nature", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="group">
        <header>
          <h2><span className="sec-num">2</span>Parties</h2>
          <p>Full party names for the cover caption and short names for page headers.</p>
        </header>
        <div className="fields">
          <Field span="s4" label={c.caseType === "Criminal" ? "People / Complainant side" : "Plaintiff side"} tag="required">
            <textarea rows={3} value={c.plaintiffs} onChange={(e) => setCase("plaintiffs", e.target.value)} />
          </Field>
          <Field span="s2" label="Shown as"><input type="text" value={c.pDesig} onChange={(e) => setCase("pDesig", e.target.value)} /></Field>
          <Field span="s4" label={c.caseType === "Criminal" ? "Accused side" : "Defendant side"} tag="required">
            <textarea rows={2} value={c.defendants} onChange={(e) => setCase("defendants", e.target.value)} />
          </Field>
          <Field span="s2" label="Shown as"><input type="text" value={c.dDesig} onChange={(e) => setCase("dDesig", e.target.value)} /></Field>
          <label className="check"><input type="checkbox" checked={c.viceVersa} onChange={(e) => setCase("viceVersa", e.target.checked)} /><span>Consolidated cases with the parties reversed (adds “vice versa”)</span></label>
          <Field span="s3" label="Short header name, plaintiff side" tag="optional" hint="Leave blank to use the suggestion shown.">
            <input type="text" value={c.hdrP} placeholder={C.shortParty(c.plaintiffs)} onChange={(e) => setCase("hdrP", e.target.value)} />
          </Field>
          <Field span="s3" label="Short header name, defendant side" tag="optional" hint="Leave blank to use the suggestion shown.">
            <input type="text" value={c.hdrD} placeholder={C.shortParty(c.defendants)} onChange={(e) => setCase("hdrD", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="group">
        <header>
          <h2><span className="sec-num">3</span>Hearing & witness</h2>
          <p>When the hearing happened and who took the witness stand.</p>
        </header>
        <div className="fields">
          <Field span="s3" label="Date of hearing" tag="required"><input type="date" value={c.date} onChange={(e) => setCase("date", e.target.value)} /></Field>
          <Field span="s3" label="Time case was called" tag="required" hint="Leave blank if you prefer to write it in later."><input type="time" value={c.time} onChange={(e) => setCase("time", e.target.value)} /></Field>
          <Field span="s3" label="Witness name" tag="required"><input type="text" value={c.witness} placeholder="Jessica M. Lomongo" onChange={(e) => setCase("witness", e.target.value)} /></Field>
          <Field span="s3" label="Witness description" tag="optional"><input type="text" value={c.witnessDesc} placeholder="Defendants’ 4th witness-Cross examination" onChange={(e) => setCase("witnessDesc", e.target.value)} /></Field>
          <Field span="s3" label="Examination in this recording">
            <select value={c.exam} onChange={(e) => setCase("exam", e.target.value)}>{Object.entries(EXAM_NAMES).map(([v, t]) => <option key={v} value={v}>{t[0].toUpperCase() + t.slice(1)}</option>)}</select>
          </Field>
          <Field span="s3" label="Questions asked by">
            <select value={c.examiner} onChange={(e) => setCase("examiner", +e.target.value)}>{S.counsel.map((k, i) => <option key={i} value={i}>{C.norm(k.name) || "Counsel " + (i + 1)}</option>)}</select>
          </Field>
        </div>
      </section>

      <section className="group">
        <header>
          <h2><span className="sec-num">4</span>Counsel</h2>
          <p>Lawyers present at this hearing. Transcript label is what prints beside what they say.</p>
        </header>
        <div className="fields">
          {S.counsel.map((k, i) => (
            <div className="counsel" key={i}>
              <label>Name<input type="text" value={k.name} placeholder="Atty. Nathaniel Clarus" onChange={(e) => update((s) => { s.counsel[i].name = e.target.value; })} /></label>
              <label>Appears as<textarea rows={Math.max(2, String(k.roles || "").split("\n").length + 1)} value={k.roles} onChange={(e) => update((s) => { s.counsel[i].roles = e.target.value; })} /></label>
              <label>Transcript label<input type="text" value={k.label} placeholder={C.speakerLabelOf(k.name)} onChange={(e) => update((s) => { s.counsel[i].label = e.target.value; })} /></label>
              <button type="button" className="btn ghost small" onClick={() => update((s) => { s.counsel.splice(i, 1); if (s.case.examiner >= s.counsel.length) s.case.examiner = 0; })}>Remove</button>
            </div>
          ))}
          <div className="f"><button type="button" className="btn small" style={{ alignSelf: "start" }} onClick={() => update((s) => { s.counsel.push({ name: "", roles: "", label: "" }); })}>+ Add another counsel</button></div>
        </div>
      </section>

      <details className="group">
        <summary>Court staff & signature names <small>Saved automatically on this computer</small></summary>
        <div className="fields">
          {([
            ["judgeCover", "Judge, on the cover"], ["judge", "Judge, under the order"], ["judgeTitle", "Judge’s title"], ["place", "Place, under the order"],
            ["interp", "Court interpreter"], ["interpTitle", "Interpreter’s title"], ["steno", "Court stenographer"], ["stenoTitle", "Stenographer’s title"],
            ["tsnBy", "Name after “TSN.” in the page header"], ["certPlace", "Place, in the certification"],
          ] as [keyof Staff, string][]).map(([k, label]) => (
            <Field key={k} span="s3" label={label}><input type="text" value={S.staff[k]} onChange={(e) => setStaff(k, e.target.value)} /></Field>
          ))}
          <Field span="s3" label="Certification date" tag="optional" hint="Leave blank to print a blank line to fill in later."><input type="text" value={c.certDate} placeholder="8th day of NOVEMBER 2026" onChange={(e) => setCase("certDate", e.target.value)} /></Field>
        </div>
      </details>
    </>
  );
}
