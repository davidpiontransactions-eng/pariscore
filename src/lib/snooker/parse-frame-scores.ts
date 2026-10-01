/**
 * parse-frame-scores.ts — extraction du score frame par frame depuis la colonne
 * `scores` de la base historique SnookerDB (`data/snooker_history.db`).
 *
 * FORMAT RÉEL (mesuré sur 34 318 matchs post-2014, pas supposé) :
 *   frames séparées par « ; », score joueur 1 puis « - » puis joueur 2.
 *   Le plus gros break du frame apparaît optionnellement entre parenthèses,
 *   et peut être porté par UN SEUL côté ou par les deux :
 *     "104(104)-0"        → 104-0,   plus gros break 104 (côté 1)
 *     "21-101(88)"        → 21-101,  plus gros break 88  (côté 2)
 *     "69(55)-53(53)"     → 69-53,   plus gros break 55  (côté 1 et 2)
 *     "0-138(51,87)"      → 0-138,   DEUX breaks dans la même paire (51, 87)
 *     "76-46"             → 76-46,   aucun break
 *
 * La variante « (a,b) » est la cause historique d'une parité de 96 % avec
 * `player_1_score` : ignorée, la frame n'était pas comptée et le score de
 * match sous-estimait d'une frame. Elle est donc prise en charge ici.
 *
 * AUCUNE exception : une ligne illisible est comptée dans `anomalies` et
 * ignorée, jamais fatale (le lecteur de base suit la même convention).
 */

/** Un frame parsé. */
export type FrameScore = {
  /** Points du joueur 1 sur ce frame. */
  a: number;
  /** Points du joueur 2 sur ce frame. */
  b: number;
  /**
   * Plus gros break du frame, tous côtés confondus, `null` si la cellule ne
   * renseigne aucun break.
   *
   * ⚠️ NE PAS UTILISER POUR COMPTER LES CENTURIES : ce champ mélange les deux
   * joueurs. Utiliser `highBreakA` / `highBreakB`.
   */
  highBreak: number | null;
  /**
   * Plus gros break du joueur 1 sur ce frame — LUI, pas celui de l'adversaire.
   *
   * Séparé de `highBreak` parce que la base stocke les deux dans la même paire
   * de parenthèses : `"0-138(51,87)"` = 51 pour le joueur 1, 87 pour le joueur 2.
   * Agréger les deux en un maximum puis créditer le vainqueur du frame
   * attribuait un century fantôme : un joueur qui gagne 130-5 pendant que son
   * adversaire fait un 100 se voyait créditer d'un siècle qui n'est pas le
   * sien, et le vrai century de l'adversaire n'était jamais compté.
   */
  highBreakA: number | null;
  /** Plus gros break du joueur 2 sur ce frame. */
  highBreakB: number | null;
};

export type ParsedFrameScores = {
  frames: FrameScore[];
  /** Codes d'anomalie rencontrés (voir `FRAME_SCORE_ANOMALIES`). */
  anomalies: string[];
};

/** Codes d'anomalie — jamais throwés, toujours comptés. */
export const FRAME_SCORE_ANOMALIES = {
  walkover: "walkover",
  empty: "empty",
  unparsed: "unparsed",
  drawFrame: "drawFrame",
  tooManyFrames: "tooManyFrames",
} as const;

/**
 * Token de frame. Les 6 groupes optionnels capturent les parenthèses à 1
 * valeur (côté 1 puis côté 2) et à 2 valeurs (variante « (a,b) »).
 */
const FRAME_TOKEN =
  /^\s*(\d{1,3})(?:\(\s*(\d{1,3})(?:\s*,\s*(\d{1,3}))?\s*\))?\s*-\s*(\d{1,3})(?:\(\s*(\d{1,3})(?:\s*,\s*(\d{1,3}))?\s*\))?\s*$/;

/**
 * Parse la colonne `scores`. Une frame sans score exploitable est ignorée et
 * comptée ; un match sans aucune frame exploitable renvoie `frames: []`.
 */
export function parseFrameScores(raw: string | null | undefined, opts?: { bestOf?: number | null }): ParsedFrameScores {
  const anomalies: string[] = [];

  if (!raw || raw.trim() === "") {
    return { frames: [], anomalies: [FRAME_SCORE_ANOMALIES.empty] };
  }

  const frames: FrameScore[] = [];
  for (const token of raw.split(";")) {
    if (token.trim() === "") continue;
    const m = FRAME_TOKEN.exec(token);
    if (!m) {
      anomalies.push(FRAME_SCORE_ANOMALIES.unparsed);
      continue;
    }
    const a = Number(m[1]);
    const b = Number(m[4]);
    // Un frame « 65-65 » est une frame reprise comptée deux fois : elle ne
    // désigne aucun vainqueur, on l'écarte.
    if (a === b) {
      anomalies.push(FRAME_SCORE_ANOMALIES.drawFrame);
      continue;
    }
    // Attribution par côté. Trois écritures possibles dans la base :
    //   "104(104)-0"      → un nombre côté A      → highBreakA = 104
    //   "21-101(88)"      → un nombre côté B      → highBreakB = 88
    //   "69(55)-53(53)"   → un nombre par côté    → A = 55, B = 53
    //   "0-138(51,87)"    → DEUX nombres côté B   → c'est (A, B) dans l'ordre
    //                        des joueurs, pas l'ordre des parenthèses.
    // ATTENTION au mapping réel des groupes, vérifié sur les 6 variantes :
    //   "104(104)-0"     g2=104               → singleton A
    //   "21-101(88)"     g5=88                → singleton B
    //   "69(55)-53(53)"  g2=55    g5=53       → singleton A + singleton B
    //   "0-138(51,87)"   g5=51    g6=87       → PAIRE portée par le côté B
    //   "127(51,76)-0"   g2=51    g3=76       → PAIRE portée par le côté A
    //
    // La paire se reconnaît donc soit par (g2, g3), soit par (g5, g6) —
    // jamais par g3/g6. Et elle prime sur les singletons : dans "0-138(51,87)",
    // g5=51 n'est PAS le break du joueur B mais le break du joueur A.
    const pairFromA = m[2] != null && m[3] != null;
    const pairFromB = m[5] != null && m[6] != null;
    const hasPair = pairFromA || pairFromB;

    const highBreakA = hasPair ? Number(pairFromA ? m[2] : m[5]) : m[2] != null ? Number(m[2]) : null;
    const highBreakB = hasPair ? Number(pairFromA ? m[3] : m[6]) : m[5] != null ? Number(m[5]) : null;
    const all = [highBreakA, highBreakB].filter((v): v is number => v != null);

    frames.push({
      a,
      b,
      highBreak: all.length > 0 ? Math.max(...all) : null,
      highBreakA,
      highBreakB,
    });
  }

  const bestOf = opts?.bestOf ?? null;
  if (bestOf != null && bestOf > 0 && frames.length > bestOf + 1) {
    anomalies.push(FRAME_SCORE_ANOMALIES.tooManyFrames);
  }

  return { frames, anomalies };
}

/** Frames gagnés par le joueur 1 sur l'ensemble parsé. */
export function framesWonByFirst(frames: FrameScore[]): number {
  let n = 0;
  for (const f of frames) if (f.a > f.b) n++;
  return n;
}

/** Frames gagnés par le joueur 2 sur l'ensemble parsé. */
export function framesWonBySecond(frames: FrameScore[]): number {
  let n = 0;
  for (const f of frames) if (f.b > f.a) n++;
  return n;
}

/**
 * Nombre de centuries du joueur 1 sur un match.
 *
 * Compte SON propre break, et le compte même s'il PERD le frame : un joueur
 * peut paragagner 100+ points et s'effondrer sur la dernière frame. Filtrer
 * sur `a > b` sous-comptait donc les centuries des matchs perdus — exactement
 * les matchs où un break est le plus remarqué.
 */
export function centuriesByFirst(frames: FrameScore[]): number {
  let n = 0;
  for (const f of frames) if (f.highBreakA != null && f.highBreakA >= 100) n++;
  return n;
}

/** Nombre de centuries du joueur 2 sur un match (même règle). */
export function centuriesBySecond(frames: FrameScore[]): number {
  let n = 0;
  for (const f of frames) if (f.highBreakB != null && f.highBreakB >= 100) n++;
  return n;
}

/** Points du joueur 1 sur l'ensemble des frames parsées. */
export function pointsByFirst(frames: FrameScore[]): number {
  let n = 0;
  for (const f of frames) n += f.a;
  return n;
}

/** Points du joueur 2 sur l'ensemble des frames parsées. */
export function pointsBySecond(frames: FrameScore[]): number {
  let n = 0;
  for (const f of frames) n += f.b;
  return n;
}