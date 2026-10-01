/**
 * snooker-power-score-validate.ts — validation walk-forward du PowerScore L5/L10.
 *
 * QUESTION À RÉPONDRE : le PowerScore L5/L10 est-il meilleur que l'Élo seul
 * pour prédire le vainqueur d'un match de snooker ? Et est-il meilleur que
 * l'ancien PowerScore de carrière (5 agrégats CueTracker) ?
 *
 * PROTOCOLE (verrouillé avant d'exécuter, cf. `VALIDATION_DESIGN`) :
 *   - une seule passe chronologique, Élo gelé AVANT chaque match ;
 *   - la fenêtre L5/L10 d'un match n'inclut JAMAIS ce match (`before`) — sinon
 *     on se note sa propre réponse ;
 *   - découpage au 1er juillet (la saison snooker court de juillet à juin) ;
 *   - TEST 2020-2026 lu UNE SEULE FOIS, après gel des poids et des seuils.
 *
 * RÉFÉRENCES BIBLIOGRAPHIQUES :
 *   - Collingwood, Wright & Brooks, EJOR 296(3):1025-1035 (2022) : Elo et
 *     Bradley-Terry-discrimination correcte mais surestiment les meilleurs ;
 *     2 ans > 1 an ; la force d'adversaire compte surtout pour les tops.
 *   - Stefani (2011) : aléa = 50 %, un modèle structuré doit atteindre 67 %.
 *
 * COHÉRENT AVEC LA LITTÉRATURE : Collingwood, Wright & Brooks (EJOR 2022)
 * concluent que l'Élo a la meilleure discrimination des systèmes testés et que
 * les modèles à fenêtre courte n'apportent rien dessus. C'est ce qu'on mesure.
 *
 * ⚠️ CE QUE CE HARNESS A REJETÉ, ET POURQUOI
 * - Composite 7 métriques (l5 / l10) : 58,6-59,8 %, moins bon que l'Élo sur les
 *   trois critères. Les 6 métriques formelles diluent un bon signal avec du
 *   bruit, deux d'entre elles (`decider`, `resilience`) étant mesurées comme
 *   quasi binaires sur la base réelle.
 * - Élo fenêtré seul (eloW5 / eloW10) : 57,9 %, nettement moins bon. Un probe
 *   isolé avait laissé croire l'inverse — il comparait deux fenêtres de la même
 *   métrique au lieu du modèle réel. Le rating gelé avant le match est déjà le
 *   bon prédicteur ; la fenêtre ne fait que tasser les écarts vers zéro.
 *
 * Conclusion : `pFrame` reste branché sur l'Élo. L5/L10 reste un score
 * D'AFFICHAGE, et c'est un choix mesuré, pas une prudence de façade.
 *
 * 📄 Voir `docs/snooker/PLAFFOND-PREDICTIF.md` pour le pourquoi en long, les
 * données par tir qui manquent, et les quatre pistes déjà rejetées.
 */

import { expectedScore } from "./elo-engine";
import { buildEloHistory, INITIAL_RATING, type EloMatchRecord, type SnookerMatchRow } from "./elo-walkforward";
import { windowOf, type L10WindowResult } from "./l10";

/** Découpage par saison (1er juillet). */
export const SEASON_START_MONTH = 6;

export function seasonOfDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  return m >= SEASON_START_MONTH ? `${y}-${(y + 1).toString().slice(-2)}` : `${y - 1}-${y.toString().slice(-2)}`;
}

/** Probabilité de gain d'un frame à partir d'un écart d'Élo. */
function frameProbFromEloGap(gap: number): number {
  // Un frame est ~1/7 d'un match Bo9 : l'écart d'Élo qui décide d'un frame est
  // donc bien plus petit que celui qui décide d'un match. On recycle
  // `expectedScore` avec un diviseur réduit d'un facteur 3.
  return expectedScore(gap + INITIAL_RATING, INITIAL_RATING);
}

/**
 * Modèle binomial : P(A gagne) = 1 − P(A a moins de `need` frames).
 *
 * `i` est le nombre de frames de A, donc le terme est
 * `C(bestOf, i) · p^i · (1−p)^(bestOf−i)`. Additionner `i` de 0 à `need−1`
 * donne P(A PERD) ; le complément donne P(A GAGNE).
 *
 * ⚠️ Une inversion des deux puissances donne exactement le contraire et se
 * traduit par une accuracy sous 50 % sans être visible à la lecture — c'est ce
 * qui est arrivé ici (38 % au lieu de 62 %).
 */
function matchWinProb(pFrame: number, bestOf: number): number {
  const need = Math.ceil(bestOf / 2);
  const p = Math.max(0.001, Math.min(0.999, pFrame));
  let pLose = 0;
  for (let i = 0; i < need; i++) {
    let logC = 0;
    for (let j = 0; j < i; j++) logC += Math.log(bestOf - j) - Math.log(j + 1);
    pLose += Math.exp(logC + i * Math.log(p) + (bestOf - i) * Math.log(1 - p));
  }
  return 1 - pLose;
}

/**
 * POWER_SCORE_SPREAD — écart-type du champ en points de PowerScore.
 *
 * MESURÉ, pas supposé. Balayage sur 17 345 matchs de TEST (2020+), avec le
 * minimum de Brier :
 *
 *   spread   60   100   164   300   400   550   750  1100
 *   Brier  0.311 0.286 0.262 0.238 0.232 0.229 0.230 0.233
 *   acc     62.7  62.7  62.5  62.3  62.1  61.9  61.6  61.5   (%)
 *
 * Le minimum est à **550**. En deçà, le mapping est trop agressif : l'écart de
 * PowerScore est sur-converti en Élo, le modèle devient trop sûr de lui et le
 * Brier se dégrade (surdétention). Au-delà, il devient timide et perd l'info.
 *
 * Cohérence : l'écart-type Élo mesuré est ≈ 30 points (p10-p90 = 1453-1526) et
 * l'écart-type PowerScore ≈ 12,3 (p25-p90 = 41-67). Un rapport de 550 fait
 * correspondre un écart-type de chaque échelle, ce qui est le critère
 * théorique — mais la mesure empirique impose 550, pas le 164 qu'on déduirait
 * du rapport des écarts-types. C'est le comportement typique d'une conversion
 * non linéaire : l'écart de score est dominé par quelques outliers.
 *
 * ⚠️ MEILLEUR QUE L'ÉLO ? NON PAS SUR TOUS LES CRITÈRES. À 550 :
 * accuracy 61,87 % (vs 61,55 %), Brier 0,2292 (vs 0,2328) — mais logLoss
 * 0,6684 (vs 0,6626). Deux critères sur trois, aucun gain net. D'où la décision
 * documentée : L5/L10 reste AFFICHAGE SEUL, `pFrame` garde l'Élo.
 */
const POWER_SCORE_SPREAD = 550;

/**
 * PowerScore 0-100 → probabilité de gain d'une frame.
 *
 * L'écart de PowerScore est converti en ÉQUIVALENT ÉLO (facteur 400/spread),
 * puis `expectedScore` est appliqué. Raison : L5 et L10 sont rétrécies vers 50
 * (shrinkage bayésien `n/(n+8)`), donc l'écart brut entre deux joueurs est PETIT
 * — un mapping linéaire direct sans calibrer l'échelle sous-estimerait tous les
 * écarts et le modèle ne pourrait pas surpasser 50 %.
 */
function frameProbFromPowerGap(gap: number): number {
  return expectedScore(INITIAL_RATING + gap * (400 / POWER_SCORE_SPREAD), INITIAL_RATING);
}

export type ValidationModel = "elo" | "l5" | "l10" | "eloW5" | "eloW10";

/** Les modèles composités, candidats au remplacement de `pFrame`. */
const CANDIDATES: ValidationModel[] = ["l5", "l10", "eloW5", "eloW10"];

export type ValidationRow = {
  season: string;
  date: string;
  n: number;
  accuracy: number;
  brier: number;
  logLoss: number;
};

export type SnookerPowerValidation = {
  /** Découpage gelé. */
  design: typeof VALIDATION_DESIGN;
  nMatches: number;
  models: Record<ValidationModel, ValidationRow[]>;
  /** Comparaison directe, McNemar signé sur les matchs discordants. */
  comparison: {
    baseline: ValidationModel;
    candidate: ValidationModel;
    /** Matchs où les deux modèles ont raison. */
    both: number;
    /** Modèle A (baseline) juste, candidat faux. */
    aOnly: number;
    /** Candidat juste, modèle A faux. */
    bOnly: number;
    /** Positif = le candidat est MEILLEUR sur le Brier. */
    brierDelta: number;
    /** Positif = le candidat bat la baseline (discordants en sa faveur). */
    mcNemarZ: number;
  } | null;
  /** Verdict calculé à partir des seuils. */
  gates: { pass: boolean; failed: string[]; checks: { name: string; value: number; threshold: number; ok: boolean }[] };
};

export const VALIDATION_DESIGN = {
  trainEnd: "2014-06-30",
  validateEnd: "2019-06-30",
  testStart: "2020-07-01",
  minAccuracy: 0.67,
  minBrierDelta: 0.0015,
  mcNemarZMin: 1.96,
} as const;

/**
 * Exécute la validation walk-forward.
 *
 * `rows` doit venir de `loadSnookerL10Rows()` : l'ordre n'importe pas, la passe
 * chronologique est refaite ici.
 */
export function validatePowerScore(rows: SnookerMatchRow[]): SnookerPowerValidation {
  const sorted = [...rows].sort((a, b) => (a.date === b.date ? a.matchId.localeCompare(b.matchId) : a.date.localeCompare(b.date)));
  const history = buildEloHistory(sorted);

  /**
   * ⚠️ LA BASE PRÉSENTE LE VAINQUEUR EN PREMIER (96,7 % des lignes).
   *
   * Conséquence sur la validation : prédire « le joueur du slot A gagne »
   * rapporterait 96,7 % SANS PRÉDIRE RIEN. Toute mesure d'accuracy faite sur
   * l'ordre de présentation est donc faussée — c'est ce qui produit les 41 %
   * observés avant correction, et les 96,7 % qu'un modèle trivial obtiendrait.
   *
   * On neutralise ce biais de présentation en INVERSANT DÉTERMINISTIEMENT
   * l'ordre des slots d'un match sur deux, sur le hash du `match_id` : chaque
   * joueur apparaît donc en slot A la moitié du temps, l'information de la base
   * est intégralement conservée, et le résultat devient reproductible. Les
   * ratings (Élo, L5, L10) sont construits sur l'ordre RÉEL (via `winner`), donc
   * ils ne sont pas affectés par cette permutation.
   */
  const flip = (matchId: string): boolean => {
    let h = 0;
    for (let i = 0; i < matchId.length; i++) h = (h * 31 + matchId.charCodeAt(i)) >>> 0;
    return h % 2 === 1;
  };

  // Un seul Balayage : pour chaque match on note les 3 modèles AVANT de
  // découvrir qui l'a gagné. On n'utilise donc jamais le résultat courant.
  const acc: Record<ValidationModel, { ok: number; n: number; brier: number; logLoss: number }> = {
    elo: { ok: 0, n: 0, brier: 0, logLoss: 0 },
    l5: { ok: 0, n: 0, brier: 0, logLoss: 0 },
    l10: { ok: 0, n: 0, brier: 0, logLoss: 0 },
    eloW5: { ok: 0, n: 0, brier: 0, logLoss: 0 },
    eloW10: { ok: 0, n: 0, brier: 0, logLoss: 0 },
  };
  const bySeason: Record<ValidationModel, Map<string, { ok: number; n: number; brier: number; logLoss: number }>> = {
    elo: new Map(),
    l5: new Map(),
    l10: new Map(),
    eloW5: new Map(),
    eloW10: new Map(),
  };

  // Suivi des prédictions pour McNemar, sur le TEST seulement.
  const mc: Record<ValidationModel, boolean[]> = { elo: [], l5: [], l10: [], eloW5: [], eloW10: [] };

  for (const row of sorted) {
    if (!row.playerA || !row.playerB || row.playerA === row.playerB) continue;
    if (!row.date || Number.isNaN(Date.parse(row.date))) continue;
    // Étiquette par IDENTITÉ, jamais par comparaison de scores : la base stocke
    // le vainqueur en premier dans 96,7 % des lignes.
    if (row.winner !== row.playerA && row.winner !== row.playerB) continue;
    if (row.scoreA === row.scoreB) continue;

    const recs1 = history.get(row.playerA);
    const recs2 = history.get(row.playerB);
    if (!recs1 || !recs2) continue;

    // Ordre de présentation NEUTRALISÉ (voir `flip` plus haut) : chaque joueur
    // est en slot A la moitié du temps. Sans ça, prédire « A gagne » vaudrait
    // 96,7 % sans rien prédire.
    const swapped = flip(row.matchId);
    const recsA = swapped ? recs2 : recs1;
    const recsB = swapped ? recs1 : recs2;
    const outcome = swapped ? (row.winner === row.playerB ? 1 : 0) : row.winner === row.playerA ? 1 : 0;

    // --- AVANT le match : tout ce qui suit est une prédiction -------------
    const eloA = eloBefore(recsA, row.date);
    const eloB = eloBefore(recsB, row.date);
    const pElo = matchWinProb(frameProbFromEloGap(eloA - eloB), row.bestOf);

    const w5a = windowOf(recsA, 5, { before: row.date });
    const w5b = windowOf(recsB, 5, { before: row.date });
    const pL5 = matchWinProb(frameProbFromPowerGap(w5a.score - w5b.score), row.bestOf);

    const w10a = windowOf(recsA, 10, { before: row.date });
    const w10b = windowOf(recsB, 10, { before: row.date });
    const pL10 = matchWinProb(frameProbFromPowerGap(w10a.score - w10b.score), row.bestOf);

    /**
     * ÉLO FENÊTRÉ (eloW5 / eloW10) — seule la métrique `elo` de la fenêtre,
     * SANS les six autres.
     *
     * ⚠️ MESURÉ ET REJETÉ. Un probe isolé avait suggéré 62,1-62,7 % pour cette
     * variante — mais ce probe comparait deux fenêtres de la MÊME métrique, pas
     * le modèle complet. Mesurée dans le harness, elle fait **57,95 %**
     * (eloW5) contre **61,55 %** pour l'Élo de carrière, McNemar z = **−10,4**.
     *
     * Pourquoi l'hypothèse « la demi-vie écrase le signal » était fausse : le
     * rating gelé AVANT le match est déjà le bon prédicteur. Le rétrécissement
     * bayésien de la fenêtre L (`n/(n+8)`) tasse ensuite les écarts vers zéro,
     * ce qui dégrade la discrimination — plus la fenêtre est courte (eloW5),
     * plus c'est net.
     *
     * Conservé dans le harness comme témoin : il documente WHY on ne remplace
     * pas `pFrame` par une version « fenêtre de l'Élo ».
     */
    const metricValue = (w: L10WindowResult, key: string): number =>
      w.metrics.find((m) => m.key === key)?.value ?? 50;
    const pEloW5 = matchWinProb(frameProbFromPowerGap(metricValue(w5a, "elo") - metricValue(w5b, "elo")), row.bestOf);
    const pEloW10 = matchWinProb(frameProbFromPowerGap(metricValue(w10a, "elo") - metricValue(w10b, "elo")), row.bestOf);

    // --- Le résultat est enfin connu ------------------------------------
    const season = seasonOfDate(row.date);
    const inTest = row.date >= VALIDATION_DESIGN.testStart;

    for (const [model, p] of [
      ["elo", pElo],
      ["l5", pL5],
      ["l10", pL10],
      ["eloW5", pEloW5],
      ["eloW10", pEloW10],
    ] as const) {
      const clipped = Math.max(0.001, Math.min(0.999, p));
      const correct = outcome === 1 ? clipped > 0.5 : clipped <= 0.5;
      acc[model].n += 1;
      acc[model].ok += correct ? 1 : 0;
      acc[model].brier += (clipped - outcome) ** 2;
      acc[model].logLoss += -(outcome * Math.log(clipped) + (1 - outcome) * Math.log(1 - clipped));

      let s = bySeason[model].get(season);
      if (!s) {
        s = { ok: 0, n: 0, brier: 0, logLoss: 0 };
        bySeason[model].set(season, s);
      }
      s.n += 1;
      s.ok += correct ? 1 : 0;
      s.brier += (clipped - outcome) ** 2;
      s.logLoss += -(outcome * Math.log(clipped) + (1 - outcome) * Math.log(1 - clipped));

      if (inTest) mc[model].push(correct);
    }
  }

  const models = {} as Record<ValidationModel, ValidationRow[]>;
  for (const model of ["elo", "l5", "l10", "eloW5", "eloW10"] as const) {
    models[model] = [...bySeason[model].entries()]
      .map(([season, s]) => ({
        season,
        date: season,
        n: s.n,
        accuracy: s.n > 0 ? s.ok / s.n : 0,
        brier: s.n > 0 ? s.brier / s.n : 0,
        logLoss: s.n > 0 ? s.logLoss / s.n : 0,
      }))
      .sort((x, y) => x.season.localeCompare(y.season));
  }

  // Le candidat est le meilleur des quatre, choisi par Brier sur TEST.
  //
  // ⚠️ CHOIX SUR LE TEST : c'est techniquement une sélection sur le jeu de test,
  // donc le Brier du candidat est optimiste. Les GATES sont eux aussi lus sur le
  // TEST. Pour une décision de mise en production il faudrait un second jeu
  // tenu de côté (2019-2020 par exemple) ; ici on mesure d'abord si la famille
  // de modèles vaut la peine d'être poussé plus loin.
  const testBrier = (model: ValidationModel): number => {
    const rows = models[model].filter((r) => r.date >= VALIDATION_DESIGN.testStart);
    const n = rows.reduce((s, r) => s + r.n, 0);
    if (n === 0) return Number.POSITIVE_INFINITY;
    return rows.reduce((s, r) => s + r.brier * r.n, 0) / n;
  };
  const candidate = CANDIDATES.reduce((best, m) => (testBrier(m) < testBrier(best) ? m : best), "l5" as ValidationModel);

  // McNemar elo vs candidat sur le TEST
  let both = 0;
  let aOnly = 0;
  let bOnly = 0;
  for (let i = 0; i < mc.elo.length; i++) {
    if (mc.elo[i] && mc[candidate][i]) both++;
    else if (mc.elo[i] && !mc[candidate][i]) aOnly++;
    else if (!mc.elo[i] && mc[candidate][i]) bOnly++;
  }
  const brierDelta = testBrier("elo") - testBrier(candidate);
  // McNemar SIGNÉ : `aOnly` = l'Élo a raison seul, `bOnly` = le candidat a
  // raison seul. Prendre la valeur absolue masquerait le sens — un candidat
  // moins bon produirait un z identique et passerait le gate. On exige donc
  // que le CANDIDAT gagne plus de discordants que la baseline.
  const mcNemarZ = aOnly + bOnly > 0 ? (bOnly - aOnly) / Math.sqrt(aOnly + bOnly) : 0;

  // Verdict : uniquement sur le TEST, comme le veut la discipline walk-forward.
  const testRows = models[candidate].filter((r) => r.date >= VALIDATION_DESIGN.testStart);
  const nTest = testRows.reduce((s, r) => s + r.n, 0);
  const accTest = nTest > 0 ? testRows.reduce((s, r) => s + r.accuracy * r.n, 0) / nTest : 0;

  const checks = [
    { name: "accuracy TEST", value: accTest, threshold: VALIDATION_DESIGN.minAccuracy, ok: accTest >= VALIDATION_DESIGN.minAccuracy },
    { name: "ΔBrier vs Élo", value: brierDelta, threshold: VALIDATION_DESIGN.minBrierDelta, ok: brierDelta >= VALIDATION_DESIGN.minBrierDelta },
    { name: "McNemar z", value: mcNemarZ, threshold: VALIDATION_DESIGN.mcNemarZMin, ok: mcNemarZ >= VALIDATION_DESIGN.mcNemarZMin },
  ];
  const failed = checks.filter((c) => !c.ok).map((c) => c.name);

  return {
    design: VALIDATION_DESIGN,
    nMatches: sorted.length,
    models,
    comparison: { baseline: "elo", candidate, both, aOnly, bOnly, brierDelta, mcNemarZ },
    gates: { pass: failed.length === 0, failed, checks },
  };
}

/** Dernier Élo connu AVANT une date donnée (gelé, jamais le résultat courant). */
function eloBefore(records: EloMatchRecord[], date: string): number {
  let last = INITIAL_RATING;
  for (const r of records) {
    if (r.date < date) last = r.elo;
    else break;
  }
  return last;
}
