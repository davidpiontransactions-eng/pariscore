import { describe, expect, test } from "bun:test";
import {
  displayTeamName,
  abbrevTeamName,
  formatCS2Winrate,
  formatProbability,
  smoothWinrate,
} from "./format";

describe("formatCS2Winrate", () => {
  test("null / undefined → « — »", () => {
    expect(formatCS2Winrate(null)).toBe("—");
    expect(formatCS2Winrate(undefined)).toBe("—");
  });

  test("NaN → « — »", () => {
    expect(formatCS2Winrate(Number.NaN)).toBe("—");
  });

  test("arrondi entier, pas de flottant", () => {
    expect(formatCS2Winrate(72.6)).toBe("73%");
    expect(formatCS2Winrate(48)).toBe("48%");
  });

  test("borné à [0,100]", () => {
    expect(formatCS2Winrate(140)).toBe("100%");
    expect(formatCS2Winrate(-5)).toBe("0%");
  });
});

describe("smoothWinrate (lissage bayésien des extrêmes)", () => {
  test("100% → 95% (jamais 100% sur faible échantillon)", () => {
    expect(smoothWinrate(100)).toBe(95);
  });

  test("0% → 5% (jamais 0%)", () => {
    expect(smoothWinrate(0)).toBe(5);
  });

  test("zone médiane intacte", () => {
    expect(smoothWinrate(72)).toBe(72);
    expect(smoothWinrate(50)).toBe(50);
  });

  test("null / NaN → null", () => {
    expect(smoothWinrate(null)).toBeNull();
    expect(smoothWinrate(Number.NaN)).toBeNull();
  });
});

describe("formatProbability", () => {
  test("0.6578 → 66%", () => {
    expect(formatProbability(0.6578)).toBe("66%");
  });

  test("NaN → « — »", () => {
    expect(formatProbability(Number.NaN)).toBe("—");
    expect(formatProbability(null)).toBe("—");
  });
});

describe("displayTeamName", () => {
  test("title-case standard", () => {
    expect(displayTeamName("infurity gaming")).toBe("Infurity Gaming");
  });

  test("acronyme IC → IC Prospects", () => {
    expect(displayTeamName("ic prospects")).toBe("IC Prospects");
  });

  test("acronyme G2", () => {
    expect(displayTeamName("g2")).toBe("G2");
  });

  test("null → TBD", () => {
    expect(displayTeamName(null)).toBe("TBD");
  });
});

describe("abbrevTeamName", () => {
  test("IC Prospects → ICP", () => {
    expect(abbrevTeamName("ic prospects")).toBe("ICP");
  });

  test("Infurity Gaming → INF", () => {
    expect(abbrevTeamName("infurity gaming")).toBe("INF");
  });
});
