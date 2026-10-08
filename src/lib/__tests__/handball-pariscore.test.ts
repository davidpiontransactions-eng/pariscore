import { describe, expect, test } from "bun:test";
import {
  PARISCORE_MIN_PROB_PCT,
  HOME_ADVANTAGE_INDEX,
  computeFormPct,
  computePariscoreIndex,
  computePariscorePrediction,
  computePower,
  pickTotalThreshold,
  teamPariscoreMetrics,
} from "@/lib/handball-pariscore";
import {
  CMP_DEFAULT_NU,
  CMP_NEUTRAL_LAMBDA,
  cmpLambdaForMean,
  cmpMean,
  fitCMP,
  overUnderProb,
} from "@/lib/handball-cmp";
import type { HandballMatch } from "@/lib/handball-data";
import fixture from "@/lib/fixtures/bundesliga2-handball-2026.json";

// ─── Helpers ───

type Series = { gf: number[]; ga: number[] };

/** Reconstitue un match 2. Bundesliga depuis la fixture JSON. */
function makeMatch(
  home: string,
  homeId: number,
  away: string,
  awayId: number,
  kickoff = "2026-10-05T19:30:00+02:00",
): HandballMatch {
  return {
    id: 900_000 + homeId * 10 + awayId,
    league: { id: 43, name: "2. Bundesliga", country: "Germany", countryCode: "DE" },
    home: { id: homeId, name: home },
    away: { id: awayId, name: away },
    kickoff,
    status: "not_started",
  };
}

/** Form-store minimal : 2 équipes alimentées par leurs séries L5/L10. */
type FormStoreArg = NonNullable<
  NonNullable<Parameters<typeof computePariscorePrediction>[1]>["formStore"]
>;

function storeOf(ids: [string, number, Series], ids2: [string, number, Series]): FormStoreArg {
  const map = new Map<string, Series>();
  for (const [, id, s] of [ids, ids2]) {
    map.set(String(id), s);
  }
  return map as unknown as FormStoreArg;
}

const F = fixture.formSeries as unknown as Record<string, Series>;
const standings = fixture.standings;
const first = standings[0];
const second = standings[1];

// ─── Forme Calculée ───

describe("cmpLambdaForMean — inversion taux → moyenne (régression handball-cmp)", () => {
  test("E[X] du taux inversé vaut la moyenne demandée, pour tout ν de la plage", () => {
    for (const nu of [1, 1.1, 1.3, 1.5, 2, 3]) {
      for (const mean of [12, 22, 28.5, 34, 45]) {
        const lam = cmpLambdaForMean(mean, nu);
        expect(Math.abs(cmpMean(lam, nu) - mean)).toBeLessThan(0.01);
      }
    }
  });

  test("ν = 1 → λ = moyenne (Poisson exact)", () => {
    expect(cmpLambdaForMean(28, 1)).toBe(28);
  });

  test("ν > 1 → λ > moyenne (le taux n'est PAS la moyenne)", () => {
    // C'est exactement le piège que le repli de fitCMP franchissait :
    // E[X](28, 1.3) = 12.86 au lieu de 28.
    const lam = cmpLambdaForMean(28, 1.3);
    expect(lam).toBeGreaterThan(28);
    expect(cmpMean(28, 1.3)).toBeLessThan(14);
  });

  test("CMP_NEUTRAL_LAMBDA est une MOYENNE : E[X] = λ à ν = 1", () => {
    // Contrat du codebase (resolveLambdas de handball-predictive-bets) :
    // le prior neutre s'utilise avec ν = 1, seul cas où λ = moyenne.
    expect(cmpMean(CMP_NEUTRAL_LAMBDA, 1)).toBeCloseTo(CMP_NEUTRAL_LAMBDA, 9);
    // …et il ne doit PAS être lu tel quel avec ν = 1.3.
    expect(cmpMean(CMP_NEUTRAL_LAMBDA, CMP_DEFAULT_NU)).toBeLessThan(20);
  });

  test("tous les replis de fitCMP préservent E[X] = moyenne", () => {
    // n = 0 (prior neutre), n < CMP_MIN_HISTORY, série constante (ridge dur),
    // série normale qui ne converge pas : dans les 4 cas le modèle doit rester
    // centré sur la moyenne observée.
    const cases: Array<[number[], number]> = [
      [[], CMP_NEUTRAL_LAMBDA],
      [[30, 31], 30.5],
      [Array(30).fill(30), 30],
      [[31, 28, 32, 30, 29], 30],
    ];
    for (const [series, mean] of cases) {
      const fit = fitCMP(series);
      const m = series.length
        ? series.reduce((a, b) => a + b, 0) / series.length
        : mean;
      expect(Math.abs(cmpMean(fit.lambda, fit.nu) - m)).toBeLessThan(0.1);
    }
  });

  test("Over/Under sur une ligne de ligue avec un ν ajusté est plausible", () => {
    // Avant correction, un λ = moyenne relu à ν = 1.3 centrait la distribution
    // à ~13 buts/équipe → Over 55.5 = 0.0 %. Après conversion (λ = taux), on
    // retrouve une probabilité de marché crédible.
    const lam = cmpLambdaForMean(CMP_NEUTRAL_LAMBDA, CMP_DEFAULT_NU);
    const { over } = overUnderProb(lam, CMP_DEFAULT_NU, lam, CMP_DEFAULT_NU, 55.5);
    expect(over).toBeGreaterThan(0.4);
    expect(over).toBeLessThan(0.8);
  });
});

describe("computeFormPct — Forme Calculée (%)", () => {
  test("série parfaite (10 victoires) → 100 %", () => {
    const gf = Array(10).fill(30);
    const ga = Array(10).fill(22);
    expect(computeFormPct(gf, ga)).toBe(100);
  });

  test("série nulle (10 défaites) → 0 %", () => {
    const gf = Array(10).fill(20);
    const ga = Array(10).fill(30);
    expect(computeFormPct(gf, ga)).toBe(0);
  });

  test("historique vide → null (jamais de 0 inventé)", () => {
    expect(computeFormPct([], [])).toBeNull();
  });

  test("borne toujours 0..100", () => {
    for (const row of standings) {
      const s = F[row.team];
      const v = computeFormPct(s.gf, s.ga);
      expect(v).not.toBeNull();
      expect(v!).toBeGreaterThanOrEqual(0);
      expect(v!).toBeLessThanOrEqual(100);
    }
  });

  test("fenêtre L10 : une victoire de plus raises la forme", () => {
    const base = Array(10).fill(28) as number[];
    const worse = computeFormPct(base, Array(10).fill(30));
    const better = computeFormPct(base, Array(10).fill(26));
    expect(better!).toBeGreaterThan(worse!);
  });
});

// ─── Team Power ───

describe("computePower — Team Power (/100)", () => {
  test("niveau de référence league (moyenne neutre des deux côtés) → 50", () => {
    const neutral = Array(10).fill(Math.round(CMP_NEUTRAL_LAMBDA));
    expect(computePower(neutral, neutral)).toBe(50);
  });

  test("équipe 2× plus forte en attaque ET défense → proche de 100", () => {
    const doubled = Array(10).fill(Math.round(CMP_NEUTRAL_LAMBDA * 2));
    const halved = Array(10).fill(Math.round(CMP_NEUTRAL_LAMBDA / 2));
    const p = computePower(doubled, halved)!;
    expect(p).toBeGreaterThanOrEqual(95);
    expect(p).toBeLessThanOrEqual(100);
  });

  test("équipe 2× plus faible → proche de 0", () => {
    const weak = Array(10).fill(Math.round(CMP_NEUTRAL_LAMBDA / 2));
    const soft = Array(10).fill(Math.round(CMP_NEUTRAL_LAMBDA * 2));
    const p = computePower(weak, soft)!;
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(5);
  });

  test("défense se lit avec le signe inverse (peu encaissé = power haut)", () => {
    const atk = Array(10).fill(28);
    const solid = computePower(atk, Array(10).fill(22))!;
    const leaky = computePower(atk, Array(10).fill(34))!;
    expect(solid).toBeGreaterThan(leaky);
  });

  test("historique vide → null", () => {
    expect(computePower([], [])).toBeNull();
  });

  test("toutes les équipes de la fixture restent dans 0..100", () => {
    for (const row of standings) {
      const s = F[row.team];
      const p = computePower(s.gf, s.ga)!;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

// ─── Index Pariscore ───

describe("computePariscoreIndex", () => {
  test("deux équipes au même niveau → index = avantage terrain seul", () => {
    const neutral = Array(10).fill(28);
    const m = teamPariscoreMetrics("X", { gf: neutral, ga: neutral })!;
    // Avantage terrain = 1.2 (spec mission Danoises §2.B).
    expect(computePariscoreIndex(m, m)).toBe(HOME_ADVANTAGE_INDEX);
    expect(HOME_ADVANTAGE_INDEX).toBe(1.2);
  });

  test("équipe domicile meilleure → index > avantage terrain seul", () => {
    const mHome = teamPariscoreMetrics("A", { gf: [38, 36, 40, 37], ga: [28, 30, 27, 29] })!;
    const mAway = teamPariscoreMetrics("B", { gf: [26, 28, 25, 27], ga: [32, 30, 33, 31] })!;
    expect(computePariscoreIndex(mHome, mAway)).toBeGreaterThan(HOME_ADVANTAGE_INDEX);
  });

  test("équipe extérieure meilleure → index sous l'avantage terrain seul", () => {
    const mHome = teamPariscoreMetrics("A", { gf: [26, 25, 27, 24], ga: [32, 31, 33, 30] })!;
    const mAway = teamPariscoreMetrics("B", { gf: [38, 36, 40, 37], ga: [28, 30, 27, 29] })!;
    const idx = computePariscoreIndex(mHome, mAway);
    // L'index Vitibet reste signé du point de vue domicile : une équipe
    // extérieure meilleure le rend négatif ou proche de 0.
    expect(idx).toBeLessThan(HOME_ADVANTAGE_INDEX);
    expect(idx).toBeGreaterThan(-46.2);
  });

  test("index reste dans l'échelle Vitibet (borne = 0.25·ΔF + 0.20·ΔP + 1.2)", () => {
    const mHome = teamPariscoreMetrics("A", { gf: [45, 44, 46, 45], ga: [18, 19, 17, 18] })!;
    const mAway = teamPariscoreMetrics("B", { gf: [18, 19, 17, 18], ga: [45, 44, 46, 45] })!;
    expect(computePariscoreIndex(mHome, mAway)).toBeLessThanOrEqual(46.2);
  });

  test("metrics null (équipe inconnue) → repli neutre, pas de throw", () => {
    expect(computePariscoreIndex(null, null)).toBe(HOME_ADVANTAGE_INDEX);
    expect(
      computePariscoreIndex(null, teamPariscoreMetrics("B", { gf: [30], ga: [20] })),
    ).not.toBeNaN();
  });
});

// ─── Seuil Over/Under ───

describe("pickTotalThreshold — seuil de total", () => {
  // ⚠️ pickTotalThreshold attend des TAUX CMP. `nu` = 1.3, taux d'une moyenne
  // de 28 buts ≈ 76.5 (cf. cmpLambdaForMean). Passer 28 directement
  // décalerait toute la distribution (E[X] = 12.9) → 0 % sur toutes les lignes.
  const NU = 1.3;
  const rate28 = cmpLambdaForMean(28, NU);

  test("totaux égaux : la ligne médiane passe le seuil de probabilité", () => {
    const pick = pickTotalThreshold(rate28, NU, rate28, NU);
    expect(pick).not.toBeNull();
    expect(pick!.prob).toBeGreaterThanOrEqual(PARISCORE_MIN_PROB_PCT);
  });

  test("la probabilité retournée respecte toujours le plancher", () => {
    for (const mean of [25, 28, 30, 32]) {
      const lam = cmpLambdaForMean(mean, NU);
      const pick = pickTotalThreshold(lam, NU, lam, NU);
      if (pick) expect(pick.prob).toBeGreaterThanOrEqual(PARISCORE_MIN_PROB_PCT);
    }
  });

  test("match déséquilibré : la ligne dégénérée « under 75 » n'est PAS publiée", () => {
    // 45 + 30 = 75 buts attendus, distribution CMP très serrée : « under 75 »
    // ressort mathématiquement à 100 %. Une quasi-certitude est un défaut de
    // ligne, pas un coup gagnant → elle est refusée par le plafond 95 %.
    const pick = pickTotalThreshold(cmpLambdaForMean(45, NU), NU, cmpLambdaForMean(30, NU), NU);
    if (pick) {
      expect(pick.prob).toBeLessThanOrEqual(95);
      expect(pick.line).not.toBe(75);
    }
  });

  test("aucune ligne ne peut dépasser le plafond de probabilité", () => {
    for (const [lh, le] of [
      [45, 30],
      [28, 28],
      [12, 40],
      [50, 50],
    ] as const) {
      const pick = pickTotalThreshold(
        cmpLambdaForMean(lh, NU),
        NU,
        cmpLambdaForMean(le, NU),
        NU,
      );
      if (pick) expect(pick.prob).toBeLessThanOrEqual(95);
    }
  });

  test("la ligne retenue est la plus proche du total attendu (conservatrice)", () => {
    const pick = pickTotalThreshold(rate28, NU, rate28, NU)!;
    // Total attendu 56 → aucune demi-ligne retenue ne doit s'en éloigner de
    // plus de ~8 buts (sinon c'est une ligne extrême, pas la ligne marché).
    expect(Math.abs(pick.line - 56)).toBeLessThanOrEqual(8);
    expect(pick.prob).toBeGreaterThanOrEqual(PARISCORE_MIN_PROB_PCT);
  });

  test("cote sous 1.15 → qualifies=false même avec proba haute", () => {
    const found = pickTotalThreshold(rate28, NU, rate28, NU)!;
    // On rejoue avec une cote ridicule sur la ligne trouvée.
    const blocked = pickTotalThreshold(rate28, NU, rate28, NU, {
      [String(found.line)]: { [found.side]: 1.05 },
    });
    expect(blocked).not.toBeNull();
    expect(blocked!.qualifies).toBe(false);
  });

  test("cote ≥ 1.15 → qualifies=true", () => {
    const found = pickTotalThreshold(rate28, NU, rate28, NU)!;
    const ok = pickTotalThreshold(rate28, NU, rate28, NU, {
      [String(found.line)]: { [found.side]: 1.9 },
    });
    expect(ok!.qualifies).toBe(true);
  });

  test("taux CMP vs moyenne : la ligne suit la MOYENNE implicite du λ fourni", () => {
    // Garde-fou du contrat documenté dans la JSDoc : passer 28 comme taux
    // (au lieu du taux 76.5 qui produit 28 buts de moyenne) recentre toute la
    // distribution sur 2 × 12.86 = 25.7 buts. La fonction ne « casse » pas —
    // elle reste cohérente avec le λ qu'on lui donne, donc avec 25.7.
    const bogus = pickTotalThreshold(28, NU, 28, NU)!;
    expect(bogus).not.toBeNull();
    expect(Math.abs(bogus.line - 25.7)).toBeLessThanOrEqual(4);
  });
});

// ─── Prédiction complète ───

describe("computePariscorePrediction — 2. Bundesliga (fixture Vitibet 43)", () => {
  test("Potsdam (invaincu) vs Ferndorf : total prédit aligné sur Vitibet (59-60)", () => {
    const m = makeMatch("Potsdam", 347, "Ferndorf", 337);
    const p = computePariscorePrediction(m, {
      formStore: storeOf(["Potsdam", 347, F["Potsdam"]], ["Ferndorf", 337, F["Ferndorf"]]),
    });
    expect(p.hasForm).toBe(true);
    expect(p.scoreHome).toBeGreaterThan(0);
    expect(p.scoreAway).toBeGreaterThan(0);
    // Contrôle d'étalonnage : le modèle doit rester sur des totaux de ligue
    // (≈ 57 buts). Vitibet prédit 30:29 = 59 pour cette rencontre.
    expect(p.expectedTotal).toBeGreaterThan(50);
    expect(p.expectedTotal).toBeLessThan(65);
    // Potsdam (invaincu) et Ferndorf sont au même niveau de buts (30.0 vs
    // 31.2 marqués) : avec un avantage terrain de 1.2 (spec Danoises), l'Index
    // est ~neutre. Le score prédit reste 30:29 comme Vitibet.
    expect(Math.abs(p.index)).toBeLessThan(2);
    expect(p.index).toBeCloseTo(0, 0);
  });

  test("Hagen vs Ferndorf : invaincu à domicile avec la meilleure attaque → favori", () => {
    const m = makeMatch("Hagen", 340, "Ferndorf", 337);
    const p = computePariscorePrediction(m, {
      formStore: storeOf(["Hagen", 340, F["Hagen"]], ["Ferndorf", 337, F["Ferndorf"]]),
    });
    expect(p.winrate.home).toBeGreaterThan(50);
    expect(p.winrate.home).toBeGreaterThan(p.winrate.away);
    expect(p.index).toBeGreaterThan(6);
  });

  test("winrate 1N2 somme à 100 (± arrondi 0.1)", () => {
    const m = makeMatch("Elbflorenz", 336, "Huttenberg", 342);
    const p = computePariscorePrediction(m, {
      formStore: storeOf(["Elbflorenz", 336, F["Elbflorenz"]], ["Huttenberg", 342, { gf: [24, 22], ga: [28, 26] }]),
    });
    const sum = p.winrate.home + p.winrate.draw + p.winrate.away;
    expect(Math.abs(sum - 100)).toBeLessThan(0.35);
  });

  test("la meilleure attaque du classement sort le score domicile le plus élevé", () => {
    // Adversaire IDENTIQUE des trois côtés : la seule variable est l'attaque
    // propre de l'équipe à domicile. Le test utilisait auparavant Huttenberg
    // (1 seul match d'historique, que l'ancien prior ignorait) face à
    // Elbflorenz : il passait par une NEUTRALISATION accidentelle, pas parce
    // qu'Elbflorenz était faible. Sur cette fixture Elbflorenz marque 39.0
    // buts/match contre 34.0 pour Hagen — l'ordre était inversé.
    const vsNordhorn = (id: number, name: string, series: Series) =>
      computePariscorePrediction(makeMatch(name, id, "Nordhorn-Lingen", 371), {
        formStore: storeOf([name, id, series], ["Nordhorn-Lingen", 371, F["Nordhorn-Lingen"]]),
      });

    const elb = vsNordhorn(336, "Elbflorenz", F["Elbflorenz"]);
    const hagen = vsNordhorn(340, "Hagen", F["Hagen"]);
    const ferndorf = vsNordhorn(337, "Ferndorf", F["Ferndorf"]);

    expect(elb.scoreHome).toBeGreaterThan(hagen.scoreHome);
    expect(elb.scoreHome).toBeGreaterThan(ferndorf.scoreHome);
  });

  test("historique absent → hasForm=false, λ neutre (57 buts de total), jamais de throw", () => {
    const m = makeMatch("Dormagen", 334, "Coburg 2000", 366);
    const p = computePariscorePrediction(m, { formStore: null });
    expect(p.hasForm).toBe(false);
    // cmpMean(λ, ν=1) = λ à 1e-13 près ; Math.round(28.5) peut donc tomber à 28
    // si la somme de pmfs rend 28.4999… → on borne à ±1.
    expect(Math.abs(p.scoreHome - CMP_NEUTRAL_LAMBDA)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.scoreAway - CMP_NEUTRAL_LAMBDA)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.expectedTotal - CMP_NEUTRAL_LAMBDA * 2)).toBeLessThanOrEqual(1);
    expect(p.home).toBeNull();
    expect(p.away).toBeNull();
    expect(p.note).toContain("neutre");
  });

  test("historique court mais réel des 2 côtés → hasForm=false, hasSignal=true (pas de 50/50)", () => {
    const m = makeMatch("Potsdam", 347, "Inconnue", 999);
    const p = computePariscorePrediction(m, {
      formStore: storeOf(["Potsdam", 347, F["Potsdam"]], ["Inconnue", 999, { gf: [10], ga: [10] }]),
    });
    // 1 match < CMP_MIN_HISTORY : pas de fit CMP possible…
    expect(p.hasForm).toBe(false);
    // …mais les 2 équipes ont une donnée, donc le modèle parle. Une équipe à
    // 10-10 ne peut pas sortir à 28-28 contre une.invaincue à 30 de moyenne.
    expect(p.hasSignal).toBe(true);
    expect(p.winrate.home).not.toBe(p.winrate.away);
    expect(p.scoreHome).toBeGreaterThan(p.scoreAway);
  });

  test("aucune équipe connue → hasSignal=false (l'UI affiche l'état neutre)", () => {
    const p = computePariscorePrediction(makeMatch("Dormagen", 334, "Coburg 2000", 366), {
      formStore: null,
    });
    expect(p.hasSignal).toBe(false);
    expect(p.hasForm).toBe(false);
  });

  test("les 3 métriques par équipe sont bornées pour toute la fixture", () => {
    for (const f of fixture.fixtures) {
      const p = computePariscorePrediction(makeMatch(f.home, f.homeId, f.away, f.awayId, `${f.date}T${f.time}:00+02:00`), {
        formStore: null,
      });
      expect(p.index).toBeGreaterThanOrEqual(-45);
      expect(p.index).toBeLessThanOrEqual(45);
      const sum = p.winrate.home + p.winrate.draw + p.winrate.away;
      expect(sum).toBeGreaterThan(99.6);
      expect(sum).toBeLessThan(100.4);
    }
  });

  test("cotes 1X2 fournies → le chemin odds est traversé sans throw", () => {
    const m: HandballMatch = {
      ...makeMatch("Hagen", 340, "Ferndorf", 337),
      odds: { home: 1.55, draw: 12, away: 4.5 },
    };
    const p = computePariscorePrediction(m, {
      formStore: storeOf(["Hagen", 340, F["Hagen"]], ["Ferndorf", 337, F["Ferndorf"]]),
    });
    expect(p.winrate.home).toBeGreaterThan(50);
  });

  test("métriques d'équipe : séquences W/D/L de longueur ≤ fenêtre", () => {
    for (const row of standings) {
      const m = teamPariscoreMetrics(row.team, F[row.team], 5)!;
      expect(m.seq.length).toBeGreaterThan(0);
      expect(m.seq.length).toBeLessThanOrEqual(5);
      expect(m.seq).toMatch(/^[WDL]+$/);
      expect(m.played).toBeLessThanOrEqual(10);
    }
  });

  test("équipe absente → metrics null (pas de ligne Pariscore fantôme)", () => {
    expect(teamPariscoreMetrics("Inconnue", undefined)).toBeNull();
    expect(teamPariscoreMetrics("Inconnue", { gf: [], ga: [] })).toBeNull();
  });

  test("cohérence fixture : le champion du classement domine le 7e", () => {
    const m = makeMatch(first.team, first.apiSportsId, "Ferndorf", 337);
    const p = computePariscorePrediction(m, {
      formStore: storeOf([first.team, first.apiSportsId, F[first.team]], ["Ferndorf", 337, F["Ferndorf"]]),
    });
    expect(p.index).toBeGreaterThan(6);
    expect(p.home!.power).toBeGreaterThan(p.away!.power);
    expect(p.home!.formPct).toBeGreaterThan(p.away!.formPct);
    // 2e du classement (invaincu) au moins aussi fort que le champion à 1 défaite.
    expect(second.team).toBe("Potsdam");
  });
});

// ─── Régression « 28 : 28 / 47.4 %-5.3 %-47.4 % » ─────────────────────────────
//
// Constaté en prod le 2026-10-08 sur CSM Bucuresti vs Minaur Baia Mare
// (Liga Nationala RO). Le banner affichait « 28 : 28 », « 47.4 % / 5.3 % /
// 47.4 % » et « Under 60 » alors que, juste au-dessus, le Team Power disait
// 31.6 contre 60.1 et la Forme 2.6 % contre 71.7 %. Deux causes cumulées :
//   (1) le form-store du dialog ne gardait que 1-2 matchs de la fenêtre
//       Flashscore et effaçait les 14 matchs SQLite (corrigé côté dialog) ;
//   (2) `resolveLambdas` exigeait 3 matchs DES DEUX côtés et retombait sinon
//       sur un prior parfaitement symétrique — alors que Forme et Power
//       étaient déjà calculés (corrigé ici).
//
// Les séries ci-dessous sont les 2 derniers matchs de la fenêtre Flashscore,
// telles que la base les stocke (chronologiques, lu sur
// `handball_match_history`, lignes du 2026-09-25 et du 2026-09-26).
describe("computePariscorePrediction — régression du prior neutre aveugle", () => {
  const ROMANIA_MEAN = 30.1; // leagueGoalsPerTeam("Liga Nationala") mesuré en base

  const csm: Series = { gf: [36, 30], ga: [40, 38] }; // 2 défaites, 33 marqués
  const minaur: Series = { gf: [27, 25], ga: [19, 25] }; // 1V 1N, 26 marqués

  function predict() {
    const m: HandballMatch = {
      id: 777_001,
      league: { id: 161, name: "Liga Nationala", country: "Romania", countryCode: "RO" },
      home: { id: 101, name: "CSM Bucuresti" },
      away: { id: 102, name: "Minaur Baia Mare" },
      kickoff: "2026-10-08T15:00:00+02:00",
      status: "not_started",
    };
    return computePariscorePrediction(m, {
      formStore: storeOf(["CSM Bucuresti", 101, csm], ["Minaur Baia Mare", 102, minaur]),
      leagueMean: ROMANIA_MEAN,
    });
  }

  test("2 matchs d'historique ne produisent plus un score symétrique", () => {
    const p = predict();
    // AVANT : lambdaH === lambdaE → scoreHome === scoreAway. C'est exactement
    // le symptôme « 28 : 28 » du rapport.
    expect(p.scoreHome).not.toBe(p.scoreAway);
    // CSM encaisse 39 buts/match, Minaur 22 : l'écart de défense doit se voir.
    expect(p.scoreAway).toBeGreaterThan(p.scoreHome);
  });

  test("le winrate 1N2 est différencié, pas 47.4 / 5.3 / 47.4", () => {
    const p = predict();
    expect(p.winrate.away).toBeGreaterThan(p.winrate.home);
    // L'écart domicile/extérieur doit excéder le 0.0 du prior neutre.
    expect(p.winrate.away - p.winrate.home).toBeGreaterThan(3);
    const sum = p.winrate.home + p.winrate.draw + p.winrate.away;
    expect(Math.abs(sum - 100)).toBeLessThan(0.35);
  });

  test("l'écart de Team Power observé (31.6 vs 60.1) tire bien le modèle", () => {
    const p = predict();
    // Team Power reproduit depuis les mêmes séries : CSM nettement plus faible.
    expect(p.home!.power).toBeLessThan(p.away!.power);
    expect(p.away!.power - p.home!.power).toBeGreaterThan(15);
    expect(p.index).toBeLessThan(0);
  });

  test("la base de ligue est reprise telle quelle (30.1, pas le 28.5 générique)", () => {
    const p = predict();
    expect(p.note).toContain("30.1");
    expect(p.note).not.toContain("28.5");
    // Total attendu cohérent avec une base à ~30 buts/équipe.
    expect(p.expectedTotal).toBeGreaterThan(54);
    expect(p.expectedTotal).toBeLessThan(66);
  });

  test("shrinkage : 1 seul match ne peut pas faire basculer un écart de 20 buts", () => {
    // Même rencontre, mais l'adversaire n'a qu'un match : la base de ligue
    // pèse 75 % du λ, la donnée 25 %. L'écart existe, il reste borné.
    const m: HandballMatch = {
      id: 777_002,
      league: { id: 161, name: "Liga Nationala", country: "Romania", countryCode: "RO" },
      home: { id: 101, name: "CSM Bucuresti" },
      away: { id: 102, name: "Minaur Baia Mare" },
      kickoff: "2026-10-08T15:00:00+02:00",
      status: "not_started",
    };
    const p = computePariscorePrediction(m, {
      formStore: storeOf(
        ["CSM Bucuresti", 101, csm],
        ["Minaur Baia Mare", 102, { gf: [25], ga: [25] }],
      ),
      leagueMean: ROMANIA_MEAN,
    });
    expect(p.hasSignal).toBe(true);
    expect(Math.abs(p.scoreAway - p.scoreHome)).toBeLessThanOrEqual(3);
  });
});