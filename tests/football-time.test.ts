import { describe, expect, test, afterEach } from "bun:test";
import { isInKickoffWindow } from "@/lib/football-time";

describe("isInKickoffWindow", () => {
  const FIXED_NOW = new Date("2026-09-12T14:00:00Z").getTime(); // 16:00 Paris
  const now = new Date(FIXED_NOW);

  const at = (h: number) => new Date(FIXED_NOW + h * 3_600_000).toISOString();

  test("jour — même jour Paris", () => {
    expect(isInKickoffWindow(at(1), "jour", now)).toBe(true);
    expect(isInKickoffWindow(at(7), "jour", now)).toBe(true); // 23:00 Paris → même jour
  });

  test("borne ≤1h", () => {
    expect(isInKickoffWindow(at(0.5), "1h", now)).toBe(true);
    expect(isInKickoffWindow(at(1), "1h", now)).toBe(true);
    expect(isInKickoffWindow(at(1.1), "1h", now)).toBe(false);
  });

  test("borne ≤4h", () => {
    expect(isInKickoffWindow(at(3), "4h", now)).toBe(true);
    expect(isInKickoffWindow(at(4), "4h", now)).toBe(true);
    expect(isInKickoffWindow(at(4.1), "4h", now)).toBe(false);
  });

  test("borne ≤8h", () => {
    expect(isInKickoffWindow(at(7), "8h", now)).toBe(true);
    expect(isInKickoffWindow(at(8), "8h", now)).toBe(true);
    expect(isInKickoffWindow(at(9), "8h", now)).toBe(false);
  });

  test("48h", () => {
    expect(isInKickoffWindow(at(47), "48h", now)).toBe(true);
    expect(isInKickoffWindow(at(49), "48h", now)).toBe(false);
  });

  test("match passé → false", () => {
    expect(isInKickoffWindow(at(-1), "48h", now)).toBe(false);
  });

  test("date invalide → false", () => {
    expect(isInKickoffWindow("not-a-date", "48h", now)).toBe(false);
  });
});
