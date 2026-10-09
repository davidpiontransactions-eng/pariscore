/**
 * Calibration des prédictions live — Brier Score et Log-Loss, modèle vs marché.
 *
 * POURQUOI CE MODULE EXISTE
 * ------------------------
 * Le widget livetennis affiche des probabilités Markov à côté des probabilités
 * implicites du bookmaker. Jusqu'ici RIEN ne mesurait si ces probabilités
 * valent mieux que le marché. Sans cette mesure, tout le travail de modèle
 * reste de la décoration : on ne sait pas si le Markov bat la cote implicite.
 *
 * Le widget ne prétend pas que le modèle est bon : il affiche l'écart au
 * marché, et ce module est le seul endroit qui peut démontrer que cet écart
 * ne vaut rien.
 *
 * C'est le point le plus important du projet de moteur, parce qu'il est le seul
 * qui peut CONTREDIRE les autres : une、電話 qui dit « le modèle est à +12 pts
 * du marché » doit pouvoir être demonstrate faux.
 *
 * MÉTRIQUES
 * ---------
 * Brier Score :  BS = (1/N) · Σ (f_t − o_t)²
 *   f_t = probabilité prédite, o_t = résultat observé (1 si A gagne, 0 sinon).
 *   Plus bas = mieux. 0 parfait, 0.25 = toujours 50 %.
 *
 * Log-Loss :    LL = −(1/N) · Σ [ o_t·ln(f_t) + (1−o_t)·ln(1−f_t) ]
 *   Même ordre de grandeur que le Brier mais PÉNALISE beaucoup plus fort une
 *   confiance à 95 % qui se trompe (ln(0.05) = −3,0) qu'une confiance à 60 %
 *   qui se trompe (ln(0.40) = −0,92). Un modèle qui annonce 0 % sur un match
 *   serré se fait châtier : le Log-Loss le sanctionne, le Brier presque pas.
 *
 * LECTURE : `skillScore` = 1 − BS_modèle / BS_marché. Positif ⇒ le modèle
 * apporte; négatif ⇒ le marché fait mieux et le widget affiche du bruit.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Une prédiction SCELLÉE : ce qu'on croyait, et le résultat constaté. */
export type CalibrationRecord = {
  /** Identifiant unique de la prédiction (matchId + marché + timestamp). */
  id: string;
  /** Marché mesuré : "match" | "set-N" | "game" | "break" | "tiebreak". */
  market: string;
  /** P(A gagne) selon le modèle PariScore, dans [0, 1]. */
  modelProb: number;
  /** P(A gagne) implicite du bookmaker, dans [0, 1]. */
  marketProb: number;
  /** 1 si A a gagné, 0 sinon. */
  outcome: 0 | 1;
  /** Date de résolution (ISO). */
  resolvedAt: string;
};

// ── Primitives de métrique ───────────────────────────────────────────────────

/** Borne une probabilité dans [eps, 1−eps] : ln(0) = −Infinity. */
function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(1 - 1e-9, Math.max(1e-9, p));
}

/**
 * Brier Score (plage [0, 1]). Plus bas = mieux.
 *
 * Pas de clamp à 1−eps ici, contrairement au Log-Loss : le Brier ne contient
 * aucun logarithme, donc une prédiction parfaite doit valoir EXACTEMENT 0 et
 * non 1e−18. Seule la garde non-fini reste.
 *
 * @returns 0 si aucune observation (une absence de données n'est pas un 0).
 */
export function brierScore(
  records: ReadonlyArray<{ prob: number; outcome: 0 | 1 }>
): number {
  if (records.length === 0) return 0;
  let sum = 0;
  for (const r of records) {
    const f = Number.isFinite(r.prob) ? r.prob : 0.5;
    const d = f - r.outcome;
    sum += d * d;
  }
  return sum / records.length;
}

/**
 * Log-Loss moyen (plage [0, +∞)). Châtie fort les confiances excessives.
 * @returns 0 si aucune observation.
 */
export function logLoss(
  records: ReadonlyArray<{ prob: number; outcome: 0 | 1 }>
): number {
  if (records.length === 0) return 0;
  let sum = 0;
  for (const r of records) {
    const f = clampProb(r.prob);
    sum += r.outcome === 1 ? -Math.log(f) : -Math.log(1 - f);
  }
  return sum / records.length;
}

// ── Comparaison modèle vs marché ─────────────────────────────────────────────

export type CalibrationReport = {
  /** Nombre d'observations résolues. */
  n: number;
  brierModel: number;
  brierMarket: number;
  logLossModel: number;
  logLossMarket: number;
  /**
   * 1 − BS_modèle / BS_marché. > 0 : le modèle bat le marché.
   * null si le marché n'a aucune observation (division par 0).
   */
  skillScore: number | null;
  /** Même chose sur le Log-Loss. */
  logLossSkill: number | null;
  /** Verdict lisible, avec la franchise sur la taille d'échantillon. */
  verdict: string;
};

/** En dessous de ce nombre d'observations, aucune conclusion n'est fiable. */
export const MIN_SAMPLES_FOR_VERDICT = 30;

/**
 * Compare le modèle PariScore au marché sur un même jeu d'observations.
 *
 * Les deux scores sont calculés sur les MÊMES matchs : c'est la seule
 * comparaison honnête. Un Brier modèle calculé sur 400 matchs et un Brier
 * marché sur 12 n'ont aucun sens.
 */
export function calibrate(
  records: ReadonlyArray<CalibrationRecord>
): CalibrationReport {
  const model = records.map((r) => ({ prob: r.modelProb, outcome: r.outcome }));
  const market = records.map((r) => ({ prob: r.marketProb, outcome: r.outcome }));

  const brierModel = brierScore(model);
  const brierMarket = brierScore(market);
  const logLossModel = logLoss(model);
  const logLossMarket = logLoss(market);

  const skillScore = brierMarket > 0 ? 1 - brierModel / brierMarket : null;
  const logLossSkill =
    logLossMarket > 0 ? 1 - logLossModel / logLossMarket : null;

  const n = records.length;
  let verdict: string;
  if (n === 0) {
    verdict = "Aucune observation résolue — le modèle n'a pas encore été évalué.";
  } else if (n < MIN_SAMPLES_FOR_VERDICT) {
    verdict =
      `${n} observation(s) seulement (< ${MIN_SAMPLES_FOR_VERDICT}) : ` +
      `aucune conclusion fiable, le bruit domine.`;
  } else if (skillScore === null) {
    verdict = `${n} observations, mais le marché n'a produit aucune probabilité exploitable.`;
  } else if (skillScore > 0.05) {
    verdict =
      `Sur ${n} observations, le modèle bat le marché de ${(skillScore * 100).toFixed(1)} % ` +
      `de Brier. L'écart affiché a un fondement.`;
  } else if (skillScore < -0.05) {
    verdict =
      `Sur ${n} observations, le modèle est ${(-skillScore * 100).toFixed(1)} % MOINS bon ` +
      `que le marché (Brier). L'écart affiché est du bruit — ne pas s'en servir pour parier.`;
  } else {
    verdict =
      `Sur ${n} observations, modèle et marché sont statistiquement équivalents ` +
      `(écart ${(skillScore * 100).toFixed(1)} %). Le widget n'apporte rien de mesurable.`;
  }

  return {
    n,
    brierModel,
    brierMarket,
    logLossModel,
    logLossMarket,
    skillScore,
    logLossSkill,
    verdict,
  };
}

// ── Agrégation par marché ───────────────────────────────────────────────────

export type MarketCalibration = CalibrationReport & { market: string };

/** Ventile les observations par marché, trié du plus au moins observé. */
export function calibrateByMarket(
  records: ReadonlyArray<CalibrationRecord>
): MarketCalibration[] {
  const groups = new Map<string, CalibrationRecord[]>();
  for (const r of records) {
    const g = groups.get(r.market);
    if (g) g.push(r);
    else groups.set(r.market, [r]);
  }
  return [...groups.entries()]
    .map(([market, rs]) => ({ market, ...calibrate(rs) }))
    .sort((a, b) => b.n - a.n);
}

// ── Journal d'observations ───────────────────────────────────────────────────

/**
 * Dépôt d'observations côté serveur (un match = une ligne).
 * Volontairement sans dépendance : le même module tourne dans le moteur, dans
 * un script cron et dans un test bun.
 */
export interface CalibrationLog {
  record(r: CalibrationRecord): Promise<void>;
  all(): Promise<CalibrationRecord[]>;
}

/** Journal en mémoire — pour les tests et le live. */
export function inMemoryCalibrationLog(
  seed: ReadonlyArray<CalibrationRecord> = []
): CalibrationLog {
  const rows = [...seed];
  return {
    async record(r) {
      rows.push(r);
    },
    async all() {
      return [...rows];
    },
  };
}