import { describe, it, expect, beforeEach } from "bun:test";
import {
  gameWinProb,
  breakProb,
  expectedRemainingGames,
  setScoreDistribution,
  setOverUnder,
  expectedRemainingSets,
  clearAllMemos,
} from "../src/lib/prediction/live-markov";

/**
 * Tests de sanity du modèle Markov live.
 *
 * gameWinProb(p) prend une proba de POINT au service [0,1]
 * et renvoie la proba de GAGNER LE JEU (hold).
 */
describe("live-markov sanity", () => {
  const pServeA = 0.67;
  const pServeB = 0.62;
  const holdA = gameWinProb(pServeA);
  const holdB = gameWinProb(pServeB);

  beforeEach(() => clearAllMemos());

  // --- gameWinProb (forme fermée) ---

  it("gameWinProb croissant avec p", () => {
    expect(gameWinProb(0.7)).toBeGreaterThan(gameWinProb(0.6));
  });

  it("gameWinProb borné [0,1]", () => {
    expect(gameWinProb(0)).toBe(0);
    expect(gameWinProb(1)).toBe(1);
    expect(gameWinProb(0.65)).toBeGreaterThan(0.5);
    expect(gameWinProb(0.65)).toBeLessThan(1);
  });

  it("holdA > holdB si pServeA > pServeB", () => {
    expect(holdA).toBeGreaterThan(holdB);
  });

  it("breakProb + gameWinProb = 1", () => {
    expect(breakProb(pServeA) + gameWinProb(pServeA)).toBeCloseTo(1, 10);
  });

  // --- setScoreDistribution ---

  it("setScoreDistribution(0-0) somme ≈ 1", () => {
    const dist = setScoreDistribution(holdA, holdB, "A", 0, 0);
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 2);
  });

  it("tie-break : les DEUX issues 7-6 et 6-7 sont dans la distribution", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 5, 5);
    // On force l'état 6-6 en sommant via un set qui y arrive : vérification
    // directe des deux clés TB depuis 5-5 (la récursion passe par 6-6).
    expect(dist["7-6"]).toBeGreaterThan(0);
    expect(dist["6-7"]).toBeGreaterThan(0);
  });

  it("6-0 → E[remaining games] = 0 (set terminé)", () => {
    clearAllMemos();
    const er = expectedRemainingGames(holdA, holdB, "A", 6, 0);
    expect(er).toBe(0);
  });

  it("4-0 → Over 7,5 faible (<20%) : set se termine vite", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 4, 0);
    const { over75 } = setOverUnder(dist);
    // À 4-0 A domine → 6-0/6-1 = 6-7 jeux → Over 7,5 rare
    expect(over75).toBeLessThan(0.20);
  });

  it("0-4 → Over 7,5 élevé (>80%) : B domine, set long", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 0, 4);
    const { over75 } = setOverUnder(dist);
    // B domine → scores 4-6/3-6/2-6 = 8-10 jeux + A peut revenir 6-4/7-5/7-6
    expect(over75).toBeGreaterThan(0.80);
  });

  it("5-5 → Under 12,5 modérée (20%-80%)", () => {
    clearAllMemos();
    const dist = setScoreDistribution(holdA, holdB, "A", 5, 5);
    const { under125 } = setOverUnder(dist);
    expect(under125).toBeGreaterThan(0.20);
    expect(under125).toBeLessThan(0.80);
  });

  // --- expectedRemainingGames ---

  it("E[remaining games] raisonnable à 0-0 (>6)", () => {
    clearAllMemos();
    const er = expectedRemainingGames(holdA, holdB, "A", 0, 0);
    expect(er).toBeGreaterThan(6);
    expect(er).toBeLessThan(14);
  });

  it("E[remaining games] décroît quand le set avance", () => {
    clearAllMemos();
    const er00 = expectedRemainingGames(holdA, holdB, "A", 0, 0);
    clearAllMemos();
    const er32 = expectedRemainingGames(holdA, holdB, "A", 3, 2);
    clearAllMemos();
    const er54 = expectedRemainingGames(holdA, holdB, "A", 5, 4);
    expect(er00).toBeGreaterThan(er32);
    expect(er32).toBeGreaterThan(er54);
  });

  // --- expectedRemainingSets ---

  it("E[remaining sets] = 0 si match terminé (2-0 BO3)", () => {
    const er = expectedRemainingSets(2, 0, 0.65, true);
    expect(er).toBe(0);
  });

  it("E[remaining sets] = 1.35 si 1-0 BO3 (prob A ~0.65)", () => {
    const er = expectedRemainingSets(1, 0, 0.65, true);
    // DP : E(1,0) = 1 + q·E(1,1) = 1 + 0.35·1 = 1.35
    expect(er).toBeCloseTo(1.35, 10);
  });

  it("E[remaining sets] > 2 si 0-0 BO3 (le match peut aller en 3 sets)", () => {
    const er = expectedRemainingSets(0, 0, 0.65, true);
    // E(0,0) ≈ 2.455 à p=0.65 — toujours > 2 car le 3e set est possible
    expect(er).toBeGreaterThan(2);
    expect(er).toBeLessThan(3);
  });

  it("E[remaining sets] augmente si pWinSetA diminue", () => {
    const erDominant = expectedRemainingSets(1, 0, 0.8, true);
    const erSerre = expectedRemainingSets(1, 0, 0.5, true);
    expect(erSerre).toBeGreaterThanOrEqual(erDominant);
  });

  it("E[remaining sets] BO5 : 1 set manquant → entre 1 et 2", () => {
    const er = expectedRemainingSets(2, 1, 0.65, false);
    expect(er).toBeGreaterThan(1);
    expect(er).toBeLessThan(2);
  });
});
