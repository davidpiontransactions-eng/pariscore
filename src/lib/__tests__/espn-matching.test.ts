import { describe, expect, test } from "bun:test";
import { namesMatch, leagueToEspnSlug } from "../espn-soccer-fetcher";
import { isBsdLiveStatus } from "../bsd-football-fetcher";

describe("namesMatch (H2 AUDIT-2026-09-09)", () => {
  test("égalités et inclusions exactes", () => {
    expect(namesMatch("Gwangju FC", "Gwangju")).toBe(true);
    expect(namesMatch("Arsenal", "Arsenal")).toBe(true);
    expect(namesMatch("FC Porto", "Porto")).toBe(true);
  });
  test("alias KR/JP", () => {
    expect(namesMatch("Jeju SK", "Jeju United")).toBe(true);
    expect(namesMatch("Ulsan HD", "Ulsan Hyundai")).toBe(true);
    expect(namesMatch("FC Seoul", "Seoul")).toBe(true);
  });
  test("abréviation documentée", () => {
    expect(namesMatch("Man United", "Manchester United")).toBe(true);
  });
  test("faux positifs rivaux bloqués", () => {
    expect(namesMatch("Manchester United", "Newcastle United")).toBe(false);
    expect(namesMatch("Real Madrid", "Atletico Madrid")).toBe(false);
    expect(namesMatch("Manchester City", "Leicester City")).toBe(false);
  });
});

describe("leagueToEspnSlug (T2)", () => {
  test("ids BSD prioritaires", () => {
    expect(leagueToEspnSlug(50)).toBe("kor.1");
    expect(leagueToEspnSlug(49)).toBe("jpn.1");
    expect(leagueToEspnSlug(1)).toBe("eng.1");
  });
  test("repli legacy + null", () => {
    expect(leagueToEspnSlug(292)).toBe("kor.1");
    expect(leagueToEspnSlug(null)).toBeNull();
    expect(leagueToEspnSlug(999999)).toBeNull();
  });
});

describe("isBsdLiveStatus (H1 AUDIT-2026-09-09)", () => {
  test("live reconnus", () => {
    for (const s of ["1H", "2H", "HT", "LIVE", "live"]) expect(isBsdLiveStatus(s)).toBe(true);
  });
  test("non-live rejetés", () => {
    for (const s of ["finished", "notstarted", "canceled", "cancelled", "postponed", "suspended", "FT", "AET", "PEN", "abandoned", "walkover", "", null]) {
      expect(isBsdLiveStatus(s)).toBe(false);
    }
  });
});
