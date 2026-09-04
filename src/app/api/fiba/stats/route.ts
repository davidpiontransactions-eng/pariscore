import { NextResponse } from "next/server";
import { scrapeAllTeamStats } from "@/lib/scraping/fiba-stats-scraper";
import { cache, fibaCache } from "@/lib/cache/memory-cache";

/**
 * API Route pour les stats FIBA Women's WC 2026.
 * 
 * Sources:
 * - Basketball Reference (stats historiques)
 * - ESPN FIBA (stats en direct)
 * - FIBA.basketball (rankings + stats officielles)
 * 
 * Note: En production, ces données seraient collectées via un scraper cron
 * et stockées en base (Prisma). Pour l'instant, on utilise un scraper simulé.
 */

export type FibaTeamStats = {
  teamId: string;
  teamName: string;
  abbr: string;
  
  // Four Factors
  eFG: number;        // Effective Field Goal %
  TOV: number;        // Turnover Rate
  ORB: number;        // Offensive Rebound Rate
  FT: number;         // Free Throw Rate
  
  // Ratings
  ORtg: number;       // Offensive Rating (points per 100 possessions)
  DRtg: number;       // Defensive Rating
  pace: number;       // Possessions per 40 min
  
  // Stats avancées
  trueShooting: number;
  assistTurnoverRatio: number;
  benchPoints: number;
  pointsInPaint: number;
  fastBreakPoints: number;
  
  // Stats de base
  ppg: number;        // Points per game
  rpg: number;        // Rebounds per game
  apg: number;        // Assists per game
  spg: number;        // Steals per game
  bpg: number;        // Blocks per game
  
  // Win/Loss
  wins: number;
  losses: number;
  winPct: number;
  
  // Dernière mise à jour
  lastUpdated: string;
};

/** GET /api/fiba/stats — Retourne les stats de toutes les équipes ou d'une équipe spécifique */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team");

  const cacheConfig = fibaCache.stats(team ?? undefined);
  const cached = cache.get(cacheConfig.key);
  
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    // Utiliser le scraper pour récupérer les stats
    const allStats = await scrapeAllTeamStats();
    
    let data;
    if (team) {
      const teamStats = allStats.find((s) => s.abbr === team.toUpperCase());
      if (!teamStats) {
        return NextResponse.json(
          { error: `Stats not found for team: ${team}` },
          { status: 404 },
        );
      }
      data = { team: teamStats, source: "fiba-stats-scraper" };
    } else {
      data = {
        teams: allStats,
        source: "fiba-stats-scraper",
        lastUpdated: new Date().toISOString(),
      };
    }

    cache.set(cacheConfig.key, data, cacheConfig.ttl);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching FIBA stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch FIBA stats" },
      { status: 500 },
    );
  }
}
