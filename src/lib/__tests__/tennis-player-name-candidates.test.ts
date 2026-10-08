// Régression : les APIs sources servent les joueurs en « Prénom N. » alors que
// la base stocke le nom complet. Sans ces variantes, la carte live/prématch
// retombait sur `Elo 1500 / #— / SPS — / DR —`.
import { describe, expect, test } from "bun:test";
import { normalizeName, playerNameCandidates } from "@/lib/tennis-stats/db";

describe("playerNameCandidates", () => {
  test("nom complet : la variante exacte passe en premier", () => {
    expect(playerNameCandidates("Stefanos Tsitsipas")[0]).toBe("stefanos tsitsipas");
    expect(playerNameCandidates("Stefanos Tsitsipas")).toContain("tsitsipas");
  });

  test("« Prénom N. » : remonte l'initiale puis propose le nom de famille", () => {
    const c = playerNameCandidates("Tsitsipas S.");
    expect(c[0]).toBe("tsitsipas s");
    expect(c).toContain("s tsitsipas");
    expect(c).toContain("tsitsipas");
  });

  test("« N. Prénom » : propose aussi le nom de famille seul", () => {
    const c = playerNameCandidates("S. Tsitsipas");
    expect(c).toContain("tsitsipas");
  });

  test("ne propose jamais de famille d'un seul caractère", () => {
    // « Tsitsipas S. » → la variante single-letter « s » est déjà dans base ;
    // une initiale NE doit pas devenir un candidat de famille.
    expect(playerNameCandidates("Tsitsipas S.")).not.toContain("s");
  });

  test("dédoublonne et tolère la ponctuation / casse / accents", () => {
    const c = playerNameCandidates("  Althmaier, D.  ");
    expect(new Set(c).size).toBe(c.length);
    expect(c[0]).toBe(normalizeName("Althmaier, D."));
  });

  test("chaîne vide / ponctuation seule → aucun candidat", () => {
    expect(playerNameCandidates("")).toEqual([]);
    expect(playerNameCandidates("   ")).toEqual([]);
    expect(playerNameCandidates("...")).toEqual([]);
  });
});