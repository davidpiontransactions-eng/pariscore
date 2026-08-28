import { describe, expect, test } from "bun:test";
import {
  brierScore,
  expectedCalibrationError,
  roi,
  calibrationVerdict,
} from "./cs2-calibration";

describe("cs2-calibration — Brier score", () => {
  test("prédictions parfaites → brier 0", () => {
    expect(brierScore([1, 0, 1, 0], [1, 0, 1, 0])).toBeCloseTo(0, 6);
  });

  test("pire prédiction (inversée) → brier 1", () => {
    expect(brierScore([1, 0, 1, 0], [0, 1, 0, 1])).toBeCloseTo(1, 6);
  });

  test("prédiction 50/50 → brier 0.25", () => {
    expect(brierScore([0.5, 0.5], [1, 0])).toBeCloseTo(0.25, 6);
  });
});

describe("cs2-calibration — ECE", () => {
  test("fréquence observée = proba prédite → ECE 0", () => {
    // p constant 0.5 avec 50% de wins → meanProb = freq → ECE 0.
    const probs = Array(10).fill(0.5) as number[];
    const outcomes: (0 | 1)[] = Array(5).fill(1).concat(Array(5).fill(0)) as (0 | 1)[];
    expect(expectedCalibrationError(probs, outcomes)).toBeCloseTo(0, 6);
  });

  test("p constant 0.8 avec 80% de wins → ECE 0", () => {
    const probs = Array(10).fill(0.8) as number[];
    const outcomes: (0 | 1)[] = Array(8).fill(1).concat(Array(2).fill(0)) as (0 | 1)[];
    expect(expectedCalibrationError(probs, outcomes)).toBeCloseTo(0, 6);
  });

  test("probas surconfiantes (0.95 prédit, 50% réel) → ECE > 0", () => {
    const probs = [0.95, 0.95, 0.95, 0.95];
    const outcomes: (0 | 1)[] = [1, 1, 0, 0]; // 50% réel vs 95% prédit
    expect(expectedCalibrationError(probs, outcomes)).toBeGreaterThan(0.1);
  });
});

describe("cs2-calibration — ROI", () => {
  test("cotes surévaluées (EV positif) → ROI > 0", () => {
    // p modèle = 0.8, cote 2.0 → EV = +60% ; sur 100 paris, ~80 gagnés.
    const probs = Array(100).fill(0.8) as number[];
    const outcomes: (0 | 1)[] = Array(80).fill(1).concat(Array(20).fill(0)) as (0 | 1)[];
    const r = roi(probs, outcomes, 2.0);
    expect(r).toBeGreaterThan(50); // 80*(2-1) - 20 = 60 → 60%
    expect(r).toBeCloseTo(60, 0);
  });

  test("cotes justes (EV ~0) → ROI ~0", () => {
    const probs = Array(100).fill(0.5) as number[];
    const outcomes: (0 | 1)[] = Array(50).fill(1).concat(Array(50).fill(0)) as (0 | 1)[];
    expect(roi(probs, outcomes, 2.0)).toBeCloseTo(0, 0);
  });
});

describe("cs2-calibration — Verdict", () => {
  test("OK si n>=30, brier<=0.25, ece<=0.10", () => {
    expect(
      calibrationVerdict({ brier: 0.18, ece: 0.08, roi: 5, n: 142 }),
    ).toBe("OK");
  });

  test("NO-GO si n < 30", () => {
    expect(
      calibrationVerdict({ brier: 0.18, ece: 0.08, roi: 5, n: 12 }),
    ).toBe("NO-GO");
  });

  test("NO-GO si ECE trop élevé", () => {
    expect(
      calibrationVerdict({ brier: 0.18, ece: 0.22, roi: 5, n: 142 }),
    ).toBe("NO-GO");
  });

  test("NO-GO si Brier trop élevé", () => {
    expect(
      calibrationVerdict({ brier: 0.3, ece: 0.08, roi: 5, n: 142 }),
    ).toBe("NO-GO");
  });
});