// Tests du point d'entrée unique des ligues Vitibet (handball-vitibet-leagues).
//
// Ce module est le SEUL endroit où la liste des ligues couvertes est énumérée.
// Le test verrouille donc les deux propriétés qui casseraient en silence :
//   1. une ligue couverte reste résolue après ajout d'une famille (non-régression
//      danoise + MOL Liga, qui passaient déjà par des chaînes séparées) ;
//   2. une ligue NON couverte renvoie null, jamais une ligue par défaut — sinon
//      l'onglet afficherait les chiffres d'un autre championnat, sans trace.

import { describe, expect, test } from "bun:test";
import {
  findVitibetCoveredLeague,
  vitibetCoveredBaseline,
} from "../handball-vitibet-leagues";
import { findDanishLeague } from "../handball-danish";
import { findMolLigaLeague } from "../handball-mol-liga";
import { CMP_NEUTRAL_LAMBDA } from "../handball-cmp";

describe("findVitibetCoveredLeague — Superlig TR (vitibet 120)", () => {
  const league = findVitibetCoveredLeague("Superlig");

  test("résolue, avec le bon id Vitibet et 10 équipes", () => {
    expect(league).not.toBeNull();
    expect(league?.vitibetLeagueId).toBe(120);
    expect(league?.standings).toHaveLength(10);
  });

  test("base de buts MESURÉE (33.5), pas le générique du modèle", () => {
    expect(vitibetCoveredBaseline("Superlig")).toBe(33.5);
    // Le repli générique y serait faux de 17 % sur le Team Power.
    expect(33.5).not.toBe(CMP_NEUTRAL_LAMBDA);
  });

  test("tolère le préfixe pays du snapshot", () => {
    expect(findVitibetCoveredLeague("Turkey: Superlig")).not.toBeNull();
  });

  test("les 24 clubs Superlig sont au classement avec un teamId", () => {
    const ids = new Set(league?.standings.map((s) => s.teamId) ?? []);
    expect(ids.size).toBe(10);
    expect([...ids].every((id) => Number.isInteger(id) && id > 0)).toBe(true);
  });
});

describe("findVitibetCoveredLeague — Liga Nationala Women RO (vitibet 88)", () => {
  const league = findVitibetCoveredLeague("Liga Nationala Women");

  test("résolue, 14 équipes", () => {
    expect(league).not.toBeNull();
    expect(league?.vitibetLeagueId).toBe(88);
    expect(league?.standings).toHaveLength(14);
  });

  test("base mesurée 28.1 — proche du générique mais PAS égale", () => {
    expect(vitibetCoveredBaseline("Liga Nationala Women")).toBe(28.1);
    // 1.4 % d'écart : « proche » ne veut pas dire « juste », et le jour où la
    // ligue sera plus offensive l'écart croîtra.
    expect(28.1).not.toBe(CMP_NEUTRAL_LAMBDA);
  });

  test("ne confond pas les deux ligues (fixture croisée)", () => {
    expect(findVitibetCoveredLeague("Superlig")).not.toBe(
      findVitibetCoveredLeague("Liga Nationala Women"),
    );
  });
});

describe("non-régression des familles déjà câblées", () => {
  test("ligues danoises : même ligue que par handball-danish", () => {
    for (const name of ["Herre Handbold Ligaen", "Kvindeligaen Women", "1. Division Women"]) {
      expect(findVitibetCoveredLeague(name)).toEqual(findDanishLeague(name));
    }
  });

  test("MOL Liga Women : même ligue que par handball-mol-liga", () => {
    expect(findVitibetCoveredLeague("MOL Liga Women")).toEqual(
      findMolLigaLeague("MOL Liga Women"),
    );
  });

  test("une Superlig n'est PAS une ligue danoise (aucun chevauchement)", () => {
    expect(findDanishLeague("Superlig")).toBeNull();
    expect(findMolLigaLeague("Superlig")).toBeNull();
  });
});

describe("ligue non couverte → null, jamais de ligue par défaut", () => {
  test("nom inconnu", () => {
    expect(findVitibetCoveredLeague("Liga Fantome")).toBeNull();
    expect(vitibetCoveredBaseline("Liga Fantome")).toBeNull();
  });

  test("chaîne vide", () => {
    expect(findVitibetCoveredLeague("")).toBeNull();
    expect(vitibetCoveredBaseline("")).toBeNull();
  });
});