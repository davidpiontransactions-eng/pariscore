import { describe, expect, test } from "bun:test";
import {
  sanitizeBasketballPrediction,
  basketballImageUrl,
  type BsdBasketballRawPrediction,
} from "@/lib/api/bzzoiro-client";

/**
 * Garde du filtre de prédiction BSD.
 *
 * Régression couverte : BSD renvoie `prob_over_205/215/225` sur CHAQUE match,
 * y compris EuroCup. Mesuré le 2026-10-05 sur l'event 7160 (Türk Telekom vs
 * Maxima Roma, EuroCup) :
 *
 *   prob_over_205 = 0.0736   prob_over_215 = 0.0246   prob_over_225 = 0.0031
 *
 * alors que le `pregame` de la MÊME source annonce
 * `Game points average (Last 10) = 156 / 165`. Les seuils sont calibrés NBA :
 * sur un match à ~160 points, « Over 215 » à 2,5 % est une aberration. C'est
 * le défaut `Over 215.5` appliqué à l'EuroLeague, déjà corrigé chez nous — on
 * refuse de le racheter chez le fournisseur.
 */
const RAW_EUROCUP: BsdBasketballRawPrediction = {
  prob_home_win: 0.709,
  prob_away_win: 0.291,
  prob_over_205: 0.0736,
  prob_over_215: 0.0246,
  prob_over_225: 0.0031,
  prob_favorite_wins: 0.7918,
  predicted_winner_id: 106,
  predicted_winner_name: "Türk Telekom B.K.",
  confidence: "high",
  confidence_score: 0.79,
  elo_home: 1652.1,
  elo_away: 1500,
  model_version: "catboost-v1 (tier3)",
  is_correct: null,
};

describe("sanitizeBasketballPrediction", () => {
  test("retire les seuils de total NBA, et les déclare", () => {
    const s = sanitizeBasketballPrediction(RAW_EUROCUP)!;
    expect(s).not.toBeNull();
    expect(s.rejectedFields).toEqual([
      "prob_over_205",
      "prob_over_215",
      "prob_over_225",
      "prob_favorite_wins",
    ]);
    // ⚠️ Assertion STRUCTURELLE, pas par nom de champ.
    // Un test qui cherchait « over_215 » laissait passer une fuite renommée
    // `probOver215` (vérifié : le même défaut s'est faufilé ainsi pendant une
    // sonde). On verrouille donc le JEU DE CLÉS exact : tout champ non prévu
    // fait échouer, quel que soit son nom.
    expect(Object.keys(s).sort()).toEqual([
      "confidence",
      "confidenceScore",
      "eloAway",
      "eloHome",
      "modelVersion",
      "predictedWinnerId",
      "predictedWinnerName",
      "probAwayWin",
      "probHomeWin",
      "rejectedFields",
    ]);
    // Et la piste d'audit, elle, doit être complète et lisible.
    expect(s.rejectedFields).toHaveLength(4);
  });

  test("conserve les grandeurs sans dimension", () => {
    const s = sanitizeBasketballPrediction(RAW_EUROCUP)!;
    expect(s.probHomeWin).toBe(0.709);
    expect(s.probAwayWin).toBe(0.291);
    expect(s.eloHome).toBe(1652.1);
    expect(s.eloAway).toBe(1500);
    expect(s.modelVersion).toBe("catboost-v1 (tier3)");
    expect(s.predictedWinnerId).toBe(106);
  });

  test("somme des probabilités de victoire = 1", () => {
    const s = sanitizeBasketballPrediction(RAW_EUROCUP)!;
    expect(s.probHomeWin + s.probAwayWin).toBeCloseTo(1, 6);
  });

  test("null en entrée ⇒ null en sortie, jamais un objet vide", () => {
    expect(sanitizeBasketballPrediction(null)).toBeNull();
    expect(sanitizeBasketballPrediction(undefined)).toBeNull();
  });

  test("champs absents ⇒ null, jamais 0", () => {
    // Un `0` se lit comme une mesure ; une absence doit rester `null`.
    const s = sanitizeBasketballPrediction({
      prob_home_win: 0.6,
      prob_away_win: 0.4,
    })!;
    expect(s.eloHome).toBeNull();
    expect(s.confidenceScore).toBeNull();
    expect(s.modelVersion).toBeNull();
    expect(s.rejectedFields).toEqual([]);
  });

  test("une prédiction déjà filtrée reste idempotente", () => {
    const une = sanitizeBasketballPrediction(RAW_EUROCUP)!;
    const deux = sanitizeBasketballPrediction({
      prob_home_win: une.probHomeWin,
      prob_away_win: une.probAwayWin,
      elo_home: une.eloHome ?? undefined,
      elo_away: une.eloAway ?? undefined,
      confidence: une.confidence ?? undefined,
      confidence_score: une.confidenceScore ?? undefined,
      predicted_winner_id: une.predictedWinnerId ?? undefined,
      predicted_winner_name: une.predictedWinnerName ?? undefined,
      model_version: une.modelVersion ?? undefined,
    })!;
    expect(deux.rejectedFields).toEqual([]);
    expect(deux.probHomeWin).toBe(une.probHomeWin);
  });
});

describe("URL de blason BSD", () => {
  test("URL déterministe depuis l'id", () => {
    expect(basketballImageUrl("team", 106)).toBe(
      "https://sports.bzzoiro.com/img/basketball/team/106/",
    );
    expect(basketballImageUrl("league", 6)).toBe(
      "https://sports.bzzoiro.com/img/basketball/league/6/",
    );
  });

  test("id absent ⇒ null, jamais une URL cassée", () => {
    // Construire `/img/basketball/team/undefined/` produirait un 404 à chaque
    // rendu : c'est ce qui produit une icône cassée en production.
    expect(basketballImageUrl("team", null)).toBeNull();
    expect(basketballImageUrl("team", undefined)).toBeNull();
    expect(basketballImageUrl("team", Number.NaN)).toBeNull();
    expect(basketballImageUrl("team", 0)).toBeNull();
  });
});
