// Moteur backtest ROI handball — rejoue les 8 stratégies en walk-forward.
//
// Problème : odds[] historiques vides → pas de ROI réel calculable.
// Solution pragmatique : chaque pari est réglé à une cote moyenne 1xbet
// simulée (constantes AVG_ODDS_* ci-dessous, justifiées une par une).
// Protocole honnête : tri chronologique, forme construite UNIQUEMENT sur
// les matchs antérieurs (pas de lookahead), match nul = perdant pour les
// paris 1X2 (on joue le 1 ou le 2, jamais le X).

import type { HandballMatch } from "./handball-data";
import {
  buildFormStore,
  ppg,
  HANDBALL_STRATEGY_DEFS,
  type HandballStrategyKey,
} from "./handball-strategy-top8";

// ─── Cotes moyennes 1xbet simulées ───
// Justifications (marché handball 1xbet, septembre 2026) :
// - Favori 1X2 net : 1.40–1.70 → 1.55 (milieu de fourchette).
// - Totaux Over/Under standards : 1.85–1.95 → 1.90 / 1.85
//   (Under légèrement taxé : le public joue l'Over au hand, totaux hauts).
// - Handicap -4.5 : ligne standard → 1.90.
// - BTTS 30+ (les deux à 30) : marché corrélé, taxé → 1.80.
// - Leader MT du favori de forme : 1.60–1.80 → 1.70.

/** 1X2 favori (bestTeam + bestTeam1x2) */
export const AVG_ODDS_FAV_1X2 = 1.55;
/** Over 55.5 */
export const AVG_ODDS_OVER_55_5 = 1.9;
/** Under 62.5 */
export const AVG_ODDS_UNDER_62_5 = 1.85;
/** Handicap -4.5 du favori */
export const AVG_ODDS_HANDICAP = 1.9;
/** Les deux équipes à 30+ */
export const AVG_ODDS_BTTS_30 = 1.8;
/** Leader à la mi-temps (pick forme) */
export const AVG_ODDS_HT_LEADER = 1.7;

/** Lignes jouées (miroir handball-strategy-top8.ts) */
export const LINE_OVER = 55.5;
export const LINE_UNDER = 62.5;
export const LINE_BTTS = 30;
export const LINE_HANDICAP = 4.5;

/** Seuil de significativité : en dessous, le ROI est du bruit. */
export const MIN_SAMPLE_BETS = 10;
/** Mise flat par pari (unité) */
export const FLAT_STAKE_U = 1;
/** Bankroll initiale pour la courbe Kelly (unités) */
export const KELLY_BANKROLL_START_U = 100;
/** Demi-Kelly (prudence) + plafond de mise anti-ruine */
export const KELLY_FRACTION = 0.5;
export const KELLY_MAX_STAKE_U = 5;

// ─── Types résultat ───

export type BacktestStrategyRow = {
  key: HandballStrategyKey;
  label: string;
  emoji: string;
  market: string;
  /** Cote simulée jouée, null si stratégie non rejouable sans cotes marché */
  odds: number | null;
  nBets: number;
  wins: number;
  hitRate: number | null;
  /** Profit net en unités (flat 1u) */
  profitU: number;
  /** ROI = profit / misé, null si 0 pari */
  roiPct: number | null;
  /** Profit net en unités avec mises demi-Kelly */
  profitKellyU: number;
  /** Profit cumulé flat après chaque pari (courbe) */
  curve: number[];
  /** false si nBets < MIN_SAMPLE_BETS (ROI = bruit) ou 0 pari */
  sampleOk: boolean;
  /** Raison quand nBets = 0 */
  note?: string;
};

export type HandballBacktestResult = {
  league: string;
  nMatches: number;
  leagues: string[];
  strategies: BacktestStrategyRow[];
  global: {
    nBets: number;
    wins: number;
    hitRate: number | null;
    profitU: number;
    roiPct: number | null;
    curve: number[];
  };
  methodology: string;
  simulatedOdds: true;
  computedAt: string;
};

const METHODOLOGY =
  "Backtest walk-forward : matchs terminés triés par heure de coup d'envoi, " +
  "forme construite uniquement sur les matchs antérieurs (aucun lookahead ; " +
  "équipe inconnue = prior neutre PPG 1.0, deux inconnues = pas de pari). " +
  "Match nul = pari 1X2 perdant (on joue le 1 ou le 2, jamais le X). " +
  "Cotes historiques absentes du snapshot → cotes moyennes 1xbet simulées " +
  "(favori 1X2 @1.55, Over 55.5 @1.90, Under 62.5 @1.85, handicap -4.5 @1.90, " +
  "BTTS 30+ @1.80, leader MT @1.70). Mise flat 1u + variante demi-Kelly " +
  "(probabilité = hit-rate expansif lissé Laplace, plafond 5u). " +
  "Value Bet requiert des cotes marché → 0 pari rejouable. " +
  "Snapshot multi-ligues : les équipes s'y répètent rarement → stratégies " +
  "de forme sous-échantillonnées (n<10 = bruit, à réévaluer quand le " +
  "snapshot grossira).";

type Side = "home" | "away";

type BetOutcome = { win: boolean; skip: boolean };

type StrategySpec = {
  odds: number;
  market: string;
  /** Construit le pick + règle le pari. skip = pas de signal (pas de forme / HT manquante). */
  settle: (m: HandballMatch, formOf: (teamId: number) => WalkForm) => BetOutcome;
};

/** Forme walk-forward d'une équipe : PPG récent (L5/L10 comme le moteur) + PPG carrière. */
type WalkForm = { ppgRecent: number; ppgCareer: number; known: boolean };

/** PPG neutre (1 pt/match = moyenne entre victoire à 2 et défaite à 0). */
const NEUTRAL_PPG = 1;

function formOfFactory(prior: HandballMatch[]) {
  const store = buildFormStore(prior);
  return (teamId: number): WalkForm => {
    const f = store.get(String(teamId));
    if (!f || f.gf.length === 0) return { ppgRecent: NEUTRAL_PPG, ppgCareer: NEUTRAL_PPG, known: false };
    return {
      // Même pondération L5 60% / L10 40% que la stratégie bestTeam
      ppgRecent: ppg(f, 5) * 0.6 + ppg(f, 10) * 0.4,
      ppgCareer: ppg(f, 1000),
      known: true,
    };
  };
}

function winnerOf(m: HandballMatch): Side | "draw" {
  if (!m.score) return "draw";
  if (m.score.home > m.score.away) return "home";
  if (m.score.away > m.score.home) return "away";
  return "draw";
}

/** Favori = meilleur PPG récent ; ex æquo → domicile (avantage terrain).
 * Équipe inconnue = prior neutre ; deux inconnues = pas de signal. */
function favRecent(m: HandballMatch, formOf: (teamId: number) => WalkForm): Side | null {
  const h = formOf(m.home.id);
  const a = formOf(m.away.id);
  if (!h.known && !a.known) return null;
  return h.ppgRecent >= a.ppgRecent ? "home" : "away";
}

// Spécifications de règlement par stratégie (7 rejouables, valueBet exclue).
const SPECS: Record<Exclude<HandballStrategyKey, "valueBet">, StrategySpec> = {
  bestTeam: {
    odds: AVG_ODDS_FAV_1X2,
    market: "1X2 favori (forme L5/L10)",
    settle: (m, formOf) => {
      const pick = favRecent(m, formOf);
      if (!pick || !m.score) return { win: false, skip: true };
      return { win: winnerOf(m) === pick, skip: false };
    },
  },
  bestTeam1x2: {
    odds: AVG_ODDS_FAV_1X2,
    market: "1X2 favori (bilan carrière)",
    settle: (m, formOf) => {
      // Proxy du favori marché : meilleur bilan carrière walk-forward
      // (bestTeam utilise la forme récente → signaux distincts).
      const h = formOf(m.home.id);
      const a = formOf(m.away.id);
      if ((!h.known && !a.known) || !m.score) return { win: false, skip: true };
      const pick: Side = h.ppgCareer >= a.ppgCareer ? "home" : "away";
      return { win: winnerOf(m) === pick, skip: false };
    },
  },
  over55: {
    odds: AVG_ODDS_OVER_55_5,
    market: `Over ${LINE_OVER}`,
    settle: (m) => {
      if (!m.score) return { win: false, skip: true };
      return { win: m.score.home + m.score.away > LINE_OVER, skip: false };
    },
  },
  under62: {
    odds: AVG_ODDS_UNDER_62_5,
    market: `Under ${LINE_UNDER}`,
    settle: (m) => {
      if (!m.score) return { win: false, skip: true };
      return { win: m.score.home + m.score.away < LINE_UNDER, skip: false };
    },
  },
  handicap: {
    odds: AVG_ODDS_HANDICAP,
    market: `Handicap favori -${LINE_HANDICAP}`,
    settle: (m, formOf) => {
      const pick = favRecent(m, formOf);
      if (!pick || !m.score) return { win: false, skip: true };
      const margin =
        pick === "home" ? m.score.home - m.score.away : m.score.away - m.score.home;
      return { win: margin > LINE_HANDICAP, skip: false };
    },
  },
  btts30: {
    odds: AVG_ODDS_BTTS_30,
    market: `Les deux à ${LINE_BTTS}+`,
    settle: (m) => {
      if (!m.score) return { win: false, skip: true };
      return { win: m.score.home >= LINE_BTTS && m.score.away >= LINE_BTTS, skip: false };
    },
  },
  htLeader: {
    odds: AVG_ODDS_HT_LEADER,
    market: "Leader MT (pick forme)",
    settle: (m, formOf) => {
      const pick = favRecent(m, formOf);
      const hh = m.score?.homeHalf;
      const ha = m.score?.awayHalf;
      if (!pick || hh == null || ha == null) return { win: false, skip: true };
      if (hh === ha) return { win: false, skip: false };
      const homeLeads = hh > ha;
      return { win: (pick === "home") === homeLeads, skip: false };
    },
  },
};

function emptyRow(
  key: HandballStrategyKey,
  odds: number | null,
  market: string,
  note?: string,
): BacktestStrategyRow {
  const def = HANDBALL_STRATEGY_DEFS[key];
  return {
    key,
    label: def.label,
    emoji: def.emoji,
    market,
    odds,
    nBets: 0,
    wins: 0,
    hitRate: null,
    profitU: 0,
    roiPct: null,
    profitKellyU: 0,
    curve: [],
    sampleOk: false,
    note,
  };
}

/**
 * Rejoue les stratégies sur les matchs terminés (walk-forward chronologique).
 * @param finished — matchs terminés avec score (le tri chrono est fait ici).
 * @param league — filtre ligue ("all" = toutes) ; le filtre s'applique AVANT
 *   le walk-forward (backtest par ligue autonome).
 */
export function runHandballBacktest(
  finished: HandballMatch[],
  league = "all",
): HandballBacktestResult {
  const leagues = [...new Set(finished.map((m) => m.league.name))].sort();
  const scoped =
    league === "all" ? [...finished] : finished.filter((m) => m.league.name === league);
  // Tri chronologique (kickoff ISO) — base du walk-forward
  scoped.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const keys = Object.keys(HANDBALL_STRATEGY_DEFS) as HandballStrategyKey[];
  const strategies: BacktestStrategyRow[] = keys.map((key) => {
    if (key === "valueBet") {
      return emptyRow(
        key,
        null,
        "EV+ vs cotes marché",
        "Non rejouable : cotes marché historiques absentes du snapshot.",
      );
    }
    const spec = SPECS[key];
    const row = emptyRow(key, spec.odds, spec.market);
    let cumul = 0;
    // État Kelly : hit-rate expansif lissé (Laplace 1/2) + bankroll
    let kWins = 0;
    let kBets = 0;
    let bankroll = KELLY_BANKROLL_START_U;
    for (let i = 0; i < scoped.length; i++) {
      const m = scoped[i];
      const formOf = formOfFactory(scoped.slice(0, i));
      const out = spec.settle(m, formOf);
      if (out.skip) continue;
      // Flat 1u
      row.nBets++;
      if (out.win) {
        row.wins++;
        cumul += spec.odds - 1;
      } else {
        cumul -= 1;
      }
      row.curve.push(Math.round(cumul * 100) / 100);
      // Demi-Kelly : p = hit-rate expansif lissé, mise plafonnée
      const p = (kWins + 1) / (kBets + 2);
      const b = spec.odds - 1;
      const f = (p * b - (1 - p)) / b;
      const stake = Math.min(Math.max(KELLY_FRACTION * f, 0) * bankroll, KELLY_MAX_STAKE_U);
      // Mise nulle si pas d'edge (hit-rate expansif trop bas) — le résultat
      // compte quand même pour le hit-rate des paris suivants.
      if (stake > 0) bankroll += out.win ? stake * b : -stake;
      if (out.win) kWins++;
      kBets++;
    }
    row.profitU = Math.round(cumul * 100) / 100;
    row.hitRate = row.nBets > 0 ? row.wins / row.nBets : null;
    row.roiPct = row.nBets > 0 ? (row.profitU / (row.nBets * FLAT_STAKE_U)) * 100 : null;
    row.profitKellyU = Math.round((bankroll - KELLY_BANKROLL_START_U) * 100) / 100;
    row.sampleOk = row.nBets >= MIN_SAMPLE_BETS;
    return row;
  });

  // Tri ROI décroissant (stratégies non rejouées en fin)
  strategies.sort((a, b) => (b.roiPct ?? Number.NEGATIVE_INFINITY) - (a.roiPct ?? Number.NEGATIVE_INFINITY));

  // Global flat (toutes stratégies rejouables confondues)
  const betRows = strategies.filter((s) => s.nBets > 0);
  const nBets = betRows.reduce((n, s) => n + s.nBets, 0);
  const wins = betRows.reduce((n, s) => n + s.wins, 0);
  const profitU = Math.round(betRows.reduce((n, s) => n + s.profitU, 0) * 100) / 100;
  // Courbe globale = somme cumulée : on concatène dans l'ordre chrono n'est pas
  // possible par stratégie (courbes déjà agrégées) → courbe = cumul du profit
  // moyen par rang de pari. Simplification documentée : courbe du cumul
  // séquentiel stratégie par stratégie (ordre du tableau trié).
  const curve: number[] = [];
  let g = 0;
  for (const s of betRows) {
    let prev = 0;
    for (const point of s.curve) {
      g += point - prev;
      prev = point;
      curve.push(Math.round(g * 100) / 100);
    }
  }

  return {
    league,
    nMatches: scoped.length,
    leagues,
    strategies,
    global: {
      nBets,
      wins,
      hitRate: nBets > 0 ? wins / nBets : null,
      profitU,
      roiPct: nBets > 0 ? (profitU / (nBets * FLAT_STAKE_U)) * 100 : null,
      curve,
    },
    methodology: METHODOLOGY,
    simulatedOdds: true,
    computedAt: new Date().toISOString(),
  };
}
