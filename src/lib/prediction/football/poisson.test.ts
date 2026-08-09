import { describe, expect, test } from "bun:test";
import { buildScoreMatrix, marketsFromMatrix, poissonMarkets, poissonPMF } from "./poisson";

describe("poisson", () => {
  test("poissonPMF λ=1.0, k=0 → e^-1", () => {
    expect(poissonPMF(1, 0)).toBeCloseTo(Math.exp(-1), 8);
  });
  test("matrice normalisée + somme 1", () => {
    const m = buildScoreMatrix(1.35, 1.1);
    expect(m.flat().reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
  test("matchs serrés λ=1.35/1.1 → P(nul) proche de P(victoire ext)", () => {
    const mk = marketsFromMatrix(buildScoreMatrix(1.35, 1.1));
    // Match serré : draw et awayWin proches (λ proches)
    expect(mk.homeWin).toBeGreaterThan(mk.draw); // home advantage
    expect(Math.abs(mk.draw - mk.awayWin)).toBeLessThan(5); // proches
    expect(mk.draw).toBeGreaterThan(mk.homeWin * 0.6); // lambda proches → nul significatif
  });
  test("favori λ=2.0/0.8 → homeWin > 50", () => {
    const mk = marketsFromMatrix(buildScoreMatrix(2.0, 0.8));
    expect(mk.homeWin).toBeGreaterThan(50);
  });
  test("markets cohérents (1X2=100, topScores=5, btts<100)", () => {
    const mk = marketsFromMatrix(buildScoreMatrix(1.35, 1.1));
    expect(mk.homeWin + mk.draw + mk.awayWin).toBeCloseTo(100, 1); // round2 accumulation
    expect(mk.topScores).toHaveLength(5);
    expect(mk.btts).toBeGreaterThan(0);
    expect(mk.btts).toBeLessThan(100);
    expect(mk.over25).toBeGreaterThan(0);
  });
  test("poissonMarkets expose cornersOver quand λ total > 0", () => {
    const mk = poissonMarkets(1.35, 1.1);
    expect(mk.cornersOver).not.toBeNull();
    expect(mk.cornersOver!.prob).toBeGreaterThan(0);
  });
});