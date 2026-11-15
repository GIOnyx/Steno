/*
 * Gregg outline geometry. A word is a list of tokens (see rules.ts); this file turns the
 * tokens into one SVG path. Units: a short stroke (k, n, t) is 1.0 long. Screen coordinates,
 * y grows downward, strokes are written left to right the way Gregg is written.
 *
 * Consonants keep the fixed slant Gregg gives them; vowels are circles and hooks placed at the
 * joining point, on the side the Gregg joining rules call for (inside a curve, outside the angle
 * between two straight strokes, clockwise on a lone straight stroke).
 */

export type Pt = { x: number; y: number };
type Seg = { d: string; end: Pt; bbox: [Pt, Pt] };

/* ---------- consonant stroke table ---------- */
// dir: unit direction of the chord (start -> end). curve: +1 bulge to the left of travel, -1 to the right, 0 straight.
// depth: bulge depth as a fraction of the chord length.
type StrokeDef = { len: number; angle: number; curve: number; depth?: number };
const DEG = Math.PI / 180;
const UP = -32 * DEG;          // t, d, th: upward, 32° above horizontal
const DOWN = 180 * DEG - 62 * DEG; // p, b, f, v, sh, ch, j: downward, slanting to the lower left
export const STROKES: Record<string, StrokeDef> = {
  K: { len: 1.0, angle: 0, curve: -1, depth: 0.26 },  // forward curve, bulges down
  G: { len: 1.9, angle: 0, curve: -1, depth: 0.2 },
  R: { len: 1.0, angle: 0, curve: +1, depth: 0.26 },  // forward curve, bulges up
  L: { len: 1.9, angle: 0, curve: +1, depth: 0.2 },
  N: { len: 1.0, angle: 0, curve: 0 },
  M: { len: 1.9, angle: 0, curve: 0 },
  MN: { len: 2.6, angle: 0, curve: 0 },               // men / mem blend: an extra-long m
  NG: { len: 1.0, angle: 14 * DEG, curve: 0 },        // n slanting down
  NK: { len: 1.9, angle: 14 * DEG, curve: 0 },
  T: { len: 1.0, angle: UP, curve: 0 },
  D: { len: 1.9, angle: UP, curve: 0 },
  TN: { len: 1.9, angle: -45 * DEG, curve: 0 },       // ten / den blend
  TM: { len: 2.7, angle: -45 * DEG, curve: 0 },       // tem / dem blend
  TD: { len: 2.8, angle: UP, curve: 0 },              // ted / ded / dit blend: a very long t
  NT: { len: 1.6, angle: UP, curve: +1, depth: 0.08 },// ent / end blend: a slightly curved long t
  MT: { len: 2.4, angle: UP, curve: +1, depth: 0.07 },
  TH: { len: 1.0, angle: UP, curve: +1, depth: 0.14 },// "ith"
  P: { len: 1.0, angle: DOWN, curve: -1, depth: 0.24 }, // bulges to the left: "("
  B: { len: 1.9, angle: DOWN, curve: -1, depth: 0.18 },
  F: { len: 1.0, angle: DOWN, curve: +1, depth: 0.24 }, // bulges to the right: ")"
  V: { len: 1.9, angle: DOWN, curve: +1, depth: 0.18 },
  DF: { len: 1.9, angle: DOWN, curve: +1, depth: 0.3 }, // def / dev / tive blend: a deeper, longer f
  SH: { len: 0.55, angle: DOWN, curve: 0 },
  CH: { len: 1.0, angle: DOWN, curve: 0 },
  J: { len: 1.6, angle: DOWN, curve: 0 },
  S: { len: 0.4, angle: DOWN, curve: +1, depth: 0.35 }, // right (comma) s
  SL: { len: 0.4, angle: DOWN, curve: -1, depth: 0.35 },// left s
  X: { len: 0.45, angle: DOWN + 12 * DEG, curve: +1, depth: 0.3 },
  Y: { len: 0.3, angle: 0, curve: +1, depth: 0.9 },     // small loop
};
export const SMALL_R = 0.24, LARGE_R = 0.42, HOOK_R = 0.26;

const unit = (a: number): Pt => ({ x: Math.cos(a), y: Math.sin(a) });
const add = (p: Pt, q: Pt, k = 1): Pt => ({ x: p.x + q.x * k, y: p.y + q.y * k });
const leftNormal = (d: Pt): Pt => ({ x: d.y, y: -d.x });   // left of travel in screen coords (y down)
const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

function strokeSeg(start: Pt, def: StrokeDef): Seg & { dirIn: Pt; dirOut: Pt; insideStart: Pt | null; insideEnd: Pt | null } {
  const d = unit(def.angle);
  const end = add(start, d, def.len);
  if (!def.curve) {
    return { d: `L${f(end.x)} ${f(end.y)}`, end, bbox: box([start, end]), dirIn: d, dirOut: d, insideStart: null, insideEnd: null };
  }
  const n = leftNormal(d);
  const bulge = add({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, n, def.curve * (def.depth || 0.2) * def.len);
  // quadratic control point so the curve passes through "bulge"
  const c = { x: 2 * bulge.x - (start.x + end.x) / 2, y: 2 * bulge.y - (start.y + end.y) / 2 };
  const dirIn = norm({ x: c.x - start.x, y: c.y - start.y });
  const dirOut = norm({ x: end.x - c.x, y: end.y - c.y });
  const inside = { x: n.x * def.curve, y: n.y * def.curve }; // toward the concave side
  return { d: `Q${f(c.x)} ${f(c.y)} ${f(end.x)} ${f(end.y)}`, end, bbox: box([start, end, bulge]), dirIn, dirOut, insideStart: inside, insideEnd: inside };
}
function norm(p: Pt): Pt { const l = Math.hypot(p.x, p.y) || 1; return { x: p.x / l, y: p.y / l }; }
function box(pts: Pt[]): [Pt, Pt] {
  return [{ x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) }, { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) }];
}

/* ---------- vowels ---------- */
// A circle written as a loop: the pen enters at P travelling along dirIn, goes round the circle on the side of
// unit normal n, and leaves at the point where it is already travelling along dirOut (a full circle when there is
// no following stroke, or when the two directions meet there anyway).
function circleSeg(P: Pt, r: number, n: Pt, dirIn: Pt, dirOut: Pt | null): Seg {
  const c = add(P, n, r);
  const a0 = Math.atan2(P.y - c.y, P.x - c.x);
  const t0 = { x: -Math.sin(a0), y: Math.cos(a0) };              // tangent for increasing angle (clockwise on screen)
  const s = t0.x * dirIn.x + t0.y * dirIn.y >= 0 ? 1 : -1;
  const sweepFlag = s > 0 ? 1 : 0;
  const TAU = Math.PI * 2;
  let a1 = a0;
  if (dirOut) a1 = Math.atan2(-s * dirOut.x, s * dirOut.y);
  let sweep = s > 0 ? (a1 - a0) % TAU : (a0 - a1) % TAU;
  if (sweep < 0) sweep += TAU;
  if (sweep < 0.6) sweep += TAU;                                  // always a real loop, never a slight bend
  const Q = { x: c.x + r * Math.cos(a1), y: c.y + r * Math.sin(a1) };
  let d: string;
  if (Math.abs(sweep - TAU) < 1e-6 || sweep > TAU - 1e-6) {
    const opp = add(c, n, r);
    d = `A${f(r)} ${f(r)} 0 0 ${sweepFlag} ${f(opp.x)} ${f(opp.y)}A${f(r)} ${f(r)} 0 0 ${sweepFlag} ${f(P.x)} ${f(P.y)}`;
    return { d, end: P, bbox: [{ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r }] };
  }
  const large = sweep > Math.PI ? 1 : 0;
  d = `A${f(r)} ${f(r)} 0 ${large} ${sweepFlag} ${f(Q.x)} ${f(Q.y)}`;
  return { d, end: Q, bbox: [{ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r }] };
}
// A flattened circle (the -ily ending): an ellipse tangent at P, long axis along the travel direction.
function ellipseSeg(P: Pt, rx: number, ry: number, n: Pt, travel: Pt): Seg {
  // full flattened loop, returning to P
  const c = add(P, n, ry);
  const rot = Math.atan2(travel.y, travel.x) * 180 / Math.PI;
  const cross = travel.x * n.y - travel.y * n.x;
  const sweep = cross > 0 ? 1 : 0;
  const opp = add(c, n, ry);
  const d = `A${f(rx)} ${f(ry)} ${f(rot)} 0 ${sweep} ${f(opp.x)} ${f(opp.y)}A${f(rx)} ${f(ry)} ${f(rot)} 0 ${sweep} ${f(P.x)} ${f(P.y)}`;
  const r = Math.max(rx, ry);
  return { d, end: P, bbox: [{ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r }] };
}
// A hook: an open arc. `open` is the unit direction the opening faces; `travel` decides which tip is entered first.
function hookSeg(P: Pt, r: number, open: Pt, travel: Pt): Seg {
  let t = leftNormal(open);
  if (t.x * travel.x + t.y * travel.y < 0) t = { x: -t.x, y: -t.y };
  const c = add(P, t, r);
  const exit = add(P, t, 2 * r);
  const bottom = add(c, open, -r);
  const sweep = (t.x * open.y - t.y * open.x) > 0 ? 1 : 0; // pass through "bottom", the closed side
  const d = `A${f(r)} ${f(r)} 0 0 ${sweep} ${f(bottom.x)} ${f(bottom.y)}A${f(r)} ${f(r)} 0 0 ${sweep} ${f(exit.x)} ${f(exit.y)}`;
  return { d, end: exit, bbox: [{ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y + r }] };
}

/* ---------- token model ---------- */
export type Token =
  | { k: "c"; s: string }                         // consonant stroke, key of STROKES
  | { k: "v"; v: "A" | "E" | "EF" | "I" | "O" | "U" | "OW" | "OI" | "YU" }   // EF = flattened e circle (-ily)
  | { k: "dis"; m: "s" | "e" }                     // disjoined mark after the word: left s (-ings) or small circle (-ingly)
  | { k: "dot" }                                   // -ing, and the h dot
  | { k: "dash" }                                  // -ings
  | { k: "h" };                                    // h: dot above the following vowel

const isCurveSide = (s: { insideStart: Pt | null }) => !!s.insideStart;
const HORIZ = new Set(["N", "M", "MN", "R", "L", "K", "G", "NG", "NK"]);

export type Outline = { d: string; w: number; h: number; minX: number; minY: number; dots: Pt[]; dashes: Pt[] };

export function outlineFor(tokens: Token[]): Outline {
  const parts: string[] = [];
  let pen: Pt = { x: 0, y: 0 };
  let bb: [Pt, Pt] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  const dots: Pt[] = [], dashes: Pt[] = [];
  const merge = (b: [Pt, Pt]) => { bb = [{ x: Math.min(bb[0].x, b[0].x), y: Math.min(bb[0].y, b[0].y) }, { x: Math.max(bb[1].x, b[1].x), y: Math.max(bb[1].y, b[1].y) }]; };
  parts.push(`M0 0`);
  let hPending = false;
  // previous consonant geometry (for vowel placement)
  let prev: ReturnType<typeof strokeSeg> | null = null;
  const nextCons = (i: number) => { for (let j = i + 1; j < tokens.length; j++) { const t = tokens[j]; if (t.k === "c") return t.s; if (t.k === "v") return null; } return null; };

  tokens.forEach((t, i) => {
    if (t.k === "h") { hPending = true; return; }
    if (t.k === "dot") { dots.push({ x: pen.x + 0.45, y: pen.y - 0.15 }); merge([{ x: pen.x + 0.3, y: pen.y - 0.3 }, { x: pen.x + 0.6, y: pen.y }]); return; }
    if (t.k === "dash") { dashes.push({ x: pen.x + 0.35, y: pen.y - 0.15 }); merge([{ x: pen.x + 0.3, y: pen.y - 0.3 }, { x: pen.x + 0.9, y: pen.y }]); return; }
    if (t.k === "dis") {
      // a detached mark a little to the right of where the word ended
      const p0 = { x: pen.x + 0.55, y: pen.y - 0.45 };
      if (t.m === "s") { const seg = strokeSeg(p0, STROKES.SL); parts.push(`M${f(p0.x)} ${f(p0.y)}` + seg.d); merge(seg.bbox); }
      else { const seg = circleSeg(p0, SMALL_R, { x: 0, y: 1 }, { x: 1, y: 0 }, null); parts.push(`M${f(p0.x)} ${f(p0.y)}` + seg.d); merge(seg.bbox); }
      parts.push(`M${f(pen.x)} ${f(pen.y)}`);
      return;
    }
    if (t.k === "c") {
      const def = STROKES[t.s];
      if (!def) return;
      const seg = strokeSeg(pen, def);
      // a straight stroke that continues in the exact direction of the previous one would merge into it; nudge with a tiny angle
      parts.push(seg.d);
      merge(seg.bbox);
      pen = seg.end; prev = seg;
      return;
    }
    // vowel
    const next = nextCons(i);
    const nextDef = next ? STROKES[next] : null;
    const nextSeg = nextDef ? strokeSeg(pen, nextDef) : null;
    const travel: Pt = prev ? prev.dirOut : nextSeg ? nextSeg.dirIn : { x: 1, y: 0 };
    // which side does the circle go?
    let side: Pt;
    if (prev && isCurveSide(prev)) side = prev.insideEnd!;
    else if (nextSeg && isCurveSide(nextSeg)) side = nextSeg.insideStart!;
    else if (prev && nextSeg) {
      const a = { x: -prev.dirOut.x, y: -prev.dirOut.y }, b = nextSeg.dirIn;
      const dot = a.x * b.x + a.y * b.y;
      if (dot > -0.97) { // an angle: outside it
        const bis = norm({ x: a.x + b.x, y: a.y + b.y });
        side = { x: -bis.x, y: -bis.y };
      } else { // same direction: clockwise
        side = { x: -travel.y, y: travel.x };
      }
    } else side = { x: -travel.y, y: travel.x }; // lone straight stroke: clockwise

    if (hPending) { const hp = add(pen, side, -0.55); dots.push(hp); hPending = false; }

    const v = t.v;
    const dirOut = nextSeg ? nextSeg.dirIn : null;
    const circle = (r: number) => { const s = circleSeg(pen, r, side, travel, dirOut); parts.push(s.d); merge(s.bbox); pen = s.end; };
    const hook = (open: Pt) => { const s = hookSeg(pen, HOOK_R, open, travel); parts.push(s.d); merge(s.bbox); pen = s.end; };
    const prevKey = prevKeyOf(tokens, i), nextKey = next;
    if (v === "A") circle(LARGE_R);
    else if (v === "E") circle(SMALL_R);
    else if (v === "EF") { const sg = ellipseSeg(pen, 0.34, 0.12, side, travel); parts.push(sg.d); merge(sg.bbox); }
    else if (v === "I") { circle(LARGE_R); const s2 = circleSeg(pen, SMALL_R * 0.75, side, dirOut || travel, null); parts.push(s2.d); merge(s2.bbox); }
    else if (v === "O") {
      // o hook opens upward; on its side (opening toward the next stroke) before n, m, r, l
      const open = nextKey && HORIZ.has(nextKey) && !(prevKey && HORIZ.has(prevKey)) ? { x: 1, y: 0 } : { x: 0, y: -1 };
      hook(open);
    } else if (v === "U") {
      // oo hook opens downward; on its side after n, m, k, g
      const open = prevKey && HORIZ.has(prevKey) ? { x: 1, y: 0 } : { x: 0, y: 1 };
      hook(open);
    } else if (v === "OW") { circle(LARGE_R); hook({ x: 0, y: 1 }); }
    else if (v === "OI") { hook({ x: 0, y: -1 }); circle(SMALL_R); }
    else if (v === "YU") { circle(SMALL_R); hook({ x: 0, y: 1 }); }
    prev = null; // the next consonant starts fresh from the pen
  });
  // dots for h at word start with no vowel after
  const w = bb[1].x - bb[0].x, h = bb[1].y - bb[0].y;
  return { d: parts.join(""), w: Math.max(w, 0.3), h: Math.max(h, 0.3), minX: bb[0].x, minY: bb[0].y, dots, dashes };
}
function prevKeyOf(tokens: Token[], i: number) { for (let j = i - 1; j >= 0; j--) { const t = tokens[j]; if (t.k === "c") return t.s; if (t.k === "v") return null; } return null; }

/* ---------- a tiny SVG for one outline, used in lists ---------- */
export function outlineSvg(o: Outline, scale = 12, cls = "outline"): string {
  const pad = 0.5;
  const W = (o.w + 2 * pad) * scale, H = (o.h + 2 * pad) * scale;
  const tx = pad * scale - 0, ty = (pad - o.minY) * scale;
  const dots = o.dots.map((p) => `<circle cx="${f(p.x * scale)}" cy="${f(p.y * scale)}" r="${f(scale * 0.07)}" fill="currentColor"/>`).join("");
  const dashes = o.dashes.map((p) => `<path d="M${f(p.x * scale)} ${f(p.y * scale)}h${f(scale * 0.45)}"/>`).join("");
  const minX = o.minX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${f(W)}" height="${f(H)}"><g class="${cls}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(${f(tx - minX * scale)} ${f(ty)}) scale(${scale})" stroke-width="${f(1.6 / scale)}"><path d="${o.d}"/>${dashes}</g><g transform="translate(${f(tx - minX * scale)} ${f(ty)})" fill="currentColor">${dots}</g></svg>`;
}
