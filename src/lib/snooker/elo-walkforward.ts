/**
 * elo-walkforward.ts — historique Élo walk-forward par joueur, avec demi-vie.
 *
 * UN SEUL PAS CHRONOLOGIQUE produit tout : pour chaque match, l'Élo des deux
 * joueurs est gelé AVANT le résultat, puis mis à jour. Chaque joueur reçoit
 * donc la série de ses matchs, chacun portant l'Élo qu'il avait au moment du
 * match. Les fenêtres L5 / L10 ne sont plus qu'un `slice(-N)` sur cette série.
 *
 * Ce qui change par rapport à l'Élo de `backtest-history.ts` :
 *   1. DÉCAISSEMENT TEMPOREL — l'existant n'en a aucun, donc un joueur
 *      retraité en 1995 garde son rating 1995 pour l'éternité. Ici le rating
 *      retourne vers la moyenne du champ avec une demi-vie de 12 mois.
 *   2. DÉTERMINISME — tri sur (date, matchId). Sur la seule date, deux matchs
 *      du même jour sont ordonnés selon la lecture du driver, ce qui rend
 *      n'importe quel A/B de seuils non reproductible.
 *   3. CLÉ D'IDENTITÉ NORMALISÉE — l'existant key sur l'URL brute
 *      (`backtest-history.ts:190`), donc « /players/x » et « /Players/x »
 *      créeraient deux îlots Elo pour le même joueur. Ici on key sur le slug.
 *
 * L'Élo n'est jamais réutilisé après coup pour prédire un match déjà joué :
 * c'est la condition pour que la validation walk-forward ait un sens.
 */

import { expectedScore } from "./elo-engine";
import type { FrameScore } from "./parse-frame-scores";

/** Mise à jour par résultat : convention existante du projet (`backtest-history.ts`). */
export const ELO_K = 24;
/** Demi-vie du rating : 12 mois. */
export const ELO_HALF_LIFE_DAYS = 365;
/** Rating initial — même valeur que `elo-engine.ts:16`, re-déclarée car celle-ci
 *  n'y est pas exportée. */
export const INITIAL_RATING = 1500;
/** Valeur vers laquelle un rating non joué dérive (moyenne du champ). */
export const ELO_PRIOR = INITIAL_RATING;

/** Un match brut, déjà réduit aux colonnes utiles. */
export type SnookerMatchRow = {
  matchId: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  bestOf: number;
  /** Frames gagnées par le joueur A. */
  scoreA: number;
  /** Frames gagnées par le joueur B. */
  scoreB: number;
  /** Slug joueur A (fin d'URL CueTracker). */
  playerA: string;
  /** Slug joueur B. */
  playerB: string;
  /**
   * VRAI vainqueur, déduit de `winner_url`.
   *
   * ⚠️ CE CHAMP EST OBLIGATOIRE ET NE DOIT PAS ÊTRE DÉDUIT DE
   * `scoreA > scoreB`. La base `snooker_history.db` stocke le vainqueur en
   * premier dans 96,7 % des lignes, donc cette comparaison est vraie presque
   * toujours : elle ne porte aucune information. Résoudre le vainqueur par son
   * identité (`winner_url`) puis porter le résultat ici rend l'étiquette
   * correcte quel que soit l'ordre des colonnes.
   *
   * On ne suppose donc JAMAIS que A == vainqueur : `playerA` et `playerB` sont
   * les deux participants dans l'ordre de la base, et c'est `winner` qui dit qui
   * a gagné.
   */
  winner: string;
  /** Frames parsées ; `[]` si la colonne `scores` est absente ou illisible. */
  frames: FrameScore[];
  stage?: string | null;
  tournament?: string | null;
};

/** `true` si A (et non B) est le vainqueur de ce match. */
export function aWon(row: SnookerMatchRow): boolean {
  return row.winner === row.playerA;
}

/** Ce qu'un joueur a vécu dans UN match, avec son Élo gelé. */
export type EloMatchRecord = {
  matchId: string;
  date: string;
  /** Élo du joueur AVANT ce match (gelé). */
  elo: number;
  /** Élo de l'adversaire AVANT ce match (gelé). */
  opponentElo: number;
  opponent: string;
  won: boolean;
  framesWon: number;
  framesLost: number;
  /** `framesWon / (framesWon + framesLost)` — 0-1, indépendant du format. */
  frameShare: number;
  /** Points marqués ; `null` si les frames sont indisponibles. */
  pointsWon: number | null;
  /** Points encaissés ; `null` si les frames sont indisponibles. */
  pointsLost: number | null;
  /** Century du joueur sur ce match ; `null` si les frames sont indisponibles. */
  centuries: number | null;
  /** Frames jouées — `null` si les frames sont indisponibles. */
  totalFrames: number | null;
  bestOf: number;
  stage: string | null;
  tournament: string | null;
};

const DAY_MS = 86400000;

/** Facteur de décaissement pour un écart de `days` depuis le dernier match. */
function decayFactor(days: number): number {
  if (!Number.isFinite(days) || days <= 0) return 1;
  return Math.pow(2, -days / ELO_HALF_LIFE_DAYS);
}

/** Position du joueur dans un match : A ou B, `null` s'il n'y participe pas. */
function sideOf(row: SnookerMatchRow, player: string): "A" | "B" | null {
  if (row.playerA === player) return "A";
  if (row.playerB === player) return "B";
  return null;
}

function recordFor(
  row: SnookerMatchRow,
  player: string,
  side: "A" | "B",
  elo: number,
  opponentElo: number,
  frames: FrameScore[],
): EloMatchRecord {
  const first = side === "A";
  // Le vainqueur est résolu par identité (`row.winner`), PAS par
  // `framesWon > framesLost` : la base stocke le vainqueur en premier dans
  // 96,7 % des lignes, donc cette comparaison ne distingue rien.
  const won = row.winner === player;
  const framesWon = won ? Math.max(row.scoreA, row.scoreB) : Math.min(row.scoreA, row.scoreB);
  const framesLost = won ? Math.min(row.scoreA, row.scoreB) : Math.max(row.scoreA, row.scoreB);
  const total = framesWon + framesLost;

  // Les scores par frame sont indexés par le SLOT : la colonne A de `scores`
  // appartient au slot A (`playerA`). Les points du joueur étudié sont donc en
  // colonne A s'il est le slot A, en colonne B sinon.
  const slotIsA = first;

  let pointsWon: number | null = null;
  let pointsLost: number | null = null;
  let centuries: number | null = null;
  let totalFrames: number | null = null;

  if (frames.length > 0) {
    totalFrames = frames.length;
    pointsWon = 0;
    pointsLost = 0;
    centuries = 0;
    for (const f of frames) {
      pointsWon += slotIsA ? f.a : f.b;
      pointsLost += slotIsA ? f.b : f.a;
      // Century = SON break, jamais celui de l'adversaire.
      const ownBreak = slotIsA ? f.highBreakA : f.highBreakB;
      if (ownBreak != null && ownBreak >= 100) centuries += 1;
    }
  }

  return {
    matchId: row.matchId,
    date: row.date,
    elo,
    opponentElo,
    opponent: first ? row.playerB : row.playerA,
    won,
    framesWon,
    framesLost,
    frameShare: total > 0 ? framesWon / total : 0,
    pointsWon,
    pointsLost,
    centuries,
    totalFrames,
    bestOf: row.bestOf,
    stage: row.stage ?? null,
    tournament: row.tournament ?? null,
  };
}

/**
 * Construit l'historique Élo de tous les joueurs en UN PAS sur les matchs
 * (déjà filtrés : walkover, égalités, dates nulles exclus en amont).
 *
 * Les lignes sans date exploitable sont ignorées : on ne peut ni les décaisser
 * ni les ordonner, et les inclure rendrait le résultat dépendant de l'ordre de
 * lecture du driver.
 */
export function buildEloHistory(rows: SnookerMatchRow[]): Map<string, EloMatchRecord[]> {
  // Tri déterministe : la date seule ne départage pas deux matchs du même jour.
  const sorted = [...rows].sort((r1, r2) => (r1.date === r2.date ? r1.matchId.localeCompare(r2.matchId) : r1.date.localeCompare(r2.date)));

  const rating = new Map<string, number>();
  const lastPlayed = new Map<string, number>();
  const history = new Map<string, EloMatchRecord[]>();

  const push = (key: string, rec: EloMatchRecord): void => {
    let list = history.get(key);
    if (!list) {
      list = [];
      history.set(key, list);
    }
    list.push(rec);
  };

  for (const row of sorted) {
    const a = row.playerA;
    const b = row.playerB;
    if (!a || !b || a === b) continue;

    const ts = Date.parse(row.date);
    if (Number.isNaN(ts)) continue;

    // Décaissement de chaque joueur depuis SON dernier match.
    const decayed = (key: string): number => {
      const current = rating.get(key) ?? INITIAL_RATING;
      const prev = lastPlayed.get(key);
      if (prev == null) return current;
      return ELO_PRIOR + (current - ELO_PRIOR) * decayFactor((ts - prev) / DAY_MS);
    };

    const eloA = decayed(a);
    const eloB = decayed(b);
    const pA = expectedScore(eloA, eloB);
    const pB = 1 - pA;

    // Le vainqueur est résolu par identité, jamais par comparaison de scores.
    const outcomeA = row.winner === a ? 1 : 0;
    const outcomeB = 1 - outcomeA;

    push(a, recordFor(row, a, sideOf(row, a) ?? "A", eloA, eloB, row.frames));
    push(b, recordFor(row, b, sideOf(row, b) ?? "B", eloB, eloA, row.frames));

    // Mise à jour APRÈS avoir gelé et enregistré (sinon le match s'auto-score).
    rating.set(a, eloA + ELO_K * (outcomeA - pA));
    rating.set(b, eloB + ELO_K * (outcomeB - pB));
    lastPlayed.set(a, ts);
    lastPlayed.set(b, ts);
  }

  return history;
}

/** Dernier rating connu d'un joueur dans un historique (1500 si inconnu). */
export function lastRating(history: Map<string, EloMatchRecord[]>, player: string): number {
  const list = history.get(player);
  if (!list || list.length === 0) return INITIAL_RATING;
  const last = list[list.length - 1];
  // Un joueur inactif n'a pas book'sé : son rating displayed est décaissé
  // jusqu'à aujourd'hui, pas figé à son dernier match.
  const ts = Date.parse(last.date);
  if (Number.isNaN(ts)) return last.elo;
  const elapsed = (Date.now() - ts) / DAY_MS;
  return ELO_PRIOR + (last.elo - ELO_PRIOR) * decayFactor(elapsed);
}