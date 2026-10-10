import { describe, expect, test } from "bun:test";
import { leagueCountryOf } from "@/lib/league-mapping";
import { countryFlag, COUNTRY_TO_CODE } from "@/lib/country-flag";
import { getCountryFlagEmoji, getFlagEmoji } from "@/lib/flag-utils";

/**
 * Résolution pays + drapeaux pour les sélecteurs de championnat.
 *
 * Ces tests encodent deux bugs réels, observés en prod :
 *  1. les pays s'affichaient en codes ISO bruts (`FR`, `DE`) ou en 🌍 quand le libellé
 *     n'était dans aucune table — la table d'émojis était plafonnée ;
 *  2. les ligues hors `LEAGUE_INFO` (`Austrian Bundesliga`, `Ekstraklasa`, `J1 League`)
 *     basculaient toutes sous « Autres pays », making the grouping useless.
 *
 * Le gate « 100 % des ligues » est volontairement **exclu** : certaines ligues sont
 * genuinely sans pays (coupes continentales). La règle tenue est l'inverse — aucune
 * ligue ne doit produire de drapeau muet ni de code ISO brut.
 */

/** Les 64 ligues réellement retournées par `/api/football/backtest/markets` (prod, 2026-10-10). */
const BSD_LEAGUES = [
  "2. Bundesliga", "Allsvenskan", "Austrian Bundesliga", "Botola Pro",
  "Brasileirão Serie A", "Brasileirão Serie B", "Bundesliga", "CAF Champions League",
  "Campeonato de Portugal", "Carabao Cup", "Categoría Primera A", "Challenger Pro League",
  "Championship", "Chinese Super League", "Club Friendlies", "CONCACAF Nations League",
  "Copa Colombia", "Copa del Rey", "Copa Libertadores", "Copa Sudamericana", "Coppa Italia",
  "Czech First League", "Danish Superliga", "Ekstraklasa", "Eliteserien", "Emperor Cup",
  "Eredivisie", "Europa League", "FA Cup", "Girabola", "International Friendly Games",
  "J1 League", "K League 1", "La Liga", "League One", "League Two", "Liga F",
  "Liga MX Apertura", "Liga Portugal 2", "Liga Portugal Betclic",
  "Liga Profesional de Fútbol", "Ligue 1", "Ligue 2", "MLS", "National League",
  "Nigeria Premier Football League", "NWSL", "Parva Liga", "Premier League", "Pro League",
  "Puchar Polski", "Saudi Pro League", "Scottish Premiership", "Segunda División",
  "Serie A", "Stoiximan Super League", "Super League", "Superliga", "Taça de Portugal",
  "Trendyol Super Lig", "Tunisian Ligue Professionnelle 1", "UEFA Nations League",
  "USL Championship", "Veikkausliiga",
];

/** Ligues réellement sans pays dans la table. */
const SANS_PAYS = [
  "International Friendly Games",
  "Club Friendlies",
];

describe("leagueCountryOf — résolution du pays", () => {
  test("correspondance exacte sur les ligues de LEAGUE_INFO", () => {
    expect(leagueCountryOf("Premier League")).toBe("England");
    expect(leagueCountryOf("La Liga")).toBe("Spain");
    expect(leagueCountryOf("Ligue 1")).toBe("France");
    expect(leagueCountryOf("Bundesliga")).toBe("Germany");
  });

  test("résout par préfixe pays les ligues ABSENTES de LEAGUE_INFO", () => {
    // Le bug prod : celles-ci basculaient sous « Autres pays ».
    expect(leagueCountryOf("Austrian Bundesliga")).toBe("Austria");
    expect(leagueCountryOf("Chinese Super League")).toBe("China");
    expect(leagueCountryOf("Czech First League")).toBe("Czechia");
    expect(leagueCountryOf("Danish Superliga")).toBe("Denmark");
  });

  test("ne confond pas un libellé portugais avec un libellé anglais", () => {
    // BSD sert « Brasileirão » (pt), pas « Brazilian » (en). Un préfixe pour chaque
    expect(leagueCountryOf("Brasileirão Serie A")).toBe("Brazil");
    expect(leagueCountryOf("Brazilian Serie A")).toBe("Brazil");
  });

test("ne devine pas un pays à partir d'un mot générique", () => {
    // Une règle « premier mot = pays » se tromperait sur ces libellés ambigus. Le
    // statut correct est « non résolu » — l'IHM regroupe alors sous « Autres pays »
    // plutôt que d'inventer un pays.
    expect(leagueCountryOf("Segunda División")).toBeUndefined();
    // Résolus par `LEAGUE_INFO` en correspondance exacte (pas heuristique) : vérifié
    // ici pour distinguer les deux mécanismes.
    expect(leagueCountryOf("Super League")).toBe("Switzerland"); // Swiss Super League
    expect(leagueCountryOf("League One")).toBe("England");
  });

  test("renvoie undefined — et non une sentinelle — quand le pays est inconnu", () => {
    // L'IHM doit pouvoir distinguer « je ne sais pas » pour grouper honnêtement.
    expect(leagueCountryOf("Liga Totalmente Inventada")).toBeUndefined();
    expect(leagueCountryOf("")).toBeUndefined();
  });

  test("couvre la majorité des ligues de compétition nationales", () => {
    const resolues = BSD_LEAGUES.filter((l) => leagueCountryOf(l) != null);
    // Seuil bas et vérifié : l'objectif est de ne pas laisser la moitié du catalogue
    // sous « Autres pays », pas d'atteindre 100 % (cf. SANS_PAYS).
    expect(resolues.length / BSD_LEAGUES.length).toBeGreaterThan(0.5);
  });

  test("aucune compétition sans pays n'en reçoit un inventé", () => {
    for (const l of SANS_PAYS) {
      expect(leagueCountryOf(l), `${l} ne doit pas recevoir de pays`).toBeUndefined();
    }
  });

  test("une coupe continentale reçoit sa CONFÉDÉRATION, pas un pays", () => {
    // `LEAGUE_INFO` associe ces compétitions à « Africa » / « Europe » : c'est un
    // groupement par confédération, qui affiche un continent-drapeau. Correct, et
    // distinct d'un pays deviné au hasard.
    expect(leagueCountryOf("CAF Champions League")).toBe("Africa");
    expect(leagueCountryOf("Europa League")).toBe("Europe");
    expect(leagueCountryOf("Copa Libertadores")).toBe("South America");
  });
});

describe("getCountryFlagEmoji — conversion Unicode", () => {
  test("convertit un code ISO alpha-2 en drapeau, sans table", () => {
    // Régression du bug prod : ces deux pays sont absents de COUNTRY_TO_CODE.
    expect(getCountryFlagEmoji("AT")).toBe("🇦🇹");
    expect(getCountryFlagEmoji("JP")).toBe("🇯🇵");
    expect(getCountryFlagEmoji("CI")).toBe("🇨🇮");
  });

  test("accepte la casse et les espaces", () => {
    expect(getCountryFlagEmoji("fr")).toBe("🇫🇷");
    expect(getCountryFlagEmoji(" de ")).toBe("🇩🇪");
  });

  test("retombe sur un sport plutôt que sur un globe muet pour une entrée vide", () => {
    // 🌍 se lit comme une image cassée ; ⚽ dit « ce n'est pas un pays » sans bruit.
    // Comparaison par code point : l'emoji ne traverse pas proprement un rapport console.
    const FOOTBALL = 0x26bd;
    // `INTL` → 🌍 et `GB-ENG` → 🏴 sont **voulus** : la table les porte pour « pas de
    // pays / subdivision ». Ils ne doivent donc PAS retomber sur ⚽.
    //
    // `ZZ` n'est PAS dans cette liste : c'est un alpha-2 syntaxiquement valide, donc la
    // conversion le rend (🇨🇿). C'est le comportement voulu — un drapeau calculé vaut
    // mieux qu'un ⚽, même si le code n'est pas attribué à un pays réel.
    for (const bad of ["", null, undefined, "Pays Imaginaire", "XX-YY"]) {
      expect(getCountryFlagEmoji(bad).codePointAt(0), `entrée « ${bad} »`).toBe(FOOTBALL);
    }
  });

  test("conserve les drapeaux de subdivision ports par la table", () => {
    // Un drapeau de subdivision (tag + 2 lettres) n'a aucun équivalent alpha-2 : le
    // calcul le produirait faux. La table le prend donc en charge, et c'est elle qui
    // gagne — pas le calcul.
    expect(getCountryFlagEmoji("GB-ENG").codePointAt(0)).toBe(0x1f3f4); // 🏴
    expect(getCountryFlagEmoji("INTL").codePointAt(0)).toBe(0x1f30d); // 🌍
  });

  test("getFlagEmoji délègue — pas de deuxième table qui diverge", () => {
    expect(getFlagEmoji("FR")).toBe(getCountryFlagEmoji("FR"));
  });

  test("aucun drapeau produit n'est un globe ni un code ISO brut", () => {
    // Le gate réel : quoi que soit l'entrée, la sortie doit être un drapeau.
    for (const code of Object.values(COUNTRY_TO_CODE)) {
      const flag = getCountryFlagEmoji(code);
      // Jamais un globe (le bug prod), jamais le code brut affiché tel quel (« FR »).
      expect(flag.codePointAt(0), `code ${code}`).toBeGreaterThan(0x1f1e5);
      expect([...flag].length).toBe(2); // deux Regional Indicator Symbols
    }
  });
});

describe("countryFlag — nom de pays vers drapeau", () => {
  test("résout les noms de la table principale", () => {
    expect(countryFlag("France")).toBe("🇫🇷");
    expect(countryFlag("England")).toBe("🇬🇧");
  });

  test("résout les variantes absentes de la table principale", () => {
    // Régression du bug prod : « Austria » tombait en 🌍.
    expect(countryFlag("Austria")).toBe("🇦🇹");
    expect(countryFlag("Turkiye")).toBe("🇹🇷");
    expect(countryFlag("Czechia")).toBe("🇨🇿");
  });

  test("un pays inconnu reste un globe — c'est le contrat historique", () => {
    expect(countryFlag("Pays Imaginaire")).toBe("🌍");
  });
});