import { describe, expect, test } from "bun:test";
import { evaluateMarkets } from "./backtest-core";

describe("backtest-core — evaluateMarkets", () => {
  test("prédiction parfaite ≥30 obs → OK", () => {
    // Prédit 0.9, outcome 1 (90%) — calibration quasi parfaite.
    const records = Array.from({ length: 40 }, (_, i) => ({
      prob: 0.9,
      outcome: i < 36 ? (1 as const) : (0 as const),
      odds: 1.5,
    }));
    const r = evaluateMarkets(records, "winner");
    expect(r.market).toBe("winner");
    expect(r.n).toBe(40);
    expect(r.verdict).toBe("OK");
  });

  test("prédiction mauvaise (inversée) ≥30 obs → NO-GO", () => {
    const records = Array.from({ length: 40 }, () => ({
      prob: 0.9,
      outcome: 0 as const,
      odds: 1.5,
    }));
    const r = evaluateMarkets(records, "winner");
    expect(r.verdict).toBe("NO-GO");
  });

  test("n < 30 → NO-GO (échantillon insuffisant)", () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      prob: 0.9,
      outcome: i < 9 ? (1 as const) : (0 as const),
      odds: 1.5,
    }));
    const r = evaluateMarkets(records, "map");
    expect(r.verdict).toBe("NO-GO");
  });

  test("champs numériques remplis et bornés", () => {
    const records = Array.from({ length: 30 }, (_, i) => ({
      prob: 0.7,
      outcome: i < 21 ? (1 as const) : (0 as const),
      odds: 2.0,
    }));
    const r = evaluateMarkets(records, "over");
    expect(r.brier).toBeGreaterThanOrEqual(0);
    expect(r.brier).toBeLessThanOrEqual(1);
    expect(r.ece).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.roi)).toBe(true);
  });

  test("records vides → NO-GO sans crash", () => {
    const r = evaluateMarkets([], "winner");
    expect(r.verdict).toBe("NO-GO");
    expect(r.n).toBe(0);
  });
});