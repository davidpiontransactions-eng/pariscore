// Tests du résolveur de statistiques hockey (bug P3.1).
//
// L'invariant central est une négation : il ne doit plus exister AUCUN chemin qui
// fabrique un but. Ces tests le verrouillent par l'absence — pas en vérifiant
// qu'une valeur est fausse, mais en vérifiant que le retour est `null` quand la
// donnée manque, et que les buts returned sont ceux de la source, jamais un
// nombre dérivé du nombre de victoires.

import { describe, expect, test } from "bun:test";
import { resolveRealTeamStats, type RealStanding } from "../hockey/team-stats";

const KHL: RealStanding[] = [
  { name: "Metallurg Magnitogorsk", gp: 8, gf: 26, ga: 16 },
  { name: "Avangard Omsk", gp: 8, gf: 22, ga: 18 },
  { name: "SKA Saint-Petersburg", gp: 8, gf: 20, ga: 20 },
];

describe("resolveRealTeamStats — les buts viennent de la source, rien d'autre", () => {
  test("reproduit gf/ga EXACTS de la source", () => {
    const s = resolveRealTeamStats("Metallurg Magnitogorsk", KHL);
    expect(s).not.toBeNull();
    expect(s?.gf).toBe(26);
    expect(s?.ga).toBe(16);
    expect(s?.gp).toBe(8);
  });

  test("correspondance partielle tolérée (cote EP vs cote source)", () => {
    const s = resolveRealTeamStats("Magnitogorsk", KHL);
    expect(s?.name).toBe("Metallurg Magnitogorsk");
    expect(s?.gf).toBe(26);
  });

  test("AUCUNE valeur dérivée des victoires : le type ne prend plus de w/otw", () => {
    // Ancien comportement : gf = round((w*2.8 + otw*2.5) / gp * gp). Avec
    // w = 0 et gp = 1, cela valait 0 — un modèle Poisson dégénéré.
    // Ici, une source à gf = 0 est distinguishable d'une source absente.
    const zeroGoals: RealStanding[] = [{ name: "Equipe Zéro", gp: 1, gf: 0, ga: 0 }];
    const s = resolveRealTeamStats("Equipe Zéro", zeroGoals);
    expect(s).not.toBeNull();
    expect(s?.gf).toBe(0);
    // Et une équipe absente ne donne PAS 0 : elle donne null.
    expect(resolveRealTeamStats("Equipe Absente", zeroGoals)).toBeNull();
  });

  test("équipe absente du classement → null, PAS un gf/ga à 0", () => {
    expect(resolveRealTeamStats("Detroit Red Wings", KHL)).toBeNull();
  });

  test("classement vide → null", () => {
    expect(resolveRealTeamStats("Metallurg Magnitogorsk", [])).toBeNull();
  });
});

describe("resolveRealTeamStats — garde-fou anti faux positif", () => {
  test("nom trop court (< 5 car.) → null même s'il est contenu dans un nom", () => {
    // Sans le garde-fou, "SKA" matcherait "SKA Saint-Petersburg" mais aussi
    // n'importe quel nom le contenant — et un nom de 2 lettres matcherait
    // la première équipe de la liste.
    expect(resolveRealTeamStats("SKA", KHL)).toBeNull();
    expect(resolveRealTeamStats("OMG", KHL)).toBeNull();
  });

  test("côté source trop court → jamais sélectionné", () => {
    const short: RealStanding[] = [
      { name: "ABC", gp: 10, gf: 99, ga: 1 },
      { name: "Metallurg Magnitogorsk", gp: 8, gf: 26, ga: 16 },
    ];
    const s = resolveRealTeamStats("Metallurg Magnitogorsk", short);
    expect(s?.name).toBe("Metallurg Magnitogorsk");
  });

  test("insensible à la casse, aux accents et à la ponctuation", () => {
    expect(resolveRealTeamStats("MÉTALLURG MAGNITOGORSK", KHL)?.gf).toBe(26);
    expect(resolveRealTeamStats("metallurg-magnitogorsk", KHL)?.name).toBe(
      "Metallurg Magnitogorsk",
    );
    // « Saint-Petersburg » est bien un sous-chaîne de « SKA Saint-Petersburg ».
    // « St-Petersburg » ne l'est PAS après normalisation (« sain » manque) :
    // c'est un autre nom, pas une variante de ponctuation.
    expect(resolveRealTeamStats("Saint-Petersburg", KHL)?.name).toBe("SKA Saint-Petersburg");
    expect(resolveRealTeamStats("St-Petersburg", KHL)).toBeNull();
  });
});

describe("resolveRealTeamStats — les splits ne sont pas inventés", () => {
  test("home/away restent undefined : le classement est GLOBAL", () => {
    const s = resolveRealTeamStats("Metallurg Magnitogorsk", KHL);
    expect(s?.home).toBeUndefined();
    expect(s?.away).toBeUndefined();
  });

  test("on ne recapte pas les buts de l'adversaire dans un split", () => {
    // LeBug équivalent : mettre le global côté home ET côté away ferait
    // afficher 26 buts marqués à domicile qui n'ont jamais eu lieu.
    const s = resolveRealTeamStats("Avangard Omsk", KHL);
    expect(s?.home?.gf).toBeUndefined();
    expect(s?.away?.ga).toBeUndefined();
  });
});