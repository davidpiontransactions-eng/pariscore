// Tests — lib basketball-history-db (lecture basketball_match_history)
// Zéro réseau : base SQLite en mémoire peuplée avec fixtures ESPN/EuroLeague.

import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import {
  loadBasketballHistory,
  basketballHistoryMeta,
  listBasketballTeamKeys,
} from "../../lib/basketball-history-db";

const SCHEMA = `
  CREATE TABLE basketball_match_history (
    key TEXT PRIMARY KEY, date TEXT NOT NULL, time_utc TEXT,
    home TEXT NOT NULL, away TEXT NOT NULL, home_key TEXT NOT NULL, away_key TEXT NOT NULL,
    home_score INTEGER NOT NULL, away_score INTEGER NOT NULL,
    home_quarters TEXT, away_quarters TEXT, league TEXT, season TEXT, round TEXT,
    venue TEXT, winner_key TEXT, src TEXT NOT NULL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL
  );
`;

function seedDb(): string {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  const ins = db.prepare(
    `INSERT INTO basketball_match_history VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  void ins; // (les lignes :memory: ne servent qu'au schéma de référence)
  // (key, date, time_utc, home, away, home_key, away_key, hs, as, hq, aq, league, season, round, venue, winner, src, fs, ls)
  ins.run("nba-1", "2026-10-06", "2026-10-06T23:00Z", "Celtics", "Knicks", "BOS", "NYK", 110, 104, "[28,29,27,26]", "[25,26,26,27]", "NBA", "2026", "type2", "TD Garden", "BOS", "espn-nba", "", "");
  ins.run("euro-E2025-120", "2026-05-24", "2026-05-24T20:00Z", "Dubai Basketball", "Partizan", "DUB", "PAR", 89, 76, "[28,19,21,21]", "[18,22,16,20]", "EuroLeague", "E2025", "47", null, "DUB", "euroleague-api", "", "");
  ins.run("nba-2", "2026-10-05", "2026-10-05T00:30Z", "Hornets", "Nets", "CHA", "BKN", 98, 102, null, null, "NBA", "2026", "type1", null, "BKN", "espn-nba", "", "");
  ins.run("ucup-U2025-9", "2026-04-28", "2026-04-28T17:30Z", "JL Bourg", "Beşiktaş", "Bourg", "BES", 73, 71, "[19,17,18,19]", "[16,18,18,19]", "EuroCup", "U2025", "37", null, "Bourg", "euroleague-api", "", "");
  db.close();
  // fixture réutilisable : fichier temporaire UNIQUE par run (pas d'état résiduel)
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- bun:test contexte
  const fs = require("fs");
  const path = `tmp/basketball-history-test-${process.pid}-${Date.now()}.db`;
  fs.mkdirSync("tmp", { recursive: true });
  const d2 = new Database(path);
  d2.exec("DROP TABLE IF EXISTS basketball_match_history");
  d2.exec(SCHEMA);
  const i2 = d2.prepare(`INSERT INTO basketball_match_history VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  i2.run("nba-1", "2026-10-06", "2026-10-06T23:00Z", "Celtics", "Knicks", "BOS", "NYK", 110, 104, "[28,29,27,26]", "[25,26,26,27]", "NBA", "2026", "type2", "TD Garden", "BOS", "espn-nba", "", "");
  i2.run("euro-E2025-120", "2026-05-24", "2026-05-24T20:00Z", "Dubai Basketball", "Partizan", "DUB", "PAR", 89, 76, "[28,19,21,21]", "[18,22,16,20]", "EuroLeague", "E2025", "47", null, "DUB", "euroleague-api", "", "");
  i2.run("nba-2", "2026-10-05", "2026-10-05T00:30Z", "Hornets", "Nets", "CHA", "BKN", 98, 102, null, null, "NBA", "2026", "type1", null, "BKN", "espn-nba", "", "");
  i2.run("ucup-U2025-9", "2026-04-28", "2026-04-28T17:30:00Z", "JL Bourg", "Beşiktaş", "Bourg", "BES", 73, 71, "[19,17,18,19]", "[16,18,18,19]", "EuroCup", "U2025", "37", null, "Bourg", "euroleague-api", "", "");
  d2.close();
  return path;
}

describe("loadBasketballHistory", () => {
  const file = seedDb();

  test("toutes les lignes (chronologiques DESC)", () => {
    const all = loadBasketballHistory({}, file);
    expect(all.length).toBe(4);
    expect(all.map((m) => m.date)).toEqual(["2026-10-06", "2026-10-05", "2026-05-24", "2026-04-28"]);
  });

  test("filtre league + quarts parsés en tableau", () => {
    const nba = loadBasketballHistory({ league: "NBA" }, file);
    expect(nba.length).toBe(2);
    expect(nba[0].homeQuarters).toEqual([28, 29, 27, 26]);
    expect(nba[1].homeQuarters).toBeNull();
  });

  test("filtre team (home OU away, key insensible à la casse)", () => {
    expect(loadBasketballHistory({ team: "bos" }, file).map((m) => m.key)).toEqual(["nba-1"]);
    expect(loadBasketballHistory({ team: "PAR" }, file).map((m) => m.key)).toEqual(["euro-E2025-120"]);
  });

  test("filtres from/to bornés", () => {
    const w = loadBasketballHistory({ from: "2026-05-01", to: "2026-10-31" }, file);
    expect(w.map((m) => m.key)).toEqual(["nba-1", "nba-2", "euro-E2025-120"]);
  });

  test("limit appliqué", () => {
    expect(loadBasketballHistory({ limit: 2 }, file).length).toBe(2);
  });

  test("toMatch : winner + src + timeUtc", () => {
    const [m] = loadBasketballHistory({ team: "DUB" }, file);
    expect(m.winnerKey).toBe("DUB");
    expect(m.src).toBe("euroleague-api");
    expect(m.timeUtc).toBe("2026-05-24T20:00Z");
  });
});

describe("basketballHistoryMeta", () => {
  const file = seedDb();

  test("total + répartition par ligue", () => {
    const meta = basketballHistoryMeta(file);
    expect(meta).not.toBeNull();
    expect(meta!.total).toBe(4);
    const leagues = meta!.byLeague.map((l) => `${l.league}:${l.n}`).join(",");
    expect(leagues).toBe("EuroCup:1,EuroLeague:1,NBA:2");
  });
});

describe("listBasketballTeamKeys", () => {
  test("codes distincts triés", () => {
    expect(listBasketballTeamKeys(seedDb())).toEqual(["BES", "BKN", "BOS", "Bourg", "CHA", "DUB", "NYK", "PAR"]);
  });
});

describe("dégradation base absente", () => {
  test("fichier inexistant → liste vide (jamais de throw)", () => {
    expect(loadBasketballHistory({}, "tmp/base-inexistante-bb.db")).toEqual([]);
  });
});
