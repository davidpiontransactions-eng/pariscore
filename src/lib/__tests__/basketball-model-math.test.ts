import { describe, expect, test } from "bun:test";

/**
 * Verrou maths du moteur basket (services/basketballService.js).
 *
 * Ce fichier CommonJS est chargé via `require` — on le charge par chemin pour
 * éviter de le transformer en module ESM (le serveur legacy `server.js:46`
 * fait déjà `require('./services/basketballService')`).
 *
 * Chaque test échoue sur un bug RÉEL documenté, pas sur une implémentation.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const t = require("../../../services/basketballService.js") as {
  _ffAdvantage: (d: { dEfg?: number; dTov?: number; dOrb?: number; dFt?: number }) => number;
  _totalExpected: (pfH: number, paH: number, pfA: number, paA: number, leagueAvg: number) => number;
  _winProbDiff: (source: string, rH: number, rA: number, hcaElo: number) => number;
  FF_WEIGHTS: Record<string, number>;
  FF_WEIGHTS_RAW: Record<string, number>;
};

const HCA_PTS = 3.2;
const PTS_PER_ELO = 28;
const ELO_DIV = 400;
const HCA_ELO = (HCA_PTS / PTS_PER_ELO) * ELO_DIV;

describe("moteur basket — biais corrigés", () => {
  test("Four Factors : les poids effectifs somment à 1.0", () => {
    // Les poids publiés (71+11+9+8) somment à 99. Ils sont normalisés par leur
    // somme, donc l'invariant tient quelle que soit l'édition future des poids.
    const sum = Object.values(t.FF_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  test("Four Factors : la normalisation préserve les proportions publiées 71:11:9:8", () => {
    const raw = t.FF_WEIGHTS_RAW;
    const norm = t.FF_WEIGHTS;
    const ratio = (k: string) => (norm[k] / raw[k]);
    for (const k of Object.keys(raw)) {
      expect(ratio(k), `proportion ${k}`).toBeCloseTo(1 / 0.99, 10);
    }
  });

  test("Four Factors : un différentiel reçoit SON poids, pas le double", () => {
    // Régression : scoreH/scoreA écrits à la main avec `+0.11*tovDiff` et
    // `-0.11*tovDiff` → le différentiel effectif pesait 2× le poids déclaré
    // (somme 1.19). Écrit une seule fois, le poids effectif EST celui déclaré.
    const w = t.FF_WEIGHTS;
    expect(t._ffAdvantage({ dEfg: 10 })).toBeCloseTo(w.efg * 10, 10);
    expect(t._ffAdvantage({ dTov: 10 })).toBeCloseTo(w.tov * 10, 10);
    expect(t._ffAdvantage({ dOrb: 10 })).toBeCloseTo(w.orb * 10, 10);
    expect(t._ffAdvantage({ dFt: 10 })).toBeCloseTo(w.ft * 10, 10);

    // Somme des poids effectifs, mesurée via le code = 1.0 (pas 1.19).
    const effective =
      t._ffAdvantage({ dEfg: 1 }) + t._ffAdvantage({ dTov: 1 }) +
      t._ffAdvantage({ dOrb: 1 }) + t._ffAdvantage({ dFt: 1 });
    expect(effective).toBeCloseTo(1.0, 10);
  });

  test("Four Factors : TOV signé (moins de pertes de balle = avantage)", () => {
    // L'ancien code inversait le signe une fois pour le domicile et une fois
    // pour l'extérieur.Ici le différentiel est unique et déjà signé.
    expect(t._ffAdvantage({ dTov: 5 })).toBeGreaterThan(0);
    expect(t._ffAdvantage({ dTov: -5 })).toBeLessThan(0);
  });

  test("total attendu : aucun terme HCA (le total est une quantité jointe)", () => {
    // Régression : `+HCA_PTS*0.3` (≈ +0.96 pt) était ajouté à chaque total alors
    // que la ligne du book embarque déjà le terrain → biais permanent vers OVER.
    const pfH = 115, paH = 110, pfA = 112, paA = 114, LA = 113.5;
    const expected = t._totalExpected(pfH, paH, pfA, paA, LA);
    const naive = (pfH * paA) / LA + (pfA * paH) / LA;
    expect(expected).toBeCloseTo(naive, 1);
    // L'écart avec l'ancienne formule est d'environ 1 pt : c'est exactement
    // le biais OVER supprimé, donc l'assertion doit le voir.
    expect(Math.abs(expected - (naive + HCA_PTS * 0.3))).toBeGreaterThan(0.5);
  });

  test("HCA : appliqué au replay Elo, PAS au proxy records", () => {
    // Le replay Elo (refresh_nba_elo.js:116-118) applique un delta symétrique :
    // les ratings sont neutres quant au terrain → le HCA doit être réinjecté,
    // sinon les équipes à domicile seraient sous-cotées.
    expect(t._winProbDiff("elo_game_by_game", 1500, 1500, HCA_ELO)).toBeCloseTo(HCA_ELO, 6);
    // Le proxy records lit déjà le bilan domicile/extérieur : l'ajouter serait
    // un double compte.
    expect(t._winProbDiff("records_proxy", 1500, 1500, HCA_ELO)).toBe(0);
  });
});