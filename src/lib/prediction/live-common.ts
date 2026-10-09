/**
 * Contrat partagé des moteurs live multi-sports (mission 2026-10-09).
 *
 * Six sports, six fichiers `live-<sport>.ts`, UNE grammaire de sortie : le
 * composant `live-predictive-bets-widget.tsx` est polymorphe et ne lit QUE ce
 * contrat. Aucun moteur ne connaît le DOM, aucun composant ne calcule de
 * probabilité — même séparation que tennis (`pip-bet-panel.tsx` ×
 * `live-markov.ts`).
 *
 * Convention : toute probabilité exposée ici est un flottant **[0, 1]**. Le
 * passage en pourcentage est un affaire d'affichage.
 */

import { clampMicroBetProb } from "./live-markov";

// ---------------------------------------------------------------------------
// Grammaire
// ---------------------------------------------------------------------------

/** Sports couverts par le module BETS PRÉDICTIFS LIVE. */
export type LiveSport =
  | "football"
  | "basketball"
  | "hockey"
  | "baseball"
  | "handball"
  | "snooker";

/**
 * Portée du marché — pilote le filtre par pilules `[Tous] [Match/Set/Période]
 * [Micro-Bets]`. `match` = issue de fin de rencontre, `period` = issue d'un
 * segment en cours (quartier, période, mi-temps, manche, frame), `micro` =
 * événement à très court terme (prochain but, prochain panier, prochain
 * passage au bâton).
 */
export type MarketScope = "match" | "period" | "micro";

/** Une issue d'un marché (les issues d'un marché somment à 1). */
export type LiveOutcome = {
  /** Clé stable — sert de clé React et de cible de test. */
  id: string;
  /** Libellé prêt à afficher, déjà en français. */
  label: string;
  /** Probabilité dans [0, 1]. */
  prob: number;
};

/** Un marché : un titre, N issues exhaustives, une portée. */
export type LiveMarket = {
  id: string;
  scope: MarketScope;
  label: string;
  /** Précision methodologique affichée en infobulle. */
  hint?: string;
  /**
   * true quand l'issue est FACTUELLEMENT tranchée (match terminé, temps
   * réglementaire écoulé, impossibilité physique). Les probabilités d'un tel
   * marché ne sont PAS bornées : « 100 % » y est la vérité, alors que sur un
   * marché vivant il serait un défaut d'affichage.
   */
  archived?: boolean;
  /** Au moins 2 issues, somme = 1 (invariant vérifié par les tests). */
  outcomes: LiveOutcome[];
};

/** Un driver observé (jauge néon) : jauge + valeur affichée. */
export type LiveDriver = {
  label: string;
  /** Position de la jauge, [0, 1]. */
  ratio: number;
  /** Valeur formatée (« 1.34 xG », « 62 % », « 8 Corsi »). */
  display: string;
};

/** Sortie complète d'un moteur, consommée telle quelle par le widget. */
export type LiveBetsBundle = {
  sport: LiveSport;
  scoreA: number;
  scoreB: number;
  /** Horloge du segment en cours, si le sport en a une (« 63' », « Q3 04:12 »). */
  clock?: string;
  markets: LiveMarket[];
  drivers: LiveDriver[];
};

// ---------------------------------------------------------------------------
// Garde-fous probabilistes
// ---------------------------------------------------------------------------

/**
 * Bornes des micro-marchés multi-sports : [2 %, 98 %].
 *
 * Plus larges que le tennis ([3 %, 97 %]) parce qu'un handicape serré en
 * basket/baseball produit naturellement des probabilités à 1-2 % : une borne
 * à 3 % les écraserait toutes en 3 % et le marché deviendrait inexploitable.
 * Le plafond 98 % joue le même rôle que le plancher 3 % côté tennis : tant que
 * l'événement n'est pas officiellement terminé, « 100 % » est un défaut
 * d'affichage, pas une prédiction.
 */
export const LIVE_PROB_MIN = 0.02;
export const LIVE_PROB_MAX = 0.98;

/** Borne une probabilité de marché multi-sports dans [2 %, 98 %]. */
export function clampLiveProb(p: number): number {
  return clampMicroBetProb(p, LIVE_PROB_MIN, LIVE_PROB_MAX);
}

/**
 * Projette un vecteur sur le simplexe borné {p : Σp = 1, min ≤ p ≤ max}.
 *
 * Bornage puis redistribution, réitérés : chaque issue hors bornes est FIGÉE à
 * sa borne, et le solde `1 − Σ(figées)` est réparti au prorata des issues
 * encore libres.
 *
 * ⚠️ Le plafond effectif n'est PAS toujours `LIVE_PROB_MAX` : avec N issues,
 * la borne haute doit laisser la place aux N−1 autres à leur plancher. Sinon la
 * projection est INFAISABLE — sur [0.99, 0.005, 0.005] avec 3 issues, on
 * demanderait 0.98 + 0.02 + 0.02 = 1.02 pour une somme qui doit valoir 1, et
 * aucune solution n'existe dans [min, max]^3. D'où :
 *
 *   plafond réel = min(LIVE_PROB_MAX, 1 − (N−1)·LIVE_PROB_MIN)
 *
 * soit 96 % pour 3 issues, 94 % pour 4 — le seul plafond qui reste jointly
 * faisable avec le plancher et la somme à 1.
 */
function projectOntoCappedSimplex(p: number[], min: number, max: number): number[] {
  const n = p.length;
  if (n === 0) return [];
  // Plafond réellement atteignable une fois les N−1 autres issues au plancher.
  const effectiveMax = Math.max(min, Math.min(max, 1 - (n - 1) * min));
  const out = p.slice();
  const pinned = new Array<boolean>(n).fill(false);

  for (let iter = 0; iter < 32; iter++) {
    let pinnedSum = 0;
    for (let i = 0; i < n; i++) {
      if (out[i] >= effectiveMax) {
        out[i] = effectiveMax;
        pinned[i] = true;
      } else if (out[i] <= min) {
        out[i] = min;
        pinned[i] = true;
      }
      if (pinned[i]) pinnedSum += out[i];
    }
    const free: number[] = [];
    for (let i = 0; i < n; i++) if (!pinned[i]) free.push(i);
    if (free.length === 0) break;

    const target = 1 - pinnedSum;
    const freeSum = free.reduce((a, i) => a + out[i], 0);
    if (freeSum <= 0) {
      const share = target / free.length;
      for (const i of free) out[i] = share;
    } else {
      for (const i of free) out[i] = (out[i] / freeSum) * target;
    }
  }
  return out;
}

/**
 * Borne chaque issue PUIS renormalise pour que la somme vaille exactement 1.
 *
 * Garantit simultanément deux propriétés, ce qui est impossible avec un simple
 * « clamp puis diviser » :
 *   1. chaque issue reste dans [2 %, 98 %] — jamais de 0 % ni de 100 % affiché ;
 *   2. la somme vaille exactement 1 — deux issues à 50 % ne somment pas à 101 %.
 *
 * Une entrée dégénérée (tout NaN) part d'une distribution uniforme : afficher
 * « 33 / 33 / 33 % » est honnête, planter ne l'est pas.
 */
/**
 * Normalise les issues d'un marché.
 *
 * @param opts.clampBounds - false pour un marché ARCHIVÉ (issue tranchée par
 *   le score, le temps écoulé, ou une impossibilité physique). Le bornage
 *   [2 %, 98 %] existe pour empêcher un 0 % / 100 % SPURIOUS — « tant que
 *   l'événement n'est pas terminé, on ne peut pas afficher une certitude ».
 *   Une certitude RÉELLE (match fini, century impossible sur 20 points
 *   restants) doit s'afficher telle quelle : la tronquer en 98 % ferait
 *   mentir l'utilisateur sur un match terminé.
 */
export function normalizeOutcomes(
  rows: ReadonlyArray<{ id: string; label: string; prob: number }>,
  opts: { clampBounds?: boolean } = {}
): LiveOutcome[] {
  const n = rows.length;
  if (n === 0) return [];
  const raw = rows.map((r) => ({
    id: r.id,
    label: r.label,
    prob: Number.isFinite(r.prob) ? r.prob : 1 / n,
  }));

  // Normalisation proportionnelle d'abord : le bornage doit ensuite répartir le
  // déficit, pas le créer.
  const sum = raw.reduce((a, r) => a + r.prob, 0);
  const scaled = sum > 0 ? raw.map((r) => r.prob / sum) : raw.map(() => 1 / n);
  if (opts.clampBounds === false) return raw.map((r, i) => ({ id: r.id, label: r.label, prob: scaled[i] }));

  const projected = projectOntoCappedSimplex(scaled, LIVE_PROB_MIN, LIVE_PROB_MAX);
  return raw.map((r, i) => ({ id: r.id, label: r.label, prob: projected[i] }));
}

// ---------------------------------------------------------------------------
// Aides numériques partagées
// ---------------------------------------------------------------------------

/** Borne une valeur dans [0, 1] ; un NaN devient 0. */
export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/** Borne une valeur dans [min, max] ; un NaN devient `min`. */
export function clampRange(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

/** P(X ≥ k) pour X ~ Poisson(λ) — sommation par puissances successives. */
export function poissonAtLeast(k: number, lambda: number): number {
  if (!Number.isFinite(k) || k <= 0) return 1;
  if (!Number.isFinite(lambda) || lambda <= 0) return 0;
  if (k > lambda + 40) return 0;
  let cdf = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    cdf += term;
    if (!Number.isFinite(term)) break;
    term *= lambda / (i + 1);
  }
  return clamp01(1 - cdf);
}

/**
 * Course à un seuil : P(A atteint `needA` avant que B n'atteigne `needB`),
 * chaque « point » revenant à A avec probabilité `p` (indépendant).
 *
 * P(A gagne) = Σ_{k=0}^{needB−1} C(needA−1+k, k)·p^needA·(1−p)^k
 *
 * ⚠️ Cette série ne converge que si p < 1/2 : au-delà, le rapport
 * C(a−1+k,k)·((1−p)/p)^k croît et la somme explose (à p = 0.5 elle vaut 3.94
 * pour une probabilité qui doit être 0.5). On évalue donc toujours le côté le
 * PLUS FAIBLE par cette formule, puis on prend le complément :
 *
 *   p ≤ ½  → P(A) = Σ_{k<needB} C(needA−1+k,k)·p^needA·(1−p)^k
 *   p > ½  → P(A) = 1 − Σ_{k<needA} C(needB−1+k,k)·(1−p)^needB·p^k
 *
 * Reste stable pour les courses longues (100 points au snooker) grâce au
 * factoring p^a : le coefficient binomial croît en k mais jamais plus vite que
 * la queue décroît.
 */
export function raceToProb(p: number, needA: number, needB: number): number {
  const pa = clamp01(p);
  const a = Math.max(0, Math.floor(needA));
  const b = Math.max(0, Math.floor(needB));
  if (a === 0) return 1;
  if (b === 0) return 0;
  if (pa <= 0) return 0;
  if (pa >= 1) return 1;

  const direct = pa <= 0.5 ? raceSide(pa, a, b) : 1 - raceSide(1 - pa, b, a);
  return clamp01(direct);
}

/**
 * P(l'obTenant l'emporte : `a` avant que l'autre n'atteigne `b`),
 * où `pWin` est la probabilité de l'obTenant (≤ 0.5 pour rester convergent).
 *
 * terme_k = C(a−1+k, k) · pWin^a · q^k, factorisé en pWin^a · C(a−1+k,k) · q^k.
 * `binom` suit C(a−1+k, k) par la récurrence C(n,k+1) = C(n,k)·(n−k)/(k+1),
 * `qPow` suit q^k. Aucun ratio (q/p)^k ici : à p = 0.5, ce ratio vaut 1 et la
 * somme Σ C(a−1+k,k) explose (3.94 pour une probabilité qui doit valoir 0.5).
 */
function raceSide(pWin: number, a: number, b: number): number {
  const q = 1 - pWin;
  let acc = 0;
  let binom = 1; // C(a−1+0, 0)
  let qPow = 1; // q^0
  for (let k = 0; k < b; k++) {
    if (k > 0) {
      binom = (binom * (a - 1 + k)) / k;
      qPow *= q;
    }
    acc += binom * qPow;
    if (!Number.isFinite(acc)) break;
  }
  return Math.pow(pWin, a) * acc;
}

/**
 * Issue du prochain but d'une fenêtre donnée, deux équipes Poisson
 * indépendantes de taux λA / λB.
 *
 * λA = 0 → l'équipe B est l'unique buteur possible ; λA = λB = 0 → aucun
 * événement. Les trois issues somment à 1 exactement (téléscopage
 * (λA/(λA+λB) + λB/(λA+λB))·(1 − e^−(λA+λB)) + e^−(λA+λB) = 1).
 */
export function nextScorerProbs(lambdaA: number, lambdaB: number): {
  a: number;
  none: number;
  b: number;
} {
  const la = Math.max(0, Number.isFinite(lambdaA) ? lambdaA : 0);
  const lb = Math.max(0, Number.isFinite(lambdaB) ? lambdaB : 0);
  const total = la + lb;
  if (total <= 0) return { a: 0.34, none: 0.33, b: 0.33 };
  return {
    a: (la / total) * (1 - Math.exp(-total)),
    none: Math.exp(-total),
    b: (lb / total) * (1 - Math.exp(-total)),
  };
}

/** Construit un marché typé (garde-fou : au moins 2 issues). */
export function market(
  id: string,
  scope: MarketScope,
  label: string,
  hint: string,
  rows: ReadonlyArray<{ id: string; label: string; prob: number }>
): LiveMarket {
  return { id, scope, label, hint, outcomes: normalizeOutcomes(rows) };
}

/**
 * Marché ARCHIVÉ : l'issue est factuellement tranchée (match terminé, temps
 * réglementaire écoulé, impossibilité physique). Aucune borne n'est appliquée :
 * afficher 98 % sur un match terminé serait un mensonge.
 */
export function resolvedMarket(
  id: string,
  scope: MarketScope,
  label: string,
  hint: string,
  rows: ReadonlyArray<{ id: string; label: string; prob: number }>
): LiveMarket {
  return {
    id,
    scope,
    label,
    hint,
    archived: true,
    outcomes: normalizeOutcomes(rows, { clampBounds: false }),
  };
}

/** Construit une jauge de driver bornée dans [0, 1]. */
export function driver(label: string, ratio: number, display: string): LiveDriver {
  return { label, ratio: clamp01(ratio), display };
}