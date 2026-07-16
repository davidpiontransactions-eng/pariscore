import { describe, test, expect } from "bun:test";
import { STRATEGY_KEYS, validateStrategyKeys } from "../packages/shared/src/strategies";

describe("STRATEGY_KEYS", () => {
  test("has canonical keys defined", () => {
    expect(STRATEGY_KEYS.length).toBeGreaterThan(0);
  });

  test("includes BTTS_YES and HOME_WIN", () => {
    expect(STRATEGY_KEYS).toContain("BTTS_YES");
    expect(STRATEGY_KEYS).toContain("HOME_WIN");
    expect(STRATEGY_KEYS).toContain("TENNIS_SERVE_HOLD");
  });

  test("has no duplicates", () => {
    expect(new Set(STRATEGY_KEYS).size).toBe(STRATEGY_KEYS.length);
  });

  test("all keys are uppercase with underscore", () => {
    for (const key of STRATEGY_KEYS) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });
});

describe("validateStrategyKeys", () => {
  test("returns empty missing/extra for exact match", () => {
    const { missing, extra } = validateStrategyKeys([...STRATEGY_KEYS]);
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  test("detects missing keys", () => {
    const subset = STRATEGY_KEYS.filter(k => k !== "BTTS_YES");
    const { missing } = validateStrategyKeys(subset);
    expect(missing).toContain("BTTS_YES");
  });

  test("detects extra keys", () => {
    const { extra } = validateStrategyKeys([...STRATEGY_KEYS, "FAKE_STRAT"]);
    expect(extra).toContain("FAKE_STRAT");
  });
});
