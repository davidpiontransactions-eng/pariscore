import { describe, expect, test } from "bun:test";
import {
  devigTwoWay,
  cacheAgeMinutes,
  isCacheStale,
} from "@/lib/basketball-bsd-cache";

/**
 * Garde de la couche cache BSD.
 *
 * Ce qui est verrouillé ici, ce sont les trois propriétés qui rendent le popup
 * honnête quand la donnée vient d'un tiers pré-chargé :
 *   1. une absence reste `null` (jamais 0, jamais une URL morte) ;
 *   2. la marge est MESURÉE, pas supposée ;
 *   3. la fraîcheur est calculée et exposée, pas supposée fraîche.
 */
describe("devigTwoWay — retrait de marge", () => {
  test("marge nulle ⇒ cotes justes conservées", () => {
    const r = devigTwoWay(2, 2)!;
    expect(r.fairHome).toBeCloseTo(0.5, 6);
    expect(r.fairAway).toBeCloseTo(0.5, 6);
    expect(r.vigPct).toBeCloseTo(0, 6);
  });

  test("marge réelle mesurée, pas supposée", () => {
    // 1.90 / 2.00 → somme des inverses 1.0263 → marge 2.63 %
    const r = devigTwoWay(1.9, 2.0)!;
    expect(r.vigPct).toBeCloseTo(2.631, 2);
    expect(r.fairHome + r.fairAway).toBeCloseTo(1, 10);
  });

  test("les cotes BRUTES restent la référence de l'EV", () => {
    // Le devig sert à COMPARER. L'EV doit se calculer sur la cote brute,
    // sinon on=value une marge qu'on s'est retirée soi-même.
    const brutes = devigTwoWay(1.9, 2.0)!;
    const iv = 1 / 1.9;
    const evBrut = 0.55 * iv - 1; // EV sur cote brute
    const evSurFair = 0.55 * brutes.fairHome - 1; // faux
    expect(evBrut).toBeGreaterThan(evSurFair);
  });

  test("cotes invalides ⇒ null, jamais une probabilité inventée", () => {
    expect(devigTwoWay(0, 2)).toBeNull();
    expect(devigTwoWay(1.9, 0)).toBeNull();
    expect(devigTwoWay(-1.9, 2)).toBeNull();
    expect(devigTwoWay(Number.NaN, 2)).toBeNull();
  });
});

describe("fraîcheur du cache — exposée, pas supposée", () => {
  const t0 = Date.parse("2026-10-06T10:00:00Z");

  test("âge calculé depuis fetchedAt", () => {
    expect(cacheAgeMinutes("2026-10-06T10:00:00Z", t0 + 5 * 60_000)).toBe(5);
    expect(cacheAgeMinutes("2026-10-06T10:00:00Z", t0 + 90 * 60_000)).toBe(90);
  });

  test("date illisible ⇒ âge null, jamais 0", () => {
    // `new Date("brol").getTime()` = NaN ; un `|| 0` afficherait « cache de
    // 0 min », c'est-à-dire « fraîche » pour une donnée illisible.
    expect(cacheAgeMinutes("pas-une-date")).toBeNull();
    expect(cacheAgeMinutes("")).toBeNull();
  });

  test("clock skew : une date future ne donne pas un âge négatif", () => {
    // Si l'horloge du cron et celle du serveur divergent, Math.max évite
    // « -3 min » qui se lirait comme une donnée avant sa collecte.
    expect(cacheAgeMinutes("2026-10-06T10:05:00Z", t0)).toBe(0);
  });

  test("périmé au-delà du seuil, frais en deçà", () => {
    expect(isCacheStale("2026-10-06T10:00:00Z", 30, t0 + 29 * 60_000)).toBe(false);
    expect(isCacheStale("2026-10-06T10:00:00Z", 30, t0 + 31 * 60_000)).toBe(true);
    // Illisible ⇒ périmé par précaution : on montre le doute.
    expect(isCacheStale("brol", 30, t0)).toBe(true);
  });
});
