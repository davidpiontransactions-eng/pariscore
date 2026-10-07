/**
 * Catalogue des ligues handball couvertes par 1xbet — ordre de priorité
 * pour l'affichage des filtres (audit 2026-09-23).
 * Tier bas : compétition majeure en tête, même si volume de matchs faible.
 */

import type { HandballMatch } from "./handball-data";

type CatalogEntry = { patterns: RegExp[]; tier: number };

const CATALOG: CatalogEntry[] = [
  // Tier 1 — clubs élite
  { patterns: [/champions?\s*league/i, /ligue des champions/i], tier: 1 },
  // Tier 2 — sélections majeures
  { patterns: [/world championship|championnat du monde|\bihf\b/i], tier: 2 },
  // Tier 3 — Euro / Olympiques
  { patterns: [/european championship|championnat d'?europe|\behf euro\b/i, /olympic|jeux olymp/i], tier: 3 },
  // Tier 4 — coupe d'Europe secondaire
  { patterns: [/european league|european cup|\behf cup\b|coupe d'?europe/i], tier: 4 },
  // Tier 5 — top ligues domestiques 1xbet
  {
    patterns: [
      /starligue/i,
      /^bundesliga$/i,
      /liga asobal|asobal/i,
      /serie a/i,
      /handbollsligan|allsvenskan/i,
      /herre handbold|elkjop/i,
      /superliga/i,
      /nb i/i,
      /eredivisie/i,
      /super league|superleague/i,
      /andebol/i,
      /\bi liga\b|arkus/i,
    ],
    tier: 5,
  },
  // Tier 6 — coupes nationales
  { patterns: [/\bcup\b|pokal|coupe|\bcopa\b/i], tier: 6 },
];

/** Tier d'une ligue (1 = majeure, 50 = inconnue/hors catalog). */
export function handballLeagueTier(name: string): number {
  for (const entry of CATALOG) {
    if (entry.patterns.some((re) => re.test(name))) return entry.tier;
  }
  return 50;
}

/** Tri des chips de filtre : tier croissant, puis volume décroissant. */
export function sortHandballLeagueEntries<T extends { name: string; count: number }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    const ta = handballLeagueTier(a.name);
    const tb = handballLeagueTier(b.name);
    if (ta !== tb) return ta - tb;
    return b.count - a.count;
  });
}

/** Option de ligue du popover de filtre (compteur + pays du 1ᵉʳ match vu). */
export type HandballLeagueOption = { name: string; count: number; country?: string };

/**
 * Liste des ligues avec leur compteur sur un périmètre donné.
 *
 * `scope` porte les matchs à COMPTER (typiquement la journée active) tandis que
 * `all` porte les matchs servant à ÉNUMÉRER les ligues. Les deux sont distincts
 * pour que la liste reste stable quand on change de date : sans cette
 * séparation, un championnat absent de la journée affichée disparaissait de la
 * liste, et le filtre devenait impossible à réinitialiser depuis l'UI.
 *
 * `dayOf` reçoit le kickoff ISO et rend la clé de regroupement (« AAAA-MM-JJ »,
 * jour civil Europe/Paris) ; une clé nulle exclut le match du périmètre. Par
 * défaut tout est compté.
 */
export function countHandballLeagues(
  all: readonly HandballMatch[],
  scope: readonly HandballMatch[] = all,
  dayOf: (kickoff: string) => string | null = (kickoff) => kickoff,
): HandballLeagueOption[] {
  const counts = new Map<string, { count: number; country?: string }>();
  for (const m of all) {
    const cur = counts.get(m.league.name);
    if (cur) continue;
    counts.set(m.league.name, { count: 0, country: m.league.country || undefined });
  }
  for (const m of scope) {
    if (dayOf(m.kickoff) == null) continue;
    const cur = counts.get(m.league.name);
    if (cur) cur.count += 1;
  }
  return sortHandballLeagueEntries(
    [...counts.entries()].map(([name, v]) => ({ name, count: v.count, country: v.country })),
  );
}
