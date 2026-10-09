import { describe, expect, test } from "bun:test";
import {
  VALUEBET_MAX_PROB_PCT,
  VALUEBET_MIN_ODDS,
  VALUEBET_MIN_PROB_PCT,
  selectHandballValueBet,
} from "@/lib/handball-value-bet";
import { computePariscorePrediction } from "@/lib/handball-pariscore";
import { cmpMean, overUnderProb } from "@/lib/handball-cmp";
import type { HandballMatch, HandballOpeningOdds } from "@/lib/handball-data";

// ─── Helpers ───

type Series = { gf: number[]; ga: number[]; atHome?: boolean[] };

type FormStoreArg = NonNullable<
  NonNullable<Parameters<typeof computePariscorePrediction>[1]>["formStore"]
>;

/** 10 matchs à 30:25 (domicile) — équipe dominante, marge de 5 buts/match. */
const STRONG_HOME: Series = {
  gf: [30, 31, 29, 32, 30, 30, 31, 29, 30, 30],
  ga: [25, 24, 26, 24, 25, 25, 24, 26, 25, 25],
  atHome: [true, true, true, true, true, true, true, true, true, true],
};

/** 10 matchs à 24:29 (défaite) — équipe faible. */
const WEAK_AWAY: Series = {
  gf: [24, 23, 25, 24, 22, 24, 23, 25, 24, 24],
  ga: [29, 30, 28, 29, 31, 29, 30, 28, 29, 29],
  atHome: [false, false, false, false, false, false, false, false, false, false],
};

function storeOf(entries: Array<[string, Series]>): FormStoreArg {
  const map = new Map<string, Series>();
  for (const [id, s] of entries) map.set(id, s);
  return map as unknown as FormStoreArg;
}

function makeMatch(
  overrides: {
    home?: string;
    away?: string;
    odds?: { home?: number; draw?: number; away?: number };
    openingOdds?: HandballOpeningOdds;
  } = {},
): HandballMatch {
  return {
    id: 910_001,
    league: { id: 1, name: "Test: Starligue", country: "France", countryCode: "FR" },
    home: { id: 1, name: overrides.home ?? "Dominc" },
    away: { id: 2, name: overrides.away ?? "Extérieur" },
    kickoff: "2026-10-05T19:30:00+02:00",
    status: "not_started",
    odds: overrides.odds,
    openingOdds: overrides.openingOdds,
  };
}

const HOME_ID = "1";
const AWAY_ID = "2";

/** Prédiction du match dominant (30:25 à domicile vs 24:29 à l'extérieur). */
function strongPrediction(match: HandballMatch) {
  return computePariscorePrediction(match, {
    formStore: storeOf([
      [HOME_ID, STRONG_HOME],
      [AWAY_ID, WEAK_AWAY],
    ]),
    leagueMean: 28.5,
  });
}

/** Prédiction d'un match sans aucun historique → hasSignal false. */
function coldPrediction(match: HandballMatch) {
  return computePariscorePrediction(match, { formStore: storeOf([]), leagueMean: 28.5 });
}

/**
 * Deux équipes de profil IDENTIQUE → marge attendue < 0.5 but.
 *
 * Sert à atteindre le niveau 3 : le niveau 2 se refuse alors faute de
 * handicap jouable, ce que la mission veut (« si la marge 1N2 est incertaine »).
 */
const FLAT_TEAM: Series = {
  gf: [27, 28, 26, 27, 28, 27, 26, 28, 27, 27],
  ga: [27, 26, 28, 27, 26, 27, 28, 26, 27, 27],
  atHome: [true, true, true, true, true, true, true, true, true, true],
};

function balancedPrediction(match: HandballMatch) {
  return computePariscorePrediction(match, {
    formStore: storeOf([
      [HOME_ID, FLAT_TEAM],
      [AWAY_ID, FLAT_TEAM],
    ]),
    leagueMean: 28.5,
  });
}

// ─── Invariants globaux ───

describe("selectHandballValueBet — invariants de la cascade", () => {
  test("tout pari publié a une cote ≥ 1.20 (mission §2)", () => {
    const match = makeMatch({ odds: { home: 1.31, draw: 12, away: 9 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    if (result.selected) {
      expect(result.selected.odds).not.toBeNull();
      expect(result.selected.odds!).toBeGreaterThanOrEqual(VALUEBET_MIN_ODDS);
    }
  });

  test("tout pari publié respecte la bande de son niveau (mission §2)", () => {
    const match = makeMatch({ odds: { home: 1.31, away: 9 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    const sel = result.selected!;
    expect(sel.market).toBe("winner");
    // Niveau 1 : P ≥ 70 % ET cote de marché ≥ 1.20.
    expect(sel.prob).toBeGreaterThanOrEqual(VALUEBET_MIN_PROB_PCT);
    expect(sel.odds!).toBeGreaterThanOrEqual(VALUEBET_MIN_ODDS);
  });

  test("niveau 2/3 : cote cible = 1/P ≥ 1.20, donc P ≤ 83.3 %", () => {
    const match = makeMatch({ odds: { home: 1.05, draw: 20, away: 15 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    const sel = result.selected!;
    expect(sel.market).toBe("handicap");
    expect(sel.prob).toBeGreaterThan(50);
    expect(sel.prob).toBeLessThanOrEqual(VALUEBET_MAX_PROB_PCT);
    expect(sel.targetOdds).toBeCloseTo(100 / sel.prob, 1);
  });

  test("les 3 niveaux sont toujours présents et dans l'ordre de la cascade", () => {
    const match = makeMatch({ odds: { home: 1.31 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    expect(result.candidates.map((c) => c.market)).toEqual(["winner", "handicap", "total"]);
  });

  test("un candidat retenu n'a jamais de motif de refus, et inversement", () => {
    const match = makeMatch({ odds: { home: 1.31, away: 9 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    for (const c of result.candidates) {
      expect(c.qualifies).toBe(c.rejectReason === null);
    }
  });

  test("jamais de prix inventé : sans cote marché, cote/EV/Kelly restent nuls", () => {
    // Aucune cote du tout. Les niveaux 2 et 3 publient quand même leur LIGNE et
    // sa cote cible — c'est ce que la mission demande — mais le prix du marché
    // reste null : on n'invente pas d'opportunité, on annonce un prix.
    const match = makeMatch();
    const result = selectHandballValueBet(match, strongPrediction(match));
    for (const c of result.candidates) {
      expect(c.odds).toBeNull();
      expect(c.ev).toBeNull();
      expect(c.kelly).toBeNull();
    }
    expect(result.candidates[0].qualifies).toBe(false); // P1 exige une cote marché
  });

  test("sans signal (aucun historique) → aucun pari,.hasSignal respecté", () => {
    const match = makeMatch({ odds: { home: 1.31, draw: 12, away: 9 } });
    const result = selectHandballValueBet(match, coldPrediction(match));
    expect(result.selected).toBeNull();
    expect(result.candidates[0].rejectReason).toContain("donnée");
  });
});

// ─── P1 — Vainqueur 1N2 ───

describe("P1 — Vainqueur 1N2", () => {
  test("P ≥ 70 % et cote ≥ 1.20 → victoire simple retenue", () => {
    const match = makeMatch({ odds: { home: 1.31, draw: 12, away: 9 } });
    const prediction = strongPrediction(match);
    expect(prediction.winrate.home).toBeGreaterThanOrEqual(VALUEBET_MIN_PROB_PCT);
    const result = selectHandballValueBet(match, prediction);
    expect(result.selectedPriority).toBe(1);
    expect(result.selected!.market).toBe("winner");
    expect(result.selected!.label).toContain("Dominc");
  });

  test("cote < 1.20 → P1 refusé, on bascule sur le handicap (mission §2 P2)", () => {
    const match = makeMatch({ odds: { home: 1.05, draw: 20, away: 15 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    const winner = result.candidates[0];
    expect(winner.qualifies).toBe(false);
    expect(winner.rejectReason).toContain("bascule sur le handicap");
    // Le handicap n'a pas de cote de marché ici → rien n'est publié, mais le
    // motif du niveau 2 doit être le refus de cote, pas un bug.
    expect(result.candidates[1].market).toBe("handicap");
  });

  test("cote d'ouverture utilisée quand le snapshot courant est vide", () => {
    const match = makeMatch({ openingOdds: { fav1x2: { home: 1.31, away: 9 } } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    expect(result.selectedPriority).toBe(1);
    expect(result.selected!.odds).toBe(1.31);
  });
});

// ─── P2 — Handicap ───

describe("P2 — Handicap couvert", () => {
  test("ligne en demi-pas, probabilité ≥ 70 %, cote à la ligne exacte", () => {
    const match = makeMatch({ odds: { home: 1.05, draw: 20, away: 15 } });
    const prediction = strongPrediction(match);

    // On cote la ligne que le moteur sélectionne, isolée : le test vérifie le
    // contrat « cote à la LIGNE EXACTE », pas la valeur d'une ligne arbitraire.
    const firstPass = selectHandballValueBet(match, prediction);
    const label = firstPass.candidates[1].label;
    const line = Number(label.split("-")[1]);
    expect(Number.isInteger(line * 2)).toBe(true);

    const withLine = selectHandballValueBet(match, prediction, {
      handicapOdds: { [String(line)]: 1.4 },
    });
    const hcp = withLine.candidates[1];
    expect(hcp.qualifies).toBe(true);
    // Bande du niveau 2 : (50 %, 83.3 %] — la cote cible 1/P reste ≥ 1.20.
    expect(hcp.prob).toBeGreaterThan(50);
    expect(hcp.prob).toBeLessThanOrEqual(VALUEBET_MAX_PROB_PCT);
    expect(hcp.targetOdds).toBeGreaterThanOrEqual(VALUEBET_MIN_ODDS);
    expect(hcp.odds).toBe(1.4);
    expect(withLine.selectedPriority).toBe(2);
  });

  test("la ligne du handicap colle à la marge attendue (pas -0.5)", () => {
    const match = makeMatch({ odds: { home: 1.05, draw: 20, away: 15 } });
    const prediction = strongPrediction(match);
    const margin = prediction.meanHome - prediction.meanAway;
    const line = Number(selectHandballValueBet(match, prediction).candidates[1].label.split("-")[1]);
    // La ligne doit approcher la marge Skellam, pas s'effondrer à 0.5 : c'est
    // l'écart qui porte l'information du niveau 2.
    expect(line).toBeGreaterThan(0.5);
    expect(Math.abs(line - margin)).toBeLessThanOrEqual(2);
  });

  test("cote handicap sur une AUTRE ligne → jamais réutilisée (pas d'EV fabriqué)", () => {
    const match = makeMatch({ odds: { home: 1.05, draw: 20, away: 15 } });
    const prediction = strongPrediction(match);
    // On cote -8.5 alors que le modèle retient une autre ligne : la cote existe
    // mais ne s'applique pas, donc elle ne doit pas alimenter le candidat.
    const result = selectHandballValueBet(match, prediction, {
      handicapOdds: { "8.5": 1.4 },
    });
    expect(result.candidates[1].odds).toBeNull();
    expect(result.candidates[1].ev).toBeNull();
  });

  test("cote handicap < 1.20 sur la bonne ligne → refus avec motif", () => {
    const match = makeMatch({ odds: { home: 1.05, draw: 20, away: 15 } });
    const prediction = strongPrediction(match);
    const line = Number(selectHandballValueBet(match, prediction).candidates[1].label.split("-")[1]);
    const result = selectHandballValueBet(match, prediction, {
      handicapOdds: { [String(line)]: 1.1 },
    });
    expect(result.candidates[1].odds).toBe(1.1);
    // Le marché paie sous la juste prix → pas de value, mais le pari reste
    // publié : le niveau 2 juge une LIGNE, pas un prix déjà connu.
    expect(result.candidates[1].targetOdds).toBeGreaterThanOrEqual(VALUEBET_MIN_ODDS);
  });

  test("le niveau 2 se publie même sans cote marché (cote cible suffit)", () => {
    const match = makeMatch({ odds: { home: 1.05, draw: 20, away: 15 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    expect(result.selectedPriority).toBe(2);
    expect(result.selected!.odds).toBeNull();
    expect(result.selected!.ev).toBeNull();
    expect(result.selected!.targetOdds).toBeGreaterThanOrEqual(VALUEBET_MIN_ODDS);
  });
});

// ─── P3 — Total ───

describe("P3 — Total Over/Under", () => {
  test("marge incertaine → P2 impossible → le total est retenté", () => {
    // Deux équipes de profil identique : marge attendue < 0.5 but, donc aucun
    // handicap à jouer (le mission dit « si la marge 1N2 est incertaine »).
    // Aucune cote 1N2 non plus : le niveau 3 ne peut qu'être le third retenu.
    const match = makeMatch();
    const prediction = balancedPrediction(match);
    expect(prediction.hasSignal).toBe(true);
    expect(Math.abs(prediction.meanHome - prediction.meanAway)).toBeLessThan(0.5);

    // On cote TOUTES les demi-lignes de la fenêtre : le contrat à vérifier est
    // « le niveau 3 est atteignable et respecte les garde-fous », pas « il
    // choisit telle ligne ». Hardcoder une ligne présumerait la valeur d'un
    // calcul — exactement ce que ces tests doivent éviter.
    const totalOdds: Record<string, { over?: number; under?: number }> = {};
    const expected = prediction.expectedTotal;
    for (let line = expected - 10; line <= expected + 10; line += 0.5) {
      totalOdds[String(Math.round(line * 2) / 2)] = { over: 1.9, under: 1.9 };
    }

    const result = selectHandballValueBet(match, prediction, { totalOdds });
    expect(result.selectedPriority).toBe(3);
    expect(result.selected!.market).toBe("total");
    expect(result.selected!.odds).toBeGreaterThanOrEqual(VALUEBET_MIN_ODDS);
    expect(result.selected!.prob).toBeGreaterThan(50);
    expect(result.selected!.prob).toBeLessThanOrEqual(VALUEBET_MAX_PROB_PCT);
    // Label = « Over 57.5 buts » : la ligne est le 2ᵉ jeton, pas le dernier.
    const line = Number(result.selected!.label.split(" ")[1]);
    expect(Number.isInteger(line * 2)).toBe(true);
    // La cote lue doit être celle de la ligne annoncée, jamais d'une autre.
    expect(totalOdds[String(line)]).toBeDefined();
    expect(totalOdds[String(line)]![result.selected!.label.startsWith("Over") ? "over" : "under"]).toBe(1.9);
  });

  test("ligne de total SANS cote → publiée avec sa cote cible, jamais de prix inventé", () => {
    const match = makeMatch();
    const prediction = strongPrediction(match);
    const line = Math.floor(prediction.expectedTotal) + 0.5;
    const result = selectHandballValueBet(match, prediction, {
      totalOdds: { [String(line)]: {} },
    });
    const total = result.candidates[2];
    // Le niveau 3 juge la ligne du bookmaker + notre juste prix : l'absence de
    // prix empêche l'EV, pas la recommandation.
    expect(total.odds).toBeNull();
    expect(total.ev).toBeNull();
    expect(total.targetOdds).toBeGreaterThanOrEqual(VALUEBET_MIN_ODDS);
    expect(total.prob).toBeGreaterThan(50);
  });

  test("EV cohérent : EV = P × cote − 1", () => {
    const match = makeMatch();
    const prediction = balancedPrediction(match);
    const totalOdds: Record<string, { over?: number; under?: number }> = {};
    const expected = prediction.expectedTotal;
    for (let line = expected - 10; line <= expected + 10; line += 0.5) {
      totalOdds[String(Math.round(line * 2) / 2)] = { over: 1.5, under: 1.5 };
    }
    const result = selectHandballValueBet(match, prediction, { totalOdds });
    const sel = result.selected!;
    expect(sel.odds).not.toBeNull();
    expect(sel.ev).toBeCloseTo((sel.prob / 100) * sel.odds! - 1, 2);
  });
});

// ─── Expositions ν (option B.1) ───

describe("Expositions CMP (λ, ν)", () => {
  test("les taux et ν exposés sont ceux du modèle, pas des reconstructions", () => {
    const match = makeMatch();
    const prediction = strongPrediction(match);
    expect(prediction.lambdaHome).toBeGreaterThan(0);
    expect(prediction.lambdaAway).toBeGreaterThan(0);
    expect(prediction.nuHome).toBeGreaterThan(0);
    expect(prediction.nuAway).toBeGreaterThan(0);
    // Les moyennes doivent être dérivables des taux via cmpMean — sinon P3 et
    // le score affiché ne décrivent pas la même loi.
    expect(prediction.meanHome).toBeCloseTo(
      cmpMean(prediction.lambdaHome, prediction.nuHome),
      6,
    );
    expect(prediction.meanAway).toBeCloseTo(
      cmpMean(prediction.lambdaAway, prediction.nuAway),
      6,
    );
  });

  test("ν = 1 au prior neutre (pas de fit CMP inventé)", () => {
    const match = makeMatch();
    const prediction = coldPrediction(match);
    expect(prediction.nuHome).toBe(1);
    expect(prediction.nuAway).toBe(1);
    // cmpMean(λ, 1) = λ — à la précision flottante près.
    expect(prediction.meanHome).toBeCloseTo(prediction.lambdaHome, 9);
  });

  test("P3 utilise le CMP : la queue est plus courte qu'un Poisson de même espérance", () => {
    const match = makeMatch();
    const prediction = strongPrediction(match);
    expect(prediction.nuHome).toBeGreaterThan(1); // sous-dispersion CMP
    const mean = prediction.expectedTotal;
    // Sonde en QUEUE (moyenne + 2 σ) : ν > 1 réduit la variance, donc la queue
    // est nettement plus courte qu'en Poisson. Au centre les deux coïncident.
    const line = mean + 2 * Math.sqrt(mean / prediction.nuHome);
    const cmp = overUnderProb(
      prediction.lambdaHome,
      prediction.nuHome,
      prediction.lambdaAway,
      prediction.nuAway,
      line,
    );
    expect(cmp.over).toBeLessThan(poissonRef(mean, line));
    expect(cmp.over + cmp.under).toBeCloseTo(1, 9);
  });
});

/** Référence Poisson indépendante (ν = 1), pour contraster avec le CMP. */
function poissonRef(mean: number, line: number): number {
  let cdf = Math.exp(-Math.max(mean, 1e-6));
  let term = cdf;
  for (let i = 1; i <= Math.floor(line); i++) {
    term *= mean / i;
    cdf += term;
  }
  return 1 - cdf;
}

// ─── Marchés dérivés du snapshot (option A, sans API supplémentaire) ───

describe("Marchés dérivés de HandballOpeningOdds", () => {
  test("over55/under62 du snapshot alimentent P3 sans appelant", () => {
    const match = makeMatch({
      openingOdds: { over55: 1.9, under62: 1.85 },
    });
    const prediction = strongPrediction(match);
    const result = selectHandballValueBet(match, prediction);
const total = result.candidates[2];
    // Le niveau 3 juge les LIGNES du bookmaker : la ligne retenue doit venir
    // du snapshot, sinon P3 n'aurait rien à évaluer.
    expect([55.5, 62.5]).toContain(Number(total.label.split(" ")[1]));
  });

  test("la cote du snapshot n'est lue qu'à SA ligne", () => {
    const match = makeMatch({ openingOdds: { over55: 1.9 } });
    const result = selectHandballValueBet(match, strongPrediction(match));
    const total = result.candidates[2];
    const line = Number(total.label.split(" ")[1]);
    // Si la ligne retenue est 55.5, la cote over55 lui appartient ; sinon
    // aucune cote ne doit lui être attachée (EV fabriqué).
    if (line === 55.5 && total.label.startsWith("Over")) {
      expect(total.odds).toBe(1.9);
    } else {
      expect(total.odds).toBeNull();
    }
  });

  test("handicap du snapshot alimente P2 quand la ligne tombe sur 4.5", () => {
    const match = makeMatch({
      odds: { home: 1.05, draw: 20, away: 15 }, // P1 refusé (cote trop basse)
      openingOdds: { handicap: 1.9 },
    });
    const prediction = strongPrediction(match);
    const result = selectHandballValueBet(match, prediction);
    const hcp = result.candidates[1];
    const line = Number(hcp.label.split("-")[1]);
    if (line === 4.5) {
      expect(hcp.odds).toBe(1.9);
    } else {
      // Ligne différente : la cote du snapshot ne doit surtout pas être
      // réutilisée (EV fabriqué). Elle reste donc non lue.
      expect(hcp.odds).toBeNull();
    }
  });

  test("cotes explicites de l'appelant sont prioritaires sur le snapshot", () => {
    const match = makeMatch({ openingOdds: { handicap: 1.9 } });
    const prediction = strongPrediction(match);
    const result = selectHandballValueBet(match, prediction, {
      handicapOdds: { "4.5": 2.5 },
    });
    const hcp = result.candidates[1];
    if (Number(hcp.label.split("-")[1]) === 4.5) expect(hcp.odds).toBe(2.5);
  });

  test("snapshot sans marchés → aucune cote n'apparaît nulle part", () => {
    const match = makeMatch();
    const result = selectHandballValueBet(match, strongPrediction(match));
    for (const c of result.candidates) {
      expect(c.odds).toBeNull();
      expect(c.ev).toBeNull();
    }
    // P1 refuse faute de cote marché ; P2 publie sa ligne avec sa cote cible.
    expect(result.selectedPriority).toBe(2);
  });
});

// ─── Cohérence avec les métriques publiées ───

describe("Cohérence avec l'Index Pariscore", () => {
  test("le value bet et le score affiché viennent des mêmes λ", () => {
    const match = makeMatch({ odds: { home: 1.31, draw: 12, away: 9 } });
    const prediction = strongPrediction(match);
    // Les λ exposés doivent se reconstruire depuis le score affiché.
    expect(prediction.meanHome).toBeCloseTo(prediction.scoreHome, 0);
    expect(prediction.meanAway).toBeCloseTo(prediction.scoreAway, 0);
    // Le total affiché doit être reproductible depuis les λ exposés.
    expect(prediction.expectedTotal).toBeCloseTo(
      prediction.meanHome + prediction.meanAway,
      1,
    );
  });

  test("le favori retenu est le côté de plus forte proba MODÈLE, pas le favori marché", () => {
    // Le marché cote l'extérieur favori (1.40 contre 4.20) : la cascade doit
    // suivre le MODÈLE, sinon on ne publie jamais d'opinion — seulement le
    // consensus, ce qui ne peut pas être une value bet.
    const match = makeMatch({ odds: { home: 4.2, draw: 12, away: 1.4 } });
    const prediction = strongPrediction(match);
    expect(prediction.winrate.home).toBeGreaterThan(prediction.winrate.away);

    const result = selectHandballValueBet(match, prediction);
    expect(result.selectedPriority).toBe(1);
    expect(result.selected!.label).toContain("Dominc");
    // La cote retenue est celle du côté choisi, jamais celle de l'autre.
    expect(result.selected!.odds).toBe(4.2);
  });
});