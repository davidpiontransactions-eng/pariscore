/**
 * Utilitaires de drapeaux — CDN flagcdn.com + fallback emoji.
 *
 * Tous les drapeaux sont servis depuis https://flagcdn.com/ en PNG.
 * Format : `https://flagcdn.com/WxH/{code}.png` avec W = width, H = height.
 *
 * Codes spéciaux :
 * - "EU"       → badge UEFA (🇪🇺)
 * - "INTL"     → badge globe international (🌍)
 * - "GB-ENG"   → Angleterre (🏴󠁧󠁢󠁥󠁮󠁧󠁿)
 * - "GB-SCT"   → Écosse
 * - "GB-WLS"   → Pays de Galles
 *
 * Fallback : si le CDN est down, `onError` sur <img> affiche l'emoji natif.
 */

/** Mapping code ISO → emoji pour fallback rapide. */
const FLAG_EMOJI: Record<string, string> = {
  FR: "🇫🇷",
  ES: "🇪🇸",
  DE: "🇩🇪",
  IT: "🇮🇹",
  PT: "🇵🇹",
  NL: "🇳🇱",
  BE: "🇧🇪",
  GB: "🇬🇧",
  "GB-ENG": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "GB-SCT": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "GB-WLS": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  BR: "🇧🇷",
  AR: "🇦🇷",
  MX: "🇲🇽",
  NO: "🇳🇴",
  SE: "🇸🇪",
  DK: "🇩🇰",
  CH: "🇨🇭",
  AT: "🇦🇹",
  GR: "🇬🇷",
  TR: "🇹🇷",
  RU: "🇷🇺",
  US: "🇺🇸",
  JP: "🇯🇵",
  KR: "🇰🇷",
  EU: "🇪🇺",
  INTL: "🌍",
};

/** Dimensions par défaut des drapeaux dans les pills. */
const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 18;

/**
 * URL du drapeau sur flagcdn.com.
 * @param countryCode Code ISO 3166-1 (ex: "FR", "GB-ENG", "EU").
 * @param width Largeur en px (défaut 24).
 * @param height Hauteur en px (défaut 18). Si omis = width * 0.75.
 */
export function getFlagUrl(
  countryCode: string,
  width: number = DEFAULT_WIDTH,
  height?: number,
): string {
  const h = height ?? Math.round(width * 0.75);
  return `https://flagcdn.com/${width}x${h}/${countryCode.toLowerCase()}.png`;
}

/**
 * Emoji fallback pour un code pays.
 * @param countryCode Code ISO 3166-1.
 */
export function getFlagEmoji(countryCode: string): string {
  return FLAG_EMOJI[countryCode.toUpperCase()] ?? "🌍";
}

/**
 * Helper complet : retourne l'URL CDN + l'emoji fallback pour un code pays.
 */
export function getFlagAssets(countryCode: string): {
  url: string;
  emoji: string;
} {
  return {
    url: getFlagUrl(countryCode),
    emoji: getFlagEmoji(countryCode),
  };
}

/**
 * Pays supportés pour les filtres par ligue avec leur code ISO.
 * Extensible — ajouter ici les nouvelles ligues.
 */
export const SUPPORTED_COUNTRIES: Record<string, { name: string; code: string }> = {
  france: { name: "France", code: "FR" },
  england: { name: "England", code: "GB-ENG" },
  spain: { name: "Spain", code: "ES" },
  germany: { name: "Germany", code: "DE" },
  italy: { name: "Italy", code: "IT" },
  portugal: { name: "Portugal", code: "PT" },
  netherlands: { name: "Netherlands", code: "NL" },
  belgium: { name: "Belgium", code: "BE" },
  brazil: { name: "Brazil", code: "BR" },
  argentina: { name: "Argentina", code: "AR" },
  mexico: { name: "Mexico", code: "MX" },
  scotland: { name: "Scotland", code: "GB-SCT" },
  europe: { name: "Europe", code: "EU" },
  international: { name: "International", code: "INTL" },
};
