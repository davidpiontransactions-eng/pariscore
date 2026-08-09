import { describe, expect, test } from "bun:test";
import {
  eloProb,
  resolveElo,
  xgAdjustLambda,
  computeEV,
  predictPrematch,
  predictLive,
} from "./engine";
import { DEFAULT_ELO_CONFIG } from "./types";

describe("engine — Elo", () => {
  test("eloProb: home advantage donne > 0.5", () => {
    const p = eloProb(1500, 1500, 100);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(1);
  });

  test("eloProb: écart +400 → ~0.91", () => {
    const p = eloProb(1900, 1500, 0);
    expect(p).toBeCloseTo(0.91, 1);
  });

  test("resolveElo: Elo connus", () => {
    const r = resolveElo(1600, 1400);
    expect(r.home).toBe(1600);
    expect(r.away).toBe(1400);
    expect(r.eloKnown).toBe(true);
  });

  test("resolveElo: fallback 1500", () => {
    const r = resolveElo(undefined, undefined);
    expect(r.home).toBe(1500);
    expect(r.away).toBe(1500);
    expect(r.eloKnown).toBe(false);
  });
});

describe("engine — xG adjustment", () => {
  test("xgAdjustLambda: sans xG → identité", () => {
    const r = xgAdjustLambda(1.5, 1.2, null, null);
    expect(r.home).toBe(1.5);
    expect(r.away).toBe(1.2);
  });

  test("xgAdjustLambda: avec xG → blend 80/20", () => {
    const r = xgAdjustLambda(1.5, 1.2, 2.0, 0.8, 5);
    // 2.0 shrunk = 2.0*1 + 1.35*0 = 2.0
    // home = 0.8*1.5 + 0.2*2.0 = 1.2 + 0.4 = 1.6
    expect(r.home).toBe(1.6);
    // 0.8 shrunk = 0.8*1 + 1.35*0 = 0.8
    // away = 0.8*1.2 + 0.2*0.8 = 0.96 + 0.16 = 1.12
    expect(r.away).toBe(1.12);
  });

  test("xgAdjustLambda: shrinkage petit échantillon", () => {
    const r = xgAdjustLambda(1.5, 1.2, 2.5, 0.5, 1);
    // shrink = 0.2, xgHomeShrunk = 2.5*0.2 + 1.35*0.8 = 0.5 + 1.08 = 1.58
    expect(r.home).toBeCloseTo(1.52, 1);
  });
});

describe("engine — EV", () => {
  test("computeEV: sans odds → null", () => {
    const ev = computeEV({ home: 50, draw: 25, away: 25, over25: 55, btts: 50 });
    expect(ev.homeEV).toBeNull();
    expect(ev.drawEV).toBeNull();
  });

  test("computeEV: avec odds → EV calculé", () => {
    const ev = computeEV(
      { home: 50, draw: 25, away: 25, over25: 55, btts: 50 },
      { home: 2.0, draw: 3.5, away: 3.8 },
    );
    expect(ev.homeEV).toBeDefined();
    expect(ev.drawEV).toBeDefined();
    // home: 1/2 = 0.5, mkt home = 0.5/1.08 ≈ 0.463, EV ≈ (0.5-0.463)*100 ≈ 3.7
    expect(ev.homeEV!).toBeGreaterThan(0);
  });
});

describe("engine — predictPrematch", () => {
  test("sans odds → mode poisson, 1X2 ≈ 100", () => {
    const r = predictPrematch({ homeElo: 1550, awayElo: 1450 });
    expect(r.mode).toBe("prematch");
    expect(r.modelSource).toBe("poisson");
    const sum = r.markets!.homeWin + r.markets!.draw + r.markets!.awayWin;
    expect(sum).toBeCloseTo(100, 2);
    expect(r.markets!.homeWin).toBeGreaterThan(r.markets!.awayWin);
  });

  test("avec odds → mode blend", () => {
    const r = predictPrematch({
      homeElo: 1600, awayElo: 1400,
      odds: { home: 1.8, draw: 3.6, away: 4.5 },
    });
    expect(r.modelSource).toBe("blend");
    const sum = r.markets!.homeWin + r.markets!.draw + r.markets!.awayWin;
    expect(sum).toBeCloseTo(100, 2);
  });

  test("eloKnown: false quand Elo absents", () => {
    const r = predictPrematch({});
    expect(r.elo!.eloKnown).toBe(false);
    expect(r.elo!.home).toBe(1500);
  });
});

describe("engine — predictLive", () => {
  test("minute 45 → λ réduits de moitié", () => {
    const r = predictLive(
      { home: 1.5, away: 1.2 },
      { scoreHome: 0, scoreAway: 0, minute: 45, redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: null },
    );
    expect(r.lambdaRemaining.home).toBeCloseTo(0.75, 1);
    expect(r.lambdaRemaining.away).toBeCloseTo(0.6, 1);
  });

  test("mené 0-1 à la 60ᵉ → λ ajustés", () => {
    const r = predictLive(
      { home: 1.5, away: 1.2 },
      { scoreHome: 0, scoreAway: 1, minute: 60, redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: null },
    );
    // Home mène pas → home λ *= 1.10, away λ *= 0.85
    const baseHome = 1.5 * (30 / 90); // 0.5
    const baseAway = 1.2 * (30 / 90); // 0.4
    expect(r.lambdaRemaining.home).toBeCloseTo(baseHome * 1.10, 1);
    expect(r.lambdaRemaining.away).toBeCloseTo(baseAway * 0.85, 1);
  });

  test("carton rouge → -25% λ", () => {
    const r = predictLive(
      { home: 1.5, away: 1.2 },
      { scoreHome: 0, scoreAway: 0, minute: 0, redCardHome: 1, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: null },
    );
    expect(r.lambdaRemaining.home).toBeCloseTo(1.5 * 0.75, 2);
  });

  test("1X2 cohérent en live", () => {
    const r = predictLive(
      { home: 1.5, away: 1.2 },
      { scoreHome: 1, scoreAway: 0, minute: 70, redCardHome: 0, redCardAway: 0, xgCumHome: null, xgCumAway: null, momentum15: null },
    );
    const sum = r.homeWin + r.draw + r.awayWin;
    expect(sum).toBeCloseTo(100, 2);
  });
});
