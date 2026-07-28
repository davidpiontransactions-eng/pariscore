/**
 * Alerte "value bet" — déclenchée quand un joueur a un break d'avance (≥ 2 jeux
 * d'écart dans le set en cours) ET un DR match dominant (≥ 1.2).
 *
 * Logique : ces 2 conditions combinées = signal fort que le joueur va gagner
 * le set (et potentiellement le match si set decisif). C'est un bon moment
 * pour parier sur lui avant que les cotes ne s'effondrent.
 *
 * Conditions :
 *   - Écart de jeux dans le set en cours ≥ 2 (ex: 4-2, 5-3, 6-4 — un "double
 *     break" ou break + confirmation)
 *   - DR match (ratio Sofascore proxy) du joueur qui mène ≥ 1.2 (dominance
 *     confirmée sur l'ensemble du match, pas juste un coup de chance sur le set)
 *
 * Le critère DR ≥ 1.2 filtre les faux signaux : un joueur qui mène 4-2 dans
 * le set mais a un DR match de 0.95 (dominé globalement) n'est pas un value
 * bet — c'est probablement un set accroché qui peut basculer.
 */

import type { LiveMatchState } from "@/hooks/use-live-matches";
import { computeDrMatch } from "@/lib/dr-match";

/** Écart minimum de jeux dans le set pour déclencher l'alerte. */
const GAME_GAP_THRESHOLD = 2;
/** DR match minimum du joueur qui mène pour confirmer la dominance. */
const DR_MATCH_THRESHOLD = 1.2;

export type ValueAlert = {
  /** true si l'alerte est active. */
  active: boolean;
  /** Joueur qui déclenche l'alerte ("A" | "B" | null). */
  leader: "A" | "B" | null;
  /** DR match du leader (pour affichage). */
  drLeader: number | null;
  /** Écart de jeux dans le set (pour affichage). */
  gameGap: number;
  /** Score du set en cours (pour affichage). */
  setScore: { gamesA: number; gamesB: number } | null;
};

/**
 * Évalue l'alerte value bet sur un match live.
 * @param liveState — État live (depuis useLiveMatches/useLiveStream).
 */
export function evaluateValueAlert(liveState: LiveMatchState | undefined): ValueAlert {
  if (!liveState) {
    return { active: false, leader: null, drLeader: null, gameGap: 0, setScore: null };
  }

  const gamesA = liveState.scoreA.games;
  const gamesB = liveState.scoreB.games;
  const gap = Math.abs(gamesA - gamesB);

  // Pas assez d'écart dans le set → pas d'alerte.
  if (gap < GAME_GAP_THRESHOLD) {
    return { active: false, leader: null, drLeader: null, gameGap: gap, setScore: { gamesA, gamesB } };
  }

  // Calcule le DR match pour identifier le dominant.
  const drMatch = computeDrMatch(liveState);
  if (!drMatch) {
    return { active: false, leader: null, drLeader: null, gameGap: gap, setScore: { gamesA, gamesB } };
  }

  // Qui mène au score dans le set ?
  const scoreLeader: "A" | "B" = gamesA > gamesB ? "A" : "B";
  // DR du leader (doit être ≥ 1.2 pour confirmer la dominance globale).
  const drLeader = scoreLeader === "A" ? drMatch.drA : drMatch.drB;

  // Condition finale : écart ≥ 2 ET DR leader ≥ 1.2.
  const active = gap >= GAME_GAP_THRESHOLD && drLeader >= DR_MATCH_THRESHOLD;

  return {
    active,
    leader: active ? scoreLeader : null,
    drLeader,
    gameGap: gap,
    setScore: { gamesA, gamesB },
  };
}

/**
 * Construit le titre/label pour une notification value alert.
 * Ex: "🔥 ALCARAZ mène 4-2 — DR match 1.34 (value bet)"
 */
export function formatValueAlertLabel(
  alert: ValueAlert,
  leaderName: string,
): { title: string; body: string } | null {
  if (!alert.active || !alert.leader || alert.drLeader == null || !alert.setScore) {
    return null;
  }
  const { gamesA, gamesB } = alert.setScore;
  const scoreStr = alert.leader === "A" ? `${gamesA}-${gamesB}` : `${gamesB}-${gamesA}`;
  return {
    title: `🔥 ${leaderName} mène ${scoreStr} dans le set`,
    body: `DR match ${alert.drLeader.toFixed(2)} (≥ 1.2) + ${alert.gameGap} jeux d'écart → value bet détecté`,
  };
}
