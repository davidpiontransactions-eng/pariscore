import { prisma } from "../src/lib/prisma";

const now = new Date();

async function seed() {
  // Snapshot W34 (courant) pour Sabalenka + Bejlek
  const upsert = async (key: string, name: string, tour: string, week: string, elo: number) => {
    await prisma.tennisEloSnapshot.upsert({
      where: { playerKey_weekIso: { playerKey: key, weekIso: week } },
      update: { eloOverall: elo, eloHard: elo, eloClay: elo - 40, eloGrass: elo - 60 },
      create: { playerKey: key, playerName: name, tour, weekIso: week, eloOverall: elo, eloHard: elo, eloClay: elo - 40, eloGrass: elo - 60 },
    });
  };
  // Semaines antérieures (W30-W33) pour le figement
  for (const [week, elo] of [["2026-W33", 2179.4], ["2026-W31", 2155.1], ["2026-W30", 2140.3]] as const) {
    await upsert("aryna_sabalenka", "Aryna Sabalenka", "WTA", week, elo);
  }
  for (const [week, elo] of [["2026-W33", 1759.6], ["2026-W31", 1748.2], ["2026-W30", 1730.1]] as const) {
    await upsert("sara_bejlek", "Sara Bejlek", "WTA", week, elo);
  }
  // Adversaires
  await upsert("ekaterina_alexandrova", "Ekaterina Alexandrova", "WTA", "2026-W33", 1818.9);
  await upsert("iga_swiatek", "Iga Swiatek", "WTA", "2026-W31", 2068.2);
  await upsert("lilli_tagger", "Lilli Tagger", "WTA", "2026-W30", 1795.3);
  await upsert("marta_kostyuk", "Marta Kostyuk", "WTA", "2026-W33", 1745.0);
  await upsert("diana_shnaider", "Diana Shnaider", "WTA", "2026-W31", 1710.0);

  const mk = async (key: string, name: string, date: string, week: string, surface: string, tournament: string, round: string, oppKey: string, oppName: string, result: string, score: string) => {
    const d = new Date(date);
    const existing = await prisma.tennisPlayerMatch.findFirst({ where: { playerKey: key, date: d, opponentKey: oppKey, round } });
    if (existing) return;
    await prisma.tennisPlayerMatch.create({
      data: { playerKey: key, playerName: name, tour: "WTA", date: d, weekIso: week, surface, tournament, round, opponentKey: oppKey, opponentName: oppName, result, score },
    });
  };

  // Sabalenka : 10 matchs Hard (Cincinnati + Toronto + Washington + Stuttgart…)
  const sab = [
    ["2026-08-13", "2026-W33", "Hard", "Cincinnati Masters", "R16", "ekaterina_alexandrova", "E. Alexandrova", "W", "6-1 6-3"],
    ["2026-08-12", "2026-W33", "Hard", "Cincinnati Masters", "R32", "marta_kostyuk", "M. Kostyuk", "W", "6-4 7-5"],
    ["2026-08-06", "2026-W32", "Hard", "Toronto Open", "QF", "iga_swiatek", "I. Swiatek", "W", "7-5 6-7 7-6"],
    ["2026-08-05", "2026-W32", "Hard", "Toronto Open", "R16", "diana_shnaider", "D. Shnaider", "W", "6-3 6-2"],
    ["2026-07-28", "2026-W31", "Hard", "Washington Open", "F", "lilli_tagger", "L. Tagger", "W", "6-2 6-4"],
    ["2026-07-27", "2026-W31", "Hard", "Washington Open", "SF", "marta_kostyuk", "M. Kostyuk", "W", "7-6 6-3"],
    ["2026-07-20", "2026-W30", "Hard", "Washington Open", "QF", "diana_shnaider", "D. Shnaider", "L", "4-6 6-3 6-7"],
    ["2026-06-30", "2026-W27", "Hard", "Eastbourne", "R16", "lilli_tagger", "L. Tagger", "W", "6-4 6-1"],
    ["2026-06-29", "2026-W27", "Hard", "Eastbourne", "R32", "ekaterina_alexandrova", "E. Alexandrova", "W", "7-6 6-2"],
    ["2026-06-15", "2026-W25", "Hard", "Berlin Open", "R16", "marta_kostyuk", "M. Kostyuk", "W", "6-3 7-5"],
  ];
  for (const [date, week, surface, tour, round, ok, on, r, s] of sab) {
    await mk("aryna_sabalenka", "Aryna Sabalenka", date, week, surface, tour, round, ok, on, r, s);
  }
  // Bejlek : 10 matchs Hard (Cincinnati + Toronto + Washington)
  const bej = [
    ["2026-08-13", "2026-W33", "Hard", "Cincinnati Masters", "R16", "iga_swiatek", "I. Swiatek", "W", "7-6 6-4"],
    ["2026-08-12", "2026-W33", "Hard", "Cincinnati Masters", "R32", "diana_shnaider", "D. Shnaider", "W", "6-2 7-6"],
    ["2026-08-06", "2026-W32", "Hard", "Toronto Open", "R16", "ekaterina_alexandrova", "E. Alexandrova", "W", "6-3 6-2"],
    ["2026-08-05", "2026-W32", "Hard", "Toronto Open", "R32", "lilli_tagger", "L. Tagger", "W", "7-5 6-4"],
    ["2026-07-28", "2026-W31", "Hard", "Washington Open", "QF", "marta_kostyuk", "M. Kostyuk", "W", "6-4 6-2"],
    ["2026-07-27", "2026-W31", "Hard", "Washington Open", "R16", "diana_shnaider", "D. Shnaider", "W", "6-3 7-5"],
    ["2026-07-20", "2026-W30", "Hard", "Washington Open", "R32", "lilli_tagger", "L. Tagger", "W", "6-1 6-3"],
    ["2026-07-13", "2026-W29", "Hard", "Budapest Open", "F", "marta_kostyuk", "M. Kostyuk", "W", "6-4 6-7 6-3"],
    ["2026-07-12", "2026-W29", "Hard", "Budapest Open", "SF", "ekaterina_alexandrova", "E. Alexandrova", "W", "6-2 6-4"],
    ["2026-07-11", "2026-W29", "Hard", "Budapest Open", "QF", "diana_shnaider", "D. Shnaider", "W", "6-4 6-1"],
  ];
  for (const [date, week, surface, tour, round, ok, on, r, s] of bej) {
    await mk("sara_bejlek", "Sara Bejlek", date, week, surface, tour, round, ok, on, r, s);
  }
  console.log("seed OK");
}

seed().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });