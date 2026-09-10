import { describe, it, expect } from "bun:test";
import { tennisPowerScore, footballPowerScore } from "@/lib/power-score";

// ─── Tennis ───────────────────────────────────────────────────────────────────

describe("tennisPowerScore", () => {
  it("score parfait → ~95 (clamp haut)", () => {
    const ps = tennisPowerScore({
      surfaceElo: 2200,
      form: ["W", "W", "W", "W", "W"],
      holdPct: 90,
      returnPct: 45,
      sps: 95,
      fatigueLoad: 0,
    });
    expect(ps.score).toBeGreaterThanOrEqual(85);
    expect(ps.coverage).toBe(1);
  });

  it("métriques absentes → renormalisation (pas de 50 arbitraire)", () => {
    const full = tennisPowerScore({
      surfaceElo: 2000,
      form: ["W", "W", "W", "W", "W"],
      holdPct: 85,
      returnPct: 40,
      sps: 80,
      fatigueLoad: 0,
    });
    const partial = tennisPowerScore({ surfaceElo: 2000 });
    // Élo seul à 2000 → (2000-1400)/8 = 75
    expect(partial.score).toBe(75);
    expect(partial.coverage).toBeCloseTo(0.3, 2);
    expect(full.coverage).toBe(1);
  });

  it("aucune donnée → 50 neutre, couverture 0", () => {
    const ps = tennisPowerScore({});
    expect(ps.score).toBe(50);
    expect(ps.coverage).toBe(0);
  });

  it("eloKnown false → Élo exclu (pas de 1500 factice)", () => {
    const ps = tennisPowerScore({ surfaceElo: 1500, eloKnown: false, form: ["W", "W", "W", "W", "W"] });
    // Seule la forme compte → 100, couverture 0.15
    expect(ps.score).toBe(100);
    expect(ps.coverage).toBeCloseTo(0.15, 2);
    expect(ps.metrics.find((m) => m.key === "elo")!.value).toBeNull();
  });

  it("pondérations v2 : service > forme (Élo 30, service 20, forme/retour 15)", () => {
    const ps = tennisPowerScore({
      surfaceElo: 1800, // (1800-1400)/8 = 50
      form: ["W", "W", "W", "L", "L"], // 60
      holdPct: 80,
      returnPct: 30,
      sps: 70,
      fatigueLoad: 0, // fraîcheur 100
    });
    // 50*.3 + 80*.2 + 60*.15 + 30*.15 + 70*.1 + 100*.1 = 61.5 → 62
    expect(ps.score).toBe(62);
    expect(ps.metrics.find((m) => m.key === "serve")!.weight).toBe(20);
    expect(ps.metrics.find((m) => m.key === "form")!.weight).toBe(15);
  });

  it("forme < 3 matchs → ignorée", () => {
    const ps = tennisPowerScore({ surfaceElo: 1800, form: ["W", "L"] });
    expect(ps.coverage).toBeCloseTo(0.3, 2);
  });
});

// ─── Foot ─────────────────────────────────────────────────────────────────────

describe("footballPowerScore", () => {
  it("grosse équipe à domicile → score élevé", () => {
    const ps = footballPowerScore({
      formPpg: 2.6,
      venuePpg: 2.8,
      scoredPg: 2.4,
      concededPg: 0.8,
    });
    expect(ps.score).toBeGreaterThanOrEqual(70);
  });

  it("métriques absentes → renormalisation", () => {
    const ps = footballPowerScore({ formPpg: 3 });
    // Forme seule parfaite → 100 clampé 95 (garde-fou anti-certitude)
    expect(ps.score).toBe(95);
    expect(ps.coverage).toBeCloseTo(0.3, 2);
  });

  it("aucune donnée → 50 neutre", () => {
    expect(footballPowerScore({}).score).toBe(50);
  });
});
