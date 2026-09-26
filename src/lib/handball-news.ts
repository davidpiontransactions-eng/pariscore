// Flux d'actualités handball — agrégation RSS de 4 sources, affichage en
// français (langue du user). Server-only, cache mémoire 30 min.
//
// Sources :
//  - HandNews (handnews.fr)         → RSS direct (fr)
//  - Handball Planet                → RSS direct (en) — titres traduits FR via
//                                       Gemini (1 seul appel par TTL, fallback titre original)
//  - L'Équipe (lequipe.fr/Handball/) → RSS bloqué (403 DataDome) → découverte
//                                       via Google News RSS `site:lequipe.fr`
//  - Eurosport (eurosport.fr/handball/) → pas de RSS public → Google News RSS
//                                       `site:eurosport.fr`
//
// Pipeline zéro-dépendance : fetch natif + parsing regex (même approche que
// football-press-review-service.ts). Une source en échec ne casse jamais la
// réponse : elle est signalée `ok: false` dans `sources`.

import { buildFetchHeaders } from "@/lib/press-extractors";
import { createTtlCache, isFresh } from "@/lib/cached-route";
import { generateText, LlmError } from "./llm";

// ─── Types ───────────────────────────────────────────────────────────────────

export type HandballNewsSourceId = "handnews" | "planet" | "lequipe" | "eurosport" | "handball365";

export type HandballNewsItem = {
  id: string;
  title: string;
  url: string;
  source: HandballNewsSourceId;
  sourceName: string;
  /** Langue du titre APRÈS traduction éventuelle ("fr" si tout s'est bien passé). */
  lang: "fr" | "en";
  publishedAt: string; // ISO
  /** true = titre traduit par Gemini (source EN originale conservée côté meta). */
  translated?: boolean;
};

export type HandballNewsSourceStatus = {
  id: HandballNewsSourceId;
  name: string;
  ok: boolean;
  count: number;
};

export type HandballNewsPayload = {
  items: HandballNewsItem[];
  sources: HandballNewsSourceStatus[];
  fetchedAt: string;
};

// ─── Constantes ──────────────────────────────────────────────────────────────

export const NEWS_TTL_MS = 30 * 60_000;
const MAX_PER_SOURCE = 6;
const MAX_TOTAL = 24;
const FETCH_TIMEOUT_MS = 10_000;

type SourceConfig = {
  id: HandballNewsSourceId;
  name: string;
  /** RSS direct, sinon requête Google News RSS `site:`. */
  rssUrl: string;
  googleQuery?: string;
  lang: "fr" | "en";
};

const SOURCES: readonly SourceConfig[] = [
  { id: "handnews", name: "HandNews", rssUrl: "https://handnews.fr/feed/", lang: "fr" },
  {
    id: "planet",
    name: "Handball Planet",
    rssUrl: "https://www.handball-planet.com/feed/",
    lang: "en",
  },
  {
    id: "lequipe",
    name: "L'Équipe",
    rssUrl: googleNewsRss("site:lequipe.fr handball"),
    googleQuery: "site:lequipe.fr handball",
    lang: "fr",
  },
  {
    id: "eurosport",
    name: "Eurosport",
    rssUrl: googleNewsRss("site:eurosport.fr handball"),
    googleQuery: "site:eurosport.fr handball",
    lang: "fr",
  },
  {
    id: "handball365",
    name: "Handball365",
    // Flux direct inaccessible (transport KO) → découverte Google News `site:`.
    rssUrl: googleNewsRss("site:handball365.fr handball"),
    googleQuery: "site:handball365.fr handball",
    lang: "fr",
  },
];

function googleNewsRss(q: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
}

// ─── Parsing RSS (pur, testable) ─────────────────────────────────────────────

/** Décode les entités XML/HTML courantes des flux RSS. */
export function decodeXmlEntities(s: string): string {
  // Les clés d'entités sont construites dynamiquement (A = « & ») pour éviter
  // tout décodage accidentel de la source par la chaîne d'outils d'écriture.
  const A = String.fromCharCode(38);
  let out = s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)));
  const named: Array<[string, string]> = [
    [A + "quot;", '"'],
    [A + "apos;", "'"],
    [A + "laquo;", "«"],
    [A + "raquo;", "»"],
    [A + "hellip;", "…"],
    [A + "nbsp;", " "],
    [A + "lt;", "<"],
    [A + "gt;", ">"],
    // amp en DERNIER : évite le double-décodage des entités composées.
    [A + "amp;", A],
  ];
  for (const [ent, ch] of named) out = out.split(ent).join(ch);
  return out.trim();
}

/** Google News colle « - Source » à la fin du titre → on le retire. */
export function stripGoogleNewsSuffix(title: string, sourceName: string): string {
  const suffix = ` - ${sourceName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

/** Extrait les items d'un XML RSS 2.0 (titre, lien, date). */
export function parseRssItems(xml: string): { title: string; url: string; publishedAt: string }[] {
  const out: { title: string; url: string; publishedAt: string }[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    const tm = it.match(/<title>([\s\S]*?)<\/title>/);
    const lm = it.match(/<link>([\s\S]*?)<\/link>/);
    const dm = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (!tm || !lm) continue;
    const url = decodeXmlEntities(lm[1]);
    if (!url || !/^https?:\/\//.test(url)) continue;
    const t = Date.parse(decodeXmlEntities(dm?.[1] ?? ""));
    out.push({
      title: decodeXmlEntities(tm[1]),
      url,
      publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString(),
    });
  }
  return out;
}

/**
 * Agrège les items par source : dédoublonnage par URL, cap par source puis
 * total, tri par date décroissante. Pur → testable sans réseau.
 */
export function aggregateNews(
  bySource: Partial<Record<HandballNewsSourceId, { title: string; url: string; publishedAt: string }[]>>,
  opts: { maxPerSource?: number; maxTotal?: number } = {},
): HandballNewsItem[] {
  const maxPerSource = opts.maxPerSource ?? MAX_PER_SOURCE;
  const maxTotal = opts.maxTotal ?? MAX_TOTAL;
  const seen = new Set<string>();
  const all: HandballNewsItem[] = [];

  for (const cfg of SOURCES) {
    const raw = bySource[cfg.id] ?? [];
    let kept = 0;
    for (const it of raw) {
      if (kept >= maxPerSource || all.length >= maxTotal) break;
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      kept++;
      all.push({
        id: it.url,
        title: cfg.googleQuery
          ? stripGoogleNewsSuffix(it.title, cfg.name)
          : it.title,
        url: it.url,
        source: cfg.id,
        sourceName: cfg.name,
        lang: cfg.lang,
        publishedAt: it.publishedAt,
      });
    }
  }

  return all.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// ─── Traduction FR des titres EN (Gemini, 1 appel / TTL) ─────────────────────

/** Traduit en FR les titres EN via un SEUL appel Gemini batch — fallback silencieux. */
async function translateEnTitles(items: HandballNewsItem[]): Promise<HandballNewsItem[]> {
  const targets = items.filter((i) => i.lang === "en");
  if (targets.length === 0) return items;

  try {
    const res = await generateText({
      system:
        "Tu traduis des titres d'articles de handball vers le français. " +
        "Tu réponds UNIQUEMENT par un tableau JSON, sans aucun texte autour.",
      prompt:
        "Traduis chaque titre ci-dessous en français (style titre de presse sportive, concis). " +
        "Réponds par un tableau JSON de chaînes, dans le même ordre, même longueur exacte.\n\n" +
        targets.map((t, i) => `${i + 1}. ${t.title}`).join("\n"),
      provider: "gemini",
      temperature: 0.2,
      maxOutputTokens: 2048,
      timeoutMs: 20_000,
    });
    const arr = JSON.parse(res.text.replace(/^[^[{]*/, "").replace(/[^\]}]$/, "")) as unknown;
    if (!Array.isArray(arr) || arr.length !== targets.length) return items;
    let i = 0;
    return items.map((it) => {
      if (it.lang !== "en") return it;
      const fr = String(arr[i++] ?? "").trim();
      if (!fr) return it;
      return { ...it, title: fr, lang: "fr", translated: true };
    });
  } catch {
    // Quota / réseau / JSON invalide → on sert les titres originaux.
    return items;
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const cache = createTtlCache<HandballNewsPayload>("__handballNewsCache");

/** Fetch un flux RSS → items bruels (liste vide si la source échoue). */
async function fetchSource(cfg: SourceConfig): Promise<{ title: string; url: string; publishedAt: string }[]> {
  const r = await fetch(cfg.rssUrl, {
    headers: { ...buildFetchHeaders(), "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.5" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseRssItems(await r.text());
}

/**
 * Actus handball agrégées (cache 30 min). Jamais d'exception pour une source
 * HS : la réponse contient `sources[].ok` et les items des sources joignables.
 */
export async function getHandballNews(): Promise<HandballNewsPayload> {
  const cached = cache.getEntry();
  if (cached && isFresh(cached, NEWS_TTL_MS)) return cached.data;

  const results = await Promise.allSettled(SOURCES.map((s) => fetchSource(s)));

  const bySource: Partial<Record<HandballNewsSourceId, { title: string; url: string; publishedAt: string }[]>> = {};
  const statuses: HandballNewsSourceStatus[] = [];
  SOURCES.forEach((cfg, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && r.value.length > 0) {
      bySource[cfg.id] = r.value;
      statuses.push({ id: cfg.id, name: cfg.name, ok: true, count: r.value.length });
    } else {
      statuses.push({ id: cfg.id, name: cfg.name, ok: false, count: 0 });
      if (r.status === "rejected") {
        console.warn(`[handball-news] ${cfg.id} KO: ${(r.reason as Error)?.message ?? String(r.reason)}`);
      }
    }
  });

  let items = aggregateNews(bySource);
  items = await translateEnTitles(items);

  const payload: HandballNewsPayload = {
    items,
    sources: statuses,
    fetchedAt: new Date().toISOString(),
  };

  // Cache seulement si on a du contenu — sinon nouvelle tentative au prochain appel.
  if (items.length > 0) cache.set(payload);
  return payload;
}
