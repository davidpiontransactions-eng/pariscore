// ─── Registre d'images sportives (Unsplash optimisées) ───────────────────
// Usage : import { getSportHero, getSportBg, getLeagueBanner } from "@/lib/sport-images"
//
// Toutes les URLs utilisent les paramètres d'optimisation Unsplash :
//   ?auto=format&fit=crop&w={width}&q=80
// → WebP/AVIF auto selon navigateur, crop centré, qualité 80%.

const UNSPLASH_BASE = "https://images.unsplash.com";

export type SportId =
  | "home"
  | "tennis"
  | "football"
  | "cs2"
  | "mma"
  | "basketball"
  | "cycling"
  | "f1"
  | "baseball"
  | "rugby";

// Visuels par sport — sélectionnés pour palette sombre compatible dark mode.
const SPORT_HERO: Record<SportId, string> = {
  // Accueil : pas de visuel sportif — on réutilise le hero football (pattern
  // anti-guess URL documenté, cf. baseball/rugby) ; la bannière est masquée
  // par l'onglet actif côté SportTabs.
  home: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
  tennis: `${UNSPLASH_BASE}/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80`,
  football: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
  cs2: `${UNSPLASH_BASE}/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80`,
  mma: `${UNSPLASH_BASE}/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1200&q=80`,
  basketball: `${UNSPLASH_BASE}/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=1200&q=80`,
  cycling: `${UNSPLASH_BASE}/photo-1534787238916-9ba6764efd4f?auto=format&fit=crop&w=1200&q=80`,
  f1: `${UNSPLASH_BASE}/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80`,
  // Baseball : pas d'image identifiée Unsplash aujourd'hui — on réutilise
  // le hero football pour ne pas générer une URL devinée (règle anti-guess URL).
  // Mémo loop 7 : remplacer par un vrai ID Unsplash baseball à la prochaine
  // passe design.
  baseball: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
  // Rugby : même approche anti-guess — hero football réutilisé en attendant un
  // ID Unsplash rugby vérifié. Le thème visuel est porté par le token teal
  // --sport-rugby (#14B8A6) plutôt que par la photo.
  rugby: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=1200&q=80`,
};

// Version basse résolution pour thumbnails / arrière-plans floutés.
const SPORT_BG: Record<SportId, string> = {
  home: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
  tennis: `${UNSPLASH_BASE}/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=60&blur=20`,
  football: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
  cs2: `${UNSPLASH_BASE}/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=60&blur=20`,
  mma: `${UNSPLASH_BASE}/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=800&q=60&blur=20`,
  basketball: `${UNSPLASH_BASE}/photo-1504450758481-7338eba7524a?auto=format&fit=crop&w=800&q=60&blur=20`,
  cycling: `${UNSPLASH_BASE}/photo-1534787238916-9ba6764efd4f?auto=format&fit=crop&w=800&q=60&blur=20`,
  f1: `${UNSPLASH_BASE}/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=60&blur=20`,
  baseball: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
  rugby: `${UNSPLASH_BASE}/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60&blur=20`,
};

// Accents de couleur par sport (pour fallbacks et overlays).
const SPORT_ACCENT: Record<SportId, string> = {
  home: "#00e676",
  tennis: "#10b981",
  football: "#0ea5e9",
  cs2: "#f97316",
  mma: "#ef4444",
  basketball: "#0ea5e9",
  cycling: "#f59e0b",
  f1: "#dc2626",
  baseball: "#f59e0b",
  rugby: "#14b8a6",
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
