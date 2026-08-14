import type { FootballMatch } from "@/lib/football-data";

/**
 * Correct Score (score exact) + Edge / Value — Phase 3 de la suite AI Pricing.
 *
 * Le score exact est dérivé d'une distribution de Poisson indépendante sur les
 * xG attendus (`prediction.xGa`). L'edge mesure l'écart entre la probabilité du
 * modèle et la probabilité implicite de la cote bookmaker :
 *   Edge = Proba Modèle − (1 / Cote)
 * Un edge positif signale de la valeur. Aucune donnée n'est inventée : si les
 * xG ou les cotes manquent, les helpers retournent `null`.
 */

/** Nombre max de buts modélisés par équipe (0..MAX_GOALS). */
const MAX_GOALS = 6;

export type CorrectScore = {
  home: number;
  away: number;
  /** Probabilité 0-100 du score exact. */
  prob: number;
};

/** e^-x — petit helper pour garder la lisibilité de la formule de Poisson. */
function expNeg(x: number): number {
  return Math.exp(-x);
}

/** Factielle mémoïsée (suffisant pour MAX_GOALS ≤ 6). */
const FACT: number[] = [1];
function factorial(n: number): number {
  while (FACT.length <= n) FACT.push(FACT[FACT.length - 1] * FACT.length);
  return FACT[n];
}

/** P(X = k) pour une loi de Poisson de paramètre lambda. */
function poisson(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (expNeg(lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * Matrice des probabilités de score exact (Poisson indépendante domicile/extérieur).
 * Retourne `null` si les xG attendus sont absents ou nuls.
 */
export function correctScoreMatrix(
  match: FootballMatch,
): { home: number; away: number; prob: number }[] | null {
  const xg = match.prediction.xGa;
  if (!xg || xg.home <= 0 || xg.away <= 0) return null;

  const cells: { home: number; away: number; prob: number }[] = [];
  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = poisson(xg.home, h) * poisson(xg.away, a);
      cells.push({ home: h, away: a, prob: p * 100 });
    }
  }
  return cells;
}

/** Score exact le plus probable + sa probabilité (null si pas de xG). */
export function mostLikelyScore(match: FootballMatch): CorrectScore | null {
  const cells = correctScoreMatrix(match);
  if (!cells || cells.length === 0) return null;
  let best = cells[0];
  for (const c of cells) if (c.prob > best.prob) best = c;
  return { home: best.home, away: best.away, prob: best.prob };
}

// ---------------------------------------------------------------------------
// Edge / Value
// ---------------------------------------------------------------------------

export type MarketEdge = {
  /** Libellé du marché (ex: "1", "X", "2", "BTTS"). */
  market: string;
  /** Probabilité modèle 0-100. */
  modelProb: number;
  /** Probabilité implicite de la cote 0-100 (null si pas de cote). */
  impliedProb: number | null;
  /** Edge en points de % (positif = valeur). Null si pas de cote. */
  edge: number | null;
};

/** Edge d'un résultat 1X2 à partir de la cote bookmaker. */
function edge1x2(modelProb: number, odds: number | undefined): MarketEdge {
  const implied = odds && odds > 1 ? (1 / odds) * 100 : null;
  return {
    market: "",
    modelProb,
    impliedProb: implied,
    edge: implied != null ? modelProb - implied : null,
  };
}

/**
 * Tous les edges calculables d'un match (1X2 + BTTS si cote dispo).
 * Le BTTS n'a pas de cote dédiée dans `match.odds` → edge null (on n'invente pas).
 */
export function computeMatchEdges(match: FootballMatch): MarketEdge[] {
  const p = match.prediction;
  const odds = match.odds;
  const edges: MarketEdge[] = [];

  const home = edge1x2(p.homeProb, odds?.home);
  home.market = "1";
  edges.push(home);

  const draw = edge1x2(p.drawProb, odds?.draw);
  draw.market = "X";
  edges.push(draw);

  const away = edge1x2(p.awayProb, odds?.away);
  away.market = "2";
  edges.push(away);

  // BTTS : proba modèle présente, mais pas de cote bookmaker → edge null.
  edges.push({
    market: "BTTS",
    modelProb: p.bttsProb,
    impliedProb: null,
    edge: null,
  });

  return edges;
}

/**
 * Meilleur edge d'un match (max des edges calculables). Retourne `null` si aucune
 * cote n'est disponible (aucun edge calculable). Utilisé pour le tri « par value ».
 */
export function bestMatchEdge(match: FootballMatch): number | null {
  const edges = computeMatchEdges(match).filter((e) => e.edge != null);
  if (edges.length === 0) return null;
  return Math.max(...edges.map((e) => e.edge as number));
}

/** Libellé du marché portant le meilleur edge (ex: "1", "2"). Null si aucun. */
export function bestEdgeMarket(match: FootballMatch): MarketEdge | null {
  const edges = computeMatchEdges(match).filter((e) => e.edge != null);
  if (edges.length === 0) return null;
  return edges.reduce((a, b) => ((a.edge as number) >= (b.edge as number) ? a : b));
}
