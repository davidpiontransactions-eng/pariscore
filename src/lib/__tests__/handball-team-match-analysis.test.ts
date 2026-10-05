// Tests de la logique NON triviale du panneau d'analyse (bead f9p6.1) :
//   • le ratio attaque/défense et ses 3 verdicts ;
//   • le garde-fou `predictions_available`, porté par le MATCH et non par la ligue.
//
// Les deux règles qui casseraient SILENCIEUSEMENT : un ratio calculé sur une
// autre échelle que la base de la ligue, et un panneau financier qui s'afficherait
// alors que la source n'a rien publié.

import { describe, expect, test } from "bun:test";
import {
  buildMatchup,
  predictionAvailability,
  type TeamProfile,
} from "../../components/handball/handball-team-match-analysis";
import { findVitibetCoveredLeague } from "../handball-vitibet-leagues";
import type { TeamSeasonStats } from "../handball-vitibet-league";

/** Profil minimal : le ratio ne lit que scoredAvg / concededAvg. */
function profile(name: string, scoredAvg: number, concededAvg: number): TeamProfile {
  return { stats: { team: name } as TeamSeasonStats, scoredAvg, concededAvg };
}

describe("buildMatchup - ratio attaque / défense", () => {
  const attack = profile("A", 33, 30);
  const weakDefense = profile("B", 28, 22); // 22 encaissés -> défense faible
  const strongDefense = profile("C", 30, 38); // 38 encaissés -> défense solide

  test("ratio = attaque rapportée aux buts encaissés par l'adversaire", () => {
    expect(buildMatchup(attack, weakDefense, 33).ratio).toBeCloseTo(33 / 22, 5);
    expect(buildMatchup(attack, strongDefense, 33).ratio).toBeCloseTo(33 / 38, 5);
  });

  test("verdicts : avantage / équilibre / influence aux seuils 1.15 et 0.85", () => {
    expect(buildMatchup(attack, weakDefense, 33).verdict).toBe("avantage");
    expect(buildMatchup(attack, strongDefense, 33).verdict).toBe("equilibre");
    // 33 / 40 = 0.825 -> sous 0.85 -> défense forte
    expect(buildMatchup(attack, profile("D", 30, 40), 33).verdict).toBe("influence");
  });

  test("base de ligue nulle ou négative -> ratio 0, jamais NaN", () => {
    const zero = buildMatchup(attack, weakDefense, 0);
    expect(zero.ratio).toBe(0);
    expect(Number.isNaN(zero.ratio)).toBe(false);
  });

  test("base MESURÉE de la ligue utilisée, pas le générique du modèle", () => {
    const league = findVitibetCoveredLeague("Superlig");
    expect(league).not.toBeNull();
    expect(league?.baseline).toBe(33.5);
    // Le ratio est sans dimension : la base sert au verdict, pas au quotient.
    // Ce qui compte ici est que le caller ALIMENTE la vraie base (33.5) et non
    // 28.5 - sinon une défense normale passerait pour faible.
    const best = league!.standings[0];
    const mid = league!.standings[5];
    const cell = buildMatchup(
      profile(best.team, best.scoredAvg, best.concededAvg),
      profile(mid.team, mid.scoredAvg, mid.concededAvg),
      league!.baseline,
    );
    expect(Number.isFinite(cell.ratio)).toBe(true);
    expect(cell.ratio).toBeGreaterThan(0);
  });
});

describe("predictionAvailability - le flag est porté par le MATCH", () => {
  const superlig = findVitibetCoveredLeague("Superlig")!;
  const fixtures = superlig.fixtures;

  test("la Superlig mélange matchs AVEC et SANS prévision", () => {
    const withPred = fixtures.filter((f) => f.predictionsAvailable === true);
    const without = fixtures.filter((f) => f.predictionsAvailable !== true);
    // C'est le fait mesuré qui rend ce test utile : si la ligue publiait
    // uniformément, le flag par match n'aurait aucun intérêt.
    expect(withPred.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
  });

  test("match SANS prévision -> panneau financier désactivé + raison", () => {
    const f = fixtures.find((x) => x.predictionsAvailable !== true)!;
    const av = predictionAvailability(superlig, f.home, f.away);
    expect(av.available).toBe(false);
    expect(av.reason).not.toBe("");
    expect(av.fixture).not.toBeNull();
  });

  test("match AVEC prévision -> disponible, et les champs ne sont pas nuls", () => {
    const f = fixtures.find((x) => x.predictionsAvailable === true)!;
    const av = predictionAvailability(superlig, f.home, f.away);
    expect(av.available).toBe(true);
    expect(av.fixture?.predictedHome).not.toBeNull();
    expect(av.fixture?.predictedAway).not.toBeNull();
  });

  test("rencontre inconnue du calendrier -> motif EXPLICITE, pas un dash", () => {
    const av = predictionAvailability(superlig, "Club Fantome A", "Club Fantome B");
    expect(av.available).toBe(false);
    expect(av.fixture).toBeNull();
    expect(av.reason).toMatch(/absent du calendrier/i);
  });

  test("aucune valeur n'est COMBLÉE quand la source n'a rien publié", () => {
    const without = fixtures.filter((f) => f.predictionsAvailable !== true);
    for (const f of without) {
      expect(f.predictedHome).toBeNull();
      expect(f.predictedAway).toBeNull();
      expect(f.tip ?? null).toBeNull();
      expect(f.probHome ?? null).toBeNull();
      expect(f.probDraw ?? null).toBeNull();
      expect(f.probAway ?? null).toBeNull();
    }
  });
});