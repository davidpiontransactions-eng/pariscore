import { describe, expect, test } from "bun:test";
import { expectedValue, kellyFraction, betVerdict, devig } from "./ev";

describe("cs2-ev — expectedValue", () => {
  test("p=0.70, cote 1.80 → EV +26%", () => {
    expect(expectedValue(0.7, 1.8)).toBeCloseTo(26, 1);
  });

  test("p juste vs cote → EV ~0", () => {
    expect(expectedValue(0.5, 2.0)).toBeCloseTo(0, 3);
  });

  test("p trop faible vs cote → EV négatif", () => {
    expect(expectedValue(0.4, 2.0)).toBeLessThan(0);
  });
});

describe("cs2-ev — kellyFraction", () => {
  test("p=0.70, cote 1.80 → Kelly cap 0.25", () => {
    // b = 0.8 ; f* = (0.7*0.8 - 0.3)/0.8 = (0.56-0.3)/0.8 = 0.325 → cap 0.25
    expect(kellyFraction(0.7, 1.8)).toBeCloseTo(0.25, 6);
  });

  test("Kelly négatif (EV<0) → 0", () => {
    expect(kellyFraction(0.4, 2.0)).toBe(0);
  });

  test("Kelly modéré sous le cap", () => {
    // p=0.55, cote 2.0 : b=1, f*=(0.55-0.45)/1=0.10
    expect(kellyFraction(0.55, 2.0)).toBeCloseTo(0.1, 6);
  });
});

describe("cs2-ev — betVerdict", () => {
  test("BET si proba≥65% ET EV≥4% ET calibré", () => {
    expect(
      betVerdict({ pModel: 0.7, decimalOdds: 1.8, calibrated: true }),
    ).toBe("BET");
  });

  test("SKIP si proba < 65% même avec EV positif", () => {
    // p=0.60 cote 1.80 → EV +8% mais proba < 65%
    expect(
      betVerdict({ pModel: 0.6, decimalOdds: 1.8, calibrated: true }),
    ).toBe("SKIP");
  });

  test("SKIP si EV < 4%", () => {
    // p=0.66 cote 1.55 → EV = 0.66*1.55-1 = 2.3% < 4%
    expect(
      betVerdict({ pModel: 0.66, decimalOdds: 1.55, calibrated: true }),
    ).toBe("SKIP");
  });

  test("SKIP si non calibré même si proba/EV OK", () => {
    expect(
      betVerdict({ pModel: 0.7, decimalOdds: 1.8, calibrated: false }),
    ).toBe("SKIP");
  });
});

describe("cs2-ev — devig", () => {
  test("cotes justes 2.0 / 2.0 → 50/50", () => {
    const { pHome, pAway } = devig(2.0, { home: 2.0, away: 2.0 });
    expect(pHome).toBeCloseTo(0.5, 6);
    expect(pAway).toBeCloseTo(0.5, 6);
  });

  test("cotes 1.5 / 3.0 (overround) → probas normalisées ≈ 66.7% / 33.3%", () => {
    const { pHome, pAway } = devig(1.5, { home: 1.5, away: 3.0 });
    expect(pHome).toBeCloseTo(2 / 3, 2);
    expect(pAway).toBeCloseTo(1 / 3, 2);
  });

  test("sum pHome + pAway = 1", () => {
    const { pHome, pAway } = devig(1.15, { home: 1.85, away: 2.1 });
    expect(pHome + pAway).toBeCloseTo(1, 6);
  });
});