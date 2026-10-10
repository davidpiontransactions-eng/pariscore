import { describe, expect, test } from "bun:test";
import { computeValueEdge, impliedPercent, toPercent } from "../prediction/value-edge";

/**
 * Contrat d'échelle du Value Edge.
 *
 * Ces tests verrouillent l'artefact que le module existe pour empêcher : une
 * probabilité de fraction [0, 1] multipliée par 100 alors qu'elle ne l'était pas
 * déjà — d'où un badge « 6900 pts », le défaut que la mission a signalé.
 */

describe("toPercent — normalisation d'échelle", () => {
  test("fraction [0,1] → pourcentage", () => {
    expect(toPercent(0.69)).toBe(69);
    expect(toPercent(0.025)).toBe(3); // arrondi au plus proche, comme l'affichage
    expect(toPercent(0)).toBe(0);
    expect(toPercent(1)).toBe(100);
  });

  test("une valeur DÉJÀ en pourcentage n'est pas re-multipliée", () => {
    // C'est l'artefact central : 69 (pourcent) × 100 = 6900.
    expect(toPercent(69)).toBe(69);
    expect(toPercent(87)).toBe(87);
  });

  test("borne les valeurs hors contrat", () => {
    expect(toPercent(-5)).toBe(0);
    expect(toPercent(150)).toBe(100);
    expect(toPercent(Number.NaN)).toBe(0);
  });
});

describe("impliedPercent — probabilité marché", () => {
  test("100 / cote", () => {
    expect(impliedPercent(1.45)).toBe(69); // 68.96 → 69
    expect(impliedPercent(2)).toBe(50);
    expect(impliedPercent(4)).toBe(25);
  });

  test("une cote sous le plancher ne devient pas une probabilité", () => {
    // 1/0.5 = 200 % : hors contrat. On ramène à 0 plutôt que d'inventer.
    expect(impliedPercent(0.5)).toBe(0);
    expect(impliedPercent(0)).toBe(0);
    expect(impliedPercent(Number.NaN)).toBe(0);
  });
});

describe("computeValueEdge — écart en points", () => {
  test("fraction modèle + cote marché → écart cohérent", () => {
    const r = computeValueEdge(0.69, 1.9);
    // 69 % modèle, 100/1.9 = 52.6 → 53 % marché, écart +16
    expect(r.modelPct).toBe(69);
    expect(r.marketPct).toBe(53);
    expect(r.edgePts).toBe(16);
    expect(r.meaningful).toBe(true);
  });

  test("l'écart est TOUJOURS dans [-100, +100], quelle que soit l'échelle reçue", () => {
    // L'invariant qui interdit le « 6900 pts ».
    for (const model of [0, 0.02, 0.5, 0.98, 1, 69, 100, 150]) {
      for (const odd of [1.01, 1.5, 2, 4, 10]) {
        const r = computeValueEdge(model, odd);
        expect(r.edgePts).not.toBeNull();
        expect(Math.abs(r.edgePts!)).toBeLessThanOrEqual(100);
        expect(r.modelPct).toBeGreaterThanOrEqual(0);
        expect(r.modelPct).toBeLessThanOrEqual(100);
      }
    }
  });

  test("pas de cote marché → pas d'écart, mais le modèle reste affiché", () => {
    // On ne fabrique pas de référence pour comparer : un écart contre un
    // marché inexistant serait un nombre inventé.
    for (const missing of [null, undefined]) {
      const r = computeValueEdge(0.72, missing);
      expect(r.modelPct).toBe(72);
      expect(r.marketPct).toBeNull();
      expect(r.edgePts).toBeNull();
      expect(r.meaningful).toBe(false);
    }
  });

  test("un petit écart est filtré comme bruit", () => {
    // 60 % modèle contre 100/1.7 = 59 % marché → +1 pt : arrondi, pas opportunité.
    const r = computeValueEdge(0.6, 1.7, 3);
    expect(r.edgePts).toBe(1);
    expect(r.meaningful).toBe(false);
  });

  test("l'écart suit le signe du sous-cote", () => {
    const favorite = computeValueEdge(0.75, 1.3); // modèle 75, marché 77
    expect(favorite.edgePts).toBeLessThan(0);
    const outsider = computeValueEdge(0.3, 1.3); // modèle 30, marché 77
    expect(outsider.edgePts).toBeLessThan(0);
  });

  test("modèle et marché identiques → écart nul", () => {
    const r = computeValueEdge(0.5, 2); // 50 % contre 50 %
    expect(r.edgePts).toBe(0);
    expect(r.meaningful).toBe(false);
  });
});