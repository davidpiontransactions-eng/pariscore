// Tests de la matrice backtest marchés × championnats (handball).
import { describe, test, expect } from "bun:test";
import {
  computeBacktestMatrix,
  filterMatrixByLeague,
  historyToHandballMatch,
} from "../handball-backtest-matrix";
import { MIN_SAMPLE_BETS } from "../handball-backtest";
import type { HistoryMatch } from "../handball-history-stats";

function h(
  date: string,
  league: string,
  home: string,
  away: string,
  hg: number,
  ag: number,
  hh?: number,
  ha?: number
): HistoryMatch {
  return {
    date,
    timeUtc: `${date}T18:00:00.000Z`,
    home,
    away,
    homeKey: home.toLowerCase().replace(/\s+/g, ""),
    awayKey: away.toLowerCase().replace(/\s+/g, ""),
    homeGoals: hg,
    awayGoals: ag,
    homeHalf: hh ?? null,
    awayHalf: ha ?? null,
    league,
    country: league.split(":")[0],
  };
}

/** Historique synthétique : 2 ligues × N matchs, scores déterministes. */
function makeHistory(nPerLeague: number, dateOffsetDays = 0): HistoryMatch[] {
  const out: HistoryMatch[] = [];
  const leagues = ["Germany: Bundesliga", "France: Starligue"];
  for (let li = 0; li < leagues.length; li++) {
    for (let i = 0; i < nPerLeague; i++) {
      const d = new Date(Date.now() - (i + dateOffsetDays) * 86_400_000).toISOString().slice(0, 10);
      // Dominateur local (30-24) → 1X2 et handicap gagnants, totaux > 55.5
      out.push(h(d, leagues[li], `EquipeA${li}b`, `EquipeB${li}b`, 30, 24, 15, 11));
      out.push(h(d, leagues[li], `EquipeC${li}`, `EquipeD${li}`, 26, 25, 13, 12));
    }
  }
  return out;
}

describe("historyToHandballMatch", () => {
  test("mapping complet : ids normalisés, kickoff, score + MT, pays parsé", () => {
    const row = h("2026-09-20", "Germany: Bundesliga", "THW Kiel", "Fuchse Berlin", 31, 27, 16, 12);
    const m = historyToHandballMatch(row, 0);

    expect(m.status).toBe("finished");
    expect(m.home.id).not.toBe(0); // jamais 0 (bug historique form store)
    expect(m.home.id).toBe(m.home.id); // stable
    expect(m.away.id).not.toBe(m.home.id);
    expect(m.kickoff).toBe("2026-09-20T18:00:00.000Z");
    expect(m.score).toEqual({ home: 31, away: 27, homeHalf: 16, awayHalf: 12 });
    expect(m.league.name).toBe("Germany: Bundesliga");
    expect(m.league.country).toBe("Germany");
  });

  test("id d'équipe stable : indépendant de l'index de conversion", () => {
    const row = h("2026-09-20", "L", "Flensburg-H.", "Kiel", 30, 28);
    const a = historyToHandballMatch(row, 0);
    const b = historyToHandballMatch(row, 7); // 2ᵉ passe → même bucket form store
    expect(a.home.id).toBe(b.home.id);
    expect(a.away.id).toBe(b.away.id);
    expect(a.id).not.toBe(b.id); // id de MATCH = index dans la clé → unique
  });

  test("timeUtc absent → repli midi UTC sur la date", () => {
    const m = historyToHandballMatch(
      { ...h("2026-09-20", "L", "A", "B", 30, 25), timeUtc: null },
      0
    );
    expect(m.kickoff).toBe("2026-09-20T12:00:00.000Z");
  });
});

describe("computeBacktestMatrix", () => {
  const history = makeHistory(30); // 30 j × 2 matchs × 2 ligues = 120 matchs

  test("structure : 8 marchés, ligues filtrées par volume, cells complètes", () => {
    const mx = computeBacktestMatrix(history, { topLeagues: 4, minLeagueMatches: 10 });
    expect(mx.markets).toHaveLength(8);
    expect(mx.source).toBe("handball_match_history");
    expect(mx.simulatedOdds).toBe(true);
    expect(mx.minSampleBets).toBe(MIN_SAMPLE_BETS);
    expect(mx.window).toBe("full");
    expect(mx.leagues.length).toBe(2);
    expect(mx.from).not.toBeNull();
    expect(mx.to).not.toBeNull();

    for (const l of mx.leagues) {
      expect(l.nMatches).toBeGreaterThanOrEqual(10);
      expect(Object.keys(l.cells)).toHaveLength(8);
      for (const c of Object.values(l.cells)) {
        expect(c.nBets).toBeGreaterThanOrEqual(0);
        if (c.nBets > 0) {
          expect(c.hitRate).not.toBeNull();
          expect(c.hitRate!).toBeGreaterThanOrEqual(0);
          expect(c.hitRate!).toBeLessThanOrEqual(1);
          expect(c.sampleOk).toBe(c.nBets >= MIN_SAMPLE_BETS);
        }
      }
    }
    expect(Object.keys(mx.global)).toHaveLength(8);
    expect(mx.globalCell.nBets).toBeGreaterThan(0);
  });

  test("marché Over réglable : hitRate cohérent avec les scores dominants (30+24=54... Under)", () => {
    const mx = computeBacktestMatrix(history, { minLeagueMatches: 10 });
    const over = mx.global.over55;
    const under = mx.global.under62;
    // Scores 54 et 51 → tous < 55.5 → Over perdant (0 %) et Under gagnant (100 %)
    expect(over.nBets).toBeGreaterThan(0);
    expect(over.wins).toBe(0);
    expect(under.nBets).toBeGreaterThan(0);
    expect(under.wins).toBe(under.nBets);
  });

  test("fenêtre d30 : sous-ensemble récent seulement", () => {
    const old = makeHistory(5, 90); // décalé de 90 j
    const full = computeBacktestMatrix(old, { minLeagueMatches: 1 });
    const d30 = computeBacktestMatrix(old, { window: "d30", minLeagueMatches: 1 });
    expect(full.nMatches).toBeGreaterThan(0);
    expect(d30.nMatches).toBe(0);
    expect(d30.leagues).toHaveLength(0);
    expect(d30.from).toBeNull();

    const recent = makeHistory(5, 0);
    const d30ok = computeBacktestMatrix(recent, { window: "d30", minLeagueMatches: 1 });
    expect(d30ok.nMatches).toBeGreaterThan(0);
  });

  test("topLeagues borne le nombre de lignes", () => {
    const mx = computeBacktestMatrix(history, { topLeagues: 1, minLeagueMatches: 10 });
    expect(mx.leagues).toHaveLength(1);
    expect(mx.nLeagues).toBe(2); // nLeagues = ligues présentes, pas le top
  });
});

describe("filterMatrixByLeague", () => {
  const mx = computeBacktestMatrix(makeHistory(30), { minLeagueMatches: 10 });

  test("accepte nom calendrier court et nom DB préfixé", () => {
    expect(filterMatrixByLeague(mx, "Starligue")).toBeTruthy();
    expect(filterMatrixByLeague(mx, "France: Starligue")).toBeTruthy();
    expect(filterMatrixByLeague(mx, "Bundesliga")).toBeTruthy();
  });

  test("inconnu → null (popup dégrade proprement)", () => {
    expect(filterMatrixByLeague(mx, "Ligue inexistante")).toBeNull();
    expect(filterMatrixByLeague(mx, "")).toBeNull();
  });

  test("suffixe ambigu → country départage (14 doublons en base)", () => {
    // 2 ligues « Division 1 » (Biélorussie / Israël) : sans country, la
    // première par volume gagne ; avec country, la bonne est choisie.
    const ambiguous = computeBacktestMatrix(
      [
        ...Array.from({ length: 12 }, (_, i) =>
          h(
            new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
            "Belarus: Division 1",
            `Blr${i}a`,
            `Blr${i}b`,
            30,
            24,
            15,
            11
          )
        ),
        ...Array.from({ length: 25 }, (_, i) =>
          h(
            new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10),
            "Israel: Division 1",
            `Isr${i}a`,
            `Isr${i}b`,
            28,
            26,
            14,
            12
          )
        ),
      ],
      { minLeagueMatches: 5 }
    );
    expect(ambiguous.leagues).toHaveLength(2);

    const israel = filterMatrixByLeague(ambiguous, "Division 1", "Israel");
    expect(israel?.league).toBe("Israel: Division 1");
    const belarus = filterMatrixByLeague(ambiguous, "Division 1", "Belarus");
    expect(belarus?.league).toBe("Belarus: Division 1");
    // Sans country : comportement historique (première occurrence)
    expect(filterMatrixByLeague(ambiguous, "Division 1")).toBeTruthy();
  });
});

describe("cas limites", () => {
  test("historique vide → structure vide sans crash", () => {
    const mx = computeBacktestMatrix([], { minLeagueMatches: 1 });
    expect(mx.nMatches).toBe(0);
    expect(mx.leagues).toHaveLength(0);
    expect(mx.from).toBeNull();
    expect(mx.markets).toHaveLength(8);
    expect(mx.globalCell.nBets).toBe(0);
  });

  test("ordre canonique des marchés (identique full/d30, pas de saut de chips)", () => {
    const history = makeHistory(30);
    const full = computeBacktestMatrix(history, { minLeagueMatches: 10 });
    const d30 = computeBacktestMatrix(history, { window: "d30", minLeagueMatches: 10 });
    const keysFull = full.markets.map((m) => m.key).join(",");
    const keysD30 = d30.markets.map((m) => m.key).join(",");
    expect(keysFull).toBe(keysD30);
    expect(full.markets.map((m) => m.key)).toContain("over55");
    expect(full.markets).toHaveLength(8);
  });
});
