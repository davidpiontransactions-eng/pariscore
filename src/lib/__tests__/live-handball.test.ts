// Tests du moteur live HANDBALL — pas de nul, mi-temps, avantage numérique,
// issue de la prochaine attaque.
import { describe, expect, test } from "bun:test";
import { handballLiveMarkets, type HandballLiveInput } from "@/lib/prediction/live-handball";

function base(over: Partial<HandballLiveInput> = {}): HandballLiveInput {
  return {
    minute: 24,
    homeScore: 14,
    awayScore: 12,
    halfTimeScore: null,
    manAdvantage: null,
    manAdvantageSecondsLeft: null,
    saveRate: { home: 68, away: 63 },
    transitionSpeed: 1.1,
    sevenMeterRate: 32,
    ...over,
  };
}

const byId = (b: ReturnType<typeof handballLiveMarkets>, id: string) => b.markets.find((m) => m.id === id);
const probOf = (b: ReturnType<typeof handballLiveMarkets>, market: string, outcome: string) =>
  byId(b, market)?.outcomes.find((o) => o.id === outcome)?.prob ?? 0;

// ─── Vainqueur du match ────────────────────────────────────────────────────

describe("live-handball — vainqueur du match", () => {
  test("2 issues seulement (le handball n'a pas de nul)", () => {
    const b = handballLiveMarkets(base());
    expect(byId(b, "match-winner")?.outcomes.map((o) => o.id)).toEqual(["home", "away"]);
  });

  test("avance de 2 buts → domicile favori", () => {
    const b = handballLiveMarkets(base());
    expect(probOf(b, "match-winner", "home")).toBeGreaterThan(probOf(b, "match-winner", "away"));
  });

  test("retard de 3 buts à la 55' → extérieur favori", () => {
    const b = handballLiveMarkets(base({ minute: 55, homeScore: 20, awayScore: 23 }));
    expect(probOf(b, "match-winner", "away")).toBeGreaterThan(probOf(b, "match-winner", "home"));
  });

  test("somme 1 quel que soit l'état", () => {
    for (const inp of [base(), base({ minute: 0 }), base({ minute: 60 }), base({ minute: 30 })]) {
      const b = handballLiveMarkets(inp);
      expect(probOf(b, "match-winner", "home") + probOf(b, "match-winner", "away")).toBeCloseTo(1, 6);
    }
  });

  test("temps additionnel (minute > 60) toléré", () => {
    const b = handballLiveMarkets(base({ minute: 61, homeScore: 25, awayScore: 25 }));
    expect(probOf(b, "match-winner", "home")).toBeGreaterThan(0);
    expect(probOf(b, "match-winner", "home")).toBeLessThan(1);
  });
});

// ─── Mi-temps ──────────────────────────────────────────────────────────────

describe("live-handball — mi-temps", () => {
  test("avant la pause → marché prédictif", () => {
    const b = handballLiveMarkets(base({ minute: 20 }));
    expect(probOf(b, "half-time-winner", "home") + probOf(b, "half-time-winner", "away")).toBeCloseTo(1, 6);
  });

  test("après la pause → marché archivé (issue tranchée)", () => {
    const b = handballLiveMarkets(
      base({ minute: 40, halfTimeScore: { home: 15, away: 14 } })
    );
    expect(probOf(b, "half-time-winner", "home")).toBeGreaterThan(0.9);
    expect(byId(b, "half-time-winner")?.hint).toContain("archivé");
  });

  test("mi-temps à égalité → issue non dégénérée (pas de 100 %/0 %)", () => {
    const b = handballLiveMarkets(base({ minute: 40, halfTimeScore: { home: 12, away: 12 } }));
    // Ni l'un ni l'autre ne gagne la mi-temps : ni 100 % ni 0 % grâce au bornage.
    expect(probOf(b, "half-time-winner", "home")).toBeGreaterThan(0);
    expect(probOf(b, "half-time-winner", "home")).toBeLessThan(1);
  });

  test("λ mi-temps plus faibles que λ match", () => {
    const b = handballLiveMarkets(base({ minute: 20 }));
    // Marché de mi-temps plus proche de 50/50 que le match quand le score est
    // serré : c'est le signe que le λ a bien été restreint à la fenêtre.
    const gap = (b: ReturnType<typeof handballLiveMarkets>) =>
      Math.abs(probOf(b, "match-winner", "home") - 0.5) -
      Math.abs(probOf(b, "half-time-winner", "home") - 0.5);
    expect(gap(b)).toBeGreaterThanOrEqual(-1e-9);
  });
});

// ─── Avantage numérique ────────────────────────────────────────────────────

describe("live-handball — avantage numérique", () => {
  test("aucun marché PP sans avantage en cours", () => {
    const b = handballLiveMarkets(base());
    expect(byId(b, "two-minute-impact")).toBeUndefined();
  });

  test("deux marchés PP (≥1 but, ≥2 buts) quand l'avantage est actif", () => {
    const b = handballLiveMarkets(base({ manAdvantage: "away", manAdvantageSecondsLeft: 90 }));
    expect(byId(b, "two-minute-impact")).toBeDefined();
    expect(byId(b, "two-minute-impact-2plus")).toBeDefined();
  });

  test("≥2 buts toujours moins probable que ≥1 but", () => {
    const b = handballLiveMarkets(base({ manAdvantage: "away", manAdvantageSecondsLeft: 120 }));
    expect(probOf(b, "two-minute-impact-2plus", "over2")).toBeLessThan(
      probOf(b, "two-minute-impact", "over1")
    );
  });

  test("issues complémentaires sur chaque marché PP", () => {
    const b = handballLiveMarkets(base({ manAdvantage: "home", manAdvantageSecondsLeft: 60 }));
    expect(probOf(b, "two-minute-impact", "over1") + probOf(b, "two-minute-impact", "none")).toBeCloseTo(1, 6);
    expect(probOf(b, "two-minute-impact-2plus", "over2") + probOf(b, "two-minute-impact-2plus", "under2")).toBeCloseTo(1, 6);
  });

  test("fenêtre plus longue → P(but) plus grande", () => {
    const court = handballLiveMarkets(base({ manAdvantage: "home", manAdvantageSecondsLeft: 30 }));
    const long = handballLiveMarkets(base({ manAdvantage: "home", manAdvantageSecondsLeft: 120 }));
    expect(probOf(long, "two-minute-impact", "over1")).toBeGreaterThan(
      probOf(court, "two-minute-impact", "over1")
    );
  });

  test("avantage en cours favorise le camp concerné", () => {
    const b = handballLiveMarkets(base({ manAdvantage: "home", manAdvantageSecondsLeft: 90 }));
    expect(probOf(b, "match-winner", "home")).toBeGreaterThan(probOf(b, "match-winner", "away"));
  });
});

// ─── Prochaine attaque ─────────────────────────────────────────────────────

describe("live-handball — prochaine attaque", () => {
  test("2 issues exclusives sommant à 1", () => {
    const b = handballLiveMarkets(base());
    expect(probOf(b, "next-attack", "scored") + probOf(b, "next-attack", "empty")).toBeCloseTo(1, 6);
  });

  test("taux de 7 m plus élevé → attaque plus souvent marquée", () => {
    const peu = handballLiveMarkets(base({ sevenMeterRate: 15 }));
    const beaucoup = handballLiveMarkets(base({ sevenMeterRate: 45 }));
    expect(probOf(beaucoup, "next-attack", "scored")).toBeGreaterThan(
      probOf(peu, "next-attack", "scored")
    );
  });

  test("P(marquage) toujours dans une plage jouable", () => {
    for (const rate of [15, 30, 45]) {
      const b = handballLiveMarkets(base({ sevenMeterRate: rate }));
      const p = probOf(b, "next-attack", "scored");
      expect(p).toBeGreaterThan(0.3);
      expect(p).toBeLessThan(0.9);
    }
  });

  test("scope = micro", () => {
    expect(byId(handballLiveMarkets(base()), "next-attack")?.scope).toBe("micro");
  });
});

// ─── Over/Under total ──────────────────────────────────────────────────────

describe("live-handball — Over/Under total", () => {
  test("issues complémentaires", () => {
    const b = handballLiveMarkets(base());
    expect(probOf(b, "ou-total", "over") + probOf(b, "ou-total", "under")).toBeCloseTo(1, 6);
  });

  test("ligne ajustée au score courant + λ restants", () => {
    const b = handballLiveMarkets(base({ minute: 24, homeScore: 14, awayScore: 12 }));
    const line = Number((byId(b, "ou-total")?.label.match(/Under (\d+)/)?.[1]) ?? 0);
    // 26 buts marqués + ~34 restants = ~60 au total → ligne 60.
    expect(line).toBeGreaterThan(50);
    expect(line).toBeLessThan(75);
  });

  test("match très avancé, même ratio de score → ligne plus haute", () => {
    // À score ÉGAL, plus il reste de temps, plus la projection est haute. Le
    // score brut ne suffit pas : c'est la comparaison à temps constant qui
    // isole l'effet « match avancé ».
    const line = (b: ReturnType<typeof handballLiveMarkets>) =>
      Number(byId(b, "ou-total")?.label.match(/Under (\d+)/)?.[1] ?? 0);
    const debut = handballLiveMarkets(base({ minute: 20, homeScore: 14, awayScore: 14 }));
    const fin = handballLiveMarkets(base({ minute: 50, homeScore: 24, awayScore: 24 }));
    expect(line(debut)).toBeGreaterThan(line(fin));
  });
});

// ─── Drivers ───────────────────────────────────────────────────────────────

describe("live-handball — drivers", () => {
  test("arrêts, transition, avantage, écart, temps exposés", () => {
    const b = handballLiveMarkets(base());
    const labels = b.drivers.map((d) => d.label);
    expect(labels).toContain("Arrêts gardien dom.");
    expect(labels).toContain("Vitesse transition");
    expect(labels).toContain("Avantage numérique");
    for (const d of b.drivers) {
      expect(d.ratio).toBeGreaterThanOrEqual(0);
      expect(d.ratio).toBeLessThanOrEqual(1);
    }
  });

  test("% d'arrêts affiché", () => {
    const b = handballLiveMarkets(base());
    expect(b.drivers.find((d) => d.label === "Arrêts gardien dom.")?.display).toBe("68 %");
  });

  test("gardien à 65 % = neutre : λ inchangé", () => {
    const neutre = handballLiveMarkets(base({ saveRate: { home: 65, away: 65 } }));
    const asym = handballLiveMarkets(base({ saveRate: { home: 65, away: 65 } }));
    expect(probOf(neutre, "match-winner", "home")).toBeCloseTo(probOf(asym, "match-winner", "home"), 9);
  });

  test("gardien du côté adverse plus efficace → λ adverse plus bas", () => {
    // Le % d'arrêts du DOMICILE réduit le λ de l'EXTÉRIEUR : c'est le
    // gardien adverse qu'il faut dégrader pour favoriser le domicile.
    const bonGardien = handballLiveMarkets(base({ saveRate: { home: 78, away: 60 } }));
    const mauvaisGardien = handballLiveMarkets(base({ saveRate: { home: 50, away: 60 } }));
    expect(probOf(bonGardien, "match-winner", "home")).toBeGreaterThan(
      probOf(mauvaisGardien, "match-winner", "home")
    );
  });

  test("vitesse de transition plus élevée → plus de buts projetés", () => {
    const lent = handballLiveMarkets(base({ transitionSpeed: 0.8 }));
    const rapide = handballLiveMarkets(base({ transitionSpeed: 1.3 }));
    const line = (b: ReturnType<typeof handballLiveMarkets>) =>
      Number(byId(b, "ou-total")?.label.match(/Under (\d+)/)?.[1] ?? 0);
    expect(line(rapide)).toBeGreaterThan(line(lent));
  });

  test("horloge à la minute", () => {
    const b = handballLiveMarkets(base({ minute: 24.6 }));
    expect(b.clock).toBe("24'");
  });
});