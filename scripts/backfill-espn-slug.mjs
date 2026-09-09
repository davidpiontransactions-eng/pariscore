// Backfill League.espnSlug (T3 SESSION-2026-09-09-CAL-FILTRES-H).
// Deux clés possibles : bzzoiroId (vrai id BSD) OU id slug interne (BSD_LEAGUE_IDS).
// Usage : bun scripts/backfill-espn-slug.mjs [--dry-run]
import { PrismaClient } from "@prisma/client";

const BSD_TO_ESPN_SLUG = {
  6: "fra.1", 89: "fra.2",
  1: "eng.1", 12: "eng.2", 39: "eng.fa", 40: "eng.league_cup",
  86: "eng.3", 87: "eng.4",
  3: "esp.1", 38: "esp.2",
  5: "ger.1", 4: "ita.1", 2: "por.1", 88: "por.1",
  10: "ned.1", 11: "tur.1", 14: "bel.1",
  13: "sco.1", 15: "sui.1", 26: "swe.1", 23: "rou.1",
  54: "nor.1", 84: "den.1", 55: "fin.1", 25: "pol.1",
  9: "bra.1", 34: "bra.2", 85: "arg.1", 80: "col.1",
  18: "usa.1", 19: "mex.1",
  49: "jpn.1", 50: "kor.1", 17: "sau.1",
  7: "uefa.champions", 32: "conmebol.libertadores", 33: "conmebol.sudamericana",
};

// Slug interne (league-mapping.ts BSD_LEAGUE_IDS) → vrai id BSD.
const SLUG_TO_BSD = {
  ligue1: 6, ligue2: 89, epl: 1, championship: 12, fa_cup: 39, league_cup: 40,
  laliga: 3, laliga2: 38, bundesliga: 5, seriea: 4, primeira_liga: 2,
  eredivisie: 10, jupiler: 14, super_lig: 11, scot_prem: 13, super_league_swiss: 15,
  allsvenskan: 26, liga_1_romania: 23, j1_league: 49, k_league1: 50,
  argentina_primera: 85, colombia_primera: 80, denmark_superliga: 84,
  norway_eliteserien: 54, saudi_pro_league: 17, champions_league: 7,
  mls: 18, liga_mx: 19, caf_champions_league: 29, brasileirao_a: 9,
  brasileirao_b: 34, league_one: 86, league_two: 87, national_league: 91,
  veikkausliiga: 55, usl_championship: 57, ekstraklasa: 25, liga_portugal_2: 88,
  liga_3_portugal: 82, nigeria_premier: 28, parva_liga: 22, liga_f: 36,
  nwsl: 72, copa_colombia: 81, copa_libertadores: 32, copa_sudamericana: 33,
  npl_queensland: 70,
};

const dry = process.argv.includes("--dry-run");
const prisma = new PrismaClient();
let updated = 0, skipped = 0;
// Voie 1 : bzzoiroId numérique.
for (const [bsdId, slug] of Object.entries(BSD_TO_ESPN_SLUG)) {
  const res = dry ? { count: 0 } : await prisma.league.updateMany({
    where: { bzzoiroId: Number(bsdId) }, data: { espnSlug: slug },
  });
  if (res.count > 0) { updated += res.count; console.log(`BSD ${bsdId} → ${slug} : ${res.count}`); }
}
// Voie 2 : id slug interne.
for (const [slugId, bsdId] of Object.entries(SLUG_TO_BSD)) {
  const espn = BSD_TO_ESPN_SLUG[bsdId];
  if (!espn) continue;
  const res = dry ? { count: 0 } : await prisma.league.updateMany({
    where: { id: slugId }, data: { espnSlug: espn },
  });
  if (res.count > 0) { updated += res.count; console.log(`slug ${slugId} (BSD ${bsdId}) → ${espn} : ${res.count}`); }
  else skipped++;
}
console.log(`Terminé : ${updated} maj, ${skipped} sans ligne.`);
await prisma.$disconnect();
