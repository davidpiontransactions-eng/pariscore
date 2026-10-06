import { describe, expect, test } from "bun:test";
import {
  FIBA_PREDICTIONS_AVAILABLE,
  FIBA_PREDICTIONS_UNAVAILABLE_REASON,
  predictMatch,
} from "../predictions/fiba-predictions";
import { detectValueBets, scanAllValueBets } from "../predictions/fiba-value-bets";
import { runBacktest, getBacktestDetails } from "../predictions/fiba-backtest";

/**
 * Ces tests verrouillent la neutralisation de la couche prédictive FIBA.
 *
 * Régression couverte : la couche affichait, depuis `fiba-game-card.tsx` et
 * `fiba-scoreboard.tsx`, des probabilités, un edge, une confiance, une cascade
 * SHAP, des value bets (EV + Kelly) et un backtest (précision, Brier, ROI) —
 * tous dérivés de poids XGBoost écrits à la main, d'un dictionnaire de
 * classements arbitraire et de 24 matchs codés en dur.
 *
 * Le test échoue dès qu'un de ces chiffres redevient productible sans
 * historique FIBA mesuré.
 */
describe("intégrité couche prédictive FIBA", () => {
  test("le contrat déclare la couche non calibrée, avec une raison", () => {
    expect(FIBA_PREDICTIONS_AVAILABLE).toBe(false);
    expect(FIBA_PREDICTIONS_UNAVAILABLE_REASON.length).toBeGreaterThan(20);
  });

  test("predictMatch ne produit aucune probabilité", () => {
    const p = predictMatch({ homeTeam: "USA", awayTeam: "ESP", isHome: true });
    // null et non 0.5 : une probabilité de 0.5 se lit comme une mesure.
    expect(p).toBeNull();
  });

  test("aucune value bet ni EV/Kelly depuis des cotes de démonstration", () => {
    expect(scanAllValueBets()).toEqual([]);
    expect(
      detectValueBets("x", "USA", "ESP", {
        homeOdds: 1.05,
        awayOdds: 11,
        source: "Mock Bookmaker",
        timestamp: "2026-09-04T10:00:00Z",
      }),
    ).toBeNull();
  });

  test("le backtest est marqué indisponible, pas zéro", () => {
    const s = runBacktest();
    expect(s.available).toBe(false);
    expect(s.reason).toBe(FIBA_PREDICTIONS_UNAVAILABLE_REASON);
    expect(s.totalMatches).toBe(0);
    // Ces zéros doivent être masqués par le composant : un Brier à 0.000
    // affiché serait lu comme un modèle parfait.
    expect(s.avgBrierScore).toBe(0);
    expect(s.roi).toBe(0);
    expect(getBacktestDetails()).toEqual([]);
  });
});