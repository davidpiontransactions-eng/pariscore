import { describe, expect, test } from "bun:test";
import { mapPlayProbability } from "./map-play-prob";
import { ACTIVE_MAP_POOL, type TeamModel } from "./cs2-predictive-ml-engine";

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

describe("cs2-map-play-prob", () => {
  test("BO3 → somme des P = 3 (3 maps jouées)", () => {
    const probs = mapPlayProbability({ team1: teamA, team2: teamB }, 3, {});
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(3, 4);
  });

  test("BO1 → somme des P = 1", () => {
    const probs = mapPlayProbability({ team1: teamA, team2: teamB }, 1, {});
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 4);
  });

  test("les maps retenues par le veto ont P > 0.5 (quasi-certaines)", () => {
    const probs = mapPlayProbability({ team1: teamA, team2: teamB }, 3, {});
    const top = Object.entries(probs).sort((a, b) => b[1] - a[1]);
    expect(top[0][1]).toBeCloseTo(1, 1); // map pick n°1
    expect(top[1][1]).toBeCloseTo(1, 1); // map pick n°2
  });

  test("l'historique pick/ban augmente la P d'une carte bannie par le veto", () => {
    // Mirage (78% pour T1) est la première map bannie par T2 → P veto = 0.
    const pNoHist = mapPlayProbability({ team1: teamA, team2: teamB }, 3, {});
    const pWithHist = mapPlayProbability({ team1: teamA, team2: teamB }, 3, { Mirage: 80, Nuke: 1, Inferno: 1, Anubis: 1, Ancient: 1, Vertigo: 1, Dust2: 1 });
    // Sans historique : bannie → ~0. Avec historique : prend de la proba.
    expect(pNoHist.Mirage ?? 0).toBeLessThan(0.05);
    expect(pWithHist.Mirage ?? 0).toBeGreaterThan(pNoHist.Mirage ?? 0);
    expect(pWithHist.Mirage ?? 0).toBeLessThanOrEqual(1);
  });

  test("toutes les probas bornées [0,1] et maps valides", () => {
    const probs = mapPlayProbability({ team1: teamA, team2: teamB }, 3, {});
    for (const map of ACTIVE_MAP_POOL) {
      const p = probs[map] ?? 0;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});