/**
 * Cœur d'agrégation de flux RSS/Atom, partagé par les fils d'actu.
 *
 * Pourquoi ce module existe : `football-news.ts` (créé le 2026-10-03) contenait
 * un parseur + un agrégateur complets. Le fil MMA a besoin exactement du même
 * comportement ; recopier 225 lignes aurait créé deux parseurs à corriger
 * séparément. Le foot garde **son** comportement (pas d'images) via
 * `withImages: false`, le MMA active les images parce que la mesure le justifie
 * (voir `MMA_FEEDS`) — c'est un comportement par sport, pas une duplication.
 *
 * Aucun parseur XML en dépendance : les flux sont plats, un découpage par blocs
 * suffit. `parseFeed` est pur (aucun réseau, aucun état global) pour être testé.
 */

export type FeedLang = "fr" | "en";

export type FeedSource = {
  id: string;
  /** Nom affiché sur la carte. */
  name: string;
  url: string;
  lang: FeedLang;
};

export type NewsItem = {
  /** Identifiant stable (source + lien) pour dédupliquer et stable-key React. */
  id: string;
  title: string;
  link: string;
  source: string;
  sourceId: string;
  lang: FeedLang;
  publishedAt: string | null;
  /**
   * Image de l'article (URL distante, non téléchargée).
   * `null` quand le flux n'en fournit pas : la source **n'est pas** prédisposée,
   * le fill de repli est decided par chaque UI. Le foot garde `null` partout
   * (les éditeurs de ses sources interdisent le hotlink — mesuré le 2026-10-03).
   */
  image: string | null;
  /** Description courte, si le flux la donne. */
  summary: string | null;
};

export type NewsResult = {
  items: NewsItem[];
  /** Sources qui ont répondu, et celles qui ont échoué (pour l'affichage). */
  sources: { id: string; name: string; ok: boolean; count: number }[];
  fetchedAt: string;
};

function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, "&");
}

function unwrap(raw: string): string {
  return decodeEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ")).trim();
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
 * Image de l'article, par ordre de fiabilité décroissante :
 * media:thumbnail → media:content → enclosure type="image" → <img> dans la
 * description. Les URL relatives sont absolutisées sur l'URL du flux.
 * Toujours `null` plutôt qu'une chaîne vide : le consumer teste `item.image`.
 */
function imageOf(block: string, baseUrl: string): string | null {
  const patterns = [
    /<media:thumbnail[^>]*url=["']([^"']+)["']/i,
    /<media:content[^>]*url=["']([^"']+)["'][^>]*\/(?:>|\s)/i,
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\//i,
    /<enclosure[^>]*type=["']image\/[^"']*["'][^>]*url=["']([^"']+)["']/i,
    /<img[^>]*src=["']([^"']+)["']/i,
  ];
  // Les `<img>` vivent souvent dans une description ÉCHAPPÉE (`&lt;img ...`),
  // donc invisible pour une recherche sur le bloc brut : on retentit sur la
  // version décodée. Sans ce second passage, ce repli ne marche jamais.
  const haystacks = [block, decodeEntities(block)];

  for (const re of patterns) {
    for (const hay of haystacks) {
      const m = re.exec(hay);
      if (!m?.[1]) continue;
      try {
        // new URL() lève sur une URL relative non résoluble : on l'attrape.
        const abs = new URL(m[1], baseUrl);
        if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
        return abs.toString();
      } catch {
        // URL relative illisible : on essaie la suivante.
      }
    }
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
 * Pur : aucun réseau, aucun état global. Retourne `[]` si le document n'est pas
 * un flux exploitable plutôt que de lever — une source morte ne doit pas faire
 * tomber l'agrégateur.
 */
export function parseFeed(
  xml: string,
  feed: FeedSource,
  limit: number,
  withImages: boolean,
): NewsItem[] {
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
    // Les accents du résumé ne valent pas 400 Ko de payload : on borne.
    const summary = description ? stripTags(description).slice(0, 280) : null;

    out.push({
      id: `${feed.id}:${link}`,
      title,
      link,
      source: feed.name,
      sourceId: feed.id,
      lang: feed.lang,
      publishedAt: toIso(
        tagText(block, "pubDate") || tagText(block, "published") || tagText(block, "updated"),
      ),
      image: withImages ? imageOf(block, feed.url) : null,
      summary,
    });
  }

  return out;
}

/** Délai maximal par flux : on ne laisse pas un flux lent bloquer la page. */
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ParisCoreBot/1.0; +https://pariscore.fr)";

async function fetchFeed(feed: FeedSource, limit: number, withImages: boolean): Promise<NewsItem[]> {
  const res = await fetch(feed.url, {
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return parseFeed(await res.text(), feed, limit, withImages);
}

type AggregateOpts = {
  itemsPerFeed: number;
  total: number;
  cacheTtlMs: number;
  withImages: boolean;
};

export type NewsAggregator = {
  fetch: () => Promise<NewsResult>;
  clearCache: () => void;
};

/**
 * Construit un agrégateur isolé (cache propre) pour un jeu de flux donné.
 *
 * `Promise.allSettled`, jamais `Promise.all` : une source qui tombe ne doit pas
 * vider la page. Un seul fetch en cours à la fois, pour éviter N rafales
 * simultanées après un cache expiré.
 */
export function createNewsAggregator(feeds: FeedSource[], opts: AggregateOpts): NewsAggregator {
  type CacheEntry = { at: number; result: NewsResult };
  let cache: CacheEntry | null = null;
  let inFlight: Promise<NewsResult> | null = null;

  const fetchAll = async (): Promise<NewsResult> => {
    const settled = await Promise.allSettled(
      feeds.map((f) => fetchFeed(f, opts.itemsPerFeed, opts.withImages)),
    );

    const items: NewsItem[] = [];
    const sources = feeds.map((feed, i) => {
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

    return {
      items: merged.slice(0, opts.total),
      sources,
      fetchedAt: new Date().toISOString(),
    };
  };

  return {
    fetch: async () => {
      if (cache && Date.now() - cache.at < opts.cacheTtlMs) return cache.result;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        const result = await fetchAll();
        cache = { at: Date.now(), result };
        return result;
      })();
      try {
        return await inFlight;
      } finally {
        inFlight = null;
      }
    },
    clearCache: () => {
      cache = null;
    },
  };
}