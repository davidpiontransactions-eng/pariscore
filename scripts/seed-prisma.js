/**
 * scripts/seed-prisma.js — Purge des enregistrements mock de la DB Prisma.
 *
 * Les matchs factices seedés historiquement (ids mock_fl*, mock_odds_*) sont
 * supprimés : l'UI football ne consomme plus que des données réelles
 * (/api/football/matches → BSD + OpenLigaDB). Ce script ne crée plus AUCUNE
 * donnée : il nettoie uniquement.
 *
 * Usage: node scripts/seed-prisma.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.match.findMany({
    where: { id: { startsWith: "mock" } },
    select: { id: true },
  });
  const ids = matches.map((m) => m.id);
  if (ids.length === 0) {
    console.log("Aucun match mock en base — rien à purger.");
    await prisma.$disconnect();
    return;
  }
  const odds = await prisma.odds.deleteMany({ where: { matchId: { in: ids } } });
  const preds = await prisma.prediction.deleteMany({ where: { matchId: { in: ids } } });
  const del = await prisma.match.deleteMany({ where: { id: { startsWith: "mock" } } });
  console.log(`Purge terminée : matches=${del.count} odds=${odds.count} predictions=${preds.count}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});