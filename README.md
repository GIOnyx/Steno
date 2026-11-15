# Court Steno Tools

Two tools for a court stenographer, running entirely in the browser. No AI, no server-side processing: files never leave the computer.

- **TSN from Scriptix** – turns a Scriptix transcript of a hearing into a formatted Transcript of Stenographic Notes (.docx): case details, the part of the recording that belongs to the case, name corrections, speaker rows, Word export in the court's four-column layout.
- **Gregg shorthand** – turns an English document (.docx, .txt or pasted text) into Gregg outlines laid out on steno-pad lines, as a PDF. Centennial by default; Simplified and Anniversary brief-form tables are partial.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (what Vercel runs)
```

Deploy by importing the repository in Vercel; no environment variables are needed.

## How the Gregg outlines are made

1. Each word is looked up in a pronunciation dictionary (`public/dict/cmu.txt`, from CMUdict, ~125,000 words). Words that are not in it are spelled out: capitalised words that look like Filipino or Spanish names are read as spelled (Lomongo, Unabia, Carcar); other words use a plain English letter-to-sound guess.
2. The sounds become Gregg strokes by rule (`src/lib/gregg/rules.ts`): circles and hooks for vowels, the ten/den, tem/dem, men/mem, ent/end, def/dev blends, the -ing dot, the minor-vowel omission.
3. Brief forms come from a per-series table in the same file. A word in the table overrides the rules.
4. The strokes are drawn as one path (`src/lib/gregg/strokes.ts`) with Gregg's fixed slants and the circle-placement rules, then flowed onto ruled lines on screen and into the PDF (`pdf.ts`).

Outlines built this way follow the system's principles but will not always match the textbook form, especially for irregular words. In the app, a word's stroke code can be edited and the override is kept in the browser.

Stroke codes: `K G R L N M T D TH P B F V SH CH J S X NG NK Y`, blends `TN TM MN NT MT DF`, vowels `A E I O U OW OI YU`, `.` for the -ing dot, `-` for -ings, `h` for the h dot.

## Layout

- `src/app` – routes (`/tsn`, `/gregg`) and global styles
- `src/components/tsn` – the five-step TSN interface
- `src/lib/tsn` – the TSN engine (`core.js`) and the Word template built from the court's reference TSN
- `src/lib/gregg` – the shorthand engine
- `scripts` – browser tests (`e2e.py`, Playwright) and rendering checks
