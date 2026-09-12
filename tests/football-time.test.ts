import { describe, expect, test, afterEach } from "bun:test";
import { isInKickoffWindow } from "@/lib/football-time";

describe("isInKickoffWindow", () => {
  const FIXED_NOW = new Date("2026-09-12T14:00:00Z").getTime(); // 16:00 Paris
  const origNow = Date.now;

  afterEach(() => { Date.now = origNow; });

  const at = (h: number) => new Date(FIXED_NOW + h * 3_600_000).toISOString();

  test("jour — même jour Paris", () => {
    Date.now = () => FIXED_NOW;
    expect(isInKickoffWindow(at(1), "jour")).toBe(true);
    expect(isInKickoffWindow(at(7), "jour")).toBe(true); // 23:00 Paris → même jour
  });

  test("borne ≤1h", () => {
    Date.now = () => FIXED_NOW;
    expect(isInKickoffWindow(at(0.5), "1h")).toBe(true);
    expect(isInKickoffWindow(at(1), "1h")).toBe(true);
    expect(isInKickoffWindow(at(1.1), "1h")).toBe(false);
  });

  test("borne ≤4h", () => {
    Date.now = () => FIXED_NOW;
    expect(isInKickoffWindow(at(3), "4h")).toBe(true);
    expect(isInKickoffWindow(at(4), "4h")).toBe(true);
    expect(isInKickoffWindow(at(4.1), "4h")).toBe(false);
  });

  test("borne ≤8h", () => {
    Date.now = () => FIXED_NOW;
    expect(isInKickoffWindow(at(7), "8h")).toBe(true);
    expect(isInKickoffWindow(at(8), "8h")).toBe(true);
    expect(isInKickoffWindow(at(9), "8h")).toBe(false);
  });

  test("48h", () => {
    Date.now = () => FIXED_NOW;
    expect(isInKickoffWindow(at(47), "48h")).toBe(true);
    expect(isInKickoffWindow(at(49), "48h")).toBe(false);
  });

  test("match passé → false", () => {
    Date.now = () => FIXED_NOW;
    expect(isInKickoffWindow(at(-1), "48h")).toBe(false);
  });

  test("date invalide → false", () => {
    Date.now = () => FIXED_NOW;
    expect(isInKickoffWindow("not-a-date", "48h")).toBe(false);
  });
});
