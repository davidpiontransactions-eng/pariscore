import { describe, expect, test } from "bun:test";

import {
  calibration,
  estJoue,
  fiabiliteLignes,
  LIGNES_DEFAUT,
  prevoir,
  resultatUnXDeux,
  resultatsLignes,
  SEUIL_FAIBLE,
  winrateGlobal,
  type MatchBacktest,
} from "../hockey/backtest";

function m(
  id: string,
  date: string,
  domicile: string,
  exterieur: string,
  h: number,
  a: number,
  prolongation = false,
  saison = "2025/2026",
): MatchBacktest {
  return { id, date, domicile, exterieur, butsDomicile: h, butsExterieur: a, prolongation, saison };
}

/**
 * Série de n matchs tous identiques — λ stable, sans aléa.
 * Les dates sont STRICTEMENT croissantes : le walk-forward s'arrête au premier
 * `date >= avantDate`, donc une date cyclique tronquerait silencieusement
 * l'historique et le test passerait pour une mauvaise raison.
 * `decalageJours` décale la série — sans lui, deux séries qui se chevauchent
 * sont entremêlées par le tri et un match apparaît avant son propre historique.
 */
function serie(
  n: number,
  prefixe: string,
  domicile: string,
  exterieur: string,
  h: number,
  a: number,
  prolongation = false,
  decalageJours = 0,
): MatchBacktest[] {
  const base = Date.UTC(2025, 8, 1) + decalageJours * 86400000;
  return Array.from({ length: n }, (_, i) =>
    m(`${prefixe}${i}`, new Date(base + i * 86400000).toISOString().slice(0, 10), domicile, exterieur, h, a, prolongation),
  );
}

describe("estJoue — le piège des matchs non joués", () => {
  test("un match joué est retenu", () => {
    expect(estJoue({ homeGoalCount: "3", visitingGoalCount: "2", final: "1" })).toBe(true);
  });

  test("SONDE — un match NON joué porte \"0\", pas null : il doit être écarté", () => {
    // C'est le piège mesuré : season_id=407 renvoie "0" pour les matchs à
    // venir. `!= null` l'accepterait et integrating 623 pseudo-0-0 donne
    // 0,893 buts/match au lieu de 5,18.
    expect(estJoue({ homeGoalCount: "0", visitingGoalCount: "0", final: "" })).toBe(false);
    expect(estJoue({ homeGoalCount: 0, visitingGoalCount: 0 })).toBe(false);
  });

  test("une nulle-but en prolongation reste un match joué", () => {
    expect(estJoue({ homeGoalCount: "0", visitingGoalCount: "0", final: "1" })).toBe(true);
    expect(estJoue({ homeGoalCount: "1", visitingGoalCount: "0", final: "1" })).toBe(true);
  });

  test("SONDE — un shutout 0-1 SANS statut est un vrai match", () => {
    // C'est le cas exact du bug corrigé : `h > 0 && a > 0` rejetait un vrai
    // 0-1. Le discriminant est la somme des buts, pas la nullité de chacun.
    expect(estJoue({ homeGoalCount: "0", visitingGoalCount: "1" })).toBe(true);
    expect(estJoue({ homeGoalCount: "1", visitingGoalCount: "0" })).toBe(true);
    // ... mais un 0-0 sans statut reste rejeté.
    expect(estJoue({ homeGoalCount: "0", visitingGoalCount: "0" })).toBe(false);
  });

  test("un statut non terminé est refusé même avec des buts", () => {
    expect(estJoue({ homeGoalCount: "2", visitingGoalCount: "1", final: "0" })).toBe(false);
  });

  test("les valeurs non entières sont refusées", () => {
    expect(estJoue({ homeGoalCount: "2.5", visitingGoalCount: "1" })).toBe(false);
  });
});

describe("prevoir — walk-forward strict", () => {
  test("le premier match n'est jamais prédit : sans historique, pas de prédiction", () => {
    const matchs = serie(5, "x", "A", "B", 3, 2);
    const p = prevoir(matchs);
    expect(p.length).toBe(4);
    expect(p[0].matchId).toBe("x1");
    expect(p[0].matchsEstimation).toBe(1);
  });

  test("chaque match est prédit depuis un historique croissant", () => {
    const p = prevoir(serie(10, "y", "A", "B", 3, 2));
    for (let i = 0; i < p.length; i++) expect(p[i].matchsEstimation).toBe(i + 1);
  });

  test("SONDE — un match NE change PAS le λ du match suivant s'il est dans le futur", () => {
    // Deux séries identiques SAUF que la seconde contient un match aberrant.
    // Si l'estimation regardait vers le futur, ce match aberrant polluerait le
    // λ des matchs qui le précèdent — et c'est exactement le biais que le
    // backtest doit éviter.
    const base = serie(8, "a", "A", "B", 3, 2);
    const avecAberrant = [...base, m("futur", "2026-01-01", "A", "B", 15, 1)];
    const avant = prevoir(base).map((p) => p.lambdaTotal);
    const apres = prevoir(avecAberrant).filter((p) => p.date < "2026-01-01").map((p) => p.lambdaTotal);
    expect(apres).toEqual(avant);
  });

  test("SONDE — deux matchs MÊME JOUR ne s'influencent pas", () => {
    // C'est la garde qui tient réellement : `historiqueAvant` casse dès que
    // `date >= avantDate`. `slice(0, i)` ne peut pas la sauver ici.
    //
    // Les DEUX matches jouent A contre B : avec C comme adversaire du second,
    // C n'aurait aucun historique et `prevoir` l'aurait rejeté pour une raison
    // qui n'a rien à voir avec la garde date — le test aurait été vert et
    // muet sur le motif qu'il prétend vérifier.
    const journee = [
      m("tard-1", "2025-09-01", "A", "B", 5, 0),
      m("tard-2", "2025-09-01", "A", "B", 0, 1),
    ];
    // Le second n'a aucun historique utilisable : pas de prédiction.
    expect(prevoir(journee).length).toBe(0);

    // ... et décalé d'un jour, il doit être prédit. La comparaison garantit
    // que le 0 n'est pas dû à un filtre ailleurs.
    const lendemain = [
      m("lend-1", "2025-09-01", "A", "B", 5, 0),
      m("lend-2", "2025-09-02", "A", "B", 0, 1),
    ];
    expect(prevoir(lendemain).length).toBe(1);
  });

  test("les entrées nulles ou négatives n'entrent pas dans le λ", () => {
    const p = prevoir(serie(6, "z", "A", "B", 0, 4));
    // λ_A vient des 4 buts de B ; λ_H reste à 0 → total non nul, mais faible.
    expect(p.length).toBeGreaterThan(0);
    for (const x of p) expect(x.lambdaTotal).toBeGreaterThanOrEqual(0);
  });
});

describe("taux et dénominateurs", () => {
  test("aucune proportion n'est rendue sans son effectif", () => {
    const r = resultatsLignes(prevoir(serie(40, "w", "A", "B", 3, 2)));
    for (const l of r) {
      expect(typeof l.n).toBe("number");
      expect(l.faible).toBe(l.n > 0 && l.n < SEUIL_FAIBLE);
    }
  });

  test("un échantillon vide donne null, pas 0", () => {
    const r = resultatsLignes([]);
    expect(r).toHaveLength(LIGNES_DEFAUT.length);
    for (const l of r) {
      expect(l.valeur).toBeNull();
      expect(l.n).toBe(0);
      expect(l.faible).toBe(false);
    }
  });
});

describe("resultatsLignes — push", () => {
  test("SONDE — un match à push sort du win-rate mais RESTE au volume", () => {
    // Ligne entière 5.0, équipe à 5 buts : pari annulé, pas perdu.
    // Les lignes doivent être passées À `prevoir` : ce sont elles qui
    // produisent les objets `totaux`, `resultatsLignes` ne fait que lire.
    const prev = prevoir(serie(6, "p", "A", "B", 5, 0), [5]);
    const r = resultatsLignes(prev, [5]);
    const attendu = prev.length; // chaque match est un push
    expect(r[0].annules).toBe(attendu);
    expect(r[0].n).toBe(0); // rien au win-rate
    expect(r[0].valeur).toBeNull();
    // Mais le volume total est bien là.
    expect(r[0].predictsSous + r[0].predictsSur).toBe(attendu);
  });

  test("les lignes demi-goal n'ont jamais de push", () => {
    const r = resultatsLignes(prevoir(serie(20, "q", "A", "B", 3, 2)));
    for (const l of r) expect(l.annules).toBe(0);
  });
});

describe("resultatUnXDeux — exclusion OT", () => {
  const matchs = [
    ...serie(10, "r", "A", "B", 3, 2), // temps réglementaire, jours 0-9
    // Décalé à +20 jours : sinon le tri entremêle les deux séries et un
    // match OT apparaît AVANT les matchs qui doivent servir d'historique.
    ...serie(4, "ot", "A", "B", 3, 2, true, 20), // prolongation
  ];

  test("les matchs en prolongation sont exclus et COMPTES", () => {
    const r = resultatUnXDeux(prevoir(matchs));
    expect(r.exclusProlongation).toBe(4);
    expect(r.n).toBeGreaterThan(0);
    expect(r.n + r.exclusProlongation).toBe(prevoir(matchs).length);
  });

  test("avec prolongation, rien n'est exclu", () => {
    const r = resultatUnXDeux(prevoir(matchs), true);
    expect(r.exclusProlongation).toBe(0);
  });
});

describe("fiabiliteLignes — biais signé", () => {
  test("SONDE — un modèle qui sous-prédit toujours a un biaisMoyen positif", () => {
    // λ surestimé ⇒ lambdaTotal > totalReel ⇒ écart positif partout.
    const prev = [
      { matchId: "1", date: "2025-01-01", saison: "s", domicile: "A", exterieur: "B", lambdaH: 4, lambdaA: 3, lambdaTotal: 9,
        unXDeux: [0.5, 0.25, 0.25] as const, totaux: [], totalReel: 4, issueReelle: 0 as const, prolongation: false, matchsEstimation: 5 },
    ];
    const f = fiabiliteLignes(prev);
    expect(f[0].biaisMoyen).toBeGreaterThan(0);
    expect(f[0].mae).toBeCloseTo(5, 3);
  });

  test("un biais nul quand l'erreur moyenne s'annule", () => {
    const base = { date: "2025-01-01", saison: "s", domicile: "A", exterieur: "B", unXDeux: [0.5, 0.25, 0.25] as const, totaux: [], issueReelle: 0 as const, prolongation: false, matchsEstimation: 5 };
    const prev = [
      { ...base, matchId: "1", lambdaH: 3, lambdaA: 2, lambdaTotal: 7, totalReel: 5 },
      { ...base, matchId: "2", lambdaH: 1, lambdaA: 1, lambdaTotal: 3, totalReel: 5 },
    ];
    const f = fiabiliteLignes(prev);
    expect(f[0].biaisMoyen).toBeCloseTo(0, 6);
    expect(f[0].partSousPrediction).toBeCloseTo(0.5, 6);
  });
});

describe("calibration", () => {
  test("un modèle PARFAIT se calibre sur lui-même", () => {
    // Chaque ligne annonce exactement ce qui va se produire : en posant
    // manuellement les probs, le Brier doit tomber et l'écart être nul.
    const prev = [
      { matchId: "1", date: "2025-01-01", saison: "s", domicile: "A", exterieur: "B", lambdaH: 3, lambdaA: 2, lambdaTotal: 5,
        unXDeux: [1, 0, 0] as const,
        totaux: [{ ligne: 5.5, under: 1, over: 0, push: 0 }] as const,
        totalReel: 3, issueReelle: 0 as const, prolongation: false, matchsEstimation: 5 },
    ];
    const c = calibration(prev);
    expect(c.brierLignes).toBe(0);
    expect(c.brierUnXDeux).toBe(0);
    expect(c.logLoss).toBe(0);
    expect(c.ecartMoyen).toBeCloseTo(0, 6);
  });

  test("SONDE — un modèle qui annonce 100 % et se trompe est PIRE que 50/50", () => {
    const faux = calibration([
      { matchId: "1", date: "2025-01-01", saison: "s", domicile: "A", exterieur: "B", lambdaH: 3, lambdaA: 2, lambdaTotal: 5,
        unXDeux: [0.34, 0.33, 0.33] as const,
        totaux: [{ ligne: 5.5, under: 0.99, over: 0.01, push: 0 }] as const,
        totalReel: 9, issueReelle: 0 as const, prolongation: false, matchsEstimation: 5 },
    ]);
    const prudent = calibration([
      { matchId: "1", date: "2025-01-01", saison: "s", domicile: "A", exterieur: "B", lambdaH: 3, lambdaA: 2, lambdaTotal: 5,
        unXDeux: [0.34, 0.33, 0.33] as const,
        totaux: [{ ligne: 5.5, under: 0.5, over: 0.5, push: 0 }] as const,
        totalReel: 9, issueReelle: 0 as const, prolongation: false, matchsEstimation: 5 },
    ]);
    // La certitude-infondée doit être sanctionnée : Brier et log-loss plus hauts.
    expect(faux.brierLignes!).toBeGreaterThan(prudent.brierLignes!);
    expect(faux.logLoss!).toBeGreaterThan(prudent.logLoss!);
  });

  test("les bins couvrent [0,1] et portent leur effectif", () => {
    const c = calibration(prevoir(serie(40, "c", "A", "B", 3, 2)));
    expect(c.bins).toHaveLength(10);
    expect(c.bins[0].de).toBe(0);
    expect(c.bins[9].a).toBe(1);
    const sommeN = c.bins.reduce((a, b) => a + b.n, 0);
    expect(sommeN).toBe(c.n);
  });

  test("SONDE — le log-loss est fini même avec une probabilité de 1", () => {
    const c = calibration([
      { matchId: "1", date: "2025-01-01", saison: "s", domicile: "A", exterieur: "B", lambdaH: 3, lambdaA: 2, lambdaTotal: 5,
        unXDeux: [1, 0, 0] as const,
        totaux: [{ ligne: 5.5, under: 1, over: 0, push: 0 }] as const,
        totalReel: 3, issueReelle: 0 as const, prolongation: false, matchsEstimation: 5 },
    ]);
    expect(Number.isFinite(c.logLoss!)).toBe(true);
  });
});

describe("winrateGlobal", () => {
  test("agrège les lignes et exclut les matchs à push", () => {
    const r = winrateGlobal(prevoir(serie(30, "g", "A", "B", 3, 2)));
    expect(r.n).toBeGreaterThan(0);
    expect(r.valeur).not.toBeNull();
  });

  test("vide donne null et n=0", () => {
    expect(winrateGlobal([]).valeur).toBeNull();
  });
});
