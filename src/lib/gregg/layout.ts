/* Flows rendered words onto ruled lines. Units are stroke units; the caller picks pixels or points per unit. */
import type { Para, Word } from "./engine";

export type Placed = { word: Word; x: number };          // x in units, left edge of the outline
export type Line = { items: Placed[]; gloss: string; paraStart: boolean };
export const GAP = 0.9;              // space between words, in units
export const PLAIN_CHAR = 0.55;      // width per character of plain text (numbers), in units

export function wordWidth(w: Word) { return w.outline ? w.outline.w : Math.max(0.6, w.text.length * PLAIN_CHAR); }

export function flow(paras: Para[], widthUnits: number): Line[] {
  const lines: Line[] = [];
  for (const p of paras) {
    let cur: Line = { items: [], gloss: "", paraStart: true };
    let x = 0;
    for (const w of p.words) {
      const ww = wordWidth(w);
      if (x > 0 && x + ww > widthUnits) { lines.push(cur); cur = { items: [], gloss: "", paraStart: false }; x = 0; }
      cur.items.push({ word: w, x });
      cur.gloss += (cur.gloss ? " " : "") + w.text;
      x += ww + GAP;
    }
    lines.push(cur);
  }
  return lines;
}
