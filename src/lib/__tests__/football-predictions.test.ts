import { describe, test, expect } from "bun:test";
import {
  computeDoubleChance,
  computeOver15,
  computeUnder35,
  computeCornerOver,
  computeTeamComparisons,
  enrichPrediction,
} from "../football-predictions";
import type { Prediction } from "../football-data";
import type { BSDFootballMatch } from "../bsd-football-fetcher";

// ─── computeDoubleChance ──────────────────────────────────────────────────

describe("computeDoubleChance", () => {
  test("returns 1X with clear favorite (home 60, draw 25, away 15)", () => {
    const result = computeDoubleChance(60, 25, 15);
    expect(result.selection).toBe("1X");
    expect(result.prob).toBe(85);
  });

  test("returns 1X for balanced match (33, 34, 33) — first >= wins", () => {
    const result = computeDoubleChance(33, 34, 33);
    // p1x=67, px2=67, p12=66 → 1X wins the tie-break
    expect(result.selection).toBe("1X");
    expect(result.prob).toBe(67);
  });

  test("returns X2 when draw+away is highest (20, 25, 55)", () => {
    const result = computeDoubleChance(20, 25, 55);
    // p1x=45, px2=80, p12=75 → X2
    expect(result.selection).toBe("X2");
    expect(result.prob).toBe(80);
  });

  test("returns 12 when home+away is highest (45, 5, 50)", () => {
    const result = computeDoubleChance(45, 5, 50);
    // p1x=50, px2=55, p12=95 → 12
    expect(result.selection).toBe("12");
    expect(result.prob).toBe(95);
  });

  test("handles all zeros gracefully", () => {
    const result = computeDoubleChance(0, 0, 0);
    expect(result.selection).toBe("1X");
    expect(result.prob).toBe(0);
  });
});

// ─── computeOver15 ────────────────────────────────────────────────────────

describe("computeOver15", () => {
  test("with BSD over/under 1.5 odds (1.5 / 2.5) → ~62.5%", () => {
    // implied over = (1/1.5)*100 ≈ 66.67, implied under = (1/2.5)*100 = 40
    // total = 106.67, normalized = 66.67/106.67*100 = 62.5
    const result = computeOver15(1.5, 2.5, undefined);
    expect(result).toBe(62.5);
  });

  test("without odds, fallback from over25Prob=60 → 75%", () => {
    const result = computeOver15(null, null, 60);
    // base = 60, +15 = 75
    expect(result).toBe(75);
  });

  test("without odds, fallback from default over25Prob (null) → 65%", () => {
    const result = computeOver15(null, null, undefined);
    // over25Prob ?? 50 = 50, +15 = 65
    expect(result).toBe(65);
  });

  test("capped at 98% when over25Prob=90 (90+15=105)", () => {
    const result = computeOver15(null, null, 90);
    expect(result).toBe(98);
  });

  test("returns near-100 with very low odds (over=1.01, under=100)", () => {
    // impOver = 99.01, impUnder = 1, total = 100.01
    // normalizePair: 99.01/100.01*100 ≈ 99.0 (clamped to [0,100])
    const result = computeOver15(1.01, 100, undefined);
    expect(result).toBeGreaterThan(95);
    expect(result).toBeLessThanOrEqual(100);
  });

  test("falls through when only one odds is provided", () => {
    // Only over odds available, missing under → should use fallback
    const result = computeOver15(1.5, null, 50);
    // over25Prob = 50, +15 = 65
    expect(result).toBe(65);
  });

  test("falls through when odds are zero", () => {
    const result = computeOver15(0, 2.5, 50);
    expect(result).toBe(65);
  });
});

// ─── computeUnder35 ───────────────────────────────────────────────────────

describe("computeUnder35", () => {
  test("with under 2.5 odds ~1.67 (implied ~60%) → ~72%", () => {
    // implied = (1/1.67)*100 ≈ 59.88, +12 ≈ 71.88
    const result = computeUnder35(1.67, undefined);
    expect(result).toBeCloseTo(72, 0);
  });

  test("with under 2.5 odds = 2.5 (implied 40%) → 52%", () => {
    const result = computeUnder35(2.5, undefined);
    expect(result).toBe(52);
  });

  test("capped at 98% when implied prob is very high", () => {
    // oddsUnder25 = 1.01 → implied ≈ 99.01, +12 ≈ 111.01 → capped
    const result = computeUnder35(1.01, undefined);
    expect(result).toBe(98);
  });

  test("uses model value when no BSD odds available", () => {
    const result = computeUnder35(null, 65);
    expect(result).toBe(65);
  });

  test("caps model value at 98%", () => {
    const result = computeUnder35(null, 105);
    expect(result).toBe(98);
  });

  test("returns 0 when neither odds nor model value available", () => {
    const result = computeUnder35(null, undefined);
    expect(result).toBe(0);
  });

  test("returns 0 when odds are zero", () => {
    const result = computeUnder35(0, undefined);
    expect(result).toBe(0);
  });
});

// ─── computeCornerOver ────────────────────────────────────────────────────

describe("computeCornerOver", () => {
  test("with high corner teams (total avg 12) returns high line (10.5 or 11.5)", () => {
    const result = computeCornerOver(6, 6, 10);
    // lambda = 12, lines prob: 7.5≈91%, 8.5≈84%, 9.5≈76%, 10.5≈67%, 11.5≈56%
    // best above 65% and closest to 65% = 10.5
    expect(result.line).toBe(10.5);
    expect(result.overProb).toBeGreaterThanOrEqual(65);
    expect(result.overProb).toBeLessThanOrEqual(70);
  });

  test("with low corner teams (total avg 7) returns low line (7.5 or 8.5)", () => {
    const result = computeCornerOver(3.5, 3.5, 10);
    // lambda = 7, lines prob: 7.5≈42%, 8.5≈28%, etc.
    // none above 65%, so returns max prob line = 7.5
    expect([7.5, 8.5]).toContain(result.line);
    expect(result.overProb).toBeGreaterThanOrEqual(0);
    expect(result.overProb).toBeLessThan(65);
  });

  test("uses home advantage fallback (55/45) when team averages are zero", () => {
    // home=0, away=0, leagueAvg=10
    // totalCorners = (0 || 10*0.55) + (0 || 10*0.45) = 5.5 + 4.5 = 10
    const result = computeCornerOver(0, 0, 10);
    expect(result.line).toBeGreaterThanOrEqual(7.5);
    expect(result.line).toBeLessThanOrEqual(11.5);
    expect(result.overProb).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(result.overProb)).toBe(false);
    expect(Number.isFinite(result.overProb)).toBe(true);
  });

  test("with very high corners (total avg 20) returns highest line (11.5)", () => {
    const result = computeCornerOver(10, 10, 10);
    // lambda = 20, all lines should have prob above 65%
    expect(result.line).toBe(11.5);
    expect(result.overProb).toBeGreaterThanOrEqual(65);
  });

  test("returned probability is never NaN (edge case: all zeros with zero league avg)", () => {
    // totalCorners = (0 || 0*0.55) + (0 || 0*0.45) = 0
    // lambda = 0 > 0? No → lambda = 10
    const result = computeCornerOver(0, 0, 0);
    expect(Number.isNaN(result.overProb)).toBe(false);
    expect(Number.isFinite(result.overProb)).toBe(true);
    expect(result.overProb).toBeGreaterThanOrEqual(0);
    expect(result.line).toBeGreaterThanOrEqual(7.5);
  });
});

// ─── computeTeamComparisons ───────────────────────────────────────────────

describe("computeTeamComparisons", () => {
  test("with real stats: homeProb + awayProb = 100 for each category", () => {
    const homeStats = {
      corner_kicks: 8,
      shots_on_target: 6,
      yellow_cards: 2,
      fouls: 12,
    };
    const awayStats = {
      corner_kicks: 2,
      shots_on_target: 4,
      yellow_cards: 1,
      fouls: 8,
    };

    const result = computeTeamComparisons(homeStats, awayStats);

    for (const item of result) {
      expect(item.homeProb + item.awayProb).toBeCloseTo(100, 1);
    }
  });

  test("with real stats: probabilities are clamped to [30, 70]", () => {
    // Home dominates corners 10-0 → raw 100%, should clamp to 70/30
    const homeStats = { corner_kicks: 10, shots_on_target: 0, yellow_cards: 0, fouls: 0 };
    const awayStats = { corner_kicks: 0, shots_on_target: 0, yellow_cards: 0, fouls: 0 };

    const result = computeTeamComparisons(homeStats, awayStats);
    const corners = result[0];

    expect(corners.homeProb).toBe(70);
    expect(corners.awayProb).toBe(30);
    // The other categories have 0+0, so fallback to 55/45
    for (let i = 1; i < result.length; i++) {
      expect(result[i].homeProb).toBe(55);
      expect(result[i].awayProb).toBe(45);
    }
  });

  test("with undefined stats: returns default [55, 45] for all", () => {
    const result = computeTeamComparisons(null, null);

    for (const item of result) {
      expect(item.homeProb).toBe(55);
      expect(item.awayProb).toBe(45);
    }
  });

  test("returns exactly 4 comparison labels in French", () => {
    const result = computeTeamComparisons(null, null);
    const labels = result.map((r) => r.label);

    expect(labels).toEqual(["Corners", "Tirs cadrés", "Cartons", "Fautes"]);
    expect(result).toHaveLength(4);
  });
});

// ─── enrichPrediction (integration) ───────────────────────────────────────

describe("enrichPrediction", () => {
  test("populates all optional fields from a full BSD match", () => {
    const prediction: Prediction = {
      homeProb: 60,
      drawProb: 25,
      awayProb: 15,
      bttsProb: 55,
      over25Prob: 65,
      model: "test",
    };

    const bsdMatch = {
      odds_over_15: 1.5,
      odds_under_15: 2.5,
      odds_under_25: 1.67,
      live_stats: {
        home: {
          corner_kicks: 8, shots_on_target: 6,
          yellow_cards: 2, fouls: 12,
        },
        away: {
          corner_kicks: 2, shots_on_target: 4,
          yellow_cards: 1, fouls: 8,
        },
      },
    } as unknown as BSDFootballMatch;

    const enriched = enrichPrediction(prediction, bsdMatch);

    // Double chance
    expect(enriched.doubleChance).toBeDefined();
    expect(enriched.doubleChance!.selection).toBe("1X");
    expect(enriched.doubleChance!.prob).toBe(85);

    // Over 1.5
    expect(enriched.over15Prob).toBeDefined();
    expect(enriched.over15Prob).toBe(62.5);

    // Under 3.5
    expect(enriched.under35Prob).toBeDefined();
    expect(enriched.under35Prob).toBeCloseTo(72, 0);

    // Best corner over
    expect(enriched.bestCornerOver).toBeDefined();
    expect(enriched.bestCornerOver!.line).toBeGreaterThanOrEqual(7.5);
    expect(enriched.bestCornerOver!.overProb).toBeGreaterThanOrEqual(0);

    // Team comparisons
    expect(enriched.teamComparisons).toBeDefined();
    expect(enriched.teamComparisons!).toHaveLength(4);

    // Original fields preserved
    expect(enriched.homeProb).toBe(60);
    expect(enriched.drawProb).toBe(25);
    expect(enriched.awayProb).toBe(15);
    expect(enriched.bttsProb).toBe(55);
    expect(enriched.over25Prob).toBe(65);
    expect(enriched.model).toBe("test");
  });

  test("with minimal BSD match (no optional odds) returns valid Prediction", () => {
    const prediction: Prediction = {
      homeProb: 50, drawProb: 30, awayProb: 20,
      bttsProb: 50, over25Prob: 50, model: "test",
    };

    const bsdMatch = {} as unknown as BSDFootballMatch;

    const enriched = enrichPrediction(prediction, bsdMatch);

    // All optional fields should be populated
    expect(enriched.doubleChance).toBeDefined();
    expect(enriched.doubleChance!.selection).toBe("1X");
    expect(enriched.doubleChance!.prob).toBe(80);

    expect(enriched.over15Prob).toBeDefined();
    expect(enriched.over15Prob).toBe(65); // base 50 + 15

    expect(enriched.under35Prob).toBeDefined();
    expect(enriched.under35Prob).toBe(62); // model fallback: 100 - over25Prob(50) + 12 = 62, capped to 98

    expect(enriched.bestCornerOver).toBeDefined();
    expect(enriched.bestCornerOver!.overProb).toBeGreaterThanOrEqual(0);

    expect(enriched.teamComparisons).toBeDefined();
    expect(enriched.teamComparisons!).toHaveLength(4);
    for (const item of enriched.teamComparisons!) {
      expect(item.homeProb).toBe(55);
      expect(item.awayProb).toBe(45);
    }

    // Original fields preserved
    expect(enriched.homeProb).toBe(50);
    expect(enriched.drawProb).toBe(30);
    expect(enriched.awayProb).toBe(20);
  });

  test("returns a new object (does not mutate input)", () => {
    const prediction: Prediction = {
      homeProb: 40, drawProb: 30, awayProb: 30,
      bttsProb: 45, over25Prob: 55, model: "test",
    };

    const bsdMatch = {} as unknown as BSDFootballMatch;

    const enriched = enrichPrediction(prediction, bsdMatch);

    // Input should not have been mutated
    expect(prediction.doubleChance).toBeUndefined();
    expect(prediction.over15Prob).toBeUndefined();

    // Enriched is a different object
    expect(enriched).not.toBe(prediction);
  });
});