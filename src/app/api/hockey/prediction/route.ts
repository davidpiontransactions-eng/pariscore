import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 60 * 60_000; // 1h — dérivé des données prematch
import {
  predictHockeyMatch,
  estimateLambdas,
  type TeamStats,
  type HockeyPrediction,
} from "@/lib/prediction/hockey/poisson";

// ─── Types ──────────────────────────────────────────────────────────────────

type PlayerStat = {
  rank: number;
  name: string;
  position: string;
  playerId: string | null;
  playerSlug: string | null;
  photoUrl: string | null;
  team: string;
  gp: number;
  g: number;
  a: number;
  tp: number;
  ppg: number;
  pim: number;
  plusMinus: number;
};

type TeamStanding = {
  rank: number;
  name: string;
  teamId: string | null;
  teamSlug: string | null;
  conf: string;
  gp: number;
  w: number;
  t: number;
  l: number;
  otw: number;
  otl: number;
  gf: number;
  ga: number;
  plusMinus: number;
  tp: number;
  ppg: number;
};

type MatchPrematch = {
  team1Id: number;
  team1Name: string;
  team2Id: number;
  team2Name: string;
  odds1X2?: { home: number; draw: number; away: number } | null;
  h2h?: {
    homeTeam: string;
    awayTeam: string;
    date: string;
    summaryHome: Record<string, unknown> | null;
    summaryAway: Record<string, unknown> | null;
    h2hStats: Record<string, unknown> | null;
    standings: {
      rank: number;
      name: string;
      gp: number;
      all: { w: number; otw: number; otl: number; l: number; pts: number };
    }[];
  } | null;
};

type PredictionPayload = {
  updatedAt: string;
  source: string;
  predictions: Record<string, {
    match: { home: string; away: string };
    prediction: HockeyPrediction;
  }>;
};

const cache = createTtlCache<PredictionPayload>("__hockeyPrediction");

function loadJson<T>(filename: string): T | null {
  try {
    const filePath = join(process.cwd(), "data", filename);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

type AnnabetStanding = {
  rank: number;
  name: string;
  gp: number;
  all?: { w: number; otw: number; otl: number; l: number; pts: number };
};

function findTeamStats(
  teamName: string,
  standings: TeamStanding[] | AnnabetStanding[]
): TeamStats | null {
  // Recherche fuzzy par nom
  const normalised = teamName.toLowerCase().replace(/[^a-z]/g, "");
  const found = standings.find(
    (t) =>
      t.name.toLowerCase().replace(/[^a-z]/g, "").includes(normalised) ||
      normalised.includes(t.name.toLowerCase().replace(/[^a-z]/g, ""))
  );
  if (!found) return null;

  const s = found as AnnabetStanding;
  // Calculer GF/GA depuis all si disponible
  const allStats = s.all;
  const gf = allStats ? Math.round((allStats.w * 2.8 + allStats.otw * 2.5) / Math.max(s.gp, 1) * s.gp) : 0;
  const ga = allStats ? Math.round((allStats.l * 2.8 + allStats.otl * 2.5) / Math.max(s.gp, 1) * s.gp) : 0;

  return {
    name: found.name,
    gp: found.gp,
    gf,
    ga,
    home: undefined,
    away: undefined,
  };
}

function findPlayers(
  teamName: string,
  players: PlayerStat[]
): PlayerStat[] {
  const normalised = teamName.toLowerCase().replace(/[^a-z]/g, "");
  return players.filter(
    (p) =>
      p.team.toLowerCase().replace(/[^a-z]/g, "").includes(normalised) ||
      normalised.includes(p.team.toLowerCase().replace(/[^a-z]/g, ""))
  );
}

// ─── GET /api/hockey/prediction ─────────────────────────────────────────────

export async function GET() {
  const cached = cache.getEntry();
  if (cached?.data && isFresh(cached, CACHE_TTL)) return NextResponse.json(cached.data);

  // Charger les données source
  const prematch = loadJson<{ leagues: Record<string, { matches: MatchPrematch[] }> }>(
    "annabet_hockey_prematch.json"
  );
  const standings = loadJson<{ leagues: Record<string, { teams: TeamStanding[] }> }>(
    "eliteprospects_hockey_standings.json"
  );
  const playerStats = loadJson<{ leagues: Record<string, { players: PlayerStat[] }> }>(
    "eliteprospects_player_stats.json"
  );

  if (!prematch || !standings) {
    return NextResponse.json(
      { error: "Données insuffisantes pour les prédictions" },
      { status: 503 }
    );
  }

  const predictions: PredictionPayload["predictions"] = {};

  // Pour chaque ligue avec des matchs prematch
  for (const [leagueId, leagueData] of Object.entries(prematch.leagues)) {
    const leagueStandings = standings.leagues?.[leagueId]?.teams ?? [];
    const leaguePlayers = playerStats?.leagues?.[leagueId]?.players ?? [];

    for (const match of leagueData.matches) {
      if (!match.h2h?.standings) continue;

      // Trouver les stats des deux equipes
      const homeStats = findTeamStats(match.team1Name, match.h2h.standings);
      const awayStats = findTeamStats(match.team2Name, match.h2h.standings);

      if (!homeStats || !awayStats) continue;

      // Joueurs des deux equipes
      const homePlayers = findPlayers(match.team1Name, leaguePlayers);
      const awayPlayers = findPlayers(match.team2Name, leaguePlayers);
      const allPlayers = [...homePlayers, ...awayPlayers];

      // Cotes disponibles
      const homeOdds = match.odds1X2?.home;
      const awayOdds = match.odds1X2?.away;

      // Prédiction
      const prediction = predictHockeyMatch(
        homeStats,
        awayStats,
        allPlayers.map((p) => ({
          name: p.name,
          team: p.team,
          position: p.position,
          gp: p.gp,
          g: p.g,
          a: p.a,
        })),
        homeOdds,
        awayOdds
      );

      const key = `${match.team1Id}-${match.team2Id}`;
      predictions[key] = {
        match: { home: match.team1Name, away: match.team2Name },
        prediction,
      };
    }
  }

  const result: PredictionPayload = {
    updatedAt: new Date().toISOString(),
    source: "hockey-poisson-model",
    predictions,
  };

  cache.set(result);
  return NextResponse.json(result);
}
