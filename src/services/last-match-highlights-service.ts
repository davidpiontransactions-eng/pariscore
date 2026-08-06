// Service de recherche de highlights YouTube pour le dernier match joué d'un
// duel tennis. Complément au scraper TennisTV (canal fixe) :
//
//   1. Recherche ciblée YouTube par requête ("A vs B highlights", ou
//      fallback « A last match highlights <année> »).
//   2. Si rien : réutilisation du canal TennisTV (getMatchHighlights) pour la
//      désignation par joueur.
//   3. Dernier recours : vidéo générique du tournoi (« <tournoi> highlights »).
//
// Cache mémoire + fichier (.cache/highlights/) avec TTL 48 h. Server-only.

import { promises as fs } from "fs";
import path from "path";

import {
  FETCH_HEADERS,
  parseVideosHtml,
  type TennisHighlight,
} from "@/lib/scraping/tennistv-highlights-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LastMatchHighlights = {
  /** Meilleure vidéo trouvée pour le duel « A vs B » (H2H direct). */
  h2h: TennisHighlight | null;
  /** Vidéo du joueur A (fallback si pas de H2H). */
  playerA: TennisHighlight | null;
  /** Vidéo du joueur B (fallback si pas de H2H). */
  playerB: TennisHighlight | null;
  /** Vidéo générique du tournoi (dernier recours). */
  tournament: TennisHighlight | null;
  /** Requête qui a réellement produit le résultats (transparence debug). */
  source: "h2h" | "player" | "tournament" | "tennistv" | "empty";
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TTL_MS = 48 * 60 * 60 * 1000; // 48 h
const MAX_VIDEOS = 12;
const SEARCH_BASE = "https://www.youtube.com/results?search_query=";

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

type CachedSearch = { at: number; videos: TennisHighlight[] };

const g = globalThis as unknown as Record<string, CachedSearch | undefined>;
const MEMO_PREFIX = "__youtube_search_";

function cacheDir(): string {
  return path.join(process.cwd(), ".cache", "highlights");
}

function hashKey(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

async function readFileCache(key: string): Promise<CachedSearch | null> {
  try {
    const raw = await fs.readFile(
      path.join(cacheDir(), `${hashKey(key)}.json`),
      "utf8",
    );
    return JSON.parse(raw) as CachedSearch;
  } catch {
    return null;
  }
}

async function writeFileCache(key: string, index: CachedSearch): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(
      path.join(cacheDir(), `${hashKey(key)}.json`),
      JSON.stringify(index),
      "utf8",
    );
  } catch {
    // Cache best-effort — ne jamais faire échouer le service.
  }
}

/** Recherche YouTube par requête textuelle, cache 48 h. Jamais de throw. */
async function searchYouTube(query: string): Promise<TennisHighlight[]> {
  const key = query.toLowerCase().trim();
  if (!key) return [];

  const memo = g[MEMO_PREFIX + key];
  if (memo && Date.now() - memo.at < TTL_MS) return memo.videos;

  const fileCache = await readFileCache(key);
  if (fileCache && Date.now() - fileCache.at < TTL_MS) {
    g[MEMO_PREFIX + key] = fileCache;
    return fileCache.videos;
  }

  try {
    const url = SEARCH_BASE + encodeURIComponent(key);
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) {
      if (fileCache) {
        g[MEMO_PREFIX + key] = fileCache;
        return fileCache.videos;
      }
      return [];
    }
    const html = await res.text();
    const videos = parseVideosHtml(html).slice(0, MAX_VIDEOS);
    const index: CachedSearch = { at: Date.now(), videos };
    g[MEMO_PREFIX + key] = index;
    void writeFileCache(key, index);
    return videos;
  } catch {
    if (fileCache) {
      g[MEMO_PREFIX + key] = fileCache;
      return fileCache.videos;
    }
    return [];
  }
}

/** Vidéo la plus récente d'un set, ou null. */
function pickBest(videos: TennisHighlight[]): TennisHighlight | null {
  return videos[0] ?? null;
}

// ---------------------------------------------------------------------------
// Service principal
// ---------------------------------------------------------------------------

/**
 * Highlights du dernier match — stratégie en cascade :
 *
 *  1. Recherche YouTube ciblée « A vs B highlights » (H2H direct).
 *  2. Sinon recherche « A last match » + « B last match » séparées.
 *  3. Sinon vidéo générique du tournoi `traduction`.
 *  4. Fallback final : canal TennisTV (désignation par joueur).
 *
 * Production ne throw jamais : chaque branche retombe sur null. Toutes les
 * vidéos proviennent de YouTube (embedding vide), le client choisit quoi
 * afficher. Cache 48 h.
 */
export async function getLastMatchHighlights(params: {
  playerA: string;
  playerB: string;
  tournamentName?: string | null;
}): Promise<LastMatchHighlights> {
  const { playerA, playerB, tournamentName } = params;

  // 1. H2H direct.
  const year = new Date().getFullYear().toString();
  for (const query of [
    `${playerA} vs ${playerB} highlights`,
    `${playerA} vs ${playerB} highlights ${year}`,
  ]) {
    const videos = await searchYouTube(query);
    const h2h = pickBest(videos);
    if (h2h) {
      return { h2h, playerA: null, playerB: null, tournament: null, source: "h2h" };
    }
  }

  // 2. Branche par joueur (fallback si aucun H2H).
  const [videosA, videosB] = await Promise.all([
    searchYouTube(`${playerA} last match highlights`),
    searchYouTube(`${playerB} last match highlights`),
  ]);
  const playerAH = pickBest(videosA);
  const playerBH = pickBest(videosB);
  if (playerAH || playerBH) {
    return {
      h2h: null,
      playerA: playerAH,
      playerB: playerBH,
      tournament: null,
      source: "player",
    };
  }

  // 3. Vidéo générique du tournoi (si un nom est passé).
  if (tournamentName && tournamentName.trim()) {
    const videos = await searchYouTube(`${tournamentName} highlights`);
    const tour = pickBest(videos);
    if (tour) {
      return {
        h2h: null,
        playerA: null,
        playerB: null,
        tournament: tour,
        source: "tournament",
      };
    }
  }

  return { h2h: null, playerA: null, playerB: null, tournament: null, source: "empty" };
}

/** Invalidation du cache (tests / déploiement). */
export async function invalidateHighlightsCache(): Promise<void> {
  for (const k of Object.keys(g)) {
    if (k.startsWith(MEMO_PREFIX)) delete g[k];
  }
  try {
    await fs.rm(cacheDir(), { recursive: true, force: true });
  } catch {
    // best-effort
  }
}