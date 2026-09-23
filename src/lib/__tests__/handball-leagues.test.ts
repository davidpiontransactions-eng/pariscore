// Tests catalog ligues handball 1xbet — priorité de tri des filtres

import { describe, test, expect } from "bun:test";
import {
  handballLeagueTier,
  sortHandballLeagueEntries,
} from "../handball-leagues";

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
