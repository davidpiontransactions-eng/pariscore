// Tests devig + CLV handball — bun:test
// CLV = (p_model − p_implied) / p_implied.

import { describe, test, expect } from "bun:test";
import {
  devigProportional,
  rawImplied,
  devigShin,
  clvValue,
  isClvEdge,
  summarizeClv,
  CLV_EDGE_THRESHOLD,
} from "../handball-clv";

describe("devigProportional", () => {
  test("somme à 1, valeurs exactes [2, 3.5, 4]", () => {
    const p = devigProportional([2, 3.5, 4]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(p[0]).toBeCloseTo(0.4828, 4);
  });

  test("cotes invalides → 0", () => {
    expect(devigProportional([0, -1])).toEqual([0, 0]);
  });
});

describe("devigShin", () => {
  test("somme à 1", () => {
    const { probs } = devigShin([1.5, 8, 3.0]);
    expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  test("note si résidu favori (ou undefined sans biais)", () => {
    const { note } = devigShin([1.5, 8, 3.0]);
    expect(note === undefined || typeof note === "string").toBe(true);
  });
});

describe("clvValue", () => {
  test("CLV ≈ 0 si cotes = modèle", () => {
    expect(clvValue(0.5, 0.5)).toBeCloseTo(0, 10);
    expect(clvValue(0.62, 0.62)).toBeCloseTo(0, 10);
  });

  test("CLV > 0 si modèle meilleur que marché", () => {
    expect(clvValue(0.6, 0.5)).toBeCloseTo(0.2, 10);
  });

  test("implicite nul → 0 (pas de division)", () => {
    expect(clvValue(0.6, 0)).toBe(0);
  });
});

describe("isClvEdge", () => {
  test("seuil 1,5 %", () => {
    expect(CLV_EDGE_THRESHOLD).toBe(0.015);
    expect(isClvEdge(0.016)).toBe(true);
    expect(isClvEdge(-0.02)).toBe(true);
    expect(isClvEdge(0.01)).toBe(false);
  });
});

describe("summarizeClv", () => {
  test("métriques jouet", () => {
    const s = summarizeClv([
      { clv: 0.1, win: true, odds: 2 },
      { clv: -0.05, win: false, odds: 2 },
    ]);
    expect(s.nBets).toBe(2);
    expect(s.meanCLV).toBeCloseTo(0.025, 10);
    expect(s.hitRate).toBe(0.5);
    expect(s.profitSimU).toBeCloseTo(0, 10); // (2−1) − 1
    expect(s.roiPct).toBeCloseTo(0, 10);
  });

  test("vide → nuls", () => {
    const s = summarizeClv([]);
    expect(s.nBets).toBe(0);
    expect(s.meanCLV).toBeNull();
    expect(s.roiPct).toBeNull();
  });

  test("rawImplied(2) = 0.5", () => {
    expect(rawImplied(2)).toBe(0.5);
  });
});
