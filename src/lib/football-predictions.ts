import type { Prediction } from "@/lib/football-data";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convertit une cote décimale en probabilité implicite brute (0-100).
 * Retourne 0 si la cote est absente ou invalide.
 */
function impliedProb(odds: number | null | undefined): number {
  if (odds == null || odds <= 0 || !Number.isFinite(odds)) return 0;
  return (1 / odds) * 100;
}

/**
 * Normalise deux probabilités implicites (over/under) pour retirer la marge
 * du bookmaker. Retourne la probabilité normalisée du premier côté dans [0, 100].
 */
function normalizePair(impA: number, impB: number): number {
  const total = impA + impB;
  if (total <= 0 || !Number.isFinite(total)) return 0;
  const normalized = (impA / total) * 100;
  return Math.min(100, Math.max(0, normalized));
}

/**
 * Approximation de Poisson : P(X > k) = 1 - P(X ≤ k).
 * Retourne une probabilité 0-100.
 */
function poissonOver(k: number, lambda: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda)) return 0;
  if (k < 0) return lambda > 0 ? 100 : 0;

  let cdf = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) {
    cdf += term;
    term *= lambda / (i + 1);
    if (term < 1e-15 || !Number.isFinite(term)) break;
  }

  const result = (1 - cdf) * 100;
  return Math.min(100, Math.max(0, result));
}

/** Borne une valeur entre min et max (inclus). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─── Fonctions exportées ────────────────────────────────────────────────────

/**
 * Calcule la meilleure option double chance (1X, X2, 12).
 * Retourne la sélection ayant la probabilité la plus élevée.
 */
export function computeDoubleChance(
  homeProb: number,
  drawProb: number,
  awayProb: number,
): { selection: "1X" | "X2" | "12"; prob: number } {
  const p1x = homeProb + drawProb;
  const px2 = drawProb + awayProb;
  const p12 = homeProb + awayProb;

  if (p1x >= px2 && p1x >= p12) return { selection: "1X", prob: Math.round(p1x * 100) / 100 };
  if (px2 >= p12) return { selection: "X2", prob: Math.round(px2 * 100) / 100 };
  return { selection: "12", prob: Math.round(p12 * 100) / 100 };
}

/**
 * Calcule P(buts ≥ 2) — au moins 2 buts dans le match.
 *
 * Si les cotes over/under 1.5 BSD sont disponibles, normalise les probabilités
 * implicites pour retirer la marge. Sinon, utilise une heuristique simple :
 * over25Prob + 15 (plafonné à 98), car le seuil plus bas est forcément plus
 * probable.
 */
export function computeOver15(
  oddsOver15?: number | null,
  oddsUnder15?: number | null,
  over25Prob?: number,
): number {
  if (oddsOver15 != null && oddsUnder15 != null && oddsOver15 > 0 && oddsUnder15 > 0) {
    const impOver = impliedProb(oddsOver15);
    const impUnder = impliedProb(oddsUnder15);
    const prob = normalizePair(impOver, impUnder);
    if (prob > 0) return Math.round(prob * 100) / 100;
  }

  const base = over25Prob ?? 50;
  return Math.min(98, Math.round((base + 15) * 100) / 100);
}

/**
 * Calcule P(buts ≤ 3) — 3 buts ou moins dans le match.
 *
 * Si la cote under 2.5 BSD est disponible, l'utilise comme base et ajoute
 * une marge (~12 points) car under 3.5 est toujours plus probable que under 2.5.
 * Sinon, utilise la valeur du modèle si fournie.
 */
export function computeUnder35(
  oddsUnder25?: number | null,
  under35ProbFromModel?: number,
): number {
  if (oddsUnder25 != null && oddsUnder25 > 0) {
    const baseUnder25 = impliedProb(oddsUnder25);
    if (baseUnder25 > 0) {
      return Math.min(98, Math.round((baseUnder25 + 12) * 100) / 100);
    }
  }

  if (under35ProbFromModel != null && under35ProbFromModel > 0) {
    return Math.min(98, Math.round(under35ProbFromModel * 100) / 100);
  }

  return 0;
}

/**
 * Calcule la meilleure ligne de corners over avec une probabilité ≥ 65%.
 *
 * Pour chaque ligne candidate (7.5 → 11.5), estime le total de corners attendu
 * via une approximation de Poisson et retient la ligne dont P(over) est
 * la plus proche de 65% sans passer en dessous. Si aucune ligne n'atteint 65%,
 * retourne celle avec la probabilité la plus élevée.
 */
export function computeCornerOver(
  homeCornersAvg: number,
  awayCornersAvg: number,
  leagueAvgCorners: number,
): { line: number; overProb: number } {
  const totalCorners = (homeCornersAvg || leagueAvgCorners * 0.55) +
    (awayCornersAvg || leagueAvgCorners * 0.45);

  const lambda = totalCorners > 0 ? totalCorners : 10;

  const lines = [7.5, 8.5, 9.5, 10.5, 11.5];
  const candidates: { line: number; overProb: number }[] = lines.map((line) => {
    const k = Math.floor(line);
    const overProb = Math.round(poissonOver(k, lambda) * 100) / 100;
    return { line, overProb };
  });

  // Chercher la ligne ≥ 65% la plus proche de 65%
  let bestAbove: { line: number; overProb: number } | null = null;
  for (const c of candidates) {
    if (c.overProb >= 65) {
      if (!bestAbove || c.overProb < bestAbove.overProb) {
        bestAbove = c;
      }
    }
  }

  if (bestAbove) return bestAbove;

  return candidates.reduce((best, c) => (c.overProb > best.overProb ? c : best));
}

type LiveStatsTeam = NonNullable<BSDFootballMatch["live_stats"]>["home"];

/**
 * Construit les barres de comparaison des deux équipes à partir des
 * statistiques live BSD (corners, tirs cadrés, cartons jaunes, fautes).
 *
 * Pour chaque catégorie : homeProb = home / (home + away), borné [30, 70].
 * Par défaut (absence de données) : 55/45 en faveur du domicile.
 * Labels en français.
 */
export function computeTeamComparisons(
  homeLiveStats?: LiveStatsTeam | null,
  awayLiveStats?: LiveStatsTeam | null,
): { label: string; homeProb: number; awayProb: number }[] {
  type StatKey = Exclude<keyof NonNullable<LiveStatsTeam>, undefined>;

  const categories: { label: string; key: StatKey }[] = [
    { label: "Corners", key: "corner_kicks" },
    { label: "Tirs cadrés", key: "shots_on_target" },
    { label: "Cartons", key: "yellow_cards" },
    { label: "Fautes", key: "fouls" },
  ];

  return categories.map(({ label, key }) => {
    const homeVal = homeLiveStats?.[key] as number | undefined;
    const awayVal = awayLiveStats?.[key] as number | undefined;

    if (
      homeVal != null && awayVal != null &&
      Number.isFinite(homeVal) && Number.isFinite(awayVal) &&
      homeVal + awayVal > 0
    ) {
      const rawHomeProb = (homeVal / (homeVal + awayVal)) * 100;
      const homeProb = clamp(Math.round(rawHomeProb * 100) / 100, 30, 70);
      return { label, homeProb, awayProb: Math.round((100 - homeProb) * 100) / 100 };
    }

    return { label, homeProb: 55, awayProb: 45 };
  });
}

// ─── Point d'entrée principal ───────────────────────────────────────────────

/** Constante de fallback : moyenne de corners par match dans les 5 grands championnats. */
const LEAGUE_AVG_CORNERS = 10;

/**
 * Enrichit une prédiction existante avec les métriques calculées à partir
 * des données brutes BSD.
 *
 * Ajoute : doubleChance, over15Prob, under35Prob, bestCornerOver, teamComparisons.
 * Fonction pure — pas d'effets de bord, pas d'appels réseau.
 */
export function enrichPrediction(
  prediction: Prediction,
  bsdMatch: BSDFootballMatch,
): Prediction {
  const enriched: Prediction = { ...prediction };

  // Double chance
  enriched.doubleChance = computeDoubleChance(
    prediction.homeProb,
    prediction.drawProb,
    prediction.awayProb,
  );

  // Over 1.5
  enriched.over15Prob = computeOver15(
    bsdMatch.odds_over_15,
    bsdMatch.odds_under_15,
    prediction.over25Prob,
  );

  // Under 3.5
  enriched.under35Prob = computeUnder35(
    bsdMatch.odds_under_25,
    undefined,
  );

  // Corner over — utilise les corners live comme proxy si disponible,
  // sinon fallback sur la moyenne de ligue avec avantage domicile 55/45.
  const homeCorners = bsdMatch.live_stats?.home?.corner_kicks;
  const awayCorners = bsdMatch.live_stats?.away?.corner_kicks;
  enriched.bestCornerOver = computeCornerOver(
    homeCorners ?? 0,
    awayCorners ?? 0,
    LEAGUE_AVG_CORNERS,
  );

  // Comparaisons d'équipe (stats live)
  enriched.teamComparisons = computeTeamComparisons(
    bsdMatch.live_stats?.home,
    bsdMatch.live_stats?.away,
  );

  return enriched;
}
