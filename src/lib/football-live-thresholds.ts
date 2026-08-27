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
  /**
   * Probabilités pré-match (fallback quand le xG live est absent).
   * `awayProb` informatif ; `over25Prob` calibre λ_total sur le marché
   * O/U 2.5 (Clegg, Song & Cartlidge 2026 — calibration marché = levier n°1).
   */
  prematch?: {
    homeProb: number;
    drawProb: number;
    awayProb?: number;
    over25Prob?: number;
  } | null;
  /** Cartons rouges live — ajuste les taux de buts (Cerveny et al. 2016). */
  homeRedCards?: number | null;
  awayRedCards?: number | null;
}

export interface LiveMarketsProjection {
  homeWin: number;
  draw: number;
  awayWin: number;
  over15: number;
  over25: number;
  over35: number;
  under25: number;
  under35: number;
  btts: number;
  /** Buts d'équipe — parité OddAlerts (o05/o15 par camp, % 0-100). */
  o05Home: number;
  o15Home: number;
  o05Away: number;
  o15Away: number;
  /** "xg" = projeté depuis le xG live, "prematch" = taux modélisés. */
  source: "xg" | "prematch";
}

/** λ total attendu sur 90 min (moyenne ligues top-5, défaut sans calibration). */
const LEAGUE_LAMBDA_90 = 2.7;
const MAX_GRID = 8;

/**
 * Profil de phase du taux de buts — Dixon & Robinson (1998, JRSS-D 47(3)) et
 * arXiv:2501.18606 : moins de buts au début du match, nette hausse en fin.
 */
export const LAMBDA_PHASE_PROFILE = {
  /** Minutes 0-14. */
  early: 0.85,
  /** Minutes 15-74. */
  mid: 1.0,
  /** Minutes 75-90. */
  late: 1.25,
} as const;

/** Multiplicateur de phase pour une minute donnée (0-90). */
export function phaseMultiplier(minute: number): number {
  const m = Math.max(0, Math.min(90, Math.round(minute)));
  if (m < 15) return LAMBDA_PHASE_PROFILE.early;
  if (m >= 75) return LAMBDA_PHASE_PROFILE.late;
  return LAMBDA_PHASE_PROFILE.mid;
}

/**
 * Cartons rouges — Cerveny, van Ours & van Tuijl (2016, SSRN 2834224) et
 * Ridder, Cramer & Hopstater (1994, « Down to ten ») : l'exclusion augmente
 * le taux de buts de l'adversaire et réduit celui de l'équipe réduite.
 * Constantes volontairement conservatrices, ajustables après backtest.
 */
export const RED_CARD_OPP_BOOST = 1.3;
export const RED_CARD_OWN_DAMP = 0.7;

/**
 * λ_total sur 90 min calibré sur P(O2.5) d'un Poisson de même λ
 * (P(O2.5) = 1 − e^−λ(1 + λ + λ²/2)) — recherche par bisection.
 */
function lambdaTotalFromOver25(p: number): number {
  const target = Math.max(0.01, Math.min(0.99, p));
  let lo = 0.05;
  let hi = 8;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const over = 1 - Math.exp(-mid) * (1 + mid + (mid * mid) / 2);
    if (over < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Σ des multiplicateurs de phase sur les minutes restantes (minute+1 → 90). */
function phaseSum(minute: number): number {
  let s = 0;
  for (let m = minute + 1; m <= 90; m++) s += phaseMultiplier(m);
  return s;
}

/**
 * Projette les marchés live : Poisson sur le temps restant, λ dérivé du xG
 * live (taux courant projeté) ou des probas pré-match calibrées marché, puis
 * convolution avec le score actuel. v2 : profil de phase λ(t) (Dixon &
 * Robinson 1998), cartons rouges (Cerveny 2016), calibration O/U 2.5 (Clegg
 * 2026), marchés étendus O3.5/U2.5/U3.5 + buts d'équipe 0.5/1.5 (parité
 * OddAlerts). Retourne des probabilités 0-100 arrondies.
 */
export function projectLiveMarkets(input: LiveProjectionInput): LiveMarketsProjection {
  const minute = Math.max(1, Math.min(90, Math.round(input.minute || 1)));
  const remaining = Math.max(0, 90 - minute);
  const sh = Math.max(0, Math.floor(input.homeScore || 0));
  const sa = Math.max(0, Math.floor(input.awayScore || 0));
  const homeRed = Math.max(0, Math.min(4, Math.floor(input.homeRedCards || 0)));
  const awayRed = Math.max(0, Math.min(4, Math.floor(input.awayRedCards || 0)));
  const ownDampH = Math.pow(RED_CARD_OWN_DAMP, homeRed);
  const ownDampA = Math.pow(RED_CARD_OWN_DAMP, awayRed);
  const boostH = Math.pow(RED_CARD_OPP_BOOST, awayRed); // extérieur réduit → dom. profite
  const boostA = Math.pow(RED_CARD_OPP_BOOST, homeRed);

  const hasXg =
    input.homeXg != null && Number.isFinite(input.homeXg) && input.awayXg != null && Number.isFinite(input.awayXg);
  const pm = input.prematch ?? null;
  const share = pm ? Math.max(0.1, Math.min(0.9, (pm.homeProb + pm.drawProb / 2) / 100)) : 0.5;

  let lambdaHomeRem: number;
  let lambdaAwayRem: number;
  let source: LiveMarketsProjection["source"];

  if (hasXg) {
    // Taux xG observé (buts/minute) × Σ phases sur les minutes restantes.
    const rateH = Math.max(0, Number(input.homeXg)) / minute;
    const rateA = Math.max(0, Number(input.awayXg)) / minute;
    const S = phaseSum(minute);
    // Plancher de fiabilité (xG quasi nul très tôt ≠ 0 but garanti) — même
    // logique que v1, appliqué par minute avec le même profil de phase.
    const floorH = ((LEAGUE_LAMBDA_90 * share * 0.45) / 90) * S;
    const floorA = ((LEAGUE_LAMBDA_90 * (1 - share) * 0.45) / 90) * S;
    lambdaHomeRem = Math.max(rateH * S * ownDampH * boostH, floorH * ownDampH);
    lambdaAwayRem = Math.max(rateA * S * ownDampA * boostA, floorA * ownDampA);
    source = "xg";
  } else {
    // λ_total calibré sur le marché O/U 2.5 quand disponible (Clegg 2026),
    // sinon moyenne ligues. Répartition par part de domination 1X2.
    const lambdaTotal90 =
      pm?.over25Prob != null && Number.isFinite(pm.over25Prob)
        ? lambdaTotalFromOver25(Math.max(1, Math.min(99, pm.over25Prob)) / 100)
        : LEAGUE_LAMBDA_90;
    const S = phaseSum(minute);
    lambdaHomeRem = ((lambdaTotal90 * share) / 90) * S * ownDampH * boostH;
    lambdaAwayRem = ((lambdaTotal90 * (1 - share)) / 90) * S * ownDampA * boostA;
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
      over35: sh + sa >= 4 ? 100 : 0,
      under25: sh + sa <= 2 ? 100 : 0,
      under35: sh + sa <= 3 ? 100 : 0,
      o05Home: sh >= 1 ? 100 : 0,
      o15Home: sh >= 2 ? 100 : 0,
      o05Away: sa >= 1 ? 100 : 0,
      o15Away: sa >= 2 ? 100 : 0,
      btts: sh >= 1 && sa >= 1 ? 100 : 0,
      source,
    };
  }

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let under25 = 0;
  let under35 = 0;
  let btts = 0;
  let o05Home = 0;
  let o15Home = 0;
  let o05Away = 0;
  let o15Away = 0;
  for (let h = 0; h <= MAX_GRID; h++) {
    for (let a = 0; a <= MAX_GRID; a++) {
      const p = poissonPMF(lambdaHomeRem, h) * poissonPMF(lambdaAwayRem, a);
      if (p <= 0) continue;
      const fh = sh + h;
      const fa = sa + a;
      const total = fh + fa;
      if (fh > fa) homeWin += p;
      else if (fh === fa) draw += p;
      else awayWin += p;
      if (total >= 2) over15 += p;
      if (total >= 3) over25 += p;
      if (total >= 4) over35 += p;
      if (total <= 2) under25 += p;
      if (total <= 3) under35 += p;
      if (fh >= 1) o05Home += p;
      if (fh >= 2) o15Home += p;
      if (fa >= 1) o05Away += p;
      if (fa >= 2) o15Away += p;
      if (fh >= 1 && fa >= 1) btts += p;
    }
  }
  const s = homeWin + draw + awayWin;
  const norm = s > 0 ? 1 / s : 1;
  const pct = (v: number) => Math.round(Math.min(1, v * norm) * 100);
  return {
    homeWin: Math.round(homeWin * norm * 100),
    draw: Math.round(draw * norm * 100),
    awayWin: Math.round(awayWin * norm * 100),
    over15: pct(over15),
    over25: pct(over25),
    over35: pct(over35),
    under25: pct(under25),
    under35: pct(under35),
    o05Home: pct(o05Home),
    o15Home: pct(o15Home),
    o05Away: pct(o05Away),
    o15Away: pct(o15Away),
    btts: pct(btts),
    source,
  };
}
