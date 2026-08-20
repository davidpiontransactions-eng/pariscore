import { computeL10SurfaceFromDb } from "../src/lib/tennis-elo/l10-surface";
import { prisma } from "../src/lib/prisma";

for (const key of ["sara_bejlek", "aryna_sabalenka"]) {
  const r = await computeL10SurfaceFromDb(key, "Hard", prisma);
  console.log(`== ${key}: ${r ? `score=${r.score} W=${r.wins} L=${r.losses} (${r.matches} matchs, ${r.rated} rated)` : "null (pas de snapshot)"}`);
  if (r) {
    for (const d of r.details) {
      console.log(`   ${d.date.toISOString().slice(0, 10)} ${d.result} vs ${d.opponentName} | ${d.tournament} ${d.round} | ${d.score || "-"} | eloP=${d.playerEloAtWeek ?? "-"} eloO=${d.opponentEloAtWeek ?? "-"} diff=${d.eloDiff ?? "-"} pts=${d.points}`);
    }
  }
}
await prisma.$disconnect();