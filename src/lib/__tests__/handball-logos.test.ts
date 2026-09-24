// Tests logos StarLigue (G13) — normHandballName + teamLogoUrl 16 clubs LNH.
// Noms = feed flashscore (data/flashscore_handball.json, league "Starligue") +
// variantes LNH/BetExplorer. Couverture attendue : 15/16 — Caen est le seul
// non couvert (site officiel derrière challenge Cloudflare → fallback UI).

import { describe, expect, test } from "bun:test";
import { leagueLogo, leagueCountry, normHandballName, teamLogoUrl } from "../handball-logos";

describe("normHandballName — variantes StarLigue", () => {
  test("accents, casse, ponctuation", () => {
    expect(normHandballName("Chambéry Savoie")).toBe("chamberysavoie");
    expect(normHandballName("Nîmes")).toBe("nimes");
    expect(normHandballName("St. Raphael")).toBe("straphael");
    expect(normHandballName("Saint-Raphaël")).toBe("saintraphael");
    expect(normHandballName("Cesson Rennes-Metropole")).toBe("cessonrennesmetropole");
    expect(normHandballName("Provence Aix")).toBe("provenceaix");
  });
});

describe("teamLogoUrl — 16 clubs StarLigue (flashscore)", () => {
  const covered: Record<string, string> = {
    PSG: "/logos/handball/teams/psg.png",
    Nantes: "/logos/handball/teams/nantes.png",
    Montpellier: "/logos/handball/teams/montpellier.png",
    Chartres: "/logos/handball/teams/chartres.png",
    "Chambery Savoie": "/logos/handball/teams/chambery-savoie.png",
    "Cesson Rennes-Metropole": "/logos/handball/teams/cesson-rennes-metropole.png",
    Dunkerque: "/logos/handball/teams/dunkerque.png",
    Limoges: "/logos/handball/teams/limoges.png",
    Nimes: "/logos/handball/teams/nimes.png",
    "Provence Aix": "/logos/handball/teams/provence-aix.png",
    Saran: "/logos/handball/teams/saran.png",
    Selestat: "/logos/handball/teams/selestat.png",
    "St. Raphael": "/logos/handball/teams/st-raphael.png",
    Toulouse: "/logos/handball/teams/toulouse.png",
    Tremblay: "/logos/handball/teams/tremblay.png",
  };

  for (const [name, path] of Object.entries(covered)) {
    test(`${name} → ${path}`, () => {
      expect(teamLogoUrl(name)).toBe(path);
    });
  }

  test("Caen non couvert → null (fallback initiales, documenté)", () => {
    expect(teamLogoUrl("Caen")).toBeNull();
  });

  test("variantes de nom d'autres sources → même logo", () => {
    expect(teamLogoUrl("Paris")).toBe("/logos/handball/teams/psg.png");
    expect(teamLogoUrl("Paris Saint-Germain")).toBe("/logos/handball/teams/psg.png");
    expect(teamLogoUrl("USAM Nîmes Gard")).toBe("/logos/handball/teams/nimes.png");
    expect(teamLogoUrl("Saint-Raphaël Var")).toBe("/logos/handball/teams/st-raphael.png");
    expect(teamLogoUrl("Fenix Toulouse")).toBe("/logos/handball/teams/toulouse.png");
    expect(teamLogoUrl("Chambéry")).toBe("/logos/handball/teams/chambery-savoie.png");
    expect(teamLogoUrl("HBC Cesson-Rennes")).toBe(
      "/logos/handball/teams/cesson-rennes-metropole.png",
    );
  });

  test("régression : équipes hors StarLigue inchangées", () => {
    expect(teamLogoUrl("THW Kiel")).toBe("/logos/handball/teams/kiel.png");
    expect(teamLogoUrl("Füchse Berlin")).toBe("/logos/handball/teams/fuechse-berlin.png");
    expect(teamLogoUrl("Équipe Fantôme")).toBeNull();
  });
});

describe("ligue StarLigue — logo + pays", () => {
  test("leagueLogo('Starligue')", () => {
    expect(leagueLogo("Starligue")).toBe("/logos/handball/leagues/starligue.png");
    expect(leagueLogo("StarLigue")).toBe("/logos/handball/leagues/starligue.png");
    expect(leagueLogo("Liqui Moly StarLigue")).toBeNull();
  });

  test("leagueCountry('Starligue') → FRANCE", () => {
    expect(leagueCountry("Starligue")).toBe("FRANCE");
    expect(leagueCountry("Starligue", "FRANCE")).toBe("FRANCE");
  });
});
