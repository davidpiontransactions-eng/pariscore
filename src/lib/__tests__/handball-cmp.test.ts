// Tests moteur CMP handball — bun:test
// Réf : Under 2.5 = 59,6 % (SportSignals λh=1.4 λe=0.9), ν=1 → Poisson.

import { describe, test, expect } from "bun:test";
import {
  fitCMP,
  cmpPmf,
  cmpMean,
  teamStrength,
  overUnderProb,
  cmpKMax,
} from "../handball-cmp";

// Poisson exact (référence ν=1)
function poisson(k: number, lambda: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return Math.exp(-lambda + k * Math.log(lambda) - Math.log(f));
}

// Générateur déterministe (pas de Math.random : convergence reproductible)
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function poissonSample(rand: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}

describe("cmpPmf", () => {
  test("Σ = 1 (Poisson et sous-dispersé)", () => {
    for (const [lam, nu] of [[2.3, 1], [28.5, 1.3], [30, 2]] as const) {
      const pmf = cmpPmf(lam, nu);
      expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    }
  });

  test("ν=1 → Poisson exact (grille large, queue ~0)", () => {
    const pmf = cmpPmf(2.3, 1, 30);
    for (let k = 0; k <= 8; k++) {
      expect(pmf[k]).toBeCloseTo(poisson(k, 2.3), 9);
    }
  });

  test("grille plancher 17", () => {
    expect(cmpKMax(1.4)).toBeGreaterThanOrEqual(17);
  });
});

describe("overUnderProb", () => {
  test("Under 2.5 = 59,6 % (réf SportSignals λh=1.4 λe=0.9)", () => {
    const { over, under } = overUnderProb(1.4, 1, 0.9, 1, 2.5);
    expect(under).toBeCloseTo(0.596, 3);
    expect(over + under).toBeCloseTo(1, 10);
  });

  test("Over 55.5 handball dans (0,1), over+under=1", () => {
    const { over, under } = overUnderProb(29, 1.3, 28, 1.3, 55.5);
    expect(over).toBeGreaterThan(0);
    expect(over).toBeLessThan(1);
    expect(over + under).toBeCloseTo(1, 10);
  });
});

describe("fitCMP", () => {
  test("convergence : λ colle à la moyenne, ν sain (Poisson λ=28, n=2000)", () => {
    const rand = lcg(42);
    const xs: number[] = [];
    for (let i = 0; i < 2000; i++) xs.push(poissonSample(rand, 28));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const fit = fitCMP(xs, xs.map(() => 1)); // poids uniformes (déterministe)
    expect(fit.converged).toBe(true);
    // Moment 1 respecté : E_fit[X] ≈ moyenne échantillon (λ suit la ridge ν)
    expect(Math.abs(cmpMean(fit.lambda, fit.nu) - mean) / mean).toBeLessThan(0.01);
    // Poisson → ν ≈ 1 (tolérance bruit d'échantillonnage, ridge λ/ν)
    expect(fit.nu).toBeGreaterThan(0.8);
    expect(fit.nu).toBeLessThan(1.3);
  });

  test("vide → repli neutre non convergé", () => {
    const fit = fitCMP([]);
    expect(fit.converged).toBe(false);
    expect(fit.n).toBe(0);
  });
});

describe("teamStrength", () => {
  test("s_a = ln(λa), s_d = −ln(λd)", () => {
    const rand = lcg(7);
    const scored: number[] = [];
    const conceded: number[] = [];
    for (let i = 0; i < 300; i++) {
      scored.push(poissonSample(rand, 31));
      conceded.push(poissonSample(rand, 27));
    }
    const w = scored.map(() => 1);
    const t = teamStrength(scored, conceded, w);
    expect(t.sA).toBeCloseTo(Math.log(t.attack.lambda), 10);
    expect(t.sD).toBeCloseTo(-Math.log(t.defense.lambda), 10);
    expect(t.attack.lambda).toBeGreaterThan(t.defense.lambda);
  });
});
