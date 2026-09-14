/**
 * Understat player types and utilities (client-safe).
 * No Node.js dependencies — safe for client components.
 */

export type UnderstatPlayer = {
  id: number | null;
  player_name: string | null;
  xG: number | null;
  xAG: number | null;
  npxG: number | null;
  shots: number | null;
  key_passes: number | null;
  assists: number | null;
  goals: number | null;
  yellow: number | null;
  red: number | null;
  team_title: string | null;
  position: string | null;
  apps: number | null;
  time: number | null;
  /** Photo joueur Understat (via ID). */
  photo?: string | null;
};

/** Calcule la valeur per90 d'une stat. */
export function per90(value: number | null, minutes: number | null): number | null {
  if (value === null || minutes === null || minutes <= 0) return null;
  return Math.round((value / minutes) * 90 * 100) / 100;
}
