// Forecast "prochaines N minutes" — ExG / ExC (parité PackBall §Indicateurs).
//
// PackBall affiche « Buts attendus pour les 10 prochaines minutes » (ExG) et
// « Corners attendus pour les 10 prochaines minutes » (ExC). On calcule la même
// chose en réutilisant le moteur existant :
//
//   λ_fenêtre = (taux observé par minute) × Σ phaseMultiplier(m+1 … m+N)
//
// Le taux observé vient du xG live (buts) ou des corners cumulés (corners).
// Sans donnée, on retombe sur la moyenne ligue avec la même part de domination
// 1X2 que `projectLiveMarkets` — les deux fonctions doivent rester cohérentes.
//
// ⚠️ Hypothèse assumée : extrapolation linéaire du taux observé. Le λ n'est pas
// un modèle de Poisson recalculé (ça, c'est `projectLiveMarkets`) — c'est une
// espérance conditionnelle courte. Un but attendu n'est pas « quasi certain »
// sur 10 min : 0.3 attendu ≠ 30 % de probabilité. Les probabilités de Poisson
// correspondantes sont exposées pour l'utilisateur qui les veut.

import { phaseMultiplier, RED_CARD_OWN_DAMP, RED_CARD_OPP_BOOST } from "./football-live-thresholds";

/** λ moyen de corners par équipe sur 90 min (moyenne ligues top-5, fallback). */
const LEAGUE_CORNERS_90 = 5.0;
/** λ moyen de buts sur 90 min (même constante que projectLiveMarkets). */
const LEAGUE_LAMBDA_90 = 2.7;

export interface NextWindowInput {
  /** Minute courante du match (0-130). */
  minute: number;
  /** xG cumulé live. Prioritaire pour les buts quand les deux camps sont là. */
  homeXg?: number | null;
  awayXg?: number | null;
  /** Buts déjà marqués — repli quand le xG est absent. */
  homeScore?: number | null;
  awayScore?: number | null;
  /** Corners cumulés live (pour ExC). */
  homeCorners?: number | null;
  awayCorners?: number | null;
  /** Cartons rouges live — même ajustement que projectLiveMarkets. */
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  /** Probabilités pré-match 0-100 : sert de part de domination au fallback. */
  prematch?: { homeProb: number; drawProb: number } | null;
}

export interface NextWindowForecast {
  /** Fenêtre couverte, en minutes. */
  window: number;
  /** Minute de fin de la fenêtre (peut dépasser 90 en temps additionnel). */
  endMinute: number;
  /** Buts attendus par camp sur la fenêtre (espérance, pas probabilité). */
  goals: { home: number; away: number };
  /** Corners attendus par camp sur la fenêtre. */
  corners: { home: number; away: number };
  /** P(au moins 1 but) sur la fenêtre, 0-100, via Poisson. */
  goalProb: { home: number; away: number };
  /** Origine du taux : xG observé, buts observés, ou moyenne ligue. */
  source: "xg" | "score" | "league";
  /** true → données trop tôt (minute < 5) pour être significatives. */
  thinData: boolean;
}

const isNum = (v: unknown): v is number => v != null && Number.isFinite(Number(v));

/** Σ des multiplicateurs de phase sur les `n` minutes qui suivent `minute`. */
function phaseSumNext(minute: number, n: number): number {
  let s = 0;
  for (let i = 1; i <= n; i++) s += phaseMultiplier(minute + i);
  return s;
}

/** 1 - e^(-λ) × 100, arrondi — P(au moins 1) sur une fenêtre. */
function probAtLeastOne(lambda: number): number {
  if (lambda <= 0) return 0;
  return Math.round((1 - Math.exp(-lambda)) * 100);
}

/**
 * Espérance de buts et de corners sur les `window` prochaines minutes.
 *
 * Reprend la mécanique de `projectLiveMarkets` (plancher de fiabilité sur taux
 * quasi nuls, amortissement/boost des cartons rouges, part 1X2 au repli) mais
 * Bornée à une fenêtre courte au lieu du temps restant.
 */
export function forecastNextWindow(input: NextWindowInput, window = 10): NextWindowForecast {
  const w = Math.max(1, Math.min(45, Math.round(window)));
  // On ne projette pas sur une fenêtre déjà jouée (match fini ou 90+ terminé).
  const minute = Math.max(0, Math.min(130, Math.round(input.minute || 0)));
  const endMinute = minute + w;
  const finished = minute >= 120;

  // Plancher de fiabilité : même logique que projectLiveMarkets, borné à la
  // fenêtre. Sans lui, 1 corner en 3' donnerait un taux qui explose en 10 min.
  const S = phaseSumNext(minute, w);

  const homeRed = Math.max(0, Math.min(4, Math.floor(Number(input.homeRedCards) || 0)));
  const awayRed = Math.max(0, Math.min(4, Math.floor(Number(input.awayRedCards) || 0)));
  const dampH = Math.pow(RED_CARD_OWN_DAMP, homeRed);
  const dampA = Math.pow(RED_CARD_OWN_DAMP, awayRed);
  const boostH = Math.pow(RED_CARD_OPP_BOOST, awayRed);
  const boostA = Math.pow(RED_CARD_OPP_BOOST, homeRed);

  const pm = input.prematch ?? null;
  const share = pm ? Math.max(0.1, Math.min(0.9, (pm.homeProb + pm.drawProb / 2) / 100)) : 0.5;

  const zero = { home: 0, away: 0 };
  if (finished) {
    return {
      window: w,
      endMinute,
      goals: zero,
      corners: zero,
      goalProb: zero,
      source: "league",
      thinData: true,
    };
  }

  // ─── Buts ───
  const hasXg = isNum(input.homeXg) && isNum(input.awayXg);
  const hasScore = isNum(input.homeScore) && isNum(input.awayScore);
  // Taux par minute observé ; le dénominateur plancher évite la division par
  // une minute quasi nulle (0' ou 1') qui produirait un taux infini.
  const denom = Math.max(5, minute);

  let goals: { home: number; away: number };
  let source: NextWindowForecast["source"];

  if (hasXg) {
    const rateH = Math.max(0, Number(input.homeXg)) / denom;
    const rateA = Math.max(0, Number(input.awayXg)) / denom;
    const floorH = ((LEAGUE_LAMBDA_90 * share) / 90) * S;
    const floorA = ((LEAGUE_LAMBDA_90 * (1 - share)) / 90) * S;
    goals = {
      home: Math.max(rateH * S * dampH * boostH, floorH * dampH),
      away: Math.max(rateA * S * dampA * boostA, floorA * dampA),
    };
    source = "xg";
  } else if (hasScore && minute >= 10) {
    // Repli buts observés : moins fin que le xG (un but sur 12' ne dit rien
    // sur la qualité des tirs) mais mieux que la moyenne ligue.
    const rateH = Math.max(0, Number(input.homeScore)) / denom;
    const rateA = Math.max(0, Number(input.awayScore)) / denom;
    const floorH = ((LEAGUE_LAMBDA_90 * share) / 90) * S;
    const floorA = ((LEAGUE_LAMBDA_90 * (1 - share)) / 90) * S;
    goals = {
      home: Math.max(rateH * S * dampH * boostH, floorH * dampH),
      away: Math.max(rateA * S * dampA * boostA, floorA * dampA),
    };
    source = "score";
  } else {
    goals = {
      home: ((LEAGUE_LAMBDA_90 * share) / 90) * S * dampH * boostH,
      away: ((LEAGUE_LAMBDA_90 * (1 - share)) / 90) * S * dampA * boostA,
    };
    source = "league";
  }

  // ─── Corners ───
  const hasCorners = isNum(input.homeCorners) && isNum(input.awayCorners);
  let corners: { home: number; away: number };
  if (hasCorners) {
    // Les corners n'ont pas de profil de phase documenté → multiplicateur
    // plat. On ne réinvente pas un profil : mieux vaut un taux plat qu'un
    // profil inventé qui n'a aucune base dans la littérature.
    const cRateH = Math.max(0, Number(input.homeCorners)) / denom;
    const cRateA = Math.max(0, Number(input.awayCorners)) / denom;
    const cFloor = (LEAGUE_CORNERS_90 / 90) * w;
    corners = {
      home: Math.max(cRateH * w, cFloor),
      away: Math.max(cRateA * w, cFloor),
    };
  } else {
    const cFloor = (LEAGUE_CORNERS_90 / 90) * w;
    corners = { home: cFloor, away: cFloor };
  }

  return {
    window: w,
    endMinute,
    goals: {
      home: Math.round(goals.home * 100) / 100,
      away: Math.round(goals.away * 100) / 100,
    },
    corners: {
      home: Math.round(corners.home * 100) / 100,
      away: Math.round(corners.away * 100) / 100,
    },
    goalProb: {
      home: probAtLeastOne(goals.home),
      away: probAtLeastOne(goals.away),
    },
    source,
    thinData: minute < 5,
  };
}
