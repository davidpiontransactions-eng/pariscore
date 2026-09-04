import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { computeMatchScore } from "@/lib/match-score";
import type { MatchScoreInput } from "@/lib/match-score";

/**
 * GET /api/tennis/top-matches
 *
 * Retourne les meilleurs matchs du jour avec score composite 0-10.
 *
 * Query params:
 *   - timeframe: "today" (defaut) | "week"
 *   - limit: number (defaut 10, max 20)
 *   - minScore: number (defaut 0, max 10)
 *
 * Reponse :
 *   {
 *     matches: Array<{
 *       id, playerA, playerB, tournament, round, scheduledAt,
 *       probA, probB, odds, matchScore
 *     }>,
 *     count: number,
 *     timeframe: string,
 *     minScore: number
 *   }
 */

interface TopMatchResponse {
  id: string;
  playerA: { name: string; shortName: string; rank: number; elo: number; country?: string };
  playerB: { name: string; shortName: string; rank: number; elo: number; country?: string };
  tournament: string;
  round: string;
  scheduledAt: string;
  probA: number;
  probB: number;
  odds?: { bookmaker: string; decimalA: number; decimalB: number };
  matchScore: {
    score: number;
    label: string;
    labelColor: string;
    labelBg: string;
    breakdown: Record<string, number>;
  };
}

/**
 * Transforme un match du prematch en input pour le scoring engine.
 */
function toScoreInput(match: Record<string, unknown>): MatchScoreInput | null {
  try {
    const playerA = match.playerA as Record<string, unknown>;
    const playerB = match.playerB as Record<string, unknown>;

    if (!playerA || !playerB) return null;

    return {
      probA: (match.probA as number) ?? 50,
      eloA: (playerA.elo as number) ?? 1500,
      eloB: (playerB.elo as number) ?? 1500,
      rankA: (playerA.rank as number) ?? 999,
      rankB: (playerB.rank as number) ?? 999,
      formA: (playerA.form as ("W" | "L")[]) ?? null,
      formB: (playerB.form as ("W" | "L")[]) ?? null,
      tournament: (match.tournament as string) ?? "Autres",
      round: (match.round as string) ?? "",
      h2hHistory: (match.h2hHistory as Array<{ winnerId: string }>) ?? undefined,
      playerAId: playerA.id as string,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") ?? "today";
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
    const minScore = Math.max(0, Math.min(10, parseFloat(searchParams.get("minScore") ?? "0")));

    // Import dynamique du module prematch (cache partage)
    const { MATCHES } = await import("@/lib/tennis-data");

    // Filtrer par timeframe
    const now = Date.now();
    let matches = MATCHES;

    if (timeframe === "today") {
      // Aujourd'hui : 24h a venir
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      matches = matches.filter((m) => {
        const t = new Date(m.scheduledAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
    }
    // "week" = tous les matchs (pas de filtre temporel)

    // Calculer le score pour chaque match
    const scored: TopMatchResponse[] = [];
    for (const match of matches) {
      const input = toScoreInput(match as Record<string, unknown>);
      if (!input) continue;

      const result = computeMatchScore(input);
      if (result.score < minScore) continue;

      scored.push({
        id: match.id,
        playerA: {
          name: match.playerA.name,
          shortName: match.playerA.shortName,
          rank: match.playerA.rank,
          elo: match.playerA.elo,
          country: match.playerA.country,
        },
        playerB: {
          name: match.playerB.name,
          shortName: match.playerB.shortName,
          rank: match.playerB.rank,
          elo: match.playerB.elo,
          country: match.playerB.country,
        },
        tournament: match.tournament,
        round: match.round,
        scheduledAt: match.scheduledAt,
        probA: match.probA,
        probB: match.probB,
        odds: match.odds,
        matchScore: {
          score: result.score,
          label: result.label,
          labelColor: result.labelColor,
          labelBg: result.labelBg,
          breakdown: result.breakdown as unknown as Record<string, number>,
        },
      });
    }

    // Trier par score descendant et limiter
    scored.sort((a, b) => b.matchScore.score - a.matchScore.score);
    const top = scored.slice(0, limit);

    return NextResponse.json({
      matches: top,
      count: top.length,
      timeframe,
      minScore,
      totalAvailable: scored.length,
    });
  } catch (err) {
    return apiErrorHandler(err, "tennis/top-matches");
  }
}
