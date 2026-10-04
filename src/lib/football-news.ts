/**
 * Fil d'actu football — agrégation de flux RSS publics.
 *
 * Liste obtenue en sondant réellement chaque URL (HTTP, type MIME, nombre
 * d'items, présence d'images) le 2026-10-03 : un flux « connu » qui renvoie 404
 * ou un challenge anti-bot ne vaut rien. Les 11 flux morts ont été retirés :
 * L'Équipe (403 Akamai), RMC (injoignable), Foot Mercato (certificat expiré),
 * Transfermarkt (202 + challenge Cloudflare), ESPN (202 vide), Premier League
 * (404), Football365 (404), So Foot (404), UEFA (timeout), But! (injoignable),
 * France Football (404), Marca (vide), AS (404), Goal (404), RTBF (404).
 *
 * Le parseur et l'agrégateur vivent désormais dans `@/lib/news-aggregate`
 * (partagés avec le fil MMA). Ce fichier ne garde que la liste de flux et le
 * câblage — pas de deuxième parseur à corriger.
 *
 * `withImages: false` est délibéré : les éditeurs de ces sources interdisent le
 * hotlink de leurs photos (mesuré le 2026-10-03), une liste « visuellement vide »
 * vaut mieux qu'une promesse de photos qui ne s'affichent pas. Le fil MMA, lui,
 * a mesuré que sa source BBC répond en hotlink : il passe `true`.
 */

import {
  createNewsAggregator,
  parseFeed as parseFeedRaw,
  type FeedLang,
  type FeedSource,
  type NewsItem,
  type NewsResult,
} from "@/lib/news-aggregate";

export type { FeedLang, FeedSource, NewsItem, NewsResult };

/** Flux retenus après sondage (2026-10-03). */
export const FOOTBALL_FEEDS: FeedSource[] = [
  { id: "bbc", name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/football/rss.xml", lang: "en" },
  { id: "guardian", name: "The Guardian", url: "https://www.theguardian.com/football/rss", lang: "en" },
  { id: "skysports", name: "Sky Sports", url: "https://www.skysports.com/rss/12040", lang: "en" },
  { id: "skysports-news", name: "Sky Sports News", url: "https://www.skysports.com/rss/11095", lang: "en" },
  { id: "fourfourtwo", name: "FourFourTwo", url: "https://www.fourfourtwo.com/feeds/all", lang: "en" },
  { id: "90min", name: "90min", url: "https://www.90min.com/feed", lang: "en" },
  { id: "planetfootball", name: "Planet Football", url: "https://www.planetfootball.com/feed/", lang: "en" },
  { id: "topmercato", name: "TopMercato", url: "https://www.topmercato.com/rss", lang: "fr" },
  { id: "footballfr", name: "Football.fr", url: "https://www.football.fr/rss", lang: "fr" },
  { id: "leparisien", name: "Le Parisien", url: "https://www.leparisien.fr/sports/football/rss.xml", lang: "fr" },
  {
    id: "googlenews-fr",
    name: "Google Actualités",
    url: "https://news.google.com/rss/search?q=football&hl=fr&gl=FR&ceid=FR:fr",
    lang: "fr",
  },
  { id: "kicker", name: "kicker", url: "https://newsfeed.kicker.de/news/aktuell", lang: "en" },
];

/** Nombre d'items conservés par flux. */
export const ITEMS_PER_FEED = 8;
/** Durée de vie du cache en mémoire. */
export const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;

const aggregator = createNewsAggregator(FOOTBALL_FEEDS, {
  itemsPerFeed: ITEMS_PER_FEED,
  total: 60,
  cacheTtlMs: NEWS_CACHE_TTL_MS,
  withImages: false,
});

/** Parseur partagé, signature historique conservée (synchrone, sans images). */
export function parseFeed(xml: string, feed: FeedSource, limit = ITEMS_PER_FEED): NewsItem[] {
  return parseFeedRaw(xml, feed, limit, false);
}

/**
 * Agrège tous les flux, en isolant les pannes. Une source qui tombe ne vide pas
 * la page (voir `createNewsAggregator`).
 */
export async function getFootballNews(): Promise<NewsResult> {
  return aggregator.fetch();
}

/** Vide le cache (tests). */
export function clearFootballNewsCache(): void {
  aggregator.clearCache();
}