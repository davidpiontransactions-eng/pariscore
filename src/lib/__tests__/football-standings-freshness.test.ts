import { describe, it, expect } from "bun:test";
import { STANDINGS_TTL } from "@/lib/bsd-football-fetcher";
import type { StandingContext } from "@/lib/football-data";

describe("ParisScorebis-asqo — fraîcheur Classement (Dom/Ext) prematch", () => {
  it("TTL du cache standings ≤ 30 min (régression : était 6h, figerait le classement)", () => {
    expect(STANDINGS_TTL).toBeLessThanOrEqual(30 * 60 * 1000);
    // sanity : toujours défini au bon ordre de grandeur
    expect(STANDINGS_TTL).toBeGreaterThan(0);
  });

  it("StandingContext transporte l'horodatage asOf (pour afficher l'âge)", () => {
    const ctx: StandingContext = {
      home: {} as StandingContext["home"],
      away: {} as StandingContext["away"],
      asOf: "2026-08-29T12:00:00.000Z",
    };
    expect(ctx.asOf).toBe("2026-08-29T12:00:00.000Z");
  });
});