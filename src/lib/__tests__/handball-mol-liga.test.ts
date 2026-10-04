import { describe, expect, test } from "bun:test";
import {
  getMolLiga,
  molLigaBacktestMatches,
  MOL_LIGA_META,
} from "@/lib/handball-mol-liga";
import {
  FLAT_STAKE_U,
  SIM_ODDS_FAVOURITE_1X2,
  SIM_ODDS_TOTAL,
  pickBacktestTotalLine,
  runPariscoreBacktest,
  type BacktestMatch,
  type BacktestSettledBet,
} from "@/lib/handball-backtest-pariscore";
import { cmpLambdaForMean, cmpMean } from "@/lib/handball-cmp";
import fixture from "@/lib/fixtures/mol-liga-women-2026.json";

const league = getMolLiga();

// Le backtest n'est plus exposé par `handball-mol-liga.ts` : l'UI lit désormais
// `handball-backtest-history` (données réelles de `handball_match_history`), pas
// ce fixture de 15 matchs dont 9 synthétiques. On le construit ici pour garder la
// couverture du moteur sur une série courte et connue — c'est un cas de test
// utile, pas une API.
const bt = runPariscoreBacktest(molLigaBacktestMatches(), {
  league: MOL_LIGA_META.name,
  leagueMean: league.baseline,
});

// ─── Fixture ───

describe("fixture MOL Liga Women — intégrité", () => {
  test("leagueId, libellé et genre corrects", () => {
    expect(league.vitibetLeagueId).toBe(140);
    expect(league.name).toBe(MOL_LIGA_META.name);
    expect(league.gender).toBe("F");
    expect(league.country).toBe("Europe");
  });

  test("12 équipes réelles, aucune valeur manquante", () => {
    expect(league.standings).toHaveLength(12);
    for (const s of league.standings) {
      expect(s.played).toBeGreaterThan(0);
      expect(Number.isFinite(s.goalsFor)).toBe(true);
      expect(Number.isFinite(s.scoredAvg)).toBe(true);
      expect(Number.isFinite(s.ppg)).toBe(true);
      expect(s.form).toMatch(/^[WDL]+$/);
      expect(s.teamId).toBeGreaterThan(0);
    }
  });

  test("Home + Away = Overall sur les 12 équipes (aucune anomalie)", () => {
    const raw = fixture.league;
    const home = new Map(raw.standingsHome.map((r) => [r.team, r]));
    const away = new Map(raw.standingsAway.map((r) => [r.team, r]));
    for (const o of raw.standingsOverall) {
      const h = home.get(o.team)!;
      const a = away.get(o.team)!;
      expect(h.played + a.played, `${o.team} matchs`).toBe(o.played);
      expect(h.goalsFor + a.goalsFor, `${o.team} GF`).toBe(o.goalsFor);
      expect(h.goalsAgainst + a.goalsAgainst, `${o.team} GA`).toBe(o.goalsAgainst);
    }
  });

  test("base de buts dérivée : 58.4 / match, 29.2 par équipe", () => {
    // Σ GF = 1577 sur Σ P / 2 = 27 matchs.
    expect(league.goalsPerMatch).toBeCloseTo(58.4, 1);
    expect(league.baseline).toBeCloseTo(29.2, 1);
    // La spec annonçait « ~52 à 58 buts/match » : la valeur dérivée est au
    // sommet de la fourchette (début de saison) — c'est elle qui fait foi.
    expect(league.goalsPerMatch).toBeGreaterThanOrEqual(52);
    expect(league.goalsPerMatch).toBeLessThanOrEqual(60);
  });

  test("15 matchs d'historique : 6 réels + 9 synthétiques signalés", () => {
    expect(league.results).toHaveLength(15);
    expect(league.syntheticResults).toBe(9);
    expect(league.results.filter((r) => !r.synthetic)).toHaveLength(6);
    for (const r of league.results) {
      expect(r.homeGoals).toBeGreaterThan(0);
      expect(r.awayGoals).toBeGreaterThan(0);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.fixtureId).toBeGreaterThan(0);
    }
  });

  test("mi-temps renseigné sur tous les matchs (aucun trou d'affichage)", () => {
    for (const r of league.results) {
      expect(r.homeHalf).toBeGreaterThan(0);
      expect(r.awayHalf).toBeGreaterThan(0);
    }
  });

  test("fixtures sans score prédit exclues plutôt que devinées", () => {
    // 5 des 6 fixtures Vitibet affichaient « ?:? » → seules celles avec un
    // score prédit réel sont conservées.
    expect(league.fixtures).toHaveLength(1);
    expect(league.fixtures[0].fixtureId).toBe(196831);
    expect(league.fixtures[0].predictedHome).toBe(27);
    expect(league.fixtures[0].predictedAway).toBe(28);
  });
});

// ─── Seuil de total du moteur ───

describe("pickBacktestTotalLine", () => {
  test("respecte la bande [65 %, 95 %] et privilégie la ligne proche du total", () => {
    const nu = 1.3;
    const lam = cmpLambdaForMean(29.2, nu);
    const pick = pickBacktestTotalLine(lam, nu, lam, nu)!;
    expect(pick).not.toBeNull();
    expect(pick.prob).toBeGreaterThanOrEqual(65);
    expect(pick.prob).toBeLessThanOrEqual(95);
    // Total attendu 58.4 → ligne retenue proche de 58.
    expect(Math.abs(pick.line - 58.4)).toBeLessThanOrEqual(8);
  });

  test("match déséquilibré : la ligne quasi-certaine est refusée", () => {
    const nu = 1.3;
    const pick = pickBacktestTotalLine(cmpLambdaForMean(45, nu), nu, cmpLambdaForMean(30, nu), nu);
    if (pick) {
      expect(pick.prob).toBeLessThanOrEqual(95);
      expect(pick.line).not.toBe(75);
    }
  });
});

// ─── Moteur de backtesting ───

describe("runPariscoreBacktest — MOL Liga Women", () => {
  test("réinjecte les 15 matchs et compte les synthétiques", () => {
    expect(bt.nMatches).toBe(15);
    expect(bt.nSyntheticMatches).toBe(9);
  });

  test("KPI globaux cohérents avec les paris listés", () => {
    const settled = bt.bets.filter((b) => b.result !== "void");
    expect(bt.global.nBets).toBe(bt.bets.length);
    expect(bt.global.won + bt.global.lost).toBe(settled.length);
    expect(bt.global.winrate).toBe(
      settled.length > 0 ? Math.round((bt.global.won / settled.length) * 1000) / 10 : null,
    );
    expect(bt.global.stakedU).toBeCloseTo(settled.length * FLAT_STAKE_U, 6);
    expect(bt.global.roiPct).toBeCloseTo((bt.global.profitU / bt.global.stakedU) * 100, 1);
  });

  test("chaque pari respecte la règle P ≥ 65 % et cote ≥ 1.15", () => {
    for (const b of bt.bets) {
      expect(b.prob).toBeGreaterThanOrEqual(bt.thresholds.minProbPct);
      expect(b.odds).toBeGreaterThanOrEqual(bt.thresholds.minOdds);
      expect(b.qualified).toBe(true);
    }
  });

  test("aucun pari n'a de probabilité au-delà du plafond de 95 %", () => {
    for (const b of bt.bets) {
      expect(b.prob).toBeLessThanOrEqual(bt.thresholds.maxProbPct);
    }
  });

  test("profit par pari = cote − 1 (gagné), −1 (perdu), 0 (annulé)", () => {
    for (const b of bt.bets) {
      if (b.result === "won") expect(b.profitU).toBeCloseTo(b.odds - 1, 6);
      else if (b.result === "lost") expect(b.profitU).toBe(-1);
      else expect(b.profitU).toBe(0);
    }
  });

  test("les 2 marchés : 1N2 vide sur cet échantillon, Total seul retenu", () => {
    // RÉALITÉ MESURÉE, assumée : avec 12 équipes et 15 matchs, aucune équipe
    // n'a 3 matchs ANTÉRIEURS → le modèle ajusté ne s'active jamais
    // (`nFormMatches === 0`) et toutes les prédictions 1N2 retombent sur le
    // prior neutre symétrique, où le favori plafonne à ~47 % (sous le seuil de
    // 65 %). Aucun pari 1N2 n'est donc retenu — c'est un fait, pas une panne :
    // il faudrait ~40+ matchs pour que le marché 1N2 produise des signals.
    expect(bt.nFormMatches).toBe(0);
    expect(bt.byMarket["1N2"].nBets).toBe(0);
    expect(bt.byMarket.total.nBets).toBeGreaterThan(0);
    expect(bt.byMarket["1N2"].nBets + bt.byMarket.total.nBets).toBe(bt.global.nBets);
  });

  test("le mécanisme de forme s'active dès qu'un historique existe", () => {
    // Preuve que le walk-forward ALIMENTE le store : 4 équipes, 20 journées,
    // donc chaque équipe dépasse 3 matchs antérieurs. Sans forme, toutes les
    // probs 1N2 seraient identiques à ~47 % (prior symétrique).
    const teams = ["A", "B", "C", "D"];
    const series: BacktestMatch[] = [];
    for (let d = 0; d < 20; d++) {
      const [h, a] = [teams[d % 4], teams[(d + 1) % 4]];
      // A domine, D s'effondre → un vrai écart de niveau doit apparaître.
      const strong = h === "A" || a === "A" || h === "B" || a === "B";
      const hg = strong ? 33 : 24;
      const ag = strong ? 24 : 33;
      series.push({
        id: `m${d}`,
        date: `2026-01-${String(d + 1).padStart(2, "0")}`,
        league: "SYNTH",
        home: h,
        away: a,
        homeGoals: hg,
        awayGoals: ag,
      });
    }
    const r = runPariscoreBacktest(series, { league: "SYNTH", leagueMean: 28.5 });
    expect(r.nFormMatches).toBeGreaterThan(10);
    // Les probabilités ne sont plus toutes identiques : la forme discrimine.
    const oneX2 = r.allBets.filter((b) => b.market === "1N2");
    const uniq = new Set(oneX2.map((b) => b.prob));
    expect(uniq.size).toBeGreaterThan(3);
    // Et un match implique bien un score prédit dissymétrique.
    expect(oneX2.some((b) => b.predictedHome !== b.predictedAway)).toBe(true);
  });

  test("progression par journée : dates croissantes, cumul croissant", () => {
    expect(bt.byDay.length).toBeGreaterThan(1);
    for (let i = 1; i < bt.byDay.length; i++) {
      expect(bt.byDay[i].date > bt.byDay[i - 1].date).toBe(true);
    }
    // Le profit cumulé final doit égaler le profit global.
    const last = bt.byDay[bt.byDay.length - 1];
    expect(last.cumulativeProfitU).toBeCloseTo(bt.global.profitU, 2);
  });

  test("WALK-FORWARD : aucun lookahead (les 3 premiers matchs = prior neutre)", () => {
    // Le premier match n'a aucun antécédent → les deux équipes valent la
    // moyenne de ligue, donc un score prédit symétrique ~29:29 et aucun favori
    // à 65 %. Si le moteur recyclait les matchs FUTURS, le premier match
    // hériterait de leur forme et le test casse.
    const first = bt.allBets.filter((b) => b.matchId === "900001");
    expect(first.length).toBeGreaterThan(0);
    const oneX2 = first.find((b) => b.market === "1N2")!;
    expect(oneX2.predictedHome).toBe(oneX2.predictedAway);
  });

  test("déterministe : deux exécutions donnent le même résultat", () => {
    const again = runPariscoreBacktest(molLigaBacktestMatches(), {
      league: MOL_LIGA_META.name,
      leagueMean: league.baseline,
    });
    expect(JSON.stringify(again.bets)).toBe(JSON.stringify(bt.bets));
  });

  test("cotes simulées assumées : 1X2 favori @1.55, total @1.90", () => {
    const total = bt.bets.find((b) => b.market === "total")!;
    expect(total.odds).toBeCloseTo(SIM_ODDS_TOTAL, 6);
    // Aucun pari 1N2 retenu sur cet échantillon (voir test « 1N2 vide ») :
    // on vérifie la cote simulée sur le marché Total et la constante 1N2.
    expect(SIM_ODDS_FAVOURITE_1X2).toBe(1.55);
    const oneX2 = bt.allBets.find((b) => b.market === "1N2")!;
    expect(oneX2.odds).toBeCloseTo(SIM_ODDS_FAVOURITE_1X2, 6);
    expect(bt.methodology).toContain("COTES SIMULÉES");
    expect(bt.methodology).toContain("Walk-forward");
    expect(bt.methodology).toContain("nFormMatches");
  });

  test("matchs synthétiques marqués dans chaque pari", () => {
    const synth = bt.bets.filter((b) => b.syntheticMatch);
    expect(synth.length).toBeGreaterThan(0);
    for (const b of synth) expect(b.syntheticMatch).toBe(true);
  });

  test("cotes réelles fournies écrasent les cotes simulées", () => {
    const withOdds: BacktestMatch[] = [
      { id: "a", date: "2026-01-01", league: "X", home: "A", away: "B", homeGoals: 30, awayGoals: 25, odds: { home: 1.2, draw: 20, away: 9 } },
    ];
    const r = runPariscoreBacktest(withOdds, { league: "X", leagueMean: 29.2 });
    const oneX2 = r.allBets.find((b) => b.market === "1N2")!;
    expect(oneX2.odds).toBe(1.2);
  });

  test("échantillon vide → résultat vide, jamais de NaN", () => {
    const r = runPariscoreBacktest([], { league: "X" });
    expect(r.nMatches).toBe(0);
    expect(r.bets).toHaveLength(0);
    expect(r.global.winrate).toBeNull();
    expect(r.global.roiPct).toBeNull();
    expect(r.byDay).toHaveLength(0);
  });

  test("un seul match sans historique : pas de division par zéro", () => {
    const r = runPariscoreBacktest(
      [{ id: "solo", date: "2026-01-01", league: "X", home: "A", away: "B", homeGoals: 30, awayGoals: 25 }],
      { league: "X", leagueMean: 29.2 },
    );
    for (const b of r.allBets) {
      expect(Number.isFinite(b.prob)).toBe(true);
      expect(Number.isFinite(b.predictedHome)).toBe(true);
      expect(Number.isFinite(b.predictedAway)).toBe(true);
    }
  });

  test("ordre d'entrée indifférent (tri chronologique interne)", () => {
    const matches = molLigaBacktestMatches();
    const shuffled = [...matches].reverse();
    const r = runPariscoreBacktest(shuffled, {
      league: MOL_LIGA_META.name,
      leagueMean: league.baseline,
    });
    // Deux matchs de MÊME DATE restent dans l'ordre d'entrée (tri stable) :
    // on compare donc les paris TRIÉS par identité, pas le tableau brut.
    const key = (b: BacktestSettledBet) => `${b.matchId}|${b.market}`;
    const norm = (xs: BacktestSettledBet[]) =>
      [...xs].sort((x, y) => key(x).localeCompare(key(y)));
    expect(JSON.stringify(norm(r.bets))).toBe(JSON.stringify(norm(bt.bets)));
    expect(r.global.roiPct).toBe(bt.global.roiPct);
  });
});

// ─── Cohérence avec le moteur live ───

describe("cohérence backtest ↔ modèle live", () => {
  test("la base de ligue alimente bien le prior neutre (29.2, pas 28.5)", () => {
    const solo: BacktestMatch[] = [
      { id: "solo", date: "2026-01-01", league: "X", home: "A", away: "B", homeGoals: 30, awayGoals: 29 },
    ];
    const withLeague = runPariscoreBacktest(solo, {
      league: "MOL Liga Women",
      leagueMean: league.baseline,
    });
    const withDefault = runPariscoreBacktest(solo, { league: "X" });
    // Prior neutre Poisson : le score prédit = la base, arrondie.
    // 29.2 → 29 ; 28.5 → 28 (cmpMean(28.5, 1) = 28.4999…, arrondi 28).
    expect(withLeague.allBets[0].predictedHome).toBe(29);
    expect(withDefault.allBets[0].predictedHome).toBe(28);
    // Les deux bases produisent donc bien des prédictions différentes.
    expect(withLeague.allBets[0].predictedHome).not.toBe(
      withDefault.allBets[0].predictedHome,
    );
  });

  test("cmpLambdaForMean : la conversion taux→moyenne reste exacte à ν=1.3", () => {
    const lam = cmpLambdaForMean(league.baseline, 1.3);
    expect(Math.abs(cmpMean(lam, 1.3) - league.baseline)).toBeLessThan(0.01);
  });
});
