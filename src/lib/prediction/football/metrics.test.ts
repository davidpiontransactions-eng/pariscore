import { describe, it, expect } from "bun:test";
import {
  brierScore,
  logLoss,
  calibrationCurve,
  rankedProbabilityScore,
  accuracy,
} from "./brier-score";
import { detectDrift } from "./drift-detection";
import { assignVariant, compareVariants } from "./ab-testing";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePredictionLog(overrides: Record<string, unknown> = {}) {
  return {
    id: `log_${Math.random().toString(36).slice(2, 8)}`,
    matchId: `match_${Math.random().toString(36).slice(2, 8)}`,
    modelVersionId: "v1",
    homeProb: 50,
    drawProb: 25,
    awayProb: 25,
    bttsProb: 50,
    over25Prob: 50,
    actualHome: 1,
    actualAway: 1,
    settled: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── brierScore ───────────────────────────────────────────────────────────────

describe("brierScore", () => {
  it("perfect predictions → 0", () => {
    expect(brierScore([1, 1, 1], [1, 1, 1])).toBe(0);
  });

  it("worst predictions → 1", () => {
    expect(brierScore([0, 0, 0], [1, 1, 1])).toBe(1);
  });

  it("half-right → 0.5", () => {
    // Brier = mean((p-y)²) = ((1-1)² + (0-1)²) / 2 = 0.5
    expect(brierScore([1, 0], [1, 1])).toBe(0.5);
  });

  it("empty arrays → NaN", () => {
    expect(brierScore([], [])).toBeNaN();
  });

  it("single prediction", () => {
    expect(brierScore([0.8], [1])).toBeCloseTo(0.04, 4);
  });

  it("clamps values > 1", () => {
    expect(brierScore([1.5], [1])).toBe(0);
  });

  it("clamps values < 0 to 0", () => {
    // clamp01(-0.5) = 0, brier = (0-1)² = 1
    expect(brierScore([-0.5], [1])).toBe(1);
  });
});

// ── logLoss ──────────────────────────────────────────────────────────────────

describe("logLoss", () => {
  it("perfect predictions → ~0", () => {
    expect(logLoss([0.999], [1])).toBeLessThan(0.01);
  });

  it("worst predictions → high", () => {
    const loss = logLoss([0.001], [1]);
    expect(loss).toBeGreaterThan(5);
  });

  it("empty arrays → NaN", () => {
    expect(logLoss([], [])).toBeNaN();
  });

  it("asymmetric: wrong confident = worse than wrong uncertain", () => {
    const wrongConfident = logLoss([0.01], [1]);
    const wrongUncertain = logLoss([0.45], [1]);
    expect(wrongConfident).toBeGreaterThan(wrongUncertain);
  });
});

// ── calibrationCurve ─────────────────────────────────────────────────────────

describe("calibrationCurve", () => {
  it("returns bins with correct properties", () => {
    const predicted = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const actual = [0, 0, 0, 0, 1, 1, 1, 1, 1];
    const bins = calibrationCurve(predicted, actual, 5);
    expect(bins.length).toBe(5);
    for (const bin of bins) {
      expect(bin).toHaveProperty("center");
      expect(bin).toHaveProperty("meanPredicted");
      expect(bin).toHaveProperty("observedFrequency");
      expect(bin).toHaveProperty("count");
    }
  });

  it("empty input → empty output", () => {
    expect(calibrationCurve([], [], 5)).toEqual([]);
  });

  it("returns correct number of bins", () => {
    const predicted = Array.from({ length: 100 }, (_, i) => i / 100);
    const actual = Array.from({ length: 100 }, () => 0.5);
    expect(calibrationCurve(predicted, actual, 10).length).toBe(10);
    expect(calibrationCurve(predicted, actual, 5).length).toBe(5);
  });
});

// ── rankedProbabilityScore ───────────────────────────────────────────────────

describe("rankedProbabilityScore", () => {
  it("perfect predictions → 0", () => {
    // CDF: P(≤0)=0, P(≤1)=0, P(≤2)=1 → outcome=2
    const predicted = [[0, 0, 1]];
    const actual = [2];
    expect(rankedProbabilityScore(predicted, actual)).toBe(0);
  });

  it("empty → NaN", () => {
    expect(rankedProbabilityScore([], [])).toBeNaN();
  });

  it("worst predictions → 1", () => {
    // CDF all mass on first outcome, but actual is last
    const predicted = [[1, 1, 1]];
    const actual = [2];
    const rps = rankedProbabilityScore(predicted, actual);
    expect(rps).toBe(1); // rpsSingle: (1-0)²+(1-0)²+(1-1)² = 2, /2 = 1.0
  });
});

// ── accuracy ─────────────────────────────────────────────────────────────────

describe("accuracy", () => {
  it("all correct → 1.0", () => {
    expect(accuracy([0.9, 0.8, 0.7], [1, 1, 1])).toBe(1);
  });

  it("all wrong → 0.0", () => {
    expect(accuracy([0.1, 0.2, 0.3], [1, 1, 1])).toBe(0);
  });

  it("empty → NaN", () => {
    expect(accuracy([], [])).toBeNaN();
  });

  it("mixed → correct ratio", () => {
    // [0.6≥0.5→1✓, 0.3<0.5→0✓, 0.8≥0.5→1✓, 0.7≥0.5→1✗ vs actual=0] = 3/4 = 0.75
    expect(accuracy([0.6, 0.3, 0.8, 0.7], [1, 0, 1, 0])).toBe(0.75);
  });
});

// ── detectDrift ──────────────────────────────────────────────────────────────

describe("detectDrift", () => {
  it("no drift when distributions identical", () => {
    const logs = Array.from({ length: 50 }, () =>
      makePredictionLog({ homeProb: 50, drawProb: 25, awayProb: 25, actualHome: 1, actualAway: 0 })
    );
    const result = detectDrift(logs, logs);
    expect(result.drifted).toBe(false);
  });

  it("drift detected when recent much worse", () => {
    const baseline = Array.from({ length: 50 }, () =>
      makePredictionLog({ homeProb: 80, drawProb: 10, awayProb: 10, actualHome: 1, actualAway: 0 })
    );
    const recent = Array.from({ length: 50 }, () =>
      makePredictionLog({ homeProb: 80, drawProb: 10, awayProb: 10, actualHome: 0, actualAway: 1 })
    );
    const result = detectDrift(recent, baseline);
    expect(result.drifted).toBe(true);
  });

  it("handles empty arrays", () => {
    const result = detectDrift([], []);
    expect(result.drifted).toBe(false);
  });
});

// ── assignVariant ────────────────────────────────────────────────────────────

describe("assignVariant", () => {
  it("deterministic — same input → same output", () => {
    const v1 = assignVariant("match_123", ["A", "B"]);
    const v2 = assignVariant("match_123", ["A", "B"]);
    expect(v1).toBe(v2);
  });

  it("distributes across variants", () => {
    const counts = { A: 0, B: 0 };
    for (let i = 0; i < 100; i++) {
      const v = assignVariant(`match_${i}`, ["A", "B"]) as "A" | "B";
      counts[v]++;
    }
    expect(counts.A).toBeGreaterThan(30);
    expect(counts.B).toBeGreaterThan(30);
  });

  it("single variant always returns it", () => {
    expect(assignVariant("match_1", ["A"])).toBe("A");
  });

  it("three variants distributed", () => {
    const counts = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 300; i++) {
      const v = assignVariant(`match_${i}`, ["A", "B", "C"]) as "A" | "B" | "C";
      counts[v]++;
    }
    expect(counts.A).toBeGreaterThan(50);
    expect(counts.B).toBeGreaterThan(50);
    expect(counts.C).toBeGreaterThan(50);
  });
});

// ── compareVariants ──────────────────────────────────────────────────────────

describe("compareVariants", () => {
  it("identical results → no winner", () => {
    const logs = Array.from({ length: 30 }, () =>
      makePredictionLog({ homeProb: 60, actualHome: 1, actualAway: 0 })
    );
    const result = compareVariants(logs, logs);
    expect(result.winner).toBeNull();
  });

  it("clear winner → significant", () => {
    const good = Array.from({ length: 50 }, () =>
      makePredictionLog({ homeProb: 90, actualHome: 1, actualAway: 0 })
    );
    const bad = Array.from({ length: 50 }, () =>
      makePredictionLog({ homeProb: 90, actualHome: 0, actualAway: 1 })
    );
    const result = compareVariants(good, bad);
    expect(result.winner).toBeTruthy();
    expect(result.significant).toBe(true);
  });

  it("empty arrays → no crash", () => {
    const result = compareVariants([], []);
    expect(result.winner).toBeNull();
  });
});
