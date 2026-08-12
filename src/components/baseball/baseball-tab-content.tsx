"use client";

/**
 * Adaptateur d'onglet Baseball aux conventions PariScore.
 * - Convention : `<Sport>TabContent` (cf. NbaTabContent, F1TabContent...)
 * - Délègue au composant `MLBKBOFolderTab` issu de la spec technique
 *   `baseball-tab-technical-architecture` (calendrier + modal + moteur
 *   sabermétrique Pythagore + Monte Carlo, MLB live StatsAPI + KBO curé).
 *
 * source : extracted from `.baseball-arch-extract/` (Next.js + Drizzle),
 * adapté en cache mémoire (loop 2) puis monté en onglet PariScore (loop 6).
 */
export { MLBKBOFolderTab as BaseballTabContent } from "./MLBKBOFolderTab";