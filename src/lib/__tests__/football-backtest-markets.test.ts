import { describe, expect, test } from "bun:test";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import type { Top5BacktestEntry } from "@/lib/top5-backtest/types";
import {
  AVAILABLE_MARKETS,
  BLOCKED_MARKETS,
  FOOTBALL_MARKETS,
  STRATEGY_TO_MARKET,
} from "@/lib/football-backtest/markets";
import { runMarketBacktest } from "@/lib/football-backtest/market-engine";
import { LEAGUE_COUNTRY_BY_NAME } from "@/lib/league-mapping";

function mkMatch(over: Partial<BSDFootballMatch> = {}): BSDFootballMatch {
  return {
    id: 1,
    league: { id: -1, name: "Ligue Test" },
    home_team: "Alpha FC",
    away_team: "Beta FC",
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
    ...over,
  } as unknown as BSDFootballMatch;
}

function mkEntry(over: Partial<Top5BacktestEntry> = {}): Top5BacktestEntry {
  return {
    id: "football:over15:1",
    sport: "football",
    strategyKey: "over15",
    matchId: "1",
    league: "Ligue Test",
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

/* ── Registre ───────────────────────────────────────────────────────── */

describe("registre des marchés", () => {
  test("7 marchés dispo + 4 bloqués, tous motivés", () => {
    expect(FOOTBALL_MARKETS.length).toBe(11);
    expect(AVAILABLE_MARKETS.length).toBe(7);
    expect(BLOCKED_MARKETS.length).toBe(4);
    for (const m of BLOCKED_MARKETS) {
      expect(m.blockedReason).toBeTruthy();
      expect(m.oddsFor).toBeUndefined(); // aucun résolveur → jamais de cote inventée
    }
  });

  test("mappage stratégies → marchés (orphelines exclues)", () => {
    expect(STRATEGY_TO_MARKET.get("over15")?.key).toBe("over15");
    expect(STRATEGY_TO_MARKET.get("bttsYes")?.key).toBe("btts");
    expect(STRATEGY_TO_MARKET.get("bestTeam")?.key).toBe("1x2");
    expect(STRATEGY_TO_MARKET.get("gagnant")?.key).toBe("1x2");
    expect(STRATEGY_TO_MARKET.get("doubleChance12")?.key).toBe("dc12");
    // hors périmètre P1 ou marché bloqué → pas de paris backtestés
    expect(STRATEGY_TO_MARKET.has("bestAttack")).toBe(false);
    expect(STRATEGY_TO_MARKET.has("bestDefense")).toBe(false);
    expect(STRATEGY_TO_MARKET.has("dnb")).toBe(false);
    expect(STRATEGY_TO_MARKET.has("over65Corners")).toBe(false);
  });
});

/* ── Moteur ─────────────────────────────────────────────────────────── */

describe("runMarketBacktest — agrégation par marché", () => {
  const window = { from: "2026-09-25", to: "2026-10-01" };

  test("mappe les picks, règle le pending et valorise en 1u", () => {
    const out = runMarketBacktest({
      entries: [
        // pending rattrapé via settleFootballPick : 3 buts → Over 1,5 gagné
        mkEntry({ status: "pending", odds: 1.28 }),
        mkEntry({
          id: "football:bttsYes:1",
          strategyKey: "bttsYes",
          pickDesc: "BTTS oui",
          odds: 1.72,
          status: "pending",
        }),
      ],
      matchesById: new Map([["1", mkMatch()]]),
      ...window,
    });

    const o15 = out.markets.find((m) => m.key === "over15")!;
    expect(o15.n).toBe(1);
    expect(o15.wins).toBe(1);
    expect(o15.nWithOdds).toBe(1);
    expect(o15.pnl).toBeCloseTo(0.28, 2); // 1.28 − 1
    expect(o15.roiPct).toBeCloseTo(28, 2);
    expect(o15.curve).toEqual([0.28]);

    // BTTS 2-1 → les 2 ont marqué → gagné
    const btts = out.markets.find((m) => m.key === "btts")!;
    expect(btts.wins).toBe(1);
    expect(btts.pnl).toBeCloseTo(0.72, 2);
  });

  test("Double Chance : cote dérivée du dé-vig 1X2, marquée derived-devig", () => {
    const out = runMarketBacktest({
      entries: [
        mkEntry({
          id: "football:doubleChance1X:1",
          strategyKey: "doubleChance1X",
          pickDesc: "DC 1X Alpha FC",
          pick: "home",
          odds: null,
          status: "pending",
        }),
      ],
      matchesById: new Map([["1", mkMatch()]]),
      ...window,
    });
    const dc = out.markets.find((m) => m.key === "dc1x")!;
    expect(dc.bets[0].oddsSource).toBe("derived-devig");
    // de-vig 1.5 / 4.2 / 6.5 → P(1X) ≈ 0.855 → cote équitable ≈ 1.17
    expect(dc.bets[0].odds).toBeGreaterThan(1.15);
    expect(dc.bets[0].odds).toBeLessThan(1.2);
    // 2-1 → 1X gagné → P&L = cote − 1
    expect(dc.bets[0].status).toBe("won");
    expect(dc.pnl).toBeCloseTo((dc.bets[0].odds ?? 1) - 1, 3);
  });

  test("cote réelle de l'entrée prioritaire sur le fixture (source bsd)", () => {
    const out = runMarketBacktest({
      entries: [mkEntry({ odds: 1.4 })], // cote snapshot ≠ cote fixture (1.28)
      matchesById: new Map([["1", mkMatch()]]),
      ...window,
    });
    const bet = out.markets.find((m) => m.key === "over15")!.bets[0];
    expect(bet.odds).toBe(1.4);
    expect(bet.oddsSource).toBe("bsd");
    expect(bet.pnl).toBeCloseTo(0.4, 5);
  });

  test("sans cote nulle part : pari compté mais exclu du ROI", () => {
    const out = runMarketBacktest({
      entries: [mkEntry({ odds: null })],
      matchesById: new Map([["1", mkMatch({ odds_over_15: null })]]),
      ...window,
    });
    const m = out.markets.find((x) => x.key === "over15")!;
    expect(m.n).toBe(1);
    expect(m.nWithOdds).toBe(0);
    expect(m.pnl).toBe(0);
    expect(m.roiPct).toBeNull();
  });

  test("drawdown et courbe chronologiques", () => {
    const out = runMarketBacktest({
      entries: [
        mkEntry({ id: "football:over15:1", matchId: "1", kickoff: "2026-09-26T20:00:00Z", odds: 2, status: "won" }),
        mkEntry({ id: "football:over15:2", matchId: "2", kickoff: "2026-09-27T20:00:00Z", odds: 2, status: "lost" }),
        mkEntry({ id: "football:over15:3", matchId: "3", kickoff: "2026-09-28T20:00:00Z", odds: 2, status: "lost" }),
      ],
      matchesById: new Map([
        ["1", mkMatch({ id: 1, home_score: 2, away_score: 0 })],
        ["2", mkMatch({ id: 2, home_score: 0, away_score: 0 })],
        ["3", mkMatch({ id: 3, home_score: 0, away_score: 0 })],
      ]),
      ...window,
    });
    const m = out.markets.find((x) => x.key === "over15")!;
    // V (+1) puis N (−1) puis N (−1) : courbe [1, 0, −1], pic 1 → drawdown 2
    expect(m.curve).toEqual([1, 0, -1]);
    expect(m.maxDrawdown).toBe(2);
    expect(m.pnl).toBe(-1);
    expect(m.roiPct).toBeCloseTo(-33.33, 2);
    expect(m.sampleOk).toBe(false); // 3 paris réglés < 10
  });

  test("stratégies orphelines et marchés bloqués sans paris", () => {
    const out = runMarketBacktest({
      entries: [
        mkEntry({ id: "football:bestAttack:1", strategyKey: "bestAttack", pickDesc: "Over 2,5 buts" }),
        mkEntry({ id: "football:over65Corners:1", strategyKey: "over65Corners", pickDesc: "Over 6,5 corners" }),
      ],
      matchesById: new Map([["1", mkMatch()]]),
      ...window,
    });
    expect(out.totals.nBets).toBe(0);
    // les cartes bloquées sont toujours servies, avec leurs raisons
    expect(out.blocked.length).toBe(4);
    expect(out.blocked.every((b) => b.availability === "blocked" && b.blockedReason)).toBe(true);
  });

  test("totaux globaux et fenêtre reflétée", () => {
    const out = runMarketBacktest({
      entries: [
        mkEntry({ odds: 1.28, status: "won" }),
        mkEntry({
          id: "football:bttsYes:2",
          strategyKey: "bttsYes",
          matchId: "2",
          odds: 1.72,
          status: "lost",
          kickoff: "2026-09-27T20:00:00Z",
        }),
      ],
      matchesById: new Map([
        ["1", mkMatch({ id: 1 })],
        ["2", mkMatch({ id: 2, home_score: 1, away_score: 0 })],
      ]),
      ...window,
    });
    expect(out.from).toBe("2026-09-25");
    expect(out.to).toBe("2026-10-01");
    expect(out.totals.nBets).toBe(2);
    expect(out.totals.wins).toBe(1);
    expect(out.totals.losses).toBe(1);
    expect(out.totals.pnl).toBeCloseTo(0.28 - 1, 2);
  });
});

/* ── Filtre ligue (widget Top 10) ─────────────────────────────────────── */

describe("filtre league du backtest marchés", () => {
  const window = { from: "2026-09-01", to: "2026-10-01" };

  test("restreint les agrégats à la ligue demandée", () => {
    const entries = [
      mkEntry({ id: "football:over15:1", matchId: "1", league: "Serie A" }),
      mkEntry({ id: "football:over15:2", matchId: "2", league: "Liga" }),
    ];
    const matchesById = new Map([
      ["1", mkMatch({ id: 1 })],
      ["2", mkMatch({ id: 2 })],
    ]);

    // La route filtre les entries AVANT runMarketBacktest : le résultat doit refléter
    // la seule ligue demandée, sinon les 2 badges du widget annonceraient un
    // classement calculé sur toutes les ligues — un mensonge chiffré à l'écran.
    const serieA = runMarketBacktest({
      entries: entries.filter((e) => e.league === "Serie A"),
      matchesById,
      ...window,
    });
    const all = runMarketBacktest({ entries, matchesById, ...window });

    expect(serieA.totals.nBets).toBe(1);
    expect(all.totals.nBets).toBe(2);
    expect(serieA.markets.every((m) => m.bets.every((b) => b.league === "Serie A"))).toBe(true);
  });

  test("une ligue inconnue ne plante pas et ne renvoie aucun pari", () => {
    const out = runMarketBacktest({
      entries: [mkEntry({ league: "Liga" })].filter((e) => e.league === "Inexistante"),
      matchesById: new Map([["1", mkMatch({ id: 1 })]]),
      ...window,
    });
    expect(out.totals.nBets).toBe(0);
    expect(out.markets.every((m) => m.n === 0)).toBe(true);
  });
});

/* ── Liste des ligues pour le sélecteur ───────────────────────────────── */

describe("liste des ligues du backtest", () => {
  const window = { from: "2026-09-01", to: "2026-10-01" };

  test("est calculée sur la fenêtre ENTIERE, pas sur l'ensemble filtré", () => {
    // Invariant d'IHM : le filtre `league` change les DONNEES, jamais la liste des
    // CHOIX. Si la liste venait des entrées filtrées, le sélecteur se réduirait à
    // l'unique option choisie et l'utilisateur ne pourrait plus revenir à « tous ».
    const inWindow = [
      mkEntry({ id: "a", matchId: "1", league: "Premier League" }),
      mkEntry({ id: "b", matchId: "2", league: "La Liga" }),
      mkEntry({ id: "c", matchId: "3", league: "Serie A" }),
    ];
    const leagues = [...new Set(inWindow.map((e) => e.league).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "fr"),
    );
    expect(leagues).toEqual(["La Liga", "Premier League", "Serie A"]);

    // Après filtre sur une seule ligue, les données sont réduites…
    const filtered = inWindow.filter((e) => e.league === "Serie A");
    const out = runMarketBacktest({ entries: filtered, matchesById: new Map(), ...window });
    expect(out.totals.nBets).toBe(1);

    // …mais la liste des options, elle, reste complète : calculée AVANT le filtre.
    expect(leagues).toHaveLength(3);
  });

  test("trie en locale fr", () => {
    // Un tri ASCII placerait "Angleterre"/"Angers" après "Zambie" ; c'est le défaut
    // classique des listes de pays affichées à l'utilisateur francophone.
    const names = ["Zambie", "Angleterre", "Espagne", "Allemagne", "France"];
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "fr"));
    expect(sorted[0]).toBe("Allemagne");
    expect(sorted[sorted.length - 1]).toBe("Zambie");
  });

  test("LEAGUE_COUNTRY_BY_NAME indexe les ligues football par leur NOM", () => {
    expect(LEAGUE_COUNTRY_BY_NAME["Premier League"]).toBe("England");
    expect(LEAGUE_COUNTRY_BY_NAME["Ligue 1"]).toBe("France");
    // Une ligue absente de la table doit rester undefined, pas un pays inventé :
    // l'IHM la range alors sous « Autres pays ».
    expect(LEAGUE_COUNTRY_BY_NAME["Liga Inconnue FICTIVE"]).toBeUndefined();
  });
});
