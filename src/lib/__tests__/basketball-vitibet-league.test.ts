import { describe, expect, test } from "bun:test";
import {
  toBasketballLeagueId,
  isBasketballLeagueCalibrated,
  calibratedBasketballLeagues,
  vitibetLeagueAliases,
  VITIBET_UNMAPPED_REFERENCE,
  VITIBET_REJECTED_ALIASES,
} from "../basketball-vitibet-league";
import { getLeagueConfig, getAllLeagueIds } from "../basketball-league-config";

const aliases = vitibetLeagueAliases();

describe("table d'appariement Vitibet → catalogue", () => {
  test("chaque alias pointe vers une clé qui EXISTE dans le catalogue", () => {
    const ids = new Set<string>(getAllLeagueIds());
    for (const [vitibet, id] of Object.entries(aliases)) {
      expect(ids.has(id), `${vitibet} → ${id} : clé absente du catalogue`).toBe(true);
      // Le label du catalogue doit être cohérent avec le pays du vitibet.
      expect(getLeagueConfig(id).id).toBe(id);
    }
  });

  test("« Liga A » REFUSÉE : Vitibet dit Argentina, pas Italie", () => {
    // Régression, deux fois. (a) La feuille de route proposait `acb`
    // (Espagne) : mauvais pays. (b) Ma première correction proposait `lba`
    // (Italie) : mauvais pays AUSS — vérifié sur le champ `country` du dump,
    // qui vaut « Argentina ». Le sigle est exact, la compétition ne l'est pas.
    expect(toBasketballLeagueId("Liga A")).toBeNull();
    expect(VITIBET_REJECTED_ALIASES["Liga A"].vitibetCountry).toBe("Argentina");
    expect(getLeagueConfig("acb").country).toBe("Espagne");
    expect(getLeagueConfig("lba").country).toBe("Italie");
  });

  test("« LNB » REFUSÉE : Vitibet dit Chile, pas France", () => {
    // Même famille : « LNB » est le sigle de la Betclic Élite côté catalogue,
    // mais la ligue Vitibet ainsi nommée est chilienne. Un match chilien dans
    // l'onglet France serait indétectable en test d'intégration.
    expect(toBasketballLeagueId("LNB")).toBeNull();
    expect(VITIBET_REJECTED_ALIASES["LNB"].vitibetCountry).toBe("Chile");
    expect(getLeagueConfig("lnb").country).toBe("France");
  });

  test("les ligues couvertes par Vitibet sont appariées après vérification pays", () => {
    // Ces 4 ont été vérifiées pays par pays contre le dump.
    expect(toBasketballLeagueId("Super Ligi")).toBe("bsl");
    expect(getLeagueConfig("bsl").country).toBe("Turquie");
    expect(toBasketballLeagueId("BBL")).toBe("bbl");
    expect(getLeagueConfig("bbl").country).toBe("Allemagne");
    expect(toBasketballLeagueId("KBL")).toBe("kbl");
    expect(getLeagueConfig("kbl").country).toBe("Corée du Sud");
    expect(toBasketballLeagueId("NBL")).toBe("nbl");
    expect(getLeagueConfig("nbl").country).toBe("Australie");
  });

  test("« Super Ligi » est la TURQUIE (bsl), pas la Belgique", () => {
    // Le sigle « BSL » est turc (Basketball Süper Ligi) ; la Belgique
    // n'apparaît pas dans le dump Vitibet sous ce nom.
    expect(toBasketballLeagueId("Super Ligi")).toBe("bsl");
    expect(getLeagueConfig("bsl").country).toBe("Turquie");
    // bbl est l'Allemagne dans ce catalogue — vérifié ci-dessus.
    expect(getLeagueConfig("bbl").country).toBe("Allemagne");
  });

  test("« ABA League » REFUSÉE : le champ `country` ne dit pas le pays", () => {
    // Mesuré : Vitibet renseigne country="ABA League", c'est-à-dire son propre
    // nom. Aucune vérification possible, donc aucun alias — le catalogue `aba`
    // (Ex-Yougoslavie) serait plausible mais deviné.
    expect(toBasketballLeagueId("ABA League")).toBeNull();
    expect(VITIBET_UNMAPPED_REFERENCE["ABA League"].vitibetCountry).toBe("ABA League");
  });

  test("aucune ligue inconnue n'est appariée par erreur", () => {
    // Le refus est le comportement par défaut : pas de leagueSimilarity ici.
    for (const nom of [
      "Superliga",
      "Super League",
      "Premier league",
      "Extraliga",
      "Liga UPC",
      "B League",
      "LNBP",
      "LBP",
      "MPBL",
      "Korisliga",
      "",
      "  ",
    ]) {
      expect(toBasketballLeagueId(nom), `${nom} ne doit pas être apparié`).toBeNull();
    }
  });

  test("une ligue du dump non mappée est bien listée comme telle", () => {
    // Cohérence : chaque nom du dump absent des alias figure dans la
    // référence, sinon quelqu'un l'a oublié silencieusement.
    for (const nom of Object.keys(VITIBET_UNMAPPED_REFERENCE)) {
      expect(toBasketballLeagueId(nom), `${nom} listé mais mappé`).toBeNull();
    }
    for (const nom of Object.keys(VITIBET_REJECTED_ALIASES)) {
      expect(toBasketballLeagueId(nom), `${nom} listé comme refusé mais mappé`).toBeNull();
    }
  });

  test("l'appariement est sensible à la casse (pas de normalisation implicite)", () => {
    expect(toBasketballLeagueId("nba")).toBeNull();
    expect(toBasketballLeagueId("Euroleague")).toBe("euroleague");
    expect(toBasketballLeagueId("euroleague")).toBeNull();
  });
});

describe("calibrage — distinct de l'appariement", () => {
  test("appariée ≠ calibrée : une ligue vérifiée peut n'avoir aucune mesure", () => {
    // C'est tout l'intérêt du module. `bsl` (Turquie) est appariée — pays
    // vérifié — mais absente de basketball_match_history donc non calibrée.
    expect(toBasketballLeagueId("Super Ligi")).toBe("bsl");
    expect(isBasketballLeagueCalibrated("bsl")).toBe(false);
    expect(getLeagueConfig("bsl").hasFeed).toBe(false);
  });

  test("les 3 ligues mesurées sont calibrées", () => {
    // basketball_match_history : NBA, WNBA, EuroLeague, EuroCup (7313 matchs).
    expect(isBasketballLeagueCalibrated("nba")).toBe(true);
    expect(isBasketballLeagueCalibrated("wnba")).toBe(true);
    expect(isBasketballLeagueCalibrated("euroleague")).toBe(true);
    expect(isBasketballLeagueCalibrated("eurocup")).toBe(true);
  });

  test("aucune ligue sans base mesurée ne se déclare calibrée", () => {
    // 26 configs sur 31 sont des estimations `fibaLeague()` (paceBaseline 83.0,
    // sdTotal 14.5). Aucune ne doit produire de marché.
    const faux = getAllLeagueIds().filter(isBasketballLeagueCalibrated);
    expect(faux.sort()).toEqual(["eurocup", "euroleague", "nba", "wnba"]);
  });

  test("le sélecteur de ligues calibrées ne renvoie que des ligues mesurées", () => {
    for (const id of calibratedBasketballLeagues()) {
      expect(isBasketballLeagueCalibrated(id)).toBe(true);
    }
  });
});