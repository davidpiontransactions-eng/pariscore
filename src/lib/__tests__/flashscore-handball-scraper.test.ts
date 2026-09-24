// Tests régression parsing feed Flashscore handball (scripts/scrape-flashscore-handball.js)
// Bug #10 (2026-09-24) : clés AG/AT/AH/AU décalées → score "visiteur-visiteur"
// (A-A) et MT "local-local". Mapping vérifié empiriquement sur le feed brut :
//   AG = final LOCAUX · AH = final VISITEURS · BA = MT LOCAUX · BB = MT VISITEURS
//   AT/AU = score à 60' (régulation, ≠ final si prolongation) → ignorés

import { describe, expect, test } from "bun:test";
import { parseDay } from "../../../scripts/scrape-flashscore-handball";

/** Corps de feed réel reconstitué (séparateurs ¬ et ÷, en-têtes ~ZA/~AA). */
function feed(tokens: string[]): string {
  return tokens.join("\u00AC");
}

describe("parseDay — mapping score/MT (bug #10)", () => {
  test("match terminé : score = final local-visiteur, MT = buts mi-temps", () => {
    // Kazakhstan-Iran réel (2026-09-23, feed brut J-1) : 23-28, MT 13-16
    const body = feed([
      "SA\u00F77",
      "~ZA\u00F7ASIA: Asian Games",
      "~AA\u00F78AWqsrWj",
      "AD\u00F71790134200",
      "CX\u00F7Kazakhstan",
      "AE\u00F7Kazakhstan",
      "AG\u00F723", // final LOCAUX (23)
      "AT\u00F723", // régulation local — ignoré
      "BA\u00F713", // MT LOCAUX (13)
      "BC\u00F710", // 2e MT local — ignoré
      "AF\u00F7Iran",
      "AS\u00F72",
      "AZ\u00F72",
      "AH\u00F728", // final VISITEURS (28)
      "AU\u00F728", // régulation visiteur — ignoré
      "BB\u00F716", // MT VISITEURS (16)
      "BD\u00F712", // 2e MT visiteur — ignoré
    ]);
    const [m] = parseDay(body);
    expect(m).toBeDefined();
    expect(m.isFinished).toBe(true);
    // Régression bug #10 : avant fix → "28 - 28" (MT "23 - 23")
    expect(m.score).toBe("23 - 28");
    expect(m.homeHalf).toBe(13);
    expect(m.awayHalf).toBe(16);
  });

  test("prolongation : AT/AU (score à 60') ne polluent ni final ni MT", () => {
    // Arendal-Sandefjord TIF réel (2026-09-23, NM Cup) : 31-32, MT 12-11,
    // nul 27-27 à 60' → AT = AU = 27 (clés à ne PAS utiliser)
    const body = feed([
      "~ZA\u00F7NORWAY: NM Cup",
      "~AA\u00F7UkEQBC7s",
      "AD\u00F71790181000",
      "CX\u00F7Arendal",
      "AE\u00F7Arendal",
      "AG\u00F731",
      "AT\u00F727",
      "BA\u00F712",
      "REA\u00F731",
      "BC\u00F715",
      "BE\u00F74",
      "AF\u00F7Sandefjord TIF",
      "AS\u00F72",
      "AZ\u00F70",
      "AH\u00F732",
      "AU\u00F727",
      "BB\u00F711",
      "REB\u00F732",
      "BD\u00F716",
      "BF\u00F75",
    ]);
    const [m] = parseDay(body);
    expect(m.isFinished).toBe(true);
    expect(m.score).toBe("31 - 32");
    expect(m.homeHalf).toBe(12);
    expect(m.awayHalf).toBe(11);
  });

  test("match à venir : score null, status scheduled (pas de clés AG/AH)", () => {
    const body = feed([
      "~ZA\u00F7GERMANY: DHB Pokal",
      "~AA\u00F7YwJew1Ft",
      "AD\u00F71790269200",
      "CX\u00F7Stuttgart",
      "AE\u00F7Stuttgart",
      "AF\u00F7Erlangen",
      "AS\u00F70",
      "AZ\u00F70",
    ]);
    const [m] = parseDay(body);
    expect(m.score).toBeNull();
    expect(m.isFinished).toBe(false);
    expect(m.homeHalf).toBeUndefined();
    expect(m.awayHalf).toBeUndefined();
  });

  test("live : AG/AH = score en cours, status live", () => {
    const body = feed([
      "~ZA\u00F7FRANCE: Starligue",
      "~AA\u00F7liveTest1",
      "CX\u00F7PSG",
      "AE\u00F7PSG",
      "AG\u00F715",
      "AF\u00F7Nantes",
      "AS\u00F71",
      "AZ\u00F71",
      "AH\u00F712",
      "BA\u00F78",
      "BB\u00F77",
    ]);
    const [m] = parseDay(body);
    expect(m.isLive).toBe(true);
    expect(m.isFinished).toBe(false);
    expect(m.score).toBe("15 - 12");
    expect(m.homeHalf).toBe(8);
    expect(m.awayHalf).toBe(7);
  });
});
