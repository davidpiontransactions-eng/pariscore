// Logos handball locaux + drapeaux ligues (aucun hotlink en prod).
// Sources : TheSportsDB (licence CC BY-NC, badges r2.thesportsdb.com).
// Couverture réelle : l'endpoint search_all_leagues.php?s=Handball ne retourne
// que 5 ligues → 4 logos mappés ; le reste = drapeau seul (fallback propre).

import { countryFlag } from "@/lib/top-matches/types";

/** Normalisation insensible accents/casse/ponctuation pour le matching. */
export function normHandballName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/* ─── Logos ligues (clés normalisées ; "||pays" = portée pays) ─── */

const LEAGUE_LOGOS: Record<string, string> = {
  // Starligue (logo French LNH Division 1)
  starligue: "/logos/handball/leagues/starligue.png",
  // Danemark domestique (logo Danish Mens Handball League, fallback générique)
  "herrehandboldligaen": "/logos/handball/leagues/herre-handbold.png",
  "1division||denmark": "/logos/handball/leagues/herre-handbold.png",
  "1divisionwomen||denmark": "/logos/handball/leagues/herre-handbold.png",
  "danishcup||denmark": "/logos/handball/leagues/herre-handbold.png",
  // Coupes d'Europe EHF
  "championsleaguewomen": "/logos/handball/leagues/ehf-champions-league.png",
  "europeancup": "/logos/handball/leagues/ehf-european-league.png",
};

/** Chemin du logo d'une ligue, ou null si non couvert (fallback drapeau). */
export function leagueLogo(leagueName: string, country?: string): string | null {
  const n = normHandballName(leagueName);
  if (country) {
    const scoped = LEAGUE_LOGOS[`${n}||${normHandballName(country)}`];
    if (scoped) return scoped;
  }
  return LEAGUE_LOGOS[n] ?? null;
}

/* ─── Logos équipes (clés normalisées ; scan includes comme hockey) ─── */

const TEAM_LOGOS: Record<string, string> = {
  kiel: "/logos/handball/teams/kiel.png",
  flensburg: "/logos/handball/teams/flensburg.png",
  fuchseberlin: "/logos/handball/teams/fuechse-berlin.png",
  goppingen: "/logos/handball/teams/goeppingen.png",
  gummersbach: "/logos/handball/teams/gummersbach.png",
  hsgwetzlar: "/logos/handball/teams/wetzlar.png",
  wetzlar: "/logos/handball/teams/wetzlar.png",
  erlangen: "/logos/handball/teams/erlangen.png",
  lemgo: "/logos/handball/teams/lemgo.png",
  hamburg: "/logos/handball/teams/hamburg.png",
  stuttgart: "/logos/handball/teams/stuttgart.png",
  nantes: "/logos/handball/teams/nantes.png",
  montpellier: "/logos/handball/teams/montpellier.png",
  chartres: "/logos/handball/teams/chartres.png",
  // StarLigue 2026/27 — 15/16 clubs (Caen : site officiel derrière challenge
  // Cloudflare → fallback initiales ; sources scripts/fetch-handball-logos.mjs)
  chamberysavoie: "/logos/handball/teams/chambery-savoie.png",
  cessonrennesmetropole: "/logos/handball/teams/cesson-rennes-metropole.png",
  cessonrennes: "/logos/handball/teams/cesson-rennes-metropole.png", // variante « HBC Cesson-Rennes »
  dunkerque: "/logos/handball/teams/dunkerque.png",
  limoges: "/logos/handball/teams/limoges.png",
  nimes: "/logos/handball/teams/nimes.png",
  provenceaix: "/logos/handball/teams/provence-aix.png",
  aix: "/logos/handball/teams/provence-aix.png",
  saran: "/logos/handball/teams/saran.png",
  selestat: "/logos/handball/teams/selestat.png",
  straphael: "/logos/handball/teams/st-raphael.png",
  saintraphael: "/logos/handball/teams/st-raphael.png",
  paris: "/logos/handball/teams/psg.png", // variante « Paris » (BE/LNH) vs « PSG » (flashscore)
  toulouse: "/logos/handball/teams/toulouse.png",
  tremblay: "/logos/handball/teams/tremblay.png",
  barcelona: "/logos/handball/teams/barcelona.png",
  magdeburg: "/logos/handball/teams/magdeburg.png",
  kielce: "/logos/handball/teams/kielce.png",
  szeged: "/logos/handball/teams/szeged.png",
  aalborg: "/logos/handball/teams/aalborg.png",
  vardar: "/logos/handball/teams/vardar.png",
  celje: "/logos/handball/teams/celje.png",
  ademar: "/logos/handball/teams/ademar.png", // Ademar
  aguassantas: "/logos/handball/teams/aguas-santas.png", // Aguas Santas
  alingsas: "/logos/handball/teams/alingsas.png", // Alingsas
  amicitiazurich2: "/logos/handball/teams/amicitia-zurich-2.png", // Amicitia Zurich 2
  amicitiazurichw: "/logos/handball/teams/amicitia-zurich-w.png", // Amicitia Zurich W
  balatonfuredi: "/logos/handball/teams/balatonfuredi.png", // Balatonfuredi
  bergischer: "/logos/handball/teams/bergischer.png", // Bergischer
  bjerringbrosilkeborg: "/logos/handball/teams/bjerringbro-silkeborg.png", // Bjerringbro/Silkeborg
  bozen: "/logos/handball/teams/bozen.png", // Bozen
  brestbretagnewfra: "/logos/handball/teams/brest-bretagne-w-fra.png", // Brest Bretagne W (Fra)
  caseriociudadreal: "/logos/handball/teams/caserio-ciudad-real.png", // Caserio Ciudad Real
  chekhovskiyemedvedi: "/logos/handball/teams/chekhovskiye-medvedi.png", // Chekhovskiye Medvedi
  cocks2: "/logos/handball/teams/cocks-2.png", // Cocks 2
  conversano: "/logos/handball/teams/conversano.png", // Conversano
  drammen: "/logos/handball/teams/drammen.png", // Drammen
  drott: "/logos/handball/teams/drott.png", // Drott
  elverum: "/logos/handball/teams/elverum.png", // Elverum
  emsdetten: "/logos/handball/teams/emsdetten.png", // Emsdetten
  fasano: "/logos/handball/teams/fasano.png", // Fasano
  fredericia: "/logos/handball/teams/fredericia.png", // Fredericia
  gog: "/logos/handball/teams/gog.png", // GOG
  gorenje: "/logos/handball/teams/gorenje.png", // Gorenje
  granitaskarysltu: "/logos/handball/teams/granitas-karys-ltu.png", // Granitas-Karys (Ltu)
  grindsted: "/logos/handball/teams/grindsted.png", // Grindsted
  guif: "/logos/handball/teams/guif.png", // Guif
  gwardiaopole: "/logos/handball/teams/gwardia-opole.png", // Gwardia Opole
  gyorwhun: "/logos/handball/teams/gyor-w-hun.png", // Gyor W (Hun)
  hallby: "/logos/handball/teams/hallby.png", // Hallby
  hammarby: "/logos/handball/teams/hammarby.png", // Hammarby
  hannoverburgdorf: "/logos/handball/teams/hannover-burgdorf.png", // Hannover-Burgdorf
  haslumhk: "/logos/handball/teams/haslum-hk.png", // Haslum HK
  haslumw: "/logos/handball/teams/haslum-w.png", // Haslum W
  hbwbalingenweilstetten: "/logos/handball/teams/hbw-balingen-weilstetten.png", // HBW Balingen-Weilstetten
  hckriens: "/logos/handball/teams/hc-kriens.png", // HC Kriens
  helsingborg: "/logos/handball/teams/helsingborg.png", // Helsingborg
  huttenberg: "/logos/handball/teams/huttenberg.png", // Huttenberg
  kadettenschaffhausen: "/logos/handball/teams/kadetten-schaffhausen.png", // Kadetten Schaffhausen
  kalisz: "/logos/handball/teams/kalisz.png", // Kalisz
  kolding: "/logos/handball/teams/kolding.png", // Kolding
  kolstad: "/logos/handball/teams/kolstad.png", // Kolstad
  konskie: "/logos/handball/teams/konskie.png", // Konskie
  kristiansand: "/logos/handball/teams/kristiansand.png", // Kristiansand
  legionowo: "/logos/handball/teams/legionowo.png", // Legionowo
  lubeckschwartau: "/logos/handball/teams/lubeck-schwartau.png", // Lubeck-Schwartau
  lugi: "/logos/handball/teams/lugi.png", // Lugi
  malmo: "/logos/handball/teams/malmo.png", // Malmo
  meshkovbrest: "/logos/handball/teams/meshkov-brest.png", // Meshkov Brest
  minden: "/logos/handball/teams/minden.png", // Minden
  mmtskwidzyn: "/logos/handball/teams/mmts-kwidzyn.png", // MMTS Kwidzyn
  mors: "/logos/handball/teams/mors.png", // Mors
  mtmelsungen: "/logos/handball/teams/mt-melsungen.png", // MT Melsungen
  nexe: "/logos/handball/teams/nexe.png", // Nexe
  nfhwden: "/logos/handball/teams/nfh-w-den.png", // NFH W (Den)
  nlubbecke: "/logos/handball/teams/n-lubbecke.png", // N-Lubbecke
  nordsjaelland: "/logos/handball/teams/nordsjaelland.png", // Nordsjaelland
  odensewden: "/logos/handball/teams/odense-w-den.png", // Odense W (Den)
  onnereds: "/logos/handball/teams/onnereds.png", // Onnereds
  pfadiwinterthur: "/logos/handball/teams/pfadi-winterthur.png", // Pfadi Winterthur
  porto: "/logos/handball/teams/porto.png", // Porto
  potaissaturdarou: "/logos/handball/teams/potaissa-turda-rou.png", // Potaissa Turda (Rou)
  psg: "/logos/handball/teams/psg.png", // PSG
  puentegenil: "/logos/handball/teams/puente-genil.png", // Puente Genil
  redbergslids: "/logos/handball/teams/redbergslids.png", // Redbergslids
  rheinneckar: "/logos/handball/teams/rhein-neckar.png", // Rhein-Neckar
  ribeesbjerg: "/logos/handball/teams/ribe-esbjerg.png", // Ribe-Esbjerg
  rkzagreb: "/logos/handball/teams/rk-zagreb.png", // RK Zagreb
  sandefjordtif: "/logos/handball/teams/sandefjord-tif.png", // Sandefjord TIF
  savehof: "/logos/handball/teams/savehof.png", // Savehof
  savehofw: "/logos/handball/teams/savehof-w.png", // Savehof W
  skanderborgagf: "/logos/handball/teams/skanderborg-agf.png", // Skanderborg AGF
  skanela: "/logos/handball/teams/skanela.png", // Skanela
  skjern: "/logos/handball/teams/skjern.png", // Skjern
  skovde: "/logos/handball/teams/skovde.png", // Skovde
  sonderjyske: "/logos/handball/teams/sonderjyske.png", // Sonderjyske
  sporting: "/logos/handball/teams/sporting.png", // Sporting
  stavangerw: "/logos/handball/teams/stavanger-w.png", // Stavanger W
  storhamarwnor: "/logos/handball/teams/storhamar-w-nor.png", // Storhamar W (Nor)
  tumba: "/logos/handball/teams/tumba.png", // Tumba
  vaciw: "/logos/handball/teams/vaci-w.png", // Vaci W
  wackerthun: "/logos/handball/teams/wacker-thun.png", // Wacker Thun
  wybrzezegdanskii: "/logos/handball/teams/wybrzeze-gdansk-ii.png", // Wybrzeze Gdansk II
  ystadsif: "/logos/handball/teams/ystads-if.png", // Ystads IF
  zurich: "/logos/handball/teams/zurich.png", // Zurich

  bahrain: "/logos/handball/teams/bahrain.png", // Bahrain
  china: "/logos/handball/teams/china.png", // China
  chinaw: "/logos/handball/teams/china-w.png", // China W
  hongkong: "/logos/handball/teams/hong-kong.png", // Hong Kong
  iran: "/logos/handball/teams/iran.png", // Iran
  japan: "/logos/handball/teams/japan.png", // Japan
  japanw: "/logos/handball/teams/japan-w.png", // Japan W
  kazakhstan: "/logos/handball/teams/kazakhstan.png", // Kazakhstan
  kuwait: "/logos/handball/teams/kuwait.png", // Kuwait
  ostrowwielkopolski: "/logos/handball/teams/ostrow-wielkopolski.png", // Ostrow Wielkopolski
  qatar: "/logos/handball/teams/qatar.png", // Qatar
  southkorea: "/logos/handball/teams/south-korea.png", // South Korea
  southkoreaw: "/logos/handball/teams/south-korea-w.png", // South Korea W
  wislaplock: "/logos/handball/teams/wisla-plock.png", // Wisla Plock
  uzbekistanw: "/logos/handball/teams/uzbekistan-w.png", // Uzbekistan W
};

/** Chemin du logo d'une équipe, ou null si non couverte (fallback initiales). */
export function teamLogoUrl(teamName: string): string | null {
  const n = normHandballName(teamName);
  if (!n) return null;
  if (TEAM_LOGOS[n]) return TEAM_LOGOS[n];
  for (const [key, url] of Object.entries(TEAM_LOGOS)) {
    if (key.length >= 4 && (n.includes(key) || key.includes(n))) return url;
  }
  return null;
}

/* ─── Pays des ligues (généré depuis data/flashscore_handball.json) ─── */

// Ligues ambiguës exclues (même nom, plusieurs pays) : Extraliga (CZ/SK),
// 1. Division + 1. Division Women (DK/NO), Superleague (RU/MK).
const LEAGUE_COUNTRY: Record<string, string> = {
  "Asian Games": "ASIA",
  "Asian Games Women": "ASIA",
  "DHB Pokal": "GERMANY",
  "Andebol 1": "PORTUGAL",
  "Danish Cup": "DENMARK",
  "NM Cup": "NORWAY",
  Handbollsligan: "SWEDEN",
  "I Liga": "POLAND",
  NLA: "SWITZERLAND",
  "Serie A": "ITALY",
  Bundesliga: "GERMANY",
  "Elkjop-ligaen": "NORWAY",
  "Elkjop-ligaen Women": "NORWAY",
  "I Liga Women": "POLAND",
  Superlig: "TURKEY",
  "Slovakia Cup": "SLOVAKIA",
  "Champions League Women": "EUROPE",
  "2. Bundesliga": "GERMANY",
  Superliga: "POLAND",
  "Suomen Cup": "FINLAND",
  "European Cup": "EUROPE",
  "1. NLB Liga": "SLOVENIA",
  "Liga ASOBAL": "SPAIN",
  Allsvenskan: "SWEDEN",
  "Schweizer Cup": "SWITZERLAND",
  A1: "GREECE",
  "ARKUS Liga": "SERBIA",
  "WHA Women": "AUSTRIA",
  "Premijer liga": "CROATIA",
  "Herre Handbold Ligaen": "DENMARK",
  Starligue: "FRANCE",
  "NB I": "HUNGARY",
  "1a Divisao Women": "PORTUGAL",
  "Superleague Women": "RUSSIA",
  "Schweizer Cup Women": "SWITZERLAND",
  Meistriliiga: "ESTONIA",
  "Division 1": "BELARUS",
  "1. HRL Women": "CROATIA",
  "Super Handball League": "EUROPE",
  "2. Bundesliga Women": "GERMANY",
  "NB I Women": "HUNGARY",
  "Olis Deild Women": "ICELAND",
  Eredivisie: "NETHERLANDS",
  "Eredivisie Women": "NETHERLANDS",
  "Central League Women": "POLAND",
  "Swedish Cup": "SWEDEN",
  "Swedish Cup Women": "SWEDEN",
  HLA: "AUSTRIA",
  MRHL: "EUROPE",
  "Lietuvos Lyga": "LITHUANIA",
  "AXA League": "LUXEMBOURG",
  "Allsvenskan Women": "SWEDEN",
};

/** Pays d'une ligue (fallback quand le match ne porte pas le pays). */
export function leagueCountry(leagueName: string, known?: string): string {
  if (known) return known;
  return LEAGUE_COUNTRY[leagueName] ?? "";
}

/* ─── Drapeaux (noms flashscore MAJUSCULES → countryFlag) ─── */

const COUNTRY_ISO: Record<string, string> = {
  GERMANY: "DE",
  FRANCE: "FR",
  SPAIN: "ES",
  DENMARK: "DK",
  NORWAY: "NO",
  SWEDEN: "SE",
  HUNGARY: "HU",
  PORTUGAL: "PT",
  ITALY: "IT",
  AUSTRIA: "AT",
  SWITZERLAND: "CH",
  NETHERLANDS: "NL",
  POLAND: "PL",
  "CZECH REPUBLIC": "CZ",
  SLOVAKIA: "SK",
  CROATIA: "HR",
  SLOVENIA: "SI",
  SERBIA: "RS",
  GREECE: "GR",
  LUXEMBOURG: "LU",
  LITHUANIA: "LT",
  ESTONIA: "EE",
  FINLAND: "FI",
  ICELAND: "IS",
  TURKEY: "TR",
  BELARUS: "BY",
  "NORTH MACEDONIA": "MK",
  RUSSIA: "RU",
  EUROPE: "EU",
};

/** Drapeau emoji d'un pays flashscore (EUROPE→🇪🇺, ASIA→🌏). */
export function leagueFlag(country: string | undefined | null): string {
  if (!country) return "";
  const upper = country.toUpperCase();
  if (upper === "ASIA") return "🌏";
  const iso = COUNTRY_ISO[upper];
  if (iso) return countryFlag(iso);
  // Repli : countryFlag gère déjà noms minuscules + codes ISO
  return countryFlag(country);
}
