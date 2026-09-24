// Tests popup 3 paris prédictifs handball — bun:test
// Sanity checks computeHandballPredictiveBets + devigHandball1x2

import { describe, test, expect } from "bun:test";
import { computeHandballPredictiveBets, devigHandball1x2 } from "../handball-predictive-bets";
import type { HandballPredictiveBet } from "../handball-predictive-bets";
import type { HandballMatch } from "../handball-data";

// ─── Fixtures ───

function fixtureMatch(overrides: Partial<HandballMatch> = {}): HandballMatch {
  return {
    id: 9001,
    league: { id: 1, name: "Starligue", country: "Allemagne", countryCode: "DE" },
    home: { id: 101, name: "TB Stuttgart", shortName: "Stuttgart" },
    away: { id: 202, name: "HG Erlangen", shortName: "Erlangen" },
    kickoff: "2026-09-24T18:00:00.000Z",
    status: "not_started",
    ...overrides,
  };
}

/** Cotes 1X2 complètes. */
const withOdds = fixtureMatch({ odds: { home: 1.5, draw: 8, away: 4.8 } });

/** Cotes 1X2 + marchés d'ouverture totaux/handicap. */
const withMarkets = fixtureMatch({
  id: 9002,
  odds: { home: 1.5, draw: 8, away: 4.8 },
  openingOdds: { over55: 1.9, handicap: 1.85 },
});

/** Bug snapshot connu : aucune cote (odds absentes). */
const noOdds = fixtureMatch({ id: 9003 });

/** Match terminé avec score. */
const finishedMatch = fixtureMatch({
  id: 9004,
  status: "finished",
  score: { home: 30, away: 25, homeHalf: 15, awayHalf: 12 },
  odds: { home: 1.5, draw: 8, away: 4.8 },
});

/** 5 matchs terminés pour le form-store (Stuttgart fort, Erlangen moins).
 *  Totals ~60 buts (handball moderne) : over @55.5 robuste côté modèle. */
const finishedForm: HandballMatch[] = (
  [
    [32, 27],
    [31, 29],
    [29, 29],
    [33, 28],
    [30, 31],
  ] as const
).map(([home, away], i) =>
  fixtureMatch({
    id: 8000 + i,
    status: "finished",
    score: { home, away },
  }),
);

const optsForm = { finished: finishedForm };

// ─── Helpers assertions ───

function assertBetBounded(b: HandballPredictiveBet): void {
  expect(b.prob).toBeGreaterThanOrEqual(0);
  expect(b.prob).toBeLessThanOrEqual(100);
  expect(Number.isFinite(b.prob)).toBe(true);
  for (const v of [b.odds, b.impliedProb, b.edge, b.ev, b.kelly]) {
    if (v != null) expect(Number.isFinite(v)).toBe(true);
  }
  if (b.impliedProb != null) {
    expect(b.impliedProb).toBeGreaterThanOrEqual(0);
    expect(b.impliedProb).toBeLessThanOrEqual(100);
  }
  if (b.kelly != null) {
    expect(b.kelly).toBeGreaterThanOrEqual(0);
    expect(b.kelly).toBeLessThanOrEqual(0.25 + 1e-9);
  }
}

function assertThreeUniqueLevels(bets: HandballPredictiveBet[]): void {
  expect(bets).toHaveLength(3);
  const levels = new Set(bets.map((b) => b.level));
  expect(levels.size).toBe(3);
  expect(levels.has("winner")).toBe(true);
  expect(levels.has("total")).toBe(true);
  expect(levels.has("handicap")).toBe(true);
}

// ─── devigHandball1x2 ───

describe("devigHandball1x2", () => {
  test("somme 1X2 ≈ 100 quand odds complètes", () => {
    const p = devigHandball1x2({ home: 1.5, draw: 8, away: 4.8 })!;
    expect(p).not.toBeNull();
    const sum = p.home + p.draw + p.away;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2);
    expect(p.home).toBeGreaterThan(0);
    expect(p.home).toBeLessThan(100);
  });

  test("sans nul : somme = 100, draw = 0", () => {
    const p = devigHandball1x2({ home: 2.1, away: 1.8 })!;
    expect(p.draw).toBe(0);
    expect(Math.abs(p.home + p.away - 100)).toBeLessThanOrEqual(2);
  });

  test("odds invalides → null (bug snapshot odds=[])", () => {
    expect(devigHandball1x2({})).toBeNull();
    expect(devigHandball1x2({ home: 1.5 })).toBeNull();
    expect(devigHandball1x2({ home: 0, away: 4.8 })).toBeNull();
    expect(devigHandball1x2({ home: Number.NaN, away: 4.8 })).toBeNull();
  });
});

// ─── computeHandballPredictiveBets ───

describe("computeHandballPredictiveBets", () => {
  test("retourne exactement 3 bets, niveaux uniques", () => {
    const r = computeHandballPredictiveBets(withOdds, optsForm);
    assertThreeUniqueLevels(r.bets);
    const r2 = computeHandballPredictiveBets(noOdds);
    assertThreeUniqueLevels(r2.bets);
    const r3 = computeHandballPredictiveBets(finishedMatch, optsForm);
    assertThreeUniqueLevels(r3.bets);
  });

  test("probs dans [0,100], aucun NaN (tous fixtures)", () => {
    const results = [
      computeHandballPredictiveBets(withOdds, optsForm),
      computeHandballPredictiveBets(withMarkets),
      computeHandballPredictiveBets(noOdds),
      computeHandballPredictiveBets(finishedMatch, optsForm),
    ];
    for (const r of results) {
      expect(r.favoriteProb).toBeGreaterThanOrEqual(0);
      expect(r.favoriteProb).toBeLessThanOrEqual(100);
      expect(Number.isFinite(r.favoriteProb)).toBe(true);
      expect(Number.isFinite(r.confidence)).toBe(true);
      expect(Number.isFinite(r.handicapLine)).toBe(true);
      expect(Number.isFinite(r.totalLine)).toBe(true);
      expect(typeof r.modelNote).toBe("string");
      expect(r.modelNote.length).toBeGreaterThan(0);
      for (const b of r.bets) assertBetBounded(b);
    }
  });

  test("odds vides → bets présents, odds null, pas de throw", () => {
    expect(() => computeHandballPredictiveBets(noOdds)).not.toThrow();
    const result = computeHandballPredictiveBets(noOdds);
    assertThreeUniqueLevels(result.bets);
    for (const b of result.bets) {
      expect(b.odds).toBeNull();
      expect(b.impliedProb).toBeNull();
      expect(b.edge).toBeNull();
      expect(b.ev).toBeNull();
      expect(b.kelly).toBeNull();
      expect(b.prob).toBeGreaterThanOrEqual(0);
      expect(b.prob).toBeLessThanOrEqual(100);
    }
    expect(result.bets[0].source).toBe("form-fallback");
  });

  test("cotes invalides traitées comme absentes (0 / NaN)", () => {
    const broken = fixtureMatch({ id: 9005, odds: { home: 0, away: Number.NaN } });
    const r = computeHandballPredictiveBets(broken);
    assertThreeUniqueLevels(r.bets);
    const winner = r.bets.find((b) => b.level === "winner")!;
    expect(winner.odds).toBeNull();
    expect(winner.edge).toBeNull();
  });

  test("kelly ≤ 0.25 quand calculé", () => {
    const results = [
      computeHandballPredictiveBets(withOdds, optsForm),
      computeHandballPredictiveBets(withMarkets, optsForm),
      computeHandballPredictiveBets(finishedMatch, optsForm),
    ];
    let kellyCount = 0;
    for (const r of results) {
      for (const b of r.bets) {
        if (b.kelly != null) {
          kellyCount++;
          expect(b.kelly).toBeGreaterThanOrEqual(0);
          expect(b.kelly).toBeLessThanOrEqual(0.25 + 1e-9);
        }
      }
    }
    expect(kellyCount).toBeGreaterThan(0);
  });

  test("edge cohérent : edge = prob − impliedProb (±0.1)", () => {
    const results = [
      computeHandballPredictiveBets(withOdds, optsForm),
      computeHandballPredictiveBets(withMarkets, optsForm),
      computeHandballPredictiveBets(finishedMatch, optsForm),
    ];
    let edgeCount = 0;
    for (const r of results) {
      for (const b of r.bets) {
        if (b.edge != null) {
          edgeCount++;
          expect(b.impliedProb).not.toBeNull();
          expect(Math.abs(b.edge - (b.prob - (b.impliedProb as number)))).toBeLessThanOrEqual(0.1);
        }
      }
    }
    expect(edgeCount).toBeGreaterThan(0);
  });

  test("bets triés par edge décroissant (nulls à la fin)", () => {
    const results = [
      computeHandballPredictiveBets(withOdds, optsForm),
      computeHandballPredictiveBets(withMarkets, optsForm),
      computeHandballPredictiveBets(noOdds),
    ];
    for (const r of results) {
      const edges = r.bets.map((b) => (b.edge != null ? b.edge : Number.NEGATIVE_INFINITY));
      for (let i = 1; i < edges.length; i++) {
        expect(edges[i - 1]).toBeGreaterThanOrEqual(edges[i] - 1e-9);
      }
    }
  });

  test("labels FR attendus (Stuttgart vs Erlangen)", () => {
    const r = computeHandballPredictiveBets(withOdds, optsForm);
    const winner = r.bets.find((b) => b.level === "winner")!;
    const total = r.bets.find((b) => b.level === "total")!;
    const handicap = r.bets.find((b) => b.level === "handicap")!;
    expect(winner.label).toBe("Stuttgart gagne");
    expect(total.label).toMatch(/^(Over|Under) 54\.5 buts$/);
    // Fix G6-5 : le bet handicap porte le côté FAVORI −N (pas le sous-chien +N)
    expect(handicap.label).toBe("Stuttgart -3.5");
    expect(winner.icon).toBeTruthy();
    expect(total.icon).toBeTruthy();
    expect(handicap.icon).toBeTruthy();
  });

  test("handicap : cote marché branchée quand ligne = 4.5 (côté favori)", () => {
    const r = computeHandballPredictiveBets(withMarkets, optsForm);
    const hc = r.bets.find((b) => b.level === "handicap")!;
    expect(r.handicapLine).toBe(-4.5);
    expect(hc.label).toBe("Stuttgart -4.5");
    expect(hc.odds).toBe(1.85);
    expect(hc.impliedProb).not.toBeNull();
    expect(hc.edge).not.toBeNull();
    // Ligne défaut (aucun marché d'ouverture) → jamais de cote attachée
    const r2 = computeHandballPredictiveBets(withOdds, optsForm);
    const hc2 = r2.bets.find((b) => b.level === "handicap")!;
    expect(hc2.odds).toBeNull();
    expect(hc2.label).toBe("Stuttgart -3.5");
  });

  test("sources tracées selon disponibilité données", () => {
    // Cotes + forme → winner "cotes", modèles "model"
    const a = computeHandballPredictiveBets(withOdds, optsForm);
    expect(a.bets.find((b) => b.level === "winner")!.source).toBe("cotes");
    expect(a.bets.find((b) => b.level === "total")!.source).toBe("model");
    expect(a.bets.find((b) => b.level === "handicap")!.source).toBe("model");
    // Cotes sans forme → winner "cotes", repli "form-fallback"
    const b = computeHandballPredictiveBets(withMarkets);
    expect(b.bets.find((x) => x.level === "winner")!.source).toBe("cotes");
    expect(b.bets.find((x) => x.level === "total")!.source).toBe("form-fallback");
    // Sans cotes avec forme → winner "model"
    const c = computeHandballPredictiveBets(fixtureMatch({ id: 9006 }), optsForm);
    expect(c.bets.find((x) => x.level === "winner")!.source).toBe("model");
  });

  test("lignes : défaut 54.5, marché 55.5, overrides opts", () => {
    expect(computeHandballPredictiveBets(withOdds, optsForm).totalLine).toBe(54.5);
    const market = computeHandballPredictiveBets(withMarkets, optsForm);
    expect(market.totalLine).toBe(55.5);
    const total = market.bets.find((b) => b.level === "total")!;
    expect(total.label).toContain("55.5");
    expect(total.odds).toBe(1.9);
    expect(total.impliedProb).not.toBeNull();
    const forced = computeHandballPredictiveBets(withOdds, { ...optsForm, totalLine: 60 });
    expect(forced.totalLine).toBe(60);
    expect(forced.bets.find((b) => b.level === "total")!.label).toContain("60");
  });

  test("handicapLine négative côté favori + alignement marché", () => {
    expect(computeHandballPredictiveBets(withOdds, optsForm).handicapLine).toBe(-3.5);
    expect(computeHandballPredictiveBets(withMarkets, optsForm).handicapLine).toBe(-4.5);
    // Fix G6-6 : ligne entière forcée (pas de .5 → push possible) → ignorée,
    // résolution standard (défaut 3.5).
    const forcedInt = computeHandballPredictiveBets(withOdds, { ...optsForm, handicapLine: 5 });
    expect(forcedInt.handicapLine).toBe(-3.5);
    expect(forcedInt.bets.find((b) => b.level === "handicap")!.label).toBe("Stuttgart -3.5");
    // Ligne en .5 forcée → acceptée, label côté favori −N.
    const forcedHalf = computeHandballPredictiveBets(withOdds, { ...optsForm, handicapLine: 5.5 });
    expect(forcedHalf.handicapLine).toBe(-5.5);
    expect(forcedHalf.bets.find((b) => b.level === "handicap")!.label).toBe("Stuttgart -5.5");
  });

  test("favori + confiance cohérents", () => {
    const r = computeHandballPredictiveBets(withOdds, optsForm);
    expect(r.favoriteName).toBe("Stuttgart");
    expect(r.favoriteProb).toBeGreaterThan(50);
    expect(r.confidence).toBeGreaterThanOrEqual(30);
    expect(r.confidence).toBeLessThanOrEqual(95);
    const winner = r.bets.find((b) => b.level === "winner")!;
    expect(winner.prob).toBeCloseTo(r.favoriteProb, 1);
    // Bande de confiance du bet : haute ≥65, moyenne ≥55, basse sinon
    const expected = winner.prob >= 65 ? "haute" : winner.prob >= 55 ? "moyenne" : "basse";
    expect(winner.confidence).toBe(expected);
  });

  test("match terminé : pas de throw, 3 bets", () => {
    expect(() => computeHandballPredictiveBets(finishedMatch, optsForm)).not.toThrow();
    expect(() => computeHandballPredictiveBets(finishedMatch)).not.toThrow();
  });

  test("prior neutre (sans odds ni forme) : probs non dégénérées", () => {
    // Régression : prior CMP ν=1.3 sur λ=means donnait E≈λ^(1/ν)≈13 →
    // Under 100 % (bug détecté G3). Le prior est Poisson (ν=1), E=λ.
    const r = computeHandballPredictiveBets(noOdds);
    const winner = r.bets.find((b) => b.level === "winner")!;
    const total = r.bets.find((b) => b.level === "total")!;
    expect(winner.prob).toBeGreaterThan(20);
    expect(winner.prob).toBeLessThan(80);
    expect(total.prob).toBeGreaterThan(40);
    expect(total.prob).toBeLessThan(95);
  });

  test("modelNote FR mentionne la méthode", () => {
    const withForm = computeHandballPredictiveBets(withOdds, optsForm);
    expect(withForm.modelNote).toContain("Devig cotes 1X2");
    expect(withForm.modelNote).toContain("forme");
    const noForm = computeHandballPredictiveBets(noOdds);
    expect(noForm.modelNote).toContain("CMP");
  });

  test("déterministe : même entrée → même sortie", () => {
    const a = JSON.stringify(computeHandballPredictiveBets(withOdds, optsForm));
    const b = JSON.stringify(computeHandballPredictiveBets(withOdds, optsForm));
    expect(a).toBe(b);
  });
});
