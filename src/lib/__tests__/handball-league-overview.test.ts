// Tests de la logique NON triviale de la synthese de championnat (bead f9p6.2).
//
// L'integrite tient sur trois points, chacun teste ici :
//   1. les matchs SYNTHETIQUES ne sont jamais fusionnes dans un agregat, et
//      sont comptes pour que leur exclusion soit visible ;
//   2. le Team Power vient de `computePower` (formule du modele live), donc une
//      equipe moyenne vaut 50 et une equipe sans profil vaut null, pas 50 ;
//   3. le pont Vitibet -> registre est resolu, ou null en toute franchise.

import { describe, expect, test } from "bun:test";
import {
  buildOutcomeSplit,
  buildPowerRanking,
  buildTotalLineStats,
} from "../../components/handball/handball-league-overview";
import { vitibetLeagueRegistryId } from "../handball-vitibet-leagues";
import type { CoveredLeague, VitibetResultRow } from "../handball-vitibet-league";
import type {
  BacktestSettledBet,
  BacktestMarket,
} from "../handball-backtest-pariscore";

function result(
  home: string,
  away: string,
  homeGoals: number,
  awayGoals: number,
  synthetic = false,
): VitibetResultRow {
  return {
    fixtureId: 1,
    date: "2026-10-01",
    time: "18:00",
    home,
    away,
    homeGoals,
    awayGoals,
    homeHalf: null,
    awayHalf: null,
    synthetic,
  };
}

function standing(team: string, played: number, scoredAvg: number, concededAvg: number) {
  return {
    rank: 0,
    team,
    teamId: 1000 + team.length,
    played,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: Math.round(scoredAvg * played),
    goalsAgainst: Math.round(concededAvg * played),
    points: 0,
    home: { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
    away: { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
    scoredAvg,
    concededAvg,
    ppg: 0,
    form: "WWWWW",
  };
}

function leagueOf(results: VitibetResultRow[], baseline = 30): CoveredLeague {
  const teams = [...new Set(results.flatMap((r) => [r.home, r.away]))];
  return {
    vitibetLeagueId: 999,
    name: "Test Ligue",
    url: "https://example.invalid",
    country: "Testland",
    gender: "M",
    level: 1,
    baseline,
    goalsPerMatch: baseline * 2,
    standings: teams.map((t, i) => standing(t, 4, 30 + i, 30 - i)),
    fixtures: [],
    results,
    syntheticResults: results.filter((r) => r.synthetic === true).length,
  };
}

function bet(
  pick: string,
  resultKind: BacktestSettledBet["result"],
  profitU: number,
  market: BacktestMarket = "total",
): BacktestSettledBet {
  return {
    matchId: "m1",
    date: "2026-10-01",
    league: "Test: Ligue",
    home: "A",
    away: "B",
    market,
    pick,
    side: null,
    odds: 1.9,
    prob: 60,
    predictedHome: 30,
    predictedAway: 27,
    result: resultKind,
    profitU,
    qualified: true,
    syntheticMatch: false,
  };
}

describe("buildOutcomeSplit - les matchs SYNTHETIQUES sont exclus et comptes", () => {
  const league = leagueOf([
    result("A", "B", 30, 25), // victoire domicile
    result("A", "B", 27, 30), // victoire exterieur
    result("A", "B", 28, 28), // nul
    result("A", "B", 99, 99, true), // SYNTHETIQUE : doit disparaitre
  ]);

  test("les 3 matchs reels sont comptes, le synthetique non", () => {
    const s = buildOutcomeSplit(league);
    expect(s.n).toBe(3);
    expect(s.nSyntheticExcluded).toBe(1);
  });

  test("repartition domicile / nul / exterieur", () => {
    const s = buildOutcomeSplit(league);
    expect(s.homeWins).toBe(1);
    expect(s.draws).toBe(1);
    expect(s.awayWins).toBe(1);
  });

  test("ecart de buts par match = (dom - ext) / matchs REELS", () => {
    const s = buildOutcomeSplit(league);
    // 30+27+28 = 85 domicile ; 25+30+28 = 83 exterieur ; ecart 2 sur 3 matchs.
    expect(s.homeGoals).toBe(85);
    expect(s.awayGoals).toBe(83);
    expect(s.goalsHomeMinusAwayPerMatch).toBeCloseTo(2 / 3, 6);
  });

  test("le 99:99 synthetique ne pourrit pas l'ecart : il n'est pas compte", () => {
    const avec = buildOutcomeSplit(leagueOf([result("A", "B", 10, 10), result("A", "B", 1, 1, true)]));
    const sans = buildOutcomeSplit(leagueOf([result("A", "B", 10, 10)]));
    expect(avec.goalsHomeMinusAwayPerMatch).toBe(sans.goalsHomeMinusAwayPerMatch);
  });

  test("aucun match reel -> ecart null, jamais 0 invente", () => {
    const s = buildOutcomeSplit(leagueOf([result("A", "B", 5, 5, true)]));
    expect(s.n).toBe(0);
    expect(s.goalsHomeMinusAwayPerMatch).toBeNull();
  });

  test("ligue sans aucun resultat : tous compteurs a zero", () => {
    const s = buildOutcomeSplit(leagueOf([]));
    expect(s.n).toBe(0);
    expect(s.nSyntheticExcluded).toBe(0);
    expect(s.homeWins + s.draws + s.awayWins).toBe(0);
  });
});

describe("buildPowerRanking - meme formule que le modele live", () => {
  test("une equipe au niveau moyen de la ligue vaut 50", () => {
    // 30 marque / 30 encaisse avec une base de 30 : neutre exact.
    const league = leagueOf([result("Moyenne", "Moyenne", 30, 30)], 30);
    const rows = buildPowerRanking(league);
    expect(rows.find((r) => r.team === "Moyenne")?.power).toBe(50);
  });

  test("une equipe qui marque plus et encaisse moins vaut AU-DESSUS de 50", () => {
    const league = leagueOf([result("Fort", "Faible", 38, 22)], 30);
    const fort = buildPowerRanking(league).find((r) => r.team === "Fort");
    expect(fort?.power).not.toBeNull();
    expect(fort?.power ?? 0).toBeGreaterThan(50);
  });

  test("equipe sans match joue -> power null, PAS 50", () => {
    // `standings` contient une equipe absente de `results` : elle n'a aucun profil.
    const league = leagueOf([result("Joue", "Joue", 30, 30)], 30);
    league.standings.push(standing("Fantome", 4, 30, 30));
    const rows = buildPowerRanking(league);
    const fantome = rows.find((r) => r.team === "Fantome");
    expect(fantome?.power).toBeNull();
  });

  test("tri decroissant, les valeurs null en DERNIER", () => {
    const league = leagueOf([result("A", "B", 38, 22), result("B", "A", 22, 38)], 30);
    league.standings.push(standing("Fantome", 4, 30, 30));
    const rows = buildPowerRanking(league);
    const values = rows.map((r) => r.power);
    const nulls = values.filter((v) => v === null);
    expect(values.indexOf(null)).toBe(values.length - 1);
    expect(nulls.length).toBe(1);
    for (let i = 1; i < rows.length - nulls.length; i++) {
      expect(values[i - 1] ?? 0).toBeGreaterThanOrEqual(values[i] ?? 0);
    }
  });

  test("une seule ligne par equipe (les deux faces d'un match ne creent pas de doublon)", () => {
    const league = leagueOf([result("A", "B", 30, 25), result("B", "A", 25, 30)], 30);
    const rows = buildPowerRanking(league);
    expect(rows.filter((r) => r.team === "A")).toHaveLength(1);
    expect(rows.filter((r) => r.team === "B")).toHaveLength(1);
  });
});

describe("buildTotalLineStats - rentabilite par ligne", () => {
  const bets = [
    bet("Over 53.5", "won", 0.9),
    bet("Over 53.5", "lost", -1),
    bet("Over 53.5", "void", 0),
    bet("Under 61.5", "won", 0.8),
    bet("Under 61.5", "won", 0.8),
    bet("Favori", "won", 0.95, "1N2"),
  ];

  test("regroupe par ligne, trie par volume decroissant", () => {
    const rows = buildTotalLineStats(bets);
    expect(rows[0]?.line).toBe("Over 53.5");
    expect(rows[0]?.n).toBe(3);
    expect(rows[1]?.line).toBe("Under 61.5");
  });

  test("le marche 1N2 est exclu : ce tableau est celui des TOTAUX", () => {
    expect(buildTotalLineStats(bets).some((r) => r.line === "Favori")).toBe(false);
  });

  test("un pari annule reste dans le volume mais sort du taux de reussite", () => {
    const over = buildTotalLineStats(bets).find((r) => r.line === "Over 53.5")!;
    expect(over.n).toBe(3); // 3 paris emis
    // 1 gagne / 2 regles (won + lost) = 50 %, le void n'est pas un rate.
    expect(over.winrate).toBe(50);
  });

  test("profit net cumule par ligne", () => {
    const over = buildTotalLineStats(bets).find((r) => r.line === "Over 53.5")!;
    expect(over.profitU).toBeCloseTo(-0.1, 6);
  });

  test("taux null quand aucun pari n a ete regle", () => {
    const rows = buildTotalLineStats([bet("Over 70.5", "void", 0)]);
    expect(rows[0]?.winrate).toBeNull();
  });

  test("respecte la limite de lignes", () => {
    const many = Array.from({ length: 12 }, (_, i) => bet(`Over ${50 + i}.5`, "won", 1));
    expect(buildTotalLineStats(many, 3)).toHaveLength(3);
  });

  test("aucun pari -> tableau vide, pas de ligne fantome", () => {
    expect(buildTotalLineStats([])).toEqual([]);
  });
});

describe("vitibetLeagueRegistryId - le pont vers handball_match_history", () => {
  test("Superlig (Turquie) -> superlig", () => {
    expect(vitibetLeagueRegistryId("Superlig")).toBe("superlig");
  });

  test("Liga Nationala Women (Roumanie) -> ligaNationalaWomen", () => {
    expect(vitibetLeagueRegistryId("Liga Nationala Women")).toBe("ligaNationalaWomen");
  });

  test("tolere le prefixe pays et les alias du registre", () => {
    expect(vitibetLeagueRegistryId("Turkey: Superlig")).toBe("superlig");
    expect(vitibetLeagueRegistryId("Süper Lig")).toBe("superlig");
  });

  test("ligue hors registre -> null (aucun backtest a afficher)", () => {
    expect(vitibetLeagueRegistryId("Liga Fantome")).toBeNull();
    expect(vitibetLeagueRegistryId("")).toBeNull();
  });
});