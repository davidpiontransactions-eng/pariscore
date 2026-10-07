// Test de l'import Excel xlsx-import (mission 2026-10-07).
// 1) Fixture .xlsx minimale construite à la main (zip STORED + CRC32) → mapping,
//    sans-perte des colonnes, dates sérielles, lignes ignorées, round-trip CSV.
// 2) Si le vrai calc.xlsx de GenOffice existe → parse dessus sans perte.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { xlsxToBetCsv, normalizeHeader } from "../src/lib/bet-manager/xlsx-import";
import { parseBetsCSV } from "../src/lib/bet-manager/calculators";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, extra?: unknown) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label} →`, extra);
  }
};

// ─── Fixture XLSX (zip STORED minimal : Content_Types + rels + workbook + sheet) ───
function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function buildXlsx(entries: { name: string; content: string }[]): ArrayBuffer {
  const enc = new TextEncoder();
  const parts = entries.map((e) => ({ name: enc.encode(e.name), data: enc.encode(e.content) }));
  const sizes = parts.map((p) => 30 + p.name.length + p.data.length);
  const cdSizes = parts.map((p) => 46 + p.name.length);
  const cdOffset = sizes.reduce((a, b) => a + b, 0);
  const total = cdOffset + cdSizes.reduce((a, b) => a + b, 0) + 22;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const localOffsets: number[] = [];
  let off = 0;
  parts.forEach((p, i) => {
    const crc = crc32(p.data);
    localOffsets.push(off);
    dv.setUint32(off, 0x04034b50, true);
    dv.setUint16(off + 4, 20, true);
    dv.setUint32(off + 14, crc, true);
    dv.setUint32(off + 18, p.data.length, true);
    dv.setUint32(off + 22, p.data.length, true);
    dv.setUint16(off + 26, p.name.length, true);
    u8.set(p.name, off + 30);
    u8.set(p.data, off + 30 + p.name.length);
    off += sizes[i];
  });
  let cd = off;
  parts.forEach((p, i) => {
    const crc = crc32(p.data);
    dv.setUint32(cd, 0x02014b50, true);
    dv.setUint16(cd + 4, 20, true);
    dv.setUint16(cd + 6, 20, true);
    dv.setUint32(cd + 16, crc, true);
    dv.setUint32(cd + 20, p.data.length, true);
    dv.setUint32(cd + 24, p.data.length, true);
    dv.setUint16(cd + 28, p.name.length, true);
    dv.setUint32(cd + 42, localOffsets[i], true); // offset du header local de CETTE entrée
    u8.set(p.name, cd + 46);
    cd += cdSizes[i];
  });
  dv.setUint32(cd, 0x06054b50, true);
  dv.setUint16(cd + 8, parts.length, true);
  dv.setUint16(cd + 10, parts.length, true);
  dv.setUint32(cd + 12, cdSizes.reduce((a, b) => a + b, 0), true);
  dv.setUint32(cd + 16, cdOffset, true);
  return buf;
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const cellStr = (ref: string, v: string) => `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
const cellNum = (ref: string, v: number) => `<c r="${ref}"><v>${v}</v></c>`;

const sheet = `<?xml version="1.0"?><worksheet ${NS}><sheetData>
<row r="1">${cellStr("A1", "date")}${cellStr("B1", "sport")}${cellStr("C1", "match")}${cellStr("D1", "cote")}${cellStr("E1", "mise")}${cellStr("F1", "résultat")}${cellStr("G1", "objectif")}${cellStr("H1", "note libre")}</row>
<row r="2">${cellStr("A2", "2026-02-10")}${cellStr("B2", "tennis")}${cellStr("C2", "Alcaraz vs Sinner")}${cellNum("D2", 1.85)}${cellNum("E2", 10)}${cellStr("F2", "gagné")}${cellNum("G2", 40)}${cellStr("H2", "classique")}</row>
<row r="3">${cellNum("A3", 46064)}${cellStr("B3", "football")}${cellStr("C3", "PSG vs OM")}${cellNum("D3", 2.1)}${cellNum("E3", 5)}${cellStr("F3", "perdu")}${cellNum("G3", 45)}${cellStr("H3", "avec, virgule")}</row>
<row r="4">${cellStr("A4", "2026-02-12")}${cellStr("B4", "garbage sans cote ni mise")}</row>
</sheetData></worksheet>`;

const xlsxBuf = buildXlsx([
  {
    name: "[Content_Types].xml",
    content: `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  },
  {
    name: "_rels/.rels",
    content: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  },
  {
    name: "xl/workbook.xml",
    content: `<?xml version="1.0"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Paris" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  },
  {
    name: "xl/_rels/workbook.xml.rels",
    content: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  },
  { name: "xl/worksheets/sheet1.xml", content: sheet },
]);

// ─── 1) Fixture ───
const res = await xlsxToBetCsv(xlsxBuf);
check("fixture : feuille Paris choisie", res.sheetName === "Paris", res.sheetName);
check("fixture : 8 colonnes lues (sans perte)", res.headers.length === 8, res.headers);
check("fixture : mapping date→placedAt", res.mapping["date"] === "placedAt", res.mapping);
check("fixture : mapping cote→odds", res.mapping["cote"] === "odds");
check("fixture : mapping mise→stake", res.mapping["mise"] === "stake");
check("fixture : mapping résultat→status", res.mapping["résultat"] === "status");
check("fixture : objectif conservé en note", res.mapping["objectif"] === "note (objectif)");
check("fixture : colonne libre conservée en note", res.mapping["note libre"] === "note (conservée)");
check("fixture : 2 lignes gardées, 1 ignorée (sans cote/mise)", res.rowCount === 2 && res.droppedRows === 1, {
  kept: res.rowCount,
  dropped: res.droppedRows,
});

const bets = parseBetsCSV(res.csv);
check("round-trip CSV : 2 paris", bets.length === 2, bets.length);
check("pari 1 : date/odds/mise/statut", bets[0]?.placedAt === "2026-02-10" && bets[0]?.odds === 1.85 && bets[0]?.stake === 10 && bets[0]?.status === "won", bets[0]);
check("pari 1 : match + pick conservés", bets[0]?.matchLabel === "Alcaraz vs Sinner" && bets[0]?.sport === "tennis", bets[0]);
check("pari 2 : sérial Excel 46064 → 2026-02-11", bets[1]?.placedAt === "2026-02-11", bets[1]?.placedAt);
check("pari 2 : statut FR « perdu » → lost", bets[1]?.status === "lost", bets[1]?.status);
check(
  "pari 2 : note sans perte (objectif + virgule isolée)",
  (bets[1]?.note ?? "").includes("objectif=45") && (bets[1]?.note ?? "").includes("note libre=avec · virgule"),
  bets[1]?.note
);

// normalizeHeader
check("normalizeHeader : accents/casse/majuscules", normalizeHeader("  Cote Moyenne ") === "cote moyenne");

// ─── 2) Vrai calc.xlsx (GenOffice) si présent ───
const CALC = "C:/Users/David/Documents/GenOffice/calc.xlsx";
if (existsSync(CALC)) {
  // Vrai fichier GenOffice : Feuille2 porte la formule de mise SANS valeur
  // cache (=E2/(1-D2) sans <v>) → la formule doit être tracée dans la note.
  const real = await xlsxToBetCsv(readFileSync(CALC).buffer);
  console.log(`  calc.xlsx : feuille « ${real.sheetName} », ${real.headers.length} colonnes, ${real.rowCount} ligne(s), ${real.droppedRows} ignorée(s)`);
  console.log(`  mapping : ${JSON.stringify(real.mapping)}`);
  check("calc.xlsx : feuille exploitable trouvée (Feuille2 : cote moyenne)", real.rowCount >= 1, real.rowCount);
  check("calc.xlsx : toutes les colonnes de la feuille lues", real.headers.length >= 4, real.headers.length);
  const realBets = parseBetsCSV(real.csv);
  check("calc.xlsx : paris parsés avec cote > 1", realBets.length >= 1 && realBets.every((b) => (b.odds ?? 0) > 1), realBets.map((b) => b.odds));
  check("calc.xlsx : mise ≥ 0 (jamais de mise négative importée)", realBets.every((b) => (b.stake ?? 0) >= 0), realBets.map((b) => b.stake));
  check(
    "calc.xlsx : formule de mise non évaluée conservée dans note (sans-perte)",
    (realBets[0]?.note ?? "").includes("=E2/(1-D2)"),
    realBets[0]?.note
  );
  check(
    "calc.xlsx : objectif du jour reporté en note",
    (realBets[0]?.note ?? "").includes("A faire par jour="),
    realBets[0]?.note
  );
} else {
  console.log("  [skip] calc.xlsx absent de cette machine — test réel ignoré");
}

console.log(`\n${pass} ok / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
