/**
 * Registre des marchés de paris football — backtest phase 1 (vague 3).
 *
 * Règle d'or : **jamais de cote synthétique**. Chaque marché déclaré indique la
 * source EXACTE de sa cote :
 *  - `bsd`            → cote réelle portée par le fixture BSD ;
 *  - `derived-devig`  → cote mathématiquement dérivée des cotes 1X2 réelles
 *                       dé-vigées (`fairProbs`) — affichée « Dérivé » dans l'UI ;
 *  - `betmines`/`none`→ marché **bloqué** (pas de cote historique réelle) :
 *                       la carte bloquée est un livrable, pas un trou.
 *
 * Le mapping `strategyKeys` dit quelles stratégies du moteur Top 5 parient sur
 * le marché — le backtest agrège leurs picks prospectifs (journal walk-forward).
 */

import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import type { StrategyTop5Key } from "@/lib/football-strategy-top5";
import { fairProbs } from "@/lib/football-strategy-top5";

export type MarketKey =
  | "1x2"
  | "dc1x"
  | "dc2x"
  | "dc12"
  | "over15"
  | "under35"
  | "btts"
  | "over65Corners"
  | "under115Corners"
  | "sot"
  | "lateGoal";

export type MarketOddsSource = "bsd" | "derived-devig" | "betmines" | "none";

export type MarketDef = {
  key: MarketKey;
  label: string;
  availability: "available" | "blocked";
  /** Raison du blocage (affichée sur la carte grise). */
  blockedReason?: string;
  oddsSource: MarketOddsSource;
  /** Libellé de source affiché côté UI (« Cote BSD réelle », « Dérivé »…). */
  oddsSourceLabel: string;
  /** Stratégies du moteur Top 5 dont les picks paris sur ce marché. */
  strategyKeys: StrategyTop5Key[];
  /**
   * Cote du marché pour un pick sur le fixture réel (null si absente).
   * Pour les marchés dérivés : probas justes de-vig → cote équitable 1/p.
   */
  oddsFor?: (m: BSDFootballMatch, pick: "home" | "away" | null) => number | null;
};

const num = (v: number | null | undefined): number | null =>
  v != null && Number.isFinite(v) && v > 1 ? v : null;

/** Cote équitable dérivée d'une proba juste (de-vig) — null si dégénérée. */
function fairOdds(prob: number | null): number | null {
  if (prob == null || prob <= 0) return null;
  const o = 1 / prob;
  return Number.isFinite(o) && o > 1 ? Math.round(o * 1000) / 1000 : null;
}

function derivedDcOdds(
  m: BSDFootballMatch,
  combo: "1x" | "2x" | "12",
): number | null {
  const p = fairProbs(m);
  if (!p) return null;
  if (combo === "1x") return fairOdds(p.home + p.draw);
  if (combo === "2x") return fairOdds(p.away + p.draw);
  return fairOdds(p.home + p.away);
}

/** Marchés backtestables en phase 1 (cotes réelles ou dérivées du réel). */
export const FOOTBALL_MARKETS: readonly MarketDef[] = [
  {
    key: "1x2",
    label: "1X2",
    availability: "available",
    oddsSource: "bsd",
    oddsSourceLabel: "Cote BSD réelle",
    strategyKeys: ["bestTeam", "bestTeam1x2", "gagnant"],
    oddsFor: (m, pick) => num(pick === "away" ? m.odds_away : m.odds_home),
  },
  {
    key: "dc1x",
    label: "Double chance 1X",
    availability: "available",
    oddsSource: "derived-devig",
    oddsSourceLabel: "Dérivé du dé-vig 1X2",
    strategyKeys: ["doubleChance1X"],
    oddsFor: (m) => derivedDcOdds(m, "1x"),
  },
  {
    key: "dc2x",
    label: "Double chance 2X",
    availability: "available",
    oddsSource: "derived-devig",
    oddsSourceLabel: "Dérivé du dé-vig 1X2",
    strategyKeys: ["doubleChance2X"],
    oddsFor: (m) => derivedDcOdds(m, "2x"),
  },
  {
    key: "dc12",
    label: "Double chance 12",
    availability: "available",
    oddsSource: "derived-devig",
    oddsSourceLabel: "Dérivé du dé-vig 1X2",
    strategyKeys: ["doubleChance12"],
    oddsFor: (m) => derivedDcOdds(m, "12"),
  },
  {
    key: "over15",
    label: "Over 1,5 buts",
    availability: "available",
    oddsSource: "bsd",
    oddsSourceLabel: "Cote BSD réelle",
    strategyKeys: ["over15"],
    oddsFor: (m) => num(m.odds_over_15),
  },
  {
    key: "under35",
    label: "Under 3,5 buts",
    availability: "available",
    oddsSource: "bsd",
    oddsSourceLabel: "Cote BSD réelle",
    strategyKeys: ["under35"],
    oddsFor: (m) => num(m.odds_under_35),
  },
  {
    key: "btts",
    label: "Les 2 marquent (BTTS)",
    availability: "available",
    oddsSource: "bsd",
    oddsSourceLabel: "Cote BSD réelle",
    strategyKeys: ["bttsYes"],
    oddsFor: (m) => num(m.odds_btts_yes),
  },
  {
    key: "over65Corners",
    label: "Over 6,5 corners",
    availability: "blocked",
    blockedReason:
      "Cotes corners BetMines (15 ligues, sans archive) — aucune cote réelle historique à backtester.",
    oddsSource: "betmines",
    oddsSourceLabel: "BetMines (non archivé)",
    strategyKeys: ["over65Corners"],
  },
  {
    key: "under115Corners",
    label: "Under 11,5 corners",
    availability: "blocked",
    blockedReason:
      "Cotes corners BetMines (15 ligues, sans archive) — aucune cote réelle historique à backtester.",
    oddsSource: "betmines",
    oddsSourceLabel: "BetMines (non archivé)",
    strategyKeys: [],
  },
  {
    key: "sot",
    label: "Tirs cadrés",
    availability: "blocked",
    blockedReason: "Aucune cote n'existe pour ce marché — interdit d'en inventer une.",
    oddsSource: "none",
    oddsSourceLabel: "Aucune cote",
    strategyKeys: [],
  },
  {
    key: "lateGoal",
    label: "But tardif > 70'",
    availability: "blocked",
    blockedReason:
      "Aucune cote + minutes de buts non archivées (collecte prévue en vague 4).",
    oddsSource: "none",
    oddsSourceLabel: "Aucune cote",
    strategyKeys: [],
  },
];

export const AVAILABLE_MARKETS: readonly MarketDef[] = FOOTBALL_MARKETS.filter(
  (m) => m.availability === "available",
);

export const BLOCKED_MARKETS: readonly MarketDef[] = FOOTBALL_MARKETS.filter(
  (m) => m.availability === "blocked",
);

/** Index marché par clé stratégie (un marché peut porter plusieurs stratégies). */
export const STRATEGY_TO_MARKET: ReadonlyMap<string, MarketDef> = (() => {
  const map = new Map<string, MarketDef>();
  for (const m of AVAILABLE_MARKETS) {
    for (const key of m.strategyKeys) map.set(key, m);
  }
  return map;
})();
