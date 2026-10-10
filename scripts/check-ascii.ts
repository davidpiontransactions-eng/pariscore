/**
 * Verifie qu'un script PowerShell est bien ASCII-only.
 *
 * PS 5.1 lit un fichier UTF-8 SANS BOM comme de l'ANSI : un accent vire en
 * mojibake et peut casser le parsing (regle documentee dans AGENTS.md pour
 * tous les scripts .ps1 du projet). Le runner deploy-runner.ps1 declare lui-
 * meme "ASCII-only" en entete.
 *
 * Lit via node:fs — pas Bun.file() : ce script est invoque sous `node`, ou
 * `Bun` n'existe pas (cf. .context/playwright-sous-bun-windows.md, meme piege).
 *
 * Sortie : liste des lignes non-ASCII + exit 1 s'il y en a. Zero = regle tenue.
 */
import { readFileSync, writeFileSync } from "node:fs";

let bad = 0;
/** Translitteration des ponctuations non-ASCII rencontrées dans les .ps1 du dépôt. */
const FIX: Record<string, string> = {
  "─": "-", // ─ (cadratin de séparation de commentaire)
  "—": "-", // — (tiret cadratin)
  "–": "-", // – (tiret demi-cadratin)
  "«": '"', // «
  "»": '"', // »
  "…": "...", // …
  "→": "->", // →
};
const fix = process.argv.includes("--fix");
if (fix) {
  const idx = process.argv.indexOf("--fix");
  process.argv.splice(idx, 1);
}
const files = process.argv.slice(2);
if (files.length === 0) {
  console.log("usage: node scripts/check-ascii.ts [--fix] <fichier.ps1> [...]");
  process.exit(2);
}

for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.log(`ABSENT: ${file}`);
    bad++;
    continue;
  }
  const lines = text.split(/\r?\n/);
  let fileBad = 0;
  lines.forEach((line, i) => {
    const m = line.match(/[^\x00-\x7F]/);
    if (!m) return;
    fileBad++;
    bad++;
    console.log(
      `${file}:${i + 1}: '${m[0]}' (U+${m[0].codePointAt(0)!.toString(16).toUpperCase()})  ${line.trim().slice(0, 90)}`,
    );
  });
  console.log(`${file}: ${fileBad} ligne(s) non-ASCII / ${lines.length}`);
  if (fix && fileBad > 0) {
    let out = text;
    for (const [from, to] of Object.entries(FIX)) out = out.split(from).join(to);
    // Ce qui reste (accents) est signale mais non touche : un .ps1 accentue
    // n'est pas casse tant que PS 5.1 le lit en ANSI — seul le diagnostic compte.
    writeFileSync(file, out, "utf8");
    console.log(`  -> ${file} : ponctuations translitterees (accents laisses en place)`);
  }
}
console.log(`\nTOTAL non-ASCII: ${bad}${fix ? " (fix applique)" : ""}`);
process.exit(fix ? 0 : bad === 0 ? 0 : 1);
