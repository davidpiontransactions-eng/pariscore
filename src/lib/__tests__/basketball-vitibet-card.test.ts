import { describe, expect, test } from "bun:test";
import { vitibetCardSignals, hasVitibetSignals } from "@/components/basketball/basketball-match-card";

/**
 * Décide de ce que la carte affiche comme signaux 1xBet.
 *
 * Régression couverte : une carte dont la source n'a rien publié ne doit
 * afficher AUCUN signal — ni score prédit, ni index, ni confrontations. Un
 * « — » ou un `0` se lit comme une mesure.
 */
describe("signaux 1xBet sur la carte", () => {
  test("predictionsAvailable false ⇒ aucun signal, même si des champs sont présents", () => {
    // Cas réel : le merge met `predictionsAvailable: false` quand le joint
    // échoue. Si des valeurs traînaient quand même, elles fuiraient à l'écran.
    const s = vitibetCardSignals({
      predictionsAvailable: false,
      predictedScore: "90:83",
      vitibetIndex: 13.72,
      h2hCount: 4,
    });
    expect(s).toEqual({ predictedScore: null, index: null, h2hCount: null });
    expect(hasVitibetSignals(s)).toBe(false);
  });

  test("predictionsAvailable absent (match ESPN) ⇒ aucun signal 1xBet", () => {
    // Les matchs NBA/WNBA n'ont pas ce champ : la carte garde son rendu actuel.
    const s = vitibetCardSignals({});
    expect(hasVitibetSignals(s)).toBe(false);
  });

  test("disponible ⇒ les champs publiés sont rendus", () => {
    // Valeurs réelles du match EuroLeague Paris vs Lyon (dump du 2026-10-05).
    const s = vitibetCardSignals({
      predictionsAvailable: true,
      predictedScore: "90:83",
      vitibetIndex: 13.72,
      h2hCount: 4,
    });
    expect(s.predictedScore).toBe("90:83");
    expect(s.index).toBeCloseTo(13.72, 2);
    expect(s.h2hCount).toBe(4);
    expect(hasVitibetSignals(s)).toBe(true);
  });

  test("0 confrontation n'est pas affiché comme un compte", () => {
    const s = vitibetCardSignals({ predictionsAvailable: true, h2hCount: 0 });
    expect(s.h2hCount).toBeNull();
    expect(hasVitibetSignals(s)).toBe(false);
  });

  test("index négatif rendu tel quel (le signe est porté à l'affichage)", () => {
    const s = vitibetCardSignals({ predictionsAvailable: true, vitibetIndex: -8.49 });
    expect(s.index).toBeCloseTo(-8.49, 2);
  });

  test("un seul champ disponible suffit à faire apparaître le bloc", () => {
    const s = vitibetCardSignals({ predictionsAvailable: true, predictedScore: "90:83" });
    expect(hasVitibetSignals(s)).toBe(true);
  });
});