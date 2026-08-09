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

/** Domaines éditoriaux autorisés (whitelist anti-phishing / anti-spam SEO).
 *
 * Inclut les outlets de previews/predictions fiables réellement présents dans
 * Google News (VSiN, Action Network, RotoWire, …) — le check se fait sur le
 * domaine RÉEL de l'éditeur (tagué `<source>` dans le RSS), pas sur l'URL
 * de redirection news.google.com.
 */
const ALLOWED_DOMAINS = [
  // Tennis — previews dédiées.
  "lastwordonsports.com",
  "tennismajors.com",
  "tennis.com",
  "atptour.com",
  "tennisworldusa.org",
  // Football — previews prédictives whitelistées.
  "90min.com",
  "footystats.org",
  "sportsmole.co.uk",
  // Outlets sportifs majeurs (predictions/previews fiables, anti-spam SEO).
  "vsin.com",
  "actionnetwork.com",
  "rotowire.com",
  "sports.yahoo.com",
  "dknetwork.draftkings.com",
  "cbssports.com",
  "sportingnews.com",
  "espn.com",
  "skysports.com",
  "theguardian.com",
  "independent.co.uk",
];

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

type DiscoveredArticle = { url: string };

/** Extrait un host sans www depuis une URL (+ "" si invalide). */
function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Sources de découverte : DuckDuckGo HTML (primaire) puis Bing News RSS
 * (fallback). Les deux exposent l'URL RÉELLE de l'éditeur (param `uddg=`
 * encodé pour DDG, param `url=` du lien `apiclick.aspx` pour Bing) — le RSS
 * Google News est inutilisable car tous ses liens sont des redirections
 * news.google.com sans domaine éditeur exposé. La whitelist est validée sur
 * le host réel AVANT fetch (et revalidée après fetch, en profondeur).
 */
async function discoverArticles(
  query: EditorialQuery,
  limit = 5,
): Promise<DiscoveredArticle[]> {
  const [ddg, bing] = await Promise.all([
    ddgHtmlSearch(query),
    bingNewsRssSearch(query),
  ]);
  for (const urls of [ddg, bing]) {
    const ok = urls.filter((u) => ALLOWED_DOMAINS.includes(hostOf(u)));
    if (ok.length > 0) return ok.slice(0, limit).map((url) => ({ url }));
  }
  return [];
}

/** DuckDuckGo HTML — hrefs `//duckduckgo.com/l/?uddg=<url>` encodent l'URL cible.
 * Nécessite un UA navigateur (le UA bot est bloqué par le filtre anti-bot). */
async function ddgHtmlSearch(query: EditorialQuery): Promise<string[]> {
  const q = `"${query.playerAName}" "${query.playerBName}" predictions preview`;
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const out: string[] = [];
    for (const m of html.matchAll(/uddg=([^&"]+)/g)) {
      try {
        out.push(decodeURIComponent(m[1]));
      } catch {
        // entrée illisible → ignorée
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Bing News RSS — les liens `apiclick.aspx` portent l'URL du site dans `url=`. */
async function bingNewsRssSearch(query: EditorialQuery): Promise<string[]> {
  const qUrl = `"${query.playerAName}" "${query.playerBName}" predictions preview`;
  try {
    const res = await fetch(
      `https://www.bing.com/news/search?q=${encodeURIComponent(qUrl)}&format=rss`,
      { headers: FETCH_HEADERS, signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const out: string[] = [];
    for (const m of xml.matchAll(/apiclick\.aspx\?[^"<]*url=([^&"<]+)/g)) {
      try {
        out.push(decodeURIComponent(m[1]));
      } catch {
        // illisible → ignoré
      }
    }
    return out;
  } catch {
    return [];
  }
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

  // 1. Paragraphe contenant les DEUX noms, hors titres (lignes à pipe "|"),
  //    puis sans contrainte de titre.
  let target =
    paragraphs.find(
      (p) => !p.includes("|") && p.toLowerCase().includes(a) && p.toLowerCase().includes(b),
    ) ??
    paragraphs.find(
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

type FetchedArticle = { text: string; host: string };

/**
 * Fetch l'article (suit les redirections Google News) et valide le domaine
 * éditeur FINAL contre la whitelist. Retourne null si l'URL d'arrivée n'est
 * pas un domaine autorisé (anti-phishing / anti-spam SEO), si la réponse
 * échoue ou si le contenu est vide.
 */
async function fetchArticle(url: string): Promise<FetchedArticle | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const host = new URL(res.url).hostname.replace(/^www\./, "");
    if (!ALLOWED_DOMAINS.includes(host)) return null;
    const html = await res.text();
    if (html.length < 500) return null;
    return { text: stripHtml(html), host };
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

  // 3. Scrape : boucle sur les candidats (whitelist validée à la découverte
  //    puis revalidée après fetch — urls directes éditeur, sans redirect).
  let summary: EditorialSummary | null = null;
  for (const article of await discoverArticles(query)) {
    const fetched = await fetchArticle(article.url);
    if (!fetched) continue;
    const snippet = extractDuelSummary(fetched.text, query);
    if (!snippet) continue;
    summary = {
      text: snippet,
      source: fetched.host,
      url: article.url,
      fetchedAt: new Date().toISOString(),
    };
    break;
  }

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