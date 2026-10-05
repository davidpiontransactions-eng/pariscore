import { describe, expect, test } from "bun:test";
import { CMP_NEUTRAL_LAMBDA } from "../handball-cmp";
import {
  getSuperligLeagues,
  findSuperligLeague,
  superligLeagueBaseline,
  superligMeasuredBaseline,
  superligPredictionCoverage,
  SUPERLIG_LEAGUE_META,
} from "../handball-superlig";
import {
  getLigaNaWomenLeagues,
  findLigaNaWomenLeague,
  ligaNaWomenLeagueBaseline,
  ligaNaWomenMeasuredBaseline,
  ligaNaWomenPredictionsPublished,
  ligaNaWomenPredictionCoverage,
  LIGA_NA_WOMEN_LEAGUE_META,
} from "../handball-liga-nationala-women";

// Ces deux modules ne doivent JAMAIS retomber sur CMP_NEUTRAL_LAMBDA : leurs
// bases viennent de classements reels scrapes. C'est le test qui aurait attrape
// le repli silencieux qu'on a refuse de livrer.

describe("Superlig (Turquie, league_id 120)", () => {
  const l = getSuperligLeagues()[0];

  test("une ligue exposee, meta coherente", () => {
    expect(getSuperligLeagues()).toHaveLength(1);
    expect(l.vitibetLeagueId).toBe(120);
    expect(l.country).toBe("Turkey");
    expect(l.gender).toBe("M");
    expect(SUPERLIG_LEAGUE_META.superlig.url).toContain("/turkey/120/");
  });

  test("classement REEL : 10 equipes, pas une liste vide", () => {
    expect(l.standings.length).toBe(10);
    // Besiktas en tete au moment du scrape (6 joues, 11 pts).
    expect(l.standings[0].team).toBe("Besiktas");
    expect(l.standings[0].played).toBeGreaterThan(0);
    // Lignes coherentes : le Team Power s'appuie dessus.
    for (const s of l.standings) {
      expect(s.wins + s.draws + s.losses).toBe(s.played);
      expect(s.points).toBe(s.wins * 2 + s.draws);
      expect(s.teamId).toBeGreaterThan(0);
    }
  });

  test("splits domicile/exterior REALS (pas de repli sur l'Overall)", () => {
    // Le bug mesure : les 3 tableaux renvoyaient le meme, donc Home = Away =
    // Overall et le Team Power par lieu etait double.
    const withHome = l.standings.filter((s) => s.home.played > 0);
    expect(withHome.length).toBeGreaterThan(0);
    for (const s of withHome) {
      expect(s.home.played + s.away.played).toBe(s.played);
      expect(s.home.played).toBeLessThan(s.played);
    }
  });

  test("forme native sur 6 matchs, coherente avec le classement", () => {
    const withForm = l.standings.filter((s) => s.form.length > 0);
    expect(withForm.length).toBe(10);
    for (const s of withForm) expect(s.form.length).toBeLessThanOrEqual(6);
    // Besiktas : 5 V + 1 N sur 6 joues au moment du scrape.
    const besiktas = l.standings.find((s) => s.team === "Besiktas");
    expect(besiktas?.form).toBe("WWDWWW");
    const w = besiktas!.form.split("").filter((c) => c === "W").length;
    const d = besiktas!.form.split("").filter((c) => c === "D").length;
    expect(w).toBeGreaterThanOrEqual(besiktas!.wins);
    expect(d).toBeGreaterThanOrEqual(besiktas!.draws);
  });

  test("BASE MESUREE, pas CMP_NEUTRAL_LAMBDA", () => {
    // 33.5 mesure ; le generique 28.5 serait faux de 17 %.
    expect(superligMeasuredBaseline()).toBeCloseTo(33.5, 1);
    expect(l.baseline).not.toBeCloseTo(CMP_NEUTRAL_LAMBDA, 1);
    expect(superligLeagueBaseline("Superlig")).toBeCloseTo(33.5, 1);
    expect(superligLeagueBaseline("Turkey: Superlig")).toBeCloseTo(33.5, 1);
  });

  test("19 matchs collectes, predictions partielles", () => {
    const c = superligPredictionCoverage();
    expect(c.total).toBe(19);
    // 10 predictions sur 19 : les 9 autres sont des matchs termines.
    expect(c.withPrediction).toBe(10);
    expect(c.withoutPrediction).toBe(9);
  });

  test("un match sans prediction a bien ses champs a null", () => {
    const f = l.fixtures.find((x) => x.predictionsAvailable === false);
    expect(f).toBeDefined();
    expect(f!.predictedHome).toBeNull();
    expect(f!.predictedAway).toBeNull();
    expect(f!.tip ?? null).toBeNull();
    // ...mais son score REEL reste disponible si le match est joue.
    if (f!.hasFinalScore) expect(f!.finalHome).not.toBeNull();
  });

  test("lookup par nom", () => {
    expect(findSuperligLeague("Superlig")).not.toBeNull();
    expect(findSuperligLeague("Liga Inconnue")).toBeNull();
  });
});

describe("Liga Nationala Women (Roumanie, league_id 88)", () => {
  const l = getLigaNaWomenLeagues()[0];

  test("une ligue exposee, meta coherente", () => {
    expect(getLigaNaWomenLeagues()).toHaveLength(1);
    expect(l.vitibetLeagueId).toBe(88);
    expect(l.country).toBe("Romania");
    expect(l.gender).toBe("F");
    expect(LIGA_NA_WOMEN_LEAGUE_META.ligaNationalaWomen.url).toContain("/romania/88/");
  });

  test("classement REEL : 14 equipes", () => {
    expect(l.standings.length).toBe(14);
    expect(l.standings[0].team).toBe("CSM Bucuresti W");
    for (const s of l.standings) {
      expect(s.wins + s.draws + s.losses).toBe(s.played);
      expect(s.teamId).toBeGreaterThan(0);
    }
  });

  test("splits domicile/exterior reels", () => {
    const withHome = l.standings.filter((s) => s.home.played > 0);
    expect(withHome.length).toBeGreaterThan(0);
    for (const s of withHome) {
      expect(s.home.played + s.away.played).toBe(s.played);
    }
  });

  test("BASE MESUREE 28.1, distincte du generique 28.5", () => {
    // Proche du generique, mais PAS egal : un repli serait faux de 1.4 %.
    expect(ligaNaWomenMeasuredBaseline()).toBeCloseTo(28.1, 1);
    expect(l.baseline).not.toBeCloseTo(CMP_NEUTRAL_LAMBDA, 2);
    expect(ligaNaWomenLeagueBaseline("Liga Nationala Women")).toBeCloseTo(28.1, 1);
  });

  test("AUCUNE prediction Vitibet — assume, pas comble", () => {
    // Fait MESURE : 16 matchs, 0 prediction. Ni le module ni le fixture ne
    // doivent laisser croire qu'un modele existe.
    const c = ligaNaWomenPredictionCoverage();
    expect(c.total).toBe(16);
    expect(c.withPrediction).toBe(0);
    expect(ligaNaWomenPredictionsPublished()).toBe(false);
    for (const f of l.fixtures) {
      expect(f.predictionsAvailable).toBe(false);
      expect(f.predictedHome).toBeNull();
      expect(f.predictedAway).toBeNull();
      expect(f.tip ?? null).toBeNull();
      expect(f.probHome ?? null).toBeNull();
    }
  });

  test("le calendrier reste exploitable malgre l'absence de prediction", () => {
    // C'est la raison d'etre du module sur cette ligue : dates, equipes, scores
    // reels restent lais.
    expect(l.fixtures.length).toBe(16);
    for (const f of l.fixtures) {
      expect(f.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f.home.length).toBeGreaterThan(1);
      expect(f.away.length).toBeGreaterThan(1);
    }
    const termines = l.fixtures.filter((f) => f.hasFinalScore);
    expect(termines.length).toBeGreaterThan(0);
    for (const f of termines) {
      expect(f.finalHome).not.toBeNull();
      expect(f.finalAway).not.toBeNull();
    }
  });

  test("lookup par nom", () => {
    expect(findLigaNaWomenLeague("Liga Nationala Women")).not.toBeNull();
    expect(findLigaNaWomenLeague("Superlig")).toBeNull();
  });
});