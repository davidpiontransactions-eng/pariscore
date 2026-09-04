import { describe, it, expect } from "bun:test";
import {
  eloWinProbability,
  eloUpdate,
  fourFactorsScore,
  fourFactorsWinProbability,
  pirWinProbability,
  xgboostPredict,
  hybridPredict,
  predictMatch,
} from "@/lib/predictions/fiba-predictions";

describe("FIBA Predictions", () => {
  describe("Elo Model", () => {
    it("should return valid probabilities (0-1)", () => {
      const result = eloWinProbability(1000, 900);
      expect(result.pHome).toBeGreaterThan(0);
      expect(result.pHome).toBeLessThan(1);
      expect(result.pAway).toBeGreaterThan(0);
      expect(result.pAway).toBeLessThan(1);
      expect(result.pHome + result.pAway).toBeCloseTo(1, 10);
    });

    it("should favor higher-rated team", () => {
      const result = eloWinProbability(1200, 800);
      expect(result.pHome).toBeGreaterThan(0.7);
    });

    it("should update ratings correctly after win", () => {
      const { newHomeRating, newAwayRating } = eloUpdate(1000, 1000, 80, 70);
      expect(newHomeRating).toBeGreaterThan(1000);
      expect(newAwayRating).toBeLessThan(1000);
    });

    it("should update ratings correctly after loss", () => {
      const { newHomeRating, newAwayRating } = eloUpdate(1000, 1000, 70, 80);
      expect(newHomeRating).toBeLessThan(1000);
      expect(newAwayRating).toBeGreaterThan(1000);
    });
  });

  describe("Four Factors", () => {
    it("should return valid score (0-1)", () => {
      const score = fourFactorsScore({
        eFG: 0.55,
        TOV: 0.12,
        ORB: 0.28,
        FT: 0.25,
        ORtg: 110,
        DRtg: 95,
        pace: 72,
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it("should favor team with better stats", () => {
      const home = fourFactorsScore({
        eFG: 0.60, TOV: 0.10, ORB: 0.30, FT: 0.25,
        ORtg: 115, DRtg: 95, pace: 72,
      });
      const away = fourFactorsScore({
        eFG: 0.45, TOV: 0.18, ORB: 0.22, FT: 0.18,
        ORtg: 100, DRtg: 105, pace: 70,
      });
      expect(home).toBeGreaterThan(away);
    });

    it("should return valid win probability", () => {
      const result = fourFactorsWinProbability(
        { eFG: 0.55, TOV: 0.12, ORB: 0.28, FT: 0.25, ORtg: 110, DRtg: 95, pace: 72 },
        { eFG: 0.48, TOV: 0.16, ORB: 0.24, FT: 0.20, ORtg: 102, DRtg: 103, pace: 70 },
      );
      expect(result.pHome).toBeGreaterThan(0);
      expect(result.pHome).toBeLessThan(1);
    });
  });

  describe("PIR Model", () => {
    it("should return valid win probability", () => {
      const result = pirWinProbability(0.58, 0.52);
      expect(result.pHome).toBeGreaterThan(0);
      expect(result.pHome).toBeLessThan(1);
      expect(result.pHome).toBeGreaterThan(0.5); // Home advantage
    });
  });

  describe("XGBoost Model", () => {
    it("should return valid prediction with SHAP values", () => {
      const result = xgboostPredict(
        { eFG: 0.55, dREB: 32, TOV: 12, AST: 20, FT: 16 },
        { eFG: 0.48, dREB: 28, TOV: 16, AST: 16, FT: 14 },
      );
      expect(result.pHome).toBeGreaterThan(0);
      expect(result.pHome).toBeLessThan(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.shapValues).toBeDefined();
      expect(result.featureImportance.length).toBeGreaterThan(0);
    });
  });

  describe("Hybrid Model", () => {
    it("should return valid blended prediction", () => {
      const result = hybridPredict("USA", "CZE");
      expect(result.blendedPHome).toBeGreaterThan(0);
      expect(result.blendedPHome).toBeLessThan(1);
      expect(result.blendedConfidence).toBeGreaterThan(0);
      expect(result.modelAgreement).toBeGreaterThanOrEqual(0);
      expect(result.modelAgreement).toBeLessThanOrEqual(1);
      expect(["HOME", "AWAY", "NEUTRAL"]).toContain(result.recommendation);
    });

    it("should favor USA against lower-rated teams", () => {
      const result = hybridPredict("USA", "KOR");
      expect(result.blendedPHome).toBeGreaterThan(0.6); // USA strongly favored
      expect(result.recommendation).toBe("HOME");
    });
  });

  describe("predictMatch", () => {
    it("should return complete prediction", () => {
      const result = predictMatch({
        homeTeam: "FRA",
        awayTeam: "ESP",
        isHome: true,
      });
      expect(result.blendedPHome).toBeGreaterThan(0);
      expect(result.blendedPHome).toBeLessThan(1);
      expect(result.elo).toBeDefined();
      expect(result.fourFactors).toBeDefined();
      expect(result.pir).toBeDefined();
      expect(result.xgboost).toBeDefined();
    });

    it("should include stats when provided", () => {
      const result = predictMatch({
        homeTeam: "AUS",
        awayTeam: "BEL",
        isHome: true,
        homeStats: { eFG: 0.55, offensiveRating: 112 },
        awayStats: { eFG: 0.51, offensiveRating: 107 },
      });
      expect(result.blendedPHome).toBeGreaterThan(0);
      expect(result.shapValues).toBeDefined();
    });
  });
});
