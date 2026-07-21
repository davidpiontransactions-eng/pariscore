/**
 * Tennis score formatting helpers — shared across live score components.
 *
 * Centralised so the score logic is defined once instead of being duplicated
 * between `match-card.tsx` (LiveScoreBar) and the new header score components
 * (`SetScoreline`, `CurrentGameScore`, `ServerIndicator`).
 */

import { useEffect, useState } from "react";
import { getDateLocaleTag } from "@/lib/i18n-locales";

/** Internal point index (0/1/2/3/4+) → tennis point notation. */
const POINT_LABELS = ["0", "15", "30", "40"] as const;

/** Map a raw point count to its tennis label (0→"0", 1→"15", 2→"30", 3+→"40"). */
function pointLabel(p: number): string {
  return POINT_LABELS[p] ?? "40";
}

/**
 * Format the current game score from raw point counts (0/1/2/3+ each side).
 *
 * Handles deuce (40-40) and advantage (Av.-40 / 40-Av.) when both players have
 * reached 3 points or more — the tennis scoring quirk that doubles the count
 * instead of capping at 40.
 *
 * @example formatPoints(2, 1) === "30-15"
 *          formatPoints(3, 3) === "40-40"  // deuce
 *          formatPoints(4, 3) === "Av.-40" // advantage server/side A
 *          formatPoints(3, 4) === "40-Av."
 */
export function formatPoints(pA: number, pB: number): string {
  if (pA >= 3 && pB >= 3) {
    if (pA === pB) return "40-40"; // deuce
    return pA > pB ? "Av.-40" : "40-Av.";
  }
  return `${pointLabel(pA)}-${pointLabel(pB)}`;
}

/**
 * Build a human-readable set-by-set scoreline string (no formatting).
 *
 * Past sets come from `scoreA.sets` / `scoreB.sets`, the current set's game
 * score from `scoreA.games` / `scoreB.games`.
 *
 * @example sets=[6,6], games=3 (A) vs sets=[4,3], games=2 (B)
 *          → "6-4 6-3 3-2"
 *
 * The current (in-progress) set is appended only when at least one game has
 * been played, so a fresh set starting at 0-0 doesn't append noise.
 */
export function formatScoreline(
  scoreA: { sets: number[]; games: number },
  scoreB: { sets: number[]; games: number },
): string {
  const pastSets = scoreA.sets
    .map((gA, i) => `${gA}-${scoreB.sets[i] ?? 0}`)
    .join(" ");

  const hasCurrentGames = scoreA.games > 0 || scoreB.games > 0;
  const currentGames = hasCurrentGames
    ? `${scoreA.games}-${scoreB.games}`
    : "";

  return [pastSets, currentGames].filter(Boolean).join(" ");
}

// ────────────────────────────────────────────────────────────────────
// Date/time formatting — R5 hotfix (2026-07-21)
// ────────────────────────────────────────────────────────────────────
//
// Bug : `Intl.DateTimeFormat` sans option `timeZone` utilise la TZ du
// runtime. En SSR Next.js, le serveur tourne en UTC → affichait l'heure
// UTC brute au lieu de l'heure locale utilisateur (décalage de -2h en
// été pour Europe/Paris). De plus, l'hydratation React produisait un
// mismatch (HTML serveur UTC ≠ HTML client local).
//
// Fix : `useFormattedMatchTime` détecte la TZ côté client via
// `Intl.DateTimeFormat().resolvedOptions().timeZone` APRÈS le mount
// (jamais pendant le SSR) et la réinjecte dans le formatage. Avant le
// mount, on rend l'heure en UTC (déterministe, identique serveur/client)
// pour éviter tout hydration mismatch — puis le client re-render avec
// la vraie TZ utilisateur après le 1er effect.

/** Format d'heure absolu : "mar. 21 juil. 2026, 17:58". */
export type MatchTimeFormat = "full" | "date" | "time" | "month_year";

/** Formatte un ISO en chaîne localisée, en forçant une timezone donnée. */
export function formatInTimeZone(
  iso: string,
  locale: string,
  format: MatchTimeFormat,
  timeZone: string,
): string {
  const options: Intl.DateTimeFormatOptions =
    format === "full"
      ? {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone,
        }
      : format === "date"
        ? { day: "numeric", month: "short", year: "numeric", timeZone }
        : format === "month_year"
          ? { month: "short", year: "2-digit", timeZone }
          : { hour: "2-digit", minute: "2-digit", timeZone };
  return new Intl.DateTimeFormat(getDateLocaleTag(locale), options).format(
    new Date(iso),
  );
}

/**
 * Hook renvoyant une heure de match formatée dans la timezone du navigateur.
 *
 * Évite l'hydration mismatch en rendant d'abord en UTC (déterministe) puis
 * en re-formatant côté client après mount avec la TZ détectée.
 *
 * @param iso ISO string (avec suffixe Z, ex: "2026-07-21T15:58:00Z")
 * @param locale locale next-intl ("fr" | "en")
 * @param format "full" | "date" | "time"
 */
export function useFormattedMatchTime(
  iso: string,
  locale: string,
  format: MatchTimeFormat = "full",
): string {
  // Avant mount : UTC (déterministe, même rendu serveur + client).
  const [tz, setTz] = useState<string>("UTC");

  useEffect(() => {
    // Après mount : détecte la vraie TZ du navigateur.
    // Deferred via Promise.resolve().then() pour satisfaire la règle
    // `react-hooks/set-state-in-effect` (cf. même pattern dans match-card.tsx
    // pour terminalMode chipsExpanded).
    const detected =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    if (detected !== tz) {
      Promise.resolve().then(() => setTz(detected));
    }
  }, [tz]);

  return formatInTimeZone(iso, locale, format, tz);
}

/**
 * Hook minimal renvoyant la timezone du navigateur après mount.
 * Renvoie "UTC" avant mount (déterministe SSR) pour éviter l'hydration mismatch.
 * À utiliser quand on formatte plusieurs dates avec un options custom
 * (ex: charts Recharts) sans passer par `useFormattedMatchTime`.
 */
export function useBrowserTimeZone(): string {
  const [tz, setTz] = useState<string>("UTC");
  useEffect(() => {
    const detected =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    if (detected !== tz) {
      Promise.resolve().then(() => setTz(detected));
    }
  }, [tz]);
  return tz;
}
