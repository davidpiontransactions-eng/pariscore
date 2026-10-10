import { describe, expect, test } from "bun:test";
import { matchTeamName } from "../use-cornervalue-stats";

describe("matchTeamName — collisions de noms tronques", () => {
  // Le scraper a tronqué les noms : ces fragments matchent PLUSIEURS clubs réels,
  // dont les statistiques de corners diffèrent dans le même JSON. Les rejeter est
  // délibéré : afficher les corners de l'Atlético sur un match du Real Madrid est
  // pire que ne rien afficher.
  test("'Madrid' ne matche ni Real ni Atletico Madrid", () => {
    expect(matchTeamName("Madrid", "Real Madrid")).toBe(false);
    expect(matchTeamName("Madrid", "Atletico Madrid")).toBe(false);
  });

  test("fragments anglais tronqués rejetés", () => {
    expect(matchTeamName("United", "Manchester United")).toBe(false);
    expect(matchTeamName("United", "West Ham United")).toBe(false);
    expect(matchTeamName("City", "Manchester City")).toBe(false);
    expect(matchTeamName("Town", "Ipswich Town")).toBe(false);
    expect(matchTeamName("County", "Notts County")).toBe(false);
    expect(matchTeamName("Rovers", "Blackburn Rovers")).toBe(false);
  });

  test("les noms exacts courts restent valides (Rangers est un club a part entiere)", () => {
    expect(matchTeamName("Rangers", "Rangers")).toBe(true);
    expect(matchTeamName("Parma", "Parma")).toBe(true);
    expect(matchTeamName("Inter", "Inter")).toBe(true);
    expect(matchTeamName("Lazio", "Lazio")).toBe(true);
  });

  test("le nom complet matche son fragment (sens long -> court)", () => {
    expect(matchTeamName("Manchester United", "United")).toBe(true);
    expect(matchTeamName("Borussia Dortmund", "Dortmund")).toBe(true);
  });

  test("correspondance partielle autorisee au-dessus du seuil", () => {
    expect(matchTeamName("Internazionale", "Inter")).toBe(true);
    expect(matchTeamName("Atletico Madrid", "Madrid")).toBe(true);
  });

  test("normalisation: casse, espaces et ponctuation", () => {
    expect(matchTeamName("Real Madrid", "real madrid")).toBe(true);
    expect(matchTeamName("Olympique Lyonnais", "Olympique-Lyonnais")).toBe(true);
    expect(matchTeamName("FC Porto", "Porto")).toBe(false); // "portofc" < 8
  });

  test("noms sans rapport ne matchent pas", () => {
    expect(matchTeamName("Parma", "Real Betis")).toBe(false);
    expect(matchTeamName("Inter", "Real Betis")).toBe(false);
  });
});