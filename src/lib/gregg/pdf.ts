/* Steno-pad PDF: ruled lines, a centre rule, outlines flowed down the left column then the right. */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Para } from "./engine";
import { flow, type Line } from "./layout";

export type PdfOptions = {
  pageSize: "steno" | "letter" | "a4";
  gloss: boolean;            // print the English under each line
  colour?: boolean;          // colour outlines by how they were made (brief form, spelled out)
  title?: string;
  series: string;
  unit?: number;             // points per stroke unit
  lineGap?: number;          // points between ruled lines
};

const SIZES = { steno: [432, 648], letter: [612, 792], a4: [595.28, 841.89] } as const;

export async function buildPdf(paras: Para[], opt: PdfOptions): Promise<Uint8Array> {
  const [W, H] = SIZES[opt.pageSize];
  const unit = opt.unit || 8.5;
  const lineGap = opt.lineGap || (opt.gloss ? 33 : 29);
  const margin = { top: 46, bottom: 36, side: 28 };
  const twoCols = true;
  const colGap = 14;
  const colW = twoCols ? (W - 2 * margin.side - colGap) / 2 : W - 2 * margin.side;
  const widthUnits = (colW - 10) / unit;
  const lines = flow(paras, widthUnits);

  const pdf = await PDFDocument.create();
  pdf.setTitle(opt.title || "Gregg shorthand");
  pdf.setProducer("Court Steno Tools");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.1, 0.13, 0.2), rule = rgb(0.72, 0.8, 0.9), red = rgb(0.86, 0.5, 0.5), grey = rgb(0.5, 0.55, 0.62);
  const perCol = Math.floor((H - margin.top - margin.bottom) / lineGap);

  let page = pdf.addPage([W, H]);
  let pageNo = 1;
  const drawRules = () => {
    for (let i = 0; i <= perCol; i++) {
      const y = H - margin.top - i * lineGap;
      page.drawLine({ start: { x: margin.side, y }, end: { x: W - margin.side, y }, thickness: 0.5, color: rule });
    }
    if (twoCols) page.drawLine({ start: { x: W / 2, y: H - margin.top + 8 }, end: { x: W / 2, y: margin.bottom - 4 }, thickness: 0.8, color: red });
    const head = (opt.title ? opt.title + "  ·  " : "") + "Gregg " + opt.series;
    page.drawText(head, { x: margin.side, y: H - 28, size: 8, font, color: grey });
    page.drawText(String(pageNo), { x: W - margin.side - 12, y: H - 28, size: 8, font, color: grey });
  };
  drawRules();

  let col = 0, row = 0;
  const next = () => {
    row++;
    if (row >= perCol) {
      row = 0; col++;
      if (col >= (twoCols ? 2 : 1)) { col = 0; page = pdf.addPage([W, H]); pageNo++; drawRules(); }
    }
  };
  const drawLine = (ln: Line) => {
    const x0 = margin.side + 5 + col * (colW + colGap);
    const baseY = H - margin.top - (row + 1) * lineGap + (opt.gloss ? 9 : 4); // outlines sit a little above the rule
    for (const it of ln.items) {
      const w = it.word, x = x0 + it.x * unit;
      if (!w.outline) {
        page.drawText(w.text, { x, y: baseY, size: 8, font, color: ink });
        continue;
      }
      const o = w.outline;
      const color = !opt.colour ? ink : w.source === "brief" || w.source === "custom" ? rgb(0.09, 0.19, 0.56) : w.source === "guess" || w.source === "filipino" ? rgb(0.45, 0.3, 0.05) : ink;
      // drawSvgPath takes the path's own coordinates with y down, anchored at (x, y) = SVG origin
      const top = baseY + (o.minY + o.h) * unit; // rest the outline on the writing line
      page.drawSvgPath(o.d, { x: x - o.minX * unit, y: top, scale: unit, borderColor: color, borderWidth: 0.95 / unit, borderLineCap: 1 as never });
      for (const d of o.dots) page.drawCircle({ x: x + (d.x - o.minX) * unit, y: top - d.y * unit, size: 0.55, color });
      for (const d of o.dashes) page.drawLine({ start: { x: x + (d.x - o.minX) * unit, y: top - d.y * unit }, end: { x: x + (d.x - o.minX + 0.45) * unit, y: top - d.y * unit }, thickness: 0.9, color });
    }
    if (opt.gloss && ln.gloss) {
      let g = ln.gloss; const max = colW - 10;
      while (g.length > 2 && font.widthOfTextAtSize(g, 5.5) > max) g = g.slice(0, -2);
      if (g !== ln.gloss) g = g.replace(/\s+\S*$/, "") + "…";
      page.drawText(g, { x: x0, y: baseY - 7, size: 5.5, font, color: grey });
    }
  };
  lines.forEach((ln) => { drawLine(ln); next(); });
  return pdf.save();
}
