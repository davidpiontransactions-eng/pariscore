import { describe, expect, test } from "bun:test";
import { eloBarForMatch } from "@/lib/elo-bar";

describe("eloBarForMatch", () => {
  test("barre 1X2 normalisée, favori devant", () => {
    const r = eloBarForMatch({ homeOdds: 1.4, drawOdds: 4.5, awayOdds: 7.0 });
    expect(r.home + r.draw + r.away).toBeGreaterThan(99);
    expect(r.home + r.draw + r.away).toBeLessThanOrEqual(100.5);
    expect(r.home).toBeGreaterThan(r.away);
    expect(r.home).toBeGreaterThan(50);
  });

  test("sans cotes : valeurs finies sommant ≈ 100", () => {
    const r = eloBarForMatch({});
    const sum = r.home + r.draw + r.away;
    expect(Number.isFinite(sum)).toBe(true);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThanOrEqual(100.5);
  });
});
