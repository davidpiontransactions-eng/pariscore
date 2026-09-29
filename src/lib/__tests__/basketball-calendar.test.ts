// Tests — lib basketball-calendar (merge 4 sources → FotmobCalMatch)
// Calendrier Basket sous-onglet : mapping, tri chrono, dédup, garde-fou date Paris.

import { describe, test, expect } from "bun:test";
import {
  parisDateKeyOf,
  espnStateToCalLive,
  espnBbToCal,
  euroBbToCal,
  fibaBbToCal,
  buildBasketballCalendar,
} from "../../lib/basketball-calendar";

describe("parisDateKeyOf", () => {
  test("ISO UTC → clé jour Paris (22:30Z = lendemain à Paris)", () => {
    expect(parisDateKeyOf("2026-09-29T22:30:00Z")).toBe("2026-09-30");
  });

  test("date invalide → '' (jamais de throw)", () => {
    expect(parisDateKeyOf("pas-une-date")).toBe("");
  });
});

describe("espnStateToCalLive", () => {
  test("'in' → LIVE + scores", () => {
    expect(
      espnStateToCalLive({ id: "1", status: "in", home: { score: 12 }, away: { score: 10 } }),
    ).toEqual({ status: "LIVE", homeScore: 12, awayScore: 10 });
  });

  test("'post' → FT", () => {
    expect(espnStateToCalLive({ id: "1", status: "post", home: { score: 100 }, away: { score: 98 } })).toEqual({
      status: "FT",
      homeScore: 100,
      awayScore: 98,
    });
  });

  test("'pre'/absent → null", () => {
    expect(espnStateToCalLive({ id: "1", status: "pre" })).toBeNull();
    expect(espnStateToCalLive({ id: "1" })).toBeNull();
  });
});

describe("espnBbToCal / euroBbToCal / fibaBbToCal", () => {
  test("ESPN : préfixe ligue + logos + league", () => {
    const m = espnBbToCal(
      { id: 42, date: "2026-10-01T23:00:00Z", status: "pre", home: { name: "Celtics", logo: "h.png" }, away: { name: "Knicks" } },
      { id: "nba", name: "NBA", country: "USA" },
    );
    expect(m.id).toBe("nba-42");
    expect(m.league).toEqual({ id: "nba", name: "NBA", country: "USA", logo: null });
    expect(m.home).toEqual({ name: "Celtics", logo: "h.png" });
    expect(m.live).toBeNull();
  });

  test("Euro : live / finished / scheduled + round", () => {
    expect(euroBbToCal({ id: 1, status: "live", homeScore: 55, awayScore: 50 }, { id: "euroleague", name: "EuroLeague" }).live).toEqual({
      status: "LIVE",
      homeScore: 55,
      awayScore: 50,
    });
    expect(euroBbToCal({ id: 2, status: "finished", homeScore: 80, awayScore: 77 }, { id: "eurocup", name: "EuroCup" }).live).toEqual({
      status: "FT",
      homeScore: 80,
      awayScore: 77,
    });
    const sched = euroBbToCal({ id: 3, status: "scheduled", round: 4, startTime: "2026-10-02T18:30:00Z" }, { id: "euroleague", name: "EuroLeague" });
    expect(sched.live).toBeNull();
    expect(sched.round).toBe("J4");
  });

  test("FIBA : groupe dans le libellé ligue", () => {
    const m = fibaBbToCal({ id: "e1", date: "2026-09-26T14:00:00Z", status: "pre", group: "B", home: { name: "France" }, away: { name: "Espagne" } });
    expect(m.league?.name).toBe("FIBA WC — Groupe B");
    expect(m.id).toBe("fiba-e1");
  });
});

describe("buildBasketballCalendar", () => {
  const nba = [
    { id: "a1", date: "2026-10-01T00:30:00Z", status: "pre", home: { name: "BOS" }, away: { name: "NYK" } },
    // doublon cross-source : même id après préfixe NBA (recouvrement) → dédup
    { id: "a1", date: "2026-10-01T00:30:00Z", status: "pre", home: { name: "BOS" }, away: { name: "NYK" } },
    // autre jour → écarté par le garde-fou date
    { id: "a2", date: "2026-10-05T23:00:00Z", status: "pre", home: { name: "MIA" }, away: { name: "LAL" } },
  ];
  const wnba = [{ id: "w1", date: "2026-10-01T20:00:00Z", status: "in", home: { name: "LAS", score: 30 }, away: { name: "CON", score: 28 } }];
  const euro = [
    { id: "e1", startTime: "2026-10-01T18:30:00Z", status: "scheduled", round: 3 },
    // pas d'horaire → non affichable dans un calendrier
    { id: "e2", startTime: "", status: "scheduled" },
  ];
  const eurocup = [{ id: "c1", startTime: "2026-10-01T19:00:00Z", status: "scheduled" }];
  const fiba = [{ id: "f1", date: "2026-10-01T16:00:00Z", status: "post", home: { name: "FRA", score: 71 }, away: { name: "ESP", score: 69 } }];

  test("merge 4 sources, dédup, filtre date, tri chronologique", () => {
    const out = buildBasketballCalendar("2026-10-01", { nba, wnba, euroleague: euro, eurocup, fiba });
    // a1 (dédup) + a2 (autre jour) + e2 (sans horaire) écartés
    expect(out.map((m) => m.id)).toEqual(["nba-a1", "fiba-f1", "euroleague-e1", "eurocup-c1", "wnba-w1"]);
    // tri chrono croissant
    const times = out.map((m) => m.scheduledAt);
    expect([...times].sort()).toEqual(times);
  });

  test("sources vides/absentes → []", () => {
    expect(buildBasketballCalendar("2026-10-01", {})).toEqual([]);
    expect(buildBasketballCalendar("2026-10-01", { nba: [] })).toEqual([]);
  });

  test("clé date invalide → aucun match gardé (tous filtrés)", () => {
    expect(buildBasketballCalendar("bad-date", { wnba })).toEqual([]);
  });
});
