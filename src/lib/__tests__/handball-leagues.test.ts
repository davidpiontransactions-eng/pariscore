// Tests catalog ligues handball 1xbet — priorité de tri des filtres
// + comptage par journée (compteur du popover du calendrier)

import { describe, test, expect } from "bun:test";
import {
  countHandballLeagues,
  handballLeagueTier,
  sortHandballLeagueEntries,
} from "../handball-leagues";
import { parisDateOf } from "../handball-backtest-today";
import type { HandballMatch } from "../handball-data";

describe("handballLeagueTier", () => {
  test("compétitions 1xbet majeures en tête", () => {
    expect(handballLeagueTier("Champions League")).toBeLessThan(handballLeagueTier("Starligue"));
    expect(handballLeagueTier("Starligue")).toBeLessThan(handballLeagueTier("1. Division"));
    expect(handballLeagueTier("World Championship")).toBeLessThan(handballLeagueTier("I Liga"));
    expect(handballLeagueTier("European Championship U20")).toBeLessThan(handballLeagueTier("Extraliga"));
    expect(handballLeagueTier("Liga ASOBAL")).toBeLessThan(handballLeagueTier("Slovakia Cup"));
  });

  test("ligue inconnue → tier par défaut élevé", () => {
    expect(handballLeagueTier("Ligue Fantôme")).toBeGreaterThanOrEqual(50);
  });

  test("femmes couvertes (Champions League Women)", () => {
    expect(handballLeagueTier("Champions League Women")).toBe(handballLeagueTier("Champions League"));
  });
});

describe("sortHandballLeagueEntries", () => {
  test("tier avant count : petite ligue majeure > gros volume inconnu", () => {
    const sorted = sortHandballLeagueEntries([
      { name: "1. Division", count: 30 },
      { name: "Champions League", count: 2 },
      { name: "Starligue", count: 5 },
    ]);
    expect(sorted.map((e) => e.name)).toEqual(["Champions League", "Starligue", "1. Division"]);
  });

  test("même tier → count décroissant", () => {
    const sorted = sortHandballLeagueEntries([
      { name: "Bundesliga", count: 3 },
      { name: "Starligue", count: 8 },
    ]);
    expect(sorted[0].name).toBe("Starligue");
  });
});

// ─── countHandballLeagues — le compteur suit la journée affichée ───
//
// Régression du 2026-10-08 : le déclencheur du popover annonçait
// « Tous les championnats (579) » = toute la fenêtre à venir, alors que le
// calendrier n'affichait qu'une journée. `all` sert à énumérer les ligues
// (liste stable), `scope` à compter (journée active).

describe("countHandballLeagues", () => {
  const m = (
    league: string,
    kickoff: string,
    country = "GERMANY",
  ): HandballMatch =>
    ({
      id: Math.abs(hash(league + kickoff)),
      league: { id: 1, name: league, country, countryCode: "" },
      home: { id: 1, name: "A" },
      away: { id: 2, name: "B" },
      kickoff,
      status: "not_started",
    }) satisfies HandballMatch;

  // 3 matchs sur J+0, 2 sur J+1.
  const all: HandballMatch[] = [
    m("Bundesliga", "2026-10-08T17:00:00Z"),
    m("Bundesliga", "2026-10-08T19:00:00Z"),
    m("Starligue", "2026-10-08T17:30:00Z"),
    m("Bundesliga", "2026-10-09T17:00:00Z"),
    m("Starligue", "2026-10-09T17:30:00Z"),
  ];
  const onDay = (iso: string) => (kickoff: string) => {
    const d = parisDateOf(kickoff);
    return d === iso ? d : null;
  };

  test("compte sur le périmètre, énumère sur la fenêtre complète", () => {
    const leagues = countHandballLeagues(all, all, onDay("2026-10-08"));
    // 3 ligues énumérées… non : 2 ligues, mais Starligue tombe à 1 (le 2e
    // match est sur J+1) et Bundesliga à 2.
    expect(leagues.map((l) => l.name).sort()).toEqual(["Bundesliga", "Starligue"]);
    expect(leagues.find((l) => l.name === "Bundesliga")?.count).toBe(2);
    expect(leagues.find((l) => l.name === "Starligue")?.count).toBe(1);
    expect(leagues.reduce((s, l) => s + l.count, 0)).toBe(3);
  });

  test("changer de jour change le total (plus le volume de la fenêtre)", () => {
    expect(countHandballLeagues(all, all, onDay("2026-10-08")).reduce((s, l) => s + l.count, 0)).toBe(3);
    expect(countHandballLeagues(all, all, onDay("2026-10-09")).reduce((s, l) => s + l.count, 0)).toBe(2);
    expect(countHandballLeagues(all, all).reduce((s, l) => s + l.count, 0)).toBe(5);
  });

  test("une ligue absente de la journée reste listée à 0 (filtre réinitialisable)", () => {
    const onlyBundesliga = all.filter((x) => x.league.name === "Bundesliga");
    const leagues = countHandballLeagues(all, onlyBundesliga, () => "2026-10-08");
    expect(leagues.map((l) => l.name).sort()).toEqual(["Bundesliga", "Starligue"]);
    expect(leagues.find((l) => l.name === "Starligue")?.count).toBe(0);
  });

  test("le jour est civil Europe/Paris : 21:00Z reste le même jour (CEST +2)", () => {
    // 21:00Z = 23:00 Paris → journée du 08 ; 22:00Z = 00:00 Paris → journée du 09.
    const late: HandballMatch[] = [
      m("Bundesliga", "2026-10-08T21:00:00Z"),
      m("Bundesliga", "2026-10-08T22:00:00Z"),
    ];
    expect(countHandballLeagues(late, late, onDay("2026-10-08"))[0]?.count).toBe(1);
    expect(countHandballLeagues(late, late, onDay("2026-10-09"))[0]?.count).toBe(1);
  });

  test("liste vide → [] (jamais de throw)", () => {
    expect(countHandballLeagues([], [])).toEqual([]);
  });
});

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
