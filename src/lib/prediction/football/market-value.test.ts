import { describe, it, expect } from "bun:test";
import {
  signalFromValues,
  blendMarketValue,
  normalizeClub,
  clubMarketValueM,
  MV_WEIGHT,
} from "./market-value";

// ── signalFromValues ─────────────────────────────────────────────────────────

describe("signalFromValues", () => {
  it("valeurs manquantes → indisponible, signal0", () => {
    const r = signalFromValues(null, 500);
    expect(r.available).toBe(false);
    expect(r.signal).toBe(0);
  });

  it("valeurs égales → signal0", () => {
    const r = signalFromValues(400, 400);
    expect(r.available).toBe(true);
    expect(r.signal).toBe(0);
  });

  it("effectif domicile plus fort → signal positif, croissant en log-ratio", () => {
    const r1 = signalFromValues(400, 200); // log2 ≈ 0.693
    const r2 = signalFromValues(800, 200); // log4 ≈ 1.386 → borné1
    expect(r1.signal).toBeGreaterThan(0);
    expect(r2.signal).toBeGreaterThan(r1.signal);
    expect(r2.signal).toBe(1); // saturation bornée
  });

  it("symétrie : échanger les équipes inverse le signal", () => {
    const a = signalFromValues(500, 250);
    const b = signalFromValues(250, 500);
    expect(b.signal).toBeCloseTo(-a.signal, 10);
  });

  it("valeur nulle → indisponible (pas de division par zéro)", () => {
    const r = signalFromValues(0, 300);
    expect(r.available).toBe(false);
  });
});

// ── blendMarketValue ─────────────────────────────────────────────────────────

const ENS = { home: 45, draw: 27, away: 28 };

describe("blendMarketValue", () => {
  it("signal indisponible → identité stricte", () => {
    const out = blendMarketValue(ENS, { signal: 0.5, available: false, homeValueM: null, awayValueM: null });
    expect(out).toEqual(ENS);
  });

  it("signal0 → identité (aucun déplacement)", () => {
    const out = blendMarketValue(ENS, { signal: 0, available: true, homeValueM: 400, awayValueM: 400 });
    expect(out.home).toBeCloseTo(45, 6);
    expect(out.away).toBeCloseTo(28, 6);
  });

  it("signal positif → home augmente (cap ±5pp), away diminue, draw intact, somme =100", () => {
    const out = blendMarketValue(ENS, { signal: 1, available: true, homeValueM: 900, awayValueM: 200 });
    const delta = Math.min(5, MV_WEIGHT * 100); // borné ±5pp même si signal×weight > 5
    expect(out.home).toBeCloseTo(45 + delta, 1);
    expect(out.away).toBeCloseTo(28 - delta, 1);
    expect(out.draw).toBeCloseTo(27, 1);
    expect(out.home + out.draw + out.away).toBeCloseTo(100, 6);
  });

  it("delta borné ±5pp même pour signal saturé", () => {
    const out = blendMarketValue({ home: 10, draw: 10, away: 80 }, { signal: -1, available: true, homeValueM: 100, awayValueM: 900 });
    expect(out.away).toBeLessThanOrEqual(85.01);
    expect(out.home + out.draw + out.away).toBeCloseTo(100, 6);
  });
});

// ── normalizeClub ────────────────────────────────────────────────────────────

describe("normalizeClub", () => {
  it("accents + ponctuation + casse → clé comparable", () => {
    expect(normalizeClub("Paris Saint-Germain")).toBe("paris saint germain");
    expect(normalizeClub("Olympique de Marseille!")).toBe("olympique de marseille");
    expect(normalizeClub("FC Bayern München")).toBe("fc bayern munchen");
  });
});

// ── clubMarketValueM (lookup UI popup) ───────────────────────────────────────

describe("clubMarketValueM", () => {
  it("club absent → null (pas de throw)", () => {
    expect(clubMarketValueM("FC N'existe Pas 999")).toBeNull();
    expect(clubMarketValueM("")).toBeNull();
  });

  it("club du JSON seedé → valeur > 0 (si data présente)", async () => {
    const { loadClubMarketValues } = await import("./market-value");
    const all = loadClubMarketValues();
    const lg = Object.values(all?.leagues ?? {})[0];
    const first = lg ? Object.entries(lg)[0] : null;
    if (first) {
      expect(clubMarketValueM(first[0])).toBe(first[1]);
      expect(clubMarketValueM(first[0])).toBeGreaterThan(0);
    }
  });
});
