/**
 * dedupe-cornervalue.ts — supprime les doublons d'equipes dans les JSON Cornervalue.
 *
 * ## Pourquoi ces doublons existent
 *
 * `scripts/scrape_cornervalue.py` découpe la page avec une regex
 * (`(?=[A-Z][a-z]+... Average Corners FT)`) et aplatit TOUS les blocs trouvés
 * dans `teams[]`. La page repetait chaque equipe plusieurs fois → 942 lignes pour
 * 435 equipes.
 *
 * ## Ce que ce script ne peut pas faire
 *
 * Les occurrences ne sont pas toutes identiques : 72 groupes divergent sur
 * `avgCornersFor` / `avgCornersAgainst` / `avgCornersFT` (ex. Brugge 6.45 vs 5.08).
 * Chaque paire reste pourtant interne coherente (for + against = FT), ce qui
 * correspond a deux blocs de stats distincts ecrases sous le meme nom.
 *
 * Aucune entree ne porte de timestamp : « garder la plus recente » est
 * impossible. L'invariant physique (somme For ≈ somme Against sur une ligue) ne
 * departage pas non plus : sur 25 fichiers sur 29 les deux variantes presentent
 * la MEME erreur.
 *
 * On garde donc la premiere occurrence (ordre de la page) et on RAPPORTE les
 * equipes dont la valeur retenue est incertaine. Un nombre peutetre faux est
 * signale, pas presente comme certain.
 *
 * Usage :
 *   bun scripts/dedupe-cornervalue.ts          # applique
 *   bun scripts/dedupe-cornervalue.ts --dry    # rapport seul
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "public/data/metrics";
const DRY = process.argv.includes("--dry");

type CornerTeam = {
  teamName: string;
  avgCornersFT: number | null;
  avgCornersFor: number | null;
  avgCornersAgainst: number | null;
  hitRates: Record<string, unknown>;
};

type CornerFile = {
  meta: Record<string, unknown> & { teamCount?: number };
  teams: CornerTeam[];
};

const FIELDS = ["avgCornersFT", "avgCornersFor", "avgCornersAgainst"] as const;

const files = readdirSync(DIR)
  .filter((f) => /^cornervalue_.*\.json$/.test(f))
  .sort();

let linesBefore = 0;
let linesAfter = 0;
let bytesBefore = 0;
let bytesAfter = 0;
/** fichier -> equipes dont les occurrences divergeaient (valeur retenue incertaine). */
const conflicts: { file: string; team: string; kept: string; dropped: string[] }[] = [];
let changedFiles = 0;

for (const file of files) {
  const path = join(DIR, file);
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw) as CornerFile;

  const before = data.teams.length;
  linesBefore += before;
  bytesBefore += Buffer.byteLength(raw);
  if (before === 0) continue;

  // 1re occurrence gagne ; on note les ecarts pour le rapport.
  const kept: CornerTeam[] = [];
  const byName = new Map<string, CornerTeam[]>();
  for (const t of data.teams) {
    const list = byName.get(t.teamName);
    if (list) list.push(t);
    else byName.set(t.teamName, [t]);
  }

  for (const [name, entries] of byName) {
    kept.push(entries[0]);
    if (entries.length < 2) continue;
    const dropped: string[] = [];
    let differs = false;
    for (const other of entries.slice(1)) {
      for (const f of FIELDS) {
        if (entries[0][f] !== other[f]) {
          differs = true;
          break;
        }
      }
      dropped.push(
        FIELDS.map((f) => `${f}=${other[f]}`).join(" "),
      );
    }
    if (differs) {
      conflicts.push({
        file,
        team: name,
        kept: FIELDS.map((f) => `${f}=${entries[0][f]}`).join(" "),
        dropped,
      });
    }
  }

  data.teams = kept;
  if (data.meta && typeof data.meta.teamCount === "number") {
    data.meta.teamCount = kept.length;
  }

  const out = `${JSON.stringify(data, null, 2)}\n`;
  bytesAfter += Buffer.byteLength(out);
  linesAfter += kept.length;

  if (out !== raw) {
    changedFiles++;
    if (!DRY) writeFileSync(path, out, "utf8");
  } else {
    bytesAfter -= Buffer.byteLength(out);
    bytesAfter += Buffer.byteLength(raw);
  }
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round(((a - b) / a) * 1000) / 10);

console.log("=== DEDUPE CORNERVALUE ===");
console.log(`mode          : ${DRY ? "DRY RUN (aucune ecriture)" : "ECRITURE"}`);
console.log(`fichiers      : ${files.length}`);
console.log(`lignes        : ${linesBefore} -> ${linesAfter}  (-${pct(linesBefore, linesAfter)} %)`);
console.log(
  `taille        : ${(bytesBefore / 1024).toFixed(1)} Ko -> ${(bytesAfter / 1024).toFixed(1)} Ko` +
    `  (-${pct(bytesBefore, bytesAfter)} %)`,
);
console.log(`fichiers modifies : ${changedFiles}`);
console.log(`equipes a valeurs divergentes : ${conflicts.length}`);

if (conflicts.length > 0) {
  console.log("\n--- VALEURS INCERTAINES (occurrence conservee vs ecartees) ---");
  for (const c of conflicts) {
    console.log(`  ${c.file}  ${c.team}`);
    console.log(`      conserve : ${c.kept}`);
    for (const d of c.dropped) console.log(`      ecarte   : ${d}`);
  }
  console.log(
    "\nCes equipes avaient plusieurs blocs de stats differents pour le meme nom.\n" +
      "La valeur conservee est celle de premiere occurrence (ordre de la page) :\n" +
      "elle n'est PAS verifiee. A reviser si la source redevient accessible.",
  );
}

if (!DRY) {
  let actual = 0;
  for (const f of files) actual += statSync(join(DIR, f)).size;
  console.log(`\ntaille reelle sur disque : ${(actual / 1024).toFixed(1)} Ko`);
}