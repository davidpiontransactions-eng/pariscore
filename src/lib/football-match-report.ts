import type { FootballMatch } from "@/lib/football-data";

/**
 * Rapport de match IA — Phase 2 de la suite AI Pricing.
 *
 * Le rapport est généré par Gemini à partir d'un payload structuré construit
 * depuis le modèle PariScore (prédictions, classement, forme, xG, cotes). Il
 * produit une synthèse narrative, 3 faits marquants et une suggestion de combiné.
 */

export type AIPredictiveBet = {
  /** Label du pari (ex: "Double Chance 1X", "Over 2.5 Buts"). */
  label: string;
  /** Probabilité estimée par l'IA [0-100]. */
  prob: number;
  /** Cote décimale indicative (null si non estimable). */
  odds: number | null;
  /** Niveau de confiance du pari [1-5]. */
  confidence: number;
  /** Rationale courte (1 phrase). */
  rationale: string;
};

export type FootballAIReport = {
  /** Synthèse narrative (2-3 phrases) sur la physionomie attendue du match. */
  synthesis: string;
  /** 3 faits statistiques marquants. */
  keyFacts: string[];
  /** 3 paris prédictifs générés par l'IA. */
  predictiveBets: AIPredictiveBet[];
  /** Suggestion de combiné (null si aucun ne se détache). */
  combo: { label: string; rationale: string } | null;
  /** Confiance 1-5. */
  confidence: number;
};

/** Construit le payload structuré envoyé à Gemini (compact, sans données sensibles). */
export function buildReportPayload(match: FootballMatch): Record<string, unknown> {
  const p = match.prediction;
  const st = p.standingStats;
  return {
    match: `${match.home.name} vs ${match.away.name}`,
    league: match.league.name,
    round: match.round,
    probabilities: {
      home: p.homeProb,
      draw: p.drawProb,
      away: p.awayProb,
      btts: p.bttsProb,
      over25: p.over25Prob,
      over15: p.over15Prob ?? null,
      under35: p.under35Prob ?? null,
      doubleChance: p.doubleChance ?? null,
    },
    xG: p.xGa ?? null,
    form: { home: match.home.form, away: match.away.form },
    standings: st
      ? {
          home: { ppg: st.home.ppg, rank: st.home.rank, played: st.home.played, goalDiff: st.home.goalDiff },
          away: { ppg: st.away.ppg, rank: st.away.rank, played: st.away.played, goalDiff: st.away.goalDiff },
        }
      : null,
    momentum: p.formMomentum ?? null,
    odds: match.odds ?? null,
  };
}
