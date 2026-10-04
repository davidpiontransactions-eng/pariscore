// Backtesting handball piloté par l'HISTORIQUE en base (`handball_match_history`).
//
// ⚠️ Pourquoi ce module existe alors qu'un backtest existe déjà par ligue
// (`handball-mol-liga.ts`) : celui-ci lit un FIXTURE JSON figé, dont 9 matchs sur
// 15 sont synthétiques (« absents de la source Vitibet »). La table
// `handball_match_history` couvre 2 saisons réelles des 9 ligues du registre, avec
// les cotes 1X2 BetExplorer sur 1 444 matchs. Dupliquer 8 998 lignes réelles dans
// un JSON aurait été strictement pire : périmé dès le lendemain, et immense.
//
// Trois différences avec le backtest MOL Liga, toutes visibles côté UI :
//   1. AUCUN match synthétique — tout vient de la base. Le bandeau d'avertissement
//      n'a donc pas lieu d'être ici.
//   2. Le prior neutre est la moyenne de buts MESURÉE de la ligue, pas une
//      constante « tous championnats » (28.5 par équipe). L'écart entre ligues
//      est large : 63.5 buts/match au Herre Handbold contre 52.9 en 1. Division
//      Women.
//   3. La note de méthode suit la provenance réelle des cotes (voir
//      `methodologyNote` dans le moteur).
//
// SERVEUR UNIQUEMENT : `handball-history-db` ouvre la base via `bun:sqlite`, ce
// qui ne fonctionne pas dans un bundle client.

import {
  listHistoryLeagueStats,
  loadLeagueBacktestMatches,
  leagueGoalsPerMatch,
  type HistoryLeagueStats,
} from "./handball-history-db";
import { HAND_BALL_LEAGUES, getHandballLeague } from "./handball-league-registry";
import { runPariscoreBacktest, type BacktestResult } from "./handball-backtest-pariscore";

/** Ce que le sélecteur de ligue affiche, et rien de plus. */
export type BacktestLeagueOption = {
  id: string;
  /** Nom d'affichage court, sans le préfixe pays (le drapeau est à côté). */
  label: string;
  name: string;
  country: string;
  n: number;
  withOdds: number;
  minDate: string | null;
  maxDate: string | null;
  /** Moyenne de buts/match mesurée — null si la ligue n'a rien d'exploitable. */
  goalsPerMatch: number | null;
};

/**
 * Ligues proposées dans le backtest, triées par volume décroissant.
 *
 * On s'appuie sur `listHistoryLeagueStats()` (la base) et NON sur le registre
 * statique : une ligue sans aucun match n'a pas sa place dans un sélecteur, et
 * une ligue presente en base doit apparaître même si le registre l'ignore.
 * L'intersection des deux est donc l'ensemble proposé.
 */
export function listBacktestLeagues(): BacktestLeagueOption[] {
  const stats = listHistoryLeagueStats();
  if (stats.length === 0) return [];
  const byLeague = new Map(stats.map((s) => [s.league, s]));
  const out: BacktestLeagueOption[] = [];
  for (const lg of HAND_BALL_LEAGUES) {
    const s = byLeague.get(lg.name);
    if (!s || s.n === 0) continue;
    out.push({
      id: lg.id,
      // `France: Starligue` → `Starligue` : le pays est déjà dans `country`.
      label: lg.name.includes(": ") ? lg.name.slice(lg.name.indexOf(": ") + 2) : lg.name,
      name: lg.name,
      country: lg.country,
      n: s.n,
      withOdds: s.withOdds,
      minDate: s.minDate,
      maxDate: s.maxDate,
      goalsPerMatch: leagueGoalsPerMatch(lg.id),
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

export type LeagueBacktestPayload = {
  league: BacktestLeagueOption | null;
  result: BacktestResult | null;
  /** Message quand le backtest est indisponible (ligue inconnue, 0 match). */
  reason: string | null;
  updatedAt: string;
};

/**
 * Backtest d'une ligue, alimenté par la base.
 *
 * `leagueId` inconnu → `result: null` + `reason`, jamais une ligue par défaut
 * silencieusement substituée : l'utilisateur choisirait un championnat dont il
 * ne verrait pas les résultats.
 *
 * `withOddsOnly` par défaut : le marché 1N2 n'a de sens que sur des cotes
 * réelles. On expose le nombre de matchs SANS cote dans `league.n - withOdds`
 * pour que l'utilisateur puisse relancer en mode large s'il le souhaite.
 */
export function getLeagueBacktest(
  leagueId: string,
  opts: { withOddsOnly?: boolean; limit?: number } = {},
): LeagueBacktestPayload {
  const updatedAt = new Date().toISOString();
  const option = listBacktestLeagues().find((o) => o.id === leagueId) ?? null;
  if (!option) {
    return {
      league: null,
      result: null,
      reason: `Ligue inconnue du registre : ${leagueId}`,
      updatedAt,
    };
  }
  const matches = loadLeagueBacktestMatches(leagueId, {
    withOddsOnly: opts.withOddsOnly !== false,
    limit: opts.limit ?? 4000,
  });
  if (matches.length === 0) {
    return {
      league: option,
      result: null,
      reason: opts.withOddsOnly === false
        ? `Aucun match terminé pour ${option.name}.`
        : `Aucun match terminé AVEC COTES 1X2 pour ${option.name} (${option.n} matchs ` +
          `connus, ${option.withOdds} avec cotes) — le marché 1N2 ne peut pas être ` +
          `mesuré. Relancer en mode « tous matchs » pour n'obtenir que des totaux ` +
          `sur cotes simulées.`,
      updatedAt,
    };
  }
  const result = runPariscoreBacktest(matches, {
    league: option.name,
    // ⚠️ UNITÉS — le piège le plus facile à franchir ici.
    // `runPariscoreBacktest` consomme `leagueMean` comme un λ PAR ÉQUIPE :
    //   lambdaH = leagueMean ; lambdaE = leagueMean ;  (cf. le chemin « prior neutre »)
    // Or `goalsPerMatch` est mesuré PAR MATCH, les DEUX équipes confondues.
    // Passer la valeur brute doublait le prior (Starligue : λ = 62 au lieu de
    // 31 par équipe) et produisait des lignes de total aberrantes du type
    // « Under 129 » pour des matchs totalisant ~62 buts. Constaté sur la sortie
    // réelle de la route, pas relu dans le code.
    // `CMP_NEUTRAL_LAMBDA = 28.5` du moteur est, lui, déjà un λ par équipe :
    // c'est la référence qui confirme l'unité attendue.
    //
    // `null` si la ligue n'a rien d'exploitable → le moteur retombe sur
    // CMP_NEUTRAL_LAMBDA, ce qui reste explicite dans sa note de méthode plutôt
    // qu'inventé ici.
    leagueMean:
      option.goalsPerMatch != null ? option.goalsPerMatch / 2 : undefined,
  });
  return { league: option, result, reason: null, updatedAt };
}

/** Fiche du registre pour un id (null si hors registre). */
export { getHandballLeague };
export type { HistoryLeagueStats };