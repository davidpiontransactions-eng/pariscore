// Tests logos handball — normHandballName + teamLogoUrl.
// Couverture 1 : 15/16 clubs StarLigue (Caen est le seul non couvert, site
// officiel derrière challenge Cloudflare → fallback UI).
// Couverture 2 : 24 clubs Superlig TR (vitibet 120) + Liga Nationala Women RO
// (vitibet 88), résolus par teamId API-Sports — voir handball-logos.ts.
// Noms = feed flashscore / vitibet + variantes LNH/BetExplorer.

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

describe("teamLogoUrl — 24 clubs Superlig TR + Liga Nationala Women RO", () => {
  const covered: Record<string, string> = {
    // Superlig Turquie (vitibet 120)
    Besiktas: "/logos/handball/teams/besiktas.png",
    "Spor Toto": "/logos/handball/teams/spor-toto.png",
    "Istanbul Genclik Spor Kulubu": "/logos/handball/teams/istanbul-genclik-spor-kulubu.png",
    "Bursa Nilufer Belediyespor": "/logos/handball/teams/bursa-nilufer-belediyespor.png",
    "Beykoz Bld.": "/logos/handball/teams/beykoz-bld.png",
    Mihaliccik: "/logos/handball/teams/mihaliccik.png",
    Giresunspor: "/logos/handball/teams/giresunspor.png",
    Trabzon: "/logos/handball/teams/trabzon.png",
    Goztepe: "/logos/handball/teams/goztepe.png",
    Guneysu: "/logos/handball/teams/guneysu.png",
    // Liga Nationala Women Roumanie (vitibet 88)
    "CSM Bucuresti W": "/logos/handball/teams/csm-bucuresti-w.png",
    "Bistrita W": "/logos/handball/teams/bistrita-w.png",
    "Dunarea Braila W": "/logos/handball/teams/dunarea-braila-w.png",
    "CSM Slatina W": "/logos/handball/teams/csm-slatina-w.png",
    "Rapid Bucuresti W": "/logos/handball/teams/rapid-bucuresti-w.png",
    "Ramnicu Valcea W": "/logos/handball/teams/ramnicu-valcea-w.png",
    "SCM Craiova W": "/logos/handball/teams/scm-craiova-w.png",
    "Baia Mare W": "/logos/handball/teams/baia-mare-w.png",
    "Targu Jiu W": "/logos/handball/teams/targu-jiu-w.png",
    "Corona Brasov W": "/logos/handball/teams/corona-brasov-w.png",
    "Zalau W": "/logos/handball/teams/zalau-w.png",
    "Iasi W": "/logos/handball/teams/iasi-w.png",
    "Stiinta Bucharest W": "/logos/handball/teams/stiinta-bucharest-w.png",
    "Targu Mures W": "/logos/handball/teams/targu-mures-w.png",
  };

  for (const [name, path] of Object.entries(covered)) {
    test(`${name} → ${path}`, () => {
      expect(teamLogoUrl(name)).toBe(path);
    });
  }

  // La collision qui a fait tout le travail : « sportoto » CONTIENT « porto »
  // (FC Porto). Sans clé exacte, le scan `includes` de teamLogoUrl servait le
  // blason de FC Porto pour le club turc.
  test("« Spor Toto » ne récupère PAS le blason de FC Porto", () => {
    expect(teamLogoUrl("Spor Toto")).not.toBe("/logos/handball/teams/porto.png");
    expect(teamLogoUrl("Spor Toto")).toBe("/logos/handball/teams/spor-toto.png");
  });

  test("l'alias ne casse pas FC Porto ( handball portugais )", () => {
    expect(teamLogoUrl("FC Porto")).toBe("/logos/handball/teams/porto.png");
    expect(teamLogoUrl("Porto")).toBe("/logos/handball/teams/porto.png");
  });

  test("ligues TR/RO : pas de logo de ligue → repli drapeau", () => {
    expect(leagueLogo("Superlig")).toBeNull();
    expect(leagueCountry("Superlig")).toBe("TURKEY");
    expect(leagueLogo("Liga Nationala Women")).toBeNull();
    expect(leagueCountry("Liga Nationala Women")).toBe("ROMANIA");
  });
});
