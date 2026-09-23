// Tests intégrité catalog ligues basket (1xbet) + clés cotes — debug 2026-09-23

import { describe, test, expect } from "bun:test";
import {
  LEAGUE_CONFIGS,
  getAllLeagueIds,
  getLeagueConfig,
  getLeagueGroup,
  getLeaguesByGroup,
  ESPN_LEAGUES,
  GROUP_ORDER,
  type LeagueGroup,
} from "../basketball-league-config";

describe("catalog ligues basket", () => {
  test("≥ 30 ligues (couverture ligne 1xbet)", () => {
    expect(getAllLeagueIds().length).toBeGreaterThanOrEqual(30);
  });

  test("chaque ligue a label, shortLabel, country, group, hasFeed bool", () => {
    for (const id of getAllLeagueIds()) {
      const cfg = getLeagueConfig(id);
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.shortLabel.length).toBeGreaterThan(0);
      expect(cfg.country.length).toBeGreaterThan(0);
      expect(typeof cfg.hasFeed).toBe("boolean");
      expect(GROUP_ORDER).toContain(cfg.group);
    }
  });

  test("shortLabel unique (chips sélecteur)", () => {
    const shorts = getAllLeagueIds().map((id) => getLeagueConfig(id).shortLabel);
    expect(new Set(shorts).size).toBe(shorts.length);
  });

  test("GROUP_ORDER couvre toutes les ligues via getLeaguesByGroup", () => {
    const covered = new Set(GROUP_ORDER.flatMap((g) => getLeaguesByGroup(g)));
    for (const id of getAllLeagueIds()) {
      expect(covered.has(id)).toBe(true);
      expect(getLeagueGroup(id)).toBe(getLeagueConfig(id).group);
    }
  });

  test("exactement les feeds câblés marqués hasFeed (nba/wnba/euroleague/eurocup)", () => {
    const feed = getAllLeagueIds().filter((id) => getLeagueConfig(id).hasFeed).sort();
    expect(feed).toEqual(["eurocup", "euroleague", "nba", "wnba"]);
    expect(ESPN_LEAGUES).toEqual(["nba", "wnba"]);
  });

  test("présence des ligues majeures 1xbet", () => {
    for (const id of ["ncaa", "nbl", "cba", "kbl", "bcl", "olympics", "nbb", "pba", "bal"] as const) {
      expect(getAllLeagueIds()).toContain(id);
    }
  });
});

describe("types groupes", () => {
  test("GROUP_ORDER est dans le type LeagueGroup", () => {
    const order: LeagueGroup[] = GROUP_ORDER;
    expect(order.length).toBeGreaterThanOrEqual(5);
  });
});
