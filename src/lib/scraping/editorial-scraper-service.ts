// Service de scraping éditorial — présentations & previews de matches.
//
// Pipeline :
//   1. Découverte de l'article : cache d'URLs connues OU requête RSS Google News
//      ("{PlayerA} vs {PlayerB} predictions") filtrée sur des domaines éditoriaux
//      (lastwordonsports.com, tennismajors.com).
//   2. Fetch de l'article + nettoyage HTML → texte.
//   3. Matching du duel : isolation du paragraphe contenant les 2 noms (noms de
//      famille), nettoyage à 2-3 phrases clés.
//   4. Cache 24 h (fichier dans .cache/editorial/ + mémoire globalThis) pour ne
//      pas re-scraper les mêmes articles.
//
// Service server-only : jamais importé par un bundle client (utilise node:fs).

import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorialSummary = {
  /** Texte concis (2-3 phrases) de présentation du duel. */
  text: string;
  /** Domaine source (ex: "lastwordonsports.com"). */
  source: string;
  /** URL de l'article complet pour approfondir. */
  url: string;
  /** Horodatage ISO de la récupération. */
  fetchedAt: string;
};

export type EditorialQuery = {
  sport: "tennis" | "football";
  matchId: string;
  playerAName: string;
  playerBName: string;
  tournamentName?: string;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_TEXT_CHARS = 260;
const MAX_SUMMARY_SENTENCES = 3;

/** Domaines éditoriaux autorisés (whitelist anti-phishing / anti-spam SEO). */
const ALLOWED_DOMAINS = ["lastwordonsports.com", "tennismajors.com"];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; PariScoreBot/1.0; +https://pariscore.fr)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

function cacheDir(): string {
  return path.join(process.cwd(), ".cache", "editorial");
}

function cacheFilePath(query: EditorialQuery): string {
  const safeId = query.matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(cacheDir(), `${query.sport}-${safeId}.json`);
}

// Memo mémoire (globalThis) — partagé entre workers Node (idem cached-route.ts).
type MemoEntry = { data: EditorialSummary | null; at: number };
function memoKey(query: EditorialQuery): string {
  return `__editorial_${query.sport}_${query.matchId}`;
}
const g = globalThis as unknown as Record<string, MemoEntry | undefined>;
function memoGet(query: EditorialQuery): EditorialSummary | null | undefined {
  const entry = g[memoKey(query)];
  if (!entry) return undefined;
  if (Date.now() - entry.at < TTL_MS) return entry.data;
  return undefined;
}
function memoSet(query: EditorialQuery, data: EditorialSummary | null) {
  g[memoKey(query)] = { data, at: Date.now() };
}

// ---------------------------------------------------------------------------
// Helpers texte
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  // Retire scripts/styles puis balises, puis décodage des entités courantes.
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = noScript
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&mdash;|&ndash;/gi, "-")
    .replace(/&eacute;|é/gi, "é")
    .replace(/[\t\r]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  return text;
}

/** Retourne le nom de famille ("last word") d'un nom, minuscules. */
function surname(name: string): string {
  const words = name.trim().split(/\s+/);
  return (words[words.length - 1] ?? "").toLowerCase();
}

/** Découpe un texte en phrases. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Découverte de l'article
// ---------------------------------------------------------------------------

type DiscoveredArticle = { url: string; source: string };

/**
 * Résout l'URL d'un article de preview pour un duel.
 * Priorité : whitelist d'URLs connues → RSS Google News (q "A vs B predictions",
 * filtre whitelist domains). Retourne null si rien de fiable.
 */
async function discoverArticle(query: EditorialQuery): Promise<DiscoveredArticle | null> {
  const a = surname(query.playerAName);
  const b = surname(query.playerBName);

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    `"${query.playerAName}" "${query.playerBName}" predictions preview`,
  )}&hl=en-US&gl=US&ceid=US:en`;

  let xml: string;
  try {
    const res = await fetch(rssUrl, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    xml = await res.text();
  } catch {
    return null;
  }

  // Parse très léger du RSS : items <item><title>..</title><link>..</link></item>.
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  for (const item of items) {
    const linkMatch = item.match(/<link>([^<]+)<\/link>/);
    const title = item.match(/<title>([^<]+)<\/title>/)?.[1] ?? "";
    if (!linkMatch) continue;
    const url = linkMatch[1].trim();
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (!ALLOWED_DOMAINS.includes(host)) continue;
    } catch {
      continue;
    }
    const titleLower = title.toLowerCase();
    if (!titleLower.includes(a) && !titleLower.includes(b)) continue;
    return { url, source: new URL(url).hostname.replace(/^www\./, "") };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extraction du paragraphe décrivant le duel
// ---------------------------------------------------------------------------

/**
 * Isole la section / le paragraphe de l'article mentionnant explicitement le
 * duel (les 2 joueurs). Retourne 2-3 phrases clés autour de l'occurrence.
 */
function extractDuelSummary(text: string, query: EditorialQuery): string | null {
  const a = surname(query.playerAName);
  const b = surname(query.playerBName);
  if (!a || !b) return null;

  const paragraphs = text
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 60);

  // 1. Paragraphe contenant les DEUX noms.
  let target = paragraphs.find(
    (p) => p.toLowerCase().includes(a) && p.toLowerCase().includes(b),
  );
  // 2. Sinon paragraphe contenant au moins un nom.
  if (!target) {
    target = paragraphs.find(
      (p) => p.toLowerCase().includes(a) || p.toLowerCase().includes(b),
    );
  }
  if (!target) return null;

  const sentences = splitSentences(target);
  // window des phrases autour de celle contenant les noms.
  const hotIdx = sentences.findIndex(
    (s) => s.toLowerCase().includes(a) || s.toLowerCase().includes(b),
  );
  const start = Math.max(0, hotIdx - 1);
  const slice = sentences.slice(start, start + MAX_SUMMARY_SENTENCES);

  let out = slice.join(" ").trim();
  if (out.length > MAX_TEXT_CHARS) out = `${out.slice(0, MAX_TEXT_CHARS - 1)}…`;
  return out || null;
}

// ---------------------------------------------------------------------------
// Fetch + nettoyage de l'article
// ---------------------------------------------------------------------------

async function fetchArticle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 500) return null;
    return stripHtml(html);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cache fichier
// ---------------------------------------------------------------------------

async function readCached(query: EditorialQuery): Promise<EditorialSummary | null | undefined> {
  try {
    const raw = await fs.readFile(cacheFilePath(query), "utf8");
    const entry = JSON.parse(raw) as { data: EditorialSummary | null; at: number };
    if (entry && Date.now() - entry.at < TTL_MS) return entry.data;
    return undefined; // stale → on recalculera
  } catch {
    return undefined;
  }
}

async function writeCached(query: EditorialQuery, data: EditorialSummary | null): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(
      cacheFilePath(query),
      JSON.stringify({ data, at: Date.now() }),
      "utf8",
    );
  } catch {
    // cache best-effort — jamais bloquant.
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Récupère (avec cache 24h) le résumé éditorial d'un duel.
 * Retourne null si rien n'est trouvé — le service ne throw jamais.
 */
export async function getEditorialSummary(
  query: EditorialQuery,
): Promise<EditorialSummary | null> {
  if (!query.matchId || !query.playerAName || !query.playerBName) return null;

  // 1. Mémoire (globalThis) → 2. Fichier (persistant 24h) → 3. Scrape.
  const mem = memoGet(query);
  if (mem !== undefined) return mem;

  const file = await readCached(query);
  if (file !== undefined) {
    memoSet(query, file);
    return file;
  }

  const article = await discoverArticle(query);
  const summary: EditorialSummary | null = await (async (): Promise<EditorialSummary | null> => {
    if (!article) return null;
    const text = await fetchArticle(article.url);
    if (!text) return null;
    const snippet = extractDuelSummary(text, query);
    if (!snippet) return null;
    return {
      text: snippet,
      source: article.source,
      url: article.url,
      fetchedAt: new Date().toISOString(),
    };
  })();

  memoSet(query, summary);
  await writeCached(query, summary);
  return summary;
}

/** Vide le cache d'un match (pour tests/débogage). */
export async function invalidateEditorialSummary(query: EditorialQuery): Promise<void> {
  memoSet(query, null);
  try {
    await fs.rm(cacheFilePath(query), { force: true });
  } catch {
    // ignoré
  }
}