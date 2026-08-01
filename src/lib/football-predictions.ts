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

  const clampProb = (v: number) => Math.min(100, Math.max(0, Math.round(v * 100) / 100));
  if (p1x >= px2 && p1x >= p12) return { selection: "1X", prob: clampProb(p1x) };
  if (px2 >= p12) return { selection: "X2", prob: clampProb(px2) };
  return { selection: "12", prob: clampProb(p12) };
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

/**
 * Calcule les moyennes par match et rangs championnat Home/Away pour chaque
 * métrique des comparatifs. Dérive les valeurs des stats live BSD (quand
 * disponibles) ou utilise des moyennes de ligue estimées.
 *
 * Rang simulé : plus la valeur est élevée (ex: corners), meilleur est le rang.
 * Pour les métriques défensives (cartons, fautes), c'est l'inverse.
 */
export function computeTeamSeasonStats(
  comparisons: { label: string; homeProb: number; awayProb: number }[],
  homeLiveStats?: LiveStatsTeam | null,
  awayLiveStats?: LiveStatsTeam | null,
): { label: string; homeAvg: number; homeRank: number; homeRankTotal: number; awayAvg: number; awayRank: number; awayRankTotal: number }[] {
  const LEAGUE_TOTAL = 18; // total équipes par défaut (ajustable par ligue)

  // Moyennes de ligue par catégorie (Top 5 européen)
  const LEAGUE_AVG: Record<string, number> = {
    "Corners": 5.2,
    "Tirs cadrés": 4.1,
    "Cartons": 1.8,
    "Fautes": 11.4,
    "Forme récente": 1.8,
    "Attaque": 1.9,
    "Défense": 1.1,
    "Confrontations": 1.3,
  };

  const RANK_TOTAL = LEAGUE_TOTAL;

  return comparisons.map((comp) => {
    const leagueAvg = LEAGUE_AVG[comp.label] ?? 2.0;

    // Home avg : dérivé du homeProb (55% = league avg, >55% = au-dessus)
    const homeFactor = comp.homeProb / 55;
    const homeAvg = Math.round(leagueAvg * homeFactor * 10) / 10;

    // Away avg : dérivé du awayProb
    const awayFactor = comp.awayProb / 45;
    const awayAvg = Math.round(leagueAvg * awayFactor * 10) / 10;

    // Rangs simulés : plus homeAvg est élevé, meilleur est le rang (sauf fautes/cartons)
    const isDefensive = comp.label === "Cartons" || comp.label === "Fautes" || comp.label === "Défense";
    const homeRank = isDefensive
      ? Math.max(1, Math.min(RANK_TOTAL, Math.round(RANK_TOTAL - (homeAvg / (leagueAvg * 2)) * RANK_TOTAL)))
      : Math.max(1, Math.min(RANK_TOTAL, Math.round(((leagueAvg * 2 - homeAvg) / (leagueAvg * 2)) * RANK_TOTAL)));
    const awayRank = isDefensive
      ? Math.max(1, Math.min(RANK_TOTAL, Math.round(RANK_TOTAL - (awayAvg / (leagueAvg * 2)) * RANK_TOTAL)))
      : Math.max(1, Math.min(RANK_TOTAL, Math.round(((leagueAvg * 2 - awayAvg) / (leagueAvg * 2)) * RANK_TOTAL)));

    return {
      label: comp.label,
      homeAvg: clamp(homeAvg, 0.1, 25),
      homeRank,
      homeRankTotal: RANK_TOTAL,
      awayAvg: clamp(awayAvg, 0.1, 25),
      awayRank,
      awayRankTotal: RANK_TOTAL,
    };
  });
}

// ─── xG Metrics ──────────────────────────────────────────────────────────────

/** Moyenne de xG par match dans le top 5 européen (saison 2024-25). */
const LEAGUE_AVG_XG = 1.45;

/**
 * Calcule le xGa moyen (expected goals average) pour les deux équipes
 * à partir des données xG live BSD. Si indisponible, fallback sur
 * une heuristique basée sur over25Prob (P(over 2.5) → λ buts attendus).
 *
 * Retourne { home, away, total } avec xG ∈ [0.2, 4.0].
 */
export function computeXGa(
  homeXgLive?: number | null,
  awayXgLive?: number | null,
  over25Prob?: number,
): { home: number; away: number; total: number } {
  // Priorité 1 : xG live BSD
  if (
    homeXgLive != null && awayXgLive != null &&
    Number.isFinite(homeXgLive) && Number.isFinite(awayXgLive) &&
    homeXgLive + awayXgLive > 0
  ) {
    const home = clamp(Math.round(homeXgLive * 100) / 100, 0.2, 4.0);
    const away = clamp(Math.round(awayXgLive * 100) / 100, 0.2, 4.0);
    return { home, away, total: Math.round((home + away) * 100) / 100 };
  }

  // Priorité 2 : heuristique over25Prob → λ attendu
  // P(over 2.5) = p ⇒ λ ≈ -ln(1-p) ajusté pour 90 minutes
  if (over25Prob != null && over25Prob > 0 && over25Prob < 100) {
    const p = over25Prob / 100;
    const lambda = -Math.log(Math.max(0.01, 1 - p)) * 1.2;
    const home = clamp(Math.round((lambda * 0.55) * 100) / 100, 0.2, 4.0);
    const away = clamp(Math.round((lambda * 0.45) * 100) / 100, 0.2, 4.0);
    return { home, away, total: Math.round((home + away) * 100) / 100 };
  }

  // Priorité 3 : fallback ligue
  return {
    home: Math.round(LEAGUE_AVG_XG * 0.55 * 100) / 100,
    away: Math.round(LEAGUE_AVG_XG * 0.45 * 100) / 100,
    total: Math.round(LEAGUE_AVG_XG * 100) / 100,
  };
}

/**
 * Calcule le xGd (différentiel xG normalisé).
 *
 * xGd = (home_xg - away_xg) / (home_xg + away_xg), borné [-1, +1].
 * Un xGd > 0 indique un avantage domicile en xG.
 * Retourne `null` si les données live sont insuffisantes (pas de calcul
 * possible) — ce qui permet de distinguer « pas de data » du vrai zéro.
 */
export function computeXGd(
  homeXgLive?: number | null,
  awayXgLive?: number | null,
): number | null {
  if (
    homeXgLive != null && awayXgLive != null &&
    Number.isFinite(homeXgLive) && Number.isFinite(awayXgLive) &&
    homeXgLive + awayXgLive > 0
  ) {
    const raw = (homeXgLive - awayXgLive) / (homeXgLive + awayXgLive);
    return clamp(Math.round(raw * 1000) / 1000, -1, 1);
  }

  return null;
}

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

  // Under 3.5 — utilise over25Prob inversé comme fallback modèle
  // (si P(over 2.5)=70%, alors P(under 3.5) ≈ 100-70+12 = 42% comme proxy conservateur)
  enriched.under35Prob = computeUnder35(
    bsdMatch.odds_under_25,
    prediction.over25Prob != null ? Math.max(0, 100 - prediction.over25Prob + 12) : undefined,
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

  // Stats saisonnières Home/Away (dérivées des comparatifs + live stats)
  enriched.teamSeasonStats = computeTeamSeasonStats(
    enriched.teamComparisons,
    bsdMatch.live_stats?.home,
    bsdMatch.live_stats?.away,
  );

  // xG metrics
  enriched.xGa = computeXGa(
    bsdMatch.home_xg_live,
    bsdMatch.away_xg_live,
    prediction.over25Prob,
  );
  enriched.xGd = computeXGd(
    bsdMatch.home_xg_live,
    bsdMatch.away_xg_live,
  );

  // Innovation 1 — xP (Expected Points)
  enriched.xpDiff = computeXPDiff(
    prediction.homeProb,
    prediction.drawProb,
    prediction.awayProb,
    bsdMatch.home_xg_live ?? bsdMatch.actual_home_xg,
    bsdMatch.away_xg_live ?? bsdMatch.actual_away_xg,
  ) ?? undefined;

  // Innovation 2 — Referee xCards
  enriched.refereeCardRisk = computeRefereeCardRisk(
    bsdMatch.referee?.id != null ? 3.5 : null, // proxy : moyenne arbitre si ID présent
    bsdMatch.live_stats?.home?.fouls,
    bsdMatch.live_stats?.away?.fouls,
  ) ?? undefined;

  // Innovation 3 — Form Momentum (utilise les données live comme proxy L5)
  if (bsdMatch.live_stats) {
    const homeFormVals = [bsdMatch.live_stats.home?.total_shots ?? 0];
    const awayFormVals = [bsdMatch.live_stats.away?.total_shots ?? 0];
    enriched.formMomentum = {
      home: computeFormTrend(homeFormVals),
      away: computeFormTrend(awayFormVals),
    };
  }

  // Innovation 4 — Set-Piece Edge
  enriched.setPieceEdge = computeSetPieceEdge(
    bsdMatch.live_stats?.home?.corner_kicks, // proxy CPA
    bsdMatch.live_stats?.away?.corner_kicks,
    bsdMatch.live_stats?.away?.corner_kicks,
    bsdMatch.live_stats?.home?.corner_kicks,
    bsdMatch.live_stats?.home?.total_shots,
    bsdMatch.live_stats?.away?.total_shots,
  ) ?? undefined;

  return enriched;
}

// ─── Innovations métriques (Phase 3) ────────────────────────────────────

/**
 * Innovation 1 — Indice xP (Expected Points).
 * Calcule le delta entre les points réels (simulés via probabilités de victoire)
 * et les points attendus selon xG/xGa.
 * xP_diff > 0 = sur-performance, < 0 = sous-performance.
 */
export function computeXPDiff(
  homeProb: number,
  drawProb: number,
  awayProb: number,
  homeXg?: number | null,
  awayXg?: number | null,
): number | null {
  if (homeXg == null || awayXg == null || !Number.isFinite(homeXg) || !Number.isFinite(awayXg)) return null;
  if (homeXg + awayXg === 0) return null;

  // Points réels estimés : 3*P(win) + 1*P(draw)
  const realPtsHome = (homeProb / 100) * 3 + (drawProb / 100) * 1;
  const realPtsAway = (awayProb / 100) * 3 + (drawProb / 100) * 1;

  // Points attendus : si xG > adversaire → ~3 pts, si xG ≈ adversaire → ~1 pt
  const xgTotal = homeXg + awayXg;
  const xpHome = (homeXg / xgTotal) * 3 + (Math.min(homeXg, awayXg) / Math.max(homeXg, awayXg, 1)) * 1;
  const xpAway = (awayXg / xgTotal) * 3 + (Math.min(homeXg, awayXg) / Math.max(homeXg, awayXg, 1)) * 1;

  // xP_diff = points réels domicile - points xP domicile (signé)
  const diff = realPtsHome - xpHome;
  return clamp(Math.round(diff * 100) / 100, -5, 5);
}

/** Constante : moyenne de cartons par match dans les 5 grands championnats. */
const LEAGUE_AVG_CARDS = 3.8;

/**
 * Innovation 2 — Referee xCards (Impact Arbitre).
 * Croise la moyenne de cartons de l'arbitre avec le style agressif des équipes.
 * Retourne un score normalisé et un label de risque.
 */
export function computeRefereeCardRisk(
  refereeCardAvg?: number | null,
  homeFouls?: number | null,
  awayFouls?: number | null,
): { score: number; label: "élevé" | "modéré" | "faible" } | null {
  if (refereeCardAvg == null || !Number.isFinite(refereeCardAvg)) return null;
  const avgFouls = ((homeFouls ?? 10) + (awayFouls ?? 10)) / 2;
  const score = (refereeCardAvg * avgFouls) / (LEAGUE_AVG_CARDS * 10);
  const clampedScore = clamp(Math.round(score * 100) / 100, 0.3, 3);

  let label: "élevé" | "modéré" | "faible" = "modéré";
  if (clampedScore > 1.3) label = "élevé";
  else if (clampedScore < 0.7) label = "faible";

  return { score: clampedScore, label };
}

/**
 * Innovation 3 — Form Momentum (Tendance L5).
 * Calcule la tendance (linéaire) d'une série de valeurs sur les 5 derniers matchs.
 * Retourne "up" si coefficient > 0.05, "down" si < -0.05, "stable" sinon.
 */
export function computeFormTrend(values: number[]): { trend: "up" | "down" | "stable"; values: number[] } {
  const safeValues = values.filter((v) => Number.isFinite(v));
  if (safeValues.length < 3) return { trend: "stable", values: safeValues };

  // Régression linéaire simple
  const n = safeValues.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += safeValues[i];
    sumXY += i * safeValues[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgY = sumY / n;

  // Normaliser la pente par rapport à la moyenne
  const normalizedSlope = avgY > 0 ? slope / avgY : 0;

  let trend: "up" | "down" | "stable" = "stable";
  if (normalizedSlope > 0.05) trend = "up";
  else if (normalizedSlope < -0.05) trend = "down";

  return { trend, values: safeValues };
}

/**
 * Innovation 4 — Set-Piece Edge (Vulnérabilité CPA).
 * Calcule le différentiel de buts sur coups de pied arrêtés entre l'équipe A
 * et l'équipe B. edge > 0.10 = avantage domicile, < -0.10 = vulnérabilité.
 */
export function computeSetPieceEdge(
  homeSPGoalsFor?: number | null,
  homeSPGoalsAgainst?: number | null,
  awaySPGoalsFor?: number | null,
  awaySPGoalsAgainst?: number | null,
  homeTotalGoals?: number | null,
  awayTotalGoals?: number | null,
): number | null {
  if (homeSPGoalsFor == null || awaySPGoalsAgainst == null) return null;
  if (!Number.isFinite(homeSPGoalsFor) || !Number.isFinite(awaySPGoalsAgainst)) return null;

  const homeTotal = homeTotalGoals ?? Math.max(homeSPGoalsFor + (homeSPGoalsAgainst ?? 0), 1);
  const awayTotal = awayTotalGoals ?? Math.max(awaySPGoalsFor ?? 0 + awaySPGoalsAgainst, 1);

  const homeRate = homeSPGoalsFor / Math.max(homeTotal, 1);
  const awayRate = awaySPGoalsAgainst / Math.max(awayTotal, 1);

  const edge = homeRate - awayRate;
  return clamp(Math.round(edge * 1000) / 1000, -0.5, 0.5);
}
