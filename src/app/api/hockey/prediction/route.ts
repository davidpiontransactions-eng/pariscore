import { NextResponse } from "next/server";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const CACHE_TTL = 60 * 60_000; // 1h — dérivé des données prematch
import {
  predictHockeyMatch,
  lineStrengthFactor,
  type TeamStats,
  type HockeyPrediction,
} from "@/lib/prediction/hockey/poisson";
import { loadMergedPrematch } from "@/lib/hockey/prematch-data";
import { resolveRealTeamStats } from "@/lib/hockey/team-stats";

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

type PredictionPayload = {
  updatedAt: string;
  source: string;
  predictions: Record<string, {
    match: { home: string; away: string };
    prediction: HockeyPrediction;
  }>;
  /**
   * Matchs écartés faute de données RÉELLES, avec le motif. Alimente le
   * `predictions_available` par match côté UI : sans cette liste, un match
   * sans données disparaît du payload et l'UI ne peut pas distinguer
   * « pas de match » de « match non prédit ».
   */
  unavailable: { match: { home: string; away: string }; reason: string }[];
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

/**
 * Statistiques d'une équipe pour le modèle Poisson.
 *
 * ⚠️ La fabrication de buts `w * 2.8 + otw * 2.5` a été SUPPRIMÉE (bug P3.1) :
 * les standings Annabet ne portent aucun but, la valeur 2.8 était inventée et
 * produisait jusqu'à `gf = 0`. La résolution — et sa règle « pas de buts réels
 * → pas de prédiction » — vit désormais dans `@/lib/hockey/team-stats`, testée
 * dans `src/lib/__tests__/hockey-team-stats.test.ts`.
 */
function findTeamStats(
  teamName: string,
  teams: TeamStanding[]
): TeamStats | null {
  return resolveRealTeamStats(teamName, teams);
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

// Alias de clés de ligue entre sources : prematch "magnus" vs eliteprospects "ligue-magnus"
function pickLeaguePlayers(
  playerStats: { leagues: Record<string, { players: PlayerStat[] }> } | null,
  leagueId: string
): PlayerStat[] {
  const leagues = playerStats?.leagues ?? {};
  return (
    leagues[leagueId]?.players ??
    leagues[`ligue-${leagueId}`]?.players ??
    leagues[leagueId.replace(/^ligue-/, "")]?.players ??
    []
  );
}

/**
 * Classement réel d'une ligue (eliteprospects), alias résolus comme pour les
 * joueurs : le prematch dit `magnus`, eliteprospects dit `ligue-magnus`.
 *
 * `[]` si la ligue n'a pas de classement réel → aucune prédiction, jamais une
 * prédiction inventée.
 */
function pickLeagueStandings(
  standings: { leagues: Record<string, { teams: TeamStanding[] }> } | null,
  leagueId: string
): TeamStanding[] {
  const leagues = standings?.leagues ?? {};
  return (
    leagues[leagueId]?.teams ??
    leagues[`ligue-${leagueId}`]?.teams ??
    leagues[leagueId.replace(/^ligue-/, "")]?.teams ??
    []
  );
}

// ─── GET /api/hockey/prediction ─────────────────────────────────────────────

export async function GET() {
  const cached = cache.getEntry();
  if (cached?.data && isFresh(cached, CACHE_TTL)) return NextResponse.json(cached.data);

  // Charger les données source (merge BetExplorer + Annabet + Oddspedia)
  const prematch = loadMergedPrematch();
  const frozen = loadJson<{ lines: Record<string, { ev_forwards: { gf: number | null; ga: number | null }[] }> }>(
    "nhl_frozenpool.json"
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
  const unavailable: PredictionPayload["unavailable"] = [];

  // Pour chaque ligue avec des matchs prematch
  for (const [leagueId, leagueData] of Object.entries(prematch.leagues)) {
    const leaguePlayers = pickLeaguePlayers(playerStats, leagueId);
    const leagueTeams = pickLeagueStandings(standings, leagueId);
    const teamLines = (code: string) => {
      const key = Object.keys(frozen?.lines ?? {}).find((k) => code.toUpperCase().includes(k) || k.includes(code.toUpperCase().slice(0, 3)));
      return lineStrengthFactor(key ? frozen?.lines[key]?.ev_forwards ?? [] : []);
    };

    for (const match of leagueData.matches) {
      // Stats des deux équipes, lues dans le classement RÉEL de la ligue.
      // `null` si l'une des deux est absente du classement → pas de prédiction
      // (l'ancien code exigeait `h2h.standings`, qui ne sert plus aux stats et
      // qui n'existait que pour les lire : garder cette porte aurait interdit
      // toute prédiction sur une ligue pourtant bien classée).
      const homeStats = findTeamStats(match.team1Name, leagueTeams);
      const awayStats = findTeamStats(match.team2Name, leagueTeams);

      const pair = { home: match.team1Name, away: match.team2Name };
      if (!homeStats || !awayStats) {
        // Motif nommé, pas « match ignoré » : l'UI doit pouvoir dire pourquoi il
        // n'y a pas de prédiction. Premier cas discriminate = la ligue n'a
        // aucun classement réel du tout.
        const raison = leagueTeams.length === 0
          ? `aucun classement réel pour la ligue « ${leagueId} »`
          : `classement réel sans équipe exploitable (${!homeStats ? match.team1Name : match.team2Name})`;
        unavailable.push({ match: pair, reason: raison });
        continue;
      }

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
        awayOdds,
        { home: teamLines(match.team1Name), away: teamLines(match.team2Name) }
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
    unavailable,
  };

  cache.set(result);
  return NextResponse.json(result);
}
