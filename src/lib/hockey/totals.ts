/**
 * src/lib/hockey/totals.ts
 *
 * Distribution du nombre de buts en temps réglementaire : lignes Over/Under,
 * 1X2 et marge. Modèle Poisson, λ hybride pondéré.
 *
 * ── Pourquoi Poisson ──────────────────────────────────────────────────────
 *
 * Sadeghkhani & Ahmed (Stats 2019) posent le bon diagnostic — « the fact that
 * the dispersion index … equals one is a big concern in practice » — puis
 * testent Poisson contre Conway-Maxwell-Poisson, et leur propre conclusion
 * est que Poisson gagne. Zeinular (MDPI Sports 2019) choisit COM-P pour la
 * même raison mais N'ESTIME PAS la dispersion. Personne ne donne de chiffre.
 * Donc `indiceDispersion()` mesure le ratio variance/moyenne SUR NOS DONNÉES
 * et le signale. On ne suppose pas, on mesure : si le ratio sort de
 * [0.85, 1.20], COM-P devient justifié par une mesure, pas par une intuition.
 *
 * ── Skellam n'est pas le total ───────────────────────────────────────────
 *
 * Skellam est la DIFFÉRENCE de deux Poisson (λ_H − λ_A) : l'outil de la
 * marge et du 1X2. Le TOTAL est la SOMME, donc une convolution. Confondre
 * les deux fait afficher une distribution de marge comme si c'était une
 * distribution de total — les deux sont des lois de Poisson, donc les deux
 * « compilent », et l'erreur ne se voit pas au typecheck.
 *
 * Skellam est évalué par double sommation sur les pmf marginales, et non par
 * la fonction de Bessel modifiée I_k : celle-ci n'est pas dans la stdlib JS,
 * et l'approximation de Sonin est fausse loin de la moyenne — donc fausse
 * exactement dans la queue, qui est tout l'intérêt d'une ligne 6.5.
 *
 * ── Le but en filet vide n'est pas un biais à corriger ────────────────────
 *
 * Le marché O/U se règle sur TOUS les buts, filet vide compris. Soustraire
 * l'ENG ne « fiabilise » rien : ça change le marché que l'on prétend prédire.
 * Lambrix et al. montrent que la densité de buts est au moins TRIPLE sur la
 * dernière minute, via les situations 6 contre 5 déclenchées par l'état du
 * score. L'ENG est donc une COMPOSANTE À MODÉLISER, pas un terme à
 * éliminer. Ici il est isolé dans `partFiletVide()` pour être MESURÉ et
 * documenté, jamais soustrait.
 *
 * ── λ hybride pondéré ────────────────────────────────────────────────────
 *
 * 100 % de la saison courante en début de championnat est trop volatil : à la
 * 3e journée, deux matchs par équipe donnent une moyenne très bruitée. Mais
 * l'historique seul ignore transferts et forme récente. Donc
 *
 *   poidsCourant = min(0,70 ; 0,20 + 0,50 × (matchsJoués / 20))
 *
 * soit 20 % courant à l'ouverture, 45 % à dix matchs, 70 % au-delà de vingt.
 *
 * Chaque λ combine ensuite attaque ET défense par rétrécissement pondéré par
 * la taille d'échantillon : avec 2 matchs observés on suit surtout
 * l'adversaire moyen, avec 40 on suit surtout l'équipe. Sans cela une équipe
 * qui encaisse 6 buts en deux matchs se les voit attribuer 6 par la suite.
 */

const BUTS_MAX = 20;
/** Marge de bookmaker : sans elle, cote = 1/p selon la loi, ce qui est faux. */
const AVANTAGE = 0.05;

export type Taux = { readonly moyenne: number; readonly matchs: number };
export type Moyenne = { readonly moyenne: number; readonly matchs: number };

function taux(liste: readonly number[] | undefined): Taux {
  const vals = (liste ?? []).filter((v) => Number.isFinite(v));
  if (!vals.length) return { moyenne: 0, matchs: 0 };
  return { moyenne: vals.reduce((a, b) => a + b, 0) / vals.length, matchs: vals.length };
}

// ── Lois ──────────────────────────────────────────────────────────────────

/** P(X = k), X ~ Poisson(λ). k négatif ou non entier → 0. */
export function poissonPmf(k: number, lambda: number): number {
  if (!Number.isInteger(k) || k < 0) return 0;
  if (!(lambda > 0)) return k === 0 ? 1 : 0;
  // Puissances successives plutôt que λ^k/k!/e^λ : pas de dépassement.
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p = (p * lambda) / i;
  return p;
}

/** PMF de S = X₁ + X₂ (le TOTAL). Indice k = nombre de buts. */
export function convolutionPoisson(lambda1: number, lambda2: number, max = BUTS_MAX): number[] {
  const pmf: number[] = new Array(max + 1).fill(0);
  for (let i = 0; i <= max; i++) {
    const p1 = poissonPmf(i, lambda1);
    if (p1 === 0 && i > lambda1) break;
    for (let j = 0; i + j <= max; j++) pmf[i + j] += p1 * poissonPmf(j, lambda2);
  }
  return pmf;
}

/** PMF de D = X₁ − X₂ (la MARGE), indexée par d + span. */
export function skellamPmf(lambda1: number, lambda2: number, span = 12): number[] {
  const out: number[] = new Array(span * 2 + 1).fill(0);
  for (let d = -span; d <= span; d++) {
    let s = 0;
    for (let k = 0; k <= BUTS_MAX; k++) {
      const j = k - d;
      if (j < 0 || j > BUTS_MAX) continue;
      s += poissonPmf(k, lambda1) * poissonPmf(j, lambda2);
    }
    out[d + span] = s;
  }
  return out;
}

// ── Marchés ───────────────────────────────────────────────────────────────

function coteJustes(p: number): number | null {
  const nette = p - p * AVANTAGE;
  return p > 0 && nette > 0.01 ? +(1 / nette).toFixed(2) : null;
}

export type LigneOU = {
  readonly ligne: number;
  readonly under: number;
  readonly over: number;
  /** Non nul uniquement sur une ligne ENTIÈRE (5.0) : un but à 5 ne gagne rien. */
  readonly push: number;
  readonly coteUnder: number | null;
  readonly coteOver: number | null;
};

/**
 * Lignes Over/Under depuis la PMF du total.
 *
 * Ligne demi-goal (4.5) : Under = k ≤ 4, jamais push.
 * Ligne entière (5.0)   : Under = k ≤ 4, push = k = 5, Over = k ≥ 6.
 *
 * Le push est ce qui distingue un « 0 % » réel d'une absence de mesure :
 * l'ignorer ferait afficher une cote sur un pari qui ne se joue pas.
 */
export function lignesOverUnder(pmfTotaux: readonly number[], lignes: readonly number[]): LigneOU[] {
  return lignes.map((ligne) => {
    const seuil = Math.floor(ligne);
    let under = 0;
    let push = 0;
    for (let k = 0; k < pmfTotaux.length; k++) {
      if (k < seuil) under += pmfTotaux[k];
      else if (k === seuil) {
        if (Number.isInteger(ligne)) push += pmfTotaux[k];
        else under += pmfTotaux[k];
      } else break;
    }
    const over = 1 - under - push;
    // Aucune arrondi ici : ces probabilités sont ré-alimentées dans le Brier et
    // le log-loss du backtest, où une arrondi à 4 décimales s'accumule au lieu
    // de disparaître. Le formatage se fait à l'affichage.
    return {
      ligne,
      under,
      over,
      push,
      coteUnder: coteJustes(under),
      coteOver: coteJustes(over),
    };
  });
}

export type UnXDeux = { readonly domicile: number; readonly nul: number; readonly exterieur: number };

/** P(domicile / nul / extérieur) en temps réglementaire, depuis la Skellam. */
export function unXDeux(lambdaH: number, lambdaA: number): UnXDeux {
  const span = 15;
  const marge = skellamPmf(lambdaH, lambdaA, span);
  let domicile = 0;
  let nul = 0;
  let exterieur = 0;
  for (let d = -span; d <= span; d++) {
    const p = marge[d + span];
    if (d > 0) domicile += p;
    else if (d === 0) nul += p;
    else exterieur += p;
  }
  const somme = domicile + nul + exterieur || 1;
  return {
    domicile: +(domicile / somme).toFixed(4),
    nul: +(nul / somme).toFixed(4),
    exterieur: +(exterieur / somme).toFixed(4),
  };
}

// ── Estimation de λ ───────────────────────────────────────────────────────

export type HistoriqueEquipe = {
  readonly butsDomicile: readonly number[];
  readonly encaissesDomicile: readonly number[];
  readonly butsExterieur: readonly number[];
  readonly encaissesExterieur: readonly number[];
  readonly matchsSaisonCourante: number;
};

export const EQUIPE_VIDE: HistoriqueEquipe = {
  butsDomicile: [],
  encaissesDomicile: [],
  butsExterieur: [],
  encaissesExterieur: [],
  matchsSaisonCourante: 0,
};

export type PoidsLambda = { readonly poidsSaisonCourante: number; readonly poidsHistorique: number };

/** 20 % courant à l'ouverture, 70 % au-delà de 20 matchs. */
export function poidsLambda(matchsJoues: number): PoidsLambda {
  const p = Math.min(0.7, 0.2 + 0.5 * (Math.max(0, matchsJoues) / 20));
  return { poidsSaisonCourante: +p.toFixed(4), poidsHistorique: +(1 - p).toFixed(4) };
}

/** Mélange courant / historique d'une même série. */
function melanger(courant: Taux, historique: Taux, poids: PoidsLambda): Taux {
  if (!courant.matchs) return historique;
  if (!historique.matchs) return courant;
  return {
    moyenne: poids.poidsSaisonCourante * courant.moyenne + poids.poidsHistorique * historique.moyenne,
    matchs: courant.matchs + historique.matchs,
  };
}

/**
 * Rétrécissement par taille d'échantillon : (n₁μ₁ + n₂μ₂)/(n₁+n₂).
 * L Estimates à 2 matchs ne pèsent que ~5 % face à l'adversaire à 40.
 */
function combiner(a: Taux, b: Taux): Taux {
  const n = a.matchs + b.matchs;
  if (!n) return { moyenne: 0, matchs: 0 };
  return { moyenne: (a.moyenne * a.matchs + b.moyenne * b.matchs) / n, matchs: n };
}

export type Lambda = {
  readonly lambdaH: number;
  readonly lambdaA: number;
  readonly lambdaTotal: number;
  readonly poids: PoidsLambda;
  readonly matchsH: number;
  readonly matchsA: number;
};

/**
 * λ du match en temps réglementaire.
 *
 * λ_H combine l'attaque du recevant à domicile et la défense du visiteur à
 * l'extérieur ; λ_A symétriquement. Chaque composante est d'abord mélangée
 * courant/historique, puis les deux租房 rétrécies ensemble.
 */
export function lambdaTotal(
  domicile: HistoriqueEquipe,
  exterieur: HistoriqueEquipe,
  courant: HistoriqueEquipe,
): Lambda {
  const poids = poidsLambda(Math.min(domicile.matchsSaisonCourante, exterieur.matchsSaisonCourante));

  const atkH = combiner(
    melanger(taux(courant.butsDomicile), taux(domicile.butsDomicile), poids),
    melanger(taux(courant.encaissesExterieur), taux(exterieur.encaissesExterieur), poids),
  );
  const atkA = combiner(
    melanger(taux(courant.butsExterieur), taux(exterieur.butsExterieur), poids),
    melanger(taux(courant.encaissesDomicile), taux(domicile.encaissesDomicile), poids),
  );

  return {
    lambdaH: +atkH.moyenne.toFixed(3),
    lambdaA: +atkA.moyenne.toFixed(3),
    lambdaTotal: +(atkH.moyenne + atkA.moyenne).toFixed(3),
    poids,
    matchsH: atkH.matchs,
    matchsA: atkA.matchs,
  };
}

// ── Diagnostics mesurés ───────────────────────────────────────────────────

export type Dispersion = { readonly ratio: number; readonly matchs: number; readonly surDisperse: boolean };

/**
 * Ratio variance/moyenne des totaux observés. > 1 = sur-dispersion, le
 * Poisson est alors trop optimiste sur les extrêmes. Sous 20 matchs on ne
 * conclut rien : le ratio d'un échantillon minuscule est du bruit.
 */
export function indiceDispersion(totaux: readonly number[]): Dispersion {
  const v = totaux.filter((t) => Number.isFinite(t));
  if (v.length < 20) return { ratio: 1, matchs: v.length, surDisperse: false };
  const moy = v.reduce((a, b) => a + b, 0) / v.length;
  if (moy <= 0) return { ratio: 1, matchs: v.length, surDisperse: false };
  const variance = v.reduce((a, b) => a + (b - moy) ** 2, 0) / v.length;
  return { ratio: +(variance / moy).toFixed(3), matchs: v.length, surDisperse: variance / moy > 1.2 };
}

/**
 * Part de buts en filet vide, en pourcentage — MESURÉE, jamais soustraite.
 * Retirer l'ENG du total ne « fiabilise » pas la prédiction : le marché O/U
 * règle sur tous les buts, donc soustraire viserait un autre marché.
 */
export function partFiletVide(buts: readonly number[], butsFiletVide: readonly number[]): Moyenne {
  const liste = buts.filter((v) => Number.isFinite(v));
  const total = liste.reduce((a, b) => a + b, 0);
  if (!total) return { moyenne: 0, matchs: liste.length };
  const eng = (butsFiletVide ?? []).filter((v) => Number.isFinite(v)).reduce((a, b) => a + b, 0);
  return { moyenne: +((eng / total) * 100).toFixed(2), matchs: liste.length };
}
