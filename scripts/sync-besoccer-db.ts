/**
 * scripts/sync-besoccer-db.ts — Upsert les données BeSoccer dans SQLite via Prisma.
 *
 * Lit les JSON de data/besoccer/*.json (produits par scripts/scrape_besoccer.py)
 * et les insère atomiquement dans les tables `besoccer_analyses` et `lineups`.
 *
 * Usage :
 *   bun run scripts/sync-besoccer-db.ts           # tous les JSON du dossier
 *   bun run scripts/sync-besoccer-db.ts --ids 123,456  # uniquement ces matchIds
 *   bun run scripts/sync-besoccer-db.ts --dry-run       # affiche sans écrire
 */

import { PrismaClient } from "@prisma/client";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const BESOCCER_DIR = join(process.cwd(), "data", "besoccer");

type BesoccerJson = {
  match_id: string;
  slug?: string;
  fetched_at: string;
  analysis?: { probabilities?: Record<string, number>; h2h?: unknown[]; streaks?: Record<string, number> };
  prematch?: { context?: string; key_facts?: string[] };
  lineups?: {
    formation_home?: string | null;
    formation_away?: string | null;
    home?: Array<{ player: string; rating?: number | null }>;
    away?: Array<{ player: string; rating?: number | null }>;
    absents?: string[];
  };
  conditions?: {
    referee?: string | null;
    referee_yellow_avg?: number | null;
    referee_red_avg?: number | null;
    stadium?: string | null;
    weather?: string | null;
  };
};

async function syncOne(file: string): Promise<void> {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as BesoccerJson;
  const matchId = raw.match_id;
  const cond = raw.conditions ?? {};

  // Upsert BeSoccerAnalysis (1 par matchId)
  await prisma.beSoccerAnalysis.upsert({
    where: { matchId },
    create: {
      matchId,
      homeTeam: null,
      awayTeam: null,
      h2hStats: raw.analysis?.h2h ? JSON.stringify(raw.analysis.h2h) : null,
      refereeName: cond.referee ?? null,
      refereeYellowAvg: cond.referee_yellow_avg ?? null,
      refereeRedAvg: cond.referee_red_avg ?? null,
      stadium: cond.stadium ?? null,
      weather: cond.weather ?? null,
      predictions: raw.analysis?.probabilities ? JSON.stringify(raw.analysis.probabilities) : null,
      lineupsRaw: raw.lineups ? JSON.stringify(raw.lineups) : null,
    },
    update: {
      h2hStats: raw.analysis?.h2h ? JSON.stringify(raw.analysis.h2h) : null,
      refereeName: cond.referee ?? null,
      refereeYellowAvg: cond.referee_yellow_avg ?? null,
      refereeRedAvg: cond.referee_red_avg ?? null,
      stadium: cond.stadium ?? null,
      weather: cond.weather ?? null,
      predictions: raw.analysis?.probabilities ? JSON.stringify(raw.analysis.probabilities) : null,
      lineupsRaw: raw.lineups ? JSON.stringify(raw.lineups) : null,
    },
  });

  // Replace Lineups (delete + create pour ce matchId)
  await prisma.lineup.deleteMany({ where: { matchId } });
  const lineup = raw.lineups;
  if (lineup) {
    const rows: Array<{
      matchId: string;
      teamId: string;
      player: string;
      position: string;
      isProbable: boolean;
      rating: number | null;
      isAbsence: boolean;
    }> = [];
    const formation = lineup.formation_home ?? "4-3-3";
    const posMap = positionMapFromFormation(formation);
    for (const p of lineup.home ?? []) {
      rows.push({
        matchId,
        teamId: "home",
        player: p.player,
        position: posMap[rows.length] ?? "MID",
        isProbable: true,
        rating: p.rating ?? null,
        isAbsence: false,
      });
    }
    for (const p of lineup.away ?? []) {
      rows.push({
        matchId,
        teamId: "away",
        player: p.player,
        position: posMap[rows.length - (lineup.home?.length ?? 0)] ?? "MID",
        isProbable: true,
        rating: p.rating ?? null,
        isAbsence: false,
      });
    }
    for (const name of lineup.absents ?? []) {
      rows.push({ matchId, teamId: "home", player: name, position: "SUB", isProbable: false, rating: null, isAbsence: true });
    }
    if (rows.length > 0) {
      await prisma.lineup.createMany({ data: rows });
    }
  }

  console.log(`  → sync ${matchId}`);
}

function positionMapFromFormation(formation: string): Record<number, string> {
  /** Map index → position label depuis un schéma "4-3-3" */
  const parts = formation.split("-").map((n) => parseInt(n, 10));
  const map: Record<number, string> = {};
  let idx = 0;
  map[idx++] = "GK";
  for (let i = 0; i < (parts[0] || 4); i++) map[idx++] = "DEF";
  for (let i = 0; i < (parts[1] || 3); i++) map[idx++] = "MID";
  for (let i = 0; i < (parts[2] || 3); i++) map[idx++] = "FWD";
  return map;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const idsFlag = args.findIndex((a) => a === "--ids");
  const filterIds = idsFlag >= 0 ? args[idsFlag + 1]?.split(",").map((s) => s.trim()) : null;

  let files = readdirSync(BESOCCER_DIR).filter((f) => f.endsWith(".json"));
  if (filterIds) {
    files = files.filter((f) => filterIds.includes(f.replace(".json", "")));
  }
  console.log(`[sync-besoccer-db] ${files.length} fichier(s) à synchroniser${dryRun ? " (dry-run)" : ""}.`);

  for (const f of files) {
    if (dryRun) {
      console.log(`  (dry-run) ${f}`);
      continue;
    }
    await syncOne(join(BESOCCER_DIR, f));
  }

  await prisma.$disconnect();
  console.log("[sync-besoccer-db] Terminé.");
}

main().catch((err) => {
  console.error("[sync-besoccer-db] ERREUR:", err);
  process.exit(1);
});
