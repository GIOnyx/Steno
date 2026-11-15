"use client";
import { useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, isVerbatim, missing, download, b64ToBytes, speakerLabel } from "./state";
import { TEMPLATE_B64, FRAGMENTS } from "@/lib/tsn/template";

export function StepSave({ ctx }: { ctx: Ctx }) {
  const { S, update, go } = ctx;
  const c = S.case, rows = C.groupRows(S.units);
  const q = rows.filter((r) => r.kind === "q").length, o = rows.filter((r) => r.kind === "order").length;
  const name = S.outName || C.fileName({ ...c });
  const miss = missing(S);
  const r = S.range;
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const save = () => {
    try {
      let n = C.norm(name) || "TSN.docx";
      if (!/\.docx$/i.test(n)) n += ".docx";
      const bytes = C.buildDocx(b64ToBytes(TEMPLATE_B64), FRAGMENTS, {
        case: S.case,
        staff: S.staff,
        counsel: S.counsel,
        rows,
        cont: S.cont,
        speakerLabel: (id: string) => speakerLabel(S, id),
      });
      download(bytes, n, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      setMsg({ text: "Saved “" + n + "”. Check your computer’s Downloads folder to open it in Microsoft Word." });
    } catch (e) { setMsg({ text: "The file could not be made: " + (e as Error).message, error: true }); }
  };

  return (
    <>
      <div className="pagehead">
        <div className="step-kicker">Step 5 of 5</div>
        <h1>Save</h1>
        <p className="lede">Review the summary below, then download your finished Microsoft Word (.docx) file formatted with cover page, running header, table, order, and certification.</p>
      </div>

      {miss.length > 0 ? (
        <div className="notice warn">
          <p><strong>Still blank:</strong> {miss.join(", ")}. You can download anyway and type them in Word later, or jump back to fill them in now.</p>
          <button type="button" className="btn small" onClick={() => go(0)}>Fix in Case details</button>
        </div>
      ) : (
        <div className="notice ok">
          <p><strong>All case details look complete.</strong> Ready to save your Word document.</p>
        </div>
      )}

      <dl className="summary">
        <dt>Case</dt><dd>{(c.caseType || "Civil") + " Case No. " + (c.caseNo || "—")}</dd>
        <dt>Parties</dt><dd>{(c.hdrP || C.shortParty(c.plaintiffs) || "—") + " versus " + (c.hdrD || C.shortParty(c.defendants) || "—")}</dd>
        <dt>Hearing date</dt><dd>{c.date ? C.longDate(c.date) : "—"}</dd>
        <dt>Witness</dt><dd>{c.witness || "—"}</dd>
        <dt>Recording range</dt><dd>{r ? S.blocks[r.start].ts + " to " + S.blocks[r.end].ts : "—"}</dd>
        <dt>Transcript body</dt><dd>{rows.filter((x) => x.kind !== "head" && x.kind !== "order").length} rows, {q} questions{o ? ", order in " + o + " paragraph" + (o > 1 ? "s" : "") : ", no order"}</dd>
        <dt>Wording check</dt><dd>{isVerbatim(S) ? "Word for word from Scriptix (with name fixes)" : "Edited by hand in places"}</dd>
      </dl>

      <div className="saveline">
        <label className="f">
          <span>Word file name</span>
          <input type="text" value={name} onChange={(e) => update((s) => { s.outName = e.target.value; })} />
        </label>
        <button type="button" className="btn primary" onClick={save}>Save the Word file</button>
      </div>
      {msg && (
        <div className={"notice " + (msg.error ? "warn" : "ok")} style={{ marginTop: 14 }} role="status">
          <p>{msg.text}</p>
        </div>
      )}
    </>
  );
}
