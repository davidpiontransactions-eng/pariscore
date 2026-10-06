/**
 * src/lib/hockey/backtest.ts
 *
 * Backtest walk-forward des lignes de totaux Hockey : accuracy, fiabilité des
 * lignes, calibration de la confiance.
 *
 * ── Aucune cote, donc aucun ROI ───────────────────────────────────────────
 *
 * Mesuré le 2026-10-06 : le calendrier KHL local ne porte AUCUN champ de cote
 * (0 sur 748 matchs) et hockeydb ne contient aucune occurrence de « odds ». Le
 * ROI, le Yield et le Bankroll exigent tous trois un prix par pari, qui n'existe
 * pas pour la KHL. Ce module ne produit donc aucune métrique de rentabilité, et
 * ce n'est pas une lacune : c'est la seule chose honnête à afficher. Une
 * simulation à prix fixe aurait l'air de répondre à la question posée tout en
 * mesurant une invention.
 *
 * Ce que la calibration remplace, et pourquoi c'est supérieur ici : si le modèle
 * annonce 56 % sur Under 5.5 et que l'historique en donne 56 %, il est juste —
 * et cela ne dépend d'aucun bookmaker. Le ROI dépend du prix ET de la marge,
 * donc il ne distingue pas un modèle bien calibré d'un modèle légèrement avantagé
 * par une cote.
 *
 * ── Walk-forward strict ───────────────────────────────────────────────────
 *
 * Chaque match est prédit à partir des matchs STRICTEMENT antérieurs. Jamais le
 * match lui-même, jamais les suivants. Une estimation qui inclut le match à
 * prédire mesure la mémoire, pas la prédiction.
 *
 * L'estimation réutilise `lambdaTotal()` de `./totals`, avec son rétrécissement
 * attaque/défense par taille d'échantillon. Réimplémenter ici un calcul
 * « approché » aurait laissé deux modèles diverger, dont celui qui part en prod.
 *
 * ── Le filtre qui change tout ─────────────────────────────────────────────
 *
 * KHL `season_id=407` expose `home_goal_count = "0"` pour les matchs NON JOUÉS,
 * pas `null`. Tout filtre `!= null` intègre des 0-0 fictifs : mesuré, cela donne
 * 0,893 buts/match au lieu de 5,18, et un Under 4.5 à 89,6 %. D'où `estJoue()`,
 * qui exige un score strictement positif ET le statut terminé.
 *
 * ── Exclusion OT/SO ──────────────────────────────────────────────────────
 *
 * Le 1X2 « temps réglementaire » exclut les matchs décidés en prolongation : le
 * nul n'y existe pas, donc les inclure ferait manquer à la régression un nul
 * qu'elle ne pouvait structurellement pas prédire. Le « avec OT » les inclut.
 *
 * ── Push ──────────────────────────────────────────────────────────────────
 *
 * Sur une ligne ENTIÈRE (5.0), un total de 5 ne gagne rien. Ce match sort du
 * win-rate mais RESTE dans le volume affiché : même traitement que
 * `buildTotalLineStats()` côté handball. Le retirer du volume ferait croire à une
 * couverture plus faible que la réelle.
 */

import { convolutionPoisson, lignesOverUnder, lambdaTotal, unXDeux, type HistoriqueEquipe } from "./totals";

/** Lignes par défaut : demi-goal, donc jamais push. */
export const LIGNES_DEFAUT = [4.5, 5.5, 6.5] as const;

/** Sous-effectif en dessous duquel un pourcentage n'est pas interprétable. */
export const SEUIL_FAIBLE = 30;

export type MatchBacktest = {
  readonly id: string;
  readonly date: string;
  readonly domicile: string;
  readonly exterieur: string;
  readonly butsDomicile: number;
  readonly butsExterieur: number;
  /** Le match s'est décidé en prolongation ou au shootout. */
  readonly prolongation: boolean;
  readonly saison: string;
};

/** Issue observée : 0 domicile, 1 nul, 2 extérieur. */
export const Issue = { Domicile: 0, Nul: 1, Exterieur: 2 } as const;

export type Prevision = {
  readonly matchId: string;
  readonly date: string;
  readonly saison: string;
  readonly domicile: string;
  readonly exterieur: string;
  readonly lambdaH: number;
  readonly lambdaA: number;
  readonly lambdaTotal: number;
  /** Probs du 1X2, indexées domicile / nul / extérieur. */
  readonly unXDeux: readonly [number, number, number];
  readonly totaux: readonly { readonly ligne: number; readonly under: number; readonly over: number; readonly push: number }[];
  readonly totalReel: number;
  readonly issueReelle: 0 | 1 | 2;
  readonly prolongation: boolean;
  /** Matchs réellement entrés dans l'estimation de λ. */
  readonly matchsEstimation: number;
};

// ── Filtre de jouabilité ───────────────────────────────────────────────────

/**
 * Un match est retenu s'il est terminé, ou — quand la source ne donne pas de
 * statut — si son score total est strictement positif.
 *
 * MESURÉ : KHL `season_id=407` expose `home_goal_count = "0"` pour les matchs
 * NON joués. Un filtre `!= null` les intègre comme des 0-0 et donne 0,893
 * buts/match au lieu de 5,18.
 *
 * Le seuil porte sur la SOMME, pas sur chaque côté : un **0-1 est un vrai
 * match** (une équipe shutout), alors qu'un 0-0 non joué ne l'est pas.
 * Exiger `> 0` des deux côtés rejetait les shutouts — c'est-à-dire des
 * données réelles, pas du bruit.
 */
export function estJoue(m: {
  homeGoalCount?: string | number | null;
  visitingGoalCount?: string | number | null;
  final?: string | boolean;
}): boolean {
  const f = m.final;
  const statutConnu = f !== undefined && f !== null && f !== "";
  // Statut présent : c'est l'arbitre. Un match « terminé » est retenu même
  // avec un 0 d'un côté, et un match non terminé est refusé même avec des buts.
  if (statutConnu) return String(f) === "1" || f === true;

  // Pas de statut : on se rabat sur le score. Les buts sont des entiers —
  // « 2.5 » est une donnée malformée, pas un score. Exiger l'intégralité
  // écarte les deux cas : le 0-0 fictif (somme nulle) et les valeurs
  // contaminées (somme non entière).
  const h = Number(m.homeGoalCount);
  const a = Number(m.visitingGoalCount);
  if (!Number.isInteger(h) || !Number.isInteger(a)) return false;
  return h + a > 0;
}

// ── Construction walk-forward ─────────────────────────────────────────────

/** Historique d'une équipe AVANT une date donnée, découpé par terrain. */
function historiqueAvant(matchs: readonly MatchBacktest[], equipe: string, avantDate: string): HistoriqueEquipe {
  const butsDomicile: number[] = [];
  const encaissesDomicile: number[] = [];
  const butsExterieur: number[] = [];
  const encaissesExterieur: number[] = [];

  for (const m of matchs) {
    if (m.date >= avantDate) break; // matchs triés : rien au-delà
    if (m.domicile === equipe) {
      butsDomicile.push(m.butsDomicile);
      encaissesDomicile.push(m.butsExterieur);
    } else if (m.exterieur === equipe) {
      butsExterieur.push(m.butsExterieur);
      encaissesExterieur.push(m.butsDomicile);
    }
  }
  return { butsDomicile, encaissesDomicile, butsExterieur, encaissesExterieur, matchsSaisonCourante: butsDomicile.length + butsExterieur.length };
}

/**
 * Prévision walk-forward sur tous les matchs, pour chaque ligne.
 * `matchs` doit être trié par date croissante.
 */
export function prevoir(matchs: readonly MatchBacktest[], lignes: readonly number[] = LIGNES_DEFAUT): Prevision[] {
  const tri = [...matchs].sort((a, b) => a.date.localeCompare(b.date));
  const sorties: Prevision[] = [];

  for (let i = 0; i < tri.length; i++) {
    const m = tri[i];
    const precedents = tri.slice(0, i);
    const hDom = historiqueAvant(precedents, m.domicile, m.date);
    const hExt = historiqueAvant(precedents, m.exterieur, m.date);
    const jouesDom = hDom.butsDomicile.length + hDom.butsExterieur.length;
    const jouesExt = hExt.butsDomicile.length + hExt.butsExterieur.length;

    // Sans historique, pas de prévision. Émettre le prior ferait gonfler le
    // volume avec des prédictions qui ne sont pas des prédictions.
    if (!jouesDom || !jouesExt) continue;

    // `courant` vide : en backtest, l'historique PRÉCÉDENT est déjà « le
    // connu », donc le distinguer du « courant » n'aurait aucun sens ici.
    const lambda = lambdaTotal(hDom, hExt, { ...hDom, matchsSaisonCourante: 0 });
    if (!(lambda.lambdaTotal > 0)) continue;

    const uxd = unXDeux(lambda.lambdaH, lambda.lambdaA);
    const pmf = convolutionPoisson(lambda.lambdaH, lambda.lambdaA);
    const tot = lignesOverUnder(pmf, lignes).map((l) => ({
      ligne: l.ligne,
      under: l.under,
      over: l.over,
      push: l.push,
    }));

    const issue: 0 | 1 | 2 =
      m.butsDomicile > m.butsExterieur ? Issue.Domicile : m.butsDomicile < m.butsExterieur ? Issue.Exterieur : Issue.Nul;

    sorties.push({
      matchId: m.id,
      date: m.date,
      saison: m.saison,
      domicile: m.domicile,
      exterieur: m.exterieur,
      lambdaH: lambda.lambdaH,
      lambdaA: lambda.lambdaA,
      lambdaTotal: lambda.lambdaTotal,
      unXDeux: [uxd.domicile, uxd.nul, uxd.exterieur],
      totaux: tot,
      totalReel: m.butsDomicile + m.butsExterieur,
      issueReelle: issue,
      prolongation: m.prolongation,
      matchsEstimation: jouesDom,
    });
  }
  return sorties;
}

// ── Métriques ─────────────────────────────────────────────────────────────

/** Toute proportion porte son effectif. Jamais de pourcentage nu. */
export type Taux = {
  readonly valeur: number | null;
  readonly n: number;
  readonly faible: boolean;
};

const taux = (num: number, den: number): Taux => ({
  valeur: den > 0 ? +(num / den).toFixed(4) : null,
  n: den,
  faible: den > 0 && den < SEUIL_FAIBLE,
});

/**
 * Ce pari est-il annulé (push) ?
 *
 * Sur une ligne ENTIÈRE (5.0), un total observé de 5 n'a été gagné ni perdu :
 * le stake revient. Le push se décide sur l'ISSUE OBSERVÉE, jamais sur sa
 * probabilité.
 *
 * Erreur faite puis corrigée : je testais `t.push > 0.5` sur la PROBABILITÉ.
 * Or P(total = 5) vaut 0,175 sous Poisson(5) — en dessous du seuil, donc AUCUN
 * push n'était jamais détecté sur une ligne entière, et un pari annulé était
 * compté comme un gain ou une perte. La métrique faussait le win-rate dans les
 * deux sens. Une demi-ligne (4.5) ne pousse jamais, car aucun entier ne lui
 * est égal.
 */
function pushObserve(p: Prevision, ligne: number): boolean {
  return Number.isInteger(ligne) && p.totalReel === ligne;
}

export type ResultatLigne = Taux & {
  readonly ligne: number;
  readonly predictsSous: number;
  readonly predictsSur: number;
  /** Matchs retirés du win-rate (pari annulé) mais comptés dans le volume. */
  readonly annules: number;
};

/** Winrate par ligne O/U. Un match à push sort du win-rate, reste au volume. */
export function resultatsLignes(previsions: readonly Prevision[], lignes: readonly number[] = LIGNES_DEFAUT): ResultatLigne[] {
  return lignes.map((ligne) => {
    let gains = 0;
    let volume = 0;
    let sous = 0;
    let sur = 0;
    let annules = 0;
    for (const p of previsions) {
      const t = p.totaux.find((x) => x.ligne === ligne);
      if (!t) continue;
      if (t.under >= t.over) sous++;
      else sur++;
      if (pushObserve(p, ligne)) {
        annules++;
        continue;
      }
      volume++;
      if ((t.under >= t.over) === (p.totalReel <= Math.floor(ligne))) gains++;
    }
    return { ligne, ...taux(gains, volume), predictsSous: sous, predictsSur: sur, annules };
  });
}

export type ResultatUnXDeux = Taux & {
  readonly predictsDomicile: number;
  readonly predictsNul: number;
  readonly predictsExterieur: number;
  readonly exclusProlongation: number;
};

/**
 * Winrate 1X2 en TEMPS RÉGLEMENTAIRE : les matchs décidés en prolongation sont
 * exclus, le nul n'y existant pas. `exclusProlongation` rend ce retrait
 * visible — un winrate calculé sur un sous-ensemble doit dire quel
 * sous-ensemble.
 */
export function resultatUnXDeux(previsions: readonly Prevision[], avecProlongation = false): ResultatUnXDeux {
  let gains = 0;
  let volume = 0;
  let pd = 0;
  let pn = 0;
  let pe = 0;
  let exclus = 0;

  for (const p of previsions) {
    if (p.prolongation && !avecProlongation) {
      exclus++;
      continue;
    }
    volume++;
    const [d, n, e] = p.unXDeux;
    let predit: 0 | 1 | 2;
    if (d >= n && d >= e) predit = Issue.Domicile;
    else if (e >= n && e >= d) predit = Issue.Exterieur;
    else predit = Issue.Nul;
    if (predit === Issue.Domicile) pd++;
    else if (predit === Issue.Nul) pn++;
    else pe++;
    if (predit === p.issueReelle) gains++;
  }
  return { ...taux(gains, volume), predictsDomicile: pd, predictsNul: pn, predictsExterieur: pe, exclusProlongation: exclus };
}

// ── Fiabilité des lignes ──────────────────────────────────────────────────

export type Fiabilite = {
  readonly ligne: number;
  readonly n: number;
  /** Erreur absolue moyenne sur le total, en buts. */
  readonly mae: number | null;
  /** Part du volume où le modèle a sous-prédit / sur-prédit le total. */
  readonly partSousPrediction: number | null;
  readonly partSurPrediction: number | null;
  /** Biais moyen signé : positif = sous-prédiction systématique. */
  readonly biaisMoyen: number | null;
  readonly faible: boolean;
};

/**
 * Fiabilité d'une ligne : erreur absolue sur le total, DÉCOUPÉE en
 * sous-prédiction et sur-prédiction. C'est cette découpe qui distingue un bruit
 * aléatoire d'un biais systématique — une MAE élevée symétrique est normale,
 * une MAE élevée toujours dans le même sens est un défaut du modèle.
 */
export function fiabiliteLignes(previsions: readonly Prevision[], lignes: readonly number[] = LIGNES_DEFAUT): Fiabilite[] {
  return lignes.map((ligne) => {
    let sommeAbs = 0;
    let sommeSigne = 0;
    let n = 0;
    let sous = 0;
    let sur = 0;
    for (const p of previsions) {
      const erreur = p.lambdaTotal - p.totalReel;
      sommeAbs += Math.abs(erreur);
      sommeSigne += erreur;
      n++;
      if (erreur < 0) sur++;
      else sous++;
    }
    return {
      ligne,
      n,
      mae: n ? +(sommeAbs / n).toFixed(3) : null,
      partSousPrediction: n ? +(sous / n).toFixed(4) : null,
      partSurPrediction: n ? +(sur / n).toFixed(4) : null,
      biaisMoyen: n ? +(sommeSigne / n).toFixed(3) : null,
      faible: n > 0 && n < SEUIL_FAIBLE,
    };
  });
}

// ── Calibration ───────────────────────────────────────────────────────────

export type BinCalibration = {
  readonly de: number;
  readonly a: number;
  readonly annonce: number | null;
  readonly observe: number | null;
  readonly n: number;
  /** observe − annonce. Positif = le modèle sous-estimait. */
  readonly ecart: number | null;
  readonly faible: boolean;
};

export type Calibration = {
  readonly brierUnXDeux: number | null;
  readonly brierLignes: number | null;
  readonly logLoss: number | null;
  /** Écart moyen signé sur les bins : positif = modèle sous-confiant. */
  readonly ecartMoyen: number | null;
  readonly bins: readonly BinCalibration[];
  readonly n: number;
  readonly effectifFaible: boolean;
};

/**
 * Courbe de fiabilité en 10 bins : « quand le modèle annonce 70 %, gagne-t-il
 * environ 70 % du temps ? ». Chaque bin porte son effectif, donc un bin à
 * 3 matchs ne se lit pas comme un bin à 200.
 */
export function calibration(previsions: readonly Prevision[], lignes: readonly number[] = LIGNES_DEFAUT): Calibration {
  const NB_BINS = 10;
  const annonceTot: number[] = [];
  const realiseTot: number[] = [];

  let brierX2 = 0;
  let nX2 = 0;
  let brierL = 0;
  let nL = 0;
  let logLossSomme = 0;

  for (const p of previsions) {
    // Brier 1X2 : score d'un match sur les trois classes.
    if (!p.prolongation) {
      const probs = p.unXDeux;
      brierX2 += probs.reduce((acc, pr, k) => acc + (pr - (k === p.issueReelle ? 1 : 0)) ** 2, 0);
      nX2++;
    }
    // Binaire par ligne, en excluant les paris annulés.
    for (const t of p.totaux) {
      if (!lignes.includes(t.ligne)) continue;
      if (pushObserve(p, t.ligne)) continue;
      const predictSous = t.under >= t.over;
      const probaPredite = predictSous ? t.under : t.over;
      const reelSous = p.totalReel <= Math.floor(t.ligne);
      const conforme = predictSous === reelSous;
      brierL += (probaPredite - (conforme ? 1 : 0)) ** 2;
      nL++;
      annonceTot.push(probaPredite);
      realiseTot.push(conforme ? 1 : 0);

      // LOG-LOSS : -log(P(résultat OBSERVÉ)), pas P(prévision).
      // Erreur faite puis corrigée : j'utilisais la proba de ce qu'on avait
      // PRÉDIT, donc un Under à 99 % raté coûtait -log(0.99) = 0.01 au lieu
      // de -log(0.01) = 4.60. La métrique était inversée : elle
      // pénalisait la prudence et récompensait la confiance injustifiée —
      // précisément l'inverse du contrôle de calibration qu'on lui demande.
      const probaReelle = conforme ? probaPredite : 1 - probaPredite;
      logLossSomme += -Math.log(Math.min(1 - 1e-12, Math.max(1e-12, probaReelle)));
    }
  }

  const bins: BinCalibration[] = [];
  for (let b = 0; b < NB_BINS; b++) {
    const de = b / NB_BINS;
    const a = (b + 1) / NB_BINS;
    // Le DERNIER bin est fermé à droite : sans lui, une probabilité
    // exactement égale à 1 ne tomberait dans AUCUN bin, et `ecartMoyen`
    // sortirait null alors que le modèle le plus confiant du jeu est
    // précisément celui qu'il faut mesurer.
    const dernier = b === NB_BINS - 1;
    const dans = annonceTot
      .map((v, i) => ({ v, r: realiseTot[i] }))
      .filter((x) => (dernier ? x.v >= de && x.v <= a : x.v >= de && x.v < a));
    const n = dans.length;
    const annonce = n ? +(dans.reduce((s, x) => s + x.v, 0) / n).toFixed(4) : null;
    const observe = n ? +(dans.reduce((s, x) => s + x.r, 0) / n).toFixed(4) : null;
    bins.push({
      de,
      a,
      annonce,
      observe,
      n,
      ecart: annonce !== null && observe !== null ? +(observe - annonce).toFixed(4) : null,
      faible: n > 0 && n < SEUIL_FAIBLE,
    });
  }

  let ecartSomme = 0;
  let ecartN = 0;
  for (const bin of bins) {
    if (bin.ecart === null) continue;
    ecartSomme += bin.ecart;
    ecartN++;
  }

  // -log(P(résultat observé)) accumulé au fil de la boucle ci-dessus.
  const logLoss = nL ? +(logLossSomme / nL).toFixed(4) : null;

  return {
    brierUnXDeux: nX2 ? +(brierX2 / nX2).toFixed(4) : null,
    brierLignes: nL ? +(brierL / nL).toFixed(4) : null,
    logLoss,
    ecartMoyen: ecartN ? +(ecartSomme / ecartN).toFixed(4) : null,
    bins,
    n: annonceTot.length,
    effectifFaible: annonceTot.length > 0 && annonceTot.length < SEUIL_FAIBLE,
  };
}

/** Winrate global, toutes lignes confondues, hors matchs à push. */
export function winrateGlobal(previsions: readonly Prevision[], lignes: readonly number[] = LIGNES_DEFAUT): Taux {
  let gains = 0;
  let volume = 0;
  for (const p of previsions) {
    for (const t of p.totaux) {
      if (!lignes.includes(t.ligne)) continue;
      if (pushObserve(p, t.ligne)) continue;
      volume++;
      if ((t.under >= t.over) === (p.totalReel <= Math.floor(t.ligne))) gains++;
    }
  }
  return taux(gains, volume);
}
