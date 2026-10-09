import { describe, expect, test } from "bun:test";
import type { BSDFootballMatch } from "@/lib/bsd-football-fetcher";
import { computeStrategyTop5Matches } from "@/lib/football-strategy-top5";

/**
 * Fixtures `league.id = -1` : BSD_ID_TO_SLUG[-1] est absent → matchForm
 * (soccerstats), betminesCornerMarket et matchXg (Understat) retournent null
 * sans I/O — les tests restent 100 % déterministes et hors réseau.
 */

type Team = { id: number; name: string; short_name: string };
const ALPHA: Team = { id: 1, name: "Alpha FC", short_name: "ALP" };
const BETA: Team = { id: 2, name: "Beta FC", short_name: "BET" };

function mkFinished(
  id: number,
  home: Team,
  away: Team,
  hs: number,
  as: number,
  corners = 8,
): BSDFootballMatch {
  return {
    id,
    league: { id: -1, name: "Ligue Test" },
    home_team: home.name,
    away_team: away.name,
    home_team_obj: home,
    away_team_obj: away,
    event_date: "2026-09-20T20:00:00Z",
    status: "finished",
    home_score: hs,
    away_score: as,
    live_stats: { home: { corner_kicks: corners }, away: { corner_kicks: corners } },
  } as unknown as BSDFootballMatch;
}

function mkFixture(
  id: number,
  home: Team,
  away: Team,
  over: Record<string, unknown> = {},
): BSDFootballMatch {
  return {
    id,
    league: { id: -1, name: "Ligue Test" },
    home_team: home.name,
    away_team: away.name,
    home_team_obj: home,
    away_team_obj: away,
    event_date: "2026-09-28T20:00:00Z",
    status: "notstarted",
    home_score: null,
    away_score: null,
    odds_home: 2,
    odds_draw: 3.4,
    odds_away: 3.8,
    odds_over_15: 1.28,
    odds_under_15: 3.5,
    odds_over_35: 3.0,
    odds_under_35: 1.36,
    odds_btts_yes: 1.72,
    odds_btts_no: 2.05,
    ...over,
  } as unknown as BSDFootballMatch;
}

/** Forme dominante : Alpha 3× 3-0 à domicile, Beta 3× 0-3 à l'extérieur. */
function strongForm(): BSDFootballMatch[] {
  return [
    mkFinished(101, ALPHA, BETA, 3, 0),
    mkFinished(102, ALPHA, BETA, 3, 0),
    mkFinished(103, ALPHA, BETA, 3, 0),
    mkFinished(104, BETA, ALPHA, 0, 3),
    mkFinished(105, BETA, ALPHA, 0, 3),
    mkFinished(106, BETA, ALPHA, 0, 3),
  ];
}

/** Forme fermée et symétrique (λ ≈ 0,33 des deux côtés) → nul modal Dixon-Coles. */
function closedForm(): BSDFootballMatch[] {
  return [
    mkFinished(201, ALPHA, BETA, 0, 0),
    mkFinished(202, ALPHA, BETA, 1, 1),
    mkFinished(203, ALPHA, BETA, 0, 0),
  ];
}

/** Forme équilibrée de niveau moyen (λ = 1,5 de chaque côté) → favori clair mais < 87 %. */
function evenForm(): BSDFootballMatch[] {
  return [
    mkFinished(301, ALPHA, BETA, 2, 1),
    mkFinished(302, ALPHA, BETA, 1, 2),
    mkFinished(303, BETA, ALPHA, 2, 1),
    mkFinished(304, BETA, ALPHA, 1, 2),
  ];
}

describe("computeStrategyTop5Matches — scoring de forme", () => {
  test("bestTeam : l'équipe la plus forte (PPG) est pickée", () => {
    const out = computeStrategyTop5Matches(strongForm(), [mkFixture(1, ALPHA, BETA)]);
    const list = out.strategies.bestTeam;
    expect(list.length).toBe(1);
    expect(list[0].pick).toBe("home");
    expect(list[0].value).toBe(3); // PPG 3.0 vs 0
    expect(list[0].source).toBe("form");
  });

  // bestTeam classe un PPG (0-3) ; un repli cotes y injecterait une probabilité
  // 0-100 toujours supérieure → la liste affichait le match le moins fiable en
  // tête. La variante cotes est bestTeam1x2.
  test("bestTeam : aucun repli cotes (échelle homogène PPG)", () => {
    const out = computeStrategyTop5Matches([], [mkFixture(1, ALPHA, BETA)]);
    expect(out.strategies.bestTeam.length).toBe(0);
    expect(out.strategies.bestTeam1x2.length).toBe(1);
  });

  // BSD n'expose qu'un échantillon d'historique : 1 seul match fini suffit.
  test("forme : repli any-context accepté dès 1 match (bas volume)", () => {
    const thin = [mkFinished(110, ALPHA, BETA, 2, 0)];
    const out = computeStrategyTop5Matches(thin, [mkFixture(31, ALPHA, BETA)]);
    expect(out.strategies.bestTeam.length).toBe(1);
    expect(out.strategies.bestTeam[0].source).toBe("form");
    expect(out.minPlayed).toBe(1);
  });

  test("bestDefense : le côté le plus étanche (λ encaissés) est pické", () => {
    const out = computeStrategyTop5Matches(strongForm(), [mkFixture(1, ALPHA, BETA)]);
    const d = out.strategies.bestDefense[0];
    // Alpha encaisse 0/match à domicile, Beta 3/match → pick home
    expect(d.pick).toBe("home");
    expect(d.value).toBeCloseTo(0, 5);
  });

  test("doubleChance1X/2X : côtés fixes home/away (valeur = taux de non-défaite %)", () => {
    // evenForm : 1V 1D de chaque côté → taux 50 % (sous le filtre 87 %)
    const out = computeStrategyTop5Matches(evenForm(), [mkFixture(1, ALPHA, BETA)]);
    expect(out.strategies.doubleChance1X[0].pick).toBe("home");
    expect(out.strategies.doubleChance2X[0].pick).toBe("away");
    expect(out.strategies.doubleChance1X[0].value).toBeCloseTo(50, 5);
    expect(out.strategies.doubleChance2X[0].value).toBeCloseTo(50, 5);
    // un taux de 100 % (forme parfaite) est filtré comme « cote plate »
    const sure = computeStrategyTop5Matches(strongForm(), [mkFixture(2, ALPHA, BETA)]);
    expect(sure.strategies.doubleChance1X.length).toBe(0);
  });

  test("over15 / under35 : valeurs issues du λ total de forme", () => {
    const out = computeStrategyTop5Matches(strongForm(), [mkFixture(1, ALPHA, BETA)]);
    // λ total = 3 → P(≥2 buts) ≈ 80 %
    const o15 = out.strategies.over15[0].value;
    expect(o15).toBeGreaterThan(70);
    expect(o15).toBeLessThan(87); // reste sous le filtre MAX_PROB_PCT
    const u35 = out.strategies.under35[0].value;
    expect(u35).toBeGreaterThan(55);
    expect(u35).toBeLessThan(75);
  });

  test("bttsYes : λ away nul → proba ~0", () => {
    const out = computeStrategyTop5Matches(strongForm(), [mkFixture(1, ALPHA, BETA)]);
    expect(out.strategies.bttsYes[0].value).toBeLessThan(5);
  });

  test("gagnant : favori clair → pické ; nul modal → exclu vers drawModal", () => {
    // λ 1,5/1,5 : P(victoire) ≈ 37 % > P(nul) ≈ 24 % → gagnant rempli, valeur < 87 %
    const fav = computeStrategyTop5Matches(evenForm(), [mkFixture(1, ALPHA, BETA)]);
    expect(fav.strategies.gagnant.length).toBe(1);
    expect(fav.strategies.gagnant[0].pick).toBe("home");
    expect(fav.drawModal.length).toBe(0);

    const closed = computeStrategyTop5Matches(closedForm(), [mkFixture(2, ALPHA, BETA)]);
    expect(closed.strategies.gagnant.length).toBe(0);
    expect(closed.drawModal.length).toBe(1);
    expect(closed.drawModal[0].drawModal).toBe(true);
  });
});

describe("computeStrategyTop5Matches — replis cotes et filtres", () => {
  test("bestTeam1x2 : toujours dérivé des cotes de-vig (source odds)", () => {
    const out = computeStrategyTop5Matches([], [mkFixture(1, ALPHA, BETA)]);
    const e = out.strategies.bestTeam1x2[0];
    expect(e.source).toBe("odds");
    expect(e.pick).toBe("home");
    // de-vig 2 / 3.4 / 3.8 → favori ≈ 47 %
    expect(e.value).toBeGreaterThan(45);
    expect(e.value).toBeLessThan(50);
  });

  test("over15 sans forme : valeur = proba juste dé-vigée des cotes O/U", () => {
    const out = computeStrategyTop5Matches([], [mkFixture(1, ALPHA, BETA)]);
    const e = out.strategies.over15[0];
    expect(e.source).toBe("odds");
    // 1.28 / 3.5 → P(over) ≈ 73 %
    expect(e.value).toBeGreaterThan(70);
    expect(e.value).toBeLessThan(76);
  });

  test("filtre MAX_PROB : valeur ≥ 87 % exclue (cote plate plancher)", () => {
    const longshot = mkFixture(3, ALPHA, BETA, {
      odds_home: 1.05,
      odds_draw: 12,
      odds_away: 25,
    });
    const out = computeStrategyTop5Matches([], [longshot]);
    expect(out.strategies.bestTeam1x2.length).toBe(0);
  });

  test("seuls les fixtures notstarted sont classés", () => {
    const played = mkFixture(4, ALPHA, BETA, { status: "finished" });
    const out = computeStrategyTop5Matches([], [played]);
    for (const key of Object.keys(out.strategies)) {
      expect(out.strategies[key as keyof typeof out.strategies].length).toBe(0);
    }
  });

  test("limit : top N par stratégie respecté", () => {
    const fixtures = Array.from({ length: 6 }, (_, i) => mkFixture(10 + i, ALPHA, BETA));
    const out = computeStrategyTop5Matches(strongForm(), fixtures, { limit: 2 });
    expect(out.strategies.bestTeam.length).toBe(2);
  });

  test("filtre league : fixtures hors championnat ignorés", () => {
    const other = mkFixture(5, ALPHA, BETA, { league: { id: -1, name: "Autre Ligue" } as never });
    const out = computeStrategyTop5Matches(strongForm(), [other], { league: "Ligue Test" });
    expect(out.strategies.bestTeam.length).toBe(0);
  });

  // Régression « Aucun match qualifié pour cette stratégie » : le top-N était
  // classé sur TOUS les upcoming puis filtré côté client → liste vide.
  test("fenêtre temporelle : le top N est classé DANS la fenêtre", () => {
    const now = Date.now();
    const soon = mkFixture(20, ALPHA, BETA, {
      event_date: new Date(now + 2 * 3_600_000).toISOString(),
    });
    const later = mkFixture(21, ALPHA, BETA, {
      event_date: new Date(now + 5 * 86_400_000).toISOString(),
    });
    const out = computeStrategyTop5Matches(strongForm(), [soon, later], { limit: 5, window: "48h" });
    expect(out.strategies.bestTeam.map((e) => e.matchId)).toEqual(["20"]);

    const wide = computeStrategyTop5Matches(strongForm(), [soon, later], { limit: 5, window: "semaine" });
    expect(wide.strategies.bestTeam.length).toBe(2);
  });
});

describe("computeStrategyTop5Matches — entrées enrichies", () => {
  test("cotes DNB dérivées de 1X2 et odds du fixture attachées", () => {
    const out = computeStrategyTop5Matches([], [mkFixture(1, ALPHA, BETA)]);
    const e = out.strategies.over15[0];
    expect(e.matchId).toBe("1");
    expect(e.odds?.over15).toBe(1.28);
    // dnbHome = 1 / (1/2 − 1/3.4) ≈ 4.85
    expect(e.odds?.dnbHome).toBeCloseTo(4.85, 1);
    expect(e.odds?.dnbAway).toBeNull(); // 1/(1/3.8 − 1/3.4) < 1 → rejeté
    expect(e.home.teamName).toBe("Alpha FC");
    expect(e.away.teamName).toBe("Beta FC");
    expect(e.kickoff).toBe("2026-09-28T20:00:00Z");
  });
});
