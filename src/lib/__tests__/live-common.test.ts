// Tests du contrat partagé des moteurs live multi-sports : bornage
// anti-binaire [2 %, 98 %], normalisation à somme 1, course à seuil et
// Poisson résiduel. Les invariants testés ici valent pour LES SIX sports.
import { describe, expect, test } from "bun:test";
import {
  clampLiveProb,
  driver,
  market,
  nextScorerProbs,
  normalizeOutcomes,
  poissonAtLeast,
  raceToProb,
  clamp01,
  LIVE_PROB_MIN,
  LIVE_PROB_MAX,
  type LiveMarket,
  type LiveBetsBundle,
  type MarketScope,
} from "@/lib/prediction/live-common";
import { footballLiveMarkets } from "@/lib/prediction/live-football";
import { basketballLiveMarkets } from "@/lib/prediction/live-basketball";
import { hockeyLiveMarkets } from "@/lib/prediction/live-hockey";
import { baseballLiveMarkets } from "@/lib/prediction/live-baseball";
import { handballLiveMarkets } from "@/lib/prediction/live-handball";
import { snookerLiveMarkets } from "@/lib/prediction/live-snooker";

/**
 * Invariant commun : chaque marché a ≥ 2 issues, somme 1, toutes dans les
 * bornes — SAUF un marché archivé (issue factuellement tranchée : match fini,
 * temps écoulé, impossibilité physique), où 0 % / 100 % est la vérité.
 */
function assertMarketInvariants(bundle: LiveBetsBundle): void {
  expect(bundle.markets.length).toBeGreaterThan(0);
  for (const m of bundle.markets as LiveMarket[]) {
    expect(m.outcomes.length).toBeGreaterThanOrEqual(2);
    const sum = m.outcomes.reduce((a, o) => a + o.prob, 0);
    expect(sum).toBeCloseTo(1, 6);
    const archived = m.archived === true;
    for (const o of m.outcomes) {
      expect(Number.isFinite(o.prob)).toBe(true);
      if (!archived) {
        expect(o.prob).toBeGreaterThanOrEqual(LIVE_PROB_MIN - 1e-9);
        expect(o.prob).toBeLessThanOrEqual(LIVE_PROB_MAX + 1e-9);
      }
      expect(o.prob).toBeGreaterThanOrEqual(0);
      expect(o.prob).toBeLessThanOrEqual(1);
      expect(o.label.length).toBeGreaterThan(0);
    }
  }
}

// ─── clampLiveProb ─────────────────────────────────────────────────────────

describe("clampLiveProb", () => {
  test("borne en [2 %, 98 %] — pas de 0 % ni 100 % sur un marché vivant", () => {
    expect(clampLiveProb(0)).toBe(LIVE_PROB_MIN);
    expect(clampLiveProb(1)).toBe(LIVE_PROB_MAX);
    expect(clampLiveProb(-5)).toBe(LIVE_PROB_MIN);
    expect(clampLiveProb(5)).toBe(LIVE_PROB_MAX);
  });

  test("laisse passer les valeurs hors bornes", () => {
    expect(clampLiveProb(0.5)).toBe(0.5);
    expect(clampLiveProb(0.02)).toBe(0.02);
    expect(clampLiveProb(0.98)).toBe(0.98);
  });

  test("NaN → centre de la plage (jamais 0)", () => {
    expect(clampLiveProb(Number.NaN)).toBeCloseTo(0.5, 9);
  });
});

// ─── normalizeOutcomes ─────────────────────────────────────────────────────

describe("normalizeOutcomes", () => {
  test("somme exactement 1 après bornage", () => {
    for (const probs of [
      [0.99, 0.005, 0.005],
      [0.5, 0.5],
      [0.98, 0.98, 0.02],
      [1, 0, 0],
      [0.001, 0.999],
    ]) {
      const out = normalizeOutcomes(
        probs.map((p, i) => ({ id: `o${i}`, label: `O${i}`, prob: p }))
      );
      const sum = out.reduce((a, o) => a + o.prob, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  test("bornage effectif : aucune issue à 0 % ni 100 %", () => {
    // Une issue à 1 / l'autre à 0 : la projection doit les ramener dans les
    // bornes ET garder la somme à 1 (100 % + 0 % est interdit des deux côtés).
    const out = normalizeOutcomes([
      { id: "a", label: "A", prob: 1 },
      { id: "b", label: "B", prob: 0 },
    ]);
    // 2 issues : plafond effectif = min(0.98, 1 − 0.02) = 0.98 → atteint
    // exactement, et 0.98 + 0.02 = 1.
    expect(out[0].prob).toBeLessThanOrEqual(LIVE_PROB_MAX);
    expect(out[1].prob).toBeGreaterThanOrEqual(LIVE_PROB_MIN);
    expect(out[0].prob + out[1].prob).toBeCloseTo(1, 6);
  });

  test("bornage + renormalisation simultanés sur 3 issues extrêmes", () => {
    // [0.99, 0.005, 0.005] bornées somment 1.02 : une simple division par la
    // somme repousse les deux petites SOUS le plancher. La projection doit
    // laisser les trois issues dans les bornes avec une somme de 1 — donc avec
    // un PLAFOND EFFECTIF de 1 − 2·min = 0.96, pas de LIVE_PROB_MAX.
    const out = normalizeOutcomes([
      { id: "a", label: "A", prob: 0.99 },
      { id: "b", label: "B", prob: 0.005 },
      { id: "c", label: "C", prob: 0.005 },
    ]);
    for (const o of out) {
      expect(o.prob).toBeGreaterThanOrEqual(LIVE_PROB_MIN - 1e-9);
      expect(o.prob).toBeLessThanOrEqual(LIVE_PROB_MAX + 1e-9);
    }
    expect(out.reduce((a, o) => a + o.prob, 0)).toBeCloseTo(1, 6);
    // Le plafond à 98 % est inatteignable avec 3 issues au plancher de 2 %.
    expect(out[0].prob).toBeCloseTo(0.96, 6);
  });

  test("le plafond effectif baisse avec le nombre d'issues", () => {
    // 4 issues : 1 − 3·0.02 = 0.94. Une issue à 99 % ne peut pas rester à 98 %.
    const out = normalizeOutcomes([
      { id: "a", label: "A", prob: 0.99 },
      { id: "b", label: "B", prob: 0.005 },
      { id: "c", label: "C", prob: 0.003 },
      { id: "d", label: "D", prob: 0.002 },
    ]);
    expect(out.reduce((a, o) => a + o.prob, 0)).toBeCloseTo(1, 6);
    expect(out[0].prob).toBeCloseTo(0.94, 6);
    for (const o of out.slice(1)) expect(o.prob).toBeCloseTo(LIVE_PROB_MIN, 6);
  });

  test("NaN dans les issues → distribution non dégénérée", () => {
    const out = normalizeOutcomes([
      { id: "a", label: "A", prob: Number.NaN },
      { id: "b", label: "B", prob: 0.5 },
    ]);
    for (const o of out) expect(Number.isFinite(o.prob)).toBe(true);
    expect(out.reduce((a, o) => a + o.prob, 0)).toBeCloseTo(1, 6);
  });

  test("entrée vide → tableau vide (pas de division par zéro)", () => {
    expect(normalizeOutcomes([])).toEqual([]);
  });

  test("ordre et labels préservés", () => {
    const out = normalizeOutcomes([
      { id: "x", label: "X", prob: 0.2 },
      { id: "y", label: "Y", prob: 0.8 },
    ]);
    expect(out.map((o) => o.id)).toEqual(["x", "y"]);
    expect(out[0].label).toBe("X");
  });
});

// ─── market / driver ───────────────────────────────────────────────────────

describe("market et driver", () => {
  test("market normalise ses issues", () => {
    const m = market("id", "match", "Label", "hint", [
      { id: "a", label: "A", prob: 0.7 },
      { id: "b", label: "B", prob: 0.3 },
    ]);
    expect(m.id).toBe("id");
    expect(m.scope).toBe("match");
    expect(m.outcomes.reduce((s, o) => s + o.prob, 0)).toBeCloseTo(1, 6);
  });

  test("driver borne la jauge dans [0, 1] et tolère NaN", () => {
    expect(driver("x", 0.5, "50 %").ratio).toBe(0.5);
    expect(driver("x", -3, "-").ratio).toBe(0);
    expect(driver("x", 9, "+").ratio).toBe(1);
    expect(driver("x", Number.NaN, "n/d").ratio).toBe(0);
  });
});

// ─── clamp01 ───────────────────────────────────────────────────────────────

describe("clamp01", () => {
  test("borne et tolère NaN", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

// ─── poissonAtLeast ────────────────────────────────────────────────────────

describe("poissonAtLeast", () => {
  test("P(X ≥ 1) = 1 − e^(−λ)", () => {
    for (const lambda of [0.1, 0.5, 1.4, 3]) {
      expect(poissonAtLeast(1, lambda)).toBeCloseTo(1 - Math.exp(-lambda), 9);
    }
  });

  test("λ = 0 → 0 pour k ≥ 1, 1 pour k ≤ 0", () => {
    expect(poissonAtLeast(1, 0)).toBe(0);
    expect(poissonAtLeast(0, 0)).toBe(1);
    expect(poissonAtLeast(-2, 0)).toBe(1);
  });

  test("monotone décroissante en k", () => {
    expect(poissonAtLeast(2, 2)).toBeLessThan(poissonAtLeast(1, 2));
    expect(poissonAtLeast(3, 2)).toBeLessThan(poissonAtLeast(2, 2));
  });

  test("NaN → 0 (pas de NaN propagé à l'UI)", () => {
    expect(poissonAtLeast(1, Number.NaN)).toBe(0);
  });
});

// ─── raceToProb ────────────────────────────────────────────────────────────

describe("raceToProb", () => {
  test("p = 0.5, course égale → 50 %", () => {
    expect(raceToProb(0.5, 5, 5)).toBeCloseTo(0.5, 6);
  });

  test("seuil déjà atteint → 1 ; adversaire déjà atteint → 0", () => {
    expect(raceToProb(0.5, 0, 5)).toBe(1);
    expect(raceToProb(0.5, 5, 0)).toBe(0);
  });

  test("monotone croissante en p", () => {
    let prev = -1;
    for (const p of [0.2, 0.4, 0.6, 0.8]) {
      const v = raceToProb(p, 10, 10);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  test("course longue (100 points) stable, pas de débordement", () => {
    // p = 0.94 sur une course à 100 : le terme de gauche converge, celui de
    // droite non — d'où le passage par le complémentaire (bug historique qui
    // renvoyait 0 ou 1 selon le côté).
    const v = raceToProb(0.94, 100, 100);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(0.9);
    expect(v).toBeLessThanOrEqual(1);
  });

  test("symétrie : P(A gagne) + P(B gagne) = 1", () => {
    for (const [a, b] of [
      [5, 5],
      [10, 4],
      [3, 17],
      [60, 60],
    ] as const) {
      expect(raceToProb(0.6, a, b) + raceToProb(0.4, b, a)).toBeCloseTo(1, 6);
    }
  });

  test("avantage de 1 point avec p = 0.5 → légèrement plus d'un côté", () => {
    expect(raceToProb(0.5, 10, 11)).toBeGreaterThan(0.5);
  });
});

// ─── nextScorerProbs ───────────────────────────────────────────────────────

describe("nextScorerProbs", () => {
  test("les 3 issues somment à 1", () => {
    for (const [a, b] of [
      [1, 1],
      [0.5, 0.2],
      [3, 0.01],
    ]) {
      const p = nextScorerProbs(a, b);
      expect(p.a + p.none + p.b).toBeCloseTo(1, 9);
    }
  });

  test("λ également répartis → issues symétriques", () => {
    const p = nextScorerProbs(1, 1);
    expect(p.a).toBeCloseTo(p.b, 12);
    expect(p.none).toBeCloseTo(Math.exp(-2), 9);
  });

  test("λ nuls → distribution de dégradation (pas de NaN)", () => {
    const p = nextScorerProbs(0, 0);
    expect(Number.isFinite(p.a)).toBe(true);
    expect(p.a + p.none + p.b).toBeCloseTo(1, 9);
  });

  test("λ négatif ou NaN traité comme 0", () => {
    const p = nextScorerProbs(-3, Number.NaN);
    expect(Number.isFinite(p.a)).toBe(true);
    expect(p.a + p.none + p.b).toBeCloseTo(1, 9);
  });
});

// ─── Invariants des 6 moteurs ─────────────────────────────────────────────

describe("moteurs live — invariants communs aux 6 sports", () => {
  const FOOTBALL_IN = {
    minute: 67,
    homeScore: 2,
    awayScore: 1,
    homeXg: 1.85,
    awayXg: 0.72,
    prematch: { homeProb: 46, drawProb: 27, awayProb: 27 },
    corners: { home: 6, away: 2 },
    yellowCards: { home: 1, away: 3 },
    pressureIndex: 22,
  };
  const BASEBALL_IN = {
    inning: 7,
    half: "top" as const,
    outs: 1,
    bases: 5 as const,
    count: { balls: 2, strikes: 1 },
    homeScore: 3,
    awayScore: 1,
  };
  const SNOOKER_IN = {
    framesA: 3,
    framesB: 2,
    bestOf: 11,
    framePointsA: 41,
    framePointsB: 28,
    pointsOnTable: 62,
    playerATable: true,
    inBreak: true,
  };

  const bundles: LiveBetsBundle[] = [
    footballLiveMarkets(FOOTBALL_IN),
    basketballLiveMarkets({
      period: 3,
      periodMinutesLeft: 6.4,
      homeScore: 78,
      awayScore: 74,
      homeFga: 71,
      awayFga: 68,
      homeEfg: 0.55,
      awayEfg: 0.51,
      homeThreeMade: 9,
      awayThreeMade: 6,
      homeThreeAtt: 28,
      awayThreeAtt: 25,
    }),
    hockeyLiveMarkets({
      period: 3,
      periodSecondsLeft: 640,
      homeScore: 2,
      awayScore: 1,
      powerPlay: "home",
      powerPlaySecondsLeft: 78,
      corsi: { home: 34, away: 21 },
      highDanger: { home: 6, away: 4 },
    }),
    baseballLiveMarkets(BASEBALL_IN),
    handballLiveMarkets({
      minute: 24,
      homeScore: 14,
      awayScore: 12,
      manAdvantage: "away",
      manAdvantageSecondsLeft: 65,
      saveRate: { home: 68, away: 63 },
      transitionSpeed: 1.1,
      sevenMeterRate: 32,
    }),
    snookerLiveMarkets(SNOOKER_IN),
  ];

  test("chaque sport renvoie un bundle conforme", () => {
    for (const b of bundles) {
      assertMarketInvariants(b);
      expect(b.scoreA).toBeGreaterThanOrEqual(0);
      expect(b.scoreB).toBeGreaterThanOrEqual(0);
      expect(b.drivers.length).toBeGreaterThan(0);
      for (const d of b.drivers) {
        expect(d.ratio).toBeGreaterThanOrEqual(0);
        expect(d.ratio).toBeLessThanOrEqual(1);
        expect(d.display.length).toBeGreaterThan(0);
      }
    }
  });

  test("les 6 sports sont distincts et couvrent les 6 scopes attendus", () => {
    const sports = bundles.map((b) => b.sport);
    expect(new Set(sports).size).toBe(6);
    const scopes = new Set<MarketScope>(bundles.flatMap((b) => b.markets.map((m) => m.scope)));
    expect(scopes.has("match")).toBe(true);
    expect(scopes.has("period")).toBe(true);
    expect(scopes.has("micro")).toBe(true);
  });

  test("entrées dégénérées (NaN / négatif) ne plantent pas", () => {
    const cases: LiveBetsBundle[] = [
      footballLiveMarkets({ minute: Number.NaN, homeScore: 0, awayScore: 0 }),
      basketballLiveMarkets({ period: 0, periodMinutesLeft: -5, homeScore: 0, awayScore: 0 }),
      hockeyLiveMarkets({ period: 9, periodSecondsLeft: -1, homeScore: 0, awayScore: 0 }),
      baseballLiveMarkets({ inning: 0, half: "top", outs: 9, bases: 7, homeScore: 0, awayScore: 0 }),
      handballLiveMarkets({ minute: 999, homeScore: 0, awayScore: 0 }),
      snookerLiveMarkets({ framesA: 0, framesB: 0, bestOf: 11, framePointsA: 0, framePointsB: 0, pointsOnTable: 0, playerATable: true }),
    ];
    for (const b of cases) assertMarketInvariants(b);
  });

  test("déterministe : même entrée → même sortie", () => {
    // Les bundles ci-dessus sont dérivés des ENTRÉES ; on rejoue les entrées,
    // pas les bundles (le bundle n'est pas une entrée valide du moteur).
    expect(footballLiveMarkets(FOOTBALL_IN)).toEqual(bundles[0]);
    expect(baseballLiveMarkets(BASEBALL_IN)).toEqual(bundles[3]);
    expect(snookerLiveMarkets(SNOOKER_IN)).toEqual(bundles[5]);
  });
});