// Tests du leaderboard stats tennis — math pure (parseTiebreaks, ratings) et
// intégration SQL via bun:sqlite en mémoire (même interface que better-sqlite3).
// Lancer : bun test src/lib/tennis-stats/leaderboard.test.ts

import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import {
  aggregateLeaderboard,
  extractPlayerMatchRows,
  iocToIso2,
  isDecidingSetMatch,
  parseTiebreaks,
  type LeaderboardParams,
  type PlayerMatchRow,
  type SqliteLike,
} from "./leaderboard";

const BASE_PARAMS: LeaderboardParams = {
  board: "serve",
  tour: "atp",
  surface: "all",
  period: "all",
  vsRank: "all",
  minMatches: 5,
};

// ─── Fabrique de lignes (joueur × match) ─────────────────────────────────────

function makeRow(overrides: Partial<PlayerMatchRow> = {}): PlayerMatchRow {
  return {
    player: "Big Server",
    player_id: "101",
    ioc: "USA",
    match_date: Date.now(),
    opp_rank: 30,
    svpt: 60,
    first_in: 40,
    first_won: 32,
    second_won: 12,
    aces: 12,
    dfs: 3,
    sv_gms: 10,
    bp_saved: 3,
    bp_faced: 4,
    opp_svpt: 55,
    opp_first_in: 33,
    opp_first_won: 22,
    opp_second_won: 11,
    opp_sv_gms: 10,
    opp_bp_saved: 1,
    opp_bp_faced: 3,
    score: "6-4 6-4",
    sets_won: 2,
    sets_lost: 0,
    best_of: 3,
    won_match: 1,
    ...overrides,
  };
}

/** N matchs identiques pour un joueur donné. */
function makeMatches(
  player: string,
  n: number,
  overrides: Partial<PlayerMatchRow> = {}
): PlayerMatchRow[] {
  return Array.from({ length: n }, () => makeRow({ player, ...overrides }));
}

// ─── parseTiebreaks ──────────────────────────────────────────────────────────

describe("parseTiebreaks", () => {
  it("compte un TB gagné côté winner", () => {
    expect(parseTiebreaks("7-6(5) 6-4", true)).toEqual({ tbWon: 1, tbLost: 0 });
  });

  it("inverse la perspective côté loser", () => {
    expect(parseTiebreaks("7-6(5) 6-4", false)).toEqual({ tbWon: 0, tbLost: 1 });
  });

  it("gère plusieurs TB et le match tie-break (10-8)", () => {
    expect(parseTiebreaks("6-7(4) 7-6(9) 10-8", true)).toEqual({ tbWon: 2, tbLost: 1 });
  });

  it("ignore les tokens non-sets et le score null", () => {
    expect(parseTiebreaks("6-4 3-2 RET", true)).toEqual({ tbWon: 0, tbLost: 0 });
    expect(parseTiebreaks(null, true)).toEqual({ tbWon: 0, tbLost: 0 });
  });
});

// ─── isDecidingSetMatch ──────────────────────────────────────────────────────

describe("isDecidingSetMatch", () => {
  it("détecte le set décisif en BO3 et BO5", () => {
    expect(isDecidingSetMatch(3, 2, 1)).toBe(true);
    expect(isDecidingSetMatch(5, 3, 2)).toBe(true);
    expect(isDecidingSetMatch(3, 2, 0)).toBe(false);
    expect(isDecidingSetMatch(3, 1, 1)).toBe(false);
  });

  it("infère le format quand best_of est null", () => {
    expect(isDecidingSetMatch(null, 2, 1)).toBe(true);
    expect(isDecidingSetMatch(null, 3, 2)).toBe(true);
    expect(isDecidingSetMatch(null, 2, 0)).toBe(false);
  });
});

// ─── iocToIso2 ───────────────────────────────────────────────────────────────

describe("iocToIso2", () => {
  it("convertit les codes IOC courants", () => {
    expect(iocToIso2("ESP")).toBe("es");
    expect(iocToIso2("usa")).toBe("us");
    expect(iocToIso2("SRB")).toBe("rs");
  });

  it("retourne null pour inconnu ou null", () => {
    expect(iocToIso2("XXX")).toBeNull();
    expect(iocToIso2(null)).toBeNull();
  });
});


// ─── aggregateLeaderboard — board serve ──────────────────────────────────────

describe("aggregateLeaderboard — serve", () => {
  const rows = makeMatches("Big Server", 5);
  const out = aggregateLeaderboard(rows, BASE_PARAMS);

  it("produit une ligne par joueur avec le bon rang", () => {
    expect(out).toHaveLength(1);
    expect(out[0].rank).toBe(1);
    expect(out[0].player).toBe("Big Server");
    expect(out[0].matches).toBe(5);
    expect(out[0].ioc).toBe("us");
  });

  it("calcule les pourcentages de service", () => {
    const r = out[0];
    expect(r.firstServePct).toBeCloseTo(66.7, 1); // 200/300
    expect(r.firstServeWonPct).toBeCloseTo(80.0, 1); // 160/200
    expect(r.secondServeWonPct).toBeCloseTo(60.0, 1); // 60/100
    // breaks concédés = (4-3) × 5 = 5 → 1 − 5/50 = 90 %
    expect(r.serviceGamesWonPct).toBeCloseTo(90.0, 1);
    expect(r.acesPerMatch).toBeCloseTo(12, 1);
    expect(r.dfsPerMatch).toBeCloseTo(3, 1);
  });

  it("calcule le Serve Rating (formule ATP vérifiée)", () => {
    // 66.7 + 80.0 + 60.0 + 90.0 + 12 − 3 = 305.7
    expect(out[0].rating).toBeCloseTo(305.7, 1);
  });

  it("exclut les joueurs sous le seuil minMatches", () => {
    const few = makeMatches("Rare Player", 2);
    const out2 = aggregateLeaderboard([...rows, ...few], BASE_PARAMS);
    expect(out2.map((r) => r.player)).toEqual(["Big Server"]);
  });
});

// ─── aggregateLeaderboard — board return ─────────────────────────────────────

describe("aggregateLeaderboard — return", () => {
  const out = aggregateLeaderboard(makeMatches("Big Server", 5), {
    ...BASE_PARAMS,
    board: "return",
  });
  const r = out[0];

  it("calcule les pourcentages de retour (miroir service adverse)", () => {
    expect(r.returnFirstWonPct).toBeCloseTo(33.3, 1); // (165-110)/165
    expect(r.returnSecondWonPct).toBeCloseTo(50.0, 1); // 55/110
    // breaks convertis = (3-1) × 5 = 10 → 10/50 jeux = 20 %
    expect(r.returnGamesWonPct).toBeCloseTo(20.0, 1);
    // 10/15 balles de break = 66.7 %
    expect(r.bpConvertedPct).toBeCloseTo(66.7, 1);
  });

  it("calcule le Return Rating (somme des 4 pourcentages)", () => {
    // 33.3 + 50.0 + 20.0 + 66.7 = 170.0
    expect(r.rating).toBeCloseTo(170.0, 1);
  });
});

// ─── aggregateLeaderboard — board pressure ───────────────────────────────────

describe("aggregateLeaderboard — pressure", () => {
  const tbScore = "7-6(5) 4-6 7-6(2)";
  const rows = makeMatches("Clutch Player", 5, {
    score: tbScore,
    sets_won: 2,
    sets_lost: 1,
  });
  const out = aggregateLeaderboard(rows, { ...BASE_PARAMS, board: "pressure" });
  const r = out[0];

  it("calcule les composantes sous pression", () => {
    expect(r.bpSavedPct).toBeCloseTo(75.0, 1); // 15/20
    expect(r.bpConvertedPct).toBeCloseTo(66.7, 1);
    expect(r.tiebreaksWonPct).toBeCloseTo(100.0, 1); // 10/10 TB
    expect(r.decidingSetsWonPct).toBeCloseTo(100.0, 1); // 5/5 sets décisifs
  });

  it("calcule le Under Pressure Rating", () => {
    // 75.0 + 66.7 + 100.0 + 100.0 = 341.7
    expect(r.rating).toBeCloseTo(341.7, 1);
  });

  it("exclut un joueur sans tie-break ni BP (rating null)", () => {
    const flat = makeMatches("Flat Player", 5, {
      bp_saved: 0,
      bp_faced: 0,
      opp_bp_saved: 0,
      opp_bp_faced: 0,
      score: "6-4 6-4",
    });
    const out2 = aggregateLeaderboard(flat, { ...BASE_PARAMS, board: "pressure" });
    expect(out2).toHaveLength(0);
  });
});

// ─── Tri multi-joueurs ───────────────────────────────────────────────────────

describe("aggregateLeaderboard — tri", () => {
  it("trie par rating DESC et assigne les rangs", () => {
    const weak = makeMatches("Weak Player", 5, {
      first_won: 24, // 60 % au 1er
      second_won: 8, // 40 % au 2e
      aces: 2,
    });
    const strong = makeMatches("Strong Player", 6);
    const out = aggregateLeaderboard([...weak, ...strong], BASE_PARAMS);
    expect(out.map((r) => r.player)).toEqual(["Strong Player", "Weak Player"]);
    expect(out[0].rank).toBe(1);
    expect(out[1].rank).toBe(2);
  });
});


// ─── Intégration SQL via bun:sqlite (interface compatible better-sqlite3) ────

describe("extractPlayerMatchRows — SQL réel (bun:sqlite)", () => {
  // Intersection : bun:sqlite (tests) expose la même interface que le
  // SqliteLike attendu côté prod (better-sqlite3) — cast unique ici.
  function makeDb(): Database & SqliteLike {
    const db = new Database(":memory:");
    db.run(`CREATE TABLE tennis_matches_internal (
      tour TEXT, surface TEXT, match_date INTEGER,
      winner_name TEXT, loser_name TEXT,
      winner_player_id TEXT, loser_player_id TEXT,
      winner_ioc TEXT, loser_ioc TEXT,
      score TEXT, sets_winner INTEGER, sets_loser INTEGER, best_of INTEGER,
      w_svpt INTEGER, w_1stIn INTEGER, w_1stWon INTEGER, w_2ndWon INTEGER,
      w_ace INTEGER, w_df INTEGER, w_SvGms INTEGER, w_bpSaved INTEGER, w_bpFaced INTEGER,
      l_svpt INTEGER, l_1stIn INTEGER, l_1stWon INTEGER, l_2ndWon INTEGER,
      l_ace INTEGER, l_df INTEGER, l_SvGms INTEGER, l_bpSaved INTEGER, l_bpFaced INTEGER,
      winner_rank INTEGER, loser_rank INTEGER
    )`);
    return db as Database & SqliteLike;
  }

  function insertMatch(
    db: Database,
    m: {
      tour?: string; surface?: string; match_date?: number;
      winner?: string; loser?: string; score?: string;
      winner_rank?: number; loser_rank?: number;
    } = {}
  ) {
    db.run(
      `INSERT INTO tennis_matches_internal VALUES (
        ?, ?, ?, ?, ?, 'w1', 'l1', 'USA', 'ESP',
        ?, 2, 0, 3,
        60, 40, 32, 12, 12, 3, 10, 3, 4,
        55, 33, 22, 11, 2, 2, 10, 1, 3,
        ?, ?
      )`,
      [
        m.tour ?? "ATP",
        m.surface ?? "Hard",
        m.match_date ?? Date.now(),
        m.winner ?? "Big Server",
        m.loser ?? "Return Ace",
        m.score ?? "6-4 6-4",
        m.winner_rank ?? 10,
        m.loser_rank ?? 30,
      ]
    );
  }

  it("retourne 2 lignes par match (perspectives winner + loser)", () => {
    const db = makeDb();
    insertMatch(db);
    const rows = extractPlayerMatchRows(db, BASE_PARAMS);
    expect(rows).toHaveLength(2);
    const winner = rows.find((r) => r.won_match === 1)!;
    const loser = rows.find((r) => r.won_match === 0)!;
    expect(winner.player).toBe("Big Server");
    expect(winner.svpt).toBe(60);
    expect(winner.opp_rank).toBe(30);
    expect(loser.player).toBe("Return Ace");
    expect(loser.svpt).toBe(55);
    expect(loser.opp_rank).toBe(10);
    expect(loser.sets_won).toBe(0);
    expect(loser.sets_lost).toBe(2);
    db.close();
  });

  it("exclut les abandons (RET / WO)", () => {
    const db = makeDb();
    insertMatch(db, { score: "6-4 3-0 RET" });
    const rows = extractPlayerMatchRows(db, BASE_PARAMS);
    expect(rows).toHaveLength(0);
    db.close();
  });

  it("applique les filtres tour / surface / vsRank", () => {
    const db = makeDb();
    insertMatch(db, { tour: "WTA" });
    insertMatch(db, { surface: "Clay", winner: "Clay King", loser: "Big Server" });
    insertMatch(db, { winner: "Giant Killer", loser: "Numero Uno", loser_rank: 1, winner_rank: 40 });

    expect(extractPlayerMatchRows(db, BASE_PARAMS)).toHaveLength(4); // 2 matchs ATP
    expect(
      extractPlayerMatchRows(db, { ...BASE_PARAMS, tour: "wta" })
    ).toHaveLength(2);
    expect(
      extractPlayerMatchRows(db, { ...BASE_PARAMS, surface: "clay" })
    ).toHaveLength(2);
    // vs Top 5 : seul le match contre le n°1 (Giant Killer côté winner)
    const vsTop5 = extractPlayerMatchRows(db, { ...BASE_PARAMS, vsRank: "top5" });
    expect(vsTop5).toHaveLength(1);
    expect(vsTop5[0].player).toBe("Giant Killer");
    db.close();
  });

  it("bout-en-bout : extraction + agrégation cohérentes", () => {
    const db = makeDb();
    for (let i = 0; i < 5; i++) insertMatch(db);
    const rows = extractPlayerMatchRows(db, BASE_PARAMS);
    expect(rows).toHaveLength(10);
    const out = aggregateLeaderboard(rows, BASE_PARAMS);
    expect(out).toHaveLength(2);
    expect(out[0].player).toBe("Big Server");
    expect(out[0].rating).toBeCloseTo(305.7, 1);
    db.close();
  });
});
