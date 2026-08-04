// Quick verify — counts only
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const leagues = await prisma.league.count();
  const teams = await prisma.team.count();
  const matches = await prisma.match.count();
  const odds = await prisma.odds.count();
  const kv = await prisma.kvStore.count();
  console.log(`OK Leagues: ${leagues} | Teams: ${teams} | Matches: ${matches} | Odds: ${odds} | KV: ${kv}`);
  await prisma.$disconnect();
}
main();

