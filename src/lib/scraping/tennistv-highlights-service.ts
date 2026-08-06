// Service de scraping des highlights TennisTV (YouTube).
//
// Pipeline :
//   1. Fetch de https://www.youtube.com/c/tennistv/videos (page "Videos" du
//      canal, User-Agent Chrome + cookie CONSENT pour éviter le gdpr banner).
//   2. Parsing de `var ytInitialData = {...}` — grille riche de la tab Videos.
//      Attention : YouTube a remplacé `videoRenderer` par `lockupViewModel`
//      (nouvelle UI "lockup"), donc on extrait via un walk récursif défensif
//      qui cible les objets { contentType: "LOCKUP_CONTENT_TYPE_VIDEO" }.
//      Fallback : plus ancien `videoRenderer`/`gridVideoRenderer` si le walk
//      ne trouve rien.
//   3. Matching : pour un joueur donné (nom complet ou nom de famille,
//      insensible aux accents), on prend la vidéo la plus récente dont le
//      titre contient le joueur — en préférant les titres "X vs Y"
//      (match simple) aux résumés collectifs "Day N Highlights".
//   4. Cache 24 h (fichier .cache/tennistv/ + mémoire globalThis) pour ne pas
//      re-scraper la page YouTube à chaque carte.
//
// Service server-only : jamais importé par un bundle client (utilise node:fs).

import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TennisHighlight = {
  /** ID vidéo YouTube (11 chars). */
  videoId: string;
  /** Titre complet de la vidéo. */
  title: string;
  /** URL de lecture. */
  url: string;
  /** Texte de publication relatif ("12 hours ago"). */
  publishedText: string | null;
  /** Texte de vues ("114K views"). */
  viewsText: string | null;
  /** Durée lisible ("12:34") si présente dans le label a11y. */
  lengthText: string | null;
};

export type MatchHighlights = {
  playerA: TennisHighlight | null;
  playerB: TennisHighlight | null;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CHANNEL_VIDEOS_URL = "https://www.youtube.com/c/tennistv/videos";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_VIDEOS = 40;
const MAX_TITLE_CHARS = 90;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Cookie: "CONSENT=YES+1; SOCS=CAI",
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

type CachedIndex = { at: number; videos: TennisHighlight[] };

function cacheDir(): string {
  return path.join(process.cwd(), ".cache", "tennistv");
}

function cacheFilePath(): string {
  return path.join(cacheDir(), "index.json");
}

const g = globalThis as unknown as Record<string, CachedIndex | undefined>;
const MEMO_KEY = "__tennistv_index";

async function readFileCache(): Promise<CachedIndex | null> {
  try {
    const raw = await fs.readFile(cacheFilePath(), "utf8");
    return JSON.parse(raw) as CachedIndex;
  } catch {
    return null;
  }
}

async function writeFileCache(index: CachedIndex): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(cacheFilePath(), JSON.stringify(index), "utf8");
  } catch {
    // Cache best-effort — ne jamais faire échouer le service.
  }
}

// ---------------------------------------------------------------------------
// Parsing ytInitialData (nouvelle UI "lockup")
// ---------------------------------------------------------------------------

type RawLockup = {
  contentId?: string;
  contentType?: string;
  metadata?: {
    lockupMetadataViewModel?: {
      title?: { content?: string };
      metadata?: {
        contentMetadataViewModel?: {
          metadataRows?: Array<{
            metadataParts?: Array<{ text?: { content?: string } }>;
          }>;
        };
      };
    };
    title?: { content?: string };
    metadata?: {
      contentMetadataViewModel?: {
        metadataRows?: Array<{
          metadataParts?: Array<{ text?: { content?: string } }>;
        }>;
      };
    };
  };
  rendererContext?: {
    accessibilityContext?: { label?: string };
  };
};

function walkForLockups(
  node: unknown,
  out: RawLockup[],
  depth: number,
): void {
  if (!node || typeof node !== "object" || depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) walkForLockups(item, out, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (
    typeof obj.contentId === "string" &&
    obj.contentType === "LOCKUP_CONTENT_TYPE_VIDEO"
  ) {
    out.push(node as RawLockup);
    // On continue quand même : pas de descente nécessaire, le lockup est plat.
    return;
  }
  for (const key of Object.keys(obj)) {
    if (key === "title" || key === "thumbnail" || key === "accessibilityLabel") {
      continue;
    }
    walkForLockups(obj[key], out, depth + 1);
  }
}

function extractLockup(lockup: RawLockup): TennisHighlight | null {
  const videoId = lockup.contentId;
  if (!videoId) return null;

  const md = lockup.metadata;
  const vm = md?.lockupMetadataViewModel ?? (md as RawLockup["metadata"]);
  const title =
    vm?.title?.content ??
    lockup.rendererContext?.accessibilityContext?.label?.split(/ \d+ (?:minutes|seconds)/i)[0] ??
    "";
  if (!title.trim()) return null;

  const rows =
    vm?.metadata?.contentMetadataViewModel?.metadataRows ??
    (md as { metadata?: { contentMetadataViewModel?: { metadataRows?: unknown[] } } })
      ?.metadata?.contentMetadataViewModel?.metadataRows ??
    [];
  const parts = rows.flatMap((r) =>
    ((r as { metadataParts?: Array<{ text?: { content?: string } }> })
      ?.metadataParts ?? []).map((p) => p?.text?.content ?? ""),
  );
  const publishedText =
    parts.find((p) => /\bago\b|yesterday|today/i.test(p)) ?? null;
  const viewsText =
    parts.find((p) => /views/i.test(p)) ?? null;

  // Durée : le label a11y se termine par "12 minutes, 34 seconds".
  const label = lockup.rendererContext?.accessibilityContext?.label ?? "";
  const lenMatch = label.match(
    /(\d+)\s*(?:hour|minute|second)s?\s*(?:,\s*)?(\d+)?\s*(?:minute|second)s?/i,
  );
  let lengthText: string | null = null;
  if (lenMatch) {
    const h = lenMatch[1] ? parseInt(lenMatch[1], 10) : 0;
    const m = /minutes?/i.test(label) ? parseInt(lenMatch[1], 10) : 0;
    const s = /seconds?/i.test(label) ? (parseInt(lenMatch[2] ?? "0", 10) || 0) : 0;
    const totalMin = h * 60 + m;
    if (totalMin > 0) {
      const mm = totalMin % 60;
      const hh = Math.floor(totalMin / 60);
      lengthText = hh > 0 ? `${hh}:${String(mm).padStart(2, "0")}` : `${mm}`;
    }
  }

  return {
    videoId,
    title: title.slice(0, MAX_TITLE_CHARS),
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedText,
    viewsText,
    lengthText,
  };
}

function parseVideosHtml(html: string): TennisHighlight[] {
  // Nouvelle UI : lockupViewModel dans ytInitialData.
  const dataMatch = html.match(/var ytInitialData = ([\s\S]*?);<\/script>/);
  const lockups: RawLockup[] = [];
  if (dataMatch) {
    try {
      const data = JSON.parse(dataMatch[1]);
      walkForLockups(data, lockups, 0);
    } catch {
      // ytInitialData malformé → on tente les fallbacks ci-dessous.
    }
  }

  const videos = lockups
    .map(extractLockup)
    .filter((v): v is TennisHighlight => v !== null);

  // Fallback ancienne UI : videoRenderer / gridVideoRenderer via regex.
  if (videos.length === 0) {
    const videoIdRe = /"videoId":"([\w-]{11})"/g;
    const titleRe = /"title":\{"runs":\[\{"text":"([^"]+)"\}\]\}/g;
    const ids = [...html.matchAll(videoIdRe)].map((m) => m[1]);
    const titles = [...html.matchAll(titleRe)].map((m) => m[1]);
    const n = Math.min(ids.length, titles.length, MAX_VIDEOS);
    for (let i = 0; i < n; i++) {
      videos.push({
        videoId: ids[i],
        title: titles[i].slice(0, MAX_TITLE_CHARS),
        url: `https://www.youtube.com/watch?v=${ids[i]}`,
        publishedText: null,
        viewsText: null,
        lengthText: null,
      });
    }
  }

  return videos.slice(0, MAX_VIDEOS);
}

// ---------------------------------------------------------------------------
// Fetch + cache
// ---------------------------------------------------------------------------

async function getChannelIndex(): Promise<TennisHighlight[]> {
  const memo = g[MEMO_KEY];
  if (memo && Date.now() - memo.at < TTL_MS) return memo.videos;

  const fileCache = await readFileCache();
  if (fileCache && Date.now() - fileCache.at < TTL_MS) {
    g[MEMO_KEY] = fileCache;
    return fileCache.videos;
  }

  try {
    const res = await fetch(CHANNEL_VIDEOS_URL, { headers: FETCH_HEADERS });
    if (!res.ok) {
      // Backbone : servir le cache fichier même périmé plutôt que rien.
      if (fileCache) {
        g[MEMO_KEY] = fileCache;
        return fileCache.videos;
      }
      return [];
    }
    const html = await res.text();
    const videos = parseVideosHtml(html);
    const index: CachedIndex = { at: Date.now(), videos };
    g[MEMO_KEY] = index;
    void writeFileCache(index);
    return videos;
  } catch {
    if (fileCache) {
      g[MEMO_KEY] = fileCache;
      return fileCache.videos;
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// Matching joueur → highlight
// ---------------------------------------------------------------------------

/** Nom normalisé : NFD → strip accents → lowercase. */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Nom de famille ("last word"), normalisé. */
function surname(name: string): string {
  const words = normalizeName(name).split(/\s+/);
  return words[words.length - 1] ?? "";
}

function titleMentionsPlayer(title: string, playerName: string): boolean {
  const norm = normalizeName(title);
  const full = normalizeName(playerName);
  const last = surname(playerName);
  if (!full || !last || last.length < 3) return false;
  // Correspondance sur le nom complet OU le nom de famille en mot entier
  // (évite "Cerundolo" de matcher dans "...Cerundolo" — ok — mais surtout
  // évite "Alcaraz" de matcher dans "Alcarazo").
  if (last.length >= 5 && new RegExp(`\\b${escapeRegExp(last)}`).test(norm)) {
    return true;
  }
  return norm.includes(full);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Dernier highlight d'un joueur. Préfère un match simple ("X vs Y") au
 * résumé collectif ("Day N Highlights") ; à recency égale, l'ordre de la
 * grille (plus récent en premier) tranche.
 */
export function pickPlayerHighlight(
  videos: TennisHighlight[],
  playerName: string,
): TennisHighlight | null {
  if (!playerName) return null;
  const mentioned = videos.filter((v) => titleMentionsPlayer(v.title, playerName));
  if (mentioned.length === 0) return null;
  const singles =
    mentioned.find((v) => /\bvs\b|vs\./i.test(v.title)) ?? null;
  return singles ?? mentioned[0];
}

/**
 * Highlights des 2 joueurs d'un duel. Service principal — cache 24 h.
 * Ne throw jamais : retourne des null quand rien n'est trouvé.
 */
export async function getMatchHighlights(
  playerAName: string,
  playerBName: string,
): Promise<MatchHighlights> {
  const videos = await getChannelIndex();
  return {
    playerA: pickPlayerHighlight(videos, playerAName),
    playerB: pickPlayerHighlight(videos, playerBName),
  };
}

/** Invalidation du cache (tests / déploiement). */
export function invalidateTennisTvCache(): void {
  delete g[MEMO_KEY];
}
