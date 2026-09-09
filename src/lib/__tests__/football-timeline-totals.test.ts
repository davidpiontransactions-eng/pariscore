import { describe, test, expect } from "bun:test";
import { buildPressureTimeline } from "../football-pressure-index";
import type { TimelineTotals } from "../football-timeline";

// Session 2026-09-09 (popup live Veikkausliiga) : buildPressureTimeline doit
// exposer les totaux boxscore + xG cumulés pour le fallback métriques du popup.

const TOTALS: TimelineTotals = {
  possession: { home: 55, away: 45 },
  corners: { home: 5, away: 2 },
  shots: { home: 10, away: 6 },
  sot: { home: 4, away: 2 },
};

describe("buildPressureTimeline — totals/xgTotals (fallback popup live)", () => {
  test("passthrough des totaux boxscore", () => {
    const out = buildPressureTimeline({ buckets: [], events: [], totals: TOTALS, source: "estimated" });
    expect(out.totals).toEqual(TOTALS);
    expect(out.xgTotals).toBeUndefined();
  });

  test("xgTotals = somme des buckets xG (arrondi 2 décimales)", () => {
    const out = buildPressureTimeline({
      buckets: [
        { start: 0, danger: { home: 10, away: 0 }, xg: { home: 0.3, away: 0.2 } },
        { start: 5, danger: { home: 0, away: 8 }, xg: { home: 0.5, away: 0.1 } },
      ],
      events: [],
      totals: TOTALS,
      source: "espn",
    });
    expect(out.xgTotals).toEqual({ home: 0.8, away: 0.3 });
    expect(out.totals).toEqual(TOTALS);
  });

  test("xgTotals undefined quand aucun xG de bucket", () => {
    const out = buildPressureTimeline({
      buckets: [{ start: 0, danger: { home: 12, away: 9 } }],
      events: [],
      source: "espn",
    });
    expect(out.xgTotals).toBeUndefined();
    expect(out.totals).toBeUndefined();
  });

  test("aucun crash sur buckets vides — courbe estimée + totaux conservés", () => {
    const out = buildPressureTimeline({ buckets: [], events: [], totals: TOTALS, source: "estimated", finalMinute: 45 });
    expect(out.momentum.length).toBeGreaterThan(0);
    expect(out.layers.perMinute).toBe(false);
    expect(out.totals).toEqual(TOTALS);
  });
});
