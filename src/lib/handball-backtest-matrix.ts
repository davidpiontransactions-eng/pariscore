// Backtest matrice handball : 8 marchés × N championnats.
//
// Source de vérité : table `handball_match_history` (pariscore.db, ~7 700
// matchs / 166 ligues sur 7 mois) — AUCUNE cote réelle pour le passé →
// ROI en cotes simulées AVG_ODDS_* (mêmes protocoles que handball-backtest.ts,
// walk-forward sans lookahead, nul = perdant 1X2).
//
// Réutilisation stricte : `runHandballBacktest(finished, league)` fait déjà le
// walk-forward par ligue (filtre AVANT la boucle → coût O(n²) par ligue mais
// n_ligue ≈ 150-300 → ~1 s pour 16 ligues). Aucune logique de règlement dupliquée.
//
// Sortie : cells[league][market] = {nBets, wins, hitRate, profitU, roiPct, sampleOk}
// (sampleOk = nBets ≥ MIN_SAMPLE_BETS → sous ce seuil le ROI est du bruit).

import {
  runHandballBacktest,
  MIN_SAMPLE_BETS,
  type BacktestStrategyRow,
} from "./handball-backtest";
import { teamHashId } from "./handball-flashscore";
import {
  HANDBALL_STRATEGY_DEFS,
  type HandballStrategyKey,
} from "./handball-strategy-top8";
import type { HandballMatch } from "./handball-data";
import type { HistoryMatch } from "./handball-history-stats";

// ─── Types ───

/** Cellule de la matrice : perf d'un marché sur une ligue (ou global). */
export type MatrixCell = {
  nBets: number;
  wins: number;
  hitRate: number | null;
  profitU: number;
  roiPct: number | null;
  /** false si nBets < MIN_SAMPLE_BETS → ROI = bruit, à ne pas surinterpréter. */
  sampleOk: boolean;
};

export type MatrixMarket = {
  key: string;
  label: string;
  emoji: string;
  market: string;
  odds: number | null;
};

export type MatrixLeagueRow = {
  league: string;
  nMatches: number;
  /** Cells indexées par clé de marché (8 marchés). */
  cells: Record<string, MatrixCell>;
  global: MatrixCell;
};

export type BacktestMatrixResult = {
  window: "full" | "d30";
  /** Période couverte (première/ dernière date du sous-ensemble). */
  from: string | null;
  to: string | null;
  nMatches: number;
  nLeagues: number;
  markets: MatrixMarket[];
  /** Ligues classées par nombre de matchs (top `topLeagues`). */
  leagues: MatrixLeagueRow[];
  /** Agrégat toutes ligues confondues. */
  global: Record<string, MatrixCell>;
  globalCell: MatrixCell;
  methodology: string;
  simulatedOdds: true;
  source: "handball_match_history";
  minSampleBets: number;
  computedAt: string;
};

const METHODOLOGY =
  "Backtest walk-forward par championnat (moteur handball-backtest.ts) : " +
  "matchs triés par coup d'envoi, forme uniquement antérieure (anti-lookahead), " +
  "match nul = perdant pour les 1X2, cotes 1xbet SIMULÉES (favori 1.55, Over 55.5 " +
  "1.90, Under 62.5 1.85, HC -4.5 1.90, BTTS 1.80, MT 1.70) car l'historique " +
  "ne contient pas de cotes. Mise flat 1u. sampleOk = n ≥ " +
  `${MIN_SAMPLE_BETS} paris (sous ce seuil, ROI = bruit).`;

// ─── Adaptateur HistoryMatch → HandballMatch ───

/**
 * Convertit une ligne d'historique en HandballMatch « finished ».
 * ids d'équipes hashés sur les clés NORMALISÉES (home_key/away_key) → le form
 * store agrège la même équipe entre les 2 sources de la table (BetExplorer et
 * Flashscore normalisent pareil). NB : ids ≠ de ceux du snapshot Flashscore
 * (qui hash `team:<nom brut>`) — 2 form stores séparés, sans impact ici puisque
 * le walk-forward ne consomme que ce convertisseur.
 */
export function historyToHandballMatch(h: HistoryMatch, index: number): HandballMatch {
  const kickoff = h.timeUtc ? h.timeUtc : `${h.date}T12:00:00.000Z`;
  const leagueName = h.league || "Inconnu";
  const colon = leagueName.indexOf(":");
  return {
    // id de match : unique, jamais utilisé par les specs de règlement
    id: teamHashId(`m:${h.homeKey}|${h.awayKey}|${h.date}|${index}`),
    league: {
      id: teamHashId(`lg:${leagueName}`),
      name: leagueName,
      // pays fourni par la DB (« Germany: Bundesliga » → « Germany »), sinon
      // dérivé du nom de ligue, sinon nom entier
      country: h.country || (colon > 0 ? leagueName.slice(0, colon).trim() : leagueName),
      countryCode: "",
    },
    home: { id: teamHashId(h.homeKey), name: h.home },
    away: { id: teamHashId(h.awayKey), name: h.away },
    kickoff,
    status: "finished",
    score: {
      home: h.homeGoals,
      away: h.awayGoals,
      ...(h.homeHalf != null ? { homeHalf: h.homeHalf } : {}),
      ...(h.awayHalf != null ? { awayHalf: h.awayHalf } : {}),
    },
  };
}

// ─── Calcul de la matrice ───

const cellOf = (row: BacktestStrategyRow): MatrixCell => ({
  nBets: row.nBets,
  wins: row.wins,
  hitRate: row.hitRate,
  profitU: row.profitU,
  roiPct: row.roiPct,
  sampleOk: row.sampleOk,
});

/**
 * Calcule la matrice marchés × championnats sur l'historique DB.
 *
 * opts.window     full = tout l'historique ; d30 = 30 derniers jours
 * opts.topLeagues nombre max de ligues (défaut 16)
 * opts.minLeagueMatches matchs minimum par ligue pour être retenue (défaut 20)
 */
export function computeBacktestMatrix(
  history: readonly HistoryMatch[],
  opts?: { window?: "full" | "d30"; topLeagues?: number; minLeagueMatches?: number },
): BacktestMatrixResult {
  const window = opts?.window ?? "full";
  const topLeagues = opts?.topLeagues ?? 16;
  const minMatches = opts?.minLeagueMatches ?? 20;

  // 1. Fenêtre + tri chronologique
  let rows = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (window === "d30") {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    rows = rows.filter((r) => r.date >= cutoff);
  }
  const matches = rows.map((h, i) => historyToHandballMatch(h, i));

  // 2. Groupement par ligue (comptage puis top-N)
  const byLeague = new Map<string, HandballMatch[]>();
  for (const m of matches) {
    const k = m.league.name;
    if (!byLeague.has(k)) byLeague.set(k, []);
    byLeague.get(k)!.push(m);
  }
  const ranked = [...byLeague.entries()]
    .filter(([, list]) => list.length >= minMatches)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, topLeagues);

  // 3. Global (toutes ligues, y compris celles sous le seuil)
  const globalRun = runHandballBacktest(matches, "all");
  // Ordre canonique des marchés (HANDBALL_STRATEGY_DEFS) : le run est trié par
  // ROI, l'ordre changerait entre full et d30 → chips qui sautent au toggle.
  const markets: MatrixMarket[] = [];
  for (const key of Object.keys(HANDBALL_STRATEGY_DEFS) as HandballStrategyKey[]) {
    const s = globalRun.strategies.find((x) => x.key === key);
    if (s) markets.push({ key, label: s.label, emoji: s.emoji, market: s.market, odds: s.odds });
  }
  const global: Record<string, MatrixCell> = {};
  for (const s of globalRun.strategies) global[s.key] = cellOf(s);
  const globalCell: MatrixCell = {
    nBets: globalRun.global.nBets,
    wins: globalRun.global.wins,
    hitRate: globalRun.global.hitRate,
    profitU: globalRun.global.profitU,
    roiPct: globalRun.global.roiPct,
    sampleOk: globalRun.global.nBets >= MIN_SAMPLE_BETS,
  };

  // 4. Walk-forward autonome par ligue (filtre avant boucle → coût maîtrisé)
  const leagues: MatrixLeagueRow[] = ranked.map(([name, list]) => {
    const run = runHandballBacktest(list, name);
    const cells: Record<string, MatrixCell> = {};
    for (const s of run.strategies) cells[s.key] = cellOf(s);
    return {
      league: name,
      nMatches: list.length,
      cells,
      global: {
        nBets: run.global.nBets,
        wins: run.global.wins,
        hitRate: run.global.hitRate,
        profitU: run.global.profitU,
        roiPct: run.global.roiPct,
        sampleOk: run.global.nBets >= MIN_SAMPLE_BETS,
      },
    };
  });

  return {
    window,
    from: rows.length ? rows[0].date : null,
    to: rows.length ? rows[rows.length - 1].date : null,
    nMatches: matches.length,
    nLeagues: byLeague.size,
    markets,
    leagues,
    global,
    globalCell,
    methodology: METHODOLOGY,
    simulatedOdds: true,
    source: "handball_match_history",
    minSampleBets: MIN_SAMPLE_BETS,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Filtrage ligue pour le popup : accepte le nom calendrier (« Bundesliga »)
 * comme le nom DB préfixé (« Germany: Bundesliga »).
 *
 * `country` est testé EN PREMIER : 14 suffixes sont réellement dupliqués en
 * base (« Division 1 », « 1. Division », « Extraliga », « Premijer Liga »…)
 * → sans le pays, on risque d'afficher les perfs d'un autre championnat
 * (review 2026-09-25).
 */
export function filterMatrixByLeague(
  matrix: BacktestMatrixResult,
  league: string,
  country?: string,
): MatrixLeagueRow | null {
  const wanted = league.trim().toLowerCase();
  if (!wanted) return null;
  const hit = (n: string) =>
    n === wanted || n.endsWith(`: ${wanted}`) || wanted.endsWith(`: ${n}`);
  const c = country?.trim().toLowerCase();
  if (c) {
    const byCountry = matrix.leagues.find(
      (l) => l.league.toLowerCase().startsWith(`${c}:`) && hit(l.league.toLowerCase())
    );
    if (byCountry) return byCountry;
  }
  return matrix.leagues.find((l) => hit(l.league.toLowerCase())) ?? null;
}
