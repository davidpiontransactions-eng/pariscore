// Le bug le plus dangereux de l'onglet MMA : formater une heure SANS fixer le
// fuseau. Le rendu dépend alors de la machine (SSR en UTC sur le VPS, client en
// Paris) — deux affichages pour le meme combat, plus un mismatch d'hydratation.
// Ces tests verrouillent le fuseau ET le passage heure d'ete/hiver.
import { describe, expect, test } from "bun:test";
import { formatFightTime, formatGridTime, parisDayKey } from "@/lib/mma-time";

describe("formatFightTime — fuseau Europe/Paris", () => {
  test("hiver (UTC+1) : 23:30 UTC = 00:30 le lendemain à Paris", () => {
    // 15 janvier -> Paris CET, UTC+1. Le decalage de jour est le piege :
    // un calendrier groupe par jour UTC mais affiche l'heure Paris (ou l'inverse)
    // fait apparaître un combat le mauvais jour.
    const out = formatFightTime("2026-01-15T23:30:00Z");
    expect(out).toContain("00:30");
    expect(out).toContain("16"); // le 16, pas le 15
  });

  test("ete (UTC+2) : le meme UTC decale de 2h, pas de 1h", () => {
    const hiver = formatFightTime("2026-01-15T23:30:00Z");
    const ete = formatFightTime("2026-07-15T23:30:00Z");
    expect(ete).toContain("01:30"); // UTC+2 -> 23:30 + 2 = 01:30
    expect(ete).not.toBe(hiver);
    expect(ete).toContain("16");
  });

  test("pas de fuseau local : le resultat ne depend pas de TZ du processus", () => {
    const iso = "2026-10-03T22:00:00Z";
    const avant = formatFightTime(iso);
    const env = process.env.TZ;
    try {
      process.env.TZ = "America/New_York";
      expect(formatFightTime(iso)).toBe(avant);
      process.env.TZ = "Asia/Tokyo";
      expect(formatFightTime(iso)).toBe(avant);
    } finally {
      if (env === undefined) delete process.env.TZ;
      else process.env.TZ = env;
    }
  });

  test("date illisible -> l'ISO brut, jamais d'exception", () => {
    expect(formatFightTime("pas-une-date")).toBe("pas-une-date");
    expect(formatFightTime("")).toBe("");
  });
});

describe("formatGridTime — format compact", () => {
  test("heure Paris en grille", () => {
    expect(formatGridTime("2026-07-15T23:30:00Z")).toContain("01:30");
  });
  test("illisible -> chaine vide", () => {
    expect(formatGridTime("nope")).toBe("");
  });
});

describe("parisDayKey — coherence avec l'heure affichee", () => {
  test("un combat a 23:30 UTC appartient au jour Paris du lendemain", () => {
    expect(parisDayKey("2026-01-15T23:30:00Z")).toBe("2026-01-16");
  });
  test("combats de la journee du meme jour Paris", () => {
    expect(parisDayKey("2026-10-03T12:00:00Z")).toBe("2026-10-03");
    expect(parisDayKey("2026-10-03T23:00:00Z")).toBe("2026-10-04"); // 01h00 le 4
  });
});