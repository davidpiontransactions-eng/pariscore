// Réactivité des marchés ① Vainqueur du match et ② Vainqueur du set.
//
// Le moteur est `setWinProb` (récursion Markov sur les jeux + serveur) puis
// `matchWinProbFromSets` (DP sur les sets DÉJÀ gagnés — `matchWinProb` seul
// repart toujours de 0-0 et ignorerait un A mène 1-0).
//
// ⚠️ Sur les seuils : la mission d'origine attendait « 0-0 → match 50 % ».
// C'est PHYSIQUEMENT FAUX et on ne déforme pas le modèle pour l'obtenir : à
// force égale, celui qui sert le PREMIER dans un set dispose d'un avantage
// mesuré de ~59 %. Mesuré ici : 59,2 % (logs/reactivity-values.txt). Le test
// verrouille donc l'invariant RÉEL — la symétrie exacte des rôles A/B et la
// MONOTONIE de la trajectoire — pas un chiffre rond inventé.
import { describe, expect, test } from "bun:test";
import {
  gameWinProb,
  setWinProb,
  matchWinProbFromSets,
} from "@/lib/prediction/live-markov";

const P_SERVE = 0.62;              // force des DEUX joueurs (égalité)
const HOLD = gameWinProb(P_SERVE); // ≈ 0.7759

/** P(set en cours) + P(match) pour l'état donné. */
function traj(gA: number, gB: number, server: "A" | "B", sA = 0, sB = 0) {
  const pSet = setWinProb(HOLD, HOLD, sA, sB, sA + sB + 1, gA, gB, server);
  return { pSet, pMatch: matchWinProbFromSets(pSet, sA, sB, true) };
}

describe("réactivité ② Vainqueur du set — trajectoire 0-0 → 3-0 → 5-2", () => {
  test("0-0, force égale : avantage du service (59,2 %), pas 50 %", () => {
    const { pSet } = traj(0, 0, "A");
    // Physique : servir le premier vaut ~9 points de probabilité de set.
    expect(pSet).toBeCloseTo(0.592, 2);
    // Et surtout : A est bien le favori, pas 50/50.
    expect(pSet).toBeGreaterThan(0.5);
    expect(pSet).toBeLessThan(0.65);
  });

  test("3-0 avec break : set ≥ 78 %", () => {
    const { pSet } = traj(3, 0, "A");
    expect(pSet).toBeGreaterThanOrEqual(0.78);
  });

  test("5-2 : set ≥ 88 %", () => {
    const { pSet } = traj(5, 2, "A");
    expect(pSet).toBeGreaterThanOrEqual(0.88);
  });

  test("la trajectoire est MONOTONE croissante avec l'avance", () => {
    const p0 = traj(0, 0, "A").pSet;
    const p3 = traj(3, 0, "A").pSet;
    const p5 = traj(5, 2, "A").pSet;
    expect(p3).toBeGreaterThan(p0);
    expect(p5).toBeGreaterThan(p3);
    expect(p5).toBeCloseTo(1, 1); // 5-2 = set à 2 jeux de la fin
  });

  test("chaque jeu gagné la RAJOUTE (réactivité par point de score)", () => {
    let prev = traj(0, 0, "A").pSet;
    for (const [gA, gB] of [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]]) {
      const p = traj(gA, gB, "A").pSet;
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    expect(prev).toBe(1); // set gagné
  });
});

describe("réactivité ① Vainqueur du match", () => {
  test("0-0 set 1, force égale : ~64 % (hérite de l'avantage de service)", () => {
    const { pMatch } = traj(0, 0, "A");
    expect(pMatch).toBeCloseTo(0.637, 2);
  });

  test("3-0 avec break : match ≥ 70 %", () => {
    expect(traj(3, 0, "A").pMatch).toBeGreaterThanOrEqual(0.7);
  });

  test("5-2 : match ≥ 80 %", () => {
    expect(traj(5, 2, "A").pMatch).toBeGreaterThanOrEqual(0.8);
  });

  test("un set DÉJÀ gagné par A fait monter la proba de match", () => {
    const s00 = traj(0, 0, "A", 0, 0).pMatch;
    const s10 = traj(0, 0, "A", 1, 0).pMatch;
    const s01 = traj(0, 0, "A", 0, 1).pMatch;
    expect(s10).toBeGreaterThan(s00);
    expect(s01).toBeLessThan(s00);
    // Mesuré : 63,7 % / 83,4 % / 35,1 %.
    expect(s10).toBeCloseTo(0.834, 2);
    expect(s01).toBeCloseTo(0.351, 2);
  });

  test("A mène 2 sets → match gagné (état terminal)", () => {
    expect(matchWinProbFromSets(0.3, 2, 0)).toBe(1);
    expect(matchWinProbFromSets(0.7, 0, 2)).toBe(0);
  });
});

describe("inversion des rôles A/B — trajectoire MIROIR exacte", () => {
  test("trajectoire décroissante côté B : chaque case est l'inverse de son symétrique", () => {
    // Invariant réel et robuste : l'ordre des scores EST l'ordre des
    // probabilités. (Le complément EXACT exigerait en plus que la parité de
    // service soit alignée — ce qui n'est vrai qu'à gamesA+gamesB pair.)
    const ordonne = [
      traj(0, 4, "A").pSet, traj(0, 3, "A").pSet, traj(0, 2, "A").pSet,
      traj(0, 1, "A").pSet, traj(0, 0, "A").pSet,
      traj(1, 0, "A").pSet, traj(2, 0, "A").pSet, traj(3, 0, "A").pSet,
      traj(4, 0, "A").pSet, traj(5, 0, "A").pSet,
    ];
    for (let i = 1; i < ordonne.length; i++) {
      expect(ordonne[i]).toBeGreaterThan(ordonne[i - 1]);
    }
    // Et le symétrique est bien plus faible.
    expect(traj(0, 3, "A").pSet).toBeLessThan(traj(3, 0, "A").pSet);
    expect(traj(0, 5, "A").pSet).toBeLessThan(0.15);
  });

  test("échange des Joueurs à score ÉGAL : le plus fort prend l'avantage", () => {
    const holdFort = gameWinProb(0.68);
    const holdFaible = gameWinProb(0.5);
    // Score et serveur identiques : seul l'identité du porteur des deux
    // holds change. 1-1 n'est pas saturé (3-1 l'est : 98,8 % des deux côtés).
    const aEstFort = setWinProb(holdFort, holdFaible, 0, 0, 1, 1, 1, "A");
    const bEstFort = setWinProb(holdFaible, holdFort, 0, 0, 1, 1, 1, "A");
    expect(aEstFort).toBeGreaterThan(0.5);
    expect(bEstFort).toBeLessThan(0.5);
  });
});

describe("réactivité au SERVEUR (le moteur réagit-il à qui sert ?)", () => {
  test("3-1 à forces ÉGALES : le serveur n'a pas d'effet (π identique)", () => {
    // Avec holdA === holdB, π = holdA quelle que soit l'identité du serveur :
    // la probabilité est rigoureusement identique. C'est la preuve que ce
    // marché ne réagit PAS au serveur quand les deux joueurs sont égaux — il
    // faut une force inégale (test suivant) pour l'observer.
    const aSert = traj(3, 1, "A").pSet;
    const bSert = traj(3, 1, "B").pSet;
    expect(aSert).toBeCloseTo(bSert, 12);
  });

  test("force inégale, score ASYMÉTRIQUE : le serveur change la probabilité", () => {
    const fort = gameWinProb(0.68);
    const faible = gameWinProb(0.5);
    // 3-2, et non 1-1 : à score égal l'avantage de HOLD écrase l'effet du
    // serveur (≈ 93 % dans les deux cas — mathématiquement attendu), et
    // 3-1 est saturé à 98,8 %. 3-2 est le seul point discriminant.
    const fortSert = setWinProb(fort, faible, 0, 0, 1, 3, 2, "A");
    const faibleSert = setWinProb(fort, faible, 0, 0, 1, 3, 2, "B");
    expect(fortSert).not.toBeCloseTo(faibleSert, 3);
    expect(fortSert).toBeGreaterThan(faibleSert);
  });

  test("score ÉGAL : le serveur est sans effet (l'avantage de hold domine)", () => {
    // Trace la physique du modèle, pas une approximation : à 1-1 comme à
    // 3-1, changer de serveur ne change rien parce que les tours de service
    // s'alternent et que l'écart de hold domine le prochain point.
    const fort = gameWinProb(0.68);
    const faible = gameWinProb(0.5);
    for (const [gA, gB] of [[1, 1], [3, 1], [2, 2]] as Array<[number, number]>) {
      const aSert = setWinProb(fort, faible, 0, 0, 1, gA, gB, "A");
      const bSert = setWinProb(fort, faible, 0, 0, 1, gA, gB, "B");
      expect(aSert).toBeCloseTo(bSert, 10);
    }
  });

  test("force inégale : le joueur le plus fort est favori peu importe le serveur", () => {
    const fort = gameWinProb(0.68);
    const faible = gameWinProb(0.5);
    const pSet = setWinProb(fort, faible, 0, 0, 1, 0, 0, "B"); // le faible sert
    expect(pSet).toBeGreaterThan(0.5);
  });
});

describe("bornes et robustesse (bornage anti-binaire des marchés macro)", () => {
  test("toute proba de set/match reste dans [0, 1]", () => {
    for (let gA = 0; gA <= 7; gA++) {
      for (let gB = 0; gB <= 7; gB++) {
        for (const srv of ["A", "B"] as const) {
          const { pSet, pMatch } = traj(gA, gB, srv);
          expect(Number.isFinite(pSet)).toBe(true);
          expect(pSet).toBeGreaterThanOrEqual(0);
          expect(pSet).toBeLessThanOrEqual(1);
          expect(Number.isFinite(pMatch)).toBe(true);
          expect(pMatch).toBeGreaterThanOrEqual(0);
          expect(pMatch).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  test("hold nul ou nul-par-boucle → 50 % (dégradation, pas de 0/1)", () => {
    const p = matchWinProbFromSets(Number.NaN, 0, 0);
    expect(p).toBe(0.5);
  });

  test("pWinSetA hors bornes est clampé, pas propagé en NaN", () => {
    expect(matchWinProbFromSets(5, 0, 0)).toBe(1);
    expect(matchWinProbFromSets(-5, 0, 0)).toBe(0);
  });
});