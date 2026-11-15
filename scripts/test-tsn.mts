import assert from "node:assert/strict";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { DEFAULT_STAFF, fresh, speakerLabel } from "../src/components/tsn/state.ts";
import C from "../src/lib/tsn/core.ts";
import { FRAGMENTS, TEMPLATE_B64 } from "../src/lib/tsn/template.ts";

const b64ToBytes = (s: string) => {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};

// 1. DEFAULT_STAFF consistency
assert.ok(DEFAULT_STAFF.judgeCover.includes("PHILLINE ROSAMAE P. RELUYA-YU"));
assert.equal(DEFAULT_STAFF.judge, "PHILLINE ROSAMAE P. RELUYA-YU");

// 2. parseBlocks & docxParagraphs
const blocks = C.parseBlocks([
  "Speaker 1 [00:01:05] Good\u00A0morning,",
  "Your Honor.",
  "[01:10] Called for cross.",
  "[01:15]   ",
]);
assert.equal(blocks.length, 2);
assert.equal(blocks[0].t, 65);
assert.equal(blocks[0].ts, "00:01:05");
assert.equal(blocks[0].text, "Good morning, Your Honor.");
assert.equal(blocks[1].t, 70);
assert.equal(blocks[1].i, 1);

const sampleDocx = zipSync({
  "word/document.xml": strToU8(
    '<w:document><w:body><w:p><w:r><w:t>[00:00:10] &lt;Test&gt; &amp; &quot;ok&quot;</w:t></w:r></w:p></w:body></w:document>'
  ),
});
assert.deepEqual(C.docxParagraphs(sampleDocx), ['[00:00:10] <Test> & "ok"']);
assert.throws(() => C.docxParagraphs(new Uint8Array([1, 2, 3])), /Word document/);

// 3. parseSummary (Civil consolidated & Criminal counsel roles)
const civilSum = C.parseSummary(`
  Civil Case no/s. 958 and 964
  Case Title: Crisanto Unabia, et al. -versus- Sps. Guillermo Ata (vice versa)
  FOR: Recovery of Possession
  Plaintiff's Counsel: Atty. Nathaniel Clarus / Atty. Joselito M. Alo
  Defendant's Counsel: Atty. Joselito M. Alo / Atty. Nathaniel Clarus
  Status: Defendants' 4th witness cross-examination (Jessica Lomongo) Atty. Alo
`);
assert.equal(civilSum.caseType, "Civil");
assert.equal(civilSum.viceVersa, true);
assert.equal(civilSum.witness, "Jessica Lomongo");
assert.equal(civilSum.exam, "cross");
assert.ok(civilSum.counsel?.[0].roles.includes("Plaintiff’s Counsel (Civil Case No. 958)"));
assert.ok(civilSum.counsel?.[0].roles.includes("Defendant’s Counsel (Civil Case No. 964)"));

const crimSum = C.parseSummary(`
  Criminal Case nos. 101 and 102
  Case Title: People of the Philippines vs. Juan Dela Cruz
  FOR: Estafa
  Prosecution Counsel: Pros. Maria Santos
  Defense Counsel: Atty. Pedro Reyes / Atty. Ana Cruz
  Status: Direct examination (PO1 Garcia)
`);
assert.equal(crimSum.caseType, "Criminal");
assert.deepEqual(crimSum.counsel, [
  { name: "Pros. Maria Santos", roles: "Prosecution Counsel" },
  { name: "Atty. Pedro Reyes", roles: "Defense Counsel (Criminal Case No. 101)" },
  { name: "Atty. Ana Cruz", roles: "Defense Counsel (Criminal Case No. 102)" },
]);

// 4. Name suggestions: Mary allowed, predominantly capitalized name preserved, ordinary lower word skipped
const vocab = C.nameVocab(["Mary Grace Lomongo", "Atty. Joselito M. Alo"]);
const fullText = [
  "Mary",
  "Grace",
  "Grace",
  "Grace",
  "grace",
  "order",
  "order",
  "Order",
  "Meri",
  "Grays",
  "Lumomo",
  "Allo",
].join(" ");
const stats = C.wordCaseStats(fullText);
const sugg = C.suggestNames("Meri Grays Lumomo Allo Order", vocab, stats);
assert.ok(sugg.some((s) => s.from === "Meri" && s.to === "Mary"));
assert.ok(sugg.some((s) => s.from === "Grays" && s.to === "Grace"));
assert.ok(sugg.some((s) => s.from === "Lumomo" && s.to === "Lomongo"));
assert.ok(sugg.some((s) => s.from === "Allo" && s.to === "Alo"));
assert.ok(!sugg.some((s) => s.from === "Order"));

// 5. applyReplacements: single-pass without cascading overwrites + metacharacter safety
const repOut = C.applyReplacements("Alo met Atty. Alo and Jr. and Dr. (X).", [
  { from: "Alo", to: "Atty. Alo" },
  { from: "Atty. Alo", to: "Atty. Joselito Alo" },
  { from: "Jr.", to: "Sr." },
  { from: "Dr. (X)", to: "Dr. Cruz" },
]);
assert.equal(repOut, "Atty. Alo met Atty. Joselito Alo and Sr. and Dr. Cruz.");
assert.equal(C.countMatches("Dr. (X) met Dr. (X)", "Dr. (X)"), 2);

// 6. splitSentences & sentencesOf
const sents = C.splitSentences(
  "Atty. Joselito M. Alo arrived at 9:00 a.m. The witness testified re Civil Case No. 964, lots, etc. The Court noted it. Did you sign? yes, I did."
);
assert.deepEqual(sents, [
  "Atty. Joselito M. Alo arrived at 9:00 a.m. The witness testified re Civil Case No. 964, lots, etc. The Court noted it.",
  "Did you sign? yes, I did.",
]);

// 7. findOrderStart handles trailing chatter blocks within 2m while ignoring mid-testimony time mentions
const recWithOrderTail = [
  { t: 10, text: "I woke up at 7 o'clock in the morning." },
  ...Array.from({ length: 12 }, (_, k) => ({ t: 20 + k * 20, text: `Question ${k}?` })),
  { t: 300, text: "Court: Counsel manifested that witness stand is ready." },
  { t: 320, text: "So ordered. Notify in open court." },
  { t: 330, text: "Thank you Your Honor." },
  { t: 335, text: "Okay." },
  { t: 340, text: "Off the record." },
  { t: 345, text: "Thank you." },
];
const orderRange = C.findOrderStart(recWithOrderTail);
assert.equal(orderRange.start, 13);
assert.equal(orderRange.end, 14);

// 8. autoUnits, groupRows, tableRows (CONT.), and verbatim guard
const units = C.autoUnits(
  [
    { text: "You may proceed.", t: 1 },
    { text: "Did you see him?", t: 2 },
    { text: "Yes, I saw him.", t: 3 },
    { text: "Objection, leading question.", t: 4 },
    { text: "Overruled.", t: 5 },
    { text: "Where were you?", t: 6 },
  ],
  { examiner: "C0", other: "C1" }
);
const rows = C.groupRows(units);
const printed = C.tableRows(rows, (id) => (id === "C0" ? "ATTY. CLARUS" : id === "C1" ? "ATTY. ALO" : id), { cont: true });
assert.ok(printed.some((r) => r.label === "Q1:" && r.text === "Did you see him?"));
assert.ok(printed.some((r) => r.label === "A1:" && r.text === "Yes, I saw him."));
assert.equal(
  C.verbatim(rows, "You may proceed. Did you see him? Yes, I saw him. Objection, leading question. Overruled. Where were you?"),
  true
);
assert.equal(C.verbatim(rows, "Altered text"), false);

// 9. buildDocx produces valid XML with stripped control chars & zero unresolved @@ tokens
const st = fresh();
st.case.caseNo = "958 & 964";
st.case.plaintiffs = "Crisanto\x00 Unabia <Test>";
st.case.defendants = "Sps. Ata";
st.case.nature = "Quieting of Title";
st.case.date = "2026-10-13";
st.case.time = "09:30";
st.case.witness = "Jessica M. Lomongo";
st.case.witnessDesc = "Cross-examination";
st.counsel = [
  { name: "Atty. Nathaniel Clarus", roles: "Plaintiff’s Counsel", label: "" },
  { name: "Atty. Joselito M. Alo", roles: "Defendant’s Counsel", label: "" },
];
const docRows = [
  { kind: "head", speaker: "C0", text: "", t: null, first: 0, n: 1, exam: "cross" },
  { kind: "q", speaker: "", text: "Is that\u0007 true & \"accurate\"?", t: 10, first: 1, n: 1 },
  { kind: "a", speaker: "", text: "Yes, ma'am.", t: 12, first: 2, n: 1 },
  { kind: "order", speaker: "", text: "So ordered.", t: 20, first: 3, n: 1 },
];
const outDocx = C.buildDocx(b64ToBytes(TEMPLATE_B64), FRAGMENTS, {
  case: st.case,
  staff: st.staff,
  counsel: st.counsel,
  rows: docRows,
  cont: true,
  speakerLabel: (id) => speakerLabel(st, id),
});
const outFiles = unzipSync(outDocx);
const docXml = strFromU8(outFiles["word/document.xml"]);
const hdrXml = strFromU8(outFiles["word/header2.xml"]);
assert.equal(/@@[A-Z_]+@@/.test(docXml), false, "unresolved token in word/document.xml");
assert.equal(/@@[A-Z_]+@@/.test(hdrXml), false, "unresolved token in word/header2.xml");
assert.equal(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(docXml), false, "XML control chars leaked into document.xml");
assert.ok(docXml.includes("PHILLINE ROSAMAE P. RELUYA-YU"));
assert.ok(docXml.includes("CRISANTO UNABIA &lt;TEST&gt;,"));
assert.ok(docXml.includes("Yes, ma’am."));
assert.ok(hdrXml.includes("958 &amp; 964"));

console.log("PASS: TSN core, parsing, name matching, replacements, order detection, and DOCX generation verified.");
