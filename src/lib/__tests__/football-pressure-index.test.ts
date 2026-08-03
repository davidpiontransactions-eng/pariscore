import { describe, test, expect } from "bun:test";
import {
  buildPressureTimeline,
  bucketMomentum,
  type PressureBucketInput,
} from "../football-pressure-index";

const neutral = (start: number): PressureBucketInput => ({
  start,
  danger: { home: 0, away: 0 },
  corners: { home: 0, away: 0 },
  sot: { home: 0, away: 0 },
  xg: { home: 0, away: 0 },
});

// ─── bucketMomentum : signe et plage ───────────────────────────────────────

describe("bucketMomentum", () => {
  test("home domination → valeur positive", () => {
    const m = bucketMomentum({
      start: 0,
      danger: { home: 8, away: 1 },
      corners: { home: 3, away: 0 },
      sot: { home: 2, away: 0 },
      xg: { home: 0.4, away: 0.05 },
    });
    expect(m).toBeGreaterThan(0);
    expect(Math.abs(m)).toBeLessThanOrEqual(100);
  });

  test("away domination → valeur négative", () => {
    const m = bucketMomentum({
      start: 0,
      danger: { home: 0, away: 7 },
      corners: { home: 0, away: 2 },
      sot: { home: 0, away: 3 },
      xg: { home: 0.02, away: 0.5 },
    });
    expect(m).toBeLessThan(0);
  });

  test("équilibre → proche de zéro", () => {
    const m = bucketMomentum({ start: 0, danger: { home: 3, away: 3 } });
    expect(Math.abs(m)).toBeLessThanOrEqual(20);
  });
});

// ─── buildPressureTimeline ─────────────────────────────────────────────────

describe("buildPressureTimeline", () => {
  test("courbe moteur par-minute sur buckets (source espn)", () => {
    const buckets = [
      { ...neutral(0), danger: { home: 10, away: 1 } },
      { ...neutral(5), danger: { home: 2, away: 8 } },
      { ...neutral(10), danger: { home: 6, away: 3 } },
    ];
    const data = buildPressureTimeline({
      buckets,
      events: [],
      source: "espn",
    });
    expect(data.momentum.length).toBeGreaterThanOrEqual(3);
    expect(data.layers.perMinute).toBe(true);
    expect(data.layers.dangerous).toBe(true);
    expect(data.layers.corners).toBe(false);
    expect(data.layers.goals).toBe(false);
    for (const p of data.momentum) {
      expect(Math.abs(p.value)).toBeLessThanOrEqual(100);
      expect(p.homePressure).toBeGreaterThanOrEqual(0);
      expect(p.homePressure).toBeLessThanOrEqual(100);
    }
  });

  test("reconcile : blend 0.55/0.45 avec l'anchor BSD quand présent", () => {
    const buckets = [{ ...neutral(0), danger: { home: 9, away: 1 } }];
    const data = buildPressureTimeline({
      buckets,
      events: [],
      bsdMomentum: [
        { minute: 0, value: 40 },
        { minute: 2, value: 40 },
        { minute: 4, value: 40 },
      ],
      source: "bsd+espn",
    });
    expect(data.momentum[0].value).toBeGreaterThan(0);
  });

  test("anchor BSD seul → courbe par moyennes, sans buckets", () => {
    const data = buildPressureTimeline({
      buckets: [],
      events: [],
      bsdMomentum: [
        { minute: 1, value: 20 },
        { minute: 6, value: -30 },
        { minute: 11, value: 10 },
      ],
      source: "bsd",
    });
    expect(data.layers.perMinute).toBe(true);
    expect(data.momentum.length).toBeGreaterThan(0);
  });

  test("fallback totaux → courbe lissée, perMinute=false", () => {
    const data = buildPressureTimeline({
      buckets: [],
      events: [],
      totals: {
        possession: { home: 55, away: 45 },
        shots: { home: 14, away: 8 },
        sot: { home: 6, away: 3 },
        corners: { home: 7, away: 3 },
      },
      source: "bsd",
    });
    expect(data.layers.perMinute).toBe(false);
    expect(data.momentum.length).toBe(18);
  });

  test("buts → score cumulé + layer goals", () => {
    const data = buildPressureTimeline({
      buckets: [],
      events: [
        { minute: 12, kind: "goal", side: "home", scorer: null, teamName: null, xg: null, score: null },
        { minute: 34, kind: "goal", side: "away", scorer: null, teamName: null, xg: null, score: null },
        { minute: 60, kind: "goal", side: "home", scorer: null, teamName: null, xg: null, score: null },
      ],
      bsdMomentum: [
        { minute: 1, value: 0 },
        { minute: 60, value: 0 },
      ],
      source: "bsd",
    });
    expect(data.layers.goals).toBe(true);
    const goals = data.events.filter((e) => e.kind === "goal");
    expect(goals).toHaveLength(3);
    expect(goals[0].score).toEqual({ home: 1, away: 0 });
    expect(goals[1].score).toEqual({ home: 1, away: 1 });
    expect(goals[2].score).toEqual({ home: 2, away: 1 });
  });

  test("pression = % de temps de domination (seuil ±5)", () => {
    const buckets = [
      { ...neutral(0), danger: { home: 8, away: 1 } },
      { ...neutral(5), danger: { home: 8, away: 1 } },
      { ...neutral(10), danger: { home: 0, away: 8 } },
    ];
    const data = buildPressureTimeline({ buckets, events: [], source: "espn" });
    expect(data.pressure.homePct + data.pressure.awayPct).toBe(100);
    expect(data.pressure.homePct).toBeGreaterThan(0);
  });
});