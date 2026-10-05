import { describe, expect, test } from "bun:test";
import {
  convolutionPoisson,
  EQUIPE_VIDE,
  indiceDispersion,
  lambdaTotal,
  lignesOverUnder,
  partFiletVide,
  poidsLambda,
  poissonPmf,
  skellamPmf,
  unXDeux,
  type HistoriqueEquipe,
} from "../hockey/totals";

/** Construit un historique à partir d'une liste de scores « pour-contre ». */
function depuis(paires: readonly [number, number][], courant = 0): HistoriqueEquipe {
  return {
    butsDomicile: paires.map(([p]) => p),
    encaissesDomicile: paires.map(([, c]) => c),
    butsExterieur: paires.map(([, c]) => c),
    encaissesExterieur: paires.map(([p]) => p),
    matchsSaisonCourante: courant,
  };
}

describe("poissonPmf", () => {
  test("vaut 1/p à k=0 et se normalise", () => {
    expect(poissonPmf(0, 3.2)).toBeCloseTo(Math.exp(-3.2), 12);
    let somme = 0;
    for (let k = 0; k <= 40; k++) somme += poissonPmf(k, 5.6);
    expect(somme).toBeCloseTo(1, 6);
  });

  test("λ=0 est dégénéré et ne déborde pas", () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(3, 0)).toBe(0);
  });

  test("k négatif ou fractionnaire vaut 0", () => {
    expect(poissonPmf(-1, 3)).toBe(0);
    expect(poissonPmf(2.5, 3)).toBe(0);
  });
});

describe("référence indépendante — la seule qui compte", () => {
  // λ_total = 5,6 → P(Over 5.5) = 48,81 %, P(Under 5.5) = 51,19 %.
  // Ce sont les valeurs du contrôle Manual de la revue méthodologique ;
  // c'est le seul chiffre vérifiable que les sources fournissent.
  test("λ_total = 5,6 donne Over 5.5 = 48,81 %", () => {
    const [ligne] = lignesOverUnder(convolutionPoisson(0, 5.6), [5.5]);
    expect(ligne.over).toBeCloseTo(0.4881, 3);
    expect(ligne.under).toBeCloseTo(0.5119, 3);
    expect(ligne.push).toBe(0);
  });

  test("λ=6,68 donne 65,66 %, pas les 58 % du blog", () => {
    // Contrôle négatif arithmétique : le blog Poisson annonçait 58 %.
    const [ligne] = lignesOverUnder(convolutionPoisson(0, 6.68), [5.5]);
    expect(ligne.over).toBeCloseTo(0.6566, 3);
    expect(ligne.over).not.toBeCloseTo(0.58, 2);
  });
});

describe("lignesOverUnder", () => {
  const pmf = convolutionPoisson(0, 5.6);

  test("ligne demi-goal : jamais de push", () => {
    for (const l of [4.5, 5.5, 6.5]) {
      expect(lignesOverUnder(pmf, [l])[0].push).toBe(0);
    }
  });

  test("ligne entière : le push vaut exactement P(k = ligne)", () => {
    const [ligne] = lignesOverUnder(pmf, [5]);
    expect(ligne.push).toBeCloseTo(poissonPmf(5, 5.6), 6);
    expect(ligne.under + ligne.over + ligne.push).toBeCloseTo(1, 6);
  });

  test("les cotes justes respectent la marge et ont 1/p comme plancher", () => {
    const [ligne] = lignesOverUnder(pmf, [5.5]);
    expect(ligne.coteUnder!).toBeGreaterThan(1 / ligne.under);
    expect(ligne.coteOver!).toBeGreaterThan(1 / ligne.over);
    // 51,19 % de proba ne peut pas payer 1,95 : il faut la marge.
    expect(ligne.coteUnder!).toBeGreaterThanOrEqual(1.9);
  });

  test("une cote impossible vaut null, pas 0", () => {
    const plat = new Array(21).fill(0);
    plat[10] = 1; // tout le monde fait exactement 10 buts
    const [ligne] = lignesOverUnder(plat, [10]);
    expect(ligne.push).toBe(1);
    expect(ligne.coteOver).toBeNull();
  });

  // Sonde mordante : si on ignorait le cas « ligne entière », ce test échoue.
  test("SONDE — ignorer le push sur ligne entière casse la somme", () => {
    const [ligne] = lignesOverUnder(pmf, [5]);
    const sommeSansPush = ligne.under + ligne.over;
    expect(sommeSansPush).toBeCloseTo(1 - 0.2, 1);
  });
});

describe("Skellam et 1X2", () => {
  test("la marge se centre sur λ_H − λ_A", () => {
    const span = 8;
    const marge = skellamPmf(3.4, 2.1, span);
    let mode = -span;
    let max = -1;
    for (let d = -span; d <= span; d++) {
      if (marge[d + span] > max) { max = marge[d + span]; mode = d; }
    }
    expect(mode).toBe(Math.round(3.4 - 2.1));
  });

  test("λ égaux → perfectly symétrique, nul faible et connu", () => {
    const r = unXDeux(2.8, 2.8);
    // Symétrie exacte : à λ identique, aucune raison que domicile favorite.
    expect(r.domicile).toBeCloseTo(r.exterieur, 10);
    expect(r.domicile + r.nul + r.exterieur).toBeCloseTo(1, 6);
    // P(nul) = Σ Po(k;2.8)² ≈ 0,1728. C'est PLUS FAIBLE que la probabilité de
    // victoire (~0,41) : une intuition « le nul est fréquent » est fausse à
    // ce λ. P(0) seul vaut déjà 6 %, et les schedules KHL/NHL finissent
    // rarement à égalité — mais le modèle ne le sait pas, il l'estime.
    expect(r.nul).toBeCloseTo(0.1728, 3);
    expect(r.nul).toBeLessThan(r.domicile);
  });

  test("supériorité offensive rend la victoire domicile plus probable", () => {
    const faible = unXDeux(2.0, 2.0);
    const fort = unXDeux(3.5, 2.0);
    expect(fort.domicile).toBeGreaterThan(faible.domicile);
    expect(fort.exterieur).toBeLessThan(faible.exterieur);
  });

  // Sonde : Skellam n'est PAS le total. Si on la confondait avec la
  // convolution, la somme des pmf serait identique et le test passerait.
  test("SONDE — marge et total ne sont pas le même vecteur", () => {
    const total = convolutionPoisson(3.4, 2.1);
    const marge = skellamPmf(3.4, 2.1, 12);
    expect(marge).not.toEqual(total);
    expect(marge.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
    expect(total.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
  });
});

describe("poidsLambda", () => {
  test("20 % à l'ouverture, 70 % au-delà de 20 matchs", () => {
    expect(poidsLambda(0).poidsSaisonCourante).toBeCloseTo(0.2, 4);
    expect(poidsLambda(10).poidsSaisonCourante).toBeCloseTo(0.45, 4);
    expect(poidsLambda(20).poidsSaisonCourante).toBeCloseTo(0.7, 4);
    expect(poidsLambda(80).poidsSaisonCourante).toBeCloseTo(0.7, 4);
  });

  test("les deux poids somment à 1", () => {
    for (const n of [0, 5, 20, 60]) {
      const p = poidsLambda(n);
      expect(p.poidsSaisonCourante + p.poidsHistorique).toBeCloseTo(1, 6);
    }
  });

  test("un effectif négatif ne fait pasBucket le poids", () => {
    expect(poidsLambda(-5).poidsSaisonCourante).toBeCloseTo(0.2, 4);
  });
});

describe("lambdaTotal", () => {
  const equipeEquilibree = depuis(Array.from({ length: 40 }, () => [2, 2] as [number, number]), 20);

  test("deux équipes identiques à 2 buts donnent λ_total = 4", () => {
    const l = lambdaTotal(equipeEquilibree, equipeEquilibree, EQUIPE_VIDE);
    expect(l.lambdaH).toBeCloseTo(2, 1);
    expect(l.lambdaA).toBeCloseTo(2, 1);
    expect(l.lambdaTotal).toBeCloseTo(4, 1);
  });

  test("l'historique est respecté quand la saison courante est vide", () => {
    const l = lambdaTotal(equipeEquilibree, equipeEquilibree, EQUIPE_VIDE);
    expect(l.poids.poidsSaisonCourante).toBeCloseTo(0.7, 4);
    expect(l.lambdaTotal).toBeCloseTo(4, 1);
  });

  test("sans aucune donnée, λ vaut 0 au lieu de NaN", () => {
    const l = lambdaTotal(EQUIPE_VIDE, EQUIPE_VIDE, EQUIPE_VIDE);
    expect(l.lambdaTotal).toBe(0);
    expect(Number.isNaN(l.lambdaTotal)).toBe(false);
  });

  test("SONDE — la saison courante fait dévier λ du seul historique", () => {
    const affole = depuis([[9, 0], [8, 0], [10, 0]], 3);
    const l = lambdaTotal(affole, equipeEquilibree, affole);
    const sansCourant = lambdaTotal(affole, equipeEquilibree, EQUIPE_VIDE);
    expect(l.lambdaH).toBeGreaterThan(sansCourant.lambdaH);
    // Trois matchs de 9 buts ne doivent PAS produire λ ≈ 9.
    expect(l.lambdaH).toBeLessThan(sansCourant.lambdaH + 5);
  });

  test("SONDE — le rétrécissement borne l'influence d'un échantillon minuscule", () => {
    const deuxMatchs = depuis([[9, 0], [10, 0]], 2);
    const l = lambdaTotal(deuxMatchs, equipeEquilibree, EQUIPE_VIDE);
    // Deux matchs à 9,5 face à 40 matchs à ~2 : l'attaque pèse ~5 %.
    expect(l.lambdaH).toBeLessThan(3);
  });
});

describe("indiceDispersion", () => {
  // On ne fabrique pas un échantillon « qui ressemble à du Poisson » : un
  // tableau écrit à la main a presque toujours la mauvaise variance, et le
  // test passerait ou échouerait pour une raison qui n'a rien à voir avec la
  // fonction. On teste donc l'arithmétique sur des cas dont on connaît le
  // résultat exact.
  test("variance nulle sur une série constante", () => {
    const d = indiceDispersion(Array.from({ length: 30 }, () => 6));
    expect(d.matchs).toBe(30);
    expect(d.ratio).toBe(0);
    expect(d.surDisperse).toBe(false);
  });

  test("arithmétique exacte : 3 et 7 à parts égales → moyenne 5, ratio 0,8", () => {
    const d = indiceDispersion([...Array(15).fill(3), ...Array(15).fill(7)]);
    expect(d.ratio).toBeCloseTo(0.8, 6);
    expect(d.surDisperse).toBe(false);
  });

  test("une distribution franchement dispersée est signalée", () => {
    const totaux = [...Array(40).fill(1), ...Array(10).fill(20)];
    expect(indiceDispersion(totaux).surDisperse).toBe(true);
  });

  test("SONDE — sous 20 matchs, aucun verdict de dispersion", () => {
    // 19 valeurs seulement (le seuil est `< 20`, pas `<= 20`), avec un ratio
    // qui exploserait s'il était calculé : le seuil d'effectif doit l'annuler.
    const petit = [...Array(17).fill(1), 30, 30];
    const d = indiceDispersion(petit);
    expect(d.matchs).toBe(19);
    expect(d.surDisperse).toBe(false);
    expect(d.ratio).toBe(1);
  });
});

describe("partFiletVide", () => {
  test("mesure une part en pourcentage", () => {
    expect(partFiletVide([10, 10, 10], [1, 1, 1]).moyenne).toBeCloseTo(10, 2);
  });

  test("zeros et vides ne polluent pas le dénominateur", () => {
    expect(partFiletVide([], []).moyenne).toBe(0);
    expect(partFiletVide([0, 0, 0], [1, 1]).matchs).toBe(3);
  });

  test("SONDE — l'ENG est mesuré, jamais soustrait de λ", () => {
    // 20 buts au total, dont 4 en filet vide : la part est de 20 %, et le
    // total reste 20. Retrancher l'ENG donnerait 16 — un autre marché.
    const buts = [4, 4, 4, 4, 4];
    expect(partFiletVide(buts, [1, 1, 1, 1, 0]).moyenne).toBeCloseTo(20, 6);
    expect(buts.reduce((a, b) => a + b, 0)).toBe(20);
  });
});
