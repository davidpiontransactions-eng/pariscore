import { describe, test, expect } from "bun:test";
import {
  extractLiveFeatures,
  toFeatureVector,
  parseScore,
  FEATURE_ORDER,
  type BSDLiveMatch,
} from "../../src/lib/prediction/live-features";

// Fixture représentative : match live 65e minute, home mène 2-1, domination home.
const FIXTURE: BSDLiveMatch = {
  live_score: "2-1",
  live_minute: 65,
  live_period: "2H",
  expectedGoals: { home: 1.4, away: 1.1 },
  live_xg: { home: 2.3, away: 0.9 },
  live_possession: { home: 62, away: 38 },
  live_shots: { home: 14, away: 6 },
  live_shots_on_target: { home: 7, away: 3 },
  live_corners: { home: 6, away: 2 },
  live_cards: { home: { yellow: 2, red: 0 }, away: { yellow: 3, red: 1 } },
  live_big_chances: { home: 4, away: 1 },
  live_big_chances_missed: { home: 2, away: 0 },
  live_touches_opp_box: { home: 32, away: 11 },
  live_dangerous_attacks: { home: 48, away: 22 },
  live_momentum: [
    { min: 58, v: 20 }, { min: 59, v: 45 }, { min: 60, v: 60 },
    { min: 61, v: 55 }, { min: 62, v: 70 }, { min: 63, v: 80 },
  ],
  live_saves: { home: 2, away: 5 },
  live_goals_prevented: { home: 0.4, away: 1.8 },
  live_tackles: { home: 12, away: 18 },
  live_interceptions: { home: 8, away: 14 },
};

describe("parseScore", () => {
  test("parses string 'H-A'", () => {
    expect(parseScore("2-1")).toEqual({ home: 2, away: 1 });
  });
  test("parses object {home, away}", () => {
    expect(parseScore({ home: 0, away: 0 })).toEqual({ home: 0, away: 0 });
  });
  test("null → 0-0", () => {
    expect(parseScore(null)).toEqual({ home: 0, away: 0 });
  });
  test("malformed string → 0-0", () => {
    expect(parseScore("n/a")).toEqual({ home: 0, away: 0 });
  });
});

describe("extractLiveFeatures", () => {
  const f = extractLiveFeatures(FIXTURE);

  test("extracts time & score", () => {
    expect(f.minute).toBe(65);
    expect(f.period).toBe("2H");
    expect(f.scoreHome).toBe(2);
    expect(f.scoreAway).toBe(1);
    expect(f.scoreDiff).toBe(1);
    expect(f.timeFactor).toBeCloseTo(25 / 90, 5);
  });

  test("extracts xG + derived rates", () => {
    expect(f.xgHome).toBe(2.3);
    expect(f.xgAway).toBe(0.9);
    expect(f.xgDiff).toBeCloseTo(1.4, 5);
    // xgRateHome = (2.3 / 65) * 90 ≈ 3.185
    expect(f.xgRateHome).toBeCloseTo((2.3 / 65) * 90, 3);
    expect(f.xgRateAway).toBeCloseTo((0.9 / 65) * 90, 3);
  });

  test("extracts possession ratio", () => {
    expect(f.possessionHome).toBe(62);
    expect(f.possessionAway).toBe(38);
    expect(f.possessionRatio).toBeCloseTo(62 / 100, 5);
  });

  test("extracts attack metrics", () => {
    expect(f.shotsHome).toBe(14);
    expect(f.sotHome).toBe(7);
    expect(f.cornersHome).toBe(6);
    expect(f.dangerousAttacksHome).toBe(48);
    expect(f.bigChancesHome).toBe(4);
    expect(f.touchesOppBoxHome).toBe(32);
  });

  test("extracts discipline (red cards — feature NOUVELLE)", () => {
    expect(f.redCardsHome).toBe(0);
    expect(f.redCardsAway).toBe(1); // away a 1 rouge → désavantage numérique
    expect(f.yellowCardsHome).toBe(2);
    expect(f.yellowCardsAway).toBe(3);
  });

  test("computes momentum tail6 (signed mean)", () => {
    // moyenne de [20,45,60,55,70,80] = 55
    expect(f.momentumTail6).toBeCloseTo(55, 5);
    expect(f.momentumVolatility).toBeGreaterThan(0);
  });

  test("clamps minute to [0,130]", () => {
    const tooHigh = extractLiveFeatures({ ...FIXTURE, live_minute: 999 });
    expect(tooHigh.minute).toBe(130);
    const neg = extractLiveFeatures({ ...FIXTURE, live_minute: -5 });
    expect(neg.minute).toBe(0);
  });

  test("handles empty/missing match gracefully (no throw)", () => {
    const f = extractLiveFeatures({});
    expect(f.minute).toBe(0);
    expect(f.scoreHome).toBe(0);
    expect(f.xgHome).toBeNull();
    expect(f.possessionRatio).toBeNull();
    expect(f.momentumTail6).toBeNull();
    expect(f.redCardsHome).toBe(0);
  });
});

describe("toFeatureVector", () => {
  test("length matches FEATURE_ORDER", () => {
    const f = extractLiveFeatures(FIXTURE);
    const v = toFeatureVector(f);
    expect(v.length).toBe(FEATURE_ORDER.length);
  });

  test("no NaN in vector (imputation 0 on null)", () => {
    const v = toFeatureVector(extractLiveFeatures({}));
    expect(v.every(x => Number.isFinite(x))).toBe(true);
  });

  test("stable order (same input → same vector)", () => {
    const v1 = toFeatureVector(extractLiveFeatures(FIXTURE));
    const v2 = toFeatureVector(extractLiveFeatures(FIXTURE));
    expect(v1).toEqual(v2);
  });
});

describe("FEATURE_ORDER", () => {
  test("includes red cards (feature NOUVELLE)", () => {
    expect(FEATURE_ORDER).toContain("redCardsHome");
    expect(FEATURE_ORDER).toContain("redCardsAway");
  });
  test("includes sentiment (T3.2) en fin d'ordre", () => {
    expect(FEATURE_ORDER).toContain("sentimentHome");
    expect(FEATURE_ORDER).toContain("sentimentAway");
    // Contrat stable : sentiment DOIT être en fin (après interceptionsHome)
    const idxSent = FEATURE_ORDER.indexOf("sentimentHome");
    const idxLast = FEATURE_ORDER.indexOf("interceptionsHome");
    expect(idxSent).toBeGreaterThan(idxLast);
  });
  test("no duplicates (critical for ML)", () => {
    expect(new Set(FEATURE_ORDER).size).toBe(FEATURE_ORDER.length);
  });
});

describe("sentiment dérivé (T3.2)", () => {
  test("FIXTURE (home mène 2-1, domination) → sentimentHome > 0", () => {
    const f = extractLiveFeatures(FIXTURE);
    expect(f.sentimentHome).toBeGreaterThan(0);
    expect(f.sentimentAway).toBeLessThan(0);
  });

  test("borné [-1, +1]", () => {
    const f = extractLiveFeatures(FIXTURE);
    expect(Math.abs(f.sentimentHome)).toBeLessThanOrEqual(1);
    expect(Math.abs(f.sentimentAway)).toBeLessThanOrEqual(1);
  });

  test("jeu à somme nulle : sentimentAway = -sentimentHome", () => {
    const f = extractLiveFeatures(FIXTURE);
    expect(f.sentimentHome + f.sentimentAway).toBeCloseTo(0, 5);
  });

  test("match vide → sentiment neutre (0)", () => {
    const f = extractLiveFeatures({});
    expect(f.sentimentHome).toBe(0);
    expect(f.sentimentAway).toBe(0);
  });

  test("away domine → sentimentHome < 0", () => {
    const awayDom = {
      ...FIXTURE,
      live_score: "0-3",
      live_xg: { home: 0.3, away: 2.8 },
      live_possession: { home: 35, away: 65 },
      live_momentum: [
        { min: 58, v: -60 }, { min: 59, v: -70 }, { min: 60, v: -80 },
        { min: 61, v: -65 }, { min: 62, v: -75 }, { min: 63, v: -85 },
      ],
    };
    const f = extractLiveFeatures(awayDom);
    expect(f.sentimentHome).toBeLessThan(0);
    expect(f.sentimentAway).toBeGreaterThan(0);
  });
});
