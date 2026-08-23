// Exécuté DEPUIS le standalone pour reproduire le contexte exact du runtime
const path = "/home/ubuntu/pariscore/.next/standalone/node_modules";
const { PrismaClient } = require(path + "/@prisma/client");
const prisma = new PrismaClient();
(async () => {
  try {
    const c = await prisma.tennisEloSnapshot.count();
    console.log("standalone client: snapshots =", c);
    const matches = await prisma.tennisPlayerMatch.findMany({
      where: { playerKey: "sara_bejlek", surface: "Hard" },
      orderBy: { date: "desc" },
      take: 10,
    });
    console.log("standalone client: hard matchs =", matches.length);
  } catch (e) {
    console.error("ERR", e.message.slice(0, 300));
  }
  await prisma.$disconnect();
})();