/**
 * Lookup runtime d'un logo de ligue football depuis le seed statique.
 *
 * Le seed (`src/data/league-logos.json`) contient ~30 ligues majeures avec URLs
 * TheSportsDB CDN. Les clés sont normalisées via `normalizeTeamName()` pour
 * matcher le runtime avec les noms BSD.
 *
 * Lookup O(1) en mémoire, zéro latence runtime.
 */
import leagueLogosData from "@/data/league-logos.json";
import { normalizeTeamName } from "./normalize-team-name";

const LEAGUE_LOGOS = leagueLogosData as Record<string, string>;

/** Construit l'URL BSD CDN pour un league ID donné (fallback dynamique). */
export function bsdLeagueLogoUrl(leagueId: number | null | undefined): string | undefined {
  if (leagueId == null || !Number.isFinite(leagueId)) return undefined;
  return `https://sports.bzzoiro.com/img/league/${leagueId}/`;
}

/** Retourne l'URL CDN du logo si trouvé dans le seed, sinon undefined. */
export function lookupLeagueLogo(name: string): string | undefined {
  const norm = normalizeTeamName(name);
  if (!norm) return undefined;
  return LEAGUE_LOGOS[norm];
}

/**
 * Résout un logo de ligue avec cascade de fallback :
 * 1. Seed statique (rapide, stable)
 * 2. BSD CDN dynamique (toujours disponible si leagueId connu)
 * 3. undefined (caller décide du fallback emoji)
 */
export function resolveLeagueLogo(name: string, leagueId?: number | null): string | undefined {
  return lookupLeagueLogo(name) ?? bsdLeagueLogoUrl(leagueId);
}
