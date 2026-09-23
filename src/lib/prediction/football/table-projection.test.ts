import { describe, expect, test } from "bun:test";
import { adjustedLambda, projectLeagueTable, type TeamRating } from "./table-projection";

const mk = (id: string, gf: number, ga: number, extra: Partial<TeamRating> = {}): TeamRating => ({
  id,
  name: id.toUpperCase(),
  gf,
  ga,
  points: 0,
  played: 0,
  goalDiff: 0,
  ...extra,
});

describe("adjustedLambda", () => {
  test("λ équipes moyennes à domicile ≈ 1.35 × 1.15", () => {
    const l = adjustedLambda(mk("a", 1.35, 1.35), mk("b", 1.35, 1.35), true, { xgWeight: 0 });
    expect(l).toBeGreaterThan(1.3);
    expect(l).toBeLessThan(1.8);
  });

  test("attaque forte vs défense faible → λ haut", () => {
    const strong = adjustedLambda(mk("a", 2.5, 0.8), mk("b", 0.8, 2.5), true, { xgWeight: 0 });
    const weak = adjustedLambda(mk("a", 0.8, 2.5), mk("b", 2.5, 0.8), true, { xgWeight: 0 });
    expect(strong).toBeGreaterThan(weak * 1.5);
  });

  test("blend xG 70/30 pousse λ vers le xG", () => {
    const t = mk("a", 1.0, 1.0, { xgFor: 2.0, xgAgainst: 1.0 });
    const o = mk("b", 1.0, 1.0);
    const l = adjustedLambda(t, o, true, { xgWeight: 0.7 });
    // 0.7×2.0 + 0.3×1.0 = 1.7 d'attaque vs 1.0 sans xG
    expect(l).toBeGreaterThan(adjustedLambda({ ...t, xgFor: null }, o, true, { xgWeight: 0.7 }));
  });

  test("homeAdv spécifique équipe respecté", () => {
    const t = mk("a", 1.35, 1.35, { homeAdv: 1.4 });
    const o = mk("b", 1.35, 1.35);
    const lHigh = adjustedLambda(t, o, true);
    const lLow = adjustedLambda({ ...t, homeAdv: 1.0 }, o, true);
    expect(lHigh).toBeGreaterThan(lLow);
  });
});

describe("projectLeagueTable", () => {
  test("saison complète déterministe (seed) — points cohérents", () => {
    const teams = [
      mk("favo", 2.2, 0.8),
      mk("moy", 1.35, 1.35),
      mk("faib", 0.8, 2.0),
    ];
    const fixtures = [
      { home: "favo", away: "faib" },
      { home: "moy", away: "favo" },
      { home: "faib", away: "moy" },
      { home: "favo", away: "moy" },
      { home: "faib", away: "favo" },
      { home: "moy", away: "faib" },
    ];
    const r1 = projectLeagueTable(teams, fixtures, { sims: 500, seed: 7 });
    const r2 = projectLeagueTable(teams, fixtures, { sims: 500, seed: 7 });
    expect(r1.projections).toEqual(r2.projections);

    const favo = r1.projections.find((p) => p.id === "favo")!;
    const faib = r1.projections.find((p) => p.id === "faib")!;
    expect(favo.titleProb).toBeGreaterThan(faib.titleProb);
    expect(faib.relegationProb).toBeGreaterThanOrEqual(favo.relegationProb);
    // 6 matchs × 3 pts = max 18 pts
    expect(favo.avgPts).toBeGreaterThan(5);
    expect(favo.avgPts).toBeLessThanOrEqual(18);
  });

  test("probabilités somment ≈ 100% titre", () => {
    const teams = [mk("a", 1.35, 1.35), mk("b", 1.35, 1.35)];
    const fixtures = [{ home: "a", away: "b" }, { home: "b", away: "a" }];
    const r = projectLeagueTable(teams, fixtures, { sims: 400, seed: 1 });
    const totalTitle = r.projections.reduce((s, p) => s + p.titleProb, 0);
    expect(totalTitle).toBeGreaterThan(98);
    expect(totalTitle).toBeLessThan(102);
  });
});
