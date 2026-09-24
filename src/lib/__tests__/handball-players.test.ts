// Tests matching équipes + tri popup joueurs HBL (boucle G2 → UI G4) et
// fusion des snapshots HBL + StarLigue LNH (boucle LNH-SCRAP).
// Convention obligatoire : import depuis "bun:test" (les globals cassent le
// typecheck strict du build VPS).

import { describe, expect, test } from "bun:test";
import {
  mergeHandballSnapshots,
  playersForLeague,
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

// ─── Fusion HBL + StarLigue (boucle LNH-SCRAP) ───────────────────────────────

const lnhSnapshot: HblPlayersSnapshot = {
  scraped_at: "2026-09-24T00:00:00.000Z",
  competition: "starligue",
  season: "2026 / 2027",
  source: "test-lnh",
  players: [
    p({ name: "Kana Aksentijevic", team: "PSG", competition: "starligue", position: "GK", savePct: 33.3, saves: 31, games: 3 }),
    p({ name: "Yahia Kedous", team: "PSG", competition: "starligue", position: "Field", goals: 21, assists: 9, games: 3 }),
    p({ name: "Antoine Terguies", team: "PSG", competition: "starligue", position: "Field", goals: 15, games: 3 }),
    p({ name: "Kentin Mahe", team: "Montpellier", competition: "starligue", position: "Field", goals: 19, games: 3 }),
    p({ name: "Wesley Pardin", team: "Nantes", competition: "starligue", position: "GK", savePct: 38.1, saves: 40, games: 3 }),
  ],
};

const merged = mergeHandballSnapshots(snapshot, lnhSnapshot)!;

describe("mergeHandballSnapshots — HBL ∪ StarLigue", () => {
  test("somme des joueurs + entête 'all' + équipes dédupliquées", () => {
    expect(merged.players).toHaveLength(snapshot.players.length + lnhSnapshot.players.length);
    expect(merged.competition).toBe("all");
    expect(merged.season).toBe("2026/27 + 2026 / 2027");
    // TVB Stuttgart ×3 + HC Erlangen ×3 + Füchse Berlin + PSG ×3 + Montpellier + Nantes
    expect(merged.teams).toBe(6);
  });

  test("les deux compétitions restent accessibles dans le même snapshot", () => {
    expect(merged.players.some((x) => x.competition === "starligue")).toBe(true);
    expect(merged.players.some((x) => x.competition !== "starligue")).toBe(true);
  });

  test("repli : snapshot LNH seul ou HBL seul, null + null → null", () => {
    expect(mergeHandballSnapshots(null, lnhSnapshot)).toBe(lnhSnapshot);
    expect(mergeHandballSnapshots(snapshot, null)).toBe(snapshot);
    expect(mergeHandballSnapshots(null, null)).toBeNull();
  });

  test("topPlayersForTeam('PSG') → joueurs LNH (nom canonique flashscore)", () => {
    const res = topPlayersForTeam(merged, "PSG");
    expect(res.team).toBe("PSG");
    expect(res.field.map((x) => x.name)).toEqual(["Yahia Kedous", "Antoine Terguies"]);
    expect(res.gk.map((x) => x.name)).toEqual(["Kana Aksentijevic"]);
  });

  test("le club allemand reste intact après fusion (pas de contamination)", () => {
    const res = topPlayersForTeam(merged, "Stuttgart");
    expect(res.field.map((x) => x.name)).toEqual(["Kai Häfner", "Juri Knorr"]);
    expect(res.gk.every((x) => x.competition !== "starligue")).toBe(true);
  });

  test("requête flashscore 'Chambery Savoie' sans club → listes vides", () => {
    const res = topPlayersForTeam(merged, "Chambery Savoie");
    expect(res.field).toEqual([]);
    expect(res.gk).toEqual([]);
  });
});

describe("playersForLeague — filtre de compétition du DTO", () => {
  test("StarLigue → uniquement les joueurs LNH", () => {
    const res = playersForLeague(merged, "Starligue");
    expect(res?.players).toHaveLength(lnhSnapshot.players.length);
    expect(res?.players.every((x) => x.competition === "starligue")).toBe(true);
    expect(topPlayersForTeam(res, "Montpellier").field.map((x) => x.name)).toEqual([
      "Kentin Mahe",
    ]);
  });

  test("variante 'Liqui Moly StarLigue' et 'LNH' reconnues", () => {
    expect(playersForLeague(merged, "Liqui Moly StarLigue")?.players).toHaveLength(
      lnhSnapshot.players.length
    );
    expect(playersForLeague(merged, "LNH Division 1")?.players).toHaveLength(
      lnhSnapshot.players.length
    );
  });

  test("DHB Pokal → snapshot entier (comportement historique conservé)", () => {
    expect(playersForLeague(merged, "DHB Pokal")?.players).toHaveLength(
      merged.players.length
    );
  });

  test("ligue allemande → HBL seul (les joueurs LNH sont écartés)", () => {
    const res = playersForLeague(merged, "Bundesliga");
    expect(res?.players).toHaveLength(snapshot.players.length);
    expect(res?.players.every((x) => !x.competition || x.competition === "hbl")).toBe(true);
  });

  test("StarLigue sans snapshot LNH → listes vides (dégradation propre)", () => {
    const hblOnly = mergeHandballSnapshots(snapshot, null)!;
    const res = playersForLeague(hblOnly, "Starligue");
    expect(res?.players).toEqual([]);
    expect(topPlayersForTeam(res, "PSG").field).toEqual([]);
  });

  test("snapshot null → null sans throw", () => {
    expect(playersForLeague(null, "Starligue")).toBeNull();
  });
});
