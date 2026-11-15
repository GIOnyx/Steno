"use client";
import { useState } from "react";
import type { Ctx } from "./TsnApp";
import { C, segBlocks } from "./state";

const LET = "A-Za-zÀ-ɏ";
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Context({ text, from }: { text: string; from: string }) {
  const re = new RegExp("(?<![" + LET + "])" + reEsc(from).replace(/\s+/g, "\\s+") + "(?![" + LET + "])");
  const m = re.exec(text);
  if (!m) return null;
  const a = Math.max(0, m.index - 34), z = Math.min(text.length, m.index + m[0].length + 34);
  return <>{a ? "…" : ""}{text.slice(a, m.index)}<b>{m[0]}</b>{text.slice(m.index + m[0].length, z)}{z < text.length ? "…" : ""}</>;
}

export function StepNames({ ctx }: { ctx: Ctx }) {
  const { S, update, saveSettings } = ctx;
  const [cFrom, setCFrom] = useState(""), [cTo, setCTo] = useState("");
  const segText = segBlocks(S).map((b) => b.text).join(" ");

  const add = () => {
    const f = C.norm(cFrom), to = C.norm(cTo);
    if (!f || !to || f === to) return;
    update((s) => { s.custom = s.custom.filter((x) => x.from !== f); s.custom.push({ from: f, to, on: true }); });
    saveSettings(); setCFrom(""); setCTo("");
  };

  return (
    <>
      <div className="pagehead"><h1>Names</h1><p className="lede">Scriptix often mishears Filipino names. These words in the recording sound like names from the case. Tick the ones that should be corrected. Nothing else in the wording is changed.</p></div>
      {S.sugg.length ? (
        <table className="names">
          <thead><tr><th>Fix</th><th>Heard as</th><th>Change to</th><th>Times</th><th>Where</th></tr></thead>
          <tbody>
            {S.sugg.map((x, i) => (
              <tr key={x.from}>
                <td><input type="checkbox" checked={x.on} aria-label={"Replace " + x.from} onChange={(e) => update((s) => { s.sugg[i].on = e.target.checked; })} /></td>
                <td className="heard">{x.from}</td>
                <td><input type="text" value={x.to} aria-label="Replace with" onChange={(e) => update((s) => { s.sugg[i].to = e.target.value; })} /></td>
                <td>{x.count}</td>
                <td className="ctx"><Context text={segText} from={x.from} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="empty">No likely misspellings of the case names were found in this part of the recording.</div>}

      <div className="sub"><h2>Your own replacements</h2><p>For names the list above cannot guess, such as “Dr. Nialo” for “Atty. Alo”. These are saved on this computer and offered again next time.</p></div>
      {S.custom.length > 0 && (
        <table className="names">
          <thead><tr><th>Use</th><th>Heard as</th><th>Change to</th><th>Times</th><th></th></tr></thead>
          <tbody>
            {S.custom.map((x, i) => {
              const n = C.countMatches(segText, x.from);
              return (
                <tr key={x.from}>
                  <td><input type="checkbox" checked={x.on} aria-label="Use this replacement" onChange={(e) => update((s) => { s.custom[i].on = e.target.checked; })} /></td>
                  <td className="heard">{x.from}</td><td className="heard">{x.to}</td>
                  <td>{n || <span className="muted">not in this case</span>}</td>
                  <td><button type="button" className="btn ghost small" onClick={() => { update((s) => { s.custom.splice(i, 1); }); saveSettings(); }}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="addrow">
        <input type="text" placeholder="Heard as" aria-label="Heard as" value={cFrom} onChange={(e) => setCFrom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <input type="text" placeholder="Change to" aria-label="Change to" value={cTo} onChange={(e) => setCTo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button type="button" className="btn" onClick={add}>Add replacement</button>
      </div>
    </>
  );
}
