/**
 * Tournament theme resolver — R7 broadcast refonte (2026-07-21).
 *
 * But : fournir un thème visuel (image de fond + logo + couleurs surface)
 * pour la nouvelle carte broadcast style TV. Résout le bug visuel du
 * score dédoublé en centralisant l'affichage sur un hero riche.
 *
 * Stratégie :
 *   1. Mapping statique nom-tournoi → logo (depuis assets/tennis-logos/map.json,
 *      19 tournois majeurs copiés vers public/tennis-logos/).
 *   2. Dégradé de couleur par surface (Dur / Terre battue / Gazon) comme
 *      fond par défaut — pattern des chaînes TV sportives.
 *   3. Fallback universel si tournoi inconnu : dégradé gris neutre + nom
 *      du tournoi en texte brut.
 */

import { resolveTournamentCategory } from "./tournament-priority";
import type { Surface } from "./tennis-data";

export type TournamentTheme = {
  /** URL du logo tournoi (ex: "/tennis-logos/wimbledon.svg") ou null si inconnu. */
  logoUrl: string | null;
  /** Couleur primaire de la surface (utilisé pour le dégradé et l'accent). */
  surfaceColor: string;
  /** Couleur secondaire (bout du dégradé, plus sombre). */
  surfaceColorDark: string;
  /** Dégradé CSS prêt à l'emploi pour le background du hero. */
  background: string;
  /** Catégorie canonique (ex: "Grand Slam") — pour badge/label. */
  category: string;
  /** True si le tournoi est reconnu dans notre mapping logo. */
  isKnown: boolean;
};

// ─── Mapping nom-tournoi → logo (assets/tennis-logos/map.json) ────────────
// 19 tournois majeurs. On normalise par lowercased + stripped accents pour
// matcher les variantes BSD ("Wimbledon" / "Wimbledon Championships").

const TOURNAMENT_LOGOS: Record<string, string> = {
  "roland garros": "/tennis-logos/roland-garros.svg",
  "roland-garros": "/tennis-logos/roland-garros.svg",
  "french open": "/tennis-logos/roland-garros.svg",
  wimbledon: "/tennis-logos/wimbledon.svg",
  "us open": "/tennis-logos/us-open.svg",
  "australian open": "/tennis-logos/australian-open.svg",
  cincinnati: "/tennis-logos/cincinnati.svg",
  "western & southern open": "/tennis-logos/western-southern-open.svg",
  "western and southern open": "/tennis-logos/western-southern-open.svg",
  madrid: "/tennis-logos/madrid.jpg",
  "madrid open": "/tennis-logos/madrid-open.jpg",
  "mutua madrid": "/tennis-logos/mutua-madrid-open.jpg",
  "indian wells": "/tennis-logos/indian-wells.jpg",
  miami: "/tennis-logos/miami.png",
  "miami open": "/tennis-logos/miami-open.png",
  rome: "/tennis-logos/rome.gif",
  "italian open": "/tennis-logos/italian-open.gif",
  "internazionali bnl d italia": "/tennis-logos/italian-open.gif",
  "paris bercy": "/tennis-logos/paris-bercy.jpg",
  "paris masters": "/tennis-logos/paris-bercy.jpg",
  "atp finals": "/tennis-logos/atp-finals.jpg",
  "nitto atp finals": "/tennis-logos/atp-finals.jpg",
  halle: "/tennis-logos/halle.jpg",
  "halle open": "/tennis-logos/halle.jpg",
  "queen s club": "/tennis-logos/queen-s-club.jpg",
  "queens club": "/tennis-logos/queen-s-club.jpg",
};

// ─── Couleurs par surface ────────────────────────────────────────────────
// Inspirées des couleurs officielles des courts : bleu dur US Open/AO,
// ocre terre battue RG, vert gazon Wimbledon. Chaque surface a 2 teintes
// pour le dégradé.

const SURFACE_COLORS: Record<string, { primary: string; dark: string }> = {
  // Dur (hard) — bleu nuit
  Dur: { primary: "#1e3a5f", dark: "#0f1d30" },
  Hard: { primary: "#1e3a5f", dark: "#0f1d30" },
  // Terre battue (clay) — ocre/rouge brun
  "Terre battue": { primary: "#8b4513", dark: "#3d1f08" },
  Terre: { primary: "#8b4513", dark: "#3d1f08" },
  Clay: { primary: "#8b4513", dark: "#3d1f08" },
  // Gazon (grass) — vert foncé
  Gazon: { primary: "#2d5a2d", dark: "#152e15" },
  Grass: { primary: "#2d5a2d", dark: "#152e15" },
};

const DEFAULT_COLORS = { primary: "#1f2937", dark: "#111827" }; // gris neutre

// ─── Helpers ─────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 &-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Résout le logo tournoi depuis le mapping statique.
 * @param name Nom du tournoi BSD (ex: "Wimbledon", "Roland Garros")
 * @returns URL du logo (ex: "/tennis-logos/wimbledon.svg") ou null si inconnu.
 */
export function resolveTournamentLogo(name: string | undefined | null): string | null {
  if (!name) return null;
  const norm = normalize(name);
  // Lookup direct
  if (TOURNAMENT_LOGOS[norm]) return TOURNAMENT_LOGOS[norm];
  // Fuzzy : match partiel (ex: "Wimbledon Championships" contient "wimbledon")
  for (const [key, url] of Object.entries(TOURNAMENT_LOGOS)) {
    if (key.length < 4) continue;
    if (norm.includes(key) || key.includes(norm)) return url;
  }
  return null;
}

/**
 * Résout le thème visuel complet d'un tournoi pour la carte broadcast.
 *
 * @param name Nom du tournoi BSD/Odds API
 * @param surface Surface du match ("Dur" | "Terre battue" | "Gazon")
 * @returns TournamentTheme avec logoUrl, couleurs, dégradé, catégorie
 */
export function resolveTournamentTheme(
  name: string | undefined | null,
  surface: string | undefined,
): TournamentTheme {
  const logoUrl = resolveTournamentLogo(name);
  const colors = SURFACE_COLORS[surface ?? ""] ?? DEFAULT_COLORS;
  const category = resolveTournamentCategory(name);

  return {
    logoUrl,
    surfaceColor: colors.primary,
    surfaceColorDark: colors.dark,
    // Dégradé diagonal : couleur primaire en haut-gauche → sombre en bas-droite
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)`,
    category,
    isKnown: logoUrl !== null,
  };
}
