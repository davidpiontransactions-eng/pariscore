/**
 * player-score.ts — agrégats carrière CueTracker (formule historique).
 *
 * CE MODULE EST LE DÉDOUBLONNAGE. La formule
 *
 *   Elo 30 · Win% 25 · CenturyRate 20 · DeciderWinPct 15 · MaxBreak 10
 *
 * vivait en six copies : `snooker/h2h/[id]/page.tsx`, `snooker/compare/page.tsx`
 * (× 2, l'une avec `Math.round`), `api/v1/snooker/accuracy/route.ts`,
 * `snooker-tab-content.tsx` et `snooker-player-popup.tsx`. Cinq étaient
 * byte-identiques ; la sixième (`snooker-player-popup.tsx`) avait des bornes
 * DIFFÉRENTES — Elo divisé par 1800 sans plancher, fenêtre avgBreak 20-80 au
 * lieu de 40-147 — donc le même joueur y avait deux PowerScore différents,
 * sans que rien ne le signale.
 *
 * ⚠️ OÙ EST REMPLACÉ PAR L5/L10
 * -----------------------------
 * Cette formule est un agrégat de CARRIÈRE issu du JSON CueTracker. Le
 * PowerScore L5/L10 (`@/lib/snooker/power-score`) est une autre grandeur :
 * fenêtre glissante sur `data/snooker_history.db`, avec frame share, deciders,
 * points/frame et centuries par frame — des données que CueTracker n'expose pas.
 *
 * `scoreFromPowerScore` alimente `pFrame`, donc les prédictions live / over /
 * handicap. Le remplacer par L5/L10 est la phase P5, conditionnée aux gates de
 * validation de P4 (accuracy ≥ 67 %, ΔBrier, McNemar). Ce n'est PAS fait ici :
 * changer le score sans avoir validé changerait les prédictions en production.
 * Tant que P4 n'a pas rendu son verdict, ce module reste le chemin unique
 * d'accès à la formule de carrière, et les 6 appelants l'importent d'ici.
 */

/** Champs CueTracker nécessaires au score de carrière. */
export type CareerPlayerScoreInput = {
  eloRating: number;
  /** 0-100. */
  winPct?: number | null;
  /** Centuries par match, exposé tel quel par l'API (0-30). */
  centuryRate?: number | null;
  /** 0-100. */
  deciderWinPct?: number | null;
  /**
   * ATTENTION : ce champ est le `max_break` de CueTracker, pas une moyenne de
   * break. La valeur 147 est celle de Judd Trump, Neil Robertson, Mark Selby,
   * John Higgins, Shaun Murphy, Mark Williams, Kyren Wilson… soit 9 joueurs du
   * top sur 10. La métrique est donc quasi constante : elle porte 10 % de
   * poids pour une information quasi nulle. Supprimée du L5/L10 ; conservée
   * ici par stricte fidélité historique.
   */
  avgBreak?: number | null;
};

/** Normalisation linéaire bornée 0-100. */
function normalize(val: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

/**
 * PowerScore de carrière 0-100 (formule historique, 5 métriques).
 * Absent = neutre à 50, jamais `null` : ces champs remontent tous partiels.
 */
export function scoreFromPowerScore(p: CareerPlayerScoreInput): number {
  const elo = normalize(p.eloRating, 1200, 1800);
  const win = p.winPct ?? 50;
  const century = normalize(p.centuryRate ?? 0, 0, 30);
  const decider = p.deciderWinPct ?? 50;
  const maxBreak = p.avgBreak != null ? normalize(p.avgBreak, 40, 147) : 50;
  return elo * 0.3 + win * 0.25 + century * 0.2 + decider * 0.15 + maxBreak * 0.1;
}

/** Idem, arrondi à l'entier (les 6 copies ne s'accordaient pas là-dessus). */
export function scoreFromPowerScoreRounded(p: CareerPlayerScoreInput): number {
  return Math.round(scoreFromPowerScore(p));
}

/**
 * PowerScore L5 / L10 d'un joueur, à partir d'une réponse
 * `/api/v1/snooker/power-score`. `null` si le joueur n'a pas d'historique.
 */
export type L5L10 = { score: number; matches: number; wins: number; losses: number };

export type PlayerWindows = {
  l5: L5L10;
  l10: L5L10;
};

/**
 * Extrait L5/L10 d'un payload de l'API. Tolérant : si la route est absente
 * (base historique non déployée) on renvoie `null` plutôt que de planter le
 * rendu — l'appelant retombe alors sur `scoreFromPowerScore`.
 */
export function windowsFromPayload(
  payload: { players?: { player: string; l5: L5L10; l10: L5L10 }[] } | null | undefined,
  slug: string,
): PlayerWindows | null {
  if (!payload?.players) return null;
  const found = payload.players.find((p) => p.player === slug);
  return found ? { l5: found.l5, l10: found.l10 } : null;
}