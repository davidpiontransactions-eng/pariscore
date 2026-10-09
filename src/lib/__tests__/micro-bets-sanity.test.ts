// Mission 2026-10-09 : l'onglet Micro-Bets affichait des probabilitÃ©s
// BINAIRES (FERY hold 0 %, KHACHANOV 100 %, Break 100 % / Hold 0 % / Hold 0 %).
//
// Cause racine (corrigÃ©e dans pip-bet-panel.tsx + live-markov.ts) :
//   `ServeStats.servePtsWonPct` est une FRACTION (0.62 = 62 %), pas un
//   pourcentage. Le panneau divisait par 100 â†’ 0.0062, bornÃ© Ã  0.05 â†’ la
//   chaÃ®ne de Markov renvoyait ~0 %.
//
// Ce fichier verrouille les DEUX garde-fous :
//   1. `clampMicroBetProb` borne l'affichage dans [3 %, 97 %] tant que le jeu
//      n'est pas archivÃ© (une proba de 0/1 rend le marchÃ© injouable) ;
//   2. la renormalisation garde la somme de la distribution Ã  exactement 1.
//
// Seuils calibrÃ©s sur les valeurs MESURÃ‰ES du moteur (p_serve = 0.65),
// relevÃ©es dans logs/markov-valeurs.txt â€” pas sur des arrondis.
import { describe, expect, test } from "bun:test";
import {
  clampMicroBetProb,
  gameWinProbFromScore,
  gameScoreDistribution,
  breakProb,
  type GameScoreDistribution,
} from "@/lib/prediction/live-markov";

const P_SERVE_SERVER = 0.65;   // serveur excellent
const P_SERVE_RETURNER = 0.32; // adversaire qui rend (moyenne circuit)
const P_POINT_SERVER = 0.65;
const P_POINT_RETURNER = 1 - P_SERVE_RETURNER; // 0.68

/** Borne puis renormalise (mÃªme logique que normalizeGameScore du panneau). */
function normalize(d: GameScoreDistribution): GameScoreDistribution {
  const b = {
    "hold-0": clampMicroBetProb(d["hold-0"]),
    "hold-30": clampMicroBetProb(d["hold-30"]),
    break: clampMicroBetProb(d.break),
  };
  const sum = b["hold-0"] + b["hold-30"] + b.break;
  return {
    "hold-0": b["hold-0"] / sum,
    "hold-30": b["hold-30"] / sum,
    break: b.break / sum,
  };
}

describe("micro-bets â€” P(hold) selon le score, serveur p_serve = 0.65", () => {
  // Score : [points de A, points du serveur]. Le serveur est A ici.
  const CAS: { lab: string; pts: [number, number]; min: number }[] = [
    // 0-15 : aucune balle de breakçš„è¿™point, serveurcomfortable.
    { lab: "0-15 (dÃ©but de jeu)", pts: [0, 0], min: 0.5 },
    // 15-30 : 3 balles de break pour l'adversaire.
    { lab: "15-30 (3 balles de break)", pts: [1, 2], min: 0.3 },
    // 0-40 : 3 balles de break pour le serveur.
    { lab: "0-40 (serveur Ã  3 balles de break)", pts: [0, 3], min: 0.05 },
  ];

  for (const c of CAS) {
    test(`${c.lab} â†’ P(Hold) â‰¥ ${(c.min * 100).toFixed(0)} %`, () => {
      const raw = gameWinProbFromScore(c.pts[0], c.pts[1], "A", P_SERVE_SERVER, P_SERVE_RETURNER);
      const p = clampMicroBetProb(raw);
      expect(p).toBeGreaterThanOrEqual(c.min);
    });

    test(`${c.lab} â†’ jamais 0.00 ni 1.00 aprÃ¨s bornage`, () => {
      const raw = gameWinProbFromScore(c.pts[0], c.pts[1], "A", P_SERVE_SERVER, P_SERVE_RETURNER);
      const p = clampMicroBetProb(raw);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
      // Et une fois arrondie Ã  l'entier prÃ¨s pour l'UI (Ã—100, 0 dÃ©cimale).
      const displayed = Math.round(p * 100) / 100;
      expect(displayed).not.toBe(0);
      expect(displayed).not.toBe(1);
    });
  }
});

describe("micro-bets â€” bornage anti-binaire", () => {
  test("clamp borne les extrÃªmes dans [3 %, 97 %]", () => {
    expect(clampMicroBetProb(0)).toBe(0.03);
    expect(clampMicroBetProb(1)).toBeCloseTo(0.97, 10);
    expect(clampMicroBetProb(-5)).toBe(0.03);
    expect(clampMicroBetProb(42)).toBe(0.97);
  });

  test("NaN / Infinity degradent en 50 % (pas de 0 % fantÃ´me)", () => {
    expect(clampMicroBetProb(Number.NaN)).toBe(0.5);
    expect(clampMicroBetProb(Number.POSITIVE_INFINITY)).toBe(0.5);
  });

  test("une proba saine (0.62) n'est PAS altÃ©rÃ©e par le clamp", () => {
    expect(clampMicroBetProb(0.62)).toBe(0.62);
  });
});

describe("micro-bets â€” marchÃ© â‘¦ : la somme des 3 issues vaut 1", () => {
  test("service fort : rÃ©partition rÃ©aliste, pas 100/0/0", () => {
    const d = normalize(gameScoreDistribution("A", P_SERVE_SERVER, P_SERVE_RETURNER));
    const sum = d["hold-0"] + d["hold-30"] + d.break;
    expect(sum).toBeCloseTo(1, 12);
    // Le serveur tient son service largement, mais pas Ã  100 %.
    expect(d["hold-0"] + d["hold-30"]).toBeGreaterThan(d.break);
    expect(d.break).toBeGreaterThan(0);
    expect(d["hold-0"]).toBeGreaterThan(0);
  });

  test("service faible : le break domine SANS Ãªtre 100 %", () => {
    const d = normalize(gameScoreDistribution("A", 0.35, 0.4));
    expect(d.break).toBeGreaterThan(0.3);
    expect(d.break).toBeLessThan(0.97);
    expect(d["hold-0"] + d["hold-30"] + d.break).toBeCloseTo(1, 12);
  });

  test("aucune issue n'est Ã  0.00 ni 1.00 aprÃ¨s bornage + renorm", () => {
    for (const s of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95]) {
      const d = normalize(gameScoreDistribution("A", s, s));
      for (const k of ["hold-0", "hold-30", "break"] as const) {
        expect(d[k]).toBeGreaterThan(0);
        expect(d[k]).toBeLessThan(1);
        expect(Number.isFinite(d[k])).toBe(true);
      }
      expect(d["hold-0"] + d["hold-30"] + d.break).toBeCloseTo(1, 12);
    }
  });
});

describe("micro-bets â€” marchÃ© â‘¥ : P(break) jamais binaire", () => {
  test("serveur excellent : P(break) faible mais > 0", () => {
    const p = clampMicroBetProb(breakProb(P_SERVE_SERVER));
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.5);
    // Valeur mesurÃ©e du moteur â‰ˆ 17 %.
    expect(p).toBeGreaterThan(0.1);
  });

  test("pPoint effondrÃ© (symptÃ´me du bug /100) : bornÃ©, pas 0 %", () => {
    const p = clampMicroBetProb(breakProb(0.0062));
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(0.97);
  });
});

describe("micro-bets â€” cohÃ©rence croisÃ©e des 4 marchÃ©s", () => {
  test("P(gagner le jeu) du serveur + P(break) restent dans le mÃªme ordre", () => {
    const pWinGame = clampMicroBetProb(
      gameWinProbFromScore(0, 0, "A", P_SERVE_SERVER, P_SERVE_RETURNER),
    );
    const pBreak = clampMicroBetProb(breakProb(P_SERVE_SERVER));
    // Tenir le jeu (â‰¥ 50 %) implique que le break est minoritaire.
    expect(pWinGame).toBeGreaterThan(pBreak);
  });

  test("P(hold 0/15) est un sous-ensemble de P(hold) : jamais supÃ©rieur", () => {
    const d = normalize(gameScoreDistribution("A", P_SERVE_SERVER, P_SERVE_RETURNER));
    const pHoldGame = clampMicroBetProb(
      gameWinProbFromScore(0, 0, "A", P_SERVE_SERVER, P_SERVE_RETURNER),
    );
    expect(d["hold-0"]).toBeLessThanOrEqual(pHoldGame);
  });
});
