// Tests moteur stratégies handball — bun:test
// Sanity checks sur computeHandballStrategyTop8

import { describe, test, expect } from "bun:test";
import { computeHandballStrategyTop8, buildFormStore, HANDBALL_STRATEGY_DEFS } from "../handball-strategy-top8";
import type { HandballMatch } from "../handball-data";

// Données mock
function mockMatch(overrides: Partial<HandballMatch> = {}): HandballMatch {
  return {
    id: Math.floor(Math.random() * 100000),
    league: { id: 1, name: "Starligue", country: "France", countryCode: "FR" },
    home: { id: 100, name: "Paris Saint-Germain", shortName: "PSG" },
    away: { id: 200, name: "HBC Nantes", shortName: "Nantes" },
    kickoff: new Date(Date.now() + 3600_000).toISOString(),
    status: "not_started",
    odds: { home: 1.45, draw: 9.0, away: 3.2 },
    ...overrides,
  };
}

function mockFinished(homeGoals: number, awayGoals: number, homeHalf?: number, awayHalf?: number): HandballMatch {
  return mockMatch({
    status: "finished",
    score: { home: homeGoals, away: awayGoals, homeHalf, awayHalf },
  });
}

describe("buildFormStore", () => {
  test("construit le store depuis matchs terminés", () => {
    const finished = [
      mockFinished(30, 25, 15, 12),
      mockFinished(28, 28, 14, 14),
      mockFinished(32, 22, 16, 10),
    ];
    const store = buildFormStore(finished);
    expect(store.has("100")).toBe(true);
    expect(store.has("200")).toBe(true);
    const psg = store.get("100")!;
    expect(psg.wins).toBe(2);
    expect(psg.draws).toBe(1);
    expect(psg.losses).toBe(0);
  });

  test("store vide si aucun match terminé", () => {
    const store = buildFormStore([]);
    expect(store.size).toBe(0);
  });
});

describe("computeHandballStrategyTop8", () => {
  const finished = [
    mockFinished(30, 25, 15, 12),
    mockFinished(28, 28, 14, 14),
    mockFinished(32, 22, 16, 10),
    mockFinished(27, 30, 13, 16),
    mockFinished(35, 20, 18, 10),
  ];

  const fixtures = [
    mockMatch({ id: 1001, odds: { home: 1.45, draw: 9.0, away: 3.2 } }),
    mockMatch({ id: 1002, odds: { home: 2.1, draw: 7.0, away: 1.8 } }),
  ];

  test("retourne 8 stratégies", () => {
    const result = computeHandballStrategyTop8(finished, fixtures);
    expect(Object.keys(result.strategies)).toHaveLength(8);
  });

  test("chaclé stratégie est une array", () => {
    const result = computeHandballStrategyTop8(finished, fixtures);
    for (const key of Object.keys(HANDBALL_STRATEGY_DEFS)) {
      expect(Array.isArray(result.strategies[key as keyof typeof result.strategies])).toBe(true);
    }
  });

  test("bestTeam retourne des entries avec pick home/away", () => {
    const result = computeHandballStrategyTop8(finished, fixtures);
    const bestTeam = result.strategies.bestTeam;
    for (const entry of bestTeam) {
      if (entry.pick) expect(["home", "away"]).toContain(entry.pick);
      expect(entry.value).toBeGreaterThan(0);
    }
  });

  test("over55 retourne des probabilités 0-100", () => {
    const result = computeHandballStrategyTop8(finished, fixtures);
    const over55 = result.strategies.over55;
    for (const entry of over55) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
      expect(entry.value).toBeLessThanOrEqual(100);
    }
  });

  test("entries triées par value décroissante", () => {
    const result = computeHandballStrategyTop8(finished, fixtures);
    for (const key of Object.keys(result.strategies)) {
      const entries = result.strategies[key as keyof typeof result.strategies];
      if (entries.length > 1) {
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i - 1].value).toBeGreaterThanOrEqual(entries[i].value - 1e-9);
        }
      }
    }
  });

  test("limit fonctionne", () => {
    const result = computeHandballStrategyTop8(finished, fixtures, { limit: 3 });
    for (const key of Object.keys(result.strategies)) {
      expect(result.strategies[key as keyof typeof result.strategies].length).toBeLessThanOrEqual(3);
    }
  });

  test("computedAt est une date ISO valide", () => {
    const result = computeHandballStrategyTop8(finished, fixtures);
    expect(new Date(result.computedAt).getTime()).not.toBeNaN();
  });
});

describe("HANDBALL_STRATEGY_DEFS", () => {
  test("8 stratégies définies", () => {
    expect(Object.keys(HANDBALL_STRATEGY_DEFS)).toHaveLength(8);
  });

  test("chaque stratégie a label + emoji + description", () => {
    for (const [key, def] of Object.entries(HANDBALL_STRATEGY_DEFS)) {
      expect(def.label).toBeTruthy();
      expect(def.emoji).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });
});
