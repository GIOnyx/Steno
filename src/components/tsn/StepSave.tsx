"use client";
import { useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, isVerbatim, missing, download, b64ToBytes, speakerLabel } from "./state";
import { TEMPLATE_B64, FRAGMENTS } from "@/lib/tsn/template";

export function StepSave({ ctx }: { ctx: Ctx }) {
  const { S, update } = ctx;
  const c = S.case, rows = C.groupRows(S.units);
  const q = rows.filter((r: { kind: string }) => r.kind === "q").length, o = rows.filter((r: { kind: string }) => r.kind === "order").length;
  const name = S.outName || C.fileName({ ...c });
  const miss = missing(S);
  const r = S.range;
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const save = () => {
    try {
      let n = C.norm(name) || "TSN.docx";
      if (!/\.docx$/i.test(n)) n += ".docx";
      const bytes = C.buildDocx(b64ToBytes(TEMPLATE_B64), FRAGMENTS, { case: S.case, staff: S.staff, counsel: S.counsel, rows, cont: S.cont, speakerLabel: (id: string) => speakerLabel(S, id) });
      download(bytes, n, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      setMsg({ text: "Saved “" + n + "” to your browser’s download folder." });
    } catch (e) { setMsg({ text: "The file could not be made: " + (e as Error).message, error: true }); }
  };

  return (
    <>
      <div className="pagehead"><h1>Save</h1><p className="lede">The transcript is laid out like your other TSNs: cover page, case header on every page, the four-column table, the court’s order and the certification.</p></div>
      {miss.length > 0 && <div className="notice warn"><p>Still blank: {miss.join(", ")}. You can save now and type these in Word, or go back to Case details.</p></div>}
      <dl className="summary">
        <dt>Case</dt><dd>{(c.caseType || "Civil") + " Case No. " + (c.caseNo || "—")}</dd>
        <dt>Parties</dt><dd>{(c.hdrP || C.shortParty(c.plaintiffs) || "—") + " versus " + (c.hdrD || C.shortParty(c.defendants) || "—")}</dd>
        <dt>Hearing</dt><dd>{c.date ? C.longDate(c.date) : "—"}</dd>
        <dt>Witness</dt><dd>{c.witness || "—"}</dd>
        <dt>From the recording</dt><dd>{r ? S.blocks[r.start].ts + " to " + S.blocks[r.end].ts : "—"}</dd>
        <dt>Transcript</dt><dd>{rows.filter((x: { kind: string }) => x.kind !== "head" && x.kind !== "order").length} rows, {q} questions{o ? ", order in " + o + " paragraph" + (o > 1 ? "s" : "") : ", no order"}</dd>
        <dt>Wording</dt><dd>{isVerbatim(S) ? "Word for word from Scriptix, names corrected" : "Edited by hand in places"}</dd>
      </dl>
      <div className="saveline">
        <label className="f"><span>File name</span><input type="text" value={name} onChange={(e) => update((s) => { s.outName = e.target.value; })} /></label>
        <button type="button" className="btn primary" onClick={save}>Save the Word file</button>
      </div>
      {msg && <p className={msg.error ? "error" : "muted"} style={{ marginTop: 12 }} role="status">{msg.text}</p>}
    </>
  );
}
