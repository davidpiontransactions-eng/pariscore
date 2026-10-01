/**
 * power-score.ts — point d'entrée unique du PowerScore snooker.
 *
 * SOURCE UNIQUE DE VÉRITÉ. Remplace six copies locales de `playerScore` qui
 * vivaient dans `snooker/h2h/[id]/page.tsx`, `snooker/compare/page.tsx`,
 * `api/v1/snooker/accuracy/route.ts`, `snooker-tab-content.tsx` et
 * `snooker-player-popup.tsx` — cinq d'entre elles byte-identiques, la
 * sixième avec des bornes différentes (donc un score différent pour le même
 * joueur, sans que personne ne s'en aperçoive).
 *
 * DEUX FENÊTRES, DEUX SCORES. L5 = les 5 derniers matchs, L10 = les 10
 * derniers. Même métriques, même poids, fenêtre différente. Aucune moyenne
 * entre les deux.
 *
 * ⚠️ AFFICHAGE SEUL. Mesuré sur 17 345 matchs de TEST, ce composite fait
 * 58,6-59,8 % d'accuracy contre **61,55 %** pour l'Élo seul, et il est moins
 * bon sur le Brier et le logLoss aussi. Les gates de validation ont donc échoué
 * et `pFrame` reste branché sur l'Élo.
 *
 * La conversion en probabilité de frame reste un choix séparé et explicite :
 * ce module ne décide PAS de comment le score alimente le modèle de match. C'est
 * `frameProbabilityFromPowerScore`, et son utilisation dépend des gates.
 *
 * 📄 Voir `docs/snooker/PLAFFOND-PREDICTIF.md`.
 */

import type { PowerScore } from "@/lib/power-score";
import { buildEloHistory, lastRating, type EloMatchRecord, type SnookerMatchRow } from "./elo-walkforward";
import { windowOf, type L10WindowResult, type WindowOptions } from "./l10";

/** Identifiant joueur = slug CueTracker (fin d'URL), insensible à la casse. */
export type SnookerPlayerKey = string;

export type SnookerPowerResult = {
  player: SnookerPlayerKey;
  /** Dernier rating connu, décaissé jusqu'à aujourd'hui. */
  rating: number;
  /** PowerScore sur les 5 derniers matchs. */
  l5: L10WindowResult;
  /** PowerScore sur les 10 derniers matchs. */
  l10: L10WindowResult;
};

/**
 * Calcule L5 et L10 pour chaque joueur d'un lot de matchs.
 *
 * UN SEUL PAS CHRONOLOGIQUE pour tous les joueurs : construire l'historique
 * Élo une fois, puis lire les deux fenêtres. Faire l'inverse (une requête par
 * joueur) serait N fois plus lent et donnerait des Élo incohérents entre
 * joueurs, puisque chaque joueur aurait sa propre échelle.
 *
 * `since` borne la FENÊTRE D'AFFICHAGE, jamais l'historique Élo : tronquer le
 * corpus ferait repartir chaque joueur de 1500 et le même joueur changerait de
 * score selon le paramètre d'URL. Voir `loadSnookerL10Rows`.
 *
 * `before` exclut les matchs à cette date ou après — c'est le mode PRÉDICTION :
 * la fenêtre ne doit pas contenir le match à prédire (6 des 7 métriques sont
 * son résultat brut).
 */
export function computeSnookerPowerScores(
  rows: SnookerMatchRow[],
  opts?: { since?: string; before?: string },
): Map<SnookerPlayerKey, SnookerPowerResult> {
  const history = buildEloHistory(rows);
  const out = new Map<SnookerPlayerKey, SnookerPowerResult>();

  // Bornes de la fenêtre, une seule fois.
  const wopts: WindowOptions = {};
  if (opts?.before) wopts.before = opts.before;
  else if (opts?.since) wopts.before = nextIsoDay(opts.since);

  const cut = wopts.before;
  for (const [player, records] of history) {
    // Un joueur dont tout l'historique est postérieur à la borne n'a pas de
    // fenêtre affichable : on ne lui invente pas de score.
    if (cut && !records.some((r) => r.date < cut)) continue;
    out.set(player, {
      player,
      rating: lastRating(history, player),
      l5: windowOf(records, 5, wopts),
      l10: windowOf(records, 10, wopts),
    });
  }

  return out;
}

/**
 * `since` est INCLUSIF (un joueur/match du 1er du mois compte). Or
 * `windowOf({ before })` filtre en `r.date < before`, donc il faut passer au
 * lendemain pour que le jour `since` lui-même soit conservé.
 */
function nextIsoDay(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t + 86400000).toISOString().slice(0, 10);
}

/** L5 + L10 d'un joueur précis, `null` s'il n'a aucun match exploitable. */
export function snookerPowerScore(
  rows: SnookerMatchRow[],
  player: SnookerPlayerKey,
  opts?: { since?: string; before?: string },
): SnookerPowerResult | null {
  const records: EloMatchRecord[] | undefined = buildEloHistory(rows).get(player);
  if (!records || records.length === 0) return null;

  const wopts: WindowOptions = {};
  if (opts?.before) wopts.before = opts.before;
  else if (opts?.since) wopts.before = nextIsoDay(opts.since);
  const cut = wopts.before;
  if (cut && !records.some((r) => r.date < cut)) return null;

  const history = new Map([[player, records]]);
  return {
    player,
    rating: lastRating(history, player),
    l5: windowOf(records, 5, wopts),
    l10: windowOf(records, 10, wopts),
  };
}

export type SnookerPowerBadge = { label: string; value: number; hint: string };

/** Les deux fenêtres, format compact pour le badge UI. */
export function snookerPowerScoreBadges(result: SnookerPowerResult): SnookerPowerBadge[] {
  return [
    {
      label: `L5 (${result.l5.matches} m.)`,
      value: result.l5.score,
      hint: `PowerScore sur les ${result.l5.matches} derniers matchs · ${result.l5.wins}V/${result.l5.losses}D`,
    },
    {
      label: `L10 (${result.l10.matches} m.)`,
      value: result.l10.score,
      hint: `PowerScore sur les ${result.l10.matches} derniers matchs · ${result.l10.wins}V/${result.l10.losses}D`,
    },
  ];
}

/**
 * Score 0-100 → probabilité de gain d'une frame, pour alimenter le modèle de
 * match.
 *
 * VOLONTAIREMENT SÉPARÉ de `snookerPowerScore` : c'est le seul endroit où le
 * score touche à une prédiction, donc le seul qui doit être couvert par les
 * gates de validation. `analyseSnookerPowerScore` (retour 50-95 pour
 * l'affichage) ne l'appelle pas, donc un affichage ne peut pas déraper vers
 * une prédiction.
 *
 * `OVER_POWER` = 100/95 : le plafond du PowerScore est 95 (convention
 * `clamp100` du projet), donc un joueur ne peut pas atteindre une probabilité
 * de frame de 100 % et prétendre qu'une frame est acquise.
 */
const OVER_POWER = 100 / 95;

export function frameProbabilityFromPowerScore(score: number, floor = 0.2, ceiling = 0.8): number {
  if (!Number.isFinite(score)) return 0.5;
  const scaled = (Math.max(0, Math.min(100, score)) / 100) * OVER_POWER;
  return Math.max(floor, Math.min(ceiling, scaled));
}