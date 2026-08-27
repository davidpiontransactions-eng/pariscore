import { describe, expect, it } from "bun:test";
import { dixonColesMarkets } from "../src/lib/prediction/football/dixon-coles";
import { computeStrategyTop5Matches } from "../src/lib/football-strategy-top5";
import type { BSDFootballMatch } from "../src/lib/bsd-football-fetcher";
import { buildTennisTop5, TENNIS_TOP5_METRICS } from "../src/lib/tennis-top5";
import type { TennisMatch } from "../src/lib/tennis-data";

/**
 * Filtre « Gagnant » Top5 — tests foot & tennis.
 * Foot : Dixon-Coles 1997 sur λ forme L5, match écarté si nul modal.
 */

let seq = 0;
const TEAM_IDS: Record<string, number> = {};

/** Identifiant stable par nom d'équipe (clé de forme du store BSD). */
function fid(name: string): number {
  if (!(name in TEAM_IDS)) TEAM_IDS[name] = 900 + Object.keys(TEAM_IDS).length;
  return TEAM_IDS[name];
}

/** Fixture planifié (« notstarted ») entre deux équipes quelconques stables. */
function fixture(o?: Record<string, unknown>): BSDFootballMatch {
  const i = ++seq;
  const h = (o?.home_team as string) ?? "Alpha";
  const a = (o?.away_team as string) ?? "Beta";
  return {
    id: i,
    status: "notstarted",
    league: { id: 999999, name: "Ligue Test" },
    event_date: "2026-09-01T18:00:00Z",
    home_team: h,
    away_team: a,
    home_team_obj: { id: fid(h), short_name: h.slice(0, 3) },
    away_team_obj: { id: fid(a), short_name: a.slice(0, 3) },
    home_score: null,
    away_score: null,
    ...o,
  } as unknown as BSDFootballMatch;
}

/** Match terminé entre équipes au nom/id stables (clé de forme du store). */
function fini(h: string, a: string, hs: number, as: number): BSDFootballMatch {
  return fixture({
    status: "finished",
    home_team: h,
    away_team: a,
    home_team_obj: { id: fid(h), short_name: h.slice(0, 3) },
    away_team_obj: { id: fid(a), short_name: a.slice(0, 3) },
    home_score: hs,
    away_score: as,
  });
}

describe("top5 gagnant — foot", () => {
  it("Dixon-Coles : Σ marchés 1X2 = 100% et bornés", () => {
    const mk = dixonColesMarkets(1.4, 1.1);
    expect(mk.homeWin + mk.draw + mk.awayWin).toBeCloseTo(100, 0);
    for (const v of [mk.homeWin, mk.draw, mk.awayWin]) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(100);
    }
  });

  it("gagnant : pick valide, proba 40-86%", () => {
    // Alpha fort à domicile / Beta faible à l'extérieur → λH≈1.33 λA≈0.67
    // → victoire domicile ~55% (sous le cap ~87%, liste probabiliste).
    const finished = [
      fini("Alpha", "Om", 2, 1),
      fini("Alpha", "Om", 2, 1),
      fini("Alpha", "Om", 1, 0),
      fini("Beta", "Om", 1, 2),
      fini("Beta", "Om", 1, 1),
    ];
    const res = computeStrategyTop5Matches(finished, [fixture()]);
    const entries = res.strategies.gagnant;
    expect(entries.length).toBe(1);
    expect(["home", "away"]).toContain(entries[0].pick);
    expect(entries[0].value).toBeGreaterThan(40);
    expect(entries[0].value).toBeLessThan(86);
  });

  it("gagnant : nul modal → match écarté (λ≈0)", () => {
    const finished = [
      fini("A1", "B1", 0, 0),
      fini("A1", "B2", 0, 0),
      fini("A1", "B3", 0, 0),
      fini("C1", "Zz", 0, 0),
      fini("C2", "Zz", 0, 0),
    ];
    const res = computeStrategyTop5Matches(finished, [
      fixture({ home_team: "Zz", away_team: "Yy" }),
    ]);
    expect(res.strategies.gagnant.length).toBe(0);
  });

  it("gagnant : sans forme L5 exploitable → aucun match listé", () => {
    const res = computeStrategyTop5Matches([], [fixture()]);
    expect(res.strategies.gagnant.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tennis — métrique « gagnant » (confiance du blend moteur serveur)
// ---------------------------------------------------------------------------

let tseq = 0;

function joueur(n: string): TennisMatch["playerA"] {
  return {
    id: n.toLowerCase(),
    name: n,
    shortName: n.slice(0, 3),
    rank: 10,
    elo: 1900,
    surfaceElo: 1950,
    photoUrl: "",
    color: "#fff",
    form: ["W", "W"],
  };
}

function match(pA: number, pB: number, extra?: Partial<TennisMatch>): TennisMatch {
  tseq++;
  return {
    id: `m${tseq}`,
    tournament: "ATP Masters",
    round: "QF",
    scheduledAt: "2026-09-01T14:00:00Z",
    playerA: joueur("Anna"),
    playerB: joueur("Bea"),
    probA: pA,
    probB: pB,
    stats: { form: "3V-1D", eloGap: 140, surface: "Dur", h2h: "4-1", ic: [55, 88], confidence: 0.8 },
    model: "blend-v1",
    modelUpdatedAt: "2026-08-27T00:00:00Z",
    ...extra,
  } as TennisMatch;
}

const LB = new Map();

describe("top5 gagnant — tennis", () => {
  it("déf présente et probabiliste (auto-wire UI)", () => {
    const def = TENNIS_TOP5_METRICS.find((m) => m.key === "gagnant");
    expect(def?.isProb).toBe(true);
  });

  it("tri confiance desc + pick favori", () => {
    const entries = buildTennisTop5([match(72, 28), match(54, 46)], LB, "gagnant");
    expect(entries.length).toBe(2);
    expect(entries[0].playerA.value).toBeGreaterThan(entries[1].playerA.value);
    expect(entries[0].pick).toBe("A");
    expect(entries[0].probPick).toBe(72);
  });

  it("exclusions synthetic / insufficientData", () => {
    const entries = buildTennisTop5(
      [
        match(80, 20, { synthetic: true }),
        match(80, 20, { insufficientData: true }),
        match(66, 34),
      ],
      LB,
      "gagnant",
    );
    expect(entries.length).toBe(1);
    expect(entries[0].probPick).toBe(66);
  });

  it("régression : surfaceElo intact", () => {
    expect(buildTennisTop5([match(70, 30)], LB, "surfaceElo").length).toBe(1);
  });
});
