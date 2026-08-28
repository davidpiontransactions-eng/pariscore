import { describe, expect, test } from "bun:test";
import { handicapRoundMarkets } from "./handicap-rounds";
import type { RoundDistribution } from "./cs2-predictive-ml-engine";

describe("cs2-handicap-rounds — marché handicap rounds", () => {
  test("distribution connue → probas de cover exactes par comptage", () => {
    // T1 gagne par +8, +4, +2 (diff>1.5) et perd par −2 (diff≤1.5)
    const dist: RoundDistribution = {
      t1Wins: [13, 13, 13, 11],
      t2Wins: [5, 9, 11, 13],
      totalRounds: [18, 22, 24, 24],
      mapWinRate: 0.75,
    };
    const markets = handicapRoundMarkets(dist, [1.5], 4);
    const line = markets.find((m) => m.line === 1.5);
    expect(line).toBeDefined();
    expect(line!.probT1Cover).toBeCloseTo(0.75, 6); // 3/4 diff≥1.5
    expect(line!.probT2Cover).toBeCloseTo(0.25, 6); // 1/4 diff≤−1.5
  });

  test("ligne +2.5 → couvre seulement les diffs ≥3", () => {
    const dist: RoundDistribution = {
      t1Wins: [13, 13, 13, 13, 10],
      t2Wins: [5, 10, 12, 14, 13],
      totalRounds: [18, 23, 25, 27, 23],
      mapWinRate: 0.8,
    };
    const markets = handicapRoundMarkets(dist, [2.5], 5);
    const line = markets.find((m) => m.line === 2.5);
    // diffs : +8, +3, +1, −1, −3 → +8 & +3 couvrent (2/5), −3 côté T2 (1/5)
    expect(line!.probT1Cover).toBeCloseTo(0.4, 6);
    expect(line!.probT2Cover).toBeCloseTo(0.2, 6);
  });

  test("probabilités bornées et complémentaires (ligne ≥ min diff)", () => {
    const n = 200;
    const t1: number[] = [];
    const t2: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = 13 + Math.floor(i % 5); // 13-17
      const b = 13 + Math.floor((i * 3) % 5); // 13-17
      t1.push(a);
      t2.push(b);
    }
    const dist: RoundDistribution = {
      t1Wins: t1,
      t2Wins: t2,
      totalRounds: t1.map((a, i) => a + t2[i]),
      mapWinRate: 0.5,
    };
    for (const m of handicapRoundMarkets(dist, [1.5, 2.5, 3.5], n)) {
      expect(m.probT1Cover).toBeGreaterThanOrEqual(0);
      expect(m.probT1Cover).toBeLessThanOrEqual(1);
      expect(m.probT2Cover).toBeGreaterThanOrEqual(0);
      expect(m.probT2Cover).toBeLessThanOrEqual(1);
      expect(m.probT1Cover + m.probT2Cover).toBeLessThanOrEqual(1.000001);
    }
  });
});