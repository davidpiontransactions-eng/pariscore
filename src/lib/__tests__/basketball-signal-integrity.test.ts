import { describe, expect, test } from "bun:test";

/**
 * Verrous P4 — intégrité du signal financier.
 *
 * Deux défauts corrigés, un par bloc :
 *
 *  1. SIDE/STAKE : le côté était retenu par l'EV (calculé SUR LE BLEND) et la
 *     fraction Kelly calculée sur `adjusted` (Elo + blessures + repos). Deux
 *     modèles pour un seul pari — la mise mesurait la confiance du modèle qui
 *     n'avait PAS choisi le pari.
 *
 *  2. TOP BETS : le filtre était `ev_home != null`, c'est-à-dire la PRÉSENCE
 *     du champ. Un favori coté 1.05 a edge = +2 pp et EV = −2,7 % : publié
 *     comme recommandation à espérance négative.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const svc = require("../../../services/basketballService.js") as {
  _kellySelection: (
    value: { ev_home?: number | null; ev_away?: number | null },
    blend: { p_home: number; p_away: number } | null,
  ) => { useHome: boolean; prob: number; ev: number | null; model: string } | null;
  computeNbaKelly: (
    modelProb: number | null,
    decimalOdds: number | null,
  ) => { fraction: number; capped: number; note?: string } | null;
  computeNbaTopBets: (
    matches: unknown[],
    topN?: number,
  ) => Array<{ market: string; selection: string; edge_pp: number; ev?: number; basis?: string }>;
};

const t = svc;

describe("P4 — cohérence side/stake Kelly", () => {
  const blend = { p_home: 62, p_away: 38 };

  test("le côté vient de l'EV, la proba DU MÊME blend", () => {
    // EV domicile supérieur → côté domicile ET proba = blend.p_home.
    const sel = t._kellySelection({ ev_home: 4.1, ev_away: -1.2 }, blend)!;
    expect(sel.useHome).toBe(true);
    expect(sel.prob).toBe(blend.p_home);
    expect(sel.ev).toBe(4.1);
    expect(sel.model).toBe("blend");
  });

  test("côté extérieur : proba = blend.p_away, jamais le domicile", () => {
    const sel = t._kellySelection({ ev_home: -2, ev_away: 3.5 }, blend)!;
    expect(sel.useHome).toBe(false);
    expect(sel.prob).toBe(blend.p_away);
  });

  test("régression : la proba ne peut PAS venir d'un autre modèle", () => {
    // L'ancien code lisait `adjusted.p_home`. On le simule en passant un blend
    // qui diffère de 100 − blend : si la proba revenait depuis une autre
    // source, ce test casserait. Ici on prouve que la valeur retournée est
    // EXACTEMENT celle du blend fourni.
    const b2 = { p_home: 41.3, p_away: 58.7 };
    const sel = t._kellySelection({ ev_home: 0.5, ev_away: 0.1 }, b2)!;
    expect(sel.prob).toBe(41.3);
    expect(sel.prob).toBe(b2.p_home);
  });

  test("sans blend ⇒ null (pas de retour silencieux vers adjusted)", () => {
    // C'est le cœur du fix : l'ancien code tombait sur `adjusted` quand blend
    // était absent. Maintenant on refuse — sans blend, il n'y a pas d'EV.
    expect(t._kellySelection({ ev_home: 4 }, null)).toBeNull();
    expect(t._kellySelection({}, blend)).toBeNull();
    expect(t._kellySelection({ ev_home: null, ev_away: null }, blend)).toBeNull();
    expect(t._kellySelection(null as never, blend)).toBeNull();
  });

  test("EV négatif des deux côtés ⇒ refus de mise", () => {
    // Deux côtés à EV < 0 : aucun n'est « le moins mauvais » à parier.
    const sel = t._kellySelection({ ev_home: -1.5, ev_away: -0.4 }, blend);
    expect(sel).not.toBeNull(); // side choisi quand même (max)
    // Mais la fraction doit être 0 via computeNbaKelly — voir ci-dessous.
    const k = t.computeNbaKelly(blend.p_home, 1.05);
    expect(k!.fraction).toBe(0);
  });
});

describe("P4 — top bets : EV strictement positif", () => {
  const mk = (edge: number, ev: number) => ({
    id: "m1",
    home: { name: "Alpha" },
    away: { name: "Beta" },
    predictions: { value: { edge_home: edge, ev_home: ev, edge_away: null, ev_away: null } },
  });

  test("EV négative + edge > 1.5 ⇒ PUBLIÉ avant, EXCLU après", () => {
    // Le cas exact de la régression : edge = +2.1 pp (modèle plus optimiste
    // que la cote devigée) mais EV = −2.7 % (la cote brute ne paie pas le
    // risque). Avant le fix, ce pari sortait en Top Bet.
    const cands = t.computeNbaTopBets([mk(2.1, -2.7)]);
    const ml = cands.filter((c) => c.market === "Moneyline");
    expect(ml, "un pari à EV négative ne doit pas figurer en Top Bet").toHaveLength(0);
  });

  test("EV positive + edge > 1.5 ⇒ conservé", () => {
    const cands = t.computeNbaTopBets([mk(2.1, 3.4)]);
    const ml = cands.filter((c) => c.market === "Moneyline");
    expect(ml).toHaveLength(1);
    expect(ml[0].ev).toBe(3.4);
    expect(ml[0].edge_pp).toBe(2.1);
  });

  test("EV positive mais edge faible ⇒ exclu (pas de recommandation molle)", () => {
    const cands = t.computeNbaTopBets([mk(0.4, 1.1)]);
    expect(cands.filter((c) => c.market === "Moneyline")).toHaveLength(0);
  });

  test("EV à zéro ⇒ exclu (strictement positif exigé)", () => {
    expect(t.computeNbaTopBets([mk(3, 0)]).filter((c) => c.market === "Moneyline")).toHaveLength(0);
  });

  test("côté extérieur filtré par la même règle", () => {
    const cands = t.computeNbaTopBets([
      {
        id: "m2",
        home: { name: "Alpha" },
        away: { name: "Beta" },
        predictions: { value: { edge_home: null, ev_home: null, edge_away: 2.4, ev_away: -1.1 } },
      },
    ]);
    expect(cands.filter((c) => c.market === "Moneyline")).toHaveLength(0);
  });
});
