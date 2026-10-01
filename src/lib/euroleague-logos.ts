/**
 * euroleague-logos.ts — mapping code équipe EuroLeague/EuroCup → logo local.
 *
 * Source : data/euroleague_logos.json (généré par scripts/fetch-euroleague-logos.py,
 * logos Wikipedia des clubs, téléchargés dans public/images/basketball/euroleague/).
 * Servis en local → zéro dépendance CDN, zéro 404 imprévisible, pas de CORS.
 *
 * Repli : null → le calendrier FotMob affiche ses initiales générées (dicebear).
 */

import logosJson from "../../data/euroleague_logos.json";

type LogoEntry = { file: string; name?: string; wiki_title?: string };

const TABLE: Record<string, string> = Object.fromEntries(
  Object.entries((logosJson as { teams: Record<string, LogoEntry> }).teams).map(
    ([code, entry]) => [code.toUpperCase(), `/${entry.file}`],
  ),
);

/**
 * Logo local du club pour un code du bridge euroleague_api (ASV, BAR, MAD…).
 * Retourne null si code absent/inconnu → fallback initiales du calendrier.
 */
export function euroLeagueLogo(code?: string | null): string | null {
  if (!code) return null;
  return TABLE[code.toUpperCase()] ?? null;
}

/** Nombre de clubs mappés (40 attendu : 20 EuroLeague + 20 EuroCup). */
export const EURO_LEAGUE_LOGO_COUNT = Object.keys(TABLE).length;
