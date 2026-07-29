/**
 * Lookup runtime d'un logo de club football depuis le seed statique.
 *
 * Le seed (`src/data/club-logos.json`) est généré par `scripts/scrape-club-logos.ts`
 * à partir de football-logos.cc. Les clés sont des noms normalisés via
 * `normalizeTeamName` — le runtime applique la même normalisation au nom BSD,
 * ce qui garantit un matching identique.
 *
 * Lookup O(1) en mémoire, zéro latence runtime.
 */
import clubLogosData from "@/data/club-logos.json";
import { normalizeTeamName } from "./normalize-team-name";

const CLUB_LOGOS = clubLogosData as Record<string, string>;

/** Retourne l'URL CDN du logo si trouvé dans le seed, sinon undefined. */
export function lookupClubLogo(name: string): string | undefined {
  const norm = normalizeTeamName(name);
  if (!norm) return undefined;
  return CLUB_LOGOS[norm];
}
