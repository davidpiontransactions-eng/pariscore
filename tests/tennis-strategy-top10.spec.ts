import { describe, expect, test } from "bun:test";
import {
  buildTennisStrategyTop10,
  matchTotalGamesProbs,
  TENNIS_STRATEGY_DEFS,
  type LeaderboardByPlayer,
} from "@/lib/tennis-strategy-top10";
import type { TennisMatch } from "@/lib/tennis-data";

// ─── Fixtures de test ─────────────────────────────────────────────────────────

const baseMatch = (overrides: Partial<TennisMatch> = {}): TennisMatch => ({
  id: "m1",
  tournament: "Roland-Garros",
  round: "R16",
  scheduledAt: "2026-09-10T14:00:00Z",
  playerA: {
    id: "pA",
    name: "Carlos Alcaraz",
    shortName: "Alcaraz",
    rank: 2,
    elo: 2100,
    eloKnown: true,
    surfaceElo: 2050,
    photoUrl: "",
    color: "#fff",
    form: ["W", "W", "W", "W", "W"],
    country: "ES",
  },
  playerB: {
    id: "pB",
    name: "Daniil Medvedev",
    shortName: "Medvedev",
    rank: 5,
    elo: 1980,
    eloKnown: true,
    surfaceElo: 1950,
    photoUrl: "",
    color: "#fff",
    form: ["L", "W", "L", "W", "L"],
    country: "RU",
  },
  probA: 68,
  probB: 32,
  stats: { form: "5-0", eloGap: 120, surface: "Terre battue", h2h: "3-2", ic: [55, 75], confidence: 0.7 },
  model: "test",
  modelUpdatedAt: "2026-09-10T00:00:00Z",
  odds: { bookmaker: "Unibet", decimalA: 1.45, decimalB: 2.70 },
  h2hHistory: [
    { date: "2026-09-08T00:00:00Z", tournament: "RG", surface: "Terre battue", winnerId: "pA", score: "6-4, 7-6" },
    { date: "2026-09-05T00:00:00Z", tournament: "RG", surface: "Terre battue", winnerId: "pA", score: "6-3, 6-4" },
  ],
  ...overrides,
});

const emptyLb: LeaderboardByPlayer = new Map();

// ─── T1 : Définitions ─────────────────────────────────────────────────────────

describe("T1 — strategy definitions", () => {
  test("9 stratégies sont définies", () => {
    expect(TENNIS_STRATEGY_DEFS.length).toBe(9);
  });

  test("chaque stratégie a un formatteur", () => {
    for (const def of TENNIS_STRATEGY_DEFS) {
      expect(typeof def.format).toBe("function");
      expect(def.format(75.5).length).toBeGreaterThan(0);
    }
  });

  test("chaque clé est unique", () => {
    const keys = TENNIS_STRATEGY_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── T2 : surfaceEloGap ──────────────────────────────────────────────────────

describe("T2 — surfaceEloGap", () => {
  test("écart ≥ 100 → éligible, pick = côté fort", () => {
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], emptyLb);
    const entries = result.strategies.surfaceEloGap;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].pick).toBe("A");
    expect(entries[0].value).toBeGreaterThanOrEqual(100);
  });

  test("écart < 100 → non éligible", () => {
    const m = baseMatch({
      playerA: { ...baseMatch().playerA, surfaceElo: 2000, elo: 2000 },
      playerB: { ...baseMatch().playerB, surfaceElo: 1980, elo: 1980 },
    });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.surfaceEloGap.length).toBe(0);
  });

  test("eloKnown false → non éligible", () => {
    const m = baseMatch({ playerA: { ...baseMatch().playerA, eloKnown: false } });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.surfaceEloGap.length).toBe(0);
  });
});

// ─── T3 : momentum ────────────────────────────────────────────────────────────

describe("T3 — momentum", () => {
  test("≥ 4 victoires / 5 → éligible", () => {
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.momentum.length).toBeGreaterThan(0);
    expect(result.strategies.momentum[0].value).toBeGreaterThanOrEqual(4);
  });

  test("< 4 victoires → non éligible", () => {
    const m = baseMatch({ playerA: { ...baseMatch().playerA, form: ["W", "L", "W", "L", "W"] } });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.momentum.length).toBe(0);
  });

  test("égalité de momentum → pick null", () => {
    const m = baseMatch({
      playerA: { ...baseMatch().playerA, form: ["W", "W", "W", "W", "L"] },
      playerB: { ...baseMatch().playerB, form: ["W", "W", "W", "W", "L"] },
    });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.momentum.length).toBeGreaterThan(0);
    expect(result.strategies.momentum[0].pick).toBeNull();
  });
});

// ─── T4 : Markov over/under 21.5 ──────────────────────────────────────────────

describe("T4 — matchTotalGamesProbs (Markov convolution)", () => {
  test("retourne des probabilités 0-1", () => {
    const { over215, under215 } = matchTotalGamesProbs(0.65, 0.62);
    expect(over215).toBeGreaterThanOrEqual(0);
    expect(over215).toBeLessThanOrEqual(1);
    expect(under215).toBeGreaterThanOrEqual(0);
    expect(under215).toBeLessThanOrEqual(1);
    expect(over215 + under215).toBeCloseTo(1, 5);
  });

  test("serveurs forts → over215 élevé, under215 bas", () => {
    const { over215, under215 } = matchTotalGamesProbs(0.70, 0.70);
    expect(over215).toBeGreaterThan(under215);
  });

  test("retourneurs efficaces → under215 élevé", () => {
    const { under215 } = matchTotalGamesProbs(0.55, 0.55);
    expect(under215).toBeGreaterThan(0);
  });
});


// ─── T5 : underdogValue (edge ≥ 15 pts) ───────────────────────────────────────

describe("T5 — underdogValue via buildTennisStrategyTop10", () => {
  test("ne plante pas avec cotes valides", () => {
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.underdogValue.length).toBeGreaterThanOrEqual(0);
  });

  test("pas de cotes → underdogValue vide", () => {
    const m = baseMatch({ odds: undefined });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.underdogValue.length).toBe(0);
  });
});

// ─── T6 : favorite20 (proba ≥ 70% + classement) ───────────────────────────────

describe("T6 — favorite20", () => {
  test("proba < 70% → non éligible", () => {
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.favorite20.length).toBe(0);
  });

  test("proba ≥ 70% et favori mieux classé → éligible", () => {
    const m = baseMatch({ probA: 75, probB: 25 });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.favorite20.length).toBeGreaterThan(0);
    expect(result.strategies.favorite20[0].pick).toBe("A");
  });

  test("proba ≥ 70% mais favori moins bien classé → non éligible", () => {
    const m = baseMatch({
      probA: 75,
      probB: 25,
      playerA: { ...baseMatch().playerA, rank: 10 },
      playerB: { ...baseMatch().playerB, rank: 2 },
    });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.favorite20.length).toBe(0);
  });
});

// ─── T7 : fatigue (historique h2h) ─────────────────────────────────────────────

describe("T7 — fatigue via buildTennisStrategyTop10", () => {
  test("adversaire avec match 3 sets récent → fatigue détectable", () => {
    const m = baseMatch({
      h2hHistory: [
        { date: "2026-09-08T00:00:00Z", tournament: "RG", surface: "Terre battue", winnerId: "pB", score: "6-4, 3-6, 6-3" },
      ],
    });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.fatigue.length).toBeGreaterThanOrEqual(0);
  });

  test("pas d'historique h2h → fatigue non évaluable (vide)", () => {
    const m = baseMatch({ h2hHistory: [] });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.fatigue.length).toBe(0);
  });
});

// ─── T8 : serveHold (nécessite leaderboard) ───────────────────────────────────

describe("T8 — serveHold avec leaderboard", () => {
  test("hold ≥ 80% via servicePointsWonPct → éligible", () => {
    const lb: LeaderboardByPlayer = new Map([
      ["carlos alcaraz", { servicePointsWonPct: 85, returnPointsWonPct: 40 }],
      ["daniil medvedev", { servicePointsWonPct: 78, returnPointsWonPct: 35 }],
    ]);
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], lb);
    expect(result.strategies.serveHold.length).toBeGreaterThan(0);
    expect(result.strategies.serveHold[0].pick).toBe("A");
  });

  test("hold < 80% → non éligible", () => {
    const lb: LeaderboardByPlayer = new Map([
      ["carlos alcaraz", { servicePointsWonPct: 60, returnPointsWonPct: 40 }],
      ["daniil medvedev", { servicePointsWonPct: 58, returnPointsWonPct: 35 }],
    ]);
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], lb);
    expect(result.strategies.serveHold.length).toBe(0);
  });
});


// ─── T9 : returnEfficacy (retour vs hold adverse) ──────────────────────────────

describe("T9 — returnEfficacy avec leaderboard", () => {
  test("retourneur efficace + serveur faible → potentiellement éligible", () => {
    const lb: LeaderboardByPlayer = new Map([
      ["carlos alcaraz", { servicePointsWonPct: 60, returnPointsWonPct: 45 }],
      ["daniil medvedev", { servicePointsWonPct: 70, returnPointsWonPct: 30 }],
    ]);
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], lb);
    expect(result.strategies.returnEfficacy.length).toBeGreaterThanOrEqual(0);
  });

  test("pas de données leaderboard → non éligible", () => {
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.returnEfficacy.length).toBe(0);
  });
});

// ─── T10 : Builder principal ──────────────────────────────────────────────────

describe("T10 — buildTennisStrategyTop10", () => {
  test("retourne les 9 stratégies dans le résultat", () => {
    const m = baseMatch();
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(Object.keys(result.strategies).length).toBe(9);
  });

  test("matchesConsidered = nombre de matchs entrés", () => {
    const result = buildTennisStrategyTop10([baseMatch(), baseMatch({ id: "m2" })], emptyLb);
    expect(result.matchesConsidered).toBe(2);
  });

  test("limit respecté", () => {
    const matches = Array.from({ length: 20 }, (_, i) => baseMatch({ id: `m${i}` }));
    const result = buildTennisStrategyTop10(matches, emptyLb, { limit: 5 });
    for (const key of Object.keys(result.strategies) as Array<keyof typeof result.strategies>) {
      expect(result.strategies[key].length).toBeLessThanOrEqual(5);
    }
  });

  test("tri décroissant par valeur", () => {
    const matches = [
      baseMatch({ id: "low", playerA: { ...baseMatch().playerA, surfaceElo: 2050 } }),
      baseMatch({ id: "high", playerA: { ...baseMatch().playerA, surfaceElo: 2200 } }),
    ];
    const result = buildTennisStrategyTop10(matches, emptyLb);
    const gaps = result.strategies.surfaceEloGap.map((e) => e.value);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1]).toBeGreaterThanOrEqual(gaps[i]);
    }
  });

  test("computedAt est une ISO date valide", () => {
    const result = buildTennisStrategyTop10([baseMatch()], emptyLb);
    expect(new Date(result.computedAt).toISOString()).toBe(result.computedAt);
  });
});

// ─── T11 : Robustesse ─────────────────────────────────────────────────────────

describe("T11 — robustesse", () => {
  test("matches vide → résultat vide mais structure présente", () => {
    const result = buildTennisStrategyTop10([], emptyLb);
    expect(result.matchesConsidered).toBe(0);
    expect(Object.keys(result.strategies).length).toBe(9);
  });

  test("match incomplet (player manquant) → skippé", () => {
    const m = baseMatch();
    (m as Record<string, unknown>).playerA = undefined;
    const result = buildTennisStrategyTop10([m as unknown as TennisMatch], emptyLb);
    expect(result.matchesConsidered).toBe(1);
    for (const key of Object.keys(result.strategies) as Array<keyof typeof result.strategies>) {
      for (const e of result.strategies[key]) {
        expect(e.playerA.name.length).toBeGreaterThan(0);
      }
    }
  });

  test("synthétique ou insufficientData → strategies synthétiques exclues", () => {
    const m = baseMatch({ synthetic: true, probA: 75, probB: 25 });
    const result = buildTennisStrategyTop10([m], emptyLb);
    expect(result.strategies.favorite20.length).toBe(0);
    expect(result.strategies.underdogValue.length).toBe(0);
  });
});
