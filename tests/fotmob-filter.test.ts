import { describe, expect, test } from "bun:test";
import {
  filterByKickoffWindow,
  matchDayLabel,
  parisTodayKey,
  shiftDateKey,
} from "@/lib/fotmob-filter";

describe("shiftDateKey", () => {
  test("décale jour -1/+1 (borne de mois)", () => {
    expect(shiftDateKey("2026-09-08", -1)).toBe("2026-09-07");
    expect(shiftDateKey("2026-09-08", 1)).toBe("2026-09-09");
    expect(shiftDateKey("2026-09-01", -1)).toBe("2026-08-31");
  });
});

describe("parisTodayKey", () => {
  test("clé Paris pour un instant fixe", () => {
    // 2026-09-08T10:00:00Z = 12:00 à Paris (UTC+2) → même jour.
    expect(parisTodayKey(new Date("2026-09-08T10:00:00Z"))).toBe("2026-09-08");
    // 2026-09-08T23:30:00Z = 01:30 à Paris le 09 → jour suivant.
    expect(parisTodayKey(new Date("2026-09-08T23:30:00Z"))).toBe("2026-09-09");
  });
});

describe("matchDayLabel", () => {
  test("Aujourd'hui / Demain / date", () => {
    expect(matchDayLabel("2026-09-08", "2026-09-08")).toBe("Aujourd’hui");
    expect(matchDayLabel("2026-09-09", "2026-09-08")).toBe("Demain");
    expect(matchDayLabel("2026-09-10", "2026-09-08")).not.toBe("Aujourd’hui");
  });
});

describe("filterByKickoffWindow", () => {
  const at = (iso: string, live = false) => ({
    id: iso, scheduledAt: iso, home: { name: "A" }, away: { name: "B" },
    live: live ? { status: "LIVE", minute: 10 } : null,
  });
  const now = new Date("2026-09-08T18:00:00Z");

  test("live toujours gardé, prematch dans la fenêtre", () => {
    const ms = [
      at("2026-09-08T17:00:00Z", true), // live, kickoff passé
      at("2026-09-08T19:00:00Z"), // +1h
      at("2026-09-08T23:00:00Z"), // +5h
    ];
    const out = filterByKickoffWindow(ms, 2, now);
    expect(out.map((x) => x.id)).toEqual(["2026-09-08T17:00:00Z", "2026-09-08T19:00:00Z"]);
  });

  test("null = tout", () => {
    const ms = [at("2026-09-08T19:00:00Z"), at("2026-09-09T19:00:00Z")];
    expect(filterByKickoffWindow(ms, null, now)).toHaveLength(2);
  });
});
