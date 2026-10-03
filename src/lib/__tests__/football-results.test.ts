import { describe, expect, test } from "bun:test";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { settleFootballPick } from "@/lib/top5-backtest/football";
import type { Top5BacktestEntry } from "@/lib/top5-backtest/types";
import {
  buildSettledResults,
  matchStatsView,
  parseWindow,
  pnlUnit,
  settleEntry,
  strategyLabel,
} from "@/lib/football-results";
import type { CornerHistoryRow, MatchStatsHistoryRow } from "@/lib/football-history-db";

function mkMatch(over: Partial<BSDFootballMatch> = {}): BSDFootballMatch {
  return {
    id: 1,
    league: { id: 1, name: "Ligue 1" },
    home_team: "PSG",
    away_team: "Lyon",
    event_date: "2026-09-28T20:00:00Z",
    status: "finished",
    home_score: 2,
    away_score: 1,
    odds_home: 1.5,
    odds_draw: 4.2,
    odds_away: 6.5,
    odds_over_15: 1.28,
    odds_under_35: 1.9,
    odds_btts_yes: 1.72,
    odds_dnb_home: 1.32,
    odds_dnb_away: 3.4,
    ...over,
  } as unknown as BSDFootballMatch;
}

function mkEntry(over: Partial<Top5BacktestEntry> = {}): Top5BacktestEntry {
  return {
    id: "football:over15:1",
    sport: "football",
    strategyKey: "over15",
    matchId: "1",
    league: "Ligue 1",
    kickoff: "2026-09-28T20:00:00Z",
    pickDesc: "Over 1,5",
    value: 72,
    pick: null,
    odds: 1.28,
    closingOdds: 1.28,
    clvPct: null,
    status: "pending",
    ...over,
  };
}

/* ── settleFootballPick : les 13 stratégies ─────────────────────────── */

describe("settleFootballPick — 13 stratégies", () => {
  const m = mkMatch(); // 2-1 domicile

  test("bestTeam/bestTeam1x2/gagnant : côté gagnant", () => {
    for (const key of ["bestTeam", "bestTeam1x2", "gagnant"] as const) {
      expect(settleFootballPick(key, "home", m).status).toBe("won");
      expect(settleFootballPick(key, "away", m).status).toBe("lost");
    }
    // cote côté pickée
    expect(settleFootballPick("gagnant", "home", m).odds).toBe(1.5);
  });

  test("gagnant : sans pick → void", () => {
    expect(settleFootballPick("gagnant", null, m).status).toBe("void");
  });

  test("dnb : nul → void, sinon le côté gagnant l'emporte", () => {
    const draw = mkMatch({ home_score: 1, away_score: 1 });
    expect(settleFootballPick("dnb", "home", draw).status).toBe("void");
    expect(settleFootballPick("dnb", "home", m).status).toBe("won");
    expect(settleFootballPick("dnb", "away", m).status).toBe("lost");
    // cotes DNB portées par la cote de clôture du côté pické
    expect(settleFootballPick("dnb", "home", m).odds).toBe(1.32);
    expect(settleFootballPick("dnb", "away", m).odds).toBe(3.4);
  });

  test("doubleChance1X/2X : non-défaite du côté pické", () => {
    expect(settleFootballPick("doubleChance1X", "home", m).status).toBe("won");
    expect(settleFootballPick("doubleChance2X", "away", m).status).toBe("lost");
    const draw = mkMatch({ home_score: 0, away_score: 0 });
    expect(settleFootballPick("doubleChance2X", "away", draw).status).toBe("won");
  });

  test("doubleChance12 : pas de nul", () => {
    expect(settleFootballPick("doubleChance12", null, m).status).toBe("won");
    expect(settleFootballPick("doubleChance12", null, mkMatch({ home_score: 2, away_score: 2 })).status).toBe("lost");
  });

  test("bestDefense : ≤1 but encaissé par le côté pické", () => {
    // PSG 2-1 Lyon → pick home encaisse 1 → gagné
    expect(settleFootballPick("bestDefense", "home", m).status).toBe("won");
    // pick away encaisse 2 → perdu
    expect(settleFootballPick("bestDefense", "away", m).status).toBe("lost");
  });

  test("bestAttack : Over 2,5 buts", () => {
    expect(settleFootballPick("bestAttack", null, m).status).toBe("won"); // 3 buts
    expect(settleFootballPick("bestAttack", null, mkMatch({ home_score: 1, away_score: 1 })).status).toBe("lost");
  });

  test("over15 / under35 / bttsYes", () => {
    expect(settleFootballPick("over15", null, m).status).toBe("won"); // 3 buts
    expect(settleFootballPick("under35", null, m).status).toBe("won"); // 3 ≤ 3
    expect(settleFootballPick("under35", null, mkMatch({ home_score: 3, away_score: 2 })).status).toBe("lost");
    expect(settleFootballPick("bttsYes", null, m).status).toBe("won");
    expect(settleFootballPick("bttsYes", null, mkMatch({ home_score: 2, away_score: 0 })).status).toBe("lost");
  });

  test("over65Corners : void sans stats, ≥7 corners gagné", () => {
    expect(settleFootballPick("over65Corners", null, m).status).toBe("void");
    const withStats = mkMatch({
      live_stats: { home: { corner_kicks: 5 }, away: { corner_kicks: 3 } },
    });
    expect(settleFootballPick("over65Corners", null, withStats).status).toBe("won");
  });

  test("sans score final → void", () => {
    const ns = mkMatch({ home_score: null, away_score: null });
    expect(settleFootballPick("over15", null, ns).status).toBe("void");
  });
});

/* ── P&L 1u fixe (convention aggregateStrategyStats) ───────────────── */

describe("pnlUnit", () => {
  test("gagné avec cote → odds-1 ; perdu → -1", () => {
    expect(pnlUnit("won", 2.5)).toBe(1.5);
    expect(pnlUnit("lost", 2.5)).toBe(-1);
  });
  test("sans cote ou cote ≤ 1 → 0 (exclu du ROI)", () => {
    expect(pnlUnit("won", null)).toBe(0);
    expect(pnlUnit("lost", null)).toBe(0);
    expect(pnlUnit("won", 1)).toBe(0);
    expect(pnlUnit("lost", 1)).toBe(0);
  });
  test("void / pending → 0", () => {
    expect(pnlUnit("void", 2.5)).toBe(0);
    expect(pnlUnit("pending", 2.5)).toBe(0);
  });
});

/* ── Enrichissement corners / SOT ──────────────────────────────────── */

describe("matchStatsView — chaîne live → archives", () => {
  const hist: MatchStatsHistoryRow = {
    bsdEventId: "1",
    bsdLeagueId: "1",
    season: "2026",
    matchDate: "2026-09-28",
    homeTeam: "PSG",
    awayTeam: "Lyon",
    homeScore: 2,
    awayScore: 1,
    homeSot: 6,
    awaySot: 3,
    homeShots: 12,
    awayShots: 7,
    homeCorners: 7,
    awayCorners: 4,
    homeXg: 1.9,
    awayXg: 0.8,
  };
  const cor: CornerHistoryRow = {
    bsdEventId: "1",
    bsdLeagueId: "1",
    season: "2026",
    matchDate: "2026-09-28",
    homeTeam: "PSG",
    awayTeam: "Lyon",
    homeCorners: 7,
    awayCorners: 4,
    totalCorners: 11,
  };

  test("live_stats prioritaire", () => {
    const m = mkMatch({ live_stats: { home: { corner_kicks: 9, shots_on_target: 5 }, away: { corner_kicks: 2, shots_on_target: 1 } } });
    const v = matchStatsView(m, hist, cor);
    expect(v.source).toBe("live_stats");
    expect(v.corners).toEqual({ home: 9, away: 2 });
    expect(v.sot).toEqual({ home: 5, away: 1 });
  });

  test("repli match_stats_history (SOT + corners)", () => {
    const v = matchStatsView(mkMatch(), hist, cor);
    expect(v.source).toBe("match_stats_history");
    expect(v.sot).toEqual({ home: 6, away: 3 });
  });

  test("repli corner_history (corners seuls)", () => {
    const v = matchStatsView(mkMatch(), undefined, cor);
    expect(v.source).toBe("corner_history");
    expect(v.corners).toEqual({ home: 7, away: 4 });
    expect(v.sot).toEqual({ home: null, away: null });
  });

  test("rien dispo → valeurs null, jamais inventées", () => {
    const v = matchStatsView(undefined, undefined, undefined);
    expect(v.source).toBe("none");
    expect(v.corners.home).toBeNull();
    expect(v.sot.home).toBeNull();
  });
});

/* ── Assemblage du payload ─────────────────────────────────────────── */

describe("buildSettledResults", () => {
  test("pending rattrapé via settleFootballPick, agrégats et P&L", () => {
    const entries = [
      mkEntry({ id: "football:over15:1", strategyKey: "over15", matchId: "1", odds: 1.28, status: "pending" }),
      mkEntry({ id: "football:gagnant:1", strategyKey: "gagnant", matchId: "1", pick: "home", odds: 1.5, status: "pending", pickDesc: "PSG" }),
      mkEntry({ id: "football:over15:2", strategyKey: "over15", matchId: "2", odds: 2.1, status: "lost", kickoff: "2026-09-27T20:00:00Z", pickDesc: "Over 1,5" }),
      mkEntry({ id: "football:over15:3", strategyKey: "over15", matchId: "3", odds: 2.0, status: "pending", kickoff: "2026-09-26T20:00:00Z", pickDesc: "Over 1,5" }), // pas de match → reste pending
      // Entrée d'un autre moteur du store → ignorée (hors 13 stratégies)
      mkEntry({ id: "football:drawValueLigue:9", strategyKey: "drawValueLigue", matchId: "9", status: "won", odds: 3 }),
    ];
    const matchesById = new Map<string, BSDFootballMatch>([
      ["1", mkMatch()],
      ["2", mkMatch({ id: 2, home_score: 0, away_score: 0 })],
    ]);

    const out = buildSettledResults({
      entries,
      matchesById,
      from: "2026-09-25",
      to: "2026-10-01",
    });

    // 3 picks des 13 stratégies sur le match 1+2, 1 pending isolé, le reste ignoré
    expect(out.summary.nPicks).toBe(4);
    // match 1 : over15 gagné (3 buts, +0.28u) + gagnant gagné (+0.5u)
    const m1 = out.matches.find((m) => m.matchId === "1");
    expect(m1).toBeDefined();
    expect(m1!.homeScore).toBe(2);
    expect(m1!.picks.map((p) => p.status).sort()).toEqual(["won", "won"]);
    expect(m1!.pnl).toBeCloseTo(0.78, 2);
    // match 2 : over15 perdu → -1u
    const m2 = out.matches.find((m) => m.matchId === "2");
    expect(m2!.pnl).toBe(-1);
    // match 3 sans réel : reste pending
    expect(out.summary.pending).toBe(1);
    // P&L global = 0.28 + 0.5 - 1 = -0.22
    expect(out.summary.pnl).toBeCloseTo(-0.22, 2);
    expect(out.summary.wins).toBe(2);
    expect(out.summary.losses).toBe(1);
    // tri : match 1 (kickoff le plus récent) d'abord
    expect(out.matches[0].matchId).toBe("1");
  });

  test("stratégies hors 13 clés du store exclues", () => {
    const out = buildSettledResults({
      entries: [mkEntry({ strategyKey: "drawValueLigue", status: "won" })],
      matchesById: new Map(),
      from: "2026-09-25",
      to: "2026-10-01",
    });
    expect(out.matches.length).toBe(0);
    expect(out.summary.nPicks).toBe(0);
  });
});

describe("settleEntry", () => {
  test("un pick déjà réglé n'est jamais rétrogradé", () => {
    const e = mkEntry({ status: "won", odds: 2 });
    const s = settleEntry(e, mkMatch({ home_score: 0, away_score: 0 }));
    expect(s.status).toBe("won");
  });
});

describe("parseWindow", () => {
  test("défaut : 7 jours finissant aujourd'hui", () => {
    const { from, to } = parseWindow(null, null);
    const span = (Date.parse(to) - Date.parse(from)) / 86400_000;
    expect(span).toBe(6);
    expect(to).toBe(new Date().toISOString().slice(0, 10));
  });
  test("from seul → to = aujourd'hui", () => {
    // `from` est dérivé de maintenant : figé, il finit par dépasser le plafond
    // MAX_WINDOW_DAYS et `parseWindow` le recale alors sur `to` − 31 j.
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
    const { from, to } = parseWindow(threeDaysAgo, null);
    expect(from).toBe(threeDaysAgo);
    expect(to).toBe(new Date().toISOString().slice(0, 10));
  });
  test("bornes inversées → swap", () => {
    const { from, to } = parseWindow("2026-10-01", "2026-09-01");
    expect(from).toBe("2026-09-01");
    expect(to).toBe("2026-10-01");
  });
  test("plafond 31 jours : un `from` trop ancien est recalé sur `to` − 31 j", () => {
    const { from, to } = parseWindow("2020-01-01", "2026-10-01");
    expect(to).toBe("2026-10-01");
    expect(from).toBe("2026-08-31");
  });
  test("valeurs invalides → défauts", () => {
    const { from, to } = parseWindow("nawak", "2026-13-99");
    const span = (Date.parse(to) - Date.parse(from)) / 86400_000;
    expect(span).toBe(6);
  });
});

describe("strategyLabel", () => {
  test("13 labels lisibles, repli = clé brute", () => {
    expect(strategyLabel("over15")).toBe("Over 1,5");
    expect(strategyLabel("gagnant")).toBe("Gagnant");
    expect(strategyLabel("inconnue")).toBe("inconnue");
  });
});
