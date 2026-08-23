const { PrismaClient } = require("/home/ubuntu/pariscore/node_modules/@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const c = await prisma.tennisEloSnapshot.count();
  const m = await prisma.tennisPlayerMatch.count();
  console.log("snapshots:", c, "| matchs:", m);
  const s = await prisma.tennisEloSnapshot.findMany({ where: { playerKey: "sara_bejlek" }, orderBy: { weekIso: "desc" }, take: 2 });
  console.log("bejlek snapshots:", s.length, s[0] ? s[0].weekIso + " elo=" + s[0].eloHard : "");
  const mm = await prisma.tennisPlayerMatch.findMany({ where: { playerKey: "sara_bejlek", surface: "Hard" }, orderBy: { date: "desc" }, take: 2 });
  console.log("bejlek hard matchs:", mm.length, mm[0] ? mm[0].tournament + " " + mm[0].opponentName : "");
  await prisma.$disconnect();
})().catch((e) => { console.error("ERR", e.message.slice(0, 300)); process.exit(1); });