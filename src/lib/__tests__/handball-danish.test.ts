import { describe, expect, test } from "bun:test";
import {
  DANISH_LEAGUE_IDS,
  danishLeagueBaseline,
  deriveLeagueBaseline,
  findDanishLeague,
  findFixture,
  findTeamStats,
  getDanishLeagues,
  parseVitibetForm,
  parseVitibetScore,
  resolveLeagueMean,
  toPariscoreTeamStats,
  type VitibetStandingRow,
} from "@/lib/handball-danish";
import {
  HOME_ADVANTAGE_INDEX,
  computeFormPctWeighted,
  computePariscoreIndex,
  computePower,
} from "@/lib/handball-pariscore";
import { CMP_NEUTRAL_LAMBDA } from "@/lib/handball-cmp";
import fixture from "@/lib/fixtures/danish-handball-2026.json";

const leagues = getDanishLeagues();
const herre = leagues.find((l) => l.vitibetLeagueId === DANISH_LEAGUE_IDS.herreHandboldLigaen)!;
const bambusa = leagues.find((l) => l.vitibetLeagueId === DANISH_LEAGUE_IDS.bambusaKvindeligaen)!;
const d2 = leagues.find((l) => l.vitibetLeagueId === DANISH_LEAGUE_IDS.firstDivisionWomen)!;

// ─── Intégrité de la fixture (données réelles) ───

/**
 * Anomalie VÉRIFIÉE de la source Vitibet (page leagueId 25, scrape 2026-10-04).
 *
 * Le match Ikast Handbold W – Sonderjyske W était EN COURS (statut « 2H ») au
 * moment du scrape. Pour ces 2 équipes, les 3 tableaux Vitibet ne.totalisent
 * pas : Overall annonce 4 matchs / 122:103 et 4 matchs / 123:113, alors que
 * Home + Away donnent 5 matchs / 157:123 et 5 matchs / 143:148. C'est la page
 * elle-même qui est mise à jour partiellement pendant un match live — ce n'est
 * pas une erreur de scraping (les 2 tableaux Form et Home/Away concordent entre
 * eux sur le total, seul Overall diverge).
 *
 * Le test les EXCLUT de la somme, mais vérifie qu'il n'y en a pas d'autres :
 * une nouvelle anomalie au prochain scrape fait échouer le test.
 */
const KNOWN_INCONSISTENT = new Set(["Ikast Handbold W", "Sonderjyske W"]);

describe("fixture danoise — intégrité des données Vitibet", () => {
  test("3 ligues chargées, avec les 3 leagueId demandés", () => {
    expect(leagues).toHaveLength(3);
    expect(leagues.map((l) => l.vitibetLeagueId).sort()).toEqual([16, 23, 25]);
    for (const l of leagues) {
      expect(l.standings.length).toBeGreaterThanOrEqual(12);
      expect(l.fixtures.length).toBeGreaterThan(0);
      expect(l.baseline).toBeGreaterThan(20);
      expect(l.baseline).toBeLessThan(40);
    }
  });

  test("Home + Away = Overall sur les 38 équipes cohérentes", () => {
    // Contrôle le plus fort du jeu : si le scrape avait mélangé les 6
    // tableaux, ce test casse immédiatement.
    const raw = fixture.leagues as Array<{
      key: string;
      standingsOverall: VitibetStandingRow[];
      standingsHome: VitibetStandingRow[];
      standingsAway: VitibetStandingRow[];
    }>;
    let checked = 0;
    const anomalies: string[] = [];
    for (const l of raw) {
      const home = new Map(l.standingsHome.map((r) => [r.team, r]));
      const away = new Map(l.standingsAway.map((r) => [r.team, r]));
      for (const o of l.standingsOverall) {
        const h = home.get(o.team);
        const a = away.get(o.team);
        expect(h, `${l.key}/${o.team}: pas de ligne Home`).toBeDefined();
        expect(a, `${l.key}/${o.team}: pas de ligne Away`).toBeDefined();
        const coherent =
          h!.played + a!.played === o.played &&
          h!.goalsFor + a!.goalsFor === o.goalsFor &&
          h!.goalsAgainst + a!.goalsAgainst === o.goalsAgainst;
        if (!coherent) {
          anomalies.push(`${l.key}/${o.team}`);
          continue;
        }
        checked++;
      }
    }
    expect(checked).toBe(38);
    // Aucune AUTRE anomalie que les 2 connues (match live au scrape).
    expect(anomalies.filter((x) => !KNOWN_INCONSISTENT.has(x.split("/")[1]))).toEqual([]);
    expect(anomalies.sort()).toEqual(
      ["bambusaKvindeligaen/Ikast Handbold W", "bambusaKvindeligaen/Sonderjyske W"].sort(),
    );
  });

  test("aucune valeur manquante : tout numéro est fini, aucun NaN", () => {
    for (const l of leagues) {
      for (const s of l.standings) {
        expect(Number.isFinite(s.goalsFor)).toBe(true);
        expect(Number.isFinite(s.goalsAgainst)).toBe(true);
        expect(Number.isFinite(s.scoredAvg)).toBe(true);
        expect(Number.isFinite(s.concededAvg)).toBe(true);
        expect(Number.isFinite(s.ppg)).toBe(true);
        expect(Number.isFinite(s.home.goalsFor)).toBe(true);
        expect(Number.isFinite(s.away.goalsFor)).toBe(true);
        expect(s.played).toBeGreaterThan(0);
        expect(s.form).toMatch(/^[WDL]*$/);
      }
      for (const f of l.fixtures) {
        expect(Number.isFinite(f.predictedHome)).toBe(true);
        expect(Number.isFinite(f.predictedAway)).toBe(true);
        expect(f.home.length).toBeGreaterThan(0);
        expect(f.away.length).toBeGreaterThan(0);
      }
    }
  });

  test("cohérence W/D/L = P sur les 40 équipes", () => {
    for (const l of leagues) {
      for (const s of l.standings) {
        expect(s.wins + s.draws + s.losses, `${l.name}/${s.team}`).toBe(s.played);
        expect(s.points).toBe(s.wins * 2 + s.draws);
      }
    }
  });

  test("match sans score prédit exclu (fixtureId 193316 « ?:? »)", () => {
    const ids = d2.fixtures.map((f) => f.fixtureId);
    expect(ids).not.toContain(193316);
    // Les 4 fixtures retenues portent toutes un score prédit numérique.
    expect(d2.fixtures).toHaveLength(4);
  });
});

// ─── Baselines de ligue ───

describe("deriveLeagueBaseline — base de buts par équipe et par match", () => {
  test("valeurs mesurées sur les 3 ligues réelles", () => {
    // Recalculé à la main depuis les agrégats du scrape :
    //   Herre      3561 buts / 56 matchs = 63.6 total → 31.8 / équipe
    //   Bambusa    1939 buts / 34 matchs = 57.0 total → 28.5 / équipe
    //   D2 Women   1484 buts / 29 matchs = 51.2 total → 25.6 / équipe
    expect(herre.baseline).toBeCloseTo(31.8, 1);
    expect(bambusa.baseline).toBeCloseTo(28.5, 1);
    expect(d2.baseline).toBeCloseTo(25.6, 1);
  });

  test("classement vide ou sans match → null (jamais NaN)", () => {
    expect(deriveLeagueBaseline([])).toBeNull();
    expect(deriveLeagueBaseline([{ played: 0, goalsFor: 0 } as VitibetStandingRow])).toBeNull();
  });

  test("danishLeagueBaseline : null horsligue couverte", () => {
    expect(danishLeagueBaseline("Herre Handbold Ligaen")).toBeCloseTo(31.8, 1);
    expect(danishLeagueBaseline("Denmark: Herre Handbold Ligaen")).toBeCloseTo(31.8, 1);
    expect(danishLeagueBaseline("Germany: 2. Bundesliga")).toBeNull();
  });

  test("resolveLeagueMean retombe sur le neutre hors ligue danoise", () => {
    expect(resolveLeagueMean("1. Division Women", leagues)).toBeCloseTo(25.6, 1);
    expect(resolveLeagueMean("Bundesliga", leagues)).toBe(CMP_NEUTRAL_LAMBDA);
  });
});

// ─── Team Power rapporté à la moyenne de ligue ───

describe("computePower — base de ligue", () => {
  test("fit(moyenne, moyenne) = 50 quelle que soit la ligue", () => {
    for (const mean of [25.6, 28.5, 31.8]) {
      const s = Array(10).fill(Math.round(mean));
      expect(computePower(s, s, mean)).toBe(50);
    }
  });

  test("la base de ligue entre réellement dans le calcul", () => {
    // Garde-fou du bug corrigé : la forme « 50·(1 + 0.5·log₂(gf/ref) −
    // 0.5·log₂(ga/ref)) » s'annule (ref disparaît), donc deux bases différentes
    // donnaient EXACTEMENT le même Power. Le même profil de buts doit donner
    // des indices différents selon la base.
    const gf = Array(10).fill(26);
    const ga = Array(10).fill(24);
    const onD2 = computePower(gf, ga, d2.baseline)!;
    const onHerre = computePower(gf, ga, herre.baseline)!;
    expect(onD2).not.toBe(onHerre);
    // Sur la base de la ligue faible (25.6), 26 buts = légèrement au-dessus de
    // la moyenne ; sur la base haute (31.8), 26 buts = en dessous.
    expect(onD2).toBeGreaterThan(onHerre);
  });

  test("équipe exactement à la moyenne de sa ligue = 50, pour toute base", () => {
    for (const mean of [25.6, 28.5, 31.8, 20, 40]) {
      const s = Array(10).fill(mean);
      expect(computePower(s, s, mean)).toBe(50);
    }
  });

  test("borné 0..100 pour les 40 équipes réelles", () => {
    for (const l of leagues) {
      for (const s of l.standings) {
        const gf = Array(6).fill(Math.round(s.scoredAvg));
        const ga = Array(6).fill(Math.round(s.concededAvg));
        const p = computePower(gf, ga, l.baseline)!;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ─── Forme Calculée : récence + lieu + écart ───

describe("computeFormPctWeighted — pondération lieu + écart de buts", () => {
  // Victoires à 10 buts d'écart : le crédit par match sature à ~2.
  const gf = [40, 40, 40];
  const ga = [30, 30, 30];

  test("série parfaite à domicile = 100 %", () => {
    expect(computeFormPctWeighted(gf, ga, [true, true, true])).toBe(100);
  });

  test("même série à l'extérieur = 92 % (AWAY_CREDIT), jamais 100", () => {
    const p = computeFormPctWeighted(gf, ga, [false, false, false])!;
    expect(p).toBeCloseTo(92, 0);
    expect(p).toBeLessThan(100);
  });

  test("lieu inconnu → pas de pondération terrain (pas de throw)", () => {
    expect(computeFormPctWeighted(gf, ga)).toBe(100);
    expect(computeFormPctWeighted(gf, ga, [])).toBe(100);
  });

  test("écart de buts : gagner de 1 rapporte moins que gagner de 8", () => {
    const narrow = computeFormPctWeighted([31], [30], [true])!;
    const wide = computeFormPctWeighted([38], [30], [true])!;
    expect(wide).toBeGreaterThan(narrow);
    // Victoire d'un but → crédit ≈ 1.12 / 2 = 56 % ; de 8 buts → ~100 %.
    expect(narrow).toBeLessThan(60);
    expect(wide).toBe(100);
  });

  test("défaite large pénalisée plus qu'une défaite d'un but", () => {
    const close = computeFormPctWeighted([29], [30], [true])!;
    const heavy = computeFormPctWeighted([22], [30], [true])!;
    expect(close).toBeGreaterThan(heavy);
    // Défaite d'un but garde un point de consolation (≈ 44 %), large échec ≈ 0.
    expect(close).toBeGreaterThan(40);
    expect(heavy).toBeLessThan(5);
  });

  test("série mixte : une victoire à l'extérieur vaut moins qu'à domicile", () => {
    const mixed = computeFormPctWeighted([40, 40, 40], [30, 30, 30], [
      true,
      true,
      false,
    ])!;
    const allHome = computeFormPctWeighted([40, 40, 40], [30, 30, 30], [
      true,
      true,
      true,
    ])!;
    expect(mixed).toBeLessThan(allHome);
    expect(mixed).toBeGreaterThan(90);
  });

  test("aucune valeur ne dépasse 100 % (borne jamais atteinte par clamp)", () => {
    // Parcours le plus flatteur possible : 20 victoires par 15 buts, à domicile.
    const g = Array(10).fill(45);
    const a = Array(10).fill(30);
    expect(computeFormPctWeighted(g, a, Array(10).fill(true))).toBe(100);
  });

  test("borné 0..100 sur des séries réelles de la fixture", () => {
    for (const l of leagues) {
      for (const s of l.standings) {
        const n = Math.min(s.form.length, 6);
        if (n === 0) continue;
        const g: number[] = [];
        const a: number[] = [];
        for (let i = 0; i < n; i++) {
          const win = s.form[i] === "W";
          const draw = s.form[i] === "D";
          g.push(Math.round(s.scoredAvg) + (win ? 3 : 0));
          a.push(Math.round(s.concededAvg) + (win || draw ? -2 : 3));
        }
        const p = computeFormPctWeighted(g, a, g.map(() => true))!;
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ─── Index Pariscore : avantage terrain 1.2 ───

describe("computePariscoreIndex — avantage terrain = 1.2 (spec Danoises)", () => {
  test("équipes identiques → index = exactement HOME_ADVANTAGE_INDEX", () => {
    const m = { name: "X", formPct: 70, power: 60, played: 5, scoredAvg: 30, concededAvg: 22, seq: "WWWWW" };
    expect(computePariscoreIndex(m, m)).toBe(HOME_ADVANTAGE_INDEX);
    expect(HOME_ADVANTAGE_INDEX).toBe(1.2);
  });

  test("équipe domicile meilleure → index > 1.2, extérieur meilleure → < 1.2", () => {
    const strong = { name: "S", formPct: 95, power: 90, played: 5, scoredAvg: 36, concededAvg: 22, seq: "WWWWW" };
    const weak = { name: "W", formPct: 10, power: 20, played: 5, scoredAvg: 22, concededAvg: 34, seq: "LLLLL" };
    expect(computePariscoreIndex(strong, weak)).toBeGreaterThan(HOME_ADVANTAGE_INDEX);
    expect(computePariscoreIndex(weak, strong)).toBeLessThan(HOME_ADVANTAGE_INDEX);
  });

  test("borné dans l'échelle Vitibet (|différentiel| ≤ 45)", () => {
    const best = { name: "B", formPct: 100, power: 100, played: 6, scoredAvg: 45, concededAvg: 18, seq: "WWWWWW" };
    const worst = { name: "W", formPct: 0, power: 0, played: 6, scoredAvg: 18, concededAvg: 45, seq: "LLLLLL" };
    // 0.25 × ΔForme (≤100) + 0.20 × ΔPower (≤100) = 45 au maximum, plus
    // l'avantage terrain de 1.2 → borne haute 46.2.
    const max = 0.25 * 100 + 0.2 * 100 + HOME_ADVANTAGE_INDEX;
    expect(max).toBeCloseTo(46.2, 1);
    expect(computePariscoreIndex(best, worst)).toBeCloseTo(max, 1);
    expect(Math.abs(computePariscoreIndex(best, worst))).toBeLessThanOrEqual(46.2);
  });
});

// ─── Parsing Vitibet ───

describe("parsing Vitibet", () => {
  test("parseVitibetScore : « 272:233 +39 » et « 91:91 0 »", () => {
    expect(parseVitibetScore("272:233 +39")).toEqual({ goalsFor: 272, goalsAgainst: 233 });
    expect(parseVitibetScore("91:91 0")).toEqual({ goalsFor: 91, goalsAgainst: 91 });
    expect(parseVitibetScore("n'importe quoi")).toBeNull();
  });

  test("parseVitibetForm : les 2 formats rencontrés", () => {
    expect(parseVitibetForm("W W W W W D")).toBe("WWWWWD");
    expect(parseVitibetForm("*W**W**W**W**W*")).toBe("WWWWW");
    expect(parseVitibetForm("L D W")).toBe("LDW");
    expect(parseVitibetForm("")).toBe("");
  });
});

// ─── Lookups / cohérence ───

describe("toPariscoreTeamStats + lookups", () => {
  const overall: VitibetStandingRow = {
    rank: 1, team: "GOG", teamId: 178, played: 8, wins: 7, draws: 1, losses: 0,
    goalsFor: 272, goalsAgainst: 233, points: 15,
  };

  test("construit les stats + moyennes + PPG + forme", () => {
    const s = toPariscoreTeamStats({
      overall,
      home: { ...overall, played: 4, wins: 3, draws: 1, losses: 0, goalsFor: 135, goalsAgainst: 113, points: 7 },
      away: { ...overall, played: 4, wins: 4, draws: 0, losses: 0, goalsFor: 137, goalsAgainst: 120, points: 8 },
      form: "W W W W W D",
    })!;
    expect(s.scoredAvg).toBe(34);
    expect(s.concededAvg).toBe(29.1);
    expect(s.ppg).toBe(1.9);
    expect(s.form).toBe("WWWWWD");
    expect(s.home.goalsFor).toBe(135);
    expect(s.away.goalsFor).toBe(137);
  });

  test("ligne incohérente (W+D+L ≠ P) → null, jamais de stats falsifiées", () => {
    expect(toPariscoreTeamStats({ overall: { ...overall, wins: 9 } })).toBeNull();
  });

  test("played = 0 → null", () => {
    expect(toPariscoreTeamStats({ overall: { ...overall, played: 0, wins: 0, draws: 0, losses: 0 } })).toBeNull();
  });

  test("split manquant → 0 explicite plutôt que null (le composant affiche « — »)", () => {
    const s = toPariscoreTeamStats({ overall })!;
    expect(s.home.played).toBe(0);
    expect(s.away.played).toBe(0);
  });

  test("findTeamStats : insensible casse/accents, null si absent", () => {
    expect(findTeamStats(herre, "gog")?.team).toBe("GOG");
    expect(findTeamStats(herre, "Bjerringbro/Silkeborg")?.teamId).toBe(176);
    expect(findTeamStats(herre, "Equipe Fantome")).toBeNull();
  });

  test("findFixture retrouve un vrai match à venir des 3 ligues", () => {
    const f = findFixture(herre, "Skive", "GOG");
    expect(f?.fixtureId).toBe(195579);
    expect(f?.predictedHome).toBe(30);
    expect(f?.predictedAway).toBe(37);
    expect(findFixture(bambusa, "Viborg W", "NFH W")?.fixtureId).toBe(194188);
    expect(findFixture(d2, "AGF W", "Gudme HK W")?.live).toBe(true);
    expect(findFixture(herre, "Aucune", "Equipe")).toBeNull();
  });

  test("findDanishLeague gère le préfixe pays du snapshot", () => {
    expect(findDanishLeague("Denmark: Herre Handbold Ligaen")?.vitibetLeagueId).toBe(23);
    expect(findDanishLeague("1. Division Women")?.level).toBe(2);
    expect(findDanishLeague("LNH Division 1")).toBeNull();
  });

  test("champion vs relégable : l'index Pariscore est cohérent sur données réelles", () => {
    // GOG 7V/1N/0D, 272:233 (meilleur) vs Ringsted 0V/1N/7D, 244:285 (dernier).
    const gog = findTeamStats(herre, "GOG")!;
    const ring = findTeamStats(herre, "Ringsted")!;
    const m = (s: typeof gog) => ({
      name: s.team, formPct: computeFormPctWeighted(
        Array(s.played).fill(Math.round(s.scoredAvg)),
        Array(s.played).fill(Math.round(s.concededAvg)),
        Array(s.played).fill(true),
      )!, power: computePower(
        Array(s.played).fill(Math.round(s.scoredAvg)),
        Array(s.played).fill(Math.round(s.concededAvg)),
        herre.baseline,
      )!, played: s.played, scoredAvg: s.scoredAvg, concededAvg: s.concededAvg, seq: s.form,
    });
    const idx = computePariscoreIndex(m(gog), m(ring));
    expect(idx).toBeGreaterThan(15);
    expect(m(gog).power).toBeGreaterThan(m(ring).power);
  });
});
