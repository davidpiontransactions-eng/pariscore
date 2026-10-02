/**
 * Onglet Résultats foot (vague 2) — assemblage pur des verdicts de stratégies.
 *
 * Sources :
 *  - picks        : journal `data/top5-backtest/football.json` (cron
 *                   `pariscore-cron-top5-backtest` 05:15 UTC, rattrapage local
 *                   via `bun scripts/backfill-top5-backtest.ts --sport=football --days=N`) ;
 *  - règlement    : `settleFootballPick` (top5-backtest/football.ts) — UNIQUE
 *                   moteur de règlement, jamais réécrit ici ;
 *  - scores/stats  : BSD (`fetchBSDFootballFinishedRange`) + archives SQLite
 *                   (`football-history-db.ts` : match_stats_history, corner_history).
 *
 * P&L : mise fixe 1u, calculé uniquement sur les picks avec cote — convention
 * exacte de `aggregateStrategyStats` (top5-backtest/types.ts).
 */

import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { settleFootballPick } from "@/lib/top5-backtest/football";
import {
  aggregateStrategyStats,
  type Top5BacktestEntry,
  type Top5BacktestStatus,
} from "@/lib/top5-backtest/types";
import { STRATEGY_TOP5_KEYS, type StrategyTop5Key } from "@/lib/football-strategy-top5";
import type { CornerHistoryRow, MatchStatsHistoryRow } from "@/lib/football-history-db";

/** Label lisible des 13 stratégies (même vocabulaire que le hero header). */
export const STRATEGY_LABELS: Record<string, string> = {
  bestTeam: "Meilleure équipe",
  bestTeam1x2: "Favori 1X2",
  gagnant: "Gagnant",
  bestAttack: "Meilleure attaque",
  bestDefense: "Meilleure défense",
  doubleChance1X: "Double chance 1X",
  doubleChance2X: "Double chance 2X",
  doubleChance12: "Double chance 12",
  over15: "Over 1,5",
  under35: "Under 3,5",
  bttsYes: "Les 2 marquent",
  over65Corners: "Over 6,5 corners",
  dnb: "Draw No Bet",
};

const STRATEGY_KEY_SET = new Set<string>(STRATEGY_TOP5_KEYS);

export function strategyLabel(key: string): string {
  return STRATEGY_LABELS[key] ?? key;
}

/* ------------------------------------------------------------------ */
/* P&L — convention aggregateStrategyStats (1u fixe, cotes uniquement) */
/* ------------------------------------------------------------------ */

/** Gain/perte unitaire d'un pick réglé. Sans cote : 0 (exclu du ROI). */
export function pnlUnit(status: Top5BacktestStatus, odds: number | null): number {
  if (odds == null || odds <= 1) return 0;
  if (status === "won") return round2(odds - 1);
  if (status === "lost") return -1;
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Enrichissement corners / tirs cadrés                                */
/* ------------------------------------------------------------------ */

export type MatchStatsView = {
  corners: { home: number | null; away: number | null };
  sot: { home: number | null; away: number | null };
  source: "live_stats" | "match_stats_history" | "corner_history" | "none";
};

/**
 * Chaîne d'enrichissement : live BSD d'abord (fraîcheur), puis archives
 * `match_stats_history` (SOT + corners), puis `corner_history` (corners seuls).
 * Toutes les valeurs restent null quand la donnée manque — jamais inventée.
 */
export function matchStatsView(
  match: BSDFootballMatch | undefined,
  hist: MatchStatsHistoryRow | undefined,
  cornersRow: CornerHistoryRow | undefined,
): MatchStatsView {
  const ls = match?.live_stats;
  const lsH = ls?.home?.corner_kicks;
  const lsA = ls?.away?.corner_kicks;
  const lsSh = ls?.home?.shots_on_target;
  const lsSa = ls?.away?.shots_on_target;
  if (lsH != null || lsA != null || lsSh != null || lsSa != null) {
    return {
      corners: { home: lsH ?? null, away: lsA ?? null },
      sot: { home: lsSh ?? null, away: lsSa ?? null },
      source: "live_stats",
    };
  }
  if (hist && (hist.homeCorners != null || hist.awayCorners != null || hist.homeSot != null)) {
    return {
      corners: { home: hist.homeCorners, away: hist.awayCorners },
      sot: { home: hist.homeSot, away: hist.awaySot },
      source: "match_stats_history",
    };
  }
  if (cornersRow && (cornersRow.homeCorners != null || cornersRow.awayCorners != null)) {
    return {
      corners: { home: cornersRow.homeCorners, away: cornersRow.awayCorners },
      sot: { home: null, away: null },
      source: "corner_history",
    };
  }
  return {
    corners: { home: null, away: null },
    sot: { home: null, away: null },
    source: "none",
  };
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export type SettledPick = {
  strategyKey: string;
  strategyLabel: string;
  pickDesc: string;
  pick: string | null;
  value: number;
  odds: number | null;
  closingOdds: number | null;
  status: Top5BacktestStatus;
  /** Gain/perte en unités (1u fixe) — 0 si non réglé ou sans cote. */
  pnl: number;
  score: string | null;
};

export type SettledMatch = {
  matchId: string;
  league: string;
  kickoff: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  stats: MatchStatsView;
  picks: SettledPick[];
  pnl: number;
};

export type StrategySummary = {
  strategyKey: string;
  label: string;
  n: number;
  wins: number;
  losses: number;
  voids: number;
  pending: number;
  winRatePct: number | null;
  pnl: number;
  roi: { nWithOdds: number; roiPct: number | null };
};

export type SettledResults = {
  from: string;
  to: string;
  matches: SettledMatch[];
  summary: {
    nPicks: number;
    wins: number;
    losses: number;
    voids: number;
    pending: number;
    nWithOdds: number;
    pnl: number;
    roiPct: number | null;
    byStrategy: StrategySummary[];
  };
  generatedAt: string;
};

const KEY_ORDER = new Map(STRATEGY_TOP5_KEYS.map((k, i) => [k, i] as const));

function byStrategyOrder(a: SettledPick, b: SettledPick): number {
  return (KEY_ORDER.get(a.strategyKey as StrategyTop5Key) ?? 99) - (KEY_ORDER.get(b.strategyKey as StrategyTop5Key) ?? 99);
}

/**
 * Règle les picks encore `pending` avec le moteur unique `settleFootballPick`.
 * Un pick déjà réglé (won/lost/void) n'est JAMAIS rétrogradé — le journal fait
 * foi (contrat `upsertTop5Entries`). Les clés hors 13 stratégies (autres
 * moteurs du store) gardent leur statut tel quel.
 */
export function settleEntry(
  entry: Top5BacktestEntry,
  match: BSDFootballMatch | undefined,
): Pick<Top5BacktestEntry, "status" | "odds" | "closingOdds" | "score"> {
  if (entry.status !== "pending") {
    return {
      status: entry.status,
      odds: entry.odds,
      closingOdds: entry.closingOdds,
      score: entry.score,
    };
  }
  if (!match || match.home_score == null || match.away_score == null) {
    return {
      status: "pending",
      odds: entry.odds,
      closingOdds: entry.closingOdds,
      score: entry.score,
    };
  }
  if (!STRATEGY_KEY_SET.has(entry.strategyKey)) {
    return {
      status: "pending",
      odds: entry.odds,
      closingOdds: entry.closingOdds,
      score: entry.score,
    };
  }
  const s = settleFootballPick(
    entry.strategyKey as StrategyTop5Key,
    (entry.pick as "home" | "away" | null) ?? null,
    match,
  );
  return {
    status: s.status,
    odds: entry.odds ?? (s.odds != null && s.odds > 1 ? s.odds : null),
    closingOdds: s.closingOdds ?? entry.closingOdds,
    score: s.score ?? entry.score,
  };
}

export type BuildInput = {
  entries: Top5BacktestEntry[];
  matchesById: Map<string, BSDFootballMatch>;
  statsById?: Map<string, MatchStatsHistoryRow>;
  cornersById?: Map<string, CornerHistoryRow>;
  from: string;
  to: string;
};

/** Assemble le payload de la route `/api/football/results/settled`. */
export function buildSettledResults(input: BuildInput): SettledResults {
  const { entries, matchesById, from, to } = input;
  const statsById = input.statsById ?? new Map();
  const cornersById = input.cornersById ?? new Map();

  const byMatch = new Map<string, SettledMatch>();
  const flat: SettledPick[] = [];
  const healed: Top5BacktestEntry[] = [];

  for (const e of entries) {
    if (!STRATEGY_KEY_SET.has(e.strategyKey)) continue;
    const match = matchesById.get(e.matchId);
    const settled = settleEntry(e, match);
    healed.push({ ...e, ...settled });
    const pick: SettledPick = {
      strategyKey: e.strategyKey,
      strategyLabel: strategyLabel(e.strategyKey),
      pickDesc: e.pickDesc,
      pick: e.pick ?? null,
      value: e.value,
      odds: settled.odds,
      closingOdds: settled.closingOdds,
      status: settled.status,
      pnl: pnlUnit(settled.status, settled.odds),
      score: settled.score ?? null,
    };
    flat.push(pick);

    let row = byMatch.get(e.matchId);
    if (!row) {
      const hist = statsById.get(e.matchId);
      const cor = cornersById.get(e.matchId);
      row = {
        matchId: e.matchId,
        league: e.league || (match?.league.name ?? "—"),
        kickoff: e.kickoff,
        home: match?.home_team ?? hist?.homeTeam ?? "—",
        away: match?.away_team ?? hist?.awayTeam ?? "—",
        homeScore: match?.home_score ?? hist?.homeScore ?? null,
        awayScore: match?.away_score ?? hist?.awayScore ?? null,
        stats: matchStatsView(match, hist, cor),
        picks: [],
        pnl: 0,
      };
      byMatch.set(e.matchId, row);
    }
    row.picks.push(pick);
    row.pnl = round2(row.pnl + pick.pnl);
  }

  const matches = Array.from(byMatch.values());
  for (const m of matches) m.picks.sort(byStrategyOrder);
  matches.sort((a, b) => b.kickoff.localeCompare(a.kickoff));

  // Agrégats par stratégie : réutilise la convention ROI du store, sur les
  // copies déjà replélées (les pending rattrapés ne doivent pas rester pending).
  const agg = aggregateStrategyStats(healed, STRATEGY_TOP5_KEYS);
  const byStrategy: StrategySummary[] = STRATEGY_TOP5_KEYS.map((key) => {
    const s = agg[key];
    const list = flat.filter((p) => p.strategyKey === key);
    return {
      strategyKey: key,
      label: strategyLabel(key),
      n: s.n,
      wins: s.wins,
      losses: s.losses,
      voids: s.voids,
      pending: s.pending,
      winRatePct: s.winRatePct != null ? round2(s.winRatePct) : null,
      pnl: round2(list.reduce((a, p) => a + p.pnl, 0)),
      roi: s.roi,
    };
  });

  const nWithOdds = flat.filter((p) => p.odds != null && p.odds > 1).length;
  const pnl = round2(flat.reduce((a, p) => a + p.pnl, 0));

  return {
    from,
    to,
    matches,
    summary: {
      nPicks: flat.length,
      wins: flat.filter((p) => p.status === "won").length,
      losses: flat.filter((p) => p.status === "lost").length,
      voids: flat.filter((p) => p.status === "void").length,
      pending: flat.filter((p) => p.status === "pending").length,
      nWithOdds,
      pnl,
      roiPct: nWithOdds > 0 ? round2((pnl / nWithOdds) * 100) : null,
      byStrategy,
    },
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Fenêtre from/to                                                     */
/* ------------------------------------------------------------------ */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WINDOW_DAYS = 31;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD ET date réelle (rejecte 2026-13-99 qu'un simple regex accepte). */
function validDay(s: string | null | undefined): s is string {
  return !!s && DAY_RE.test(s) && Number.isFinite(Date.parse(s));
}

/**
 * Parse `?from=&to=` (YYYY-MM-DD). Défaut : `to` = aujourd'hui, `from` = `to`
 * − (`windowDays` − 1) jours (7 jours pour les résultats, 30 pour le backtest
 * marchés). Plafond 31 jours — au-delà le volume BSD devenait ingérable
 * (journée mondiale > 200 matchs finis).
 */
export function parseWindow(
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
  windowDays = 7,
): { from: string; to: string } {
  const today = ymd(new Date());
  const to = validDay(toRaw) ? toRaw : today;
  const span = Math.max(1, Math.min(MAX_WINDOW_DAYS, windowDays)) - 1;
  let from = validDay(fromRaw) ? fromRaw : ymd(new Date(Date.parse(to) - span * 86400_000));
  let end = to;
  if (from > end) [from, end] = [end, from];
  const spanDays = Math.round((Date.parse(end) - Date.parse(from)) / 86400_000);
  if (spanDays > MAX_WINDOW_DAYS) {
    from = ymd(new Date(Date.parse(end) - MAX_WINDOW_DAYS * 86400_000));
  }
  return { from, to: end };
}
