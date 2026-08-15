import { describe, test, expect } from "bun:test";
import {
  parseTimeFilter,
  filterByStartWindow,
  filterByToday,
} from "../match-view";
import {
  footballToRaw,
  groupRawMatches,
  filterTreeByQuery,
  applyTimeFilter,
  sortSportsTree,
  emptySportNode,
  type RawTreeMatch,
} from "../sports-tree";

// ─── parseTimeFilter ───────────────────────────────────────────────────────

describe("parseTimeFilter", () => {
  test("'all' → aucune fenêtre", () => {
    expect(parseTimeFilter("all")).toEqual({ hours: null, today: false });
  });
  test("'2h' → fenêtre 2 heures", () => {
    expect(parseTimeFilter("2h")).toEqual({ hours: 2, today: false });
  });
  test("'24h' → fenêtre 24 heures", () => {
    expect(parseTimeFilter("24h")).toEqual({ hours: 24, today: false });
  });
  test("'today' → jour calendaire", () => {
    expect(parseTimeFilter("today")).toEqual({ hours: null, today: true });
  });
});

// ─── filterByToday ─────────────────────────────────────────────────────────

describe("filterByToday", () => {
  const now = new Date("2026-08-15T14:00:00");
  type M = { at: string };
  const items: M[] = [
    { at: "2026-08-15T09:00:00" }, // aujourd'hui
    { at: "2026-08-15T23:59:00" }, // aujourd'hui (fin de jour)
    { at: "2026-08-16T09:00:00" }, // demain
    { at: "2026-08-14T09:00:00" }, // hier
  ];

  test("ne garde que le jour calendaire courant", () => {
    const out = filterByToday(items, (m) => m.at, now);
    expect(out).toHaveLength(2);
  });

  test("match sans date exclu", () => {
    const out = filterByToday([{ at: "" }], (m) => m.at || null, now);
    expect(out).toHaveLength(0);
  });
});

// ─── filterByStartWindow (rappel du comportement existant) ─────────────────

describe("filterByStartWindow", () => {
  const now = new Date("2026-08-15T14:00:00");
  type M = { at: string };

  test("hours=null → liste inchangée", () => {
    const items: M[] = [{ at: "2026-08-15T15:00:00" }, { at: "2026-08-20T15:00:00" }];
    expect(filterByStartWindow(items, null, (m) => m.at, now)).toHaveLength(2);
  });

  test("fenêtre 2h inclut +1h, exclut +3h", () => {
    const items: M[] = [
      { at: "2026-08-15T15:00:00" }, // +1h ✓
      { at: "2026-08-15T17:00:00" }, // +3h ✗
    ];
    const out = filterByStartWindow(items, 2, (m) => m.at, now);
    expect(out).toHaveLength(1);
    expect(out[0].at).toBe("2026-08-15T15:00:00");
  });
});

// ─── footballToRaw + groupRawMatches ───────────────────────────────────────

describe("footballToRaw + groupRawMatches", () => {
  const matches = [
    {
      id: "1",
      scheduledAt: "2026-08-15T19:00:00Z",
      league: { id: "ligue1", name: "Ligue 1", country: "France", countryCode: "FR" },
      home: { name: "PSG" },
      away: { name: "OM" },
      live: null,
    },
    {
      id: "2",
      scheduledAt: "2026-08-15T20:00:00Z",
      league: { id: "ligue1", name: "Ligue 1", country: "France", countryCode: "FR" },
      home: { name: "Lyon" },
      away: { name: "Lille" },
      live: { status: "LIVE" },
    },
    {
      id: "3",
      scheduledAt: "2026-08-16T15:00:00Z",
      league: { id: "epl", name: "Premier League", country: "England", countryCode: "GB-ENG" },
      home: { name: "Arsenal" },
      away: { name: "Chelsea" },
      live: null,
    },
  ];

  test("normalise les matchs en RawTreeMatch", () => {
    const raw = footballToRaw(matches);
    expect(raw).toHaveLength(3);
    expect(raw[1].isLive).toBe(true);
    expect(raw[0].countryName).toBe("France");
  });

  test("groupe Pays → Ligue avec counts et live", () => {
    const node = groupRawMatches("football", footballToRaw(matches));
    expect(node.totalMatches).toBe(3);
    expect(node.liveMatches).toBe(1);
    expect(node.countries).toHaveLength(2);
    const france = node.countries.find((c) => c.name === "France")!;
    expect(france.leagues).toHaveLength(1);
    expect(france.leagues[0].matchCount).toBe(2);
    expect(france.leagues[0].id).toBe("football:ligue1");
  });

  test("payload vide → nœud vide sans exception", () => {
    const node = groupRawMatches("football", footballToRaw([]));
    expect(node.totalMatches).toBe(0);
    expect(node.countries).toHaveLength(0);
  });
});

// ─── filterTreeByQuery ─────────────────────────────────────────────────────

describe("filterTreeByQuery", () => {
  function raw(id: string, league: string, country: string, home: string, away: string): RawTreeMatch {
    return {
      id,
      homeName: home,
      awayName: away,
      scheduledAt: "2026-08-15T19:00:00Z",
      isLive: false,
      leagueId: league.toLowerCase().replace(/\s+/g, "-"),
      leagueName: league,
      countryName: country,
      countryCode: "INT",
    };
  }
  const tree = [
    groupRawMatches("football", [
      raw("1", "Ligue 1", "France", "PSG", "Marseille"),
      raw("2", "Premier League", "England", "Arsenal", "Chelsea"),
    ]),
    emptySportNode("tennis"),
  ];

  test("query < 2 lettres → arbre inchangé", () => {
    expect(filterTreeByQuery(tree, "p")).toHaveLength(2);
  });

  test("recherche par nom de ligue", () => {
    const out = filterTreeByQuery(tree, "ligue");
    expect(out).toHaveLength(1);
    expect(out[0].countries[0].leagues[0].name).toBe("Ligue 1");
  });

  test("recherche par nom d'équipe (élagage des autres ligues)", () => {
    const out = filterTreeByQuery(tree, "arsenal");
    expect(out).toHaveLength(1);
    const leagues = out[0].countries.flatMap((c) => c.leagues);
    expect(leagues).toHaveLength(1);
    expect(leagues[0].name).toBe("Premier League");
  });

  test("aucun résultat → arbre vide", () => {
    expect(filterTreeByQuery(tree, "zzzz")).toHaveLength(0);
  });
});

// ─── applyTimeFilter ───────────────────────────────────────────────────────

describe("applyTimeFilter", () => {
  const now = new Date("2026-08-15T14:00:00");
  const raws: RawTreeMatch[] = [
    {
      id: "1",
      homeName: "A",
      awayName: "B",
      scheduledAt: "2026-08-15T15:00:00Z", // +1h ✓ fenêtre 2h
      isLive: false,
      leagueId: "l1",
      leagueName: "L1",
      countryName: "France",
      countryCode: "FR",
    },
    {
      id: "2",
      homeName: "C",
      awayName: "D",
      scheduledAt: "2026-08-17T15:00:00Z", // hors fenêtre
      isLive: false,
      leagueId: "l1",
      leagueName: "L1",
      countryName: "France",
      countryCode: "FR",
    },
    {
      id: "3",
      homeName: "E",
      awayName: "F",
      scheduledAt: "2026-08-10T15:00:00Z", // vieux match LIVE : toujours visible
      isLive: true,
      leagueId: "l1",
      leagueName: "L1",
      countryName: "France",
      countryCode: "FR",
    },
  ];
  const tree = [groupRawMatches("football", raws)];

  test("'all' → arbre inchangé", () => {
    const out = applyTimeFilter(tree, "all", now);
    expect(out[0].totalMatches).toBe(3);
  });

  test("'2h' → ne garde que la fenêtre + les lives", () => {
    const out = applyTimeFilter(tree, "2h", now);
    expect(out[0].totalMatches).toBe(2);
    expect(out[0].liveMatches).toBe(1);
  });

  test("ligue entièrement hors fenêtre → supprimée", () => {
    const tree2 = [
      groupRawMatches("football", [
        { ...raws[0], scheduledAt: "2026-08-20T15:00:00Z", isLive: false },
      ]),
    ];
    const out = applyTimeFilter(tree2, "2h", now);
    expect(out[0].totalMatches).toBe(0);
    expect(out[0].countries).toHaveLength(0);
  });
});

// ─── sortSportsTree ────────────────────────────────────────────────────────

describe("sortSportsTree", () => {
  test("tri par nombre de matchs décroissant", () => {
    const a = { ...emptySportNode("tennis"), totalMatches: 5 };
    const b = { ...emptySportNode("football"), totalMatches: 42 };
    const out = sortSportsTree([a, b]);
    expect(out[0].id).toBe("football");
  });
});
