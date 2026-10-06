/**
 * basketball-vitibet-league.ts — table d'appariement Vitibet → catalogue
 * `BasketballLeagueId`.
 *
 * ⚠️ WHY EXPLICITE ET NON FLOU : `leagueSimilarity` (basketball-entity-match)
 * est un score Jaro-Winkler avec seuil, conçu pour l'appariement d'équipes.
 * L'appliquer à des ligues produirait des fusions plausibles et fausses — le
 * dossier `handball` a déjà payé ce prix (cf. `team_name_mapping.py`, 150
 * overrides manuels). Une ligue de basketball fusionnée par erreur affiche
 * des fixtures d'une compétition dans l'onglet d'une autre : invisible en test
 * d'intégration, franchement trompeur à l'écran. Ici, chaque alias est écrit à
 * la main et justifié, et tout ce qui n'est pas listé renvoie `null`.
 *
 * ⚠️ DEUX PROPRIÉTÉS DISTINCTES, à ne pas confondre :
 *
 *   1. `toBasketballLeagueId` — APPARIEMENT : quel nom Vitibet correspond à
 *      quelle clé du catalogue. Question de nommage.
 *
 *   2. `isBasketballLeagueCalibrated` — CALIBRAGE : existe-t-il une base
 *      MESURÉE pour cette ligue, sans quoi aucun marché (total, marge) ne peut
 *      être publié. Question de données.
 *
 * Une ligue peut donc être appariée ET non calibrée (ex. `lba`, mappée mais
 * absente de `basketball_match_history`). La distinguer est le but de ce
 * module : la route backtest s'en sert pour renvoyer `available: false` au
 * lieu d'appliquer la médiane d'une autre ligue.
 *
 * SOURCE DES MESURES : `basketball_match_history` (7 313 matchs, mesuré le
 * 2026-10-05, prolongations exclues) → `src/lib/basketball-calibration.ts`.
 */

import type { BasketballLeagueId } from "./basketball-data";
import { BASKET_LEAGUE_CALIBRATION } from "./basketball-calibration";

/**
 * Alias Vitibet → clé catalogue.
 *
 * Clé = nom EXACT tel que Vitibet l'écrit dans `league_name`. Volontairement
 * sensible à la casse et aux espaces : normaliser ici rouvrirait les collisions
 * (« LNB » vs « LNB Pro ») que la table existe précisément pour trancher.
 */
const VITIBET_ALIASES: Readonly<Record<string, BasketballLeagueId>> = {
  // ── USA ───────────────────────────────────────────────
  "NBA": "nba",
  "NBA W": "wnba",

  // ── Europe / coupes ──────────────────────────────────
  "Euroleague": "euroleague",
  "Champions League": "eurocup",

  // ── Domestiques : UNIQUEMENT ceux vérifiés contre le champ `country` réel
  // du dump Vitibet. Méthode : chaque alias listé ici porte en commentaire le
  // pays lu dans la source ; un alias sans pays vérifiable n'entre pas.
  "Super Ligi": "bsl", // Vitibet country=Turkey, catalogue bsl=Turquie
  "BBL": "bbl", // Vitibet country=Germany, catalogue bbl=Allemagne
  "Greek Basket League": "greek", // Vitibet country=Greece

  // ── Amériques / Asie ─────────────────────────────────
  "NBL": "nbl", // Vitibet country=Australia, catalogue nbl=Australie
  "KBL": "kbl", // Vitibet country=South Korea, catalogue kbl=Corée du Sud
  "CBA": "cba", // Vitibet country=China — nom catalogue identique
};

/**
 * Alias REFUSÉS après vérification du champ `country` du dump Vitibet.
 *
 * Ces sigles paraissaient être un mapping évident et ne l'étaient pas : le même
 * sigle désigne des compétitions différentes selon les pays.
 *
 *   « Liga A » → Vitibet country=**Argentina** (Liga Nacional de Básquet).
 *               Le catalogue n'a pas de clé Argentine (`arg` existe mais son
 *               label est « Liga Nacional »). `lba` est l'Italie : mappée ici,
 *               elle affichait des matchs argentins dans l'onglet italien.
 *   « LNB »    → Vitibet country=**Chile** (Liga Nacional de Básquet de Chile).
 *               Le sigle français renvoie à `lnb` (Betclic Élite). Un match
 *               chilien dans l'onglet France serait indétectable en test.
 *
 * ⚠️ Ces refus sont le résultat d'une VÉRIFICATION, pas d'une prudence de
 * style : le dump Vitibet porte un champ `country` par ligue, et c'est lui qui
 * tranche. Les ligues listées ici gardent leur pays réel pour qu'une reprise
 * puisse les évaluer contre la bonne clé.
 *
 * Ce sont exactement les fusions « plausibles et fausses » que ce module
 * refuse par construction.
 */
export const VITIBET_REJECTED_ALIASES: Readonly<
  Record<string, { vitibetCountry: string; wouldHaveBeen: BasketballLeagueId }>
> = {
  "Liga A": { vitibetCountry: "Argentina", wouldHaveBeen: "lba" },
  LNB: { vitibetCountry: "Chile", wouldHaveBeen: "lnb" },
};

/**
 * Ligues du dump sans appariement, avec le pays réel de la source.
 *
 * Sert de Liste de travail : une ligne se promoted dans `VITIBET_ALIASES`
 * seulement si son pays correspond à celui de la clé catalogue.
 */
export const VITIBET_UNMAPPED_REFERENCE: Readonly<
  Record<string, { vitibetCountry: string; matches: number }>
> = {
  // `country` = « ABA League » : le champ ne dit pas le pays, donc aucune
  // vérification possible. Le catalogue `aba` = Ex-Yougoslavie, ce qui est
  // plausible mais non prouvé — refusé plutôt que deviné.
  "ABA League": { vitibetCountry: "ABA League", matches: 2 },
  LNBP: { vitibetCountry: "Mexico", matches: 14 },
  "B League": { vitibetCountry: "Japan", matches: 11 },
  TBL: { vitibetCountry: "Turkey", matches: 8 },
  "Liga Femenina W": { vitibetCountry: "Spain", matches: 8 },
  LBP: { vitibetCountry: "Colombia", matches: 7 },
  "LFB W": { vitibetCountry: "France", matches: 6 },
  Korisliiga: { vitibetCountry: "Finland", matches: 5 },
  "ZBL W": { vitibetCountry: "Czech Republic", matches: 5 },
  MPBL: { vitibetCountry: "Philippines", matches: 4 },
  "Premier league": { vitibetCountry: "Iceland", matches: 4 },
  "Prvenstvo BiH": { vitibetCountry: "Bosnia-and-Herzegovina", matches: 2 },
  "Super League": { vitibetCountry: "Russia", matches: 2 },
  "Lega A": { vitibetCountry: "Italy", matches: 2 },
  "BNXT League": { vitibetCountry: "BNXT League", matches: 2 },
  "Canal Digital Ligaen": { vitibetCountry: "Denmark", matches: 2 },
  Superliga: { vitibetCountry: "Kosovo", matches: 1 },
  "Tauron Basket Liga": { vitibetCountry: "Poland", matches: 1 },
  "Divizia A": { vitibetCountry: "Romania", matches: 1 },
  Extraliga: { vitibetCountry: "Slovakia", matches: 1 },
  "Liga UPC": { vitibetCountry: "Slovenia", matches: 1 },
};

/**
 * Appariement EXACT Vitibet → catalogue.
 *
 * Renvoie `null` pour toute ligue non listée : pas de correspondance
 * approximative, pas de `leagueSimilarity`. Un `null` doit rester `null` en
 * aval, jamais devenir une clé par défaut.
 */
export function toBasketballLeagueId(vitibetLeagueName: string): BasketballLeagueId | null {
  const alias = VITIBET_ALIASES[vitibetLeagueName.trim()];
  return alias ?? null;
}

/** Toutes les alias Vitibet connues, pour le sélecteur et les tests. */
export function vitibetLeagueAliases(): Readonly<Record<string, BasketballLeagueId>> {
  return VITIBET_ALIASES;
}

/**
 * La ligue a-t-elle une base MESURÉE pour ses marchés ?
 *
 * `true` ⇔ la ligue figure dans `BASKET_LEAGUE_CALIBRATION`, elle-même
 * dérivée de `basketball_match_history` (totaux et marges par ligue).
 *
 * `false` ne signifie PAS « ligue inconnue » : `lba`, `acb`, `bsl` sont des
 * ligues parfaitement configurées (`LEAGUE_CONFIGS`) dont les paramètres
 * (`paceBaseline`, `sdTotal`) sont des ESTIMATIONS génériques issues de
 * `fibaLeague()`, pas des mesures. Elles peuvent afficher un calendrier mais
 * pas de marché — sinon on réintroduit les constantes fictives supprimées.
 */
export function isBasketballLeagueCalibrated(
  league: BasketballLeagueId,
): boolean {
  const names = CALIBRATION_NAMES[league];
  return names !== undefined && Object.hasOwn(BASKET_LEAGUE_CALIBRATION, names);
}

/** Clés du catalogue mesurées, pour le sélecteur d'onglets. */
export function calibratedBasketballLeagues(): BasketballLeagueId[] {
  return (Object.keys(CALIBRATION_NAMES) as BasketballLeagueId[]).filter(
    isBasketballLeagueCalibrated,
  );
}

/**
 * Clé catalogue → nom utilisé par `basketball_match_history`.
 *
 * ⚠️ N'est PAS l'identifiant ESPN : la table SQLite a été semée avec les noms
 * de la colonne `league` du scraper, qui suit une convention propre.
 */
const CALIBRATION_NAMES: Partial<Record<BasketballLeagueId, string>> = {
  nba: "NBA",
  wnba: "WNBA",
  euroleague: "EuroLeague",
  eurocup: "EuroCup",
};