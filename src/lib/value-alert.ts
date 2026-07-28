/**
 * Alerte "value bet" — déclenchée quand le TOTAL de jeux joués dans le set
 * atteint un palier pair (2, 4, 6, 8, 10, 12) ET qu'au moins un des deux
 * joueurs a un DR match ≥ 1.2.
 *
 * RÈGLE (refonte 2026-07-28 — clarification utilisateur) :
 *   À chaque palier pair de jeux joués dans le set, si DR P1 OU P2 ≥ 1.2,
 *   on déclenche une alerte.
 *
 *   Paliers : 2, 4, 6, 8, 10, 12 jeux (= chaque cycle "1 service + 1 retour"
 *   joué = +2 jeux dans le set, indépendamment de qui gagne).
 *
 * Exemples concrets (DR ≥ 1.2 pour au moins un joueur supposé vrai) :
 *   2-0, 1-1            → 2 jeux  → alerte (palier 1)
 *   3-1, 4-0, 2-2       → 4 jeux  → alerte (palier 2)
 *   4-2, 5-1, 6-0, 3-3  → 6 jeux  → alerte (palier 3)
 *   4-4, 5-3, 6-2       → 8 jeux  → alerte (palier 4)
 *   5-4, 6-3, 4-5       → 9 jeux  → PAS d'alerte (impair)
 *   5-5, 6-4            → 10 jeux → alerte (palier 5)
 *   6-5                 → 11 jeux → PAS d'alerte (impair)
 *   6-6 (avant tiebreak)→ 12 jeux → alerte (palier 6)
 *
 * Pourquoi le TOTAL (et non l'écart) :
 *   L'utilisateur veut être alerté à chaque "cycle complet" de service+retour,
 *   peu importe qui gagne ces jeux. C'est plus régulier comme repère temporel
 *   qu'une alerte sur écart (qui peut ne jamais se déclencher si le set est
 *   serré 3-3 puis 4-4). Ici on vérifie la dominance DR tous les 2 jeux joués.
 *
 * Filtre DR ≥ 1.2 :
 *   On évite d'alerter sur des sets équilibrés où personne ne domine. Le DR
 *   proxy games+sets du match entier indique qui crée durablement l'écart.
 */

import type { LiveMatchState } from "@/hooks/use-live-matches";
import { computeDrMatch } from "@/lib/dr-match";

/** Paliers pairs à vérifier : 2, 4, 6, 8, 10, 12 jeux joués dans le set. */
const TOTAL_TIERS = [2, 4, 6, 8, 10, 12];
/** DR match minimum (P1 OU P2) pour déclencher l'alerte. */
const DR_MATCH_THRESHOLD = 1.2;

export type ValueAlert = {
  /** true si l'alerte est active (palier pair atteint + DR ≥ 1.2). */
  active: boolean;
  /** Joueur dominant au DR match (pour afficher son nom dans la notif). */
  leader: "A" | "B" | null;
  /** DR du joueur dominant (pour affichage). */
  drLeader: number | null;
  /** Total de jeux joués dans le set en cours (pour affichage). */
  totalGamesInSet: number;
  /** Palier courant atteint (1=2 jeux, 2=4 jeux, etc.). 0 si pas encore. */
  tier: number;
  /** Score du set en cours (pour affichage). */
  setScore: { gamesA: number; gamesB: number } | null;
};

/**
 * Évalue l'alerte value bet sur un match live.
 * @param liveState — État live (depuis useLiveMatches/useLiveStream).
 */
export function evaluateValueAlert(liveState: LiveMatchState | undefined): ValueAlert {
  if (!liveState) {
    return {
      active: false,
      leader: null,
      drLeader: null,
      totalGamesInSet: 0,
      tier: 0,
      setScore: null,
    };
  }

  const gamesA = liveState.scoreA.games;
  const gamesB = liveState.scoreB.games;
  const totalGames = gamesA + gamesB;

  // Palier pair atteint ? (total ∈ [2,4,6,8,10,12]).
  const tier = TOTAL_TIERS.includes(totalGames)
    ? TOTAL_TIERS.indexOf(totalGames) + 1
    : 0;

  // Si pas un palier, pas d'alerte (mais on garde les infos pour l'affichage).
  if (tier === 0) {
    return {
      active: false,
      leader: null,
      drLeader: null,
      totalGamesInSet: totalGames,
      tier: 0,
      setScore: { gamesA, gamesB },
    };
  }

  // Calcule le DR match pour identifier le dominant.
  const drMatch = computeDrMatch(liveState);
  if (!drMatch) {
    return {
      active: false,
      leader: null,
      drLeader: null,
      totalGamesInSet: totalGames,
      tier,
      setScore: { gamesA, gamesB },
    };
  }

  // RÈGLE : alerte si (DR P1 ≥ 1.2) OU (DR P2 ≥ 1.2).
  const drAnyDominant = drMatch.drA >= DR_MATCH_THRESHOLD || drMatch.drB >= DR_MATCH_THRESHOLD;

  // Le "leader" pour l'affichage = celui qui a le meilleur DR (pas forcément
  // celui qui mène au score — ex: mène 3-1 au set mais perd le match jusqu'ici).
  const leader: "A" | "B" = drMatch.drA >= drMatch.drB ? "A" : "B";
  const drLeader = leader === "A" ? drMatch.drA : drMatch.drB;

  return {
    active: drAnyDominant,
    leader: drAnyDominant ? leader : null,
    drLeader,
    totalGamesInSet: totalGames,
    tier,
    setScore: { gamesA, gamesB },
  };
}

/**
 * Construit le titre/label pour une notification value alert.
 * Ex: "🔥 ALCARAZ dominant (DR 1.34) — 4 jeux joués dans le set"
 */
export function formatValueAlertLabel(
  alert: ValueAlert,
  leaderName: string,
): { title: string; body: string } | null {
  if (!alert.active || !alert.leader || alert.drLeader == null || !alert.setScore) {
    return null;
  }
  const { gamesA, gamesB } = alert.setScore;
  const scoreStr = `${gamesA}-${gamesB}`;
  return {
    title: `🔥 ${leaderName} dominant (DR ${alert.drLeader.toFixed(2)})`,
    body: `${alert.totalGamesInSet} jeux joués dans le set (${scoreStr}) · DR ≥ 1.2 → value bet à surveiller`,
  };
}
