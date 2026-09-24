// Tests moteur Skellam handball — bun:test
// P(k) = e^(−(λh+λe))·(λh/λe)^(k/2)·I_k(2√(λh·λe)).

import { describe, test, expect } from "bun:test";
import {
  skellamPmf,
  skellamProb,
  handicapProb,
  skellamMatchProbs,
  handicapProbDirect,
} from "../handball-skellam";
import { cmpPmf } from "../handball-cmp";

describe("skellamPmf", () => {
  test("Σ = 1 (jouet et échelle handball)", () => {
    for (const [lh, le] of [[1, 1], [28.5, 27.2], [5, 12]] as const) {
      const { probs } = skellamPmf(lh, le);
      expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
    }
  });

  test("P(0) = e^−2·I_0(2) ≈ 0.3085 (λh=λe=1)", () => {
    expect(skellamProb(1, 1, 0)).toBeCloseTo(0.3085, 4);
  });

  test("symétrie λh=λe : P(k) = P(−k)", () => {
    const { kMin, probs } = skellamPmf(10, 10);
    for (let k = 1; k <= 8; k++) {
      expect(probs[k - kMin]).toBeCloseTo(probs[-k - kMin], 10);
    }
  });
});

describe("handicapProb", () => {
  test("cohérence : home + away + push = 1", () => {
    const lh = 29;
    const le = 27;
    const hc = handicapProb(lh, le, 4.5);
    const { kMin, probs } = skellamPmf(lh, le);
    let push = 0;
    for (let i = 0; i < probs.length; i++) {
      const k = kMin + i;
      if (Math.abs(k) <= 4.5) push += probs[i];
    }
    expect(hc.home + hc.away + push).toBeCloseTo(1, 8);
    expect(hc.home).toBeGreaterThan(hc.away); // favori domicile
  });

  test("cohérence manuelle : convolution directe ≈ Bessel", () => {
    const pmfH = cmpPmf(2.3, 1, 12);
    const pmfA = cmpPmf(1.8, 1, 12);
    const direct = handicapProbDirect(pmfH, pmfA, 1.5);
    const bessel = handicapProb(2.3, 1.8, 1.5);
    expect(Math.abs(direct.home - bessel.home)).toBeLessThan(0.01);
    expect(Math.abs(direct.away - bessel.away)).toBeLessThan(0.01);
  });
});

describe("skellamMatchProbs", () => {
  test("1X2 somme à 1, favori correct", () => {
    const p = skellamMatchProbs(29, 27);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 8);
    expect(p.home).toBeGreaterThan(p.away);
    expect(p.draw).toBeGreaterThan(0);
  });
});
