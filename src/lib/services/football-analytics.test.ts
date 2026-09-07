import { describe, expect, it } from "bun:test";
import { buildDixonColesMatrix, dixonColesMarkets } from "../prediction/football/dixon-coles";
import { blendLambda, computeMatchPicks, dominanceRatio, type PickInput } from "./football-analytics";

describe("football-analytics", () => {
  describe("computeMatchPicks", () => {
    it("retourne over15 si xG cumule eleve et prob >= 60%", () => {
      const input: PickInput = { lambdaHome: 1.8, lambdaAway: 1.5, xgTotal: 3.0 };
      const picks = computeMatchPicks(input);
      const over15 = picks.find((p) => p.type === "over15");
      expect(over15).toBeDefined();
      expect(over15!.prob).toBeGreaterThanOrEqual(0.6);
      expect(over15!.prob).toBeLessThanOrEqual(1);
    });

    it("exclut over15 si xG cumule <= 2.6 (trigger non satisfait)", () => {
      const input: PickInput = { lambdaHome: 1.8, lambdaAway: 1.5, xgTotal: 2.0 };
      const picks = computeMatchPicks(input);
      const over15 = picks.find((p) => p.type === "over15");
      expect(over15).toBeUndefined();
    });

    it("over15 declenche sans xG (xgTotal null = conservateur)", () => {
      const input: PickInput = { lambdaHome: 2.0, lambdaAway: 1.8, xgTotal: null };
      const picks = computeMatchPicks(input);
      const over15 = picks.find((p) => p.type === "over15");
      expect(over15).toBeDefined();
    });

    it("toutes les probs sont dans [0,1]", () => {
      const input: PickInput = { lambdaHome: 2.5, lambdaAway: 2.0, xgTotal: 3.5, htShare: 0.7 };
      const picks = computeMatchPicks(input);
      for (const p of picks) {
        expect(p.prob).toBeGreaterThanOrEqual(0);
        expect(p.prob).toBeLessThanOrEqual(1);
      }
    });

    it("exclut over05ht si htShare < 0.65", () => {
      const input: PickInput = { lambdaHome: 1.0, lambdaAway: 1.0, htShare: 0.5 };
      const picks = computeMatchPicks(input);
      const ht = picks.find((p) => p.type === "over05ht");
      expect(ht).toBeUndefined();
    });

    it("EV positif avec cote genereuse", () => {
      const input: PickInput = {
        lambdaHome: 2.0, lambdaAway: 1.8, xgTotal: 3.0,
        odds: { over15: 2.5 },
      };
      const picks = computeMatchPicks(input);
      const over15 = picks.find((p) => p.type === "over15");
      expect(over15).toBeDefined();
      expect(over15!.ev).not.toBeNull();
      expect(over15!.ev!).toBeGreaterThan(0);
    });

    it("EV null sans cote", () => {
      const input: PickInput = { lambdaHome: 2.0, lambdaAway: 1.8, xgTotal: 3.0 };
      const picks = computeMatchPicks(input);
      const over15 = picks.find((p) => p.type === "over15");
      expect(over15!.ev).toBeNull();
    });

    it("over05ht declenche si htShare >= 0.65", () => {
      const input: PickInput = { lambdaHome: 1.0, lambdaAway: 1.0, htShare: 0.7 };
      const picks = computeMatchPicks(input);
      const ht = picks.find((p) => p.type === "over05ht");
      expect(ht).toBeDefined();
      expect(ht!.prob).toBeGreaterThanOrEqual(0.6);
    });

    it("picks tries par prob decroissante", () => {
      const input: PickInput = { lambdaHome: 2.5, lambdaAway: 2.0, xgTotal: 3.5, htShare: 0.8 };
      const picks = computeMatchPicks(input);
      for (let i = 1; i < picks.length; i++) {
        expect(picks[i - 1].prob).toBeGreaterThanOrEqual(picks[i].prob);
      }
    });
  });

  describe("dominanceRatio", () => {
    it("calcule xG_for / xGA", () => {
      expect(dominanceRatio(2.0, 1.0)).toBeCloseTo(2.0, 1);
    });

    it("retourne null si xGA nul", () => {
      expect(dominanceRatio(2.0, 0)).toBeNull();
      expect(dominanceRatio(2.0, null)).toBeNull();
    });

    it("clamp entre 0.3 et 3.0", () => {
      expect(dominanceRatio(10, 1)).toBeLessThanOrEqual(3);
      expect(dominanceRatio(0.1, 10)).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe("blendLambda", () => {
    it("50/50 si xG dispo", () => {
      expect(blendLambda(2.0, 3.0)).toBeCloseTo(2.5, 2);
    });

    it("forme pure si xG absent", () => {
      expect(blendLambda(2.0, null)).toBe(2.0);
      expect(blendLambda(2.0, 0)).toBe(2.0);
    });
  });

  describe("matrice Dixon-Coles integrite", () => {
    it("la matrice normalisee somme a ~1", () => {
      const m = buildDixonColesMatrix(1.5, 1.2);
      let sum = 0;
      for (const row of m) for (const v of row) sum += v;
      expect(sum).toBeCloseTo(1, 1);
    });

    it("markets over05 > over15 > over25 (monotonicite)", () => {
      const mk = dixonColesMarkets(1.8, 1.5);
      expect(mk.over05).toBeGreaterThan(mk.over15);
      expect(mk.over15).toBeGreaterThan(mk.over25);
    });
  });
});
