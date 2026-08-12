import { describe, expect, test } from "bun:test";
import {
  ACTIVE_MAP_POOL,
  mapWinProb,
  simulateVeto,
  simulateMapRounds,
  overUnderSignal,
  predictMatch,
  type TeamModel,
} from "./cs2-predictive-ml-engine";

const teamA: TeamModel = {
  name: "Vitality",
  elo: 1750,
  hltvRank: 1,
  mapWinrates: { Mirage: 78, Nuke: 72, Inferno: 60, Anubis: 55, Ancient: 66, Vertigo: 50, Dust2: 70 },
  mapSample: { Mirage: 16, Nuke: 12, Inferno: 10, Anubis: 8, Ancient: 9, Vertigo: 6, Dust2: 11 },
  ctWinrate: 58,
  tWinrate: 61,
  formWinrate: 80,
};

const teamB: TeamModel = {
  name: "PARIVISION",
  elo: 1500,
  hltvRank: 25,
  mapWinrates: { Mirage: 45, Nuke: 40, Inferno: 55, Anubis: 60, Ancient: 42, Vertigo: 65, Dust2: 38 },
  mapSample: { Mirage: 14, Nuke: 8, Inferno: 11, Anubis: 13, Ancient: 7, Vertigo: 12, Dust2: 9 },
  ctWinrate: 50,
  tWinrate: 48,
  formWinrate: 45,
};

describe("cs2-predictive-ml-engine — Bradley-Terry par carte", () => {
  test("équipes équivalentes → ~0.5", () => {
    const p = mapWinProb(teamA, teamA, "Mirage");
    expect(p).toBeCloseTo(0.5, 1);
  });

  test("équipe dominante sur la carte → > 0.5", () => {
    const p = mapWinProb(teamA, teamB, "Mirage");
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });

  test("équipe dominée sur la carte → < 0.5", () => {
    const p = mapWinProb(teamB, teamA, "Nuke");
    expect(p).toBeLessThan(0.5);
  });

  test("sans winrate map → fallback ELO cohérent", () => {
    const noWr: TeamModel = { ...teamA, mapWinrates: {}, mapSample: {} };
    const p = mapWinProb(noWr, teamB, "Mirage");
    expect(p).toBeGreaterThan(0.5); // ELO supérieur
  });
});

describe("cs2-predictive-ml-engine — Veto", () => {
  test("BO3 → 3 cartes retenues, ordre 7 étapes", () => {
    const { order, pickedMaps } = simulateVeto(teamA, teamB, [...ACTIVE_MAP_POOL], 3);
    expect(pickedMaps.length).toBe(3);
    expect(order.length).toBe(7);
    expect(order.filter((s) => s.action === "pick").length).toBe(2);
    expect(order.filter((s) => s.action === "ban").length).toBe(4);
    expect(order.filter((s) => s.action === "decider").length).toBe(1);
  });

  test("BO1 → 1 carte restante", () => {
    const { pickedMaps } = simulateVeto(teamA, teamB, [...ACTIVE_MAP_POOL], 1);
    expect(pickedMaps.length).toBe(1);
  });

  test("les cartes retenues sont uniques et appartiennent au pool", () => {
    const { pickedMaps } = simulateVeto(teamA, teamB, [...ACTIVE_MAP_POOL], 3);
    expect(new Set(pickedMaps).size).toBe(3);
    for (const m of pickedMaps) expect(ACTIVE_MAP_POOL).toContain(m);
  });
});

describe("cs2-predictive-ml-engine — Monte-Carlo MR12", () => {
  test("déterministe avec seed", () => {
    const a = simulateMapRounds(0.6, 0.04, 0.55, 0.45, 5000, 42);
    const b = simulateMapRounds(0.6, 0.04, 0.55, 0.45, 5000, 42);
    expect(a.totalRounds).toEqual(b.totalRounds);
  });

  test("la somme des rounds gagnés = total rounds", () => {
    const dist = simulateMapRounds(0.6, 0.04, 0.55, 0.45, 2000, 7);
    expect(dist.t1Wins.length).toBe(2000);
    expect(dist.t2Wins.length).toBe(2000);
    for (let i = 0; i < 10; i++) {
      expect(dist.t1Wins[i] + dist.t2Wins[i]).toBe(dist.totalRounds[i]);
    }
  });

  test("map favori → winrate > 0.5", () => {
    const dist = simulateMapRounds(0.65, 0.04, 0.6, 0.4, 4000, 3);
    expect(dist.mapWinRate).toBeGreaterThan(0.5);
  });

  test("gagnant ≥ 13 rounds (MR12)", () => {
    const dist = simulateMapRounds(0.5, 0.0, 0.5, 0.5, 1000, 9);
    for (const t of dist.totalRounds) expect(t).toBeGreaterThanOrEqual(13);
  });
});

describe("cs2-predictive-ml-engine — Over/Under", () => {
  test("distribution haute → signal OVER ≥ 65%", () => {
    const high = Array(1000).fill(26);
    const ou = overUnderSignal(high);
    expect(ou.signal).toBe("OVER");
    expect(ou.confidence).toBeGreaterThanOrEqual(0.65);
  });

  test("distribution basse → signal UNDER ≥ 65%", () => {
    const low = Array(1000).fill(14);
    const ou = overUnderSignal(low);
    expect(ou.signal).toBe("UNDER");
    expect(ou.confidence).toBeGreaterThanOrEqual(0.65);
  });
});

describe("cs2-predictive-ml-engine — predictMatch", () => {
  test("sortie complète et cohérente", () => {
    const p = predictMatch({ team1: teamA, team2: teamB, bestOf: 3, seed: 42 });
    expect(p.team1).toBe("Vitality");
    expect(p.winProb1 + p.winProb2).toBeCloseTo(1, 3);
    expect(p.winProb1).toBeGreaterThan(0.5); // Vitality favorite
    expect(p.predictedMaps.length).toBe(7);
    expect(p.mapWinnerMarkets.length).toBe(3);
    expect(p.handicapMaps.length).toBe(2);
    expect(p.totalMaps.over + p.totalMaps.under).toBeCloseTo(1, 3);
    // Probabilités bornées
    for (const m of p.predictedMaps) {
      expect(m.winProb1).toBeGreaterThan(0);
      expect(m.winProb1).toBeLessThan(1);
    }
  });

  test("reproductible (même seed → même résultat)", () => {
    const a = predictMatch({ team1: teamA, team2: teamB, bestOf: 3, seed: 42 });
    const b = predictMatch({ team1: teamA, team2: teamB, bestOf: 3, seed: 42 });
    expect(a.winProb1).toBe(b.winProb1);
    expect(a.predictedMaps[0]).toEqual(b.predictedMaps[0]);
  });
});
