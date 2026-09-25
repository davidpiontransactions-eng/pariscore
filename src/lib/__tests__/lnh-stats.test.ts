// Tests du matching LNH (StarLigue) — findLnhRow est pur (pas d'accès disque),
// les snapshots ne sont lus que par loadLnhTeamStats/loadLnhStanding.
import { describe, expect, test } from "bun:test";
import { findLnhRow } from "../lnh-stats";

const teams = [
  { team: "Cesson Rennes-Metropole" },
  { team: "Chambery Savoie" },
  { team: "Nantes" },
  { team: "PSG" },
];

describe("findLnhRow", () => {
  test("égalité exacte", () => {
    expect(findLnhRow(teams, "Nantes")?.team).toBe("Nantes");
    expect(findLnhRow(teams, "PSG")?.team).toBe("PSG");
  });

  test("inclusion réciproque (prénom du club tronqué dans le calendrier)", () => {
    expect(findLnhRow(teams, "Cesson Rennes")?.team).toBe("Cesson Rennes-Metropole");
    expect(findLnhRow(teams, "Cesson Rennes-Metropole (Fra)")?.team).toBe(
      "Cesson Rennes-Metropole"
    );
    expect(findLnhRow(teams, "Chambery")?.team).toBe("Chambery Savoie");
  });

  test("garde-fou longueur (≥ 5) : « PSG » court ne matche pas un autre nom", () => {
    expect(findLnhRow([{ team: "PSG Pharisiens" }], "PSG")).toBeNull();
    expect(findLnhRow(teams, "PS")).toBeNull();
  });

  test("cas limites : liste absente ou nom vide → null", () => {
    expect(findLnhRow(undefined, "Nantes")).toBeNull();
    expect(findLnhRow([], "Nantes")).toBeNull();
    expect(findLnhRow(teams, "")).toBeNull();
  });

  test("insensible casse et diacritiques", () => {
    expect(findLnhRow([{ team: "US Créteil" }], "us creteil")?.team).toBe("US Créteil");
  });
});
