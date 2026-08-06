// Moteur des 3 paris prédits (Predictive Bets) — engineering loop.
//
// Pour chaque rencontre, génère 3 pronostics à 3 niveaux :
//   Niveau 1 — Vainqueur / issue principale : P1/P2 Win (probabilités logistiques).
//   Niveau 2 — Volume : Over/Under Games (tennis) ou Over/Under 2.5 Buts (foot).
//   Niveau 3 — Score exact / Handicap : "2-0 / 2-1" ou handicap en jeux/buts
//              selon la domination théorique (ΔElo, surface).
//
// Règle loop : si les prédictions explicites (modèle BDD/BSD) manquent, le
// moteur calcule à la volée depuis ΔElo, la surface et les cotes bookmakers.
// Source tracée par pronostic ("model" | "cotes" | "elo-fallback" | "surface-fallback").

import type { TennisMatch } from "@/lib/tennis-data";
import type { FootballMatch } from "@/lib/football-data";
import { eloImpliedProb } from "@/lib/prediction/engine";
import { estimateFootballEloGap } from "@/lib/elo-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PredictiveBetSource =
  | "model" // prédiction explicite (modèle BDD/BSD)
  | "cotes" // dérivée des cotes bookmakers (dé-margées)
  | "elo-fallback" // dérivée du ΔElo
  | "surface-fallback"; // dérivée de la surface (heuristique de volume)

export type PredictiveBetLevel = "winner" | "total" | "handicap";

export type PredictiveBet = {
  level: PredictiveBetLevel;
  /** Icône affichée dans la pill (🏆 🎾 ⚽ 🏟️ ⚡). */
  icon: string;
  /** Label court affiché (ex: "Swiatek 2-0", "U 19.5 Games", "Confiance 88%"). */
  label: string;
  /** Probabilité estimée du pronostic [0-100]. */
  prob: number;
  source: PredictiveBetSource;
};

export type PredictiveBetsResult = {
  /** Favori de la rencontre (nom court). null si indécidable (50/50 sans cotes). */
  favoriteName: string | null;
  /** Probabilité du favori [0-100]. */
  favoriteProb: number;
  /** Confiance globale du pronostic [0-100]. */
  confidence: number;
  /** Handicap théorique en jeux (tennis) ou buts (foot) — négatif côté favori. */
  handicapLine: number | null;
  /** Les 3 pronostics (max 3). */
  bets: PredictiveBet[];
};

// ---------------------------------------------------------------------------
// Helpers purement calculatoires
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** P(X > k) avec X ~ Poisson(λ) → [0-100]. */
function poissonOver(k: number, lambda: number): number {
  if (lambda <= 0 || !Number.isFinite(lambda)) return 0;
  let cdf = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i <= k; i++) {
    cdf += term;
    term *= lambda / (i + 1);
    if (term < 1e-15 || !Number.isFinite(term)) break;
  }
  return clamp(Math.round((1 - cdf) * 100), 0, 100);
}

function impliedFromDecimal(odds: number | null | undefined): number {
  if (odds == null || odds <= 0 || !Number.isFinite(odds)) return 0;
  return (1 / odds) * 100;
}

/** Meilleure paire over/under : seuil dont la proba est la plus proche de 60%. */
function pickBestThreshold(
  candidates: { threshold: number; over: number }[],
): { threshold: number; over: number } {
  return candidates.reduce((best, c) => {
    const dBest = Math.abs(best.over - 60);
    const dC = Math.abs(c.over - 60);
    return dC < dBest ? c : best;
  }, candidates[0]);
}

/** Confiance globale depuis la proba du favori (fallback si pas de conf modèle). */
function deriveConfidence(favProb: number, modelConf?: number | null): number {
  if (modelConf != null && modelConf > 0) {
    return Math.round(clamp(modelConf * 100, 30, 95));
  }
  return Math.round(clamp((favProb - 50) * 1.4 + 40, 30, 95));
}

// ---------------------------------------------------------------------------
// Tennis
// ---------------------------------------------------------------------------

/** Espérance de games par SET par surface (best-of-3) — fallback volume. */
const TENNIS_GAMES_PER_SET: Record<string, number> = {
  Dur: 9.7,
  "Terre battue": 9.3,
  Gazon: 10.0,
};

type TennisContext = {
  favName: string;
  favProb: number;
  source: PredictiveBetSource;
};

function tennisWinner(m: TennisMatch): TennisContext {
  // 1. Modèle explicite (probA/probB) — priorité absolue.
  if (!m.synthetic && !m.insufficientData && m.probA > 0 && m.probB > 0) {
    const fav = m.probA >= m.probB ? m.playerA : m.playerB;
    return { favName: fav.shortName, favProb: Math.max(m.probA, m.probB), source: "model" };
  }
  // 2. Cotes bookmakers dé-margées (consensus).
  if (m.odds && m.odds.decimalA > 0 && m.odds.decimalB > 0) {
    const impA = impliedFromDecimal(m.odds.decimalA);
    const impB = impliedFromDecimal(m.odds.decimalB);
    const tot = impA + impB;
    if (tot > 0) {
      const pA = (impA / tot) * 100;
      const fav = pA >= 50 ? m.playerA : m.playerB;
      return { favName: fav.shortName, favProb: Math.max(pA, 100 - pA), source: "cotes" };
    }
  }
  // 3. Fallback ΔElo (logistique standard).
  const pA = eloImpliedProb(m.playerA.elo, m.playerB.elo) * 100;
  const fav = pA >= 50 ? m.playerA : m.playerB;
  return { favName: fav.shortName, favProb: Math.max(pA, 100 - pA), source: "elo-fallback" };
}

/** Score exact théorique (best-of-3) selon la domination. */
function tennisScoreline(favProb: number): string {
  if (favProb >= 80) return "2-0";
  if (favProb >= 62) return "2-1";
  return "";
}

/** Handicap en jeux côté favori selon la domination théorique. */
function tennisHandicap(favProb: number): number | null {
  if (favProb >= 86) return -6.5;
  if (favProb >= 76) return -5.5;
  if (favProb >= 66) return -4.5;
  if (favProb >= 58) return -3.5;
  return null; // domination insuffisante → pas de handicap fiable
}

/** Niveau 2 tennis : Over/Under Games — modèle explicite sinon Poisson(surface, ΔElo). */
function tennisTotalBet(m: TennisMatch, ctx: TennisContext): PredictiveBet {
  const rec = m.totalGamesPredictions?.recommendedBet;
  if (rec && (rec.direction === "over" || rec.direction === "under")) {
    return {
      level: "total",
      icon: "🎾",
      label: `${rec.direction === "over" ? "Over" : "Under"} ${rec.threshold} jeux`,
      prob: Math.round(rec.prob),
      source: "model",
    };
  }

  // Fallback : λ = baseline surface × 2.1 sets, ajusté par le ΔElo.
  const surface = m.stats?.surface ?? "Dur";
  const base = TENNIS_GAMES_PER_SET[surface] ?? 9.7;
  const gap = Math.abs(m.playerA.elo - m.playerB.elo);
  const lambda = base * 2.1 * (1 - 0.05 * clamp(gap / 400, 0, 1));
  const candidates = [
    { threshold: 18.5, over: poissonOver(18, lambda) },
    { threshold: 19.5, over: poissonOver(19, lambda) },
    { threshold: 21.5, over: poissonOver(21, lambda) },
  ];
  const best = pickBestThreshold(candidates);
  const over = best.over >= 60;
  return {
    level: "total",
    icon: "🎾",
    label: `${over ? "Over" : "Under"} ${best.threshold} jeux`,
    prob: over ? best.over : 100 - best.over,
    source: ctx.source === "cotes" ? "elo-fallback" : "surface-fallback",
  };
}

/** Niveau 3 tennis : handicap en jeux (ou score exact si domination insuffisante). */
function tennisHandicapBet(m: TennisMatch, ctx: TennisContext): PredictiveBet | null {
  const line = tennisHandicap(ctx.favProb);
  if (line == null) return null;
  const coverProb = Math.round(clamp(ctx.favProb - 18, 40, 90));
  return {
    level: "handicap",
    icon: "🏟️",
    label: `Handicap ${line} jeux`,
    prob: coverProb,
    source: ctx.source === "model" ? "model" : "elo-fallback",
  };
}

// ---------------------------------------------------------------------------
// Football
// ---------------------------------------------------------------------------

type FootballContext = {
  favName: string | null;
  favProb: number;
  source: PredictiveBetSource;
};

function footballWinner(m: FootballMatch): FootballContext {
  const { homeProb, awayProb } = m.prediction;
  if (homeProb > 0 && awayProb > 0 && (homeProb !== awayProb)) {
    const fav = homeProb >= awayProb ? m.home : m.away;
    return { favName: fav.shortName, favProb: Math.max(homeProb, awayProb), source: "model" };
  }
  // Fallback cotes 1X2 dé-margées.
  if (m.odds) {
    const impH = impliedFromDecimal(m.odds.home);
    const impD = impliedFromDecimal(m.odds.draw);
    const impA = impliedFromDecimal(m.odds.away);
    const tot = impH + impD + impA;
    if (tot > 0) {
      const p = { h: (impH / tot) * 100, a: (impA / tot) * 100 };
      if (Math.max(p.h, p.a) >= 52) {
        const fav = p.h >= p.a ? m.home : m.away;
        return { favName: fav.shortName, favProb: Math.max(p.h, p.a), source: "cotes" };
      }
    }
  }
  return { favName: null, favProb: 0, source: "elo-fallback" };
}

/** Score exact théorique (foot) selon la domination. */
function footballScoreline(favProb: number): string {
  if (favProb >= 60) return "2-0";
  if (favProb >= 52) return "1-0";
  return "";
}

/** Niveau 3 foot : handicap en buts selon l'écart Elo estimé. */
function footballHandicapLine(m: FootballMatch): number | null {
  const gap = estimateFootballEloGap(m);
  if (gap >= 300) return -1.5;
  if (gap >= 150) return -1.0;
  return null;
}

/** Niveau 2 foot : Over/Under 2.5 — modèle sinon Poisson(λ estimé depuis ΔElo). */
function footballTotalBet(m: FootballMatch, ctx: FootballContext): PredictiveBet {
  const over25 = m.prediction.over25Prob;
  if (over25 != null && over25 > 0 && over25 < 100) {
    const over = over25 >= 50;
    return {
      level: "total",
      icon: "⚽",
      label: `${over ? "Over" : "Under"} 2.5 Buts`,
      prob: over ? Math.round(over25) : Math.round(100 - over25),
      source: "model",
    };
  }

  // Fallback : λ buts = baseline ligue ajustée par l'écart Elo.
  const gap = estimateFootballEloGap(m);
  const lambda = 2.6 - 0.6 * clamp(gap / 400, 0, 1);
  const over = poissonOver(2, lambda);
  const overBool = over >= 50;
  return {
    level: "total",
    icon: "⚽",
    label: `${overBool ? "Over" : "Under"} 2.5 Buts`,
    prob: overBool ? over : 100 - over,
    source: ctx.source === "model" ? "elo-fallback" : "cotes",
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Génère les 3 paris prédits d'une rencontre (tennis ou football).
 * Toujours 3 pronostics quand un favori est identifiable (sinon moins) :
 *   1. Vainqueur (+ score exact théorique quand la domination est nette)
 *   2. Over/Under volume (games tennis / buts foot)
 *   3. Handicap théorique, ou Confiance globale si domination insuffisante
 */
export function computePredictiveBets(match: TennisMatch | FootballMatch): PredictiveBetsResult {
  // Discriminant : TennisMatch a playerA/playerB, FootballMatch a home/away.
  return "home" in match ? footballBets(match) : tennisBets(match);
}

function tennisBets(m: TennisMatch): PredictiveBetsResult {
  const ctx = tennisWinner(m);
  const score = tennisScoreline(ctx.favProb);
  const confidence = deriveConfidence(ctx.favProb, m.stats?.confidence);
  const line = tennisHandicap(ctx.favProb);

  const bets: PredictiveBet[] = [
    {
      level: "winner",
      icon: "🏆",
      label: score ? `${ctx.favName} ${score}` : `${ctx.favName} Victoire`,
      prob: Math.round(ctx.favProb),
      source: ctx.source,
    },
    tennisTotalBet(m, ctx),
  ];

  const handicapBet = tennisHandicapBet(m, ctx);
  bets.push(
    handicapBet ?? {
      level: "handicap",
      icon: "⚡",
      label: `Confiance ${confidence}%`,
      prob: confidence,
      source: ctx.source,
    },
  );

  return {
    favoriteName: ctx.favName,
    favoriteProb: Math.round(ctx.favProb),
    confidence,
    handicapLine: line,
    bets,
  };
}

function footballBets(m: FootballMatch): PredictiveBetsResult {
  const ctx = footballWinner(m);
  const confidence = deriveConfidence(ctx.favProb, null);
  const line = footballHandicapLine(m);

  const bets: PredictiveBet[] = [
    {
      level: "winner",
      icon: "🏆",
      label: ctx.favName
        ? footballScoreline(ctx.favProb)
          ? `${ctx.favName} ${footballScoreline(ctx.favProb)}`
          : `${ctx.favName} Victoire`
        : "Match serré",
      prob: Math.round(ctx.favProb || 50),
      source: ctx.source,
    },
    footballTotalBet(m, ctx),
  ];

  if (line != null && ctx.favName) {
    bets.push({
      level: "handicap",
      icon: "🏟️",
      label: `Handicap ${line}`,
      prob: Math.round(clamp(ctx.favProb - 15, 40, 90)),
      source: ctx.source,
    });
  } else {
    bets.push({
      level: "handicap",
      icon: "⚡",
      label: `Confiance ${confidence}%`,
      prob: confidence,
      source: ctx.source,
    });
  }

  return {
    favoriteName: ctx.favName,
    favoriteProb: Math.round(ctx.favProb),
    confidence,
    handicapLine: line,
    bets,
  };
}
