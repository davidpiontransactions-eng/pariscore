// ─── Registre d'images sportives (Unsplash optimisées) ───────────────────
// Usage : import { getSportHero, getSportBg, getLeagueBanner } from "@/lib/sport-images"
//
// Toutes les URLs utilisent les paramètres d'optimisation Unsplash :
//   ?auto=format&fit=crop&w={width}&q=80
// → WebP/AVIF auto selon navigateur, crop centré, qualité 80%.

const UNSPLASH_BASE = "https://images.unsplash.com";

export type SportId = "tennis" | "football" | "cs2" | "mma" | "nba" | "wnba" | "cycling" | "f1";

// Visuels par sport — sélectionnés pour palette sombre compatible dark mode.
const SPORT_HERO: Record<SportId, string> = {
  tennis: `${UNSPLASH_BASE}/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80`,
  football: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
  cs2: `${UNSPLASH_BASE}/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80`,
  mma: `${UNSPLASH_BASE}/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1200&q=80`,
  nba: `${UNSPLASH_BASE}/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1200&q=80`,
  wnba: `${UNSPLASH_BASE}/photo-1546519638-68e109498f28?auto=format&fit=crop&w=1200&q=80`,
  cycling: `${UNSPLASH_BASE}/photo-1534787238916-9ba6764efd4f?auto=format&fit=crop&w=1200&q=80`,
  f1: `${UNSPLASH_BASE}/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80`,
};

// Version basse résolution pour thumbnails / arrière-plans floutés.
const SPORT_BG: Record<SportId, string> = {
  tennis: `${UNSPLASH_BASE}/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=60&blur=20`,
  football: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
  cs2: `${UNSPLASH_BASE}/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=60&blur=20`,
  mma: `${UNSPLASH_BASE}/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=800&q=60&blur=20`,
  nba: `${UNSPLASH_BASE}/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=800&q=60&blur=20`,
  wnba: `${UNSPLASH_BASE}/photo-1546519638-68e109498f28?auto=format&fit=crop&w=800&q=60&blur=20`,
  cycling: `${UNSPLASH_BASE}/photo-1534787238916-9ba6764efd4f?auto=format&fit=crop&w=800&q=60&blur=20`,
  f1: `${UNSPLASH_BASE}/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=60&blur=20`,
};

// Accents de couleur par sport (pour fallbacks et overlays).
const SPORT_ACCENT: Record<SportId, string> = {
  tennis: "#10b981",
  football: "#0ea5e9",
  cs2: "#f97316",
  mma: "#ef4444",
  nba: "#0284c7",
  wnba: "#a855f7",
  cycling: "#f59e0b",
  f1: "#dc2626",
};

/** URL hero haute résolution pour un sport donné. */
export function getSportHero(sport: SportId): string {
  return SPORT_HERO[sport] ?? SPORT_HERO.football;
}

/** URL basse résolution + flou pour arrière-plans. */
export function getSportBg(sport: SportId): string {
  return SPORT_BG[sport] ?? SPORT_BG.football;
}

/** Couleur accent d'un sport (fallbacks, badges, anneaux). */
export function getSportAccent(sport: SportId): string {
  return SPORT_ACCENT[sport] ?? SPORT_ACCENT.football;
}

/**
 * Bannière de ligue — si l'API fournit une URL de logo, on la retourne.
 * Sinon, fallback Unsplash par sport.
 */
export function getLeagueBanner(logoUrl?: string | null, sport?: SportId): string {
  if (logoUrl && logoUrl.startsWith("https://")) return logoUrl;
  return sport ? getSportBg(sport) : getSportBg("football");
}
