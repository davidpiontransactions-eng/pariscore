// Test de config PM2 : entries du fichier ecosystem.config.js.
// Garde-fou « additif pur » (boucle LNH-SCRAP) : le fichier est édité à la
// main par plusieurs agents — on verrouille (1) l'absence de doublon de nom,
// (2) la présence exacte d'une entry, (3) la présence des entries voisines
// risquées par un remplacement fuzzy.
// Convention obligatoire : import depuis "bun:test".

import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const raw = readFileSync(join(process.cwd(), "ecosystem.config.js"), "utf8");

/** Tous les `name: '…'` déclarés (hors commentaire d'en-tête, qui n'en a pas). */
const appNames = [...raw.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);

/** Bloc complet d'une app (de son name jusqu'au `},` qui la ferme). */
function appBlock(name: string): string {
  const start = raw.indexOf(`name: '${name}'`);
  if (start < 0) return "";
  const end = raw.indexOf("\n    },", start);
  return end < 0 ? "" : raw.slice(start, end);
}

describe("ecosystem.config.js — intégrité des entries", () => {
  test("aucun doublon de nom d'app", () => {
    const dupes = appNames.filter((n, i) => appNames.indexOf(n) !== i);
    expect(dupes).toEqual([]);
    expect(appNames.length).toBeGreaterThanOrEqual(20);
  });

  test("entries handball voisines intactes (régression d'édition)", () => {
    for (const name of [
      "pariscore-cron-hbl-players",
      "pariscore-cron-flashscore-handball",
      "pariscore-cron-handball-nightly",
      "pariscore-cron-odds-papi",
      "pariscore-next",
    ]) {
      expect(appNames).toContain(name);
    }
  });

  test("entry LNH présente, unique et cron-only", () => {
    expect(appNames.filter((n) => n === "pariscore-cron-lnh")).toHaveLength(1);
    const block = appBlock("pariscore-cron-lnh");
    expect(block).toContain("script: 'scripts/scrape-lnh.js'");
    expect(block).toContain("cron_restart: '30 21 * * *'");
    expect(block).toContain("autorestart: false");
    expect(block).toContain("exec_mode: 'fork'");
  });

  test("créneau LNH (21:30) distinct des autres crons de soirée", () => {
    // handball-nightly tourne à 21:00 et 22:00 UTC — le tick 21:30 doit rester libre.
    const evening = [...raw.matchAll(/cron_restart:\s*'([^']+)'/g)]
      .map((m) => m[1])
      .filter((c) => /^30 21 /.test(c));
    expect(evening).toEqual(["30 21 * * *"]);
  });
});
