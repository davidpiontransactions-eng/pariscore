import { describe, expect, test } from "bun:test";
import {
  selectLiquidLine,
  lineLabels,
  type RawMarket,
} from "../basketball-market-line";

/**
 * Structure réelle de `/events/{id}/odds/` relevée le 2026-10-08
 * (event 7504, Real Madrid — Partizan). Ces fixtures reproduisent les trois
 * pièges que la fonction doit absorber.
 */

function m(partial: Partial<RawMarket>): RawMarket {
  return {
    market_kind: "AH",
    market_period: "FT",
    market_line: -9.5,
    selections: ["HOME", "AWAY"],
    bookmakers: [],
    ...partial,
  };
}

/** bookmaker avec les deux prix de ses sélectionnés. */
function book(slug: string, first: number, second: number, sel = ["HOME", "AWAY"]) {
  return {
    bookmaker: slug,
    prices: { [sel[0]]: { price: first }, [sel[1]]: { price: second } },
  };
}

describe("selectLiquidLine", () => {
  test("retient la ligne la plus liquide, pas la première", () => {
    // Piège réel : la première entrée OU du source porte market_line: null.
    const markets: RawMarket[] = [
      m({ market_kind: "OU", market_line: null, selections: ["OVER", "UNDER"],
          bookmakers: [book("a", 1.95, 1.94, ["OVER", "UNDER"])] }),
      m({ market_kind: "OU", market_line: 173.5, selections: ["OVER", "UNDER"],
          bookmakers: [book("a", 1.9, 2.0, ["OVER", "UNDER"]), book("b", 1.92, 1.95, ["OVER", "UNDER"])] }),
      m({ market_kind: "OU", market_line: 171.5, selections: ["OVER", "UNDER"],
          bookmakers: [book("a", 1.9, 2.0, ["OVER", "UNDER"])] }),
    ];
    const sel = selectLiquidLine(markets, "OU");
    expect(sel).not.toBeNull();
    expect(sel!.line).toBe(173.5); // 2 books, pas 171.5 (1 book)
    expect(sel!.books).toBe(2);
    expect(sel!.firstLabel).toBe("OVER");
  });

  test("les clés de prix de OU sont OVER/UNDER, pas HOME/AWAY", () => {
    // Piège réel : HOME/AWAY n'existe pas sur OU → 0 book exploitable.
    const markets: RawMarket[] = [
      m({ market_kind: "OU", market_line: 165.5, selections: ["OVER", "UNDER"],
          bookmakers: [{ bookmaker: "x", prices: { HOME: { price: 2.0 }, AWAY: { price: 1.9 } } }] }),
    ];
    expect(selectLiquidLine(markets, "OU")).toBeNull();

    const ok: RawMarket[] = [
      m({ market_kind: "OU", market_line: 165.5, selections: ["OVER", "UNDER"],
          bookmakers: [book("x", 1.95, 1.94, ["OVER", "UNDER"]),
                       book("y", 1.93, 1.96, ["OVER", "UNDER"])] }),
    ];
    expect(selectLiquidLine(ok, "OU")!.line).toBe(165.5);
  });

  test("handicap NÉGATIF est normal — un favori à domicile l'a toujours", () => {
    // Régression de mon propre contrôle : `line <= 0` n'est PAS une anomalie
    // pour un AH. Sur les 10 lignes AH du cache J4, les 10 étaient négatives.
    const sel = selectLiquidLine(
      [m({ market_line: -9.5, bookmakers: [book("a", 2.0, 1.91), book("b", 2.05, 1.88)] })],
      "AH",
    );
    expect(sel).not.toBeNull();
    expect(sel!.line).toBe(-9.5);
    expect(sel!.line).toBeLessThan(0);
    expect(sel!.books).toBe(2);
  });

  test("moins de 2 bookmakers ⇒ null (devig non fiable)", () => {
    const sel = selectLiquidLine(
      [m({ market_line: -9.5, bookmakers: [book("seul", 2.0, 1.91)] })],
      "AH",
    );
    expect(sel).toBeNull();
  });

  test("une cote à 0 est une absence, pas un prix", () => {
    const sel = selectLiquidLine(
      [m({ market_line: -9.5, bookmakers: [book("a", 0, 1.91), book("b", 2.0, 1.9)] })],
      "AH",
    );
    // book "a" écarté (price 0) → reste 1 book exploitable → null.
    expect(sel).toBeNull();
  });

  test("marge : MOYENNE par livre, pas somme (piège des 1493 %)", () => {
    // 10 livres à 1.91/1.95 → marge attendue ~4-5 %, pas ~1500 %.
    const books = Array.from({ length: 10 }, (_, i) => book("b" + i, 1.91, 1.95));
    const sel = selectLiquidLine([m({ market_line: -9.5, bookmakers: books })], "AH");
    expect(sel).not.toBeNull();
    expect(sel!.vigPct).toBeGreaterThan(0);
    expect(sel!.vigPct).toBeLessThan(20);
    expect(sel!.fairFirst + sel!.fairSecond).toBeCloseTo(1, 6);
  });

  test("période non FT ignorée (une ligne Q4 n'est pas une ligne de match)", () => {
    const sel = selectLiquidLine(
      [m({ market_period: "Q4", market_line: -3.5, bookmakers: [book("a", 1.9, 2.0), book("b", 1.9, 2.0)] })],
      "AH",
    );
    expect(sel).toBeNull();
  });

  test("aucun marché exploitable ⇒ null, jamais une ligne de repli", () => {
    expect(selectLiquidLine([], "AH")).toBeNull();
    expect(selectLiquidLine(undefined, "AH")).toBeNull();
    expect(selectLiquidLine(null, "OU")).toBeNull();
  });
});

describe("lineLabels", () => {
  test("OU → Over/Under, AH → Domicile/Extérieur", () => {
    expect(lineLabels("OU")).toEqual({ first: "Over", second: "Under" });
    expect(lineLabels("AH")).toEqual({ first: "Domicile", second: "Extérieur" });
  });
});