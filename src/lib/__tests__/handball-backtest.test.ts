// Backtest stratégies handball — validation sur données historiques mock
// Teste que les stratégies produisent des résultats cohérents

import { describe, test, expect } from "bun:test";
import { computeHandballStrategyTop8, buildFormStore, HANDBALL_STRATEGY_DEFS } from "../handball-strategy-top8";
import type { HandballMatch } from "../handball-data";

// Générer des matchs historiques réalistes
function generateHistoricalMatches(count: number): HandballMatch[] {
  const teams = [
    { id: 1, name: "Paris Saint-Germain", shortName: "PSG" },
    { id: 2, name: "HBC Nantes", shortName: "Nantes" },
    { id: 3, name: "Montpellier HB", shortName: "Montpellier" },
    { id: 4, name: "Toulouse HB", shortName: "Toulouse" },
    { id: 5, name: "Chambéry SMB", shortName: "Chambéry" },
    { id: 6, name: "US Créteil", shortName: "Créteil" },
    { id: 7, name: "Dunkerque HGL", shortName: "Dunkerque" },
    { id: 8, name: "Pays d'Aix UC", shortName: "Aix" },
  ];

  const matches: HandballMatch[] = [];
  for (let i = 0; i < count; i++) {
    const homeIdx = i % teams.length;
    const awayIdx = (i + 1) % teams.length;
    const homeGoals = 25 + Math.floor(Math.random() * 15); // 25-39
    const awayGoals = 22 + Math.floor(Math.random() * 13); // 22-34
    const homeHalf = Math.floor(homeGoals * (0.4 + Math.random() * 0.2));
    const awayHalf = Math.floor(awayGoals * (0.4 + Math.random() * 0.2));

    matches.push({
      id: 1000 + i,
      league: { id: 1, name: "Starligue", country: "France", countryCode: "FR" },
      home: teams[homeIdx],
      away: teams[awayIdx],
      kickoff: new Date(Date.now() - (count - i) * 86400_000).toISOString(),
      status: "finished",
      score: { home: homeGoals, away: awayGoals, homeHalf, awayHalf },
    });
  }
  return matches;
}

// Générer des fixtures à venir
function generateUpcomingMatches(count: number): HandballMatch[] {
  const teams = [
    { id: 1, name: "Paris Saint-Germain", shortName: "PSG" },
    { id: 2, name: "HBC Nantes", shortName: "Nantes" },
    { id: 3, name: "Montpellier HB", shortName: "Montpellier" },
    { id: 4, name: "Toulouse HB", shortName: "Toulouse" },
  ];

  const matches: HandballMatch[] = [];
  for (let i = 0; i < count; i++) {
    const homeIdx = i % teams.length;
    const awayIdx = (i + 1) % teams.length;

    matches.push({
      id: 2000 + i,
      league: { id: 1, name: "Starligue", country: "France", countryCode: "FR" },
      home: teams[homeIdx],
      away: teams[awayIdx],
      kickoff: new Date(Date.now() + (i + 1) * 3600_000).toISOString(),
      status: "not_started",
      odds: {
        home: 1.5 + Math.random() * 2,
        draw: 7 + Math.random() * 5,
        away: 2 + Math.random() * 3,
      },
    });
  }
  return matches;
}

describe("Backtest stratégies handball", () => {
  const historical = generateHistoricalMatches(100);
  const upcoming = generateUpcomingMatches(10);

  test("buildFormStore avec 100 matchs historiques", () => {
    const store = buildFormStore(historical);
    expect(store.size).toBeGreaterThan(0);
    // Chaque équipe doit avoir des stats
    for (const [, form] of store) {
      expect(form.gf.length).toBeGreaterThan(0);
      expect(form.ga.length).toBeGreaterThan(0);
    }
  });

  test("computeHandballStrategyTop8 retourne des résultats pour toutes les stratégies", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    expect(Object.keys(result.strategies)).toHaveLength(8);
    for (const key of Object.keys(HANDBALL_STRATEGY_DEFS)) {
      const entries = result.strategies[key as keyof typeof result.strategies];
      expect(Array.isArray(entries)).toBe(true);
      // Avec des données réalistes, on devrait avoir au moins quelques entries
      if (key !== "valueBet") { // valueBet peut être vide si pas d'edge
        expect(entries.length).toBeGreaterThan(0);
      }
    }
  });

  test("bestTeam — PPG entre 0 et 2", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const entry of result.strategies.bestTeam) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
      expect(entry.value).toBeLessThanOrEqual(2);
    }
  });

  test("over55 — probabilités entre 0 et 100", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const entry of result.strategies.over55) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
      expect(entry.value).toBeLessThanOrEqual(100);
    }
  });

  test("under62 — probabilités entre 0 et 100", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const entry of result.strategies.under62) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
      expect(entry.value).toBeLessThanOrEqual(100);
    }
  });

  test("handicap — probabilités entre 0 et 100", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const entry of result.strategies.handicap) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
      expect(entry.value).toBeLessThanOrEqual(100);
    }
  });

  test("btts30 — probabilités entre 0 et 100", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const entry of result.strategies.btts30) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
      expect(entry.value).toBeLessThanOrEqual(100);
    }
  });

  test("htLeader — valeurs positives", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const entry of result.strategies.htLeader) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
    }
  });

  test("valueBet — EV peut être négatif (pas de value)", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const entry of result.strategies.valueBet) {
      // valueBet.value = edge en %, peut être négatif
      expect(typeof entry.value).toBe("number");
    }
  });

  test("entries triées par value décroissante", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const key of Object.keys(result.strategies)) {
      const entries = result.strategies[key as keyof typeof result.strategies];
      if (entries.length > 1) {
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i - 1].value).toBeGreaterThanOrEqual(entries[i].value - 1e-9);
        }
      }
    }
  });

  test("limit fonctionne correctement", () => {
    const result = computeHandballStrategyTop8(historical, upcoming, { limit: 5 });
    for (const key of Object.keys(result.strategies)) {
      expect(result.strategies[key as keyof typeof result.strategies].length).toBeLessThanOrEqual(5);
    }
  });

  test("formSummary est défini pour chaque entry", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const key of Object.keys(result.strategies)) {
      for (const entry of result.strategies[key as keyof typeof result.strategies]) {
        expect(entry.formSummary).toBeDefined();
        expect(entry.formSummary?.home).toBeTruthy();
        expect(entry.formSummary?.away).toBeTruthy();
      }
    }
  });

  test("matchIds sont uniques dans chaque stratégie", () => {
    const result = computeHandballStrategyTop8(historical, upcoming);
    for (const key of Object.keys(result.strategies)) {
      const entries = result.strategies[key as keyof typeof result.strategies];
      const ids = entries.map(e => e.matchId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});
