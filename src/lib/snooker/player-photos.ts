// ─── Service photos joueurs Snooker ────────────────────────────────────────
// Sources: base locale (data/snooker-player-photos.json) + Wikipedia API
// La base locale est peuplée par scripts/scrape-player-photos-v2.mjs
// Fallback: undefined → PlayerAvatar affiche les initiales

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const PHOTOS_FILE = join(process.cwd(), "data", "snooker-player-photos.json");

// Cache LRU en mémoire (1h TTL, 200 entrées)
const CACHE_TTL = 3600_000;
const CACHE_MAX = 200;
const photoCache = new Map<string, { url: string; ts: number }>();

// ─── Base locale (peuplée par le scraper) ──────────────────────────────────

let localPhotos: Record<string, string> = {};

function loadLocalPhotos(): Record<string, string> {
  if (Object.keys(localPhotos).length > 0) return localPhotos;
  try {
    if (!existsSync(PHOTOS_FILE)) return {};
    const raw = readFileSync(PHOTOS_FILE, "utf-8");
    const data = JSON.parse(raw);
    localPhotos = data.photos ?? {};
    return localPhotos;
  } catch {
    return {};
  }
}

// ─── Mapping CueTracker ID → titre Wikipedia (fallback) ───────────────────

const PLAYER_WIKI_TITLES: Record<string, string> = {
  "judd-trump": "Judd_Trump",
  "neil-robertson": "Neil_Robertson",
  "john-higgins": "John_Higgins",
  "zhao-xintong": "Zhao_Xintong",
  "wu-yize": "Wu_Yize",
  "shaun-murphy": "Shaun_Murphy",
  "mark-williams": "Mark_Williams_(snooker_player)",
  "kyren-wilson": "Kyren_Wilson",
  "mark-selby": "Mark_Selby",
  "barry-hawkins": "Barry_Hawkins",
  "xiao-guodong": "Xiao_Guodong",
  "mark-allen": "Mark_Allen_(snooker_player)",
  "ding-junhui": "Ding_Junhui",
  "jack-lisowski": "Jack_Lisowski",
  "ronnie-osullivan": "Ronnie_O%27Sullivan",
  "ali-carter": "Ali_Carter",
  "stuart-bingham": "Stuart_Bingham",
  "stephen-maguire": "Stephen_Maguire",
  "zhou-yuelong": "Zhou_Yuelong",
  "jackson-page": "Jackson_Page",
  "noppon-saengkham": "Noppon_Saengkham",
  "pang-junxu": "Pang_Junxu",
  "liu-haotian": "Liu_Haotian_(snooker_player)",
  "scott-donaldson": "Scott_Donaldson",
  "jamie-jones": "Jamie_Jones_(snooker_player)",
  "tom-ford": "Tom_Ford_(snooker_player)",
  "gary-wilson": "Gary_Wilson_(snooker_player)",
  "yuan-sijun": "Yuan_Sijun",
  "dominic-dale": "Dominic_Dale",
  "graeme-dott": "Graeme_Dott",
  "michael-holt": "Michael_Holt_(snooker_player)",
  "liang-wenbo": "Liang_Wenbo",
  "martin-gould": "Martin_Gould",
  "david-gilbert": "David_Gilbert_(snooker_player)",
  "joe-perry": "Joe_Perry_(snooker_player)",
  "xu-si": "Xu_Si",
  "rob-milkins": "Rob_Milkins",
  "thepchaiya-un-nooh": "Thepchaiya_Un-Nooh",
  "hussain-vafaei": "Hossein_Vafaei",
  "liam-highfield": "Liam_Highfield",
  "chris-wakelin": "Chris_Wakelin",
  "elliott-slessor": "Elliott_Slessor",
  "stuart-carrington": "Stuart_Carrington",
  "ng-on-yee": "Ng_On_Yee",
  "jimmy-white": "Jimmy_White",
  "luca-brecel": "Luca_Brecel",
  "marco-fu": "Marco_Fu",
};

function cleanThumbUrl(raw: string): string {
  return raw.replace(/\/(\d+)px-/, "/200px-").split("?")[0];
}

// ─── Fetch photo ──────────────────────────────────────────────────────────

export async function fetchPlayerPhoto(cueId: string): Promise<string | undefined> {
  // 1) Cache mémoire
  const cached = photoCache.get(cueId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.url;

  // 2) Base locale (rapide, pas de network)
  const local = loadLocalPhotos();
  if (local[cueId]) {
    if (photoCache.size >= CACHE_MAX) {
      const k = photoCache.keys().next().value;
      if (k) photoCache.delete(k);
    }
    photoCache.set(cueId, { url: local[cueId], ts: Date.now() });
    return local[cueId];
  }

  // 3) Wikipedia API (fallback pour joueurs pas dans la base)
  const wikiTitle = PLAYER_WIKI_TITLES[cueId];
  if (!wikiTitle) return undefined;

  try {
    const url = `${WIKIPEDIA_API}?action=query&titles=${wikiTitle}&prop=pageimages&format=json&pithumbsize=200&origin=*`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = await res.json() as any;
    const pages = data?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    const thumbUrl = page?.thumbnail?.source;
    if (thumbUrl) {
      const clean = cleanThumbUrl(thumbUrl);
      if (photoCache.size >= CACHE_MAX) {
        const k = photoCache.keys().next().value;
        if (k) photoCache.delete(k);
      }
      photoCache.set(cueId, { url: clean, ts: Date.now() });
      return clean;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Retourne le nombre de photos disponibles dans la base locale.
 */
export function getPhotoDatabaseStats(): { total: number; source: string } {
  const local = loadLocalPhotos();
  return { total: Object.keys(local).length, source: PHOTOS_FILE };
}
