import { describe, expect, test } from "bun:test";
import type { League, PitcherRecord, TeamRecord } from "@/lib/baseball/types";
import { buildBatterProfile, buildPrediction, predictionInputHash } from "./baseball-predictive-engine";
import { QUICK_ITERATIONS } from "./baseball-predictive-engine";

// ==== Données de test réelles (registre curé MLB) ====

const LEAGUE: League = "MLB";

function seedTeam(over: Partial<TeamRecord> = {}): TeamRecord {
  return {
    id: "MLB:NYY",
    league: LEAGUE,
    code: "NYY",
    name: "Yankees",
    city: "New York",
    primaryColor: "#132448",
    secondaryColor: "#C4CED4",
    logoPath: "",
    woba: 0.34,
    wrcPlus: 116,
    opsVsLhp: 0.762,
    opsVsRhp: 0.742,
    parkFactor: 100,
    bullpenEra: 3.62,
    bullpenIpLast3: 12.4,
    ...over,
  };
}

function seedPitcher(over: Partial<PitcherRecord> = {}): PitcherRecord {
  return {
    id: "MLB:000",
    league: LEAGUE,
    teamId: "MLB:NYY",
    name: "Pitcher",
    throws: "RHP",
    era: 4.0,
    whip: 1.3,
    fip: 4.0,
    xEra: 4.0,
    kPer9: 8.6,
    bbPer9: 3.1,
    hrPer9: 1.14,
    wins: 0,
    losses: 0,
    inningsPitched: 180,
    opsAgainst: 0.706,
    starterIpAvg: 5.8,
    statsAvailable: true,
    source: "curated",
    season: 2026,
    ...over,
  };
}

describe("buildBatterProfile — split platoon", () => {
  test("un frappeur nettement plus efficace vs RHP doit scorer > vs LHP", () => {
    const team = seedTeam({
      opsVsLhp: 0.60,
      opsVsRhp: 0.80,
    });
    const pitcher = seedPitcher({ throws: "RHP", opsAgainst: 0.706 });

    const vsRHP = buildBatterProfile(LEAGUE, team.wrcPlus, team.opsVsRhp, pitcher, 100, 1);
    const vsLHP = buildBatterProfile(LEAGUE, team.wrcPlus, team.opsVsLhp, pitcher, 100, 1);

    const hitsRHP = vsRHP.pSingle + vsRHP.pDouble + vsRHP.pTriple + vsRHP.pHomerun;
    const hitsLHP = vsLHP.pSingle + vsLHP.pDouble + vsLHP.pTriple + vsLHP.pHomerun;

    // Plus de coups sûrs et de HR face à la main qu'on frappe bien.
    expect(hitsRHP).toBeGreaterThan(hitsLHP);
  });

  test("opsAgainst lanceur absent → repli sur la moyenne de ligue (aucune NaN)", () => {
    const team = seedTeam();
    const profile = buildBatterProfile(LEAGUE, team.wrcPlus, team.opsVsRhp, seedPitcher({ opsAgainst: null }), 100, 1);
    const hits = profile.pSingle + profile.pDouble + profile.pTriple;
    const sum = profile.pStrikeout + profile.pWalk + hits + profile.pHomerun + profile.pOut;
    expect(Number.isFinite(sum)).toBe(true);
    expect(profile.pHomerun).toBeGreaterThan(0);
  });
});

describe("buildBatterProfile — park factor away", () => {
  test("le park (home) doit aussi booster l'équipe away", () => {
    const team = seedTeam({ opsVsLhp: 0.7, opsVsRhp: 0.7 });
    const pitcher = seedPitcher({ throws: "RHP" });

    const inCoors = buildBatterProfile(LEAGUE, team.wrcPlus, team.opsVsRhp, pitcher, 112, 1);
    const neutral = buildBatterProfile(LEAGUE, team.wrcPlus, team.opsVsRhp, pitcher, 100, 1);

    expect(inCoors.pHomerun).toBeGreaterThan(neutral.pHomerun);
  });
});

describe("buildPrediction — intégration platoon + park", () => {
  test("produit des probabilités finies et complètes (verdict)", () => {
    const homeTeam = seedTeam({ parkFactor: 105, opsVsLhp: 0.75, opsVsRhp: 0.74 });
    const awayTeam = seedTeam({ id: "MLB:BOS", code: "BOS", name: "Red Sox", city: "Boston", parkFactor: 100, opsVsLhp: 0.72, opsVsRhp: 0.70 });
    const homePitcher = seedPitcher({ id: "MLB:1", throws: "RHP" });
    const awayPitcher = seedPitcher({ id: "MLB:2", throws: "LHP" });

    const pred = buildPrediction({
      gameId: "MLB:999",
      league: LEAGUE,
      homeTeam,
      awayTeam,
      homePitcher,
      awayPitcher,
      iterations: QUICK_ITERATIONS,
    });

    expect(Number.isFinite(pred.moneyline.homeProb)).toBe(true);
    expect(pred.moneyline.homeProb).toBeGreaterThan(0.03);
    expect(pred.moneyline.homeProb).toBeLessThan(0.97);
    expect(pred.moneyline.homeProb + pred.moneyline.awayProb).toBeCloseTo(1, 3);
    expect(Number.isFinite(pred.total.expectedTotal)).toBe(true);
    expect(pred.total.line).toBeGreaterThan(0);
  });

  test("un partant sans stats n'entre pas dans le hash identique à un autre", () => {
    const homeTeam = seedTeam();
    const awayTeam = seedTeam({ id: "MLB:BOS", code: "BOS", city: "Boston" });
    const hpA = seedPitcher({ id: "MLB:1", throws: "LHP" });
    const hpB = seedPitcher({ id: "MLB:1", throws: "RHP" });
    const awayPitcher = seedPitcher({ id: "MLB:2", throws: "RHP" });

    const realA = predictionInputHash({ gameId: "g", league: LEAGUE, homeTeam, awayTeam, homePitcher: hpA, awayPitcher, iterations: QUICK_ITERATIONS });
    // throws null vs LHP ne doivent pas produire le même hash.
    hpA.throws = null;
    const nullThrow = predictionInputHash({ gameId: "g", league: LEAGUE, homeTeam, awayTeam, homePitcher: hpA, awayPitcher, iterations: QUICK_ITERATIONS });
    hpA.throws = "LHP";
    hpB.throws = "LHP";

    expect(realA).not.toBe(nullThrow);
    expect(realA).toBe(hpB.throws === "LHP" ? predictionInputHash({ gameId: "g", league: LEAGUE, homeTeam, awayTeam, homePitcher: hpB, awayPitcher, iterations: QUICK_ITERATIONS }) : realA);
  });
});