/**
 * Validation Zod pour les API routes FIBA.
 */

import { z } from "zod";

/**
 * Schéma pour les params de scoreboard.
 */
export const scoreboardParamsSchema = z.object({
  dates: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Schéma pour les params de odds.
 */
export const oddsParamsSchema = z.object({
  home: z.string().min(2).max(10).toUpperCase(),
  away: z.string().min(2).max(10).toUpperCase(),
});

/**
 * Schéma pour les params de stats.
 */
export const statsParamsSchema = z.object({
  team: z.string().min(2).max(10).toUpperCase().optional(),
});

/**
 * Valide et parse les search params d'une URL.
 */
export function validateSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; error: string } {
  const raw: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    raw[key] = value;
  });

  const result = schema.safeParse(raw);
  
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
  return { success: false, error: errors };
}

/**
 * Valide un team abbreviation.
 */
export function isValidTeamAbbr(abbr: string): boolean {
  const validTeams = [
    "USA", "CHN", "AUS", "FRA", "ESP", "BEL", "CAN", "SRB",
    "JPN", "NGR", "KOR", "BRA", "GER", "TUR", "HUN", "CZE",
    "ITA", "PUR", "MLI", "SEN", "SLO", "GRE", "ARG", "POL",
  ];
  return validTeams.includes(abbr.toUpperCase());
}

/**
 * Valide une date (format YYYY-MM-DD, pas dans le futur lointain).
 */
export function isValidDate(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  const date = new Date(dateStr);
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, 0, 1);
  const oneYearLater = new Date(now.getFullYear() + 1, 11, 31);
  
  return date >= oneYearAgo && date <= oneYearLater;
}
