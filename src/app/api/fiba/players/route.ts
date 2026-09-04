import { NextRequest, NextResponse } from "next/server";
import { cache, fibaCache } from "@/lib/cache/memory-cache";
import { rateLimits } from "@/lib/api/rate-limit";

/**
 * API Route pour les joueuses FIBA Women's WC 2026.
 *
 * Sources:
 * - ESPN FIBA API (box scores agrégés)
 * - Calculs serveur (PIR, efficiency, composite score)
 *
 * GET /api/fiba/players
 *   ?phase=group|quarter|semi|final
 *   &stat=ppg|rpg|apg|pir|composite
 *   &sort=desc|asc
 *   &position=G|F|C
 */

const ESPN_FIBA_SCOREBOARD = "https://site.web.api.espn.com/apis/site/v2/sports/basketball/fiba/scoreboard";

type ESPNPlayerStats = {
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
    position?: { abbreviation: string };
    jersey?: string;
    headshot?: { href: string };
    team?: { abbreviation: string; displayName: string; color: string };
  };
  statistics: Array<{
    names: string[];
    labels: string[];
    displayValue: string[];
    value: number[];
  }>;
  stats: Record<string, string | number>;
};

export type FibaPlayer = {
  playerId: string;
  name: string;
  team: string;
  teamAbbr: string;
  teamColor: string;
  position: string;
  jersey: string;
  headshot: string;
  // Stats cumulées
  gamesPlayed: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  // Métriques calculées
  ppg: number;
  rpg: number;
  apg: number;
  fgPct: number;
  threePct: number;
  pir: number;
  efficiency: number;
  composite: number;
  // MVP
  mvpScore: number;
  mvpRank: number;
};

/**
 * Calculate FIBA Performance Index Rating (PIR).
 * Formule officielle simplifiée.
 */
function calculatePIR(stats: {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgMade: number;
  fgAttempted: number;
  ftMade: number;
  ftAttempted: number;
}): number {
  const positive =
    stats.points +
    stats.rebounds +
    stats.assists +
    stats.steals +
    stats.blocks +
    stats.fgMade +
    stats.ftMade;
  const negative =
    (stats.fgAttempted - stats.fgMade) +
    (stats.ftAttempted - stats.ftMade) +
    stats.turnovers +
    stats.fouls;
  return positive - negative;
}

/**
 * Calculate composite score (weighted PIR + win contribution).
 */
function calculateComposite(player: {
  pir: number;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
}, teamWinPct: number): number {
  const volumeWeight = Math.min(player.gamesPlayed / 6, 1);
  const statsBoost = (player.ppg * 0.4 + player.rpg * 0.2 + player.apg * 0.3) / 10;
  return (player.pir * volumeWeight + statsBoost) * (teamWinPct + 0.5);
}

/**
 * Calculate MVP score based on composite metrics.
 */
function calculateMvpScore(player: {
  composite: number;
  ppg: number;
  gamesPlayed: number;
  teamWinPct: number;
}): number {
  const baseScore = player.composite * 0.6;
  const scoringBonus = player.ppg * 0.3;
  const consistencyBonus = Math.min(player.gamesPlayed / 6, 1) * 5;
  const winBonus = player.teamWinPct * 8;
  return Math.min(100, Math.max(0, baseScore + scoringBonus + consistencyBonus + winBonus));
}

/**
 * Extract team win pct from standings data.
 */
async function getTeamWinPcts(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://site.web.api.espn.com/apis/v2/sports/basketball/fiba/standings", {
      headers: { "User-Agent": "PariScore/1.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const result: Record<string, number> = {};
    const groups = data?.children ?? [];
    for (const group of groups) {
      const entries = group?.standings?.entries ?? [];
      for (const entry of entries) {
        const abbr = entry.team?.abbreviation;
        const wins = entry.stats?.find((s: { name: string; value: number }) => s.name === "wins")?.value ?? 0;
        const losses = entry.stats?.find((s: { name: string; value: number }) => s.name === "losses")?.value ?? 0;
        if (abbr) {
          result[abbr] = (wins + losses) > 0 ? wins / (wins + losses) : 0.5;
        }
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Fetch completed game box scores from ESPN FIBA.
 */
async function fetchGameBoxScores(): Promise<Map<string, ESPNPlayerStats[]>> {
  const playerMap = new Map<string, ESPNPlayerStats[]>();

  try {
    const res = await fetch(ESPN_FIBA_SCOREBOARD, {
      headers: { "User-Agent": "PariScore/1.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return playerMap;
    const data = await res.json();
    const events = data?.events ?? [];

    for (const event of events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;

      const competitors = comp.competitors ?? [];
      for (const competitor of competitors) {
        const playerStats = competitor?.roster ?? [];
        for (const ps of playerStats) {
          const athlete = ps.athlete;
          if (!athlete?.id) continue;

          const key = athlete.id;
          if (!playerMap.has(key)) {
            playerMap.set(key, []);
          }
          playerMap.get(key)!.push(ps as unknown as ESPNPlayerStats);
        }
      }
    }
  } catch {
    // Fallback: return empty map
  }

  return playerMap;
}

/** GET /api/fiba/players */
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimitResult = rateLimits.stats(`players:${ip}`);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const phase = searchParams.get("phase") ?? "all";
  const stat = searchParams.get("stat") ?? "composite";
  const sort = searchParams.get("sort") ?? "desc";
  const position = searchParams.get("position");

  const cacheKey = `fiba-players:${phase}:${stat}:${sort}:${position ?? "all"}`;
  const cached = cache.get<FibaPlayer[]>(cacheKey);
  if (cached) {
    return NextResponse.json({
      players: cached,
      source: "cache",
    });
  }

  try {
    const [playerGameStats, teamWinPcts] = await Promise.all([
      fetchGameBoxScores(),
      getTeamWinPcts(),
    ]);

    // Agréger les stats par joueur
    const aggregated = new Map<string, {
      playerId: string;
      name: string;
      team: string;
      teamAbbr: string;
      teamColor: string;
      position: string;
      jersey: string;
      headshot: string;
      gamesPlayed: number;
      totalMinutes: number;
      totalPoints: number;
      totalRebounds: number;
      totalAssists: number;
      totalSteals: number;
      totalBlocks: number;
      totalTurnovers: number;
      totalFouls: number;
      totalFgMade: number;
      totalFgAttempted: number;
      totalThreeMade: number;
      totalThreeAttempted: number;
      totalFtMade: number;
      totalFtAttempted: number;
    }>();

    for (const [, games] of playerGameStats) {
      for (const game of games) {
        const athlete = game.athlete;
        if (!athlete?.id) continue;

        const existing = aggregated.get(athlete.id);
        const mins = parseFloat(String(game.stats?.["minutesPlayed"] ?? game.stats?.["MIN"] ?? "0")) || 0;
        const pts = parseFloat(String(game.stats?.["points"] ?? game.stats?.["PTS"] ?? "0")) || 0;
        const reb = parseFloat(String(game.stats?.["rebounds"] ?? game.stats?.["REB"] ?? "0")) || 0;
        const ast = parseFloat(String(game.stats?.["assists"] ?? game.stats?.["AST"] ?? "0")) || 0;
        const stl = parseFloat(String(game.stats?.["steals"] ?? game.stats?.["STL"] ?? "0")) || 0;
        const blk = parseFloat(String(game.stats?.["blocks"] ?? game.stats?.["BLK"] ?? "0")) || 0;
        const tov = parseFloat(String(game.stats?.["turnovers"] ?? game.stats?.["TOV"] ?? "0")) || 0;
        const fouls = parseFloat(String(game.stats?.["fouls"] ?? game.stats?.["PF"] ?? "0")) || 0;
        const fgm = parseFloat(String(game.stats?.["fieldGoalsMade"] ?? game.stats?.["FGM"] ?? "0")) || 0;
        const fga = parseFloat(String(game.stats?.["fieldGoalsAttempted"] ?? game.stats?.["FGA"] ?? "0")) || 0;
        const tpm = parseFloat(String(game.stats?.["threePointFieldGoalsMade"] ?? game.stats?.["3PM"] ?? "0")) || 0;
        const tpa = parseFloat(String(game.stats?.["threePointFieldGoalsAttempted"] ?? game.stats?.["3PA"] ?? "0")) || 0;
        const ftm = parseFloat(String(game.stats?.["freeThrowsMade"] ?? game.stats?.["FTM"] ?? "0")) || 0;
        const fta = parseFloat(String(game.stats?.["freeThrowsAttempted"] ?? game.stats?.["FTA"] ?? "0")) || 0;

        if (existing) {
          existing.gamesPlayed++;
          existing.totalMinutes += mins;
          existing.totalPoints += pts;
          existing.totalRebounds += reb;
          existing.totalAssists += ast;
          existing.totalSteals += stl;
          existing.totalBlocks += blk;
          existing.totalTurnovers += tov;
          existing.totalFouls += fouls;
          existing.totalFgMade += fgm;
          existing.totalFgAttempted += fga;
          existing.totalThreeMade += tpm;
          existing.totalThreeAttempted += tpa;
          existing.totalFtMade += ftm;
          existing.totalFtAttempted += fta;
        } else {
          aggregated.set(athlete.id, {
            playerId: athlete.id,
            name: athlete.displayName ?? athlete.shortName ?? "Unknown",
            team: athlete.team?.displayName ?? "",
            teamAbbr: athlete.team?.abbreviation ?? "",
            teamColor: athlete.team?.color ?? "666666",
            position: athlete.position?.abbreviation ?? "UTIL",
            jersey: athlete.jersey ?? "",
            headshot: athlete.headshot?.href ?? "",
            gamesPlayed: 1,
            totalMinutes: mins,
            totalPoints: pts,
            totalRebounds: reb,
            totalAssists: ast,
            totalSteals: stl,
            totalBlocks: blk,
            totalTurnovers: tov,
            totalFouls: fouls,
            totalFgMade: fgm,
            totalFgAttempted: fga,
            totalThreeMade: tpm,
            totalThreeAttempted: tpa,
            totalFtMade: ftm,
            totalFtAttempted: fta,
          });
        }
      }
    }

    // Calculer les métriques finales
    const players: FibaPlayer[] = [];
    for (const [, agg] of aggregated) {
      const gp = agg.gamesPlayed || 1;
      const ppg = agg.totalPoints / gp;
      const rpg = agg.totalRebounds / gp;
      const apg = agg.totalAssists / gp;
      const fgPct = agg.totalFgAttempted > 0 ? agg.totalFgMade / agg.totalFgAttempted : 0;
      const threePct = agg.totalThreeAttempted > 0 ? agg.totalThreeMade / agg.totalThreeAttempted : 0;
      const teamWinPct = teamWinPcts[agg.teamAbbr] ?? 0.5;

      const pir = calculatePIR({
        points: agg.totalPoints,
        rebounds: agg.totalRebounds,
        assists: agg.totalAssists,
        steals: agg.totalSteals,
        blocks: agg.totalBlocks,
        turnovers: agg.totalTurnovers,
        fouls: agg.totalFouls,
        fgMade: agg.totalFgMade,
        fgAttempted: agg.totalFgAttempted,
        ftMade: agg.totalFtMade,
        ftAttempted: agg.totalFtAttempted,
      });

      const efficiency = agg.totalMinutes > 0
        ? ((agg.totalPoints + agg.totalRebounds + agg.totalAssists + agg.totalSteals + agg.totalBlocks) / agg.totalMinutes) * 40
        : 0;

      const composite = calculateComposite(
        { pir, gamesPlayed: gp, ppg, rpg, apg },
        teamWinPct,
      );

      const mvpScore = calculateMvpScore({
        composite,
        ppg,
        gamesPlayed: gp,
        teamWinPct,
      });

      players.push({
        playerId: agg.playerId,
        name: agg.name,
        team: agg.team,
        teamAbbr: agg.teamAbbr,
        teamColor: agg.teamColor,
        position: agg.position,
        jersey: agg.jersey,
        headshot: agg.headshot,
        gamesPlayed: gp,
        minutes: Math.round(agg.totalMinutes / gp),
        points: Math.round(ppg * 10) / 10,
        rebounds: Math.round(rpg * 10) / 10,
        assists: Math.round(apg * 10) / 10,
        steals: Math.round((agg.totalSteals / gp) * 10) / 10,
        blocks: Math.round((agg.totalBlocks / gp) * 10) / 10,
        turnovers: Math.round((agg.totalTurnovers / gp) * 10) / 10,
        fgMade: agg.totalFgMade,
        fgAttempted: agg.totalFgAttempted,
        threeMade: agg.totalThreeMade,
        threeAttempted: agg.totalThreeAttempted,
        ftMade: agg.totalFtMade,
        ftAttempted: agg.totalFtAttempted,
        ppg: Math.round(ppg * 10) / 10,
        rpg: Math.round(rpg * 10) / 10,
        apg: Math.round(apg * 10) / 10,
        fgPct: Math.round(fgPct * 1000) / 10,
        threePct: Math.round(threePct * 1000) / 10,
        pir: Math.round(pir * 10) / 10,
        efficiency: Math.round(efficiency * 10) / 10,
        composite: Math.round(composite * 10) / 10,
        mvpScore: Math.round(mvpScore * 10) / 10,
        mvpRank: 0,
      });
    }

    // Filtrer par position si demandé
    let filtered = players;
    if (position) {
      const posUpper = position.toUpperCase();
      filtered = players.filter((p) => {
        if (posUpper === "G") return p.position === "PG" || p.position === "SG" || p.position === "G";
        if (posUpper === "F") return p.position === "SF" || p.position === "PF" || p.position === "F";
        if (posUpper === "C") return p.position === "C";
        return true;
      });
    }

    // Trier
    const sortKey = (p: FibaPlayer): number => {
      switch (stat) {
        case "ppg": return p.ppg;
        case "rpg": return p.rpg;
        case "apg": return p.apg;
        case "pir": return p.pir;
        case "composite": return p.composite;
        case "mvp": return p.mvpScore;
        default: return p.composite;
      }
    };

    filtered.sort((a, b) => sortKey(b) - sortKey(a));

    // Assigner MVP rank
    const sorted = [...filtered].sort((a, b) => b.mvpScore - a.mvpScore);
    sorted.forEach((p, i) => { p.mvpRank = i + 1; });

    // Top 3 sur le premier set (pour UI)
    const topMvp = sorted.slice(0, 10);
    for (const p of topMvp) {
      const inFiltered = filtered.find((fp) => fp.playerId === p.playerId);
      if (inFiltered) {
        // Garder le mvpRank sur tous
      }
    }

    cache.set(cacheKey, filtered, 300); // 5min

    return NextResponse.json({
      players: filtered,
      mvpTop10: topMvp,
      totalPlayers: filtered.length,
      phase,
      source: "espn-fiba-aggregated",
    });
  } catch (err) {
    console.error("Error fetching FIBA players:", err);
    return NextResponse.json(
      { error: "Failed to fetch FIBA players", details: (err as Error).message },
      { status: 500 },
    );
  }
}
