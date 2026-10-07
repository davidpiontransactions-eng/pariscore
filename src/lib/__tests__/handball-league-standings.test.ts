// Tests de la logique NON triviale du sous-onglet « Classement & Stats »
// (mission structuration handball par sous-onglets).
//
// L'integrite tient sur deux points, chacun teste ici :
//   1. le classement D/E vient des TABLEAUX Vitibet Home/Away, jamais d'une
//      reconstruction ni du total — une equipe sans match sur le cote affiche
//      null (« — ») et non 0.0 ;
//   2. le TRI est deterministe : PPG, puis difference de buts, puis buts
//      marques, puis nom — deux equipes a egalite ne permutent pas selon
//      l'ordre d'arrivee du payload.

import { describe, expect, test } from "bun:test";
import { buildSplitTable } from "../../components/handball/handball-league-standings";
import type { SplitStats, TeamSeasonStats } from "../handball-vitibet-league";

function split(p: Partial<SplitStats>): SplitStats {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    ...p,
  };
}

function team(
  name: string,
  home: Partial<SplitStats>,
  away: Partial<SplitStats>,
): TeamSeasonStats {
  const h = split(home);
  const a = split(away);
  const played = Math.max(h.played, a.played, 1);
  return {
    rank: 0,
    team: name,
    teamId: 1000 + name.length,
    played,
    wins: h.wins + a.wins,
    draws: h.draws + a.draws,
    losses: h.losses + a.losses,
    goalsFor: h.goalsFor + a.goalsFor,
    goalsAgainst: h.goalsAgainst + a.goalsAgainst,
    points: 0,
    home: h,
    away: a,
    scoredAvg: 25,
    concededAvg: 25,
    ppg: 1.5,
    form: "WWD",
  };
}

// ─── 1. Source = le tableau du côté, pas le total ───

describe("buildSplitTable — source et absences", () => {
  test("lit les splits home/away, pas le total", () => {
    const rows = buildSplitTable(
      [
        team("Alpha", { played: 4, wins: 3, draws: 1, goalsFor: 110, goalsAgainst: 90 }, { played: 4, wins: 0, draws: 0, losses: 4, goalsFor: 80, goalsAgainst: 120 }),
        team("Beta", { played: 4, wins: 0, draws: 0, losses: 4, goalsFor: 80, goalsAgainst: 120 }, { played: 4, wins: 3, draws: 1, goalsFor: 110, goalsAgainst: 90 }),
      ],
      "home",
    );
    expect(rows.map((r) => r.team)).toEqual(["Alpha", "Beta"]);
    expect(rows[0].ppg).toBe(1.8); // (3*2 + 1) / 4
    expect(rows[0].diff).toBe(20);
    expect(rows[0].scoredPerGame).toBe(27.5);
    // Le cote extérieur de Beta est le MEILLEUR : le tableau « domicile » ne doit
    // pas le remonter, sinon la colonne n'affiche plus le domicile.
    expect(rows[1].ppg).toBe(0);
  });

  test("equipe absente du tableau de cote : moyennes null, pas 0.0", () => {
    const rows = buildSplitTable([team("Gamma", {}, {})], "home");
    expect(rows[0].played).toBe(0);
    expect(rows[0].scoredPerGame).toBeNull();
    expect(rows[0].concededPerGame).toBeNull();
    expect(rows[0].ppg).toBe(0);
  });

  test("l'equipe sans match tombe en queue, jamais en tete", () => {
    const rows = buildSplitTable(
      [
        team("SansMatch", {}, {}),
        team("AvecMatch", { played: 2, wins: 1, draws: 1, goalsFor: 50, goalsAgainst: 48 }, {}),
      ],
      "away",
    );
    expect(rows.map((r) => r.team)).toEqual(["AvecMatch", "SansMatch"]);
  });
});

// ─── 2. Tri déterministe ───

describe("buildSplitTable — tri", () => {
  test("PPG décroissante d'abord", () => {
    const rows = buildSplitTable(
      [
        team("Bas", { played: 4, wins: 1, draws: 0, goalsFor: 40, goalsAgainst: 90 }, {}),
        team("Haut", { played: 4, wins: 4, draws: 0, goalsFor: 120, goalsAgainst: 100 }, {}),
        team("Milieu", { played: 4, wins: 2, draws: 2, goalsFor: 90, goalsAgainst: 90 }, {}),
      ],
      "home",
    );
    expect(rows.map((r) => r.team)).toEqual(["Haut", "Milieu", "Bas"]);
  });

  test("egalite de PPG : difference de buts puis buts marques", () => {
    const rows = buildSplitTable(
      [
        // Meme PPG (2 pts / 2 matchs), diff egal, mais moins de buts marques.
        team("Petit", { played: 2, wins: 1, goalsFor: 50, goalsAgainst: 40 }, {}),
        team("Grand", { played: 2, wins: 1, goalsFor: 60, goalsAgainst: 50 }, {}),
        // Meme PPG, meilleure difference de buts.
        team("Diff", { played: 2, wins: 1, goalsFor: 52, goalsAgainst: 30 }, {}),
      ],
      "home",
    );
    expect(rows.map((r) => r.team)).toEqual(["Diff", "Grand", "Petit"]);
  });

  test("egalite totale : tri par nom, donc ordre independant du payload", () => {
    const build = (names: string[]) =>
      buildSplitTable(
        names.map((n) => team(n, { played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 50, goalsAgainst: 50 }, {})),
        "home",
      ).map((r) => r.team);

    const expected = ["Aaa", "Bbb", "Ccc"];
    expect(build(["Ccc", "Aaa", "Bbb"])).toEqual(expected);
    expect(build(["Bbb", "Ccc", "Aaa"])).toEqual(expected);
  });
});