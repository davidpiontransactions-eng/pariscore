import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * GET /api/football/players/stats?league=epl&team=Arsenal
 * 
 * Retourne les top buteurs/passeurs d'une ligue, filtrés par équipe optionnellement.
 * Source : data/player-stats.json (généré par scripts/scrape-player-stats.js)
 */

type PlayerStat = {
  rank: number;
  player: {
    id: number;
    name: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    position?: string;
  };
  team: {
    id: number;
    name: string;
    shortName?: string;
    tla?: string;
    crest?: string;
  };
  goals: number;
  assists: number;
  penalties: number;
  playedMatches: number;
  minutesPlayed: number;
  minutesPerGoal: number | null;
};

type PlayerStatsData = {
  meta: {
    source: string;
    scrapedAt: string;
    leagues: string[];
  };
  leagues: Record<string, {
    name: string;
    code: string;
    scorers: PlayerStat[];
  }>;
};

// Cache en mémoire (5 min)
let cachedData: PlayerStatsData | null = null;
let cacheAt = 0;
const CACHE_TTL = 5 * 60_000;

function loadData(): PlayerStatsData | null {
  if (cachedData && Date.now() - cacheAt < CACHE_TTL) return cachedData;
  
  const filePath = join(process.cwd(), "data", "player-stats.json");
  if (!existsSync(filePath)) return null;
  
  try {
    cachedData = JSON.parse(readFileSync(filePath, "utf-8")) as PlayerStatsData;
    cacheAt = Date.now();
    return cachedData;
  } catch {
    return null;
  }
}

function normTeam(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const league = url.searchParams.get("league");
  const team = url.searchParams.get("team");

  if (!league) {
    return NextResponse.json({ error: "league requis" }, { status: 400 });
  }

  const data = loadData();
  if (!data) {
    return NextResponse.json({ error: "données indisponibles" }, { status: 404 });
  }

  const leagueData = data.leagues[league];
  if (!leagueData) {
    return NextResponse.json({ error: "ligue introuvable" }, { status: 404 });
  }

  let scorers = leagueData.scorers;

  // Filtrer par équipe si spécifié
  if (team) {
    const teamKey = normTeam(team);
    scorers = scorers.filter(s => {
      const teamName = normTeam(s.team.name);
      const teamShort = s.team.shortName ? normTeam(s.team.shortName) : "";
      const teamTla = s.team.tla ? normTeam(s.team.tla) : "";
      return teamName.includes(teamKey) || teamKey.includes(teamName) ||
             teamShort.includes(teamKey) || teamKey.includes(teamShort) ||
             teamTla === teamKey;
    });
  }

  // Top buteurs
  const topScorers = [...scorers]
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, 10)
    .map(s => ({
      name: s.player.name,
      team: s.team.name,
      teamCrest: s.team.crest,
      goals: s.goals,
      assists: s.assists,
      playedMatches: s.playedMatches,
      minutesPlayed: s.minutesPlayed,
      minutesPerGoal: s.minutesPerGoal,
      position: s.player.position,
      nationality: s.player.nationality,
    }));

  // Top passeurs
  const topAssisters = [...scorers]
    .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
    .slice(0, 10)
    .map(s => ({
      name: s.player.name,
      team: s.team.name,
      teamCrest: s.team.crest,
      goals: s.goals,
      assists: s.assists,
      playedMatches: s.playedMatches,
      minutesPlayed: s.minutesPlayed,
      position: s.player.position,
      nationality: s.player.nationality,
    }));

  return NextResponse.json({
    league: leagueData.name,
    team: team ?? null,
    topScorers,
    topAssisters,
    meta: {
      source: data.meta.source,
      scrapedAt: data.meta.scrapedAt,
    },
  });
}
