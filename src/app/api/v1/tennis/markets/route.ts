import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TENNIS_MARKETS, MARKET_COUNT, getMarketById, getMarketsByCategory } from "@/lib/prediction/tennis-market-map";
import { gameWinProb, setWinProb, setScoreExact, setHandicap, gameHandicap, doubleResult, firstSetWinner, firstSetTotal, clearAllMemos } from "@/lib/prediction/live-markov";
import { totalAcesO_U, acesPerSet } from "@/lib/prediction/most-aces";
import { tiebreakProb, tiebreakSet, tiebreakWinner } from "@/lib/prediction/tiebreak";
import { playerTotalGames, totalSets, straightSets, atLeastOneSet, probOver } from "@/lib/prediction/total-games";
import { bayesianBlend, oddToProb, deVig, computeEdge, kellyFraction } from "@/lib/prediction/live-blend";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const QuerySchema = z.object({
  pServeA: z.coerce.number().min(0.4).max(0.85).optional(),
  pServeB: z.coerce.number().min(0.4).max(0.85).optional(),
  surface: z.enum(["Hard", "Clay", "Grass"]).optional().default("Hard"),
  bestOf: z.coerce.number().refine(v => v === 3 || v === 5).optional().default(3),
  category: z.string().optional(),
  marketId: z.string().optional(),
  liveProgress: z.coerce.number().min(0).max(1).optional(),
  marketProbA: z.coerce.number().min(0).max(1).optional(),
  oddsA: z.coerce.number().min(1).optional(),
  oddsB: z.coerce.number().min(1).optional(),
  minProb: z.coerce.number().min(0).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MarketResult = {
  id: string;
  label: string;
  category: string;
  probA: number;
  probB: number;
  edge?: number;
  kelly?: number;
  recommended: boolean;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/tennis/markets
 *
 * Calcule les probabilités pour tous les marchés tennis supportés.
 *
 * Paramètres :
 *   - pServeA/pServeB : probabilités de gain de point au service [0.4-0.85]
 *   - surface : Hard/Clay/Grass (défaut Hard)
 *   - bestOf : 3 ou 5 (défaut 3)
 *   - category : filtre par catégorie
 *   - marketId : retourne un seul marché
 *   - liveProgress : progression du match [0-1] pour blend bayésien
 *   - marketProbA : probabilité implicite marché pour calcul edge/kelly
 *   - oddsA/oddsB : cotes décimales pour calcul kelly
 *   - minProb : seuil minimum de probabilité pour filtrer les résultats
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Validation
  const parsed = QuerySchema.safeParse({
    pServeA: url.searchParams.get("pServeA"),
    pServeB: url.searchParams.get("pServeB"),
    surface: url.searchParams.get("surface"),
    bestOf: url.searchParams.get("bestOf"),
    category: url.searchParams.get("category"),
    marketId: url.searchParams.get("marketId"),
    liveProgress: url.searchParams.get("liveProgress"),
    marketProbA: url.searchParams.get("marketProbA"),
    oddsA: url.searchParams.get("oddsA"),
    oddsB: url.searchParams.get("oddsB"),
    minProb: url.searchParams.get("minProb"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = parsed.data;

  // Valeurs par défaut (moyennes ATP)
  const pServeA = params.pServeA ?? 0.64;
  const pServeB = params.pServeB ?? 0.64;
  const surface = params.surface;
  const bestOf = params.bestOf as 3 | 5;

  // Calculer les holds
  clearAllMemos();
  const holdA = gameWinProb(pServeA);
  const holdB = gameWinProb(pServeB);

  // P(A gagne un set) via Markov
  clearAllMemos();
  const pWinSetA = setWinProb(holdA, holdB, 0, 0, 1, 0, 0, "A");

  // Calculer tous les marchés
  const results: MarketResult[] = [];

  // Helper : ajouter un marché
  function addMarket(
    id: string,
    label: string,
    category: string,
    probA: number,
    probB: number,
    opts?: { liveOnly?: boolean; prematchOnly?: boolean },
  ) {
    // Filtrer par catégorie si demandé
    if (params.category && category !== params.category) return;
    // Filtrer par marketId si demandé
    if (params.marketId && id !== params.marketId) return;
    // Filtrer par minProb
    if (params.minProb) {
      const maxProb = Math.max(probA, probB) * 100;
      if (maxProb < params.minProb) return;
    }

    // Edge et Kelly si marché fourni
    let edge: number | undefined;
    let kelly: number | undefined;
    if (params.marketProbA !== undefined) {
      edge = computeEdge(probA, params.marketProbA);
    }
    if (params.oddsA !== undefined && params.marketProbA === undefined) {
      // Calculer kelly directement depuis les cotes
      kelly = kellyFraction(probA, params.oddsA);
    }

    // Reco : proba la plus proche de 60%
    const maxProb = Math.max(probA, probB);
    const recommended = Math.abs(maxProb * 100 - 60) < 10;

    results.push({
      id,
      label,
      category,
      probA: Math.round(probA * 10000) / 100,
      probB: Math.round(probB * 10000) / 100,
      edge: edge !== undefined ? Math.round(edge * 100) / 100 : undefined,
      kelly: kelly !== undefined ? Math.round(kelly * 10000) / 100 : undefined,
      recommended,
    });
  }

  // --- Match Winner ---
  clearAllMemos();
  addMarket("match-winner", "Vainqueur du match", "match-winner", pWinSetA, 1 - pWinSetA);

  // --- Set Score ---
  clearAllMemos();
  addMarket("correct-score-2-0", "Score exact 2-0", "set-score", setScoreExact(holdA, holdB, 2, 0, bestOf === 3), 0);
  clearAllMemos();
  addMarket("correct-score-2-1", "Score exact 2-1", "set-score", setScoreExact(holdA, holdB, 2, 1, bestOf === 3), 0);
  clearAllMemos();
  addMarket("correct-score-0-2", "Score exact 0-2", "set-score", 0, setScoreExact(holdA, holdB, 0, 2, bestOf === 3));
  clearAllMemos();
  addMarket("correct-score-1-2", "Score exact 1-2", "set-score", 0, setScoreExact(holdA, holdB, 1, 2, bestOf === 3));

  // --- Set Handicap ---
  clearAllMemos();
  addMarket("set-handicap-1.5", "Handicap sets -1.5", "set-handicap", setHandicap(holdA, holdB, -1.5, bestOf === 3), 0);
  clearAllMemos();
  addMarket("set-handicap+1.5", "Handicap sets +1.5", "set-handicap", setHandicap(holdA, holdB, 1.5, bestOf === 3), 0);

  // --- Game Handicap ---
  clearAllMemos();
  const gh = gameHandicap(holdA, holdB, pWinSetA, bestOf === 3);
  addMarket("game-handicap-2.5", "Handicap jeux -2.5", "game-handicap", gh < -2.5 ? 0.6 : 0.4, gh < -2.5 ? 0.4 : 0.6);
  addMarket("game-handicap+2.5", "Handicap jeux +2.5", "game-handicap", gh > 2.5 ? 0.6 : 0.4, gh > 2.5 ? 0.4 : 0.6);
  addMarket("game-handicap-4.5", "Handicap jeux -4.5", "game-handicap", gh < -4.5 ? 0.6 : 0.4, gh < -4.5 ? 0.4 : 0.6);
  addMarket("game-handicap+4.5", "Handicap jeux +4.5", "game-handicap", gh > 4.5 ? 0.6 : 0.4, gh > 4.5 ? 0.4 : 0.6);

  // --- Total Games ---
  clearAllMemos();
  const lambda = 9.5 * (bestOf === 3 ? 2.1 : 4.0);
  for (const threshold of [18.5, 19.5, 20.5, 21.5, 22.5, 23.5]) {
    const overProb = probOver(threshold, lambda);
    addMarket(`total-over-${threshold}`, `Total Over ${threshold}`, "total-games", overProb, 1 - overProb);
    addMarket(`total-under-${threshold}`, `Total Under ${threshold}`, "total-games", 1 - overProb, overProb);
  }

  // --- Player Total Games ---
  clearAllMemos();
  const ptg = playerTotalGames(holdA, holdB, pWinSetA, bestOf);
  addMarket("player-a-over-12.5", "A Over 12.5 jeux", "total-games", ptg.gamesA > 12.5 ? 0.6 : 0.4, ptg.gamesA > 12.5 ? 0.4 : 0.6);
  addMarket("player-b-over-12.5", "B Over 12.5 jeux", "total-games", ptg.gamesB > 12.5 ? 0.4 : 0.6, ptg.gamesB > 12.5 ? 0.6 : 0.4);

  // --- Total Sets ---
  clearAllMemos();
  const ts = totalSets(pWinSetA, bestOf);
  addMarket("total-sets-2", "Total sets = 2", "total-games", ts < 2.5 ? 0.65 : 0.35, ts < 2.5 ? 0.35 : 0.65);
  addMarket("total-sets-3", "Total sets = 3", "total-games", ts > 2.5 ? 0.60 : 0.40, ts > 2.5 ? 0.40 : 0.60);

  // --- Straight Sets ---
  clearAllMemos();
  const ss = straightSets(pWinSetA, bestOf);
  addMarket("straight-sets-a", "A gagne en sets directs", "set-score", ss.aWins, 0);
  addMarket("straight-sets-b", "B gagne en sets directs", "set-score", 0, ss.bWins);

  // --- At Least One Set ---
  clearAllMemos();
  const als = atLeastOneSet(pWinSetA, bestOf);
  addMarket("at-least-one-set-a", "A gagne ≥1 set", "set-score", als.aWinsAtLeast1, 1 - als.aWinsAtLeast1);
  addMarket("at-least-one-set-b", "B gagne ≥1 set", "set-score", als.bWinsAtLeast1, 1 - als.bWinsAtLeast1);

  // --- Aces ---
  const lambdaA = 4.0; // défaut surface
  const lambdaB = 4.0;
  for (const threshold of [9.5, 12.5, 15.5]) {
    const overProb = totalAcesO_U(threshold, lambdaA, lambdaB);
    addMarket(`aces-over-${threshold}`, `Total aces Over ${threshold}`, "aces", overProb, 1 - overProb);
    addMarket(`aces-under-${threshold}`, `Total aces Under ${threshold}`, "aces", 1 - overProb, overProb);
  }

  // --- Tiebreak ---
  clearAllMemos();
  const pTB = tiebreakSet(holdA, holdB);
  addMarket("tiebreak-yes", "Tiebreak dans le match", "tiebreak", pTB, 1 - pTB);
  clearAllMemos();
  const pTBWinner = tiebreakWinner(holdA, holdB);
  addMarket("first-set-tiebreak", "Tiebreak au 1er set", "tiebreak", pTB, 1 - pTB);

  // --- First Set ---
  clearAllMemos();
  const pFirstSet = firstSetWinner(holdA, holdB);
  addMarket("first-set-winner-a", "1er set : A", "first-set", pFirstSet, 1 - pFirstSet);
  addMarket("first-set-winner-b", "1er set : B", "first-set", 1 - pFirstSet, pFirstSet);

  // --- First Set Total Games ---
  clearAllMemos();
  const fst = firstSetTotal(holdA, holdB);
  addMarket("first-set-over-9.5", "1er set Over 9.5", "first-set", fst > 9.5 ? 0.6 : 0.4, fst > 9.5 ? 0.4 : 0.6);
  addMarket("first-set-under-9.5", "1er set Under 9.5", "first-set", fst < 9.5 ? 0.6 : 0.4, fst < 9.5 ? 0.4 : 0.6);

  // --- Double Result ---
  clearAllMemos();
  const dr = doubleResult(holdA, holdB, bestOf === 3);
  addMarket("double-a-a", "A gagne 1er set + match", "double-result", dr.aWins1stAndMatch, dr.bWins1stAndMatch);
  addMarket("double-b-b", "B gagne 1er set + match", "double-result", dr.bWins1stAndMatch, dr.aWins1stAndMatch);
  addMarket("double-a-b", "A 1er set, B match", "double-result", dr.aWins1stLosesMatch, dr.bWins1stLosesMatch);
  addMarket("double-b-a", "B 1er set, A match", "double-result", dr.bWins1stLosesMatch, dr.aWins1stLosesMatch);

  // --- Live blend si progression fournie ---
  if (params.liveProgress !== undefined && params.marketProbA !== undefined) {
    const blended = bayesianBlend({
      matchProgress: params.liveProgress,
      modelProb: pWinSetA,
      modelConfidence: 0.8,
      marketProb: params.marketProbA,
      marketConfidence: 0.9,
    });
    addMarket("live-match-winner", "Vainqueur (live)", "live", blended.prob, 1 - blended.prob);
  }

  // Filtrer par marketId spécifique
  if (params.marketId) {
    const found = results.find(r => r.id === params.marketId);
    if (!found) {
      return NextResponse.json(
        { error: `Marché '${params.marketId}' non trouvé` },
        { status: 404 },
      );
    }
    return NextResponse.json({ market: found, totalMarkets: MARKET_COUNT });
  }

  return NextResponse.json({
    markets: results,
    totalMarkets: MARKET_COUNT,
    computedMarkets: results.length,
    params: { pServeA, pServeB, surface, bestOf },
  });
}
