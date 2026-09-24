// Tests matching + application des cotes OddsPapi (fix finding G6-2).
// Convention obligatoire : import depuis "bun:test" (les globals cassent le
// typecheck strict du build VPS).

import { describe, expect, test } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import {
  applyPapiOdds,
  clearOddsPapiCache,
  findPapiOddsForMatch,
  loadOddsPapiSnapshot,
  type OddsPapiEvent,
  type OddsPapiSnapshot,
} from "../odds-handball-papi";
import type { HandballMatch, HandballMatchStatus, HandballOpeningOdds } from "../handball-data";
import { priorityScore } from "../../../scripts/fetch-odds-papi";

const KICKOFF = "2026-09-25T18:00:00.000Z";

function ev(partial: Partial<OddsPapiEvent> & { home: string; away: string }): OddsPapiEvent {
  return {
    league: "Bundesliga",
    kickoff: KICKOFF,
    bookmaker: "consensus",
    winner: { home: 1.75, draw: 3.9, away: 4.8 },
    total: null,
    ...partial,
  };
}

function snap(events: OddsPapiEvent[]): OddsPapiSnapshot {
  return { scraped_at: "2026-09-24T04:40:00.000Z", source: "oddspapi", events };
}

function match(over: {
  home?: string;
  away?: string;
  kickoff?: string;
  status?: HandballMatchStatus;
  odds?: HandballMatch["odds"];
  openingOdds?: HandballOpeningOdds;
} = {}): HandballMatch {
  return {
    id: 42,
    league: { id: 10, name: "Bundesliga", country: "Germany", countryCode: "" },
    home: { id: 101, name: over.home ?? "TVB Stuttgart" },
    away: { id: 102, name: over.away ?? "HC Erlangen" },
    kickoff: over.kickoff ?? KICKOFF,
    status: over.status ?? "not_started",
    odds: over.odds,
    openingOdds: over.openingOdds,
  };
}

describe("findPapiOddsForMatch — matching noms/kickoff", () => {
  const snapshot = snap([
    ev({ home: "TVB Stuttgart", away: "HC Erlangen" }),
    ev({ home: "Füchse Berlin", away: "THW Kiel", kickoff: "2026-09-26T16:00:00.000Z" }),
  ]);

  test("matching exact : noms identiques + kickoff dans les 6h", () => {
    const hit = findPapiOddsForMatch(snapshot, match());
    expect(hit).not.toBeNull();
    expect(hit?.matchConfidence).toBe("exact");
    expect(hit?.event.home).toBe("TVB Stuttgart");
  });

  test("matching fuzzy : 'TVB Stuttgart' (match) vs 'Stuttgart' (papi)", () => {
    const fuzzy = snap([ev({ home: "Stuttgart", away: "Erlangen" })]);
    const hit = findPapiOddsForMatch(fuzzy, match());
    expect(hit).not.toBeNull();
    expect(hit?.matchConfidence).toBe("fuzzy");
  });

  test("kickoff > 6h d'écart → null (homonymes distincts)", () => {
    const late = snap([ev({ home: "TVB Stuttgart", away: "HC Erlangen", kickoff: "2026-09-26T06:00:00.000Z" })]);
    expect(findPapiOddsForMatch(late, match())).toBeNull();
  });

  test("équipe absente du snapshot → null", () => {
    expect(findPapiOddsForMatch(snapshot, match({ home: "Rhein-Neckar Löwen" }))).toBeNull();
  });

  test("snapshot null/empty → null", () => {
    expect(findPapiOddsForMatch(null, match())).toBeNull();
    expect(findPapiOddsForMatch(snap([]), match())).toBeNull();
  });
});

describe("applyPapiOdds — mapping shape HandballMatch", () => {
  const snapshot = snap([
    ev({
      home: "TVB Stuttgart",
      away: "HC Erlangen",
      bookmaker: "consensus",
      winner: { home: 1.72, draw: 3.95, away: 4.9 },
      totals: [
        { line: 55.5, over: 1.87 },
        { line: 57.5, over: 1.9, under: 1.9 },
        { line: 62.5, under: 1.95 },
      ],
      handicap: { line: -4.5, home: 1.85, away: 1.98 },
    }),
  ]);

  test("snapshot absent → identity (même référence)", () => {
    const input = [match()];
    expect(applyPapiOdds(input, null)).toBe(input);
    expect(applyPapiOdds(input, snap([]))).toBe(input);
  });

  test("input jamais muté ; odds remplacés + openingOdds complétés", () => {
    const input = [match({ odds: undefined })];
    const frozen = structuredClone(input);
    const out = applyPapiOdds(input, snapshot);

    expect(input).toEqual(frozen); // non muté
    expect(out).not.toBe(input);
    const m = out[0];
    expect(m.odds).toEqual({ home: 1.72, draw: 3.95, away: 4.9 });
    expect(m.openingOdds?.fav1x2).toEqual({ home: 1.72, draw: 3.95, away: 4.9 });
    expect(m.openingOdds?.over55).toBe(1.87);
    expect(m.openingOdds?.under62).toBe(1.95);
    expect(m.openingOdds?.handicap).toBe(1.85); // favori domicile -4.5
  });

  test("ne remplit que les champs absents (flashscore existant préservé)", () => {
    const input = [
      match({
        odds: { home: 1.6, draw: 4.2, away: 5.5 },
        openingOdds: { over55: 1.99, fav1x2: { home: 2.1, away: 2.1 } },
      }),
    ];
    const out = applyPapiOdds(input, snapshot);
    const m = out[0];
    expect(m.odds).toEqual({ home: 1.72, draw: 3.95, away: 4.9 }); // 1X2 : remplacé par Papi
    expect(m.openingOdds?.over55).toBe(1.99); // ouverture 1xbet conservée
    expect(m.openingOdds?.fav1x2).toEqual({ home: 2.1, away: 2.1 }); // pas d'écrasement
    expect(m.openingOdds?.under62).toBe(1.95); // champ vide → complété
  });

  test("repli `total` (pas de tableau totals) pour under62", () => {
    const s = snap([
      ev({
        home: "TVB Stuttgart",
        away: "HC Erlangen",
        total: { line: 62.5, over: 1.8, under: 1.93 },
      }),
    ]);
    const out = applyPapiOdds([match()], s);
    expect(out[0].openingOdds?.under62).toBe(1.93);
    expect(out[0].openingOdds?.over55).toBeUndefined(); // ligne 55.5 absente → non mappée
  });

  test("handicap |line| ≠ 4.5 → non mappé (shape 1xbet non comparable)", () => {
    const s = snap([
      ev({
        home: "TVB Stuttgart",
        away: "HC Erlangen",
        handicap: { line: -6.5, home: 1.7, away: 2.1 },
      }),
    ]);
    const out = applyPapiOdds([match()], s);
    expect(out[0].openingOdds?.handicap).toBeUndefined();
  });

  test("favori extérieur (+4.5) → cote de l'extérieur", () => {
    const s = snap([
      ev({
        home: "TVB Stuttgart",
        away: "HC Erlangen",
        handicap: { line: 4.5, home: 2.6, away: 1.5 },
      }),
    ]);
    const out = applyPapiOdds([match()], s);
    expect(out[0].openingOdds?.handicap).toBe(1.5);
  });

  test("match non not_started (finished/live) → intact", () => {
    for (const status of ["finished", "live"] as const) {
      const out = applyPapiOdds([match({ status, odds: { home: 9, away: 9 } })], snapshot);
      expect(out[0].odds).toEqual({ home: 9, away: 9 });
      expect(out[0].openingOdds).toBeUndefined();
    }
  });

  test("match non trouvé → laissé tel quel (même tableau, objet identique)", () => {
    const input = [match({ home: "Benfica" })];
    const out = applyPapiOdds(input, snapshot);
    expect(out[0]).toBe(input[0]);
  });
});

describe("loadOddsPapiSnapshot — loader readonly", () => {
  test("fichier data/odds_handball_papi.json absent → null", () => {
    clearOddsPapiCache();
    const file = join(process.cwd(), "data", "odds_handball_papi.json");
    const snap = loadOddsPapiSnapshot();
    if (existsSync(file)) {
      expect(Array.isArray(snap?.events)).toBe(true);
    } else {
      expect(snap).toBeNull();
    }
    clearOddsPapiCache();
  });
});

describe("priorityScore — ligues cibles OddsPapi (G13 StarLigue/LNH)", () => {
  test("StarLigue et LNH Division 1 scorées 2 (après Bundesliga, avant ASOBAL)", () => {
    expect(priorityScore("StarLigue")).toBe(2);
    expect(priorityScore("LNH Division 1")).toBe(2);
    expect(priorityScore("Liqui Moly StarLigue")).toBe(2);
    expect(priorityScore("Bundesliga")).toBeLessThan(priorityScore("StarLigue"));
    expect(priorityScore("StarLigue")).toBeLessThan(priorityScore("Liga ASOBAL"));
    expect(priorityScore("StarLigue")).toBeLessThan(priorityScore("EHF Champions League"));
  });

  test("femmes dépriorisées (hors périmètre de la boucle quotidienne)", () => {
    expect(priorityScore("StarLigue Women")).toBe(99);
    expect(priorityScore("Liga ASOBAL Women")).toBe(99);
  });
});
