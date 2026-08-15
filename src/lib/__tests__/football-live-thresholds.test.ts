import { describe, test, expect } from "bun:test";
import {
  evaluateLiveFunnel,
  expectedPressureBaseline,
  detectPressureAnomaly,
  projectLiveMarkets,
  LIVE_FUNNEL_THRESHOLDS,
} from "../football-live-thresholds";

// ─── evaluateLiveFunnel ────────────────────────────────────────────────────

describe("evaluateLiveFunnel", () => {
  test("stats dominantes → règles seuils franchies", () => {
    const hits = evaluateLiveFunnel({
      minute: 70,
      homePressurePct: 70,
      homePossession: 68,
      homeShots: 14,
      awayShots: 3,
      homeSot: 6,
      awaySot: 4,
      homeCorners: 5,
      awayCorners: 2,
      homeYellowCards: 1,
      awayYellowCards: 1,
      homeAttacks: 30,
      awayAttacks: 12,
      homeDangerousAttacks: 11,
      awayDangerousAttacks: 6,
      homeXg: 1.2,
      awayXg: 0.4,
    });
    const met = (rule: string) => hits.find((h) => h.rule === rule)?.met;
    expect(met("homePressure")).toBe(true); // 70 > 65
    expect(met("pressureDiff")).toBe(true); // |70-50|·2 = 40 ≥ 20
    expect(met("awayPossession")).toBe(true); // 32 < 35
    expect(met("totalSot")).toBe(true); // 10 > 8
    expect(met("awaySot")).toBe(true); // 4 ≥ 4
    expect(met("homeShots")).toBe(true); // 14 > 12
    expect(met("totalCorners")).toBe(true); // 7 ≥ 6
    expect(met("homeCorners")).toBe(true); // 5 > 4
    expect(met("yellowCards")).toBe(true); // 2 ≤ 2 (minute ≥ 60)
    expect(met("homeAttacks")).toBe(true); // 30 ≥ 25
    expect(met("dangerousAttacks")).toBe(true); // 17 > 15
    expect(met("xgTotal")).toBe(true); // 1.6 > 1.5
  });

  test("données absentes (null) → règles sautées, jamais met", () => {
    const hits = evaluateLiveFunnel({});
    expect(hits.every((h) => h.met === false)).toBe(true);
    expect(hits.every((h) => h.value == null)).toBe(true);
  });

  test("match neutre → aucun signal", () => {
    const hits = evaluateLiveFunnel({
      homePressurePct: 52,
      homePossession: 51,
      homeShots: 5,
      awayShots: 4,
      homeSot: 2,
      awaySot: 1,
      homeCorners: 2,
      awayCorners: 1,
      homeYellowCards: 2,
      awayYellowCards: 2,
      homeAttacks: 10,
      awayAttacks: 9,
      homeDangerousAttacks: 4,
      awayDangerousAttacks: 3,
      homeXg: 0.5,
      awayXg: 0.4,
    });
    const count = hits.filter((h) => h.met).length;
    expect(count).toBe(0); // jaunes 4 > 2 → la seule règle limite n'est pas remplie
  });
});

// ─── expectedPressureBaseline ──────────────────────────────────────────────

describe("expectedPressureBaseline", () => {
  test("dérive la part de domination des probas 1X2", () => {
    const b = expectedPressureBaseline(60, 20);
    expect(b.homePct).toBe(70); // 60 + 20/2
    expect(b.homePct + b.awayPct).toBe(100);
  });

  test("borné [5, 95]", () => {
    expect(expectedPressureBaseline(95, 5).homePct).toBe(95);
    expect(expectedPressureBaseline(0, 0).homePct).toBe(5);
  });
});

// ─── detectPressureAnomaly ─────────────────────────────────────────────────

describe("detectPressureAnomaly", () => {
  test("outsider qui domine → underdog_surge", () => {
    const a = detectPressureAnomaly(62, 38);
    expect(a.kind).toBe("underdog_surge");
    expect(a.delta).toBe(24);
  });

  test("favori domicile qui confirme → favorite_domination", () => {
    expect(detectPressureAnomaly(74, 62).kind).toBe("favorite_domination");
  });

  test("favori extérieur qui confirme → favorite_domination", () => {
    expect(detectPressureAnomaly(26, 40).kind).toBe("favorite_domination");
  });

  test("pas d'écart notable → null", () => {
    expect(detectPressureAnomaly(55, 52).kind).toBeNull();
  });
});

// ─── projectLiveMarkets ────────────────────────────────────────────────────

describe("projectLiveMarkets", () => {
  test("source xG quand le xG live est fourni", () => {
    const m = projectLiveMarkets({ minute: 60, homeScore: 0, awayScore: 0, homeXg: 1.2, awayXg: 0.4 });
    expect(m.source).toBe("xg");
    expect(m.homeWin).toBeGreaterThan(m.awayWin);
    expect(m.homeWin + m.draw + m.awayWin).toBeGreaterThanOrEqual(98);
    expect(m.homeWin + m.draw + m.awayWin).toBeLessThanOrEqual(102);
  });

  test("fallback pré-match sans xG", () => {
    const m = projectLiveMarkets({
      minute: 30,
      homeScore: 0,
      awayScore: 0,
      prematch: { homeProb: 60, drawProb: 25 },
    });
    expect(m.source).toBe("prematch");
    expect(m.homeWin).toBeGreaterThan(m.awayWin);
  });

  test("2-0 à la 88e → victoire domicile quasi certaine", () => {
    const m = projectLiveMarkets({ minute: 88, homeScore: 2, awayScore: 0, homeXg: 2.1, awayXg: 0.5 });
    expect(m.homeWin).toBeGreaterThanOrEqual(90);
    expect(m.over15).toBeGreaterThanOrEqual(99);
  });

  test("les deux équipes ont déjà marqué → BTTS ~100", () => {
    const m = projectLiveMarkets({ minute: 55, homeScore: 1, awayScore: 1, homeXg: 1.0, awayXg: 0.9 });
    expect(m.btts).toBeGreaterThanOrEqual(99);
  });

  test("match terminé → le score courant décide", () => {
    const m = projectLiveMarkets({ minute: 90, homeScore: 1, awayScore: 1, homeXg: 1.3, awayXg: 1.1 });
    expect(m.draw).toBeGreaterThanOrEqual(95);
  });

  test("seuils funnel exposés et cohérents avec le rapport OddAlerts", () => {
    expect(LIVE_FUNNEL_THRESHOLDS.homePressure).toBe(65);
    expect(LIVE_FUNNEL_THRESHOLDS.pressureDiff).toBe(20);
    expect(LIVE_FUNNEL_THRESHOLDS.awayPossession).toBe(35);
    expect(LIVE_FUNNEL_THRESHOLDS.dangerousAttacks).toBe(15);
    expect(LIVE_FUNNEL_THRESHOLDS.totalCorners).toBe(6);
    expect(LIVE_FUNNEL_THRESHOLDS.totalSot).toBe(8);
    expect(LIVE_FUNNEL_THRESHOLDS.xgTotal).toBe(1.5);
  });
});
