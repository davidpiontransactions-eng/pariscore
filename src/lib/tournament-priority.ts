/**
 * Tournament priority resolver — R5 hotfix (2026-07-21).
 *
 * But : trier les matchs tennis par prestige du tournoi (Grand Slam en
 * premier, ITF en dernier). La cause racine du bug "ITF Bloomfield Hills
 * en tête de liste" était que `useMatchFilter` ne considérait que
 * l'edge de pari, sans notion de catégorie.
 *
 * Stratégie de résolution (par ordre de priorité) :
 *   1. Lookup direct dans KNOWN_TOURNAMENTS (62 tournois ATP/WTA majeurs)
 *      via recherche fuzzy sur le nom — gère "Wimbledon" ↔ "Wimbledon
 *      Championships" ou "Roland Garros" ↔ "Roland-Garros".
 *   2. Fallback regex sur motifs GS / Masters / ATP/WTA level (gère les
 *      tournois non listés comme "BNP Paribas Open" → Masters 1000 via
 *      le nom de ville Indian Wells).
 *   3. Défaut : `Autres` (priorité la plus basse) — couvre les tournois
 *      Challenger/ITF/Futures non reconnus.
 *
 * Le score numérique est croissant (0 = plus prestigieux, 10 = moins).
 */

import { KNOWN_TOURNAMENTS, searchTournaments } from "./tennis-tournaments-index";

/** Ordre canonique des catégories (du plus prestigieux au moins). */
export const TOURNAMENT_PRIORITY: Record<string, number> = {
  "Grand Slam": 0,
  "ATP Finals": 1,
  "WTA Finals": 1,
  "ATP Masters 1000": 2,
  "WTA 1000": 2,
  "ATP 500": 3,
  "WTA 500": 3,
  "ATP 250": 4,
  "WTA 250": 4,
  "Challenger": 8,
  "ITF": 9,
  "Autres": 10,
};

/** Priorité par défaut pour les tournois non reconnus (ITF/Challenger/unknown). */
export const DEFAULT_TOURNAMENT_PRIORITY = 10;

/**
 * Normalisation insensible à la casse + accents + ponctuation.
 * Réutilise le même pattern que `searchTournaments`.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9 ]/g, " ") // strip ponctuation
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Motifs regex (sur nom normalisé) pour fallback quand KNOWN_TOURNAMENTS
 * ne couvre pas le tournoi. L'ordre compte (le 1er match gagne).
 */
const REGEX_FALLBACKS: Array<{ regex: RegExp; category: string }> = [
  // ─── Grand Chelem ─────────────────────────────────────────────
  { regex: /wimbledon/, category: "Grand Slam" },
  { regex: /roland.?garros|french open/, category: "Grand Slam" },
  { regex: /us open|usopen/, category: "Grand Slam" },
  { regex: /australian open/, category: "Grand Slam" },
  // ─── ATP Finals ───────────────────────────────────────────────
  { regex: /atp finals|nitto atp finals|tour finals/, category: "ATP Finals" },
  { regex: /wta finals/, category: "WTA Finals" },
  // ─── Masters 1000 / WTA 1000 ──────────────────────────────────
  // On matche par nom de ville + nom d'event commun des Masters 1000.
  {
    regex:
      /indian wells|miami open|monte carlo|mutua madrid|madrid open|internazionali bnl|rome masters|internazionali d italia|rogers cup|cincinnati|western southern|shanghai masters|paris masters|paris bercy|toronto|canadian open/,
    category: "ATP Masters 1000",
  },
  // ─── ATP 500 ──────────────────────────────────────────────────
  {
    regex:
      /abn amro|rotterdam|acapulco|barcelona open|open banque|halle open|queen.?s club|queen.?s championships|hamburg open|washington|cinch championships|tokyo|erste bank open|vienna open|basel|swiss indoors|adelaide international|brisbane international/,
    category: "ATP 500",
  },
  // ─── ATP 250 ──────────────────────────────────────────────────
  // Très nombreux — on parie sur la présence du tier dans le nom BSD.
  { regex: /\batp\s?250\b/, category: "ATP 250" },
  { regex: /\bwta\s?250\b/, category: "WTA 250" },
  { regex: /\batp\s?500\b/, category: "ATP 500" },
  { regex: /\bwta\s?500\b/, category: "WTA 500" },
  { regex: /\batp\s?1000\b|masters\s?1000/, category: "ATP Masters 1000" },
  { regex: /\bwta\s?1000\b/, category: "WTA 1000" },
  // ─── Challenger / ITF ─────────────────────────────────────────
  { regex: /challenger/, category: "Challenger" },
  { regex: /\bitf\b|futures/, category: "ITF" },
];

/**
 * Résout la catégorie d'un tournoi à partir de son nom BSD/Odds API.
 *
 * @param name Nom du tournoi (ex: "Wimbledon", "ATP Masters 1000 Indian Wells",
 *             "Bloomfield Hills, USA", "ITF M25 Roanne")
 * @returns Catégorie canonique (ex: "Grand Slam") ou "Autres" si non reconnu.
 */
export function resolveTournamentCategory(name: string | undefined | null): string {
  if (!name) return "Autres";
  const norm = normalize(name);
  if (!norm) return "Autres";

  // 1. Lookup direct dans KNOWN_TOURNAMENTS (meilleure précision)
  const matches = searchTournaments(norm, 1);
  if (matches.length > 0 && matches[0].category) {
    return matches[0].category;
  }

  // 2. Fallback regex
  for (const { regex, category } of REGEX_FALLBACKS) {
    if (regex.test(norm)) return category;
  }

  return "Autres";
}

/**
 * Résout la priorité numérique (0 = plus prestigieux, 10 = moins).
 *
 * @param name Nom du tournoi BSD/Odds API
 * @returns Numéro de priorité (inférieur = trié en premier)
 */
export function resolveTournamentPriority(
  name: string | undefined | null,
): number {
  const category = resolveTournamentCategory(name);
  return TOURNAMENT_PRIORITY[category] ?? DEFAULT_TOURNAMENT_PRIORITY;
}

// ────────────────────────────────────────────────────────────────────
// Helpers de debug / audit (exportés pour tests éventuels)
// ────────────────────────────────────────────────────────────────────

/** Catégorie résolue + priorité, pour audit/debug. */
export function resolveTournamentInfo(name: string | undefined | null): {
  category: string;
  priority: number;
} {
  const category = resolveTournamentCategory(name);
  return {
    category,
    priority: TOURNAMENT_PRIORITY[category] ?? DEFAULT_TOURNAMENT_PRIORITY,
  };
}

/** Compte des tournois connus par catégorie (audit data quality). */
export function countTournamentsByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of KNOWN_TOURNAMENTS) {
    const cat = t.category ?? "Autres";
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return counts;
}
