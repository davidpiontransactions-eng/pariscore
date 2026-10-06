import { describe, expect, test } from "bun:test";
import {
  matchEuroLeagueTeam,
  matchEuroLeagueFixture,
  vitibetTeamAliases,
} from "../basketball-vitibet-euro-join";

/**
 * Noms réels des deux sources (API EuroLeague en MAJUSCULES avec sponsors,
 * Vitibet en casse normale), relevés le 2026-10-05.
 */
const API_NAMES = [
  "ANADOLU EFES ISTANBUL",
  "AS MONACO",
  "CRVENA ZVEZDA MERIDIANBET BELGRADE",
  "DUBAI BASKETBALL",
  "EA7 EMPORIO ARMANI MILAN",
  "FC BARCELONA",
  "FC BAYERN MUNICH",
  "FENERBAHCE BEKO ISTANBUL",
  "HAPOEL IBI TEL AVIV",
  "KOSNER BASKONIA VITORIA-GASTEIZ",
  "LDLC ASVEL VILLEURBANNE",
  "MACCABI RAPYD TEL AVIV",
  "OLYMPIACOS PIRAEUS",
  "PANATHINAIKOS AKTOR ATHENS",
  "PARIS BASKETBALL",
  "PARTIZAN MOZZART BET BELGRADE",
  "REAL MADRID",
  "VALENCIA BASKET",
  "VIRTUS BOLOGNA",
  "ZALGIRIS KAUNAS",
];

type T = { home: { name: string }; away: { name: string } };

describe("joint Vitibet → API EuroLeague", () => {
  test("appariement exact, insensible à la casse", () => {
    expect(matchEuroLeagueTeam("Real Madrid", API_NAMES)).toBe("REAL MADRID");
  });

  test("sponsor en suffixe : le sous-ensemble de tokens suffit", () => {
    // Vitibet « Partizan Mozzart Bet » ⊂ API « PARTIZAN MOZZART BET BELGRADE ».
    expect(matchEuroLeagueTeam("Partizan Mozzart Bet", API_NAMES)).toBe(
      "PARTIZAN MOZZART BET BELGRADE",
    );
    // Sponsor intercalé : « Dubai » ⊂ « DUBAI BASKETBALL ».
    expect(matchEuroLeagueTeam("Dubai", API_NAMES)).toBe("DUBAI BASKETBALL");
  });

  test("sponsor INTERCALÉ : Maccabi Tel Aviv vs MACCABI RAPYD TEL AVIV", () => {
    // « RAPYD » coupe le nom en deux : ni préfixe ni suffixe. Seul le
    // sous-ensemble de tokens le résout.
    expect(matchEuroLeagueTeam("Maccabi Tel Aviv", API_NAMES)).toBe("MACCABI RAPYD TEL AVIV");
  });

  test("changement de marque sans recouvrement : alias explicites", () => {
    // Mesuré : ces deux échouent au sous-ensemble de tokens (aucun token commun).
    expect(matchEuroLeagueTeam("Lyon-Villeurbanne", API_NAMES)).toBe("LDLC ASVEL VILLEURBANNE");
    expect(matchEuroLeagueTeam("Olimpia Milano", API_NAMES)).toBe("EA7 EMPORIO ARMANI MILAN");
    // Les alias ne sont acceptés que si le nom API attendu existe réellement.
    expect(Object.keys(vitibetTeamAliases())).toHaveLength(2);
  });

  test("une équipe inconnue n'est jamais appariée", () => {
    expect(matchEuroLeagueTeam("Paris Saint-Germain", API_NAMES)).toBeNull();
    expect(matchEuroLeagueTeam("", API_NAMES)).toBeNull();
    expect(matchEuroLeagueTeam("Zzz Inconnu Total", API_NAMES)).toBeNull();
  });

  test("l'ambiguïté est un REFUS, pas un tirage au sort", () => {
    // Deux candidats dont les tokens contiennent tous ceux de la requête → refus.
    // Une similarité floue en choisirait un et afficherait ses probabilités sur
    // la fiche du mauvais club.
    const ambigus = ["Hapoel Maccabi Tel Aviv", "Maccabi Tel Aviv Ironi"];
    expect(matchEuroLeagueTeam("Maccabi Tel Aviv", ambigus)).toBeNull();

    // En revanche un seul candidat exact reste un appariement valide.
    expect(matchEuroLeagueTeam("Tel Aviv", ["Tel Aviv", "Tel Aviv Maccabi"])).toBe("Tel Aviv");
  });

  test("les 7 matchs réels de la série s'apparient tous", () => {
    // Fixture gelée du 2026-10-05 : les 7 matchs EuroLeague portant une
    // prédiction, avec leur nom API résolu. C'est la régression qui compte.
    const resolved: T[] = [
      { home: { name: "PARIS BASKETBALL" }, away: { name: "LDLC ASVEL VILLEURBANNE" } },
      { home: { name: "MACCABI RAPYD TEL AVIV" }, away: { name: "EA7 EMPORIO ARMANI MILAN" } },
      { home: { name: "DUBAI BASKETBALL" }, away: { name: "CRVENA ZVEZDA MERIDIANBET BELGRADE" } },
      { home: { name: "FC BAYERN MUNICH" }, away: { name: "VIRTUS BOLOGNA" } },
      { home: { name: "PANATHINAIKOS AKTOR ATHENS" }, away: { name: "FENERBAHCE BEKO ISTANBUL" } },
      { home: { name: "VALENCIA BASKET" }, away: { name: "HAPOEL IBI TEL AVIV" } },
      { home: { name: "REAL MADRID" }, away: { name: "PARTIZAN MOZZART BET BELGRADE" } },
    ];
    const vitibet: T[] = [
      { home: { name: "Paris" }, away: { name: "Lyon-Villeurbanne" } },
      { home: { name: "Maccabi Tel Aviv" }, away: { name: "Olimpia Milano" } },
      { home: { name: "Dubai" }, away: { name: "Crvena Zvezda Meridianbet" } },
      { home: { name: "Bayern" }, away: { name: "Virtus Segafredo Bologna" } },
      { home: { name: "Panathinaikos" }, away: { name: "Fenerbahce" } },
      { home: { name: "Valencia" }, away: { name: "Hapoel Tel Aviv" } },
      { home: { name: "Real Madrid" }, away: { name: "Partizan Mozzart Bet" } },
    ];

    const rates = vitibet.filter((v) => matchEuroLeagueFixture(v, resolved) === null);
    expect(rates.map((r) => `${r.home.name} vs ${r.away.name}`)).toEqual([]);
  });

  test("un match dont UNE seule équipe est inconnue n'est pas apparié", () => {
    // Régression contre la mesure initiale « 6/7 » : exiger une seule équipe
    // comptait des faux positifs.
    const api: T[] = [
      { home: { name: "PARIS BASKETBALL" }, away: { name: "LDLC ASVEL VILLEURBANNE" } },
    ];
    const vitibet: T[] = [
      { home: { name: "Paris" }, away: { name: "Club Inconnu" } },
    ];
    expect(matchEuroLeagueFixture(vitibet[0], api)).toBeNull();
  });

  test("les deux équipes ne peuvent pas être la même équipe", () => {
    const api: T[] = [{ home: { name: "REAL MADRID" }, away: { name: "VIRTUS BOLOGNA" } }];
    // Vitibet annonce deux fois le même club → pas une rencontre.
    const v: T = { home: { name: "Real Madrid" }, away: { name: "Real Madrid" } };
    expect(matchEuroLeagueFixture(v, api)).toBeNull();
  });
});