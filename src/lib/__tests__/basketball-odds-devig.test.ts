// Tests régression de-vig moneyline basketball — boucle rouge du debug 2026-09-23
// Bug : condition `ml > 0` exclut le favori américain négatif → implied null, Value Bet mort

import { describe, test, expect } from "bun:test";
import { devigMl } from "../basketball-odds";

describe("devigMl", () => {
  test("favori négatif + outsider positif → probabilités non nulles", () => {
    const r = devigMl(-150, 130);
    expect(r).not.toBeNull();
    expect(r!.impliedHome).toBeGreaterThan(50);
    expect(r!.impliedAway).toBeLessThan(50);
    expect(r!.impliedHome + r!.impliedAway).toBeCloseTo(100, 1);
    expect(r!.margin).toBeGreaterThan(0);
  });

  test("outsider positif à domicile + favori négatif extérieur", () => {
    const r = devigMl(130, -150);
    expect(r).not.toBeNull();
    expect(r!.impliedAway).toBeGreaterThan(r!.impliedHome);
    expect(r!.impliedHome + r!.impliedAway).toBeCloseTo(100, 1);
  });

  test("deux négatifs équilibrés (-110/-110) → ~50/50, marge vig positive", () => {
    const r = devigMl(-110, -110);
    expect(r).not.toBeNull();
    expect(r!.impliedHome).toBeCloseTo(50, 0);
    expect(r!.impliedHome + r!.impliedAway).toBeCloseTo(100, 1);
    expect(r!.margin).toBeGreaterThan(0);
  });

  test("nul ou manquant → null", () => {
    expect(devigMl(null, 130)).toBeNull();
    expect(devigMl(-150, null)).toBeNull();
    expect(devigMl(0, 130)).toBeNull();
  });
});
