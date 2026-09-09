import { describe, expect, test } from "bun:test";
import { simulateTable, trajectory } from "@/lib/table-projection";

const T = (id: string, points: number, gf = 10, ga = 10, played = 10) => ({
  id, name: id, played, points, gf, ga,
});

describe("simulateTable", () => {
  test("sans matchs restants : exp=current, best=worst=rang", () => {
    const r = simulateTable(
      [T("a", 20), T("b", 10), T("c", 5)],
      [], 200
    );
    expect(r.a.expPts).toBe(20);
    expect(r.a.best).toBe(1);
    expect(r.a.worst).toBe(1);
    expect(r.c.best).toBe(3);
    expect(r.c.expRank).toBeCloseTo(3, 0);
  });

  test("favori écrasant → titleProb ≈ 1, somme ≈ 1", () => {
    const strong = { ...T("s", 0, 60, 5, 10), played: 10 };
    const weak = { ...T("w", 0, 5, 60, 10), played: 10 };
    const fx = [{ homeId: "s", awayId: "w" }];
    const r = simulateTable([strong, weak], fx, 500);
    expect(r.s.titleProb).toBeGreaterThan(0.9);
    expect(r.s.titleProb + r.w.titleProb).toBeGreaterThan(0.99);
    expect(r.s.titleProb + r.w.titleProb).toBeLessThanOrEqual(1.001);
    // Top 4 : avec 2 équipes, rang ≤ 4 toujours vrai.
    expect(r.s.top4Prob).toBe(1);
    expect(r.w.top4Prob).toBe(1);
    // Relégation = dernier du mini-championnat → w relégué quasi sûrement.
    expect(r.w.relegProb).toBeGreaterThan(0.9);
    expect(r.s.relegProb).toBeLessThan(0.1);
  });
});

describe("trajectory", () => {
  test("positions cumulées par journée", () => {
    const fin = [
      { round: 1, homeId: "a", awayId: "b", hs: 2, as: 0 },
      { round: 2, homeId: "b", awayId: "a", hs: 1, as: 1 },
    ];
    const t = trajectory(fin, ["a", "b"]);
    // J1 : a 3pts (1er), b 0pt (2e). J2 : a 4pts (1er), b 1pt (2e).
    expect(t.a).toEqual([1, 1]);
    expect(t.b).toEqual([2, 2]);
  });
});
