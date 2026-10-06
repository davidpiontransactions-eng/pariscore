import { describe, expect, test } from "bun:test";
import {
  vitibetPrediction,
  vitibetTip,
} from "../basketball-vitibet-guard";

/**
 * Régression de la garde « Vitibet a-t-il réellement publié une prédiction ? ».
 *
 * Les deux fragments HTML ci-dessous sont des extraits RÉELS capturés le
 * 2026-10-05 depuis vitibet.com (voir .context/RAPPORT-TACHES.md entrée 193).
 *
 * Bug couvert : l'ancienne garde du pipeline était `idxRaw !== 0`. Sur le
 * pop-up NBA, l'Index vaut -10.42 — non nul — alors que les trois cellules de
 * probabilité valent 0%. Le match était donc déclaré « prédit » et un `tip`
 * était dérivé de `0 >= 0` → « 1 ». Un signal de pari sur une source vide.
 */
describe("garde de prédiction Vitibet", () => {
  test("pop-up réel avec prédiction (LBP fixture 524347) : 34 / 3 / 63", () => {
    const html =
      '<div style="font-size: 24px; font-weight: 900;">-10.42</div>' +
      '<div class="prob-header-row">' +
      '<div class="prob-cell">1</div><div class="prob-cell">0</div><div class="prob-cell">2</div>' +
      "</div>" +
      '<div class="prob-val-row">' +
      '<div class="prob-cell-val">34%</div>' +
      '<div class="prob-cell-val">3%</div>' +
      '<div class="prob-cell-val">63%</div>' +
      "</div>";

    const p = vitibetPrediction(html);
    expect(p).not.toBeNull();
    expect(p!.probHome).toBe(34);
    expect(p!.probDraw).toBe(3);
    expect(p!.probAway).toBe(63);
  });

  test("pop-up réel SANS prédiction (NBA fixture 519485) : 0 / 0 / 0", () => {
    const html =
      '<div style="font-size: 24px; font-weight: 900;">-10.42</div>' +
      '<div class="prob-cell-val">0%</div>' +
      '<div class="prob-cell-val">0%</div>' +
      '<div class="prob-cell-val">0%</div>';

    expect(vitibetPrediction(html)).toBeNull();
  });

  test("les définitions CSS .prob-cell-val ne sont pas confondues avec des cellules", () => {
    // Mesuré : 6 occurrences de « prob-cell-val » sur la page, dont 4 dans le
    // <style>. Une regex non ancrée sur <div les capturerait.
    const html =
      ".prob-cell-val { flex: 1; text-align: center; font-size: 16px; }\n" +
      ".prob-cell-val:last-child { border-right: none; }";
    expect(vitibetPrediction(html)).toBeNull();
  });

  test("moins de 3 cellules → pas de prédiction", () => {
    const html = '<div class="prob-cell-val">60%</div>';
    expect(vitibetPrediction(html)).toBeNull();
  });

  test("tip dérivé seulement si les DEUX probabilités existent", () => {
    expect(vitibetTip(54, 43)).toBe("1");
    expect(vitibetTip(43, 54)).toBe("2");
    // Régression : 0 >= 0 donnait « 1 » — un pari systématique sur du vide.
    expect(vitibetTip(0, 0)).toBeNull();
    expect(vitibetTip(null, 43)).toBeNull();
    expect(vitibetTip(54, null)).toBeNull();
  });
});