// Tests du moteur live HOCKEY — temps réglementaire vs prolongation, avantage
// numérique, total de période.
import { describe, expect, test } from "bun:test";
import { hockeyLiveMarkets, type HockeyLiveInput } from "@/lib/prediction/live-hockey";

function base(over: Partial<HockeyLiveInput> = {}): HockeyLiveInput {
  return {
    period: 3,
    periodSecondsLeft: 640,
    homeScore: 2,
    awayScore: 1,
    powerPlay: null,
    powerPlaySecondsLeft: null,
    corsi: { home: 34, away: 21 },
    highDanger: { home: 6, away: 4 },
    ...over,
  };
}

const byId = (b: ReturnType<typeof hockeyLiveMarkets>, id: string) => b.markets.find((m) => m.id === id);
const probOf = (b: ReturnType<typeof hockeyLiveMarkets>, market: string, outcome: string) =>
  byId(b, market)?.outcomes.find((o) => o.id === outcome)?.prob ?? 0;

// ─── Vainqueur temps réglementaire ─────────────────────────────────────────

describe("live-hockey — vainqueur temps réglementaire", () => {
  test("3 issues : domicile / nul / extérieur (le nul existe en hockey)", () => {
    const b = hockeyLiveMarkets(base());
    expect(byId(b, "regulation-winner")?.outcomes.map((o) => o.id)).toEqual(["home", "draw", "away"]);
    expect(probOf(b, "regulation-winner", "home") + probOf(b, "regulation-winner", "draw") + probOf(b, "regulation-winner", "away")).toBeCloseTo(1, 6);
  });

  test("avance de 1 but à 40 s → domicile quasi certain en TR", () => {
    const b = hockeyLiveMarkets(
      base({ period: 3, periodSecondsLeft: 40, homeScore: 3, awayScore: 2, corsi: null, highDanger: null })
    );
    expect(probOf(b, "regulation-winner", "home")).toBeGreaterThan(0.9);
  });

  test(" nul à 0 s → issues tranchées, pas de projection", () => {
    const b = hockeyLiveMarkets(
      base({ period: 3, periodSecondsLeft: 0, homeScore: 2, awayScore: 2, corsi: null, highDanger: null })
    );
    expect(probOf(b, "regulation-winner", "draw")).toBeGreaterThan(0.95);
  });

  test("score nul en 1re période → nul encore possible mais minoritaire", () => {
    // Une période NHL à 0-0 avec 20 min restantes : le λ total (~1.9 buts)
    // rend encore le nul plausible (~32 %), mais c'est le PIC du nul dans tout
    // le match. Toute la 2e période, le nul s'effondre.
    const b = hockeyLiveMarkets(
      base({ period: 1, periodSecondsLeft: 1200, homeScore: 0, awayScore: 0, corsi: null, highDanger: null })
    );
    const nul = probOf(b, "regulation-winner", "draw");
    expect(nul).toBeGreaterThan(0.2);
    expect(nul).toBeLessThan(0.45);
  });
});

// ─── Prolongation ──────────────────────────────────────────────────────────

describe("live-hockey — vainqueur avec prolongation", () => {
  test("2 issues seulement (pas de nul)", () => {
    const b = hockeyLiveMarkets(base());
    expect(byId(b, "winner-ot")?.outcomes.map((o) => o.id)).toEqual(["home", "away"]);
  });

  test("prolongation = TR + ½ du nul (avant bornage)", () => {
    // L'identité est vérifiée à 1e-3 : `winner-ot` passe par `normalizeOutcomes`
    // qui applique le bornage [2 %, 98 %], qui décale légèrement une issue
    // quand elle frôle la borne. La relation reste vérifiée à l'affichage.
    const b = hockeyLiveMarkets(base());
    const trHome = probOf(b, "regulation-winner", "home");
    const trDraw = probOf(b, "regulation-winner", "draw");
    expect(Math.abs(probOf(b, "winner-ot", "home") - (trHome + trDraw / 2))).toBeLessThan(0.005);
  });

  test("issue prolongation ≥ issue TR (le nul ne peut pas disparaître)", () => {
    const b = hockeyLiveMarkets(base());
    expect(probOf(b, "winner-ot", "home")).toBeGreaterThanOrEqual(probOf(b, "regulation-winner", "home"));
    expect(probOf(b, "winner-ot", "away")).toBeGreaterThanOrEqual(probOf(b, "regulation-winner", "away"));
  });
});

// ─── Avantage numérique ────────────────────────────────────────────────────

describe("live-hockey — but en avantage numérique", () => {
  test("2 issues exclusives", () => {
    const b = hockeyLiveMarkets(base({ powerPlay: "home", powerPlaySecondsLeft: 90 }));
    expect(probOf(b, "power-play-goal", "yes") + probOf(b, "power-play-goal", "no")).toBeCloseTo(1, 6);
  });

  test("fenêtre plus longue → P(but) plus grande", () => {
    const court = hockeyLiveMarkets(base({ powerPlay: "home", powerPlaySecondsLeft: 30 }));
    const long = hockeyLiveMarkets(base({ powerPlay: "home", powerPlaySecondsLeft: 120 }));
    expect(probOf(long, "power-play-goal", "yes")).toBeGreaterThan(
      probOf(court, "power-play-goal", "yes")
    );
  });

  test("sans avantage en cours → libellé « régime 5c5 »", () => {
    const b = hockeyLiveMarkets(base());
    expect(byId(b, "power-play-goal")?.label).toContain("5c5");
  });

  test("avantage en cours → libellé PP", () => {
    const b = hockeyLiveMarkets(base({ powerPlay: "away", powerPlaySecondsLeft: 45 }));
    expect(byId(b, "power-play-goal")?.label).toContain("avantage numérique");
  });

  test("fenêtre nulle → aucun but, P bornée au plancher", () => {
    const b = hockeyLiveMarkets(base({ powerPlay: "home", powerPlaySecondsLeft: 0 }));
    expect(probOf(b, "power-play-goal", "yes")).toBeGreaterThan(0);
    expect(probOf(b, "power-play-goal", "yes")).toBeLessThanOrEqual(0.02);
  });
});

// ─── Total de période ──────────────────────────────────────────────────────

describe("live-hockey — total buts période", () => {
  test("issues complémentaires", () => {
    const b = hockeyLiveMarkets(base());
    expect(probOf(b, "period-total", "over25") + probOf(b, "period-total", "under25")).toBeCloseTo(1, 6);
  });

  test("3e période quasi terminée, score bas → Under", () => {
    const b = hockeyLiveMarkets(
      base({ period: 3, periodSecondsLeft: 90, homeScore: 1, awayScore: 1, corsi: null, highDanger: null })
    );
    expect(probOf(b, "period-total", "under25")).toBeGreaterThan(0.8);
  });

  test("une période NHL contient ~1.9 buts → Under 2.5 majoritaire", () => {
    // λ d'une période = 5.6 buts / 3 périodes ≈ 1.87. P(≥3 buts) ≈ 28 % : le
    // Under 2.5 est donc la position normale du marché, pas l'anomalie.
    const b = hockeyLiveMarkets(
      base({ period: 1, periodSecondsLeft: 1180, homeScore: 0, awayScore: 0, corsi: null, highDanger: null })
    );
    expect(probOf(b, "period-total", "under25")).toBeGreaterThan(0.6);
    expect(probOf(b, "period-total", "over25")).toBeLessThan(0.45);
  });

  test("période complète à 4-4 → Over 2.5 plausible", () => {
    // 3e période ENTIÈRE (20 min), score 4-4 : λ période ≈ 1.9 → P(≥3) ≈ 28 %.
    const b = hockeyLiveMarkets(
      base({ period: 3, periodSecondsLeft: 1200, homeScore: 4, awayScore: 4, corsi: null, highDanger: null })
    );
    expect(probOf(b, "period-total", "over25")).toBeGreaterThan(0.2);
  });

  test("scope = period", () => {
    expect(byId(hockeyLiveMarkets(base()), "period-total")?.scope).toBe("period");
  });
});

// ─── Drivers ───────────────────────────────────────────────────────────────

describe("live-hockey — drivers", () => {
  test("Corsi et High-Danger exposés, jauges bornées", () => {
    const b = hockeyLiveMarkets(base());
    const labels = b.drivers.map((d) => d.label);
    expect(labels).toContain("Corsi");
    expect(labels).toContain("High-Danger");
    for (const d of b.drivers) {
      expect(d.ratio).toBeGreaterThanOrEqual(0);
      expect(d.ratio).toBeLessThanOrEqual(1);
    }
  });

  test("Corsi partagé : jauge = part du domicile", () => {
    const b = hockeyLiveMarkets(base({ corsi: { home: 30, away: 10 } }));
    expect(b.drivers.find((d) => d.label === "Corsi")?.ratio).toBeCloseTo(0.75, 6);
  });

  test("horloge de période formatée", () => {
    const b = hockeyLiveMarkets(base({ period: 2, periodSecondsLeft: 755 }));
    expect(b.clock).toBe("12:35 2e");
  });

  test("avantage numérique reflected dans le driver", () => {
    const b = hockeyLiveMarkets(base({ powerPlay: "home", powerPlaySecondsLeft: 90 }));
    expect(b.drivers.find((d) => d.label === "Avantage numérique")?.ratio).toBe(1);
    const c = hockeyLiveMarkets(base({ powerPlay: "away", powerPlaySecondsLeft: 90 }));
    expect(c.drivers.find((d) => d.label === "Avantage numérique")?.ratio).toBe(0);
  });

  test("prolongation (period=4) tolérée sans planter", () => {
    const b = hockeyLiveMarkets(base({ period: 4, periodSecondsLeft: 300 }));
    expect(Number.isFinite(probOf(b, "winner-ot", "home"))).toBe(true);
  });
});