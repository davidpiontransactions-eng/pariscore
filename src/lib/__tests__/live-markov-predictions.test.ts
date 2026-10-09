// Tests des micro-marchés live ajoutés au moteur Markov : distribution de
// score de jeu (Hold 0/15, Hold 30/40, Break) et probabilité de 6-6.
import { describe, expect, test } from "bun:test";
import {
  gameScoreDistribution,
  tieBreakProbability,
  gameWinProb,
  gameWinProbFromScore,
} from "@/lib/prediction/live-markov";

describe("gameScoreDistribution", () => {
  test("les 3 issues somment à 1 (partition de l'espace desDslots)", () => {
    for (const server of ["A", "B"] as const) {
      for (const p of [0.3, 0.5, 0.6, 0.65, 0.75, 0.9]) {
        const d = gameScoreDistribution(server, p, 1 - p);
        const sum = d["hold-0"] + d["hold-30"] + d.break;
        expect(sum).toBeCloseTo(1, 6);
      }
    }
  });

  test("Hold 0/15 = P(4 points de service d'affilée) — cohérent avec gameWinProb", () => {
    // gameWinProb(p) = p^4 · (1 + 4q + 10q²) : la forme fermée du gain de jeu.
    // Notre « hold-0 » est le strict 4-0 ; il doit être ≤ gameWinProb (le gain
    // de jeu inclut 4-1, 4-2, 4-3) et converge vers lui quand q → 0.
    const p = 0.65;
    const d = gameScoreDistribution("A", p, 1 - p);
    expect(d["hold-0"]).toBeCloseTo(p * p * p * p, 10);
    expect(d["hold-0"]).toBeLessThanOrEqual(gameWinProb(p));
  });

  test("Hold 0/15 domine quand le serveur est très fort", () => {
    const d = gameScoreDistribution("A", 0.9, 0.5);
    expect(d["hold-0"]).toBeGreaterThan(d["hold-30"]);
    expect(d.break).toBeLessThan(0.05);
  });

  test("Break domine quand le serveur est très faible", () => {
    const d = gameScoreDistribution("A", 0.3, 0.5);
    expect(d.break).toBeGreaterThan(d["hold-0"]);
  });

  test("symétrie : même joueur au service => même distribution", () => {
    // A sert avec pServeA = 0.7 ; B sert avec pServeB = 0.7. La proba de point
    // du serveur est identique, donc la distribution doit l'être aussi (le
    // paramètre « serveur » ne sert qu'à CHOISIR quel pServe appliquer).
    const dA = gameScoreDistribution("A", 0.7, 0.5);
    const dB = gameScoreDistribution("B", 0.5, 0.7);
    expect(dB["hold-0"]).toBeCloseTo(dA["hold-0"], 12);
    expect(dB["hold-30"]).toBeCloseTo(dA["hold-30"], 12);
    expect(dB.break).toBeCloseTo(dA.break, 12);
  });

  test("service de B : la proba utilise pServeB, pas pServeA", () => {
    const dA = gameScoreDistribution("A", 0.4, 0.8);
    const dB = gameScoreDistribution("B", 0.4, 0.8);
    expect(dB["hold-0"]).toBeCloseTo(0.8 ** 4, 12);
    expect(dB["hold-0"]).toBeGreaterThan(dA["hold-0"]);
  });

  test("paramètres non finis -> distribution uniforme (dégradation sûre)", () => {
    const d = gameScoreDistribution("A", Number.NaN, 0.6);
    expect(d["hold-0"]).toBeCloseTo(1 / 3, 6);
    expect(d["hold-30"]).toBeCloseTo(1 / 3, 6);
    expect(d.break).toBeCloseTo(1 / 3, 6);
  });

  test("Hold 0/15 implique le gain du jeu (cohérence avec gameWinProbFromScore)", () => {
    // P(gagner le jeu) ≥ P(4-0) : le gain peut aussi arriver en 4-1, 4-2, 4-3.
    const p = 0.62;
    const d = gameScoreDistribution("A", p, 1 - p);
    expect(d["hold-0"]).toBeLessThanOrEqual(gameWinProbFromScore(0, 0, "A", p, 1 - p));
  });
});

describe("tieBreakProbability", () => {
  test("symétrique : holds identiques -> P(6-6) = C(12,6)·h^6·(1-h)^6", () => {
    const h = 0.85;
    const p = tieBreakProbability(h, h);
    // 2·C(6,3) = 924 (coefficient de Vandermonde pour k=3)
    const expected = 924 * Math.pow(h, 6) * Math.pow(1 - h, 6);
    expect(p).toBeCloseTo(expected, 9);
  });

  test("holds parfaits (1.0) -> jamais de tie-break", () => {
    expect(tieBreakProbability(1, 1)).toBe(0);
  });

  test("holds nuls (0.0) -> jamais de tie-break", () => {
    expect(tieBreakProbability(0, 0)).toBe(0);
  });

  test("holds symétriques autour de 0.5 -> tie-break fréquent", () => {
    // pHold = 0.5 de part et d'autre = service « moyen » : c'est le régime où
    // le 6-6 est le plus probable.
    const p = tieBreakProbability(0.5, 0.5);
    expect(p).toBeGreaterThan(0);
    // Max théorique de la loi hypergéométrique à h=0.5 : 924·0.5^12 ≈ 0.2256
    expect(p).toBeCloseTo((924 * Math.pow(0.5, 12)), 9);
  });

  test("un joueur domine -> tie-break rare", () => {
    expect(tieBreakProbability(0.95, 0.55)).toBeLessThan(0.05);
  });

  test("symétrique A/B : tieBreakProbability(hA,hB) === tieBreakProbability(hB,hA)", () => {
    const a = tieBreakProbability(0.7, 0.8);
    const b = tieBreakProbability(0.8, 0.7);
    expect(a).toBeCloseTo(b, 12);
  });

  test("borné dans [0,1] sur une grille de holds", () => {
    for (let hA = 0; hA <= 1.0001; hA += 0.1) {
      for (let hB = 0; hB <= 1.0001; hB += 0.1) {
        const p = tieBreakProbability(hA, hB);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });

  test("holds hors bornes sont clampés (pas de NaN ni de fuite)", () => {
    expect(Number.isFinite(tieBreakProbability(-1, 2))).toBe(true);
    expect(tieBreakProbability(-1, 2)).toBeCloseTo(tieBreakProbability(0, 1), 12);
  });
});