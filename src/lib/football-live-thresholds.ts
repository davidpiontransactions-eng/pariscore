// Seuils statistiques du funnel In-Play (inspiré OddAlerts.com — rapport
// .context/pm/oddalerts-live-stats-analysis.md) + baseline de pression
// attendue + projection live des marchés par Poisson.
//
// Règle défensive : toute métrique peut être absente (null) selon la source —
// l'évaluation saute alors la règle concernée sans crash ni faux signal.

import { poissonPMF } from "@/lib/prediction/football/poisson";

// ─── Seuils du funnel (défauts de surbrillance UI) ─────────────────────────

export const LIVE_FUNNEL_THRESHOLDS = {
  /** Pression domicile > 65 %. */
  homePressure: 65,
  /** Écart de pression moyen ≥ 20 points. */
  pressureDiff: 20,
  /** Possession extérieur < 35 % (règle combinée). */
  awayPossession: 35,
  /** Tirs cadrés totaux > 8. */
  totalSot: 8,
  /** Tirs domicile > 12. */
  homeShots: 12,
  /** Tirs cadrés extérieur ≥ 4. */
  awaySot: 4,
  /** Corners totaux ≥ 6. */
  totalCorners: 6,
  /** Corners domicile > 4. */
  homeCorners: 4,
  /** Cartons jaunes totaux ≤ 2 (match propre). */
  yellowCards: 2,
  /** Attaques dangereuses totales > 15. */
  dangerousAttacks: 15,
  /** Attaques domicile ≥ 25. */
  homeAttacks: 25,
  /** xG total du match > 1.5. */
  xgTotal: 1.5,
} as const;

export type FunnelRuleId =
  | "homePressure"
  | "pressureDiff"
  | "awayPossession"
  | "totalSot"
  | "homeShots"
  | "awaySot"
  | "totalCorners"
  | "homeCorners"
  | "yellowCards"
  | "dangerousAttacks"
  | "homeAttacks"
  | "xgTotal";

export interface FunnelLiveInput {
  /** Minute de jeu — sert à temporiser certaines règles (ex. cartons). */
  minute?: number | null;
  homePressurePct?: number | null;
  homePossession?: number | null;
  homeShots?: number | null;
  awayShots?: number | null;
  homeSot?: number | null;
  awaySot?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeYellowCards?: number | null;
  awayYellowCards?: number | null;
  homeAttacks?: number | null;
  awayAttacks?: number | null;
  homeDangerousAttacks?: number | null;
  awayDangerousAttacks?: number | null;
  homeXg?: number | null;
  awayXg?: number | null;
}

export interface FunnelHit {
  rule: FunnelRuleId;
  /** Seuil utilisé (pour affichage / debug). */
  threshold: number;
  /** Valeur observée (null → règle sautée). */
  value: number | null;
  /** true si la condition du funnel est remplie (signal actif). */
  met: boolean;
}

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) ? v : null;

/**
 * Évalue les règles du funnel sur les stats live courantes.
 * Une règle sans donnée (value null) est retournée `met: false` et doit être
 * ignorée par le compteur de signaux.
 */
export function evaluateLiveFunnel(s: FunnelLiveInput): FunnelHit[] {
  const t = LIVE_FUNNEL_THRESHOLDS;
  const hits: FunnelHit[] = [];
  const push = (rule: FunnelRuleId, threshold: number, value: number | null, met: boolean) =>
    hits.push({ rule, threshold, value, met: value == null ? false : met });

  const homePressure = num(s.homePressurePct);
  push("homePressure", t.homePressure, homePressure, homePressure != null && homePressure > t.homePressure);

  const diff = homePressure != null ? Math.abs(homePressure - 50) * 2 : null;
  push("pressureDiff", t.pressureDiff, diff, diff != null && diff >= t.pressureDiff);

  const homePoss = num(s.homePossession);
  const awayPoss = homePoss != null ? 100 - homePoss : null;
  push("awayPossession", t.awayPossession, awayPoss, awayPoss != null && awayPoss < t.awayPossession);

  const homeSot = num(s.homeSot);
  const awaySot = num(s.awaySot);
  const totalSot = homeSot != null && awaySot != null ? homeSot + awaySot : null;
  push("totalSot", t.totalSot, totalSot, totalSot != null && totalSot > t.totalSot);
  push("awaySot", t.awaySot, awaySot, awaySot != null && awaySot >= t.awaySot);

  const homeShots = num(s.homeShots);
  push("homeShots", t.homeShots, homeShots, homeShots != null && homeShots > t.homeShots);

  const homeCorners = num(s.homeCorners);
  const awayCorners = num(s.awayCorners);
  const totalCorners = homeCorners != null && awayCorners != null ? homeCorners + awayCorners : null;
  push("totalCorners", t.totalCorners, totalCorners, totalCorners != null && totalCorners >= t.totalCorners);
  push("homeCorners", t.homeCorners, homeCorners, homeCorners != null && homeCorners > t.homeCorners);

  const yellow =
    num(s.homeYellowCards) != null && num(s.awayYellowCards) != null
      ? (s.homeYellowCards as number) + (s.awayYellowCards as number)
      : null;
  // « Cartons ≤ 2 » = match propre — signal exploitable seulement en fin de match
  // (sinon vrai dès la 1ʳᵉ minute → badge « N signaux » gonflé en continu).
  const lateGame = (s.minute ?? 0) >= 60;
  push("yellowCards", t.yellowCards, yellow, lateGame && yellow != null && yellow <= t.yellowCards);

  const dang =
    num(s.homeDangerousAttacks) != null && num(s.awayDangerousAttacks) != null
      ? (s.homeDangerousAttacks as number) + (s.awayDangerousAttacks as number)
      : null;
  push("dangerousAttacks", t.dangerousAttacks, dang, dang != null && dang > t.dangerousAttacks);

  const homeAttacks = num(s.homeAttacks);
  push("homeAttacks", t.homeAttacks, homeAttacks, homeAttacks != null && homeAttacks >= t.homeAttacks);

  const xg =
    num(s.homeXg) != null && num(s.awayXg) != null ? (s.homeXg as number) + (s.awayXg as number) : null;
  push("xgTotal", t.xgTotal, xg, xg != null && xg > t.xgTotal);

  return hits;
}

// ─── Baseline de pression attendue (LIVE vs AVG) ───────────────────────────

/**
 * Pression ATTENDUE pré-match, dérivée des probabilités 1X2 du modèle :
 * part de domination espérée = P(victoire) + ½·P(nul), normalisée 0-100.
 * C'est l'équivalent fonctionnel du `*_pressure_avg` d'OddAlerts (baseline
 * historique d'avant-match) — l'écart live − attendu est le signal d'anomalie.
 */
export function expectedPressureBaseline(
  homeProbPct: number,
  drawProbPct: number,
): { homePct: number; awayPct: number } {
  const clamp01 = (n: number) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
  const homeRaw = clamp01(homeProbPct) + clamp01(drawProbPct) / 2;
  const home = Math.max(5, Math.min(95, Math.round(homeRaw)));
  return { homePct: home, awayPct: 100 - home };
}

export type PressureAnomalyKind = "underdog_surge" | "favorite_domination" | null;

export interface PressureAnomaly {
  /** live home% − attendu home%. */
  delta: number;
  /**
   * - "underdog_surge" : l'outsider (attendu < 45%) domine en live (+8 pts min)
   * - "favorite_domination" : le favori confirme avec ≥ 70% de pression live
   * - null : pas d'anomalie exploitable
   */
  kind: PressureAnomalyKind;
}

export function detectPressureAnomaly(
  liveHomePct: number,
  avgHomePct: number,
): PressureAnomaly {
  const delta = Math.round(liveHomePct - avgHomePct);
  if (avgHomePct < 45 && liveHomePct - avgHomePct >= 8) {
    return { delta, kind: "underdog_surge" };
  }
  const favoriteHome = avgHomePct >= 55;
  const favoriteAway = avgHomePct < 45;
  if (favoriteHome && liveHomePct >= 70) return { delta, kind: "favorite_domination" };
  if (favoriteAway && liveHomePct <= 30) return { delta, kind: "favorite_domination" };
  return { delta, kind: null };
}

// ─── Projection live des marchés (Poisson sur temps restant) ───────────────

export interface LiveProjectionInput {
  minute: number;
  homeScore: number;
  awayScore: number;
  /** xG cumulé live (source BSD). Optionnel — fallback taux pré-match. */
  homeXg?: number | null;
  awayXg?: number | null;
  /** Probabilités 1X2 pré-match (fallback quand le xG live est absent). */
  prematch?: { homeProb: number; drawProb: number } | null;
}

export interface LiveMarketsProjection {
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  over25: number;
  btts: number;
  /** "xg" = projeté depuis le xG live, "prematch" = taux modélisés. */
  source: "xg" | "prematch";
}

/** λ total attendu sur 90 min (moyenne ligues top-5). */
const LEAGUE_LAMBDA_90 = 2.7;
const MAX_GRID = 8;

/**
 * Projette les marchés live : Poisson sur le temps restant, λ dérivé du xG
 * live (taux courant projeté) ou des probas pré-match, puis convolution avec
 * le score actuel. Retourne des probabilités 0-100 arrondies.
 */
export function projectLiveMarkets(input: LiveProjectionInput): LiveMarketsProjection {
  const minute = Math.max(1, Math.min(90, Math.round(input.minute || 1)));
  const remaining = Math.max(0, 90 - minute);
  const sh = Math.max(0, Math.floor(input.homeScore || 0));
  const sa = Math.max(0, Math.floor(input.awayScore || 0));

  const hasXg =
    input.homeXg != null && Number.isFinite(input.homeXg) && input.awayXg != null && Number.isFinite(input.awayXg);

  let lambdaHomeRem: number;
  let lambdaAwayRem: number;
  let source: LiveMarketsProjection["source"];

  if (hasXg) {
    // Taux xG observé projeté sur le temps restant (λ_rem = xG_cumulé / t × reste).
    const rateH = Math.max(0, Number(input.homeXg)) / minute;
    const rateA = Math.max(0, Number(input.awayXg)) / minute;
    // Plancher de fiabilité : un xG quasi nul très tôt (+ minute) ne signifie pas
    // qu'aucun but ne suivra (échantillonnage pauvre). On garantit un rythme
    // minimum issu de la baseline pour ne pas afficher « O 1.5 : 0% » — le signal
    // xG domine dès qu'il a du volume, le plancher ne fait que l'empêcher de tomber
    // à 0 arbitrairement.
    const share = input.prematch
      ? Math.max(0.1, Math.min(0.9, (input.prematch.homeProb + input.prematch.drawProb / 2) / 100))
      : 0.5;
    const floorH = LEAGUE_LAMBDA_90 * share * 0.45 * (remaining / 90);
    const floorA = LEAGUE_LAMBDA_90 * (1 - share) * 0.45 * (remaining / 90);
    lambdaHomeRem = Math.max(rateH * remaining, floorH);
    lambdaAwayRem = Math.max(rateA * remaining, floorA);
    source = "xg";
  } else if (input.prematch) {
    const share = Math.max(0.1, Math.min(0.9, (input.prematch.homeProb + input.prematch.drawProb / 2) / 100));
    lambdaHomeRem = LEAGUE_LAMBDA_90 * share * (remaining / 90);
    lambdaAwayRem = LEAGUE_LAMBDA_90 * (1 - share) * (remaining / 90);
    source = "prematch";
  } else {
    lambdaHomeRem = (LEAGUE_LAMBDA_90 / 2) * (remaining / 90);
    lambdaAwayRem = lambdaHomeRem;
    source = "prematch";
  }

  // Match terminé : le score courant décide (100/0, pas 99/1 — marché résolu).
  if (remaining <= 0 || minute >= 90) {
    const res =
      sh > sa
        ? { homeWin: 100, draw: 0, awayWin: 0 }
        : sh === sa
          ? { homeWin: 0, draw: 100, awayWin: 0 }
          : { homeWin: 0, draw: 0, awayWin: 100 };
    return {
      ...res,
      over15: sh + sa >= 2 ? 100 : 0,
      over25: sh + sa >= 3 ? 100 : 0,
      btts: sh >= 1 && sa >= 1 ? 100 : 0,
      source,
    };
  }

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let btts = 0;
  for (let h = 0; h <= MAX_GRID; h++) {
    for (let a = 0; a <= MAX_GRID; a++) {
      const p = poissonPMF(lambdaHomeRem, h) * poissonPMF(lambdaAwayRem, a);
      if (p <= 0) continue;
      const fh = sh + h;
      const fa = sa + a;
      if (fh > fa) homeWin += p;
      else if (fh === fa) draw += p;
      else awayWin += p;
      if (fh + fa >= 2) over15 += p;
      if (fh + fa >= 3) over25 += p;
      if (fh >= 1 && fa >= 1) btts += p;
    }
  }
  const s = homeWin + draw + awayWin;
  const norm = s > 0 ? 1 / s : 1;
  return {
    homeWin: Math.round(homeWin * norm * 100),
    draw: Math.round(draw * norm * 100),
    awayWin: Math.round(awayWin * norm * 100),
    over15: Math.round(Math.min(1, over15 * norm) * 100),
    over25: Math.round(Math.min(1, over25 * norm) * 100),
    btts: Math.round(Math.min(1, btts * norm) * 100),
    source,
  };
}
