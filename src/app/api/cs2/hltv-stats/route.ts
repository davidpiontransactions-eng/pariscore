import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * GET /api/cs2/hltv-stats
 *
 * Retourne les stats HLTV scrapées (maps & équipes) depuis les fichiers JSON
 * statiques dans data/. Ces fichiers sont peuplés par le script
 * tools/scrape-hltv-stats.js (cron weekly, nécessite IP résidentielle ou FlareSolverr).
 *
 * Query params:
 *   ?team=Vitality   — filtre une seule équipe
 *   ?map=Mirage      — filtre les stats d'une carte spécifique
 *   ?ranked=1        — top-15 uniquement (par classement HLTV)
 */

const DATA_DIR = join(process.cwd(), "data");
const TEAM_STATS_FILE = join(DATA_DIR, "hltv_team_stats.json");
const MAP_POOL_FILE = join(DATA_DIR, "hltv_map_pool.json");

type TeamStatsRaw = {
  generated: string;
  source: string;
  n_teams: number;
  maps: string[];
  teams: Array<{
    name: string;
    hltv_id: number;
    rank: number;
    points: number;
    overview: {
      mapsPlayed: number | null;
      totalKills: number | null;
      totalDeaths: number | null;
      roundsPlayed: number | null;
      kdRatio: number | null;
      wins: number | null;
      draws: number | null;
      losses: number | null;
    } | null;
    mapStats: Record<string, {
      wins: number;
      draws: number;
      losses: number;
      winRate: number;
      totalRounds: number;
    }>;
    currentLineup: Array<{ id: number; name: string }>;
  }>;
};

type MapPoolRaw = {
  generated: string;
  source: string;
  n_teams: number;
  maps: string[];
  mapPool: Record<string, {
    avgWinrate: number | null;
    totalMatches: number;
    teams: Array<{
      name: string;
      hltv_id: number;
      winRate: number;
      wins: number;
      losses: number;
      totalRounds: number;
      rank: number;
    }>;
  }>;
};

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamFilter = searchParams.get("team");
  const mapFilter = searchParams.get("map");
  const rankedOnly = searchParams.get("ranked") === "1";

  const [teamStats, mapPool] = await Promise.all([
    readJson<TeamStatsRaw>(TEAM_STATS_FILE),
    readJson<MapPoolRaw>(MAP_POOL_FILE),
  ]);

  if (!teamStats && !mapPool) {
    return NextResponse.json(
      { error: "Données HLTV indisponibles. Lancez: bun run scrape:hltv" },
      { status: 404 }
    );
  }

  // Filtrage équipes
  let teams = teamStats?.teams ?? [];
  if (teamFilter) {
    const q = teamFilter.toLowerCase();
    teams = teams.filter(t => t.name.toLowerCase().includes(q));
  }
  if (rankedOnly) {
    teams = teams.filter(t => t.rank <= 15);
  }

  // Filtrage map pool
  let pool = mapPool?.mapPool ?? {};
  if (mapFilter) {
    const key = mapFilter.charAt(0).toUpperCase() + mapFilter.slice(1).toLowerCase();
    if (pool[key]) {
      pool = { [key]: pool[key] };
    }
  }

  // Calcul de l'âge des données
  const generated = teamStats?.generated || mapPool?.generated;
  const age = generated ? Date.now() - new Date(generated).getTime() : null;

  return NextResponse.json({
    teamStats: teamStats
      ? { ...teamStats, teams }
      : null,
    mapPool: mapPool
      ? { ...mapPool, mapPool: pool }
      : null,
    cached: true,
    age,
  });
}
