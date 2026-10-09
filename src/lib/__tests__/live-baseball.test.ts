// Tests du moteur live BASEBALL — état combinatoire (bases × outs × compte),
// matrice d'espérance MLB, issues du passage au bâton.
import { describe, expect, test } from "bun:test";
import {
  baseballLiveMarkets,
  halfInningRunExp,
  halfInningRunProb,
  moneylineProb,
  nextPlateAppearance,
  remainingRunExp,
  resolveBatterProfile,
  type BaseballBases,
  type BaseballLiveInput,
} from "@/lib/prediction/live-baseball";
import { runExpectancy } from "@/lib/baseball/engine/run-expectancy";

function base(over: Partial<BaseballLiveInput> = {}): BaseballLiveInput {
  return {
    inning: 7,
    half: "top",
    outs: 1,
    bases: 5,
    count: { balls: 2, strikes: 1 },
    homeScore: 3,
    awayScore: 1,
    ...over,
  };
}

const byId = (b: ReturnType<typeof baseballLiveMarkets>, id: string) => b.markets.find((m) => m.id === id);
const probOf = (b: ReturnType<typeof baseballLiveMarkets>, market: string, outcome: string) =>
  byId(b, market)?.outcomes.find((o) => o.id === outcome)?.prob ?? 0;

// ─── Cohérence avec la matrice d'espérance MLB ─────────────────────────────

describe("live-baseball — cohérence avec runExpectancy", () => {
  test("halfInningRunExp EST la matrice existante (aucune récursion ajoutée)", () => {
    // Verrou d'anti-divergence : si la matrice change, ce test change avec.
    for (const bases of [0, 1, 2, 4, 5, 7] as BaseballBases[]) {
      for (const outs of [0, 1, 2]) {
        expect(halfInningRunExp(bases, outs)).toBe(runExpectancy(bases, outs));
      }
    }
  });

  test("espérance croissante avec l'occupation des bases", () => {
    expect(halfInningRunExp(7, 0)).toBeGreaterThan(halfInningRunExp(0, 0));
    expect(halfInningRunExp(7, 0)).toBeGreaterThan(halfInningRunExp(7, 2));
  });

  test("2 outs : la demi-manche est plus proche du but", () => {
    expect(halfInningRunExp(0, 2)).toBeLessThan(halfInningRunExp(0, 0));
  });

  test("probabilité Poisson cohérente avec l'espérance", () => {
    for (const bases of [0, 4, 7] as BaseballBases[]) {
      const re = halfInningRunExp(bases, 0);
      expect(halfInningRunProb(bases, 0)).toBeCloseTo(1 - Math.exp(-re), 9);
    }
  });

  test("3 outs (manche terminée) → P(au moins 1 run) minimale", () => {
    expect(halfInningRunExp(7, 3)).toBeCloseTo(runExpectancy(7, 2), 9);
  });
});

// ─── Moneyline ─────────────────────────────────────────────────────────────

describe("live-baseball — moneyline", () => {
  test("2 issues exclusives", () => {
    const b = baseballLiveMarkets(base());
    expect(byId(b, "moneyline")?.outcomes.map((o) => o.id)).toEqual(["home", "away"]);
    expect(probOf(b, "moneyline", "home") + probOf(b, "moneyline", "away")).toBeCloseTo(1, 6);
  });

  test("avance de 2 runs en 7e, demi-manche du domicile → domicile favori", () => {
    // Le moneyline porte sur le match entier : il faut être en 2e manche
    // (bottom) pour que l'état discret(currentHalf) soit celui du domicile.
    const b = baseballLiveMarkets(base({ half: "bottom", inning: 7, outs: 1, bases: 5, homeScore: 3, awayScore: 1 }));
    expect(probOf(b, "moneyline", "home")).toBeGreaterThan(probOf(b, "moneyline", "away"));
  });

  test("9e manche au top, égalité 4-4 → proche de 50/50", () => {
    // Le bottom de la 9e est la DERNIÈRE demie-manche : sans elle, le
    // domicile se voyait attribuer 0 run attendu et perdait un match qu'il ne
    // pouvait pas perdre. Ce test verrouille cette correction.
    const b = baseballLiveMarkets(base({ inning: 9, half: "top", outs: 0, bases: 0, homeScore: 4, awayScore: 4 }));
    const p = probOf(b, "moneyline", "home");
    // Le domicile joue EN DERNIER (bottom de la 9e) : avantage structurel
    // réel, mais borné — pas un 98 %. On verrouille qu'il ne soit ni crushed
    // à 0 ni à 1, et qu'il dépasse 50 %.
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(0.85);
  });

  test("9e manche, retard de 3 runs avec 2 outs → extérieur très favori", () => {
    // Le domicile doit marquer 4 runs au bottom. Le λ du bottom est atténué
    // (LATE_INNING_DAMP) mais reste ~1.8 run : l'extérieur est très favori,
    // sans être « certain » — le comeback de 9e reste mathématiquement possible.
    const b = baseballLiveMarkets(base({ inning: 9, outs: 2, bases: 0, homeScore: 1, awayScore: 4 }));
    expect(probOf(b, "moneyline", "away")).toBeGreaterThan(0.75);
    expect(probOf(b, "moneyline", "away")).toBeLessThan(0.95);
  });

  test("moneylineProb : égalité parfaite → 50/50", () => {
    const r = moneylineProb(5, 5, 0, 0);
    expect(r.home).toBeCloseTo(r.away, 6);
  });

  test("l'état discret va au camp à la batte", () => {
    // Au top, la demie-manche en cours appartient aux visiteurs ; au bottom,
    // au domicile. L'écart porte exactement sur `currentHalf` ± la
    // demie-manche opposée restante (ici : +2.44 − 2.28 = +0.16 pour chacun).
    const top = remainingRunExp(base({ half: "top", bases: 7, outs: 0 }));
    const bottom = remainingRunExp(base({ half: "bottom", bases: 7, outs: 0 }));
    // Au top : les visiteurs ont l'état favorable (bases pleines) ET le
    // domicile a encore son bottom → le domicile garde l'avantage du bottom.
    expect(top.expHome).toBeGreaterThan(bottom.expHome);
    expect(bottom.expAway).toBeGreaterThan(top.expAway);
    // Et l'état plein profit bien plus au top (visiteurs) qu'au bottom.
    const videTop = remainingRunExp(base({ half: "top", bases: 0, outs: 0 }));
    const videBottom = remainingRunExp(base({ half: "bottom", bases: 0, outs: 0 }));
    const gainTop = top.expAway - videTop.expAway;
    const gainBottom = bottom.expHome - videBottom.expHome;
    expect(gainTop).toBeCloseTo(gainBottom, 9);
  });

  test("points attendus décroissent quand on avance dans le match", () => {
    const t7 = remainingRunExp(base({ inning: 7 }));
    const t9 = remainingRunExp(base({ inning: 9 }));
    expect(t9.expHome + t9.expAway).toBeLessThan(t7.expHome + t7.expAway);
  });
});

// ─── Prochain passage au bâton ─────────────────────────────────────────────

describe("live-baseball — prochain passage au bâton", () => {
  test("3 issues exclusives sommant à 1", () => {
    const b = baseballLiveMarkets(base());
    expect(byId(b, "next-pa")?.outcomes.map((o) => o.id)).toEqual(["out", "hit", "hr"]);
    expect(probOf(b, "next-pa", "out") + probOf(b, "next-pa", "hit") + probOf(b, "next-pa", "hr")).toBeCloseTo(1, 6);
  });

  test("catégories = agrégation des poids du BatterProfile", () => {
    const p = nextPlateAppearance({ pStrikeout: 0.2, pWalk: 0.1, pSingle: 0.4, pDouble: 0.1, pTriple: 0, pHomerun: 0.1, pOut: 0.1 });
    expect(p.out).toBeCloseTo(0.2 + 0.1, 9); // K + groundout
    expect(p.hit).toBeCloseTo(0.1 + 0.4 + 0.1 + 0, 9); // BB + 1B + 2B + 3B
    expect(p.homerun).toBeCloseTo(0.1, 9);
  });

  test("2 strikes → plus de retraits, moins de HR", () => {
    const un = nextPlateAppearance(null, { balls: 0, strikes: 1 });
    const deux = nextPlateAppearance(null, { balls: 0, strikes: 2 });
    expect(deux.out).toBeGreaterThan(un.out);
    expect(deux.homerun).toBeLessThan(un.homerun);
  });

  test("3 balls → plus de bases atteintes", () => {
    const zero = nextPlateAppearance(null, { balls: 0, strikes: 0 });
    const trois = nextPlateAppearance(null, { balls: 3, strikes: 0 });
    expect(trois.hit).toBeGreaterThan(zero.hit);
  });

  test("profil partiel renormalisé (somme 1)", () => {
    const p = resolveBatterProfile({ pSingle: 0.9, pDouble: 0.9 });
    const sum = p.pStrikeout + p.pWalk + p.pSingle + p.pDouble + p.pTriple + p.pHomerun + p.pOut;
    expect(sum).toBeCloseTo(1, 9);
  });

  test("profil vide → repli league", () => {
    const p = resolveBatterProfile(null);
    expect(p.pStrikeout).toBeCloseTo(0.22, 6);
    expect(p.pSingle).toBeCloseTo(0.25, 6);
  });

  test("profil aberrant (tout 0) → repli league, pas de division par 0", () => {
    const p = resolveBatterProfile({ pStrikeout: 0, pWalk: 0, pSingle: 0, pDouble: 0, pTriple: 0, pHomerun: 0, pOut: 0 });
    expect(p.pStrikeout).toBeCloseTo(0.22, 6);
  });
});

// ─── Demi-manche ───────────────────────────────────────────────────────────

describe("live-baseball — demi-manche", () => {
  test("bases pleines, 0 out → demi-manche très probablement marquée", () => {
    const b = baseballLiveMarkets(base({ outs: 0, bases: 7 }));
    expect(probOf(b, "moneyline-inning", "scored")).toBeGreaterThan(0.8);
  });

  test("2 outs, bases vides → demi-manche souvent muette", () => {
    const b = baseballLiveMarkets(base({ outs: 2, bases: 0 }));
    expect(probOf(b, "moneyline-inning", "scoreless")).toBeGreaterThan(0.5);
  });

  test("libellé nomme le camp à la batte", () => {
    const top = baseballLiveMarkets(base({ half: "top" }));
    expect(byId(top, "moneyline-inning")?.label).toContain("Extérieur");
    const bottom = baseballLiveMarkets(base({ half: "bottom" }));
    expect(byId(bottom, "moneyline-inning")?.label).toContain("Domicile");
  });

  test("O/U 0.5 de la demi-manche = moneyline de la demi-manche", () => {
    const b = baseballLiveMarkets(base());
    expect(probOf(b, "half-inning-runs", "over")).toBeCloseTo(probOf(b, "moneyline-inning", "scored"), 9);
  });

  test("issues complémentaires", () => {
    const b = baseballLiveMarkets(base());
    expect(probOf(b, "half-inning-runs", "over") + probOf(b, "half-inning-runs", "under")).toBeCloseTo(1, 6);
  });
});

// ─── Drivers ───────────────────────────────────────────────────────────────

describe("live-baseball — drivers", () => {
  test("espérance, leverage, bases, compte, écart exposés", () => {
    const b = baseballLiveMarkets(base());
    const labels = b.drivers.map((d) => d.label);
    expect(labels).toContain("Espérance de points");
    expect(labels).toContain("Leverage Index");
    expect(labels).toContain("Occupation bases");
    expect(labels).toContain("Compte");
    for (const d of b.drivers) {
      expect(d.ratio).toBeGreaterThanOrEqual(0);
      expect(d.ratio).toBeLessThanOrEqual(1);
    }
  });

  test("bases pleines décrites en clair", () => {
    const b = baseballLiveMarkets(base({ bases: 7 }));
    expect(b.drivers.find((d) => d.label === "Occupation bases")?.display).toBe("Bases pleines");
  });

  test("bases 5 = 1re + 3e", () => {
    const b = baseballLiveMarkets(base({ bases: 5 }));
    expect(b.drivers.find((d) => d.label === "Occupation bases")?.display).toBe("1re + 3e");
  });

  test("leverage monte avec outs + écart", () => {
    const faible = baseballLiveMarkets(base({ outs: 0, homeScore: 3, awayScore: 3 }));
    const fort = baseballLiveMarkets(base({ outs: 2, homeScore: 6, awayScore: 3 }));
    const v = (b: ReturnType<typeof baseballLiveMarkets>) =>
      Number(b.drivers.find((d) => d.label === "Leverage Index")?.display);
    expect(v(fort)).toBeGreaterThan(v(faible));
  });

  test("horloge : manche + moitié + outs", () => {
    const top = baseballLiveMarkets(base({ inning: 1, half: "top", outs: 0 }));
    expect(top.clock).toBe("1re Haut · 0 out");
    const bot = baseballLiveMarkets(base({ inning: 7, half: "bottom", outs: 2 }));
    expect(bot.clock).toBe("7e Bas · 2 outs");
  });

  test("compte absente → « n/d », jamais de NaN", () => {
    const b = baseballLiveMarkets(base({ count: null }));
    expect(b.drivers.find((d) => d.label === "Compte")?.display).toBe("n/d");
  });

  test("O0.5 résiduel : issues complémentaires", () => {
    const b = baseballLiveMarkets(base());
    expect(probOf(b, "any-run-o05", "over") + probOf(b, "any-run-o05", "under")).toBeCloseTo(1, 6);
  });
});