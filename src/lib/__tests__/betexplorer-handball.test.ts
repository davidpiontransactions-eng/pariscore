// Tests BetExplorer handball — parsing snapshot + helpers popup prématch (G9).
// Preuve mapping mi-temps : « 22:17 (7:9, 15:8) » (Stuttgart-Erlangen réel,
// 07/06/2026, betexplorer.com) → 7+15=22, 9+8=17 ✓ → halftime = 7:9 (1re MT).

import { describe, expect, test } from "bun:test";
import {
  beNamesMatch,
  clearBetExplorerCache,
  getH2H,
  getHalftimeScores,
  getRecentForm,
  loadBetExplorerHandball,
  type BetExplorerHandballSnapshot,
} from "../betexplorer-handball";
import {
  TARGET_LEAGUES,
  parseHalftime,
  parseMutualTable,
  parseResultsRows,
  parseScore,
  splitTeams,
} from "../../../scripts/scrape-betexplorer-handball";

const ROWS_HTML = `
<table class="table-main">
<tbody>
<tr class="js-tournament"><th class="h-text-left" colspan="2"><a href="/handball/germany/bundesliga/" class="table-main__tournament">Germany: Bundesliga</a></th></tr>
<tr data-dt="7,6,2026,14,00" data-def="1" data-dt-now="24,9,2026,18,00">
<td class="table-main__tt"><span class="table-main__time">14:00</span><a href="/handball/germany/bundesliga-2025-2026/stuttgart-erlangen/UuOJTd4j/"><strong>Stuttgart</strong> - Erlangen</a></td>
<td class="table-main__result"><a href="/handball/germany/bundesliga-2025-2026/stuttgart-erlangen/UuOJTd4j/"> <strong>22:17</strong></a></td>
<td class="table-main__partial" colspan="3">(7:9, 15:8)</td>
</tr>
</tbody>
</table>`;

const MUTUAL_HTML = `
<table class="table-main"><tbody>
<tr class="head-to-head__header"><th colspan="8"><a href="/handball/germany/bundesliga-2025-2026/">Bundesliga 2025/2026</a></th></tr>
<tr data-dt="7,6,2026,14,00"><td>Stuttgart</td><td><strong>Erlangen</strong></td><td class="h-text-center"><a href="/handball/germany/bundesliga-2025-2026/stuttgart-erlangen/UuOJTd4j/"><strong>22:17</strong></a></td><td class="h-text-right">07.06.2026</td></tr>
<tr class="head-to-head__header"><th colspan="8"><a href="/handball/germany/bundesliga-2024-2025/">Bundesliga 2024/2025</a></th></tr>
<tr data-dt="29,5,2025,17,00"><td><strong>Erlangen</strong></td><td>Stuttgart</td><td class="h-text-center"><a href="/handball/germany/bundesliga-2024-2025/erlangen-stuttgart/d24gpJY0/">26:23</a></td><td class="h-text-right">29.05.2025</td></tr>
</tbody></table>`;

function snapshot(): BetExplorerHandballSnapshot {
  return {
    scraped_at: "2026-09-24T12:00:00.000Z",
    source: "betexplorer",
    leagues: [
      {
        slug: "germany/bundesliga",
        name: "Germany: Bundesliga",
        matches: [
          {
            home: "Lemgo",
            away: "Erlangen",
            league: "Bundesliga",
            date: "2026-09-20",
            status: "FT",
            score: { home: 28, away: 33 },
            halftime: { home: 15, away: 18 },
            url: "/handball/germany/bundesliga/lemgo-erlangen/OI6Ol4f5/",
          },
          {
            home: "Kiel",
            away: "Flensburg-H.",
            league: "Bundesliga",
            date: "2026-09-26T17:00:00",
            status: "NS",
            score: null,
            halftime: null,
            url: "/handball/germany/bundesliga/kiel-flensburg-h/xtgsfaWp/",
          },
        ],
      },
    ],
    recent: [
      {
        home: "Stuttgart",
        away: "Erlangen",
        league: "Bundesliga",
        date: "2026-06-07T14:00:00",
        status: "FT",
        score: { home: 22, away: 17 },
        halftime: { home: 7, away: 9 },
        url: "/handball/germany/bundesliga-2025-2026/stuttgart-erlangen/UuOJTd4j/",
      },
      {
        home: "Erlangen",
        away: "Eisenach",
        league: "Bundesliga",
        date: "2026-02-26T19:00:00",
        status: "FT",
        score: { home: 25, away: 25 },
        halftime: null,
        url: "/handball/germany/bundesliga-2025-2026/eisenach-erlangen/xf7aOXiU/",
      },
    ],
    h2h: [
      {
        home: "Stuttgart",
        away: "Erlangen",
        meeting_date: "2026-06-07T14:00:00",
        league: "Bundesliga 2025/2026",
        score: { home: 22, away: 17 },
        halftime: { home: 7, away: 9 },
        pair_home: "Stuttgart",
        pair_away: "Erlangen",
      },
      {
        home: "Erlangen",
        away: "Stuttgart",
        meeting_date: "2025-11-28T19:00:00",
        league: "Bundesliga 2025/2026",
        score: { home: 24, away: 24 },
        halftime: null,
        pair_home: "Stuttgart",
        pair_away: "Erlangen",
      },
      {
        home: "Stuttgart",
        away: "Erlangen",
        meeting_date: "2024-05-29T17:00:00",
        league: "Bundesliga 2024/2025",
        score: { home: 27, away: 30 },
        halftime: null,
      },
      {
        home: "PSG",
        away: "Nantes",
        meeting_date: "2026-09-01T18:00:00",
        league: "Starligue",
        score: { home: 30, away: 28 },
        halftime: null,
      },
    ],
  };
}

describe("parseBetExplorer — scores mi-temps (preuve 22:17 (7:9, 15:8))", () => {
  test("parseHalftime : 1er bloc de la parenthèse = score MT", () => {
    expect(parseHalftime("(7:9, 15:8)")).toEqual({ home: 7, away: 9 });
    expect(parseHalftime("(14:14, 14:15)")).toEqual({ home: 14, away: 14 });
  });

  test("parseHalftime : 3e bloc = prolongation, ignorée", () => {
    expect(parseHalftime("(13:11, 16:18, 1:9)")).toEqual({ home: 13, away: 11 });
  });

  test("parseHalftime : pas de parenthèse → null", () => {
    expect(parseHalftime("22:17")).toBeNull();
    expect(parseHalftime("")).toBeNull();
    expect(parseHalftime(null as unknown as string)).toBeNull();
  });

  test("parseScore : « 22:17 » (avec ou sans tags)", () => {
    expect(parseScore("22:17")).toEqual({ home: 22, away: 17 });
    expect(parseScore("<strong>28:29</strong>")).toEqual({ home: 28, away: 29 });
    expect(parseScore("vs")).toBeNull();
  });

  test("splitTeams : favori en <strong> ne fausse pas les noms", () => {
    expect(splitTeams("<strong>Stuttgart</strong> - Erlangen")).toEqual(["Stuttgart", "Erlangen"]);
    expect(splitTeams("China - <strong>Hong Kong</strong>")).toEqual(["China", "Hong Kong"]);
  });

  test("parseResultsRows : ligne complète (heure, équipes, score, MT, ligue)", () => {
    const rows = parseResultsRows(ROWS_HTML);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    // Régression : l'heure de la cellule ne doit PAS polluer le nom du home
    expect(r.home).toBe("Stuttgart");
    expect(r.away).toBe("Erlangen");
    expect(r.score).toEqual({ home: 22, away: 17 });
    expect(r.halftime).toEqual({ home: 7, away: 9 });
    expect(r.status).toBe("FT");
    expect(r.date).toBe("2026-06-07T14:00:00");
    expect(r.league).toBe("Germany: Bundesliga");
    expect(r.url).toBe("/handball/germany/bundesliga-2025-2026/stuttgart-erlangen/UuOJTd4j/");
  });

  test("parseMutualTable (H2H) : ligue courante + rencontres triées source order", () => {
    const rows = parseMutualTable(MUTUAL_HTML);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      home: "Stuttgart",
      away: "Erlangen",
      league: "Bundesliga 2025/2026",
      score: { home: 22, away: 17 },
      meeting_date: "2026-06-07T14:00:00",
    });
    expect(rows[1].home).toBe("Erlangen");
    expect(rows[1].league).toBe("Bundesliga 2024/2025");
    expect(rows[1].score).toEqual({ home: 26, away: 23 });
  });
});

describe("beNamesMatch — matching tolérant des noms", () => {
  test("préfixe/club vs nom court", () => {
    expect(beNamesMatch("TVB Stuttgart", "Stuttgart")).toBe(true);
    expect(beNamesMatch("Stuttgart", "TVB 1898 Stuttgart")).toBe(true);
    expect(beNamesMatch("Fuchse Berlin", "Berlin")).toBe(true);
  });

  test("accents, casse, ponctuation ignorés", () => {
    expect(beNamesMatch("PSG", "p.s.g.")).toBe(true);
    expect(beNamesMatch("Göppingen", "Goppingen")).toBe(true);
  });

  test("trop court ou équipes différentes → false", () => {
    // égalité normalisée OK même court, inclusion exige ≥ 4 car. (règle projet)
    expect(beNamesMatch("HC", "hc")).toBe(true);
    expect(beNamesMatch("hc", "hcb")).toBe(false);
    expect(beNamesMatch("PSG", "Stuttgart")).toBe(false);
  });
});

describe("getHalftimeScores — MT du match résolu dans le snapshot", () => {
  const snap = snapshot();
  const q = (home: string, away: string) => ({ home: { name: home }, away: { name: away } });

  test("match FT trouvé → mi-temps", () => {
    expect(getHalftimeScores(snap, q("Stuttgart", "Erlangen"))).toEqual({ home: 7, away: 9 });
  });

  test("variantes de nom (TVB Stuttgart) → même résultat", () => {
    expect(getHalftimeScores(snap, q("TVB Stuttgart", "HG Erlangen"))).toEqual({ home: 7, away: 9 });
  });

  test("sens inversé → null (aucun FT dans ce sens)", () => {
    expect(getHalftimeScores(snap, q("Erlangen", "Stuttgart"))).toBeNull();
  });

  test("match à venir ou MT absente → null", () => {
    expect(getHalftimeScores(snap, q("Kiel", "Flensburg-H."))).toBeNull();
    expect(getHalftimeScores(snap, q("Erlangen", "Eisenach"))).toBeNull();
  });

  test("snapshot absent → null", () => {
    expect(getHalftimeScores(null, q("Stuttgart", "Erlangen"))).toBeNull();
    expect(getHalftimeScores(undefined, q("Stuttgart", "Erlangen"))).toBeNull();
  });
});

describe("getH2H — confrontations triées date desc", () => {
  const snap = snapshot();

  test("les deux sens sont inclus, tri date desc, plafonné à n", () => {
    const all = getH2H(snap, "Stuttgart", "Erlangen", 5);
    expect(all).toHaveLength(3);
    expect(all.map((m) => m.meeting_date)).toEqual([
      "2026-06-07T14:00:00",
      "2025-11-28T19:00:00",
      "2024-05-29T17:00:00",
    ]);
    const one = getH2H(snap, "TVB Stuttgart", "Erlangen", 1);
    expect(one).toHaveLength(1);
    expect(one[0].score).toEqual({ home: 22, away: 17 });
    expect(one[0].halftime).toEqual({ home: 7, away: 9 });
  });

  test("paire absente ou snapshot vide → []", () => {
    expect(getH2H(snap, "Barcelone", "Magdeburg")).toEqual([]);
    expect(getH2H(null, "Stuttgart", "Erlangen")).toEqual([]);
    expect(getH2H(snap, "", "Erlangen")).toEqual([]);
  });

  test("n=0 → []", () => {
    expect(getH2H(snap, "Stuttgart", "Erlangen", 0)).toEqual([]);
  });
});

describe("getRecentForm — derniers FT de l'équipe", () => {
  const snap = snapshot();

  test("home ou away, score + MT, date desc, plafonné", () => {
    const form = getRecentForm(snap, "Erlangen", 5);
    expect(form.map((m) => m.date)).toEqual(["2026-09-20", "2026-06-07T14:00:00", "2026-02-26T19:00:00"]);
    expect(form[0].halftime).toEqual({ home: 15, away: 18 });
    expect(getRecentForm(snap, "Erlangen", 1)).toHaveLength(1);
  });

  test("aucun FT ou équipe inconnue → []", () => {
    expect(getRecentForm(snap, "Kiel")).toEqual([]);
    expect(getRecentForm(snap, "Nantes")).toEqual([]);
    expect(getRecentForm(null, "Erlangen")).toEqual([]);
  });
});

describe("TARGET_LEAGUES — config ligues cibles (G13 StarLigue)", () => {
  test("les 4 ligues cibles sont en dur, slug « pays/ligue »", () => {
    const slugs = TARGET_LEAGUES.map((l) => l.slug);
    expect(slugs).toEqual([
      "germany/bundesliga",
      "france/starligue",
      "spain/liga-asobal",
      "europe/champions-league",
    ]);
    for (const l of TARGET_LEAGUES) {
      expect(l.slug).toMatch(/^[a-z]+\/[a-z0-9-]+$/);
      expect(l.label.length).toBeGreaterThan(0);
    }
  });

  test("france/starligue résolu par --league= (slash ou tirets)", () => {
    const want = "france/starligue";
    const asDashes = want.replace(/\//g, "-");
    expect(
      TARGET_LEAGUES.filter(
        (l) => l.slug === want || l.slug.replace(/\//g, "-") === asDashes,
      ),
    ).toHaveLength(1);
  });
});

describe("loadBetExplorerHandball — cache + snapshot absent", () => {
  test("fichier absent → null puis helpers en mode dégradé", () => {
    const prev = process.env.DATA_DIR;
    process.env.DATA_DIR = "__dir_inexistant_betexplorer__";
    clearBetExplorerCache();
    expect(loadBetExplorerHandball()).toBeNull();
    expect(getH2H(null, "a", "b")).toEqual([]);
    expect(getRecentForm(null, "a")).toEqual([]);
    expect(getHalftimeScores(null, { home: { name: "a" }, away: { name: "b" } })).toBeNull();
    clearBetExplorerCache();
    if (prev === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prev;
  });
});
