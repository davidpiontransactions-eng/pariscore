import { describe, test, expect } from "bun:test";
import {
  extractTournaments,
  filterByTournament,
  filterByTimeWindow,
  TENNIS_TIME_WINDOWS,
} from "../tennis-filters";
import { TENNIS_STRATEGY_DEFS } from "../tennis-strategy-top10";
import type { TennisStrategyKey } from "../tennis-strategy-top10";

// ─── Tournament filter extraction ──────────────────────────────────────────

describe("tennis top10 — tournament filter", () => {
  test("extractTournaments returns unique sorted tournaments from matches", () => {
    const matches = [
      { tournament: "Roland Garros", scheduledAt: "2026-06-01T10:00:00Z" },
      { tournament: "Wimbledon", scheduledAt: "2026-07-01T10:00:00Z" },
      { tournament: "Roland Garros", scheduledAt: "2026-06-02T10:00:00Z" },
      { tournament: "US Open", scheduledAt: "2026-08-01T10:00:00Z" },
    ];

    const tournaments = extractTournaments(matches);

    expect(tournaments).toEqual(["Roland Garros", "US Open", "Wimbledon"]);
  });

  test("extractTournaments handles empty array", () => {
    const tournaments = extractTournaments([]);
    expect(tournaments).toEqual([]);
  });

  test("filterByTournament returns all matches when tournament is null", () => {
    const matches = [
      { tournament: "Roland Garros" },
      { tournament: "Wimbledon" },
    ];
    const filtered = filterByTournament(matches, null);
    expect(filtered).toHaveLength(2);
  });

  test("filterByTournament filters by exact tournament name", () => {
    const matches = [
      { tournament: "Roland Garros" },
      { tournament: "Wimbledon" },
      { tournament: "Roland Garros" },
    ];
    const filtered = filterByTournament(matches, "Roland Garros");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((m) => m.tournament === "Roland Garros")).toBe(true);
  });
});

// ─── Time window filter ────────────────────────────────────────────────────

describe("tennis top10 — time window filter", () => {
  test("filterByTimeWindow returns all matches for 'all'", () => {
    const matches = [
      { scheduledAt: "2026-06-01T10:00:00Z" },
      { scheduledAt: "2026-06-02T10:00:00Z" },
    ];
    const filtered = filterByTimeWindow(matches, "all");
    expect(filtered).toHaveLength(2);
  });

  test("filterByTimeWindow returns today matches for 'jour'", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matches = [
      { scheduledAt: today.toISOString() },
      { scheduledAt: new Date(today.getTime() + 86400000).toISOString() },
    ];
    const filtered = filterByTimeWindow(matches, "jour");
    expect(filtered).toHaveLength(1);
  });

  test("filterByTimeWindow returns 48h matches for '48h'", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matches = [
      { scheduledAt: today.toISOString() },
      { scheduledAt: new Date(today.getTime() + 86400000).toISOString() },
      { scheduledAt: new Date(today.getTime() + 172800000).toISOString() },
      { scheduledAt: new Date(today.getTime() + 259200000).toISOString() },
    ];
    const filtered = filterByTimeWindow(matches, "48h");
    expect(filtered).toHaveLength(2);
  });

  test("filterByTimeWindow returns week matches for 'semaine'", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const matches = [
      { scheduledAt: today.toISOString() },
      { scheduledAt: new Date(today.getTime() + 6 * 86400000).toISOString() },
      { scheduledAt: new Date(today.getTime() + 8 * 86400000).toISOString() },
    ];
    const filtered = filterByTimeWindow(matches, "semaine");
    expect(filtered).toHaveLength(2);
  });
});

// ─── Strategy definitions ──────────────────────────────────────────────────

describe("tennis top10 — strategy definitions", () => {
  test("all 9 strategies are defined", () => {
    expect(TENNIS_STRATEGY_DEFS).toHaveLength(9);
  });

  test("each strategy has required fields", () => {
    for (const def of TENNIS_STRATEGY_DEFS) {
      expect(def.key).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.emoji).toBeTruthy();
      expect(typeof def.threshold).toBe("number");
      expect(typeof def.format).toBe("function");
    }
  });

  test("strategy keys match TennisStrategyKey type", () => {
    const keys = TENNIS_STRATEGY_DEFS.map((d) => d.key);
    expect(keys).toContain("surfaceEloGap");
    expect(keys).toContain("momentum");
    expect(keys).toContain("serveHold");
    expect(keys).toContain("returnEfficacy");
    expect(keys).toContain("fatigue");
    expect(keys).toContain("underdogValue");
    expect(keys).toContain("over215");
    expect(keys).toContain("under215");
    expect(keys).toContain("favorite20");
  });
});

// ─── Time windows UI config ────────────────────────────────────────────────

describe("tennis top10 — time windows UI config", () => {
  test("TENNIS_TIME_WINDOWS has 4 entries", () => {
    expect(TENNIS_TIME_WINDOWS).toHaveLength(4);
  });

  test("time windows include all/jour/48h/semaine", () => {
    const keys = TENNIS_TIME_WINDOWS.map((w) => w.key);
    expect(keys).toContain("all");
    expect(keys).toContain("jour");
    expect(keys).toContain("48h");
    expect(keys).toContain("semaine");
  });

  test("each time window has label and title", () => {
    for (const w of TENNIS_TIME_WINDOWS) {
      expect(w.label).toBeTruthy();
      expect(w.title).toBeTruthy();
    }
  });
});
