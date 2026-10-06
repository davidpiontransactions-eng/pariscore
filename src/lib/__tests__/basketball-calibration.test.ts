import { describe, expect, test } from "bun:test";
import {
  BASKET_LEAGUE_CALIBRATION,
  basketCalibration,
} from "../basketball-calibration";

describe("basketball-calibration", () => {
  test("les lignes de total sont MESURÉES et distinctes par ligue", () => {
    // Régression : le backtest utilisait 215.5 (constante NBA) pour TOUTES les
    // ligues. Sur l'EuroLeague (médiane 165) cette ligne est inatteignable,
    // donc 0 pari ; sur la NBA elle est sous la médiane (227) donc ~70 % de
    // victoires par construction — un ROI vert fabriqué.
    const lines = Object.values(BASKET_LEAGUE_CALIBRATION).map((c) => c.totalLine);
    expect(new Set(lines).size).toBeGreaterThan(1);

    // Toute ligne doit être plausible pour sa ligue : la NBA est la seule des
    // quatre à dépasser 200 points (48 min à ~100 possessions).
    expect(BASKET_LEAGUE_CALIBRATION.NBA.totalLine).toBeGreaterThan(200);
    expect(BASKET_LEAGUE_CALIBRATION.EuroLeague.totalLine).toBeLessThan(200);
  });

  test("chaque calibration porte un échantillon mesuré", () => {
    for (const [league, c] of Object.entries(BASKET_LEAGUE_CALIBRATION)) {
      expect(c.sampleSize, `${league} sans échantillon`).toBeGreaterThan(100);
      expect(c.sdTotal, `${league} σ total`).toBeGreaterThan(0);
      expect(c.sdMargin, `${league} σ marge`).toBeGreaterThan(0);
      expect(c.homeWinRate).toBeGreaterThan(0.5); // avantage terrain réel
      expect(c.homeWinRate).toBeLessThan(1);
    }
  });

  test("une ligue sans base mesurée n'est jamais extrapolée", () => {
    // 27 ligues du catalogue n'ont aucune calibration : le backtest doit
    // pouvoir renvoyer predictions_available=false plutôt qu'une ligne
    // empruntée à la NBA.
    expect(basketCalibration("LNB")).toBeNull();
    expect(basketCalibration("CBA")).toBeNull();
    expect(basketCalibration("NCAA")).toBeNull();
    expect(basketCalibration("NBA")).not.toBeNull();
  });
});