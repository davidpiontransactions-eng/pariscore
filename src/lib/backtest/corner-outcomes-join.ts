/**
 * corner-outcomes-join.ts — jointure des COTES BetMines avec les RÉSULTATS RÉELS de
 * corners, pour rendre les marchés corners backtestables.
 *
 * ## Pourquoi cette jointure est nécessaire
 *
 * Les fixtures BetMines portent `status: "FT"` mais **aucun score et aucun total de
 * corners**. Elles donnent la cote d'avant-match, jamais l'issue. Or un backtest sans
 * issue est un backtest impossible : on ne sait pas si le Over 6,5 a gagné.
 *
 * La donnée d'issue existe déjà, ailleurs : `match_stats_history` (SQLite) porte
 * `home_corners` / `away_corners` pour les matchs terminés, alimentée par le cron
 * `pariscore-cron-match-stats`. On ne réécrit donc ni l'accès DB (football-history-db.ts)
 * ni le scraper BetMines : on branche les deux.
 *
 * ## Ce que cette jointure ne fait PAS
 *
 * Elle n'invente aucune cote ni aucun résultat. Un match dont l'issue est inconnue ou
 * dont les noms ne s'apparient pas est **exclu**, jamais estimé. Le volume returned est
 * donc une mesure honnête de ce qui est réellement backtestable.
 *
 * ##.appariement des noms
 *
 * Les deux sources nomment les clubs différemment ("Brighton & Hove Albion" côté
 * BetMines, "Brighton" côté BSD). On apparie sur date + normalisation des noms
 * (casse, accents, ponctuation, suffixes de club), jamais sur une simple
 * sous-chaîne : voir `use-cornervalue-stats.ts` pour le cas inverse, où un fragment
 * générique ("Madrid") faisait matcher deux clubs différents.
 */

import { loadMatchStatsHistoryRange, type MatchStatsHistoryRow } from "@/lib/football-history-db";
import { BETMINES_LEAGUE_MAP } from "@/lib/betmines";

/** Issue réelle + cote d'avant-match d'un même match. */
export interface CornerMatchOutcome {
  /** Identifiant stable côté BetMines (`{leagueId}:{fixtureId}`). */
  matchId: string;
  /** YYYY-MM-DD (heure de coup d'envoi tronquée, comme en base). */
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  /** Corners réellement joués, domicile + extérieur. null si l'issue est inconnue. */
  actualCorners: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  /** Cotes BetMines d'avant-match, telles qu'archivées. */
  betminesOdds: {
    over75?: number;
    under75?: number;
    over85?: number;
    under85?: number;
    over95?: number;
    under95?: number;
    over105?: number;
    under105?: number;
  };
  /** true si les deux camps d'une paire Over/Under sont présents (pari calculable). */
  hasPairedCornersOdds: boolean;
}

/** Fixture BetMines brute (forme du JSON sur disque). */
export type BetminesFixtureInput = {
  id?: number | null;
  dateTime?: string | null;
  home?: { name?: string | null } | null;
  away?: { name?: string | null } | null;
  odds?: Record<string, string | number | undefined> | null;
};

/**
 * Normalise un nom de club pour l'appariement.
 *
 * Retire accents, ponctuation et mots generiques de club, puis trie les fragments
 * restants pour que l'ordre des mots n'importe pas.
 *
 * ## Limite assumee
 *
 * Cette normalisation NE franchit pas un diminutif : "Brighton & Hove Albion" et
 * "Brighton" n'ont aucun mot commun apres nettoyage, et "Real Madrid" / "Atletico
 * Madrid" doivent rester distincts. Relier un nom complet a son diminutif demande
 * une table d'alias explicite (scripts/team_name_mapping.py) — pas une heuristique,
 * qui risquerait de reboucler sur le piege "Madrid".
 *
 * Ces matchs sont donc comptés dans `stats.unmatchedByName` : la mesure reste
 * honnête, et `stats.matchedWithCorners` ne surestime jamais l'échantillon.
 */
export function normalizeTeamName(raw: string | null | undefined): string {
  if (!raw) return "";
  const NOISE = new Set([
    "fc", "cf", "sc", "ac", "as", "afc", "cd", "rc", "rcd", "us", "ss", "ssc",
    "cp", "cfc", "utc", "sd", "sv", "tsv", "fsv", "bsc", "vfl", "vfb", "tsg",
    "club", "calcio", "futbol", "football", "de", "the", "1899", "1900", "1846",
  ]);
  const base = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const words = base
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0 && !NOISE.has(w));
  return words.sort().join(" ");
}

/** Date ISO du jour, borne haute de la fenêtre d'historique. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? n : undefined;
}

function toOdds(raw: BetminesFixtureInput["odds"]): CornerMatchOutcome["betminesOdds"] {
  const o = raw ?? {};
  const out: CornerMatchOutcome["betminesOdds"] = {};
  for (const k of ["75", "85", "95", "105"] as const) {
    const over = num(o[`cornerOver${k}`]);
    const under = num(o[`cornerUnder${k}`]);
    if (over !== undefined) out[`over${k}` as keyof typeof out] = over;
    if (under !== undefined) out[`under${k}` as keyof typeof out] = under;
  }
  return out;
}

/** Une paire Over/Under complète sur au moins une ligne → pari calculable. */
function hasPair(odds: CornerMatchOutcome["betminesOdds"]): boolean {
  return (["75", "85", "95", "105"] as const).some(
    (k) => odds[`over${k}` as keyof typeof odds] !== undefined && odds[`under${k}` as keyof typeof odds] !== undefined,
  );
}

/**
 * Joint les fixtures BetMines aux résultats réels.
 *
 * @param fixturesByLeague  fixtures déjà chargées, indexées par leagueId BetMines.
 * @param fromISO / toISO   fenêtre d'historique à lire dans `match_stats_history`.
 */
export function joinCornerOutcomes(
  fixturesByLeague: Map<number, BetminesFixtureInput[]>,
  fromISO = "2000-01-01",
  toISO = todayISO(),
): { outcomes: CornerMatchOutcome[]; stats: JoinStats } {
  const history = loadMatchStatsHistoryRange(fromISO, toISO);

  // Index d'historique : `date|NOM_NORMALISE_HOME` -> lignes candidates.
  const byKey = new Map<string, MatchStatsHistoryRow[]>();
  for (const row of history) {
    const date = row.matchDate;
    if (!date) continue;
    const key = `${date}|${normalizeTeamName(row.homeTeam)}|${normalizeTeamName(row.awayTeam)}`;
    const list = byKey.get(key);
    if (list) list.push(row);
    else byKey.set(key, [row]);
  }

  const stats: JoinStats = {
    fixturesSeen: 0,
    fixturesWithOdds: 0,
    matchedHistory: 0,
    matchedWithCorners: 0,
    unmatchedByName: 0,
    matchedButNoCorners: 0,
    pairedOdds: 0,
  };
  const outcomes: CornerMatchOutcome[] = [];

  for (const [leagueId, fixtures] of fixturesByLeague) {
    for (const fx of fixtures) {
      stats.fixturesSeen++;
      const kickoff = (fx.dateTime ?? "").slice(0, 10);
      const homeName = fx.home?.name ?? "";
      const awayName = fx.away?.name ?? "";
      if (!kickoff || !homeName || !awayName) continue;

      const odds = toOdds(fx.odds);
      const hasAnyOdds = Object.keys(odds).length > 0;
      if (hasAnyOdds) stats.fixturesWithOdds++;

      const key = `${kickoff}|${normalizeTeamName(homeName)}|${normalizeTeamName(awayName)}`;
      const rows = byKey.get(key);
      if (!rows || rows.length === 0) {
        stats.unmatchedByName++;
        continue;
      }
      stats.matchedHistory++;

      // Plusieurs events peuvent partager date + noms (rare) : on garde la
      // premiere ligne qui porte reellement des corners.
      const withCorners = rows.find(
        (r): r is MatchStatsHistoryRow & { homeCorners: number; awayCorners: number } =>
          r.homeCorners != null && r.awayCorners != null,
      );
      if (!withCorners) {
        stats.matchedButNoCorners++;
        continue;
      }
      stats.matchedWithCorners++;

      const total = withCorners.homeCorners + withCorners.awayCorners;
      const paired = hasPair(odds);
      if (paired) stats.pairedOdds++;

      outcomes.push({
        matchId: `${leagueId}:${fx.id ?? ""}`,
        kickoff,
        homeTeam: homeName,
        awayTeam: awayName,
        actualCorners: total,
        homeCorners: withCorners.homeCorners,
        awayCorners: withCorners.awayCorners,
        betminesOdds: odds,
        hasPairedCornersOdds: paired,
      });
    }
  }

  return { outcomes, stats };
}

export type JoinStats = {
  fixturesSeen: number;
  fixturesWithOdds: number;
  matchedHistory: number;
  matchedWithCorners: number;
  unmatchedByName: number;
  matchedButNoCorners: number;
  pairedOdds: number;
};

/** Ligues BetMines effectivement couvertes par la table de correspondance. */
export function coveredBetminesLeagues(): { leagueId: number; slug: string }[] {
  return Object.entries(BETMINES_LEAGUE_MAP).map(([slug, leagueId]) => ({ slug, leagueId }));
}