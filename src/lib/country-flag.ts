// Drapeaux émoji par pays — module FEUILLE extrait de bsd-football-fetcher
// (bead 4ym0) : les composants client (cards football/tennis/calendar)
// n'ont besoin QUE de countryFlag ; importer le fetcher entier tirait
// football-fbref-advanced (require("fs") server-only) dans le bundle client
// → Turbopack « Can't resolve 'fs' » → 500 sur TOUT le dev local.

const FLAG = (code: string) =>
  String.fromCodePoint(0x1f1e6 + code.charCodeAt(0) - 65, 0x1f1e6 + code.charCodeAt(1) - 65);

/** Mapping pays (nom complet) → code ISO 2 lettres pour le drapeau. */
export const COUNTRY_TO_CODE: Record<string, string> = {
  England: "GB",
  France: "FR",
  Spain: "ES",
  Germany: "DE",
  Italy: "IT",
  Portugal: "PT",
  Netherlands: "NL",
  Belgium: "BE",
  Scotland: "GB",
  Mexico: "MX",
  USA: "US",
  Brazil: "BR",
  Argentina: "AR",
  Sweden: "SE",
  Norway: "NO",
  Denmark: "DK",
  Poland: "PL",
  Romania: "RO",
  Bulgaria: "BG",
  Greece: "GR",
  Turkey: "TR",
  Morocco: "MA",
  Tunisia: "TN",
  Nigeria: "NG",
  "South Korea": "KR",
  Japan: "JP",
  China: "CN",
  Australia: "AU",
  Colombia: "CO",
  "Saudi Arabia": "SA",
  "United Arab Emirates": "AE",
  UAE: "AE",
  Croatia: "HR",
  Switzerland: "CH",
  Austria: "AT",
  Czechia: "CZ",
  "Czech Republic": "CZ",
  Ukraine: "UA",
  Russia: "RU",
  Serbia: "RS",
  Chile: "CL",
  Uruguay: "UY",
  Peru: "PE",
  Ecuador: "EC",
  Paraguay: "PY",
  Bolivia: "BO",
  Venezuela: "VE",
  Egypt: "EG",
  Algeria: "DZ",
  "Ivory Coast": "CI",
  Ghana: "GH",
  Senegal: "SN",
  Cameroon: "CM",
  "South Africa": "ZA",
  Canada: "CA",
  India: "IN",
  Indonesia: "ID",
  Thailand: "TH",
  Malaysia: "MY",
  Vietnam: "VN",
  Qatar: "QA",
  Iran: "IR",
  Israel: "IL",
  Cyprus: "CY",
  Finland: "FI",
  Ireland: "IE",
  Hungary: "HU",
  Slovakia: "SK",
  Slovenia: "SI",
};

/**
 * Génère un drapeau émoji pour n'importe quel pays (nom complet ou code ISO).
 *
 * Le nom est d'abord cherché dans `COUNTRY_TO_CODE`, puis dans une liste de
 * **variantes frequentatives** (l'API BSD dit « Austria », pas « Austrian » ; le
 * Top 10 football raisonne sur des libellés de ligue, pas sur des noms de pays).
 * Sans ces variantes, « Austrian Bundesliga » et une trentaine des 64 ligues du
 * backtest tombaient sous « Autres pays » ou affichaient un globe.
 *
 * Dernier recours : 🌍 — un pays non identifié, pas une image cassée.
 */
export function countryFlag(country: string): string {
  if (!country) return "\uD83C\uDF0D"; // 🌍
  // Code ISO 2 lettres direct
  if (country.length === 2 && /^[A-Z]{2}$/.test(country)) {
    return FLAG(country);
  }
  // Mapping nom complet → code
  const code = COUNTRY_TO_CODE[country] ?? COUNTRY_ALIASES[country];
  if (code) return FLAG(code);
  return "\uD83C\uDF0D"; // 🌍
}

/**
 * Variantes de nom de pays.
 *
 * `COUNTRY_TO_CODE` garde la priorité ; cette table ne rattrape que les libellés que
 * le flux BSD produit et que personne n'a listés (« Austria », « Turkiye », …).
 *
 * ⚠️ **Uniquement des codes ISO 3166-1 alpha-2 valides.** `FLAG()` calcule deux Regional
 * Indicator Symbols à partir des deux premières lettres : un code de subdivision
 * (`GB-SCT`, `INT`) produirait un drapeau arbitraire et trompeur. Les drapeaux de
 * subdivision passent par `getFlagUrl` (flagcdn), qui sait les servir.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  Austria: "AT",
  Czechia: "CZ",
  Czech: "CZ",
  Turkey: "TR",
  Turkiye: "TR",
  Russia: "RU",
  Switzerland: "CH",
  "South Korea": "KR",
  Japan: "JP",
  "United States": "US",
  "Hong Kong": "HK",
  "Saudi Arabia": "SA",
  "United Arab Emirates": "AE",
  Tunisia: "TN",
  Algeria: "DZ",
  Morocco: "MA",
  Egypt: "EG",
  Nigeria: "NG",
  Ghana: "GH",
  "Ivory Coast": "CI",
  "South Africa": "ZA",
  Australia: "AU",
  Canada: "CA",
  Colombia: "CO",
  Uruguay: "UY",
  Paraguay: "PY",
  Peru: "PE",
  Chile: "CL",
  Venezuela: "VE",
  Ecuador: "EC",
  "Costa Rica": "CR",
  Ireland: "IE",
};
