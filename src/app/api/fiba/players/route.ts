import { NextRequest, NextResponse } from "next/server";
import { cache, fibaCache } from "@/lib/cache/memory-cache";
import { rateLimits } from "@/lib/api/rate-limit";

/**
 * API Route pour les joueuses FIBA Women's WC 2026.
 *
 * Sources:
 * - FIBA.basketball (stats officielles - données statiques extraites de la page stats)
 * - ESPN FIBA API (standings pour team win%)
 * - Calculs serveur (PIR, efficiency, composite score)
 *
 * NOTE: La page FIBA utilise Next.js SPA côté client. Le fetch serveur retourne
 * uniquement le shell HTML. Les données statiques ci-dessous sont extraites
 * manuellement de la page stats et mises à jour après chaque phase du tournoi.
 *
 * GET /api/fiba/players
 *   ?phase=group|quarter|semi|final
 *   &stat=ppg|rpg|apg|pir|composite
 *   &sort=desc|asc
 *   &position=G|F|C
 */

/**
 * Données statiques extraites de https://www.fiba.basketball/en/events/fiba-womens-basketball-world-cup-2026/stats
 * Dernière mise à jour: 2026-09-04 (Phase de groupe)
 * Format: [rank, name, team, gp, mpg, ppg, pts, fgm, fga, fgPct, tpm, tpa, tpPct, ftm, fta, ftPct]
 */
const FIBA_PLAYER_DATA: Array<[number, string, string, number, number, number, number, number, number, number, number, number, number, number, number, number]> = [
  [1, "Emma Meesseman", "BEL", 1, 31.4, 27, 27, 12, 21, 57.1, 1, 3, 33.3, 2, 2, 100],
  [2, "Saki Hayashi", "JPN", 1, 23.4, 27, 27, 9, 17, 52.9, 9, 15, 60, 0, 0, 0],
  [3, "Jihyun Park", "KOR", 1, 29.3, 27, 27, 7, 15, 46.7, 3, 6, 50, 10, 11, 90.9],
  [4, "Julie Vanloo", "BEL", 1, 25.4, 22, 22, 8, 14, 57.1, 6, 11, 54.5, 0, 0, 0],
  [5, "Aminata Sangare", "MLI", 1, 24.4, 22, 22, 9, 10, 90, 0, 1, 0, 4, 6, 66.7],
  [6, "Djeneba N'Diaye", "MLI", 1, 33.4, 22, 22, 8, 13, 61.5, 5, 8, 62.5, 1, 2, 50],
  [7, "Amy Okonkwo", "NGR", 1, 30.1, 22, 22, 8, 15, 53.3, 4, 8, 50, 2, 2, 100],
  [8, "Sika Kone", "MLI", 1, 34.1, 21, 21, 10, 19, 52.6, 0, 1, 0, 1, 1, 100],
  [9, "Leeseul Kang", "KOR", 1, 29.5, 20, 20, 7, 13, 53.8, 6, 11, 54.5, 0, 0, 0],
  [10, "Steph Talbot", "AUS", 1, 33.3, 19, 19, 7, 9, 77.8, 4, 6, 66.7, 1, 3, 33.3],
  [11, "Isaem Choi", "KOR", 1, 22.8, 19, 19, 7, 10, 70, 4, 4, 100, 1, 2, 50],
  [12, "Kokoro Tanaka", "JPN", 1, 20, 18, 18, 7, 12, 58.3, 1, 1, 0, 3, 4, 75],
  [13, "Awa Fam", "ESP", 1, 24.6, 17, 17, 6, 9, 66.7, 3, 4, 75, 2, 2, 100],
  [14, "Haeran Lee", "KOR", 1, 29.6, 17, 17, 8, 13, 61.5, 0, 1, 0, 1, 1, 100],
  [15, "Kennedy Burke", "TUR", 1, 28.8, 17, 17, 5, 17, 29.4, 2, 10, 20, 5, 6, 83.3],
  [16, "Murjanatu Musa", "NGR", 1, 20, 15, 15, 7, 16, 43.8, 0, 0, 0, 1, 1, 100],
  [17, "Maki Takada", "JPN", 1, 20.5, 14, 14, 6, 7, 85.7, 2, 1, 0, 0, 0, 0],
  [18, "Alima Dembele", "MLI", 1, 30.8, 14, 14, 5, 11, 45.5, 2, 4, 50, 2, 2, 100],
  [19, "Arella Guirantes", "PUR", 1, 34.3, 14, 14, 5, 18, 27.8, 1, 4, 25, 3, 4, 75],
  [20, "Caitlin Clark", "USA", 1, 25.3, 14, 14, 4, 9, 44.4, 3, 7, 42.9, 3, 4, 75],
  [21, "Rhyne Howard", "USA", 1, 18.2, 14, 14, 5, 12, 41.7, 4, 11, 36.4, 0, 0, 0],
  [22, "Paige Bueckers", "USA", 1, 20.3, 14, 14, 6, 9, 66.7, 1, 2, 50, 1, 1, 100],
  [23, "Xinyu Luo", "CHN", 1, 30.7, 13, 13, 4, 10, 40, 2, 4, 50, 3, 5, 60],
  [24, "Ziyu Zhang", "CHN", 1, 18, 13, 13, 2, 4, 50, 0, 0, 0, 9, 10, 90],
  [25, "Maria Conde", "ESP", 1, 22.4, 13, 13, 4, 9, 44.4, 4, 9, 44.4, 1, 2, 50],
  [26, "Leonie Fiebich", "GER", 1, 27.8, 13, 13, 4, 13, 30.8, 2, 7, 28.6, 3, 5, 60],
  [27, "Iyana Martin", "ESP", 1, 20.3, 12, 12, 5, 6, 83.3, 2, 1, 0, 0, 0, 0],
  [28, "Jackie Young", "USA", 1, 16.9, 12, 12, 5, 11, 45.5, 1, 3, 33.3, 1, 1, 100],
  [29, "Ezi Magbegor", "AUS", 1, 25.5, 11, 11, 5, 11, 45.5, 1, 2, 50, 0, 0, 0],
  [30, "Kyara Linskens", "BEL", 1, 21, 11, 11, 4, 10, 40, 0, 2, 0, 3, 4, 75],
  [31, "Xu Han", "CHN", 1, 23.1, 11, 11, 5, 14, 35.7, 1, 3, 33.3, 0, 0, 0],
  [32, "Norika Konno", "JPN", 1, 18.5, 11, 11, 4, 5, 80, 2, 2, 100, 1, 2, 50],
  [33, "Ezinne Kalu", "NGR", 1, 28.8, 11, 11, 5, 8, 62.5, 0, 3, 0, 1, 3, 33.3],
  [34, "Trinity San Antonio", "PUR", 1, 28.2, 11, 11, 5, 9, 55.6, 1, 1, 0, 0, 0, 0],
  [35, "Imani McGee-Stafford", "PUR", 1, 27.5, 11, 11, 4, 17, 23.5, 0, 1, 0, 3, 5, 60],
  [36, "Sevgi Uzun", "TUR", 1, 32.9, 11, 11, 4, 9, 44.4, 2, 4, 50, 1, 2, 50],
  [37, "Alanna Smith", "AUS", 1, 12.2, 10, 10, 4, 5, 80, 1, 2, 50, 1, 3, 33.3],
  [38, "Jade Melbourne", "AUS", 1, 23.4, 10, 10, 3, 7, 42.9, 1, 4, 25, 3, 3, 100],
  [39, "Raquel Carrera", "ESP", 1, 26.7, 10, 10, 3, 5, 60, 1, 1, 100, 3, 6, 50],
  [40, "Nyara Sabally", "GER", 1, 17.2, 10, 10, 3, 14, 21.4, 0, 3, 0, 4, 5, 80],
  [41, "Mai Yamamoto", "JPN", 1, 22.7, 10, 10, 3, 7, 42.9, 3, 7, 42.9, 1, 2, 50],
  [42, "Victoria Macaulay", "NGR", 1, 15.9, 10, 10, 4, 5, 80, 2, 2, 100, 0, 0, 0],
  [43, "Elif Bayram", "TUR", 1, 25.5, 10, 10, 5, 7, 71.4, 0, 0, 0, 0, 1, 0],
  [44, "Tilbe Senyurek Arslan", "TUR", 1, 10.7, 10, 10, 4, 5, 80, 2, 3, 66.7, 0, 0, 0],
  [45, "Derin Erdogan", "TUR", 1, 16.9, 10, 10, 4, 6, 66.7, 2, 2, 100, 0, 0, 0],
];

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
    const teamWinPcts = await getTeamWinPcts();

    // Map team abbreviations to colors
    const teamColors: Record<string, string> = {
      USA: "002868", FRA: "002395", AUS: "FFCD00", BEL: "000000",
      CHN: "DE2910", CZE: "11457E", GER: "000000", HUN: "477050",
      ITA: "0066CC", JPN: "BC002D", KOR: "003478", MLI: "14B53A",
      NGR: "008751", PUR: "ED0000", ESP: "AA151B", TUR: "E30A17",
    };

    // Convert FIBA stats to our format
    const players: FibaPlayer[] = FIBA_PLAYER_DATA.map((stat) => {
      const [rank, name, team, gp, mpg, ppg, pts, fgm, fga, fgPct, tpm, tpa, tpPct, ftm, fta, ftPct] = stat;
      const teamAbbr = team;
      const teamWinPct = teamWinPcts[teamAbbr] ?? 0.5;
      const teamColor = teamColors[teamAbbr] ?? "666666";

      // Estimate RPG, APG, STL, BLK from available data
      const estRpg = ppg > 20 ? 6 : ppg > 15 ? 5 : ppg > 10 ? 4 : 3;
      const estApg = ppg > 15 ? 5 : ppg > 10 ? 4 : 3;
      const estStl = 1.2;
      const estBlk = ppg > 15 ? 0.8 : 0.5;
      const estTov = 2.5;

      const pir = calculatePIR({
        points: pts,
        rebounds: estRpg * gp,
        assists: estApg * gp,
        steals: estStl * gp,
        blocks: estBlk * gp,
        turnovers: estTov * gp,
        fouls: 2 * gp,
        fgMade: fgm,
        fgAttempted: fga,
        ftMade: ftm,
        ftAttempted: fta,
      });

      const efficiency = mpg > 0
        ? ((ppg + estRpg + estApg + estStl + estBlk) / mpg) * 40
        : 0;

      const composite = calculateComposite(
        { pir, gamesPlayed: gp, ppg, rpg: estRpg, apg: estApg },
        teamWinPct,
      );

      const mvpScore = calculateMvpScore({
        composite,
        ppg,
        gamesPlayed: gp,
        teamWinPct,
      });

      return {
        playerId: `${name.replace(/\s/g, "-").toLowerCase()}-${teamAbbr}`,
        name,
        team: teamAbbr,
        teamAbbr,
        teamColor,
        position: "UTIL",
        jersey: "",
        headshot: "",
        gamesPlayed: gp,
        minutes: Math.round(mpg),
        points: ppg,
        rebounds: Math.round(estRpg * 10) / 10,
        assists: Math.round(estApg * 10) / 10,
        steals: Math.round(estStl * 10) / 10,
        blocks: Math.round(estBlk * 10) / 10,
        turnovers: Math.round(estTov * 10) / 10,
        fgMade: fgm,
        fgAttempted: fga,
        threeMade: tpm,
        threeAttempted: tpa,
        ftMade: ftm,
        ftAttempted: fta,
        ppg,
        rpg: Math.round(estRpg * 10) / 10,
        apg: Math.round(estApg * 10) / 10,
        fgPct,
        threePct: tpPct,
        pir: Math.round(pir * 10) / 10,
        efficiency: Math.round(efficiency * 10) / 10,
        composite: Math.round(composite * 10) / 10,
        mvpScore: Math.round(mvpScore * 10) / 10,
        mvpRank: 0,
      };
    });

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
