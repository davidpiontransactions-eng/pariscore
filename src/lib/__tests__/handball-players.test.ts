// Tests matching équipes + tri popup joueurs HBL (boucle G2 → UI G4).
// Convention obligatoire : import depuis "bun:test" (les globals cassent le
// typecheck strict du build VPS).

import { describe, expect, test } from "bun:test";
import {
  topPlayersForTeam,
  type HblPlayer,
  type HblPlayersSnapshot,
  type HblPosition,
} from "../handball-players";

function p(
  partial: Partial<HblPlayer> & { name: string; team: string; position: HblPosition }
): HblPlayer {
  return { goals: 0, games: 1, ...partial };
}

const snapshot: HblPlayersSnapshot = {
  scraped_at: "2026-09-24T00:00:00.000Z",
  competition: "all",
  season: "2026/27",
  source: "test",
  players: [
    p({ name: "Kai Häfner", team: "TVB Stuttgart", position: "Field", goals: 41, assists: 12, games: 5 }),
    p({ name: "Juri Knorr", team: "TVB Stuttgart", position: "Field", goals: 18, assists: 20, games: 5 }),
    p({ name: "Pascal Birmann", team: "TVB Stuttgart", position: "GK", savePct: 31.2, saves: 40, games: 5 }),
    p({ name: "Georg Behrla", team: "HC Erlangen", position: "Field", goals: 25, games: 5 }),
    p({ name: "Ole Hagedorn", team: "HC Erlangen", position: "Field", goals: 17, games: 5 }),
    p({ name: "Lasse Lange", team: "HC Erlangen", position: "GK", savePct: 38.5, saves: 22, games: 5 }),
    p({ name: "Mathias Gidsel", team: "Füchse Berlin", position: "Field", goals: 43, games: 5 }),
  ],
};

describe("topPlayersForTeam — matching de noms", () => {
  test("nom exact 'TVB Stuttgart' : 2 Field triés par buts + 1 GK", () => {
    const res = topPlayersForTeam(snapshot, "TVB Stuttgart");
    expect(res.field.map((x) => x.name)).toEqual(["Kai Häfner", "Juri Knorr"]);
    expect(res.gk.map((x) => x.name)).toEqual(["Pascal Birmann"]);
    expect(res.team).toBe("TVB Stuttgart");
  });

  test("partiel 'Stuttgart' matche via inclusion normalisée", () => {
    const res = topPlayersForTeam(snapshot, "Stuttgart");
    expect(res.field).toHaveLength(2);
    expect(res.gk).toHaveLength(1);
    expect(res.team).toBe("TVB Stuttgart");
  });

  test("casse différente 'tvb stuttgart' → même résultat", () => {
    const res = topPlayersForTeam(snapshot, "tvb stuttgart");
    expect(res.field.map((x) => x.name)).toEqual(["Kai Häfner", "Juri Knorr"]);
  });

  test("accents : requête 'fuchse berlin' matche 'Füchse Berlin'", () => {
    const res = topPlayersForTeam(snapshot, "fuchse berlin");
    expect(res.field.map((x) => x.name)).toEqual(["Mathias Gidsel"]);
  });

  test("requête 'berlin' ⊂ 'fuchseberlin' (sens inverse)", () => {
    const res = topPlayersForTeam(snapshot, "BERLIN");
    expect(res.field).toHaveLength(1);
    expect(res.team).toBe("Füchse Berlin");
  });

  test("'Erlangen' : Field triés par buts, GK par savePct", () => {
    const res = topPlayersForTeam(snapshot, "Erlangen");
    expect(res.field.map((x) => x.name)).toEqual(["Georg Behrla", "Ole Hagedorn"]);
    expect(res.gk.map((x) => x.name)).toEqual(["Lasse Lange"]);
    expect(res.gk[0].savePct).toBe(38.5);
  });

  test("séparation GK/Field : jamais de GK dans field ni l'inverse", () => {
    const res = topPlayersForTeam(snapshot, "Stuttgart");
    expect(res.field.every((x) => x.position === "Field")).toBe(true);
    expect(res.gk.every((x) => x.position === "GK")).toBe(true);
  });
});

describe("topPlayersForTeam — limites & dégradation", () => {
  test("paramètre n borne chaque liste", () => {
    const res = topPlayersForTeam(snapshot, "Stuttgart", 1);
    expect(res.field).toHaveLength(1);
    expect(res.gk).toHaveLength(1);
    expect(res.field[0].name).toBe("Kai Häfner");
  });

  test("équipe inconnue → listes vides", () => {
    const res = topPlayersForTeam(snapshot, "THW Kiel");
    expect(res.field).toEqual([]);
    expect(res.gk).toEqual([]);
  });

  test("requête trop courte (< 4 normalisés) sans égalité → pas de faux positif", () => {
    // "HC" normalisé = 2 chars, aucune équipe nommée exactement "HC"
    const res = topPlayersForTeam(snapshot, "HC");
    expect(res.field).toEqual([]);
    expect(res.gk).toEqual([]);
  });

  test("snapshot null → listes vides sans throw", () => {
    const res = topPlayersForTeam(null, "Stuttgart");
    expect(res.field).toEqual([]);
    expect(res.gk).toEqual([]);
  });

  test("départage à buts égaux : assists puis nom", () => {
    const tie: HblPlayersSnapshot = {
      ...snapshot,
      players: [
        p({ name: "Zoe Zorro", team: "TVB Stuttgart", position: "Field", goals: 10, assists: 2, games: 5 }),
        p({ name: "Adam Assec", team: "TVB Stuttgart", position: "Field", goals: 10, assists: 9, games: 5 }),
      ],
    };
    const res = topPlayersForTeam(tie, "Stuttgart");
    expect(res.field.map((x) => x.name)).toEqual(["Adam Assec", "Zoe Zorro"]);
  });
});
