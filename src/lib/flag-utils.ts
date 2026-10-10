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
 * Emoji drapeau universel, calculé depuis le code ISO 3166-1 alpha-2.
 *
 * Un drapeau est **deux Regional Indicator Symbols** : la lettre A (U+0041) devient
 * U+1F1E6, B devient U+1F1E7, etc. — soit `0x1F1E6 + (lettre - 'A')`, ou de façon
 * équivalente `127397 + charCodeAt(0)`. C'est une règle de l'Unicode, pas une
 * convention : elle couvre **tous** les pays, sans table.
 *
 * La table `FLAG_EMOJI` ci-dessus reste le premier passage, car elle porte les cas
 * qu'aucun calcul ne peut rendre (drapeaux de subdivision : `GB-ENG`, `GB-SCT`,
 * `GB-WLS` n'ont pas d'équivalent alpha-2 en un seul couple de lettres).
 *
 * Sans ce repli, tout pays absent de la table s'affichait 🌍 — le cas réel des 64
 * ligues du backtest football, dont une trentaine sont hors table.
 *
 * @param countryCode Code ISO alpha-2. Un code de subdivision (`XX-YYY`) est ignoré
 *   par la conversion et passe par la table.
 * @returns Emoji drapeau, ou ⚽ si l'entrée n'est pas un pays identifiable — un
 *   sport plutôt qu'un globe muet, qui se lisait comme un bug de chargement.
 */
export function getCountryFlagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode) return "⚽";
  const code = countryCode.trim();
  if (!/^[A-Za-z]{2}$/.test(code)) {
    // Subdivision (« GB-ENG », « INTL ») ou entrée invalide : table d'abord.
    return FLAG_EMOJI[code.toUpperCase()] ?? "⚽";
  }
  const upper = code.toUpperCase();
  // Table d'abord : elle peut porter une exception pour un alpha-2.
  const known = FLAG_EMOJI[upper];
  if (known) return known;
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65,
  );
}

/**
 * Emoji fallback pour un code pays.
 * @param countryCode Code ISO 3166-1.
 */
export function getFlagEmoji(countryCode: string): string {
  return getCountryFlagEmoji(countryCode);
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
