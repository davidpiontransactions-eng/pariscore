// Service de résolution de streams LiveTV (https://livetv902.me).
//
// Pipeline : recherche d'événement via megasearch (locale EN) → matching des
// noms normalisés → fetch de la page eventinfo → extraction des liens
// webplayer → embeds iframe `/export/webplayer.iframe.php`. Résultat mis en
// cache TTL (globalThis, multi-worker safe) pour amortir le scraping upstream.

import { AppError } from "./api-error";
import { createTtlCache, isFresh, type TtlCacheEntry } from "./cached-route";
import { isScraplingStealthEnabled, stealthFetchHtml } from "./scrapling-bridge";
import { normalizeTeamName } from "./normalize-team-name";

// ─── Config ──────────────────────────────────────────────────────────────

const LIVETV_DEFAULT_BASE = "https://livetv902.me";
const LIVETV_FALLBACK_BASE = "https://livetv903.me";
const CACHE_TTL_FOUND_MS = 30 * 60 * 1000; // 30 min
const CACHE_TTL_NOT_FOUND_MS = 5 * 60 * 1000; // 5 min (anti-hammering des négatifs)
const FETCH_TIMEOUT_MS = 12000;

export type LiveTvSport = "football" | "tennis" | "basketball" | "mma";

/** Mapping sport PariScore → section sport LiveTV (getSportLink). */
export const LIVETV_SPORT_CATEGORY: Record<LiveTvSport, number> = {
  football: 1,
  tennis: 4,
  basketball: 3,
  mma: 6, // "Boxing / Wrestling" (couvre MMA)
};

function getBaseUrl(): string {
  return (process.env.LIVETV_BASE_URL || LIVETV_DEFAULT_BASE).replace(/\/+$/, "");
}

// ─── Types ───────────────────────────────────────────────────────────────

export type LiveTvEventCandidate = {
  id: string;
  title: string;
  date?: string;
  url: string;
};

export type LiveTvStreamLink = {
  cid: string;
  label: string;
  lang: string;
  eid: string;
  lid: string;
  ci: string;
  si: string;
  /** URL absolue de l'embed iframe `/export/webplayer.iframe.php?...` */
  embedUrl: string;
};

export type LiveTvResolvedEvent = {
  id: string;
  title: string;
  startTime: string | null;
  url: string;
};

export type LiveTvResolveResult = {
  found: boolean;
  sport: LiveTvSport;
  home: string;
  away: string;
  /** Événement LiveTV matché (null si non trouvé). */
  event: LiveTvResolvedEvent | null;
  /** Liens de streaming disponibles pour l'événement. */
  streams: LiveTvStreamLink[];
  /** Détail du matching (débogage). */
  match: { query: string; eventTitle: string; score: number } | null;
  cached: boolean;
  source: string;
  resolvedAt: string;
};

// Cache clé → entrée {data, at} — compatible createTtlCache/isFresh, TTL modulable
// par résultat (positif 30 min, négatif 5 min) via une timestamp par clé.
const streamCache = createTtlCache<Record<string, TtlCacheEntry<LiveTvResolveResult>>>(
  "__livetvStreamResolveCache"
);

function cacheKey(sport: LiveTvSport, home: string, away: string): string {
  return `${sport}::${normalizeTeamName(home)}::${normalizeTeamName(away)}`;
}

// ─── Fetch helper ────────────────────────────────────────────────────────

async function fetchHtml(baseUrl: string, path: string, signal?: AbortSignal): Promise<string> {
  const url = `${baseUrl}${path}`;
  let nativeError: AppError | null = null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en,en-US;q=0.9",
      },
      signal: signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new AppError("LIVETV_HTTP", `LiveTV HTTP ${res.status}`, res.status);
    const text = await res.text();
    // Détection d'une page challenge Cloudflare (pas de contenu utile).
    if (
      text.length < 500 ||
      /cf-chl-|Just a moment|Enable JavaScript and cookies to continue/i.test(text)
    ) {
      throw new AppError("LIVETV_BLOCKED", "LiveTV page protégée (anti-bot)", 403);
    }
    return text;
  } catch (err) {
    nativeError = err as AppError;
  }

  // Fallback Scrapling stealth (Camoufox + proxy résidentiel éventuel) quand
  // LiveTV rejette l'IP datacenter (451/403/challenge). Uniquement si le flag
  // SCRAPLING_ENABLED est actif. Si le stealth échoue aussi, on ré-émet
  // l'erreur native pour conserver le fallback miroir / cache négatif.
  const blockable =
    nativeError &&
    (nativeError.code === "LIVETV_HTTP" || nativeError.code === "LIVETV_BLOCKED");
  if (isScraplingStealthEnabled() && blockable) {
    try {
      return await stealthFetchHtml(url);
    } catch {
      throw nativeError;
    }
  }
  throw nativeError;
}

/** Découpe et supprime les balises du texte d'un lien (titres megasearch). */
function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "") // strip <b>..</b>, tags
    .replace(/&ndash;|&mdash;|&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Étape 1 : recherche d'événements (megasearch EN) ─────────────────────

const EVENTINFO_RE = /href="(\/enx\/eventinfo\/(\d+)[^"]*\/)"[^>]*>([\s\S]*?)<\/a>/gi;

export async function searchLiveTvEvents(
  query: string,
  opts?: { baseUrl?: string; signal?: AbortSignal },
): Promise<LiveTvEventCandidate[]> {
  const baseUrl = (opts?.baseUrl ?? getBaseUrl()).replace(/\/+$/, "");
  const q = encodeURIComponent(query.trim());
  let html: string;
  try {
    html = await fetchHtml(baseUrl, `/enx/megasearch/?msq=${q}`, opts?.signal);
  } catch (err) {
    if ((err as AppError).code === "LIVETV_BLOCKED" || (err as AppError).code === "LIVETV_HTTP") {
      // Fallback sur domaine miroir (livetv902 → livetv903).
      const fb = (opts?.baseUrl ? baseUrl : LIVETV_DEFAULT_BASE).replace(
        /livetv9\d{2}/,
        LIVETV_FALLBACK_BASE.replace("https://livetv", "livetv"),
      );
      if (fb !== baseUrl) {
        html = await fetchHtml(fb, `/enx/megasearch/?msq=${q}`, opts?.signal);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  const events: LiveTvEventCandidate[] = [];
  let m: RegExpExecArray | null;
  EVENTINFO_RE.lastIndex = 0;
  while ((m = EVENTINFO_RE.exec(html)) !== null) {
    const id = m[2];
    const title = cleanTitle(m[3]);
    if (!id || !title) continue;
    // Dédoublonnage par id (la page contient plusieurs liens vers l'événement).
    if (events.some((e) => e.id === id)) continue;
    events.push({ id, title, url: `${baseUrl}${m[1]}` });
  }
  return events.slice(0, 20);
}

// ─── Étape 2 : extraction des liens de streaming (page eventinfo) ─────────

const WEBPLAYER_RE =
  /href="\/webplayer\.php\?t=ifr&c=(\d+)&lang=([a-z]{2})&eid=(\d+)&lid=(\d+)&ci=(\d+)&si=(\d+)"/gi;

export async function getLiveTvStreams(
  eventId: string,
  opts?: { baseUrl?: string; signal?: AbortSignal },
): Promise<{ event: LiveTvResolvedEvent; streams: LiveTvStreamLink[] }> {
  const baseUrl = (opts?.baseUrl ?? getBaseUrl()).replace(/\/+$/, "");
  // URL canonique accessible : /enx/eventinfo/{id}_/ (slug variable selon locale).
  const html = await fetchHtml(baseUrl, `/enx/eventinfo/${eventId}_/`, opts?.signal);

  // Titre depuis <title> : "Home &ndash; Away Live Stream | ..." (locale EN).
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? cleanTitle(titleMatch[1]) : "";
  const title =
    rawTitle
      .replace(/\s*[|–—-]\s*Live Stream.*$/i, " ")
      .replace(/[\u2013\u2014]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "";

  const startTimeMatch = html.match(/<meta property="event:start_time" content="([^"]+)"/i);
  const startTime = startTimeMatch ? startTimeMatch[1] : null;

  const streams: LiveTvStreamLink[] = [];
  let m: RegExpExecArray | null;
  WEBPLAYER_RE.lastIndex = 0;
  while ((m = WEBPLAYER_RE.exec(html)) !== null) {
    const cid = m[1];
    const lang = m[2];
    const eid = m[3];
    const lid = m[4];
    const ci = m[5];
    const si = m[6];
    // Skip des lignes désactivées (opacity: 0.5 dans le tableau lnktbj).
    const lineStart = html.lastIndexOf("<table", m.index);
    const rowChunk = html.slice(lineStart, m.index + 300);
    if (/opacity:\s*0[.,]5/.test(rowChunk) && rowChunk.includes("lnktbj")) {
      // Un lien grisé : on le conserve en secours, marqué comme faible qualité.
    }
    const labelMatch = html.match(new RegExp(`id="ltonq${cid}"[^>]*>([^<]*)<`, "i"));
    const label = (labelMatch?.[1] ?? "Web").trim() || `Canal ${streams.length + 1}`;
    const params = `t=ifr&c=${cid}&lang=${lang}&eid=${eid}&lid=${lid}&ci=${ci}&si=${si}`;
    streams.push({
      cid,
      label,
      lang,
      eid,
      lid,
      ci,
      si,
      embedUrl: `${baseUrl}/export/webplayer.iframe.php?${params}`,
    });
  }

  return { event: { id: eventId, title, startTime, url: `${baseUrl}/enx/eventinfo/${eventId}_/` }, streams };
}

// ─── Étape 3 : scoring du matching ────────────────────────────────────────

/** Score 0..1 entre deux noms normalisés (revenant à l'égalité exacte). */
export function matchNameScore(aRaw: string, bRaw: string): number {
  const a = normalizeTeamName(aRaw);
  const b = normalizeTeamName(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Contient « tel quel » au début (juventus vs juventusturin… non).
  if (a.includes(b) || b.includes(a)) {
    // L'inclusion seule est un bon signal si les deux longueurs ≥ 5.
    return Math.min(1, 0.86 + Math.min(a.length, b.length) / 100);
  }
  // Chevauchement de tokens (mots ≥ 3 lettres).
  const tokens = (s: string): string[] => s.match(/[a-z0-9]{3,}/g) ?? [];
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const shared = ta.filter((t) => tb.includes(t)).length;
  const union = new Set([...ta, ...tb]).size;
  if (shared === 0) return 0;
  const jaccard = shared / union;
  // "barcelona" vs "barcelona sc" → tokens {barcelona} ∩ {barcelona,sc} → strong.
  return Math.min(1, 0.55 + jaccard * 0.45);
}

/** Combine les scores des 2 côtés (home/away) en un score global d'événement. */
function eventScore(evTitle: string, home: string, away: string): number {
  const normTitle = evTitle.replace(/[\u2013\u2014]/g, " ").replace(/\s+/g, " ").trim();
  const parts = normTitle.split(/\s+-|-\s+|\s+vs\.?\s+/i).filter(Boolean);
  if (parts.length >= 2) {
    const homeSide = parts[0].trim();
    const awaySide = parts.slice(1).join(" ").trim();
    return (matchNameScore(homeSide, home) + matchNameScore(awaySide, away)) / 2;
  }
  // Titre sans séparateur : score plafonné aux deux noms complets dans le titre.
  const normHome = normalizeTeamName(home);
  const normAway = normalizeTeamName(away);
  if (normTitle.includes(normHome) || normTitle.includes(normAway)) return 0.5;
  return Math.max(matchNameScore(normTitle, home), matchNameScore(normTitle, away)) * 0.4;
}

const MATCH_THRESHOLD = 0.72;

// ─── Étape 4 : résolution complète (recherche → match → streams) ─────────

/**
 * Résout le flux LiveTV pour un match (sport + noms home/away).
 * - cache positif 30 min, négatif 5 min
 * - recherche megasearch sur les deux noms, union des candidats
 * - si aucun candidat après recherche → repli sur la liste du jour (section sport)
 */
export async function resolveLiveTvStream(
  sport: LiveTvSport,
  home: string,
  away: string,
  opts?: { signal?: AbortSignal },
): Promise<LiveTvResolveResult> {
  const key = cacheKey(sport, home, away);
  const cached = streamCache.get()?.[key];
  const ttl = cached && cached.data.found ? CACHE_TTL_FOUND_MS : CACHE_TTL_NOT_FOUND_MS;
  if (cached && isFresh(cached, ttl)) {
    return { ...cached.data, cached: true };
  }

  const baseUrl = getBaseUrl();
  const me = (query: string) => searchLiveTvEvents(query, { baseUrl, signal: opts?.signal });
  const [homeHits, awayHits] = await Promise.all([me(home), me(away)]);
  const all = [...homeHits, ...awayHits];
  const seen = new Set<string>();
  const uniq = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));

  // Scoring.
  let best: LiveTvEventCandidate | null = null;
  let bestScore = 0;
  let bestQuery = "";
  for (const ev of uniq) {
    const score = eventScore(ev.title, home, away);
    if (score > bestScore) {
      bestScore = score;
      best = ev;
      bestQuery = homeHits.some((h) => h.id === ev.id) ? home : away;
    }
  }

  let result: LiveTvResolveResult;
  if (best && bestScore >= MATCH_THRESHOLD) {
    try {
      const { event, streams } = await getLiveTvStreams(best.id, { baseUrl, signal: opts?.signal });
      result = {
        found: true,
        sport,
        home,
        away,
        event,
        streams,
        match: { query: bestQuery, eventTitle: best.title, score: Math.round(bestScore * 100) },
        cached: false,
        source: best.url,
        resolvedAt: new Date().toISOString(),
      };
    } catch (err) {
      if ((err as AppError).code === "LIVETV_BLOCKED") {
        result = {
          found: false,
          sport,
          home,
          away,
          event: null,
          streams: [],
          match: null,
          cached: false,
          source: best.url,
          resolvedAt: new Date().toISOString(),
        };
      } else {
        throw err;
      }
    }
  } else {
    result = {
      found: false,
      sport,
      home,
      away,
      event: null,
      streams: [],
      match: best ? { query: bestQuery, eventTitle: best.title, score: Math.round(bestScore * 100) } : null,
      cached: false,
      source: baseUrl,
      resolvedAt: new Date().toISOString(),
    };
  }

  // Mise en cache (positif et négatif).
  const slot = streamCache.get() ?? {};
  slot[key] = { data: result, at: Date.now() };
  streamCache.set(slot);

  return result;
}

/** Invalidation manuelle (utile pour tests / re-scrape). */
export function invalidateLiveTvStreamCache(sport: LiveTvSport, home: string, away: string): void {
  const slot = streamCache.get();
  if (!slot) return;
  delete slot[cacheKey(sport, home, away)];
  streamCache.set(slot);
}