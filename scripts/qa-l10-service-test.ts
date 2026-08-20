import { computeL10Surface, l10PointsForDiff, computeL10SurfaceFromDb } from "../src/lib/tennis-elo/l10-surface";
import type { TennisEloSnapshot, TennisPlayerMatch, PrismaClient } from "@prisma/client";

// 1. barème
console.log("barème:", [-50, 50, 51, 100, 101, 150, 151, 200, 201, 500].map((d) => d + "→" + l10PointsForDiff(d)).join(" "));

// 2. cas réel : Bejlek hard (snapshots figés W33)
const now = new Date("2026-08-20T12:00:00Z");
const mkMatch = (p: Partial<TennisPlayerMatch> & { date: Date; opponentKey: string; surface: string; weekIso: string; result: "W" | "L" }): TennisPlayerMatch =>
  ({ playerKey: "sara_bejlek", playerName: "Sara Bejlek", tour: "WTA", tournament: "T", round: "R32", opponentName: "X", score: "6-0 6-0", id: "x", createdAt: now, ...p }) as TennisPlayerMatch;
const mkSnap = (key: string, week: string, elo: number): TennisEloSnapshot =>
  ({ playerKey: key, playerName: key, tour: "WTA", weekIso: week, eloOverall: elo, eloHard: elo, eloClay: 0, eloGrass: 0, id: key + week, createdAt: now }) as TennisEloSnapshot;

const matches: TennisPlayerMatch[] = [
  mkMatch({ date: new Date("2026-08-13"), weekIso: "2026-W33", surface: "Hard", opponentKey: "ekaterina_alexandrova", result: "W", opponentName: "E. Alexandrova" }),
  mkMatch({ date: new Date("2026-08-02"), weekIso: "2026-W31", surface: "Hard", opponentKey: "iga_swiatek", result: "W", opponentName: "I. Swiatek" }),
  mkMatch({ date: new Date("2026-07-20"), weekIso: "2026-W30", surface: "Hard", opponentKey: "lilli_tagger", result: "W", opponentName: "L. Tagger" }),
  mkMatch({ date: new Date("2026-06-25"), weekIso: "2026-W26", surface: "Hard", opponentKey: "x", result: "L", opponentName: "X" }),
];
const snapshots: TennisEloSnapshot[] = [
  mkSnap("sara_bejlek", "2026-W33", 1759.6),
  mkSnap("sara_bejlek", "2026-W31", 1748.2),
  mkSnap("sara_bejlek", "2026-W30", 1730.1),
  mkSnap("sara_bejlek", "2026-W26", 1712.9),
  mkSnap("ekaterina_alexandrova", "2026-W33", 1818.9),
  mkSnap("ekaterina_alexandrova", "2026-W31", 1801.2),
  mkSnap("iga_swiatek", "2026-W31", 2068.2),
  mkSnap("lilli_tagger", "2026-W30", 1795.3),
  mkSnap("x", "2026-W26", 1750),
];

const r = computeL10Surface({ playerKey: "sara_bejlek", surface: "Hard", matches, snapshots, now });
console.log("score:", r.score, "| W:", r.wins, "L:", r.losses, "| matches:", r.matches, "rated:", r.rated);
for (const d of r.details) console.log(`  ${d.date.toISOString().slice(0, 10)} ${d.result} vs ${d.opponentName} eloPlayer=${d.playerEloAtWeek} eloOpp=${d.opponentEloAtWeek} diff=${d.eloDiff} pts=${d.points}`);

// 3. test DB (table vide locale)
const fakeDb = {
  tennisPlayerMatch: { findMany: async () => [] },
  tennisEloSnapshot: { findMany: async () => [] },
};
const fromDb = await computeL10SurfaceFromDb("sara_bejlek", "Hard", fakeDb as unknown as PrismaClient);
console.log("fromDb (vide):", fromDb);

// 4. import prisma réel
import { prisma } from "../src/lib/prisma";
const count = await prisma.tennisEloSnapshot.count();
console.log("snapshots en DB locale:", count);
await prisma.$disconnect();