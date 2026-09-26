// Sanity du modèle prédictif 1xBet MMA (bead ParisScorebis-pzru) :
// de-vig 1X2, edge modèle vs cotes, Kelly fractional.
import { describe, expect, test } from "bun:test";
import {
  devigMoneyline,
  modelEdge,
  kellyForSide,
} from "@/lib/prediction/mma/moneyline";

describe("devigMoneyline", () => {
  test("2 voies équilibrées → 50/50, marge 0", () => {
    const r = devigMoneyline(2.0, null, 2.0)!;
    expect(r.fair1).toBeCloseTo(0.5, 6);
    expect(r.fair2).toBeCloseTo(0.5, 6);
    expect(r.fairX).toBe(0);
    expect(r.margin).toBeCloseTo(0, 6);
  });

  test("3 voies : la marge somme les inverses de cotes", () => {
    // 1/2 + 1/5 + 1/2 = 1.2 → marge 0.2 ; parts : 0.5/1.2, 0.2/1.2, 0.5/1.2
    const r = devigMoneyline(2.0, 5.0, 2.0)!;
    expect(r.fair1).toBeCloseTo(0.5 / 1.2, 6);
    expect(r.fairX).toBeCloseTo(0.2 / 1.2, 6);
    expect(r.fair2).toBeCloseTo(0.5 / 1.2, 6);
    expect(r.margin).toBeCloseTo(0.2, 6);
    expect(r.fair1 + r.fairX + r.fair2).toBeCloseTo(1, 6);
  });

  test("favori dévigé : la proba suit l'inverse de cote", () => {
    // 1/1.5=0.6667 vs 1/2.6=0.3846 → sum 1.0513 → fair1 ≈ 0.634
    const r = devigMoneyline(1.5, null, 2.6)!;
    expect(r.fair1).toBeGreaterThan(0.6);
    expect(r.fair1 + r.fair2).toBeCloseTo(1, 6);
  });

  test("cotes invalides → null", () => {
    expect(devigMoneyline(1.0, null, 2.0)).toBeNull();
    expect(devigMoneyline(2.0, null, 0.9)).toBeNull();
    expect(devigMoneyline(0, null, 2.0)).toBeNull();
  });
});

describe("modelEdge", () => {
  test("modèle > marché → edge positif sur V1", () => {
    // p=0.6, cote 1.80 → 0.6×0.8 − 0.4 = +0.08
    const e = modelEdge(0.6, 1.8, null, 2.1)!;
    expect(e.edge1).toBeCloseTo(0.08, 6);
    expect(e.edge2).toBeCloseTo(0.4 * 1.1 - 0.6, 6);
    expect(e.best?.side).toBe(1);
    expect(e.best?.edge).toBeCloseTo(0.08, 6);
  });

  test("aucun value → best null", () => {
    const e = modelEdge(0.5, 1.9, null, 2.0)!;
    expect(e.best).toBeNull();
    expect(e.edge1).toBeLessThan(0);
  });

  test("nul présenté mais hors calcul : edge identique avec/sans ox valide", () => {
    const avec = modelEdge(0.55, 1.9, 12.0, 2.0)!;
    const sans = modelEdge(0.55, 1.9, null, 2.0)!;
    expect(avec.edge1).toBeCloseTo(sans.edge1, 9);
  });

  test("ox invalide (≤1) → null (cote non exploitable)", () => {
    expect(modelEdge(0.5, 1.9, 0.5, 2.0)).toBeNull();
  });

  test("ps hors bornes est clampé", () => {
    const e = modelEdge(1.5, 1.9, null, 2.0)!;
    // clamp à 1 → edge1 = 1×0.9 − 0 = 0.9
    expect(e.edge1).toBeCloseTo(0.9, 6);
  });
});

describe("kellyForSide", () => {
  test("Kelly classique : p=0.6 cote 2.0 → 20 %", () => {
    const k = kellyForSide(0.6, 1, 2.0);
    expect(k.pct).toBeCloseTo(20, 6);
    expect(k.capped).toBe(false);
  });

  test("cap fractional 25 %", () => {
    const k = kellyForSide(0.9, 1, 3.0);
    expect(k.pct).toBe(25);
    expect(k.capped).toBe(true);
  });

  test("pas d'edge → 0 %", () => {
    expect(kellyForSide(0.4, 1, 1.5).pct).toBe(0);
  });

  test("côté B : proba inversée", () => {
    // side 2 → p = 1 − 0.6 = 0.4, cote 3.0 → (0.4×2 − 0.6)/2 = 0.1
    const k = kellyForSide(0.6, 2, 3.0);
    expect(k.pct).toBeCloseTo(10, 6);
  });
});
