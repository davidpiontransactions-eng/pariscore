// Tests d'extractGeminiText — la racine unique d'assemblage des réponses
// Gemini (piège parts[0] corrigé le 2026-09-25 : réponses longues tronquées).
import { describe, expect, test } from "bun:test";
import { extractGeminiText, type GeminiResponse } from "../llm";

const r = (parts: { text?: string; thought?: boolean }[]): GeminiResponse => ({
  candidates: [{ content: { parts } }],
});

describe("extractGeminiText", () => {
  test("parts multiples → jointure complète (plus de troncature)", () => {
    const out = extractGeminiText(
      r([{ text: "### 1. DESCRIPTIF\n" }, { text: "suite de l'analyse. " }, { text: "### 7. BETS" }])
    );
    expect(out).toBe("### 1. DESCRIPTIF\nsuite de l'analyse. ### 7. BETS");
  });

  test("parts de raisonnement (thought) exclues de la réponse", () => {
    const out = extractGeminiText(
      r([
        { text: "réflexion interne", thought: true },
        { text: "la vraie réponse" },
      ])
    );
    expect(out).toBe("la vraie réponse");
  });

  test("réponse vide / absente → chaîne vide (le caller lève GEMINI_EMPTY)", () => {
    expect(extractGeminiText(r([]))).toBe("");
    expect(extractGeminiText({})).toBe("");
    expect(extractGeminiText(null)).toBe("");
    expect(extractGeminiText(undefined)).toBe("");
  });

  test("part sans text ignorée sans crash", () => {
    expect(extractGeminiText(r([{}, { text: "ok" }]))).toBe("ok");
  });
});
