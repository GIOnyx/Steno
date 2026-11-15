# Court Steno Tools

Two tools for a court stenographer, running entirely in the browser. No files are uploaded; there is no database and no AI.

- **TSN from Scriptix** — turns a Scriptix transcript (.docx) of a hearing into a formatted Transcript of Stenographic Notes (.docx): case cover page, running header, four-column Q/A table, the court's order and the certification. Names misheard by Scriptix are corrected from the case details; the wording is otherwise kept word for word.
- **Gregg shorthand** — turns an English document (.docx, .txt or pasted text) into Gregg outlines laid out on steno-pad lines, as a PDF. Outlines are shaped with the Grascii font, drawing from Centennial brief forms first, then the 1930 Anniversary dictionary (with Centennial `O-R`/`O-L` boundaries), and finally rule-based outlines from each word's sounds (CMU pronunciation dictionary, with a Filipino/Spanish spelling fallback for names). Centennial is the default; Simplified and Anniversary brief-form tables are partial.

## Run locally

```
npm install --ignore-scripts
npm run dev
```

Open http://localhost:3000.

To run the checks:

```
npm test
npm run lint
npm run build
```

After updating `harfbuzzjs`, refresh the browser WASM/JS assets with `npm run sync:assets`.

## Deploy

Import the repository in Vercel; the defaults for a Next.js project work as they are. Nothing needs an environment variable.

## Layout

```
src/app                    routes: /tsn and /gregg
src/components/tsn         the five-step TSN tool
src/components/gregg       the Gregg tool
src/lib/tsn/core.js        TSN processing (parsing Scriptix, name matching, speaker guess, .docx builder)
src/lib/tsn/template.ts    the Word template (generated from a reference TSN; do not edit by hand)
src/lib/gregg/             rules.ts (sounds -> strokes, brief forms), grascii.ts (HarfBuzz shaping & 1930 dict), strokes.ts (SVG & fallback geometry), pdf.ts, layout.ts, engine.ts
public/dict/cmu.txt        compact pronunciation dictionary, loaded by the Gregg tab on first use
public/dict/gregg1930.txt  1930 Anniversary Grascii outlines
public/fonts/              Grascii OpenType/WOFF2 fonts
public/hb/                 HarfBuzz WASM shaper served statically
scripts/                   test.mts, build-dict.mjs, sync-assets.mjs, compare.mts
```

## Credits and Licences

- **Grascii font** (`public/fonts/Grascii-Regular.*`): SIL Open Font License 1.1 (`public/fonts/OFL.txt`), from [grascii/font](https://github.com/grascii/font).
- **Grascii 1930 Anniversary dictionary** (`public/dict/gregg1930.txt`): MIT License (`public/dict/gregg1930.LICENSE.txt`), from [grascii/dictionaries](https://github.com/grascii/dictionaries).
- **HarfBuzz / harfbuzzjs** (`public/hb/`): MIT License (`public/hb/LICENSE`), from [harfbuzz/harfbuzzjs](https://github.com/harfbuzz/harfbuzzjs).
