// Tests du moteur live BASKETBALL — pace, PPP, prolongation, handicap, race.
import { describe, expect, test } from "bun:test";
import { basketballLiveMarkets, type BasketballLiveInput } from "@/lib/prediction/live-basketball";

function base(over: Partial<BasketballLiveInput> = {}): BasketballLiveInput {
  return {
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
    ...over,
  };
}

const byId = (b: ReturnType<typeof basketballLiveMarkets>, id: string) => b.markets.find((m) => m.id === id);
const probOf = (b: ReturnType<typeof basketballLiveMarkets>, market: string, outcome: string) =>
  byId(b, market)?.outcomes.find((o) => o.id === outcome)?.prob ?? 0;

// ─── Vainqueur du match ────────────────────────────────────────────────────

describe("live-basketball — vainqueur du match", () => {
  test("avance de 4 points avec 18 min restantes → domicile favori", () => {
    const b = basketballLiveMarkets(base());
    expect(probOf(b, "match-winner", "home")).toBeGreaterThan(probOf(b, "match-winner", "away"));
  });

  test("retard de 8 points en fin de 4e → extérieur favori", () => {
    const b = basketballLiveMarkets(
      base({ period: 4, periodMinutesLeft: 1.2, homeScore: 88, awayScore: 96 })
    );
    expect(probOf(b, "match-winner", "away")).toBeGreaterThan(probOf(b, "match-winner", "home"));
  });

  test("égalité à la sonnette → prolongation 50/50", () => {
    const b = basketballLiveMarkets(
      base({ period: 4, periodMinutesLeft: 0, homeScore: 100, awayScore: 100 })
    );
    const p = probOf(b, "match-winner", "home");
    expect(Math.abs(p - 0.5)).toBeLessThan(0.05);
  });

  test("fin de match avec avance nette → quasi certain", () => {
    const b = basketballLiveMarkets(
      base({ period: 4, periodMinutesLeft: 0, homeScore: 110, awayScore: 100 })
    );
    expect(probOf(b, "match-winner", "home")).toBeGreaterThan(0.95);
  });

  test("les 2 issues somment à 1", () => {
    for (const inp of [base(), base({ period: 1, periodMinutesLeft: 12 }), base({ period: 4, periodMinutesLeft: 0 })]) {
      const b = basketballLiveMarkets(inp);
      expect(probOf(b, "match-winner", "home") + probOf(b, "match-winner", "away")).toBeCloseTo(1, 6);
    }
  });
});

// ─── Vainqueur de quartier ─────────────────────────────────────────────────

describe("live-basketball — vainqueur du quartier", () => {
  test("λ du quartier < λ du match, et le marché ignore le score cumulé", () => {
    const b = basketballLiveMarkets(base({ period: 3, periodMinutesLeft: 2 }));
    const qHome = probOf(b, "quarter-winner", "home");
    const mHome = probOf(b, "match-winner", "home");
    // Le marché du quartier se joue sur les points DU quartier (départ 0-0) :
    // avec 78-74 au cumulé, un marché calculé sur le score cumulé affichait
    // 90 % au quartierur — ce qui ne veut rien dire.
    expect(Math.abs(qHome - 0.5)).toBeLessThan(Math.abs(mHome - 0.5));
  });

  test("quartier : domicile qui domine l'eFG% → favori du quartier", () => {
    const neutre = basketballLiveMarkets(
      base({ period: 3, periodMinutesLeft: 12, homeEfg: 0.54, awayEfg: 0.54, homeFga: 70, awayFga: 70 })
    );
    const dom = basketballLiveMarkets(
      base({ period: 3, periodMinutesLeft: 12, homeEfg: 0.68, awayEfg: 0.48, homeFga: 70, awayFga: 70 })
    );
    expect(probOf(dom, "quarter-winner", "home")).toBeGreaterThan(
      probOf(neutre, "quarter-winner", "home")
    );
  });

  test("quartier en cours nommé dans le libellé", () => {
    const b = basketballLiveMarkets(base({ period: 2 }));
    expect(byId(b, "quarter-winner")?.label).toContain("Q2");
  });

  test("scope = period (filtre par pilules)", () => {
    expect(byId(basketballLiveMarkets(base()), "quarter-winner")?.scope).toBe("period");
  });
});

// ─── Handicap live ─────────────────────────────────────────────────────────

describe("live-basketball — handicap live", () => {
  test("ligne = marge attendue arrondie au demi-point", () => {
    const b = basketballLiveMarkets(base());
    const label = byId(b, "handicap-live")?.label ?? "";
    expect(label).toMatch(/Handicap [+-]?\d+(\.5)? \(Domicile\)/);
  });

  test("les deux côtés du handicap somment à 1", () => {
    const b = basketballLiveMarkets(base());
    expect(probOf(b, "handicap-live", "home") + probOf(b, "handicap-live", "away")).toBeCloseTo(1, 6);
  });

  test("ligne nulle → 50/50 quand le score est à égalité en fin de match", () => {
    const b = basketballLiveMarkets(
      base({ period: 4, periodMinutesLeft: 0, homeScore: 100, awayScore: 100 })
    );
    expect(Math.abs(probOf(b, "handicap-live", "home") - 0.5)).toBeLessThan(0.06);
  });

  test("ligne demi-point → jamais de push", () => {
    // Une ligne .5 n'est jamais atteinte exactement : la somme doit valoir 1.
    const b = basketballLiveMarkets(base({ period: 4, periodMinutesLeft: 5, homeScore: 90, awayScore: 88 }));
    expect(probOf(b, "handicap-live", "home") + probOf(b, "handicap-live", "away")).toBeCloseTo(1, 6);
  });
});

// ─── Race to X ─────────────────────────────────────────────────────────────

describe("live-basketball — race to X points", () => {
  test("cible = multiple de 5 au-dessus du score le plus élevé + 5", () => {
    const b = basketballLiveMarkets(base());
    const label = byId(b, "race-to-x")?.label ?? "";
    const target = Number(label.replace(/\D+/g, ""));
    expect(Number.isFinite(target)).toBe(true);
    expect(target % 5).toBe(0);
    expect(target).toBeGreaterThanOrEqual(80);
  });

  test("avance de 4 points → le Course la favorise", () => {
    const b = basketballLiveMarkets(base());
    expect(probOf(b, "race-to-x", "home")).toBeGreaterThan(0.5);
  });

  test("retard important → la Course favodit l'extérieur", () => {
    const b = basketballLiveMarkets(base({ homeScore: 60, awayScore: 72 }));
    expect(probOf(b, "race-to-x", "away")).toBeGreaterThan(0.5);
  });

  test("les 2 issues somment à 1", () => {
    const b = basketballLiveMarkets(base());
    expect(probOf(b, "race-to-x", "home") + probOf(b, "race-to-x", "away")).toBeCloseTo(1, 6);
  });

  test("symétrie : score à égalité, λ égaux → 50/50", () => {
    const b = basketballLiveMarkets(
      base({ homeScore: 70, awayScore: 70, homeFga: 70, awayFga: 70, homeEfg: 0.54, awayEfg: 0.54 })
    );
    expect(Math.abs(probOf(b, "race-to-x", "home") - 0.5)).toBeLessThan(0.02);
  });
});

// ─── Type du prochain panier ───────────────────────────────────────────────

describe("live-basketball — valeur du prochain panier", () => {
  test("3 issues exclusives sommant à 1", () => {
    const b = basketballLiveMarkets(base());
    const m = byId(b, "next-basket-type");
    expect(m?.outcomes.map((o) => o.id)).toEqual(["three", "two", "ft"]);
    expect(m?.outcomes.reduce((a, o) => a + o.prob, 0)).toBeCloseTo(1, 6);
  });

  test("équipe qui shoot beaucoup en 3 → part « 3 points » plus haute", () => {
    const peu = basketballLiveMarkets(base({ homeThreeMade: 1, awayThreeMade: 1, homeThreeAtt: 30, awayThreeAtt: 28 }));
    const beaucoup = basketballLiveMarkets(base());
    expect(probOf(beaucoup, "next-basket-type", "three")).toBeGreaterThan(
      probOf(peu, "next-basket-type", "three")
    );
  });

  test("sans aucune donnée 3 points → valeurs de repli stables", () => {
    const b = basketballLiveMarkets(
      base({ homeThreeMade: null, awayThreeMade: null, homeThreeAtt: null, awayThreeAtt: null })
    );
    expect(probOf(b, "next-basket-type", "three")).toBeGreaterThan(0.1);
    expect(probOf(b, "next-basket-type", "three")).toBeLessThan(0.5);
  });
});

// ─── O/U total ─────────────────────────────────────────────────────────────

describe("live-basketball — Over/Under total", () => {
  test("issues complémentaires", () => {
    const b = basketballLiveMarkets(base());
    expect(probOf(b, "ou-total", "over") + probOf(b, "ou-total", "under")).toBeCloseTo(1, 6);
  });

  test("score bas et 30 s restantes → Under certain (marché archivé, pas borné)", () => {
    const b = basketballLiveMarkets(
      base({ period: 4, periodMinutesLeft: 0.5, homeScore: 95, awayScore: 97 })
    );
    // 192 points à 30 s de la fin : l'Under 210.5 est arithmétiquement gagné.
    // Le marché passe par `resolvedMarket` → pas de bornage. L'écart à 1 vient
    // de la troncature de la PMF de Poisson renormalisée.
    expect(probOf(b, "ou-total", "under")).toBeCloseTo(1, 6);
    expect(probOf(b, "ou-total", "over")).toBeCloseTo(0, 6);
  });

  test("match en cours (temps résiduel large) → bornage appliqué", () => {
    const b = basketballLiveMarkets(base());
    // Issues encore calculables : bornage [2 %, 98 %] actif.
    for (const o of byId(b, "ou-total")?.outcomes ?? []) {
      expect(o.prob).toBeGreaterThanOrEqual(0.02 - 1e-9);
      expect(o.prob).toBeLessThanOrEqual(0.98 + 1e-9);
    }
  });
});

// ─── Pace et drivers ───────────────────────────────────────────────────────

describe("live-basketball — pace et drivers", () => {
  test("pace affichée cohérente avec les FGA observés", () => {
    // 139 FGA sur ~29.6 min jouées ≈ 94 poss/48.
    const b = basketballLiveMarkets(base());
    const pace = b.drivers.find((d) => d.label === "Pace");
    expect(pace?.display).toMatch(/\d+ poss\/48/);
    const value = Number(pace?.display.split(" ")[0]);
    expect(value).toBeGreaterThan(70);
    expect(value).toBeLessThan(130);
  });

  test("sans FGA → pace de ligue", () => {
    const b = basketballLiveMarkets(base({ homeFga: null, awayFga: null }));
    expect(b.drivers.find((d) => d.label === "Pace")?.display).toBe("99 poss/48");
  });

  test("eFG% fort au domicile → jauge plus haute", () => {
    const fort = basketballLiveMarkets(base({ homeEfg: 0.7, awayEfg: 0.45 }));
    expect(fort.drivers.find((d) => d.label === "eFG% domicile")?.ratio ?? 0).toBeGreaterThan(
      fort.drivers.find((d) => d.label === "eFG% extérieur")?.ratio ?? 1
    );
  });

  test("horloge du quartile formatée", () => {
    const b = basketballLiveMarkets(base({ period: 3, periodMinutesLeft: 6.4 }));
    expect(b.clock).toBe("Q3 6:24");
  });

  test("prolongation : λ non négatif (pas de quart négatif)", () => {
    const b = basketballLiveMarkets(base({ period: 6, periodMinutesLeft: -3 }));
    expect(probOf(b, "match-winner", "home")).toBeGreaterThan(0);
    expect(probOf(b, "match-winner", "home")).toBeLessThan(1);
  });
});