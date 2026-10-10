import { describe, expect, test } from "bun:test";
import { normalizeTeamName } from "../corner-outcomes-join";

describe("normalizeTeamName", () => {
  test("retire accents et ponctuation", () => {
    expect(normalizeTeamName("Atlético Madrid")).toBe(normalizeTeamName("Atletico Madrid"));
    expect(normalizeTeamName("Nîmes Olympique")).toBe(normalizeTeamName("Nimes Olympique"));
  });

  test("ignore les mots de club generiques", () => {
    expect(normalizeTeamName("FC Barcelona")).toBe(normalizeTeamName("Barcelona"));
    expect(normalizeTeamName("Sporting CP")).toBe(normalizeTeamName("Sporting"));
  });

  test("LIMITE CONNUE : un diminutif de club n'est pas franchi generiquement", () => {
    // Aucune normalisation par mots ne peut assimiler un nom complet a son
    // diminutif : "Brighton & Hove Albion" et "Brighton" n'ont aucun mot commun
    // apres nettoyage. Seule une table d'alias peut les relier (cf.
    // scripts/team_name_mapping.py). Ces matchs la sont donc comptes dans
    // `unmatchedByName` plutot que d'"apparies" au hasard.
    expect(normalizeTeamName("Brighton & Hove Albion")).not.toBe(normalizeTeamName("Brighton"));
    expect(normalizeTeamName("Olympique de Marseille")).not.toBe(normalizeTeamName("Marseille"));
  });

  test("ne confond jamais deux clubs reels", () => {
    // Le piege qui a fait livrer une collision Madrid/Atletico sur les corners :
    // un fragment generique ("Madrid") appariait Real et Atletico.
    expect(normalizeTeamName("Real Madrid")).not.toBe(normalizeTeamName("Atletico Madrid"));
    expect(normalizeTeamName("Manchester United")).not.toBe(normalizeTeamName("West Ham United"));
    expect(normalizeTeamName("Manchester City")).not.toBe(normalizeTeamName("Bristol City"));
    expect(normalizeTeamName("Inter Milan")).not.toBe(normalizeTeamName("Inter Miami"));
  });

  test("tolere les entrees vides", () => {
    expect(normalizeTeamName(null)).toBe("");
    expect(normalizeTeamName(undefined)).toBe("");
    expect(normalizeTeamName("")).toBe("");
  });
});