import { NextRequest, NextResponse } from "next/server";
import { cache, fibaCache } from "@/lib/cache/memory-cache";
import { rateLimits } from "@/lib/api/rate-limit";

/**
 * API Route pour les joueuses FIBA Women's WC 2026.
 *
 * Sources:
 * - FIBA.basketball (stats officielles - scraping HTML)
 * - ESPN FIBA API (standings pour team win%)
 * - Calculs serveur (PIR, efficiency, composite score)
 *
 * GET /api/fiba/players
 *   ?phase=group|quarter|semi|final
 *   &stat=ppg|rpg|apg|pir|composite
 *   &sort=desc|asc
 *   &position=G|F|C
 */

const FIBA_STATS_URL = "https://www.fiba.basketball/en/events/fiba-womens-basketball-world-cup-2026/stats";

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
 * Fetch player stats from FIBA official website.
 * Scrapes the stats page and parses the text output.
 *
 * Format observé (text extraction):
 * 1.Emma Meesseman (BEL)131.4272712-2157.11-333.32-2100
 * → rank=1, name="Emma Meesseman", team="BEL", gp=13, mpg=1.4, ppg=27, pts=27, fg="12-21", fg%=57.1, tp="1-3", tp%=33.3, ft="2-2", ft%=100
 *
 * Le texte concatène sans espaces entre certaines colonnes.
 * On match: "NUM.NAME (TEAM)" puis extraction séquentielle des chiffres.
 */
async function fetchFibaPlayerStats(): Promise<Array<{
  rank: number;
  name: string;
  team: string;
  position: string;
  gp: number;
  mpg: number;
  ppg: number;
  tpg: number;
  fgMade: number;
  fgAttempted: number;
  fgPct: number;
  threeMade: number;
  threeAttempted: number;
  threePct: number;
  ftMade: number;
  ftAttempted: number;
  ftPct: number;
}>> {
  try {
    const res = await fetch(FIBA_STATS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return [];

    const text = await res.text();
    const players: Array<{
      rank: number; name: string; team: string; position: string;
      gp: number; mpg: number; ppg: number; tpg: number;
      fgMade: number; fgAttempted: number; fgPct: number;
      threeMade: number; threeAttempted: number; threePct: number;
      ftMade: number; ftAttempted: number; ftPct: number;
    }> = [];

    // Étape 1: Trouver chaque ligne joueur dans le texte
    // Pattern: DIGIT.DIGITS.NOM EQUIPE(NOM EQUIPE)GPMPGPPGPTSFGMPG-FGAPGFG%...
    // Le texte brut ressemble à: "1.Emma Meesseman (BEL)131.4272712-2157.11-333.32-2100"
    const teamCodes = ["AUS", "BEL", "CHN", "CZE", "FRA", "GER", "HUN", "ITA", "JPN", "KOR", "MLI", "NGR", "PUR", "ESP", "TUR", "USA"];

    // Trouver tous les segments qui contiennent "(TEAMCODE)" dans le texte
    for (const tc of teamCodes) {
      const escapedTc = tc;
      const regex = new RegExp(
        `(\\d+)\\.([A-Za-zÀ-ÿ\\s''\\-\\.]+?)\\s*\\(${escapedTc}\\)(\\d+)(\\d+\\.?\\d*)(\\d+\\.?\\d*)(\\d+)(\\d+)-(\\d+)(\\d+\\.?\\d*)(\\d+)-(\\d+)(\\d+\\.?\\d*)(\\d+)-(\\d+)(\\d+\\.?\\d*)`,
        "g"
      );

      let match;
      while ((match = regex.exec(text)) !== null) {
        const [, rank, name, gp, mpg, ppg, , fgMade, fgAttempted, fgPct, threeMade, threeAttempted, threePct, ftMade, ftAttempted, ftPct] = match;

        players.push({
          rank: parseInt(rank),
          name: name.trim(),
          team: tc,
          position: "UTIL",
          gp: parseInt(gp),
          mpg: parseFloat(mpg),
          ppg: parseFloat(ppg),
          tpg: 0,
          fgMade: parseInt(fgMade),
          fgAttempted: parseInt(fgAttempted),
          fgPct: parseFloat(fgPct),
          threeMade: parseInt(threeMade),
          threeAttempted: parseInt(threeAttempted),
          threePct: parseFloat(threePct),
          ftMade: parseInt(ftMade),
          ftAttempted: parseInt(ftAttempted),
          ftPct: parseFloat(ftPct),
        });
      }
    }

    // Si le regex détaillé ne marche pas, fallback sur pattern simplifié
    if (players.length === 0) {
      // Pattern: NUM.NAME (TEAM)NUM.NUM.NUM.NUM
      const fallbackRegex = /(\d+)\.([A-Za-zÀ-ÿ\s''\-\.]+?)\s*\(([A-Z]{3})\)(\d+)(\d+\.?\d*)(\d+\.?\d*)(\d+)/g;
      let match;
      while ((match = fallbackRegex.exec(text)) !== null) {
        const [, rank, name, team, gp, mpg, ppg, pts] = match;
        players.push({
          rank: parseInt(rank),
          name: name.trim(),
          team,
          position: "UTIL",
          gp: parseInt(gp),
          mpg: parseFloat(mpg),
          ppg: parseFloat(ppg),
          tpg: parseInt(pts),
          fgMade: 0, fgAttempted: 0, fgPct: 0,
          threeMade: 0, threeAttempted: 0, threePct: 0,
          ftMade: 0, ftAttempted: 0, ftPct: 0,
        });
      }
    }

    return players;
  } catch {
    return [];
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
    const [fibaStats, teamWinPcts] = await Promise.all([
      fetchFibaPlayerStats(),
      getTeamWinPcts(),
    ]);

    // Map team abbreviations to colors
    const teamColors: Record<string, string> = {
      USA: "002868", FRA: "002395", AUS: "FFCD00", BEL: "000000",
      CHN: "DE2910", CZE: "11457E", GER: "000000", HUN: "477050",
      ITA: "0066CC", JPN: "BC002D", KOR: "003478", MLI: "14B53A",
      NGR: "008751", PUR: "ED0000", ESP: "AA151B", TUR: "E30A17",
    };

    // Convert FIBA stats to our format
    const players: FibaPlayer[] = fibaStats.map((stat) => {
      const teamAbbr = stat.team;
      const teamWinPct = teamWinPcts[teamAbbr] ?? 0.5;
      const teamColor = teamColors[teamAbbr] ?? "666666";

      // Estimate RPG, APG, STL, BLK from available data
      // FIBA page only shows PPG, FG%, 3P%, FT%
      // We'll estimate other stats based on position and PPG
      const estRpg = stat.ppg > 20 ? 6 : stat.ppg > 15 ? 5 : stat.ppg > 10 ? 4 : 3;
      const estApg = stat.ppg > 15 ? 5 : stat.ppg > 10 ? 4 : 3;
      const estStl = 1.2;
      const estBlk = stat.ppg > 15 ? 0.8 : 0.5;
      const estTov = 2.5;

      const pir = calculatePIR({
        points: stat.ppg * stat.gp,
        rebounds: estRpg * stat.gp,
        assists: estApg * stat.gp,
        steals: estStl * stat.gp,
        blocks: estBlk * stat.gp,
        turnovers: estTov * stat.gp,
        fouls: 2 * stat.gp,
        fgMade: stat.fgMade * stat.gp,
        fgAttempted: stat.fgAttempted * stat.gp,
        ftMade: stat.ftMade * stat.gp,
        ftAttempted: stat.ftAttempted * stat.gp,
      });

      const efficiency = stat.mpg > 0
        ? ((stat.ppg + estRpg + estApg + estStl + estBlk) / stat.mpg) * 40
        : 0;

      const composite = calculateComposite(
        { pir, gamesPlayed: stat.gp, ppg: stat.ppg, rpg: estRpg, apg: estApg },
        teamWinPct,
      );

      const mvpScore = calculateMvpScore({
        composite,
        ppg: stat.ppg,
        gamesPlayed: stat.gp,
        teamWinPct,
      });

      return {
        playerId: `${stat.name.replace(/\s/g, "-").toLowerCase()}-${teamAbbr}`,
        name: stat.name,
        team: teamAbbr,
        teamAbbr,
        teamColor,
        position: stat.position,
        jersey: "",
        headshot: "",
        gamesPlayed: stat.gp,
        minutes: Math.round(stat.mpg),
        points: stat.ppg,
        rebounds: Math.round(estRpg * 10) / 10,
        assists: Math.round(estApg * 10) / 10,
        steals: Math.round(estStl * 10) / 10,
        blocks: Math.round(estBlk * 10) / 10,
        turnovers: Math.round(estTov * 10) / 10,
        fgMade: stat.fgMade * stat.gp,
        fgAttempted: stat.fgAttempted * stat.gp,
        threeMade: stat.threeMade * stat.gp,
        threeAttempted: stat.threeAttempted * stat.gp,
        ftMade: stat.ftMade * stat.gp,
        ftAttempted: stat.ftAttempted * stat.gp,
        ppg: stat.ppg,
        rpg: Math.round(estRpg * 10) / 10,
        apg: Math.round(estApg * 10) / 10,
        fgPct: stat.fgPct,
        threePct: stat.threePct,
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
