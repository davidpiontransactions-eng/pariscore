// Tests du moteur live SNOOKER — course à seuil de POINTS, century break,
// prochaine bille, et impossibilités physiques (0 et non 2 %).
import { describe, expect, test } from "bun:test";
import { snookerLiveMarkets, type SnookerLiveInput } from "@/lib/prediction/live-snooker";

function base(over: Partial<SnookerLiveInput> = {}): SnookerLiveInput {
  return {
    framesA: 3,
    framesB: 2,
    bestOf: 11,
    framePointsA: 41,
    framePointsB: 28,
    pointsOnTable: 62,
    playerATable: true,
    potRate: null,
    opponentPotRate: null,
    inBreak: null,
    ...over,
  };
}

const byId = (b: ReturnType<typeof snookerLiveMarkets>, id: string) => b.markets.find((m) => m.id === id);
const probOf = (b: ReturnType<typeof snookerLiveMarkets>, market: string, outcome: string) =>
  byId(b, market)?.outcomes.find((o) => o.id === outcome)?.prob ?? 0;

// ─── Vainqueur de frame ────────────────────────────────────────────────────

describe("live-snooker — vainqueur de frame", () => {
  test("2 issues exclusives", () => {
    const b = snookerLiveMarkets(base());
    expect(byId(b, "frame-winner")?.outcomes.map((o) => o.id)).toEqual(["a", "b"]);
    expect(probOf(b, "frame-winner", "a") + probOf(b, "frame-winner", "b")).toBeCloseTo(1, 6);
  });

  test("13 points d'avance avec 62 sur la table → A l'emporte", () => {
    const b = snookerLiveMarkets(base());
    expect(probOf(b, "frame-winner", "a")).toBeGreaterThan(0.95);
  });

  test("A à la table et quasi à égalité → A favori", () => {
    const b = snookerLiveMarkets(base({ framePointsA: 30, framePointsB: 29, pointsOnTable: 80 }));
    expect(probOf(b, "frame-winner", "a")).toBeGreaterThan(probOf(b, "frame-winner", "b"));
  });

  test("B à la table et A loin derrière → B favori", () => {
    const b = snookerLiveMarkets(
      base({ framePointsA: 5, framePointsB: 40, pointsOnTable: 100, playerATable: false })
    );
    expect(probOf(b, "frame-winner", "b")).toBeGreaterThan(probOf(b, "frame-winner", "a"));
  });

  test("score à égalité exacte → 50/50 (course à 1 point chacun)", () => {
    const b = snookerLiveMarkets(
      base({ framePointsA: 40, framePointsB: 40, pointsOnTable: 60, playerATable: true, potRate: 0.94, opponentPotRate: 0.94 })
    );
    expect(Math.abs(probOf(b, "frame-winner", "a") - 0.5)).toBeLessThan(0.02);
  });

  test("taux de pot nul → issues bornées, jamais exactement 0/1", () => {
    const b = snookerLiveMarkets(
      base({ framePointsA: 40, framePointsB: 40, potRate: 0, opponentPotRate: 0 })
    );
    expect(probOf(b, "frame-winner", "a")).toBeGreaterThan(0);
    expect(probOf(b, "frame-winner", "b")).toBeGreaterThan(0);
  });
});

// ─── Vainqueur de rencontre ────────────────────────────────────────────────

describe("live-snooker — vainqueur de la rencontre", () => {
  test("réutilise la distribution log-binomiale existante", () => {
    const b = snookerLiveMarkets(base());
    expect(byId(b, "match-winner")?.hint).toContain("log-binomiale");
  });

  test("3-2 dans un best of 11 → A favori", () => {
    const b = snookerLiveMarkets(base());
    expect(probOf(b, "match-winner", "a")).toBeGreaterThan(0.5);
  });

  test("match terminé → marché archivé", () => {
    const b = snookerLiveMarkets(base({ framesA: 6, framesB: 5 }));
    expect(byId(b, "match-winner")?.hint).toContain("tranchée");
    expect(probOf(b, "match-winner", "a")).toBeGreaterThan(0.9);
  });

  test("retard de frames → extérieur favori", () => {
    const b = snookerLiveMarkets(base({ framesA: 1, framesB: 5, framePointsA: 40, framePointsB: 40, pointsOnTable: 60 }));
    expect(probOf(b, "match-winner", "b")).toBeGreaterThan(0.5);
  });
});

// ─── Century break ─────────────────────────────────────────────────────────

describe("live-snooker — century break", () => {
  test("2 issues exclusives", () => {
    const b = snookerLiveMarkets(base());
    expect(probOf(b, "century-break", "yes") + probOf(b, "century-break", "no")).toBeCloseTo(1, 6);
  });

  test("break déjà à 100+ → century certain", () => {
    const b = snookerLiveMarkets(base({ framePointsA: 104, framePointsB: 0, pointsOnTable: 30 }));
    expect(probOf(b, "century-break", "yes")).toBeGreaterThan(0.9);
  });

  test("points sur table INSUFFISANTS → 0 physique (pas 2 %)", () => {
    // 20 points sur la table, 59 manquants pour un century : impossible.
    const b = snookerLiveMarkets(base({ framePointsA: 41, framePointsB: 0, pointsOnTable: 20 }));
    expect(probOf(b, "century-break", "yes")).toBe(0);
    expect(probOf(b, "century-break", "no")).toBe(1);
  });

  test("beaucoup de points sur table et peu manquants → century plausible", () => {
    const b = snookerLiveMarkets(
      base({ framePointsA: 82, framePointsB: 0, pointsOnTable: 60, inBreak: true })
    );
    expect(probOf(b, "century-break", "yes")).toBeGreaterThan(0.2);
  });

  test("adversaire à la table → century moins probable", () => {
    const aTable = snookerLiveMarkets(base({ framePointsA: 82, framePointsB: 0, pointsOnTable: 60, playerATable: true }));
    const bTable = snookerLiveMarkets(base({ framePointsA: 82, framePointsB: 0, pointsOnTable: 60, playerATable: false }));
    expect(probOf(aTable, "century-break", "yes")).toBeGreaterThan(
      probOf(bTable, "century-break", "yes")
    );
  });

  test("points manquants ↑ → century ↓", () => {
    const proche = snookerLiveMarkets(base({ framePointsA: 92, framePointsB: 0, pointsOnTable: 55 }));
    const loin = snookerLiveMarkets(base({ framePointsA: 60, framePointsB: 0, pointsOnTable: 84 }));
    expect(probOf(proche, "century-break", "yes")).toBeGreaterThan(
      probOf(loin, "century-break", "yes")
    );
  });
});

// ─── Prochaine bille ───────────────────────────────────────────────────────

describe("live-snooker — prochaine bille", () => {
  test("2 issues exclusives", () => {
    const b = snookerLiveMarkets(base());
    expect(probOf(b, "next-ball", "pot") + probOf(b, "next-ball", "miss")).toBeCloseTo(1, 6);
  });

  test("position normale → taux de pot league (~94 %)", () => {
    const b = snookerLiveMarkets(base({ framePointsA: 41, framePointsB: 30, pointsOnTable: 70 }));
    expect(probOf(b, "next-ball", "pot")).toBeGreaterThan(0.85);
  });

  test("derrière de plus de points qu'il n'en reste → snooker requis", () => {
    // A a 5, B a 60, il reste 20 points : A doit faire une sécurité.
    const b = snookerLiveMarkets(
      base({ framePointsA: 5, framePointsB: 60, pointsOnTable: 20, playerATable: true })
    );
    expect(byId(b, "next-ball")?.hint).toContain("sécurité");
    expect(probOf(b, "next-ball", "pot")).toBeLessThan(0.5);
  });

  test("libellé nomme le joueur à la table", () => {
    const a = snookerLiveMarkets(base({ playerATable: true }));
    expect(byId(a, "next-ball")?.label).toContain("Joueur A");
    const b = snookerLiveMarkets(base({ playerATable: false }));
    expect(byId(b, "next-ball")?.label).toContain("Joueur B");
  });

  test("taux de pot nul → P(pot) bornée mais non nulle", () => {
    const b = snookerLiveMarkets(base({ potRate: 0, opponentPotRate: 0, framePointsA: 41, framePointsB: 30, pointsOnTable: 70 }));
    expect(probOf(b, "next-ball", "pot")).toBeGreaterThan(0);
  });
});

// ─── Drivers ───────────────────────────────────────────────────────────────

describe("live-snooker — drivers", () => {
  test("points sur table, break, pot, avance, frames exposés", () => {
    const b = snookerLiveMarkets(base());
    const labels = b.drivers.map((d) => d.label);
    expect(labels).toContain("Points sur table");
    expect(labels).toContain("Points du break");
    expect(labels).toContain("Taux de pot");
    for (const d of b.drivers) {
      expect(d.ratio).toBeGreaterThanOrEqual(0);
      expect(d.ratio).toBeLessThanOrEqual(1);
    }
  });

  test("points sur table affichés", () => {
    const b = snookerLiveMarkets(base({ pointsOnTable: 62 }));
    expect(b.drivers.find((d) => d.label === "Points sur table")?.display).toBe("62 pts");
  });

  test("table vide → jauge à 0", () => {
    const b = snookerLiveMarkets(base({ pointsOnTable: 0 }));
    expect(b.drivers.find((d) => d.label === "Points sur table")?.ratio).toBe(0);
  });

  test("horloge = score de la frame", () => {
    const b = snookerLiveMarkets(base());
    expect(b.clock).toBe("Frame : 41-28");
  });

  test("break en cours → taux de pot légèrement supérieur", () => {
    const sans = snookerLiveMarkets(base({ potRate: 0.9, opponentPotRate: 0.9 }));
    const avec = snookerLiveMarkets(base({ potRate: 0.9, opponentPotRate: 0.9, inBreak: true }));
    expect(probOf(avec, "frame-winner", "a")).toBeGreaterThanOrEqual(
      probOf(sans, "frame-winner", "a")
    );
  });

  test("états dégénérés tolérés (tout zéro)", () => {
    const b = snookerLiveMarkets(
      base({ framesA: 0, framesB: 0, framePointsA: 0, framePointsB: 0, pointsOnTable: 0 })
    );
    expect(Number.isFinite(probOf(b, "frame-winner", "a"))).toBe(true);
    expect(probOf(b, "frame-winner", "a") + probOf(b, "frame-winner", "b")).toBeCloseTo(1, 6);
  });
});