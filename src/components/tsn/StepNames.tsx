"use client";
import { useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, segBlocks } from "./state";

function Context({ text, from }: { text: string; from: string }) {
  const re = new RegExp("(?<![" + C.LET + "])" + C.reEsc(from).replace(/\s+/g, "\\s+") + "(?![" + C.LET + "])");
  const m = re.exec(text);
  if (!m) return null;
  const a = Math.max(0, m.index - 34), z = Math.min(text.length, m.index + m[0].length + 34);
  return <>{a ? "…" : ""}{text.slice(a, m.index)}<b>{m[0]}</b>{text.slice(m.index + m[0].length, z)}{z < text.length ? "…" : ""}</>;
}

export function StepNames({ ctx }: { ctx: Ctx }) {
  const { S, update, saveSettings } = ctx;
  const [cFrom, setCFrom] = useState(""), [cTo, setCTo] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const segText = segBlocks(S).map((b) => b.text).join(" ");
  const checkedCount = S.sugg.filter((x) => x.on).length;

  const add = () => {
    const f = C.norm(cFrom), to = C.norm(cTo);
    if (!f || !to || f === to) return;
    update((s) => { s.custom = s.custom.filter((x) => x.from !== f); s.custom.push({ from: f, to, on: true }); });
    saveSettings(); setCFrom(""); setCTo("");
    setAddMsg(`Saved “${f}” → “${to}” for this case and future sessions.`);
  };

  return (
    <>
      <div className="pagehead">
        <div className="step-kicker">Step 3 of 5</div>
        <h1>Names</h1>
        <p className="lede">Scriptix often mishears Filipino names. Review these possible name fixes and tick the ones to correct. No other wording is touched.</p>
      </div>

      {S.sugg.length ? (
        <>
          <div className="names-bar">
            <span className="count">{checkedCount} of {S.sugg.length} suggested name fix{S.sugg.length > 1 ? "es" : ""} selected</span>
            <button type="button" className="btn small" onClick={() => update((s) => { s.sugg.forEach((x) => { x.on = x.score >= 0.8; }); })}>Tick high-confidence</button>
            <button type="button" className="btn small" onClick={() => update((s) => { s.sugg.forEach((x) => { x.on = true; }); })}>Tick all</button>
            <button type="button" className="btn small" onClick={() => update((s) => { s.sugg.forEach((x) => { x.on = false; }); })}>Untick all</button>
          </div>
          <div className="table-wrap">
            <table className="names">
              <thead><tr><th>Fix?</th><th>Heard as</th><th>Change to</th><th>Times</th><th>Where it appears</th></tr></thead>
              <tbody>
                {S.sugg.map((x, i) => (
                  <tr key={x.from} className={x.on ? "checked-row" : ""}>
                    <td>
                      <label className="chk-hit" title={"Replace " + x.from}>
                        <input type="checkbox" checked={x.on} aria-label={"Replace " + x.from} onChange={(e) => update((s) => { s.sugg[i].on = e.target.checked; })} />
                      </label>
                    </td>
                    <td className="heard">{x.from}</td>
                    <td><input type="text" value={x.to} aria-label="Replace with" onChange={(e) => update((s) => { s.sugg[i].to = e.target.value; })} /></td>
                    <td>{x.count}</td>
                    <td className="ctx"><Context text={segText} from={x.from} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <div className="empty">No likely misspellings of the case names were found in this part of the recording.</div>}

      <div className="sub">
        <h2>Your own replacements</h2>
        <p>Add fixes for names or phrases the table above cannot guess (for example, “Dr. Nialo” → “Atty. Alo”). Saved automatically on this computer for next time.</p>
      </div>
      {S.custom.length > 0 && (
        <div className="table-wrap">
          <table className="names">
            <thead><tr><th>Use?</th><th>Heard as</th><th>Change to</th><th>Times found</th><th></th></tr></thead>
            <tbody>
              {S.custom.map((x, i) => {
                const n = C.countMatches(segText, x.from);
                return (
                  <tr key={x.from} className={x.on ? "checked-row" : ""}>
                    <td>
                      <label className="chk-hit" title="Use this replacement">
                        <input type="checkbox" checked={x.on} aria-label="Use this replacement" onChange={(e) => update((s) => { s.custom[i].on = e.target.checked; })} />
                      </label>
                    </td>
                    <td className="heard">{x.from}</td>
                    <td className="heard">{x.to}</td>
                    <td>{n || <span className="muted">not in this case</span>}</td>
                    <td><button type="button" className="btn ghost small" onClick={() => { update((s) => { s.custom.splice(i, 1); }); saveSettings(); }}>Remove</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="addrow" style={{ marginTop: 0 }}>
          <label className="f" style={{ gridColumn: "auto" }}>
            <span>Heard as in Scriptix</span>
            <input type="text" placeholder="Heard as" aria-label="Heard as" value={cFrom} onChange={(e) => setCFrom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          </label>
          <label className="f" style={{ gridColumn: "auto" }}>
            <span>Change to</span>
            <input type="text" placeholder="Change to" aria-label="Change to" value={cTo} onChange={(e) => setCTo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" className="btn primary" onClick={add} disabled={!C.norm(cFrom) || !C.norm(cTo)}>Add replacement</button>
          </div>
        </div>
        {addMsg && <p className="fill-msg" style={{ marginTop: 12, display: "inline-block" }} role="status">{addMsg}</p>}
      </div>
    </>
  );
}
