// Tests marchés bonus handball (G10) — bun:test
// Sanity checks computeHandballBonusMarkets + raceToFirstProb :
//   groupes présents, probs bornées, sommes ≈ 100, symétries race-to,
//   cohérence HT vs FT, odds null sans snapshot bonus, jamais de NaN.

import { describe, test, expect } from "bun:test";
import {
  RACE_TARGETS,
  computeHandballBonusMarkets,
  raceToFirstProb,
  type BonusPick,
  type HandballBonusMarketsOpts,
} from "../handball-bonus-markets";
import type { HandballMatch } from "../handball-data";

// ─── Fixtures ───

function fixtureMatch(overrides: Partial<HandballMatch> = {}): HandballMatch {
  return {
    id: 9101,
    league: { id: 1, name: "Starligue", country: "Allemagne", countryCode: "DE" },
    home: { id: 101, name: "TB Stuttgart", shortName: "Stuttgart" },
    away: { id: 202, name: "HG Erlangen", shortName: "Erlangen" },
    kickoff: "2026-09-24T18:00:00.000Z",
    status: "not_started",
    ...overrides,
  };
}

/** Aucune cote (bug snapshot connu). */
const noOdds = fixtureMatch({ id: 9102 });

/** Cotes core uniquement (1X2 + totaux/handicap) — AUCUNE ligne bonus :
 *  le chemin odds des marchés G10 doit rester entièrement à null. */
const withCoreOdds = fixtureMatch({
  id: 9103,
  odds: { home: 1.5, draw: 8, away: 4.8 },
  openingOdds: { over55: 1.9, handicap: 1.85 },
});

/** 5 matchs terminés pour le form-store (matchs serrés, ~60 buts). */
const finishedForm: HandballMatch[] = (
  [
    [32, 27],
    [31, 29],
    [29, 29],
    [33, 28],
    [30, 31],
  ] as const
).map(([home, away], i) =>
  fixtureMatch({ id: 8200 + i, status: "finished", score: { home, away } }),
);

/** Forme écrasante : home marque 40 encaisse 20, away l'inverse → λh ≈ 40,
 *  λa ≈ 20 → race-to home doit écraser away. */
const blowoutForm: HandballMatch[] = Array.from({ length: 5 }, (_, i) =>
  fixtureMatch({ id: 8300 + i, status: "finished", score: { home: 40, away: 20 } }),
);

const allOpts: HandballBonusMarketsOpts[] = [{}, { finished: finishedForm }];

// ─── Helpers assertions ───

function assertPick(p: BonusPick): void {
  expect(p.label.length).toBeGreaterThan(0);
  expect(Number.isFinite(p.prob)).toBe(true);
  expect(p.prob).toBeGreaterThanOrEqual(0);
  expect(p.prob).toBeLessThanOrEqual(100);
  expect(["haute", "moyenne", "basse"]).toContain(p.confidence);
  for (const v of [p.odds, p.impliedProb, p.edge, p.kelly]) {
    if (v != null) expect(Number.isFinite(v)).toBe(true);
  }
  if (p.impliedProb != null) {
    expect(p.impliedProb).toBeGreaterThanOrEqual(0);
    expect(p.impliedProb).toBeLessThanOrEqual(100);
  }
  if (p.kelly != null) {
    expect(p.kelly).toBeGreaterThanOrEqual(0);
    expect(p.kelly).toBeLessThanOrEqual(0.25 + 1e-9);
  }
}

function sum(picks: BonusPick[]): number {
  return picks.reduce((a, p) => a + p.prob, 0);
}

// ─── raceToFirstProb (formule pure) ───

describe("raceToFirstProb", () => {
  test("λh = λa → équitable ±2 pts (X = 10 / 15 / 20)", () => {
    for (const x of RACE_TARGETS) {
      const p = raceToFirstProb(29, 29, x);
      expect(Math.abs(p - 0.5)).toBeLessThanOrEqual(0.02);
    }
  });

  test("λh = 2×λa → home largement (> 0.85), symétrique away", () => {
    for (const x of RACE_TARGETS) {
      expect(raceToFirstProb(30, 15, x)).toBeGreaterThan(0.85);
      expect(raceToFirstProb(15, 30, x)).toBeLessThan(0.15);
    }
  });

  test("bornes [0,1], finitude, cas limites", () => {
    const lambdas: [number, number][] = [
      [1, 29],
      [29, 1],
      [0.1, 0.1],
      [40, 40],
      [Number.NaN, 20],
    ];
    for (const [a, b] of lambdas) {
      for (const x of [1, 5, 10, 15, 20, 30]) {
        const p = raceToFirstProb(a, b, x);
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
    // X = 1 : première équipe à marquer → part exacte de λ.
    expect(raceToFirstProb(30, 10, 1)).toBeCloseTo(0.75, 5);
    expect(raceToFirstProb(10, 30, 1)).toBeCloseTo(0.25, 5);
    // Symétrie exacte : P(home) + P(away) = 1 (pas de tie continu).
    expect(raceToFirstProb(21, 37, 12) + raceToFirstProb(37, 21, 12)).toBeCloseTo(1, 10);
  });
});

// ─── computeHandballBonusMarkets ───

describe("computeHandballBonusMarkets", () => {
  test("3 groupes présents (3 / 7 / 6 picks), libellés FR", () => {
    const r = computeHandballBonusMarkets(noOdds);
    expect(r.htResult).toHaveLength(3);
    expect(r.margin).toHaveLength(7);
    expect(r.raceTo).toHaveLength(2 * RACE_TARGETS.length);
    expect(r.note.length).toBeGreaterThan(0);
    expect(r.htResult[0].label).toContain("mi-temps");
    expect(r.htResult[1].label).toContain("Égalité");
    expect(r.margin[3].label).toBe("Match nul");
    expect(r.raceTo[0].label).toBe("Stuttgart atteint 10 buts en premier");
    expect(r.raceTo[1].label).toBe("Erlangen atteint 10 buts en premier");
    expect(r.raceTo[4].label).toContain("20 buts en premier");
  });

  test("probs bornées, sommes ≈ 100 ± 0.5 par marché", () => {
    for (const opts of allOpts) {
      const r = computeHandballBonusMarkets(noOdds, opts);
      for (const p of [...r.htResult, ...r.margin, ...r.raceTo]) assertPick(p);
      expect(Math.abs(sum(r.htResult) - 100)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(sum(r.margin) - 100)).toBeLessThanOrEqual(0.5);
      // Chaque paire race-to somme à 100 (home10+away10, home15+away15…).
      for (let i = 0; i < RACE_TARGETS.length; i++) {
        expect(Math.abs(sum(r.raceTo.slice(i * 2, i * 2 + 2)) - 100)).toBeLessThanOrEqual(0.5);
      }
    }
  });

  test("margin : bandes + nul couvrent exactement 100, nul > 0", () => {
    const r = computeHandballBonusMarkets(withCoreOdds, { finished: finishedForm });
    expect(Math.abs(sum(r.margin) - 100)).toBeLessThanOrEqual(0.5);
    for (const p of r.margin) expect(p.prob).toBeGreaterThanOrEqual(0);
    expect(r.margin[3].prob).toBeGreaterThan(0); // match nul jamais 0 en handball
    expect(r.margin[0].prob).toBeGreaterThan(0); // bande home 1-5 vivante
  });

  test("HT : nul MT > nul FT (cohérence λ/2, ordre de grandeur)", () => {
    const r = computeHandballBonusMarkets(noOdds, { finished: finishedForm });
    const htDraw = r.htResult[1].prob;
    const ftDraw = r.margin[3].prob;
    // Poisson homogène : P(diff=0) strictement décroissante en λ → λ/2 > λ.
    expect(htDraw).toBeGreaterThan(ftDraw);
    expect(htDraw).toBeLessThan(100);
    expect(ftDraw).toBeGreaterThan(0);
  });

  test("race-to intégration : forme écrasante → home >> away", () => {
    const r = computeHandballBonusMarkets(noOdds, { finished: blowoutForm });
    for (let i = 0; i < RACE_TARGETS.length; i++) {
      const home = r.raceTo[i * 2];
      const away = r.raceTo[i * 2 + 1];
      expect(home.prob).toBeGreaterThan(85);
      expect(away.prob).toBeLessThan(15);
      expect(home.prob).toBeGreaterThan(away.prob + 50);
    }
  });

  test("sans cotes bonus → odds/implied/edge/kelly nulls, pas de throw", () => {
    expect(() => computeHandballBonusMarkets(noOdds)).not.toThrow();
    expect(() => computeHandballBonusMarkets(withCoreOdds, { finished: finishedForm })).not.toThrow();
    // Même avec openingOdds core (over55/handicap) : aucune ligne bonus → nulls.
    const r = computeHandballBonusMarkets(withCoreOdds, { finished: finishedForm });
    for (const p of [...r.htResult, ...r.margin, ...r.raceTo]) {
      expect(p.odds).toBeNull();
      expect(p.impliedProb).toBeNull();
      expect(p.edge).toBeNull();
      expect(p.kelly).toBeNull();
    }
  });

  test("cotes invalides traitées comme absentes (0 / NaN)", () => {
    const broken = fixtureMatch({
      id: 9104,
      openingOdds: {
        fav1x2: { home: 0, away: Number.NaN },
        // Ligne bonus invalide : marché non tarifé → nulls (pas de crash).
        htResult: { home: 0, draw: Number.NaN, away: 1.5 },
      },
    });
    expect(() => computeHandballBonusMarkets(broken)).not.toThrow();
    const r = computeHandballBonusMarkets(broken);
    for (const p of [...r.htResult, ...r.margin, ...r.raceTo]) {
      expect(p.odds).toBeNull();
      expect(Number.isFinite(p.prob)).toBe(true);
    }
  });

  test("pas de NaN : fixtures variés (match 0-0 terminé, forme absente)", () => {
    const fixtures = [
      noOdds,
      withCoreOdds,
      fixtureMatch({ id: 9105, status: "finished", score: { home: 0, away: 0 } }),
      fixtureMatch({ id: 9106, status: "live", minute: 12 }),
    ];
    for (const f of fixtures) {
      const r = computeHandballBonusMarkets(f, { finished: finishedForm });
      for (const p of [...r.htResult, ...r.margin, ...r.raceTo]) assertPick(p);
    }
  });

  test("déterministe : même entrée → même sortie", () => {
    const a = JSON.stringify(
      computeHandballBonusMarkets(withCoreOdds, { finished: finishedForm }),
    );
    const b = JSON.stringify(
      computeHandballBonusMarkets(withCoreOdds, { finished: finishedForm }),
    );
    expect(a).toBe(b);
  });
});
