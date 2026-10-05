/**
 * Registre canonique des ligues handball couvertes par l'historique.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE — bug structurel mesuré le 2026-10-04.
 * `handball_match_history` reçoit des matchs de TROIS scrapers indépendants,
 * qui nutilisent pas la même convention de nommage :
 *
 *   src                │ écriture `league`          │ example
 *   ───────────────────┼────────────────────────────┼──────────────────────
 *   betexplorer        │ `Pays: Ligue`              │ `France: Starligue`
 *   flashscore         │ `Ligue` (sans pays)        │ `Starligue`
 *   betexplorer-season │ slug interne               │ `starligue`
 *
 * Conséquence avant ce registre : 259 couples (league, src) distincts pour
 * ~150 ligues réelles, et **trois lignes différentes pour le même championnat**.
 * Tout agrégat filtré par ligue était donc faux — silencieusement. La pire
 * panne possible sur un outil de pari : un nombre faux sans trace.
 *
 * Le registre fixe UNE écriture canonique par ligue (`Pays: Ligue`, celle déjà
 * majoritaire en base) et liste les variantes à coalescer. `normalizeHandballLeague`
 * sert à la lecture (défensif : absorbe les rows historiques et toute écriture
 * future divergente), `HAND_BALL_LEAGUES` sert de liste au backtest.
 *
 * Les variantes sont volontairement EXPLICITES, jamais dérivées par heuristique :
 * `Division 1` (7 rows, src=flashscore) est ambigu — cela peut être le championnat
 * polonais I Liga comme le danois. Deviner fusionnerait deux ligues distinctes,
 * ce qui est pire que de laisser la ligne de côté.
 */

/** Une ligue couverte, avec toutes ses écritures connues. */
export type HandballLeague = {
  /** Clé interne stable (le `key` du scraper d'historique). */
  id: string;
  /** Nom canonique — format `Pays: Ligue`, déjà majoritaire en base. */
  name: string;
  /** Pays (colonne `country`). */
  country: string;
  /** Chemin BetExplorer de la page ligue (chemin pur, autorisé robots.txt). */
  path: string;
  /** Toutes les écritures rencontrées pour cette ligue, hors nom canonique. */
  aliases: string[];
};

/**
 * Les 11 ligues du cron `pariscore-cron-handball-history`.
 *
 * `path` est dupliqué depuis `scripts/scrape-handball-history.mjs` : le
 * registre TS ne remplace PAS la liste du scraper (un script node ne peut pas
 * importer du TS), il la décrit pour le côté lecture. Toute évolution doit
 * toucher les deux — voir `handball-league-registry.test.ts` qui compare le
 * registre à la base réelle et échoue si une ligue historisée n'est pas
 * déclarée ici.
 */
export const HAND_BALL_LEAGUES: readonly HandballLeague[] = [
  {
    id: "starligue",
    name: "France: Starligue",
    country: "France",
    path: "/handball/france/starligue/",
    aliases: ["starligue", "Starligue"],
  },
  {
    id: "proligue",
    name: "France: Proligue",
    country: "France",
    path: "/handball/france/proligue/",
    aliases: ["proligue", "Proligue"],
  },
  {
    id: "d1women",
    name: "France: Division 1 Women",
    country: "France",
    path: "/handball/france/division-1-women/",
    aliases: ["d1women"],
  },
  {
    id: "hla",
    name: "Austria: HLA",
    country: "Austria",
    path: "/handball/austria/hla/",
    aliases: ["hla", "HLA"],
  },
  {
    id: "herre",
    name: "Denmark: Herre Handbold Ligaen",
    country: "Denmark",
    path: "/handball/denmark/herre-handbold-ligaen/",
    aliases: ["herre", "Herre Handbold Ligaen"],
  },
  {
    id: "kvindeligaen",
    name: "Denmark: Kvindeligaen Women",
    country: "Denmark",
    path: "/handball/denmark/kvindeligaen-women/",
    aliases: ["kvindeligaen", "Kvindeligaen Women"],
  },
  {
    // Le `key` du scraper est `d2women` mais la ligue est danoise : le chemin
    // BetExplorer fait foi (`/handball/denmark/1-division-women/`). Le nom du
    // `key` est un heritage trompeur, d'ou l'alias explicite vers le nom
    // canonique danois.
    id: "d2women",
    name: "Denmark: 1. Division Women",
    country: "Denmark",
    path: "/handball/denmark/1-division-women/",
    aliases: ["d2women"],
  },
  {
    id: "mol",
    name: "Europe: MOL Liga Women",
    country: "Europe",
    path: "/handball/europe/doprastav-liga-women/",
    aliases: ["mol", "Doprastav liga Women"],
  },
  {
    id: "bundesliga2",
    name: "Germany: 2. Bundesliga",
    country: "Germany",
    path: "/handball/germany/2-bundesliga/",
    aliases: ["bundesliga2", "2. Bundesliga"],
  },
  // ── Ajout 2026-10-05 : Turkey + Romania, pour le backtest des modules Vitibet.
  // Chemins VALIDES avant d'etre codes en dur (sonde avec discoverSeasonLinks,
  // temoin France en controle) : 15 saisons cote Turquie, 18 cote Roumanie.
  // BetExplorer renvoie HTTP 200 sur un chemin inexistant, donc « 200 + 0 saison »
  // est le seul signal de chemin faux — c'est ce qui a fait rejeter une premiere
  // sonde, erronee (majuscule sur /France/ + regex maison au lieu du parseur).
  {
    id: "superlig",
    name: "Turkey: Superlig",
    country: "Turkey",
    path: "/handball/turkey/superlig/",
    aliases: ["superlig", "Superlig", "Turkish Superlig", "Süper Lig"],
  },
  {
    id: "ligaNationalaWomen",
    name: "Romania: Liga Nationala Women",
    country: "Romania",
    path: "/handball/romania/liga-nationala-women/",
    aliases: ["ligaNationalaWomen", "Liga Nationala Women", "Ligii Nationale Women"],
  },
];

/** Variante → nom canonique. Construit une fois à l'import. */
const VARIANT_TO_CANONICAL: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const lg of HAND_BALL_LEAGUES) {
    m.set(lg.name.toLowerCase(), lg.name);
    for (const a of lg.aliases) m.set(a.toLowerCase(), lg.name);
  }
  return m;
})();

/**
 * Nom canonique d'une ligue, ou `null` si elle n'est pas au registre.
 *
 * `null` et non la valeur d'origine : le composant distinguishes alors
 * « ligue inconnue du registre » de « ligue connue », et n'invente jamais de
 * rattachement.
 */
export function normalizeHandballLeague(name: string | null | undefined): string | null {
  if (!name) return null;
  return VARIANT_TO_CANONICAL.get(name.trim().toLowerCase()) ?? null;
}

/**
 * Toutes les écritures d'une ligue (canonique incluse) — pour un `WHERE league
 * IN (...)`. Renvoie `[]` si l'id est inconnu, ce qui fait échouer le SELECT
 * proprement au lieu de ramener tout le pays.
 */
export function leagueVariants(id: string): string[] {
  const lg = HAND_BALL_LEAGUES.find((l) => l.id === id);
  if (!lg) return [];
  return [lg.name, ...lg.aliases];
}

/** Fiche complète par id, ou `null`. */
export function getHandballLeague(id: string): HandballLeague | null {
  return HAND_BALL_LEAGUES.find((l) => l.id === id) ?? null;
}