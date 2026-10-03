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
 * Aucun parseur XML en dépendance : les flux RSS sont des structures simples et
 * plates, un découpage par blocs suffit et évite d'ajouter une lib au projet.
 * `parseFeed` est volontairement pur pour être testable (cf. __tests__).
 */

export type FeedLang = "fr" | "en";

export type FeedSource = {
  id: string;
  /** Nom affiché sur la carte. */
  name: string;
  url: string;
  lang: FeedLang;
};

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

export type NewsItem = {
  /** Identifiant stable (source + lien) pour dédupliquer et-Draconiser les clés React. */
  id: string;
  title: string;
  link: string;
  source: string;
  sourceId: string;
  lang: FeedLang;
  publishedAt: string | null;
  image: string | null;
};

/** Nombre d'items conservés par flux. */
export const ITEMS_PER_FEED = 8;
/** Durée de vie du cache en mémoire. */
export const NEWS_CACHE_TTL_MS = 10 * 60 * 1000;
/** Délai maximal par flux : on ne laisse pas un flux lent bloquer la page. */
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ParisCoreBot/1.0; +https://pariscore.fr)";

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function unwrap(raw: string): string {
  return decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}

/** Texte d'une balise dans un bloc item/entry. */
function tagText(block: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  return m ? unwrap(m[1]).trim() : "";
}

/** Lien : Atom utilise <link href="..."/>, RSS une balise <link>texte</link>. */
function linkOf(block: string): string {
  const alt = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
  if (alt?.[1]) return alt[1];
  const text = tagText(block, "link");
  return /^https?:\/\//i.test(text) ? text : "";
}

/**
 * Image de l'item : on essaie les balises média, puis une balise <img> dans la
 * description (beaucoup de flux FR n'utilisent pas media:thumbnail). On valide
 * que c'est bien http(s) — un `data:` ou un lien relatif casserait le <img>.
 */
function imageOf(block: string, description: string): string | null {
  const candidates = [
    /<media:thumbnail[^>]*url=["']([^"']+)["']/i.exec(block)?.[1],
    /<media:content[^>]*url=["']([^"']+)["'](?![^>]*type=["'](?!image))/i.exec(block)?.[1],
    /<media:content[^>]*url=["']([^"']+)["'][^>]*type=["']image/i.exec(block)?.[1],
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i.exec(block)?.[1],
    /<enclosure[^>]*type=["']image[^>]*url=["']([^"']+)["']/i.exec(block)?.[1],
    /<thumbnail[^>]*url=["']([^"']+)["']/i.exec(block)?.[1],
    /<img[^>]*src=["']([^"']+)["']/i.exec(description)?.[1],
  ];
  for (const url of candidates) {
    if (!url) continue;
    const clean = unwrap(url.trim());
    if (/^https?:\/\//i.test(clean)) return clean;
  }
  return null;
}

function toIso(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Découpe un flux RSS ou Atom et normalise ses items.
 *
 * Pur : aucun accès réseau, aucun état global. Retourne `[]` si le document
 * n'est pas un flux exploable plutôt que de lever — une source morte ne doit
 * pas faire tomber l'agrégateur.
 */
export function parseFeed(xml: string, feed: FeedSource, limit = ITEMS_PER_FEED): NewsItem[] {
  if (!xml || !/<(item|entry)[\s>]/i.test(xml)) return [];

  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const out: NewsItem[] = [];

  for (const block of blocks) {
    // Avant le push : sinon `limit: 0` renvoyait quand même un item.
    if (out.length >= limit) break;

    const title = tagText(block, "title");
    const link = linkOf(block);
    if (!title || !link) continue;

    const description = tagText(block, "description") || tagText(block, "summary");
    const publishedAt = toIso(
      tagText(block, "pubDate") || tagText(block, "published") || tagText(block, "updated"),
    );

    out.push({
      id: `${feed.id}:${link}`,
      title,
      link,
      source: feed.name,
      sourceId: feed.id,
      lang: feed.lang,
      publishedAt,
      image: imageOf(block, description),
    });
  }

  return out;
}

export type NewsResult = {
  items: NewsItem[];
  /** Sources qui ont répondu, et celles qui ont échoué (pour l'affichage). */
  sources: { id: string; name: string; ok: boolean; count: number }[];
  fetchedAt: string;
};

type CacheEntry = { at: number; result: NewsResult };
let cache: CacheEntry | null = null;

/** Un seul fetch en cours à la fois : évite N rafales simultanées après un cache expiré. */
let inFlight: Promise<NewsResult> | null = null;

async function fetchFeed(feed: FeedSource): Promise<NewsItem[]> {
  const res = await fetch(feed.url, {
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return parseFeed(await res.text(), feed);
}

/**
 * Agrège tous les flux, en isolating les pannes : `Promise.allSettled`, jamais
 * `Promise.all`. Une source qui tombe ne doit pas vider la page.
 */
export async function getFootballNews(): Promise<NewsResult> {
  if (cache && Date.now() - cache.at < NEWS_CACHE_TTL_MS) return cache.result;
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<NewsResult> => {
    const settled = await Promise.allSettled(FOOTBALL_FEEDS.map(fetchFeed));

    const items: NewsItem[] = [];
    const sources = FOOTBALL_FEEDS.map((feed, i) => {
      const outcome = settled[i];
      if (outcome.status === "fulfilled") {
        items.push(...outcome.value);
        return { id: feed.id, name: feed.name, ok: true, count: outcome.value.length };
      }
      return { id: feed.id, name: feed.name, ok: false, count: 0 };
    });

    // Tri antichronologique ; les items sans date passent après ceux qui en ont une.
    const dated = items.filter((i) => i.publishedAt);
    const undated = items.filter((i) => !i.publishedAt);
    dated.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
    // Un même article relayé par plusieurs sources : on garde la première occurrence.
    const seen = new Set<string>();
    const merged: NewsItem[] = [];
    for (const item of [...dated, ...undated]) {
      const key = item.title.toLowerCase().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    const result: NewsResult = {
      items: merged.slice(0, 60),
      sources,
      fetchedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), result };
    return result;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Vide le cache (tests). */
export function clearFootballNewsCache(): void {
  cache = null;
}