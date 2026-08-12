// Service de revue de presse tennis — aggregateur multi-sources.
// Server-only. Cache 24h (memoire + disque). Pipeline Zero-LLM :
// découverte RSS → connecteurs ciblés → extraction regex → synthèse déterministe.
// Aucun appel Gemini (llmFallback supprimé).

import { promises as fs } from "fs";
import path from "path";

import {
  extractSummary,
  extractTennisPrediction,
  buildFetchHeaders,
  MAX_SOURCES,
  MIN_SOURCES,
} from "@/lib/press-extractors";
import {
  fetchArticleTargeted,
  isDomainBlocked,
  reportDomainResult,
  type FetchedArticle,
} from "@/lib/press-connectors";
import { buildTennisSynthesis } from "@/lib/press-synthesis-template";

export type PressPrediction = { text: string; favoredPlayer: string | null; confidence: number };
export type PressSource = {
  name: string;
  domain: string;
  icon: string;
  url: string;
  expertSummary: string;
  prediction: PressPrediction;
  /** true = entrée de synthèse déterministe (dérivée des sources réelles), jamais une source de presse externe. */
  generated?: boolean;
};
export type PressConsensus = { playerAPct: number; playerBPct: number; totalSources: number; favoredPlayer: string | null };
export type PressReviewResult = { status: "available"; sources: PressSource[]; consensus: PressConsensus; players: { playerA: string; playerB: string }; fetchedAt: string };
export type PressReviewQuery = { matchId: string; playerAName: string; playerBName: string; tournamentName?: string; surface?: string };

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PREDICTION_CHARS = 200;

const PRESS_SOURCES = [
  { name: "TennisMajors", domain: "tennismajors.com", icon: "\uD83C\uDFBE" },
  { name: "LastWordOnSports", domain: "lastwordonsports.com", icon: "\uD83D\uDCF0" },
  { name: "Tennis.com", domain: "tennis.com", icon: "\uD83C\uDFC6" },
  { name: "Ubitennis", domain: "ubitennis.com", icon: "\uD83C\uDDEE\uD83C\uDDF9" },
  { name: "Eurosport", domain: "eurosport.com", icon: "\uD83D\uDCFA" },
];

// ---- Cache ----
type MemoEntry = { data: PressReviewResult | null; at: number };
const gCache = globalThis as unknown as Record<string, MemoEntry | undefined>;
function cacheDir() { return path.join(process.cwd(), ".cache", "press-review"); }
function cachePath(q: PressReviewQuery) {
  return path.join(cacheDir(), "tennis-" + q.matchId.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
}
function memoGet(q: PressReviewQuery): PressReviewResult | null | undefined {
  const e = gCache["__pr_" + q.matchId];
  if (!e || Date.now() - e.at >= TTL_MS) return undefined;
  return e.data;
}
function memoSet(q: PressReviewQuery, d: PressReviewResult | null) {
  gCache["__pr_" + q.matchId] = { data: d, at: Date.now() };
}
async function cacheRead(q: PressReviewQuery): Promise<PressReviewResult | null | undefined> {
  try {
    const raw = await fs.readFile(cachePath(q), "utf8");
    const e = JSON.parse(raw) as MemoEntry;
    if (!e || Date.now() - e.at >= TTL_MS) return undefined;
    return e.data;
  } catch { return undefined; }
}
async function cacheWrite(q: PressReviewQuery, d: PressReviewResult | null) {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(cachePath(q), JSON.stringify({ data: d, at: Date.now() }), "utf8");
  } catch { /* best-effort */ }
}

/** Découverte multi-articles via Google News RSS (unique canal — le fallback Google Search HTML a été supprimé, trop fragile). */
async function discoverArticles(q: PressReviewQuery): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = [];
  const H = buildFetchHeaders();

  try {
    const rssUrl = "https://news.google.com/rss/search?q=" + encodeURIComponent(q.playerAName + " vs " + q.playerBName + " prediction preview tennis") + "&hl=en&gl=US&ceid=US:en";
    const rr = await fetch(rssUrl, { headers: H, signal: AbortSignal.timeout(10000) });
    if (rr.ok) {
      const rt = await rr.text();
      const items = rt.match(/<item>[\s\S]*?<\/item>/g) || [];
      const seen = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        if (results.length >= MAX_SOURCES) break;
        const it = items[i];
        const um = it.match(/<link>(.*?)<\/link>/);
        const sm = it.match(/<source[^>]*>(.*?)<\/source>/);
        if (!um) continue;
        const ru = um[1].replace(/&amp;/g, "&");
        const sh = sm ? sm[1].replace(/^www\./, "").toLowerCase() : new URL(ru).hostname.replace(/^www\./, "");
        const si = PRESS_SOURCES.find((s) => sh.includes(s.domain));
        if (!si || seen.has(si.domain)) continue;
        seen.add(si.domain);
        if (isDomainBlocked(si.domain)) continue; // circuit-breaker per-domain

        try {
          const fetched = await fetchArticleTargeted(ru, si.domain);
          if (!fetched) { reportDomainResult(si.domain, false); continue; }
          if (fetched.text.length < 500) { reportDomainResult(si.domain, false); continue; }
          reportDomainResult(si.domain, true);
          results.push({
            text: fetched.text,
            predictText: fetched.predictText,
            host: si.domain,
            url: ru,
            sourceName: si.name,
            icon: si.icon,
            viaJina: fetched.viaJina,
          });
        } catch (e) { continue; }
      }
    }
  } catch (e) { /* RSS offline */ }

  return results;
}

// ---- Consensus ----
function computeConsensus(sources: PressSource[], pA: string, pB: string): PressConsensus {
  const n = sources.length;
  if (n === 0) return { playerAPct: 50, playerBPct: 50, totalSources: 0, favoredPlayer: null };
  let a = 0, b = 0;
  for (const s of sources) {
    if (s.prediction.favoredPlayer === pA) a++;
    else if (s.prediction.favoredPlayer === pB) b++;
    else { a += 0.5; b += 0.5; }
  }
  const ap = Math.round((a / n) * 100);
  const bp = Math.round((b / n) * 100);
  return { playerAPct: ap, playerBPct: bp, totalSources: n, favoredPlayer: ap > bp ? pA : bp > ap ? pB : null };
}

// ---- Entry point ----
export async function getPressReview(q: PressReviewQuery): Promise<PressReviewResult | null> {
  if (!q.matchId || !q.playerAName || !q.playerBName) return null;
  const mem = memoGet(q);
  if (mem !== undefined) return mem;
  const file = await cacheRead(q);
  if (file !== undefined) { memoSet(q, file); return file; }

  const articles = await discoverArticles(q);
  const sources: PressSource[] = articles.map((a) => ({
    name: a.sourceName,
    domain: a.host,
    icon: a.icon,
    url: a.url,
    expertSummary: extractSummary(a.text, [q.playerAName, q.playerBName]),
    prediction: extractTennisPrediction(a.text, q.playerAName, q.playerBName, a.predictText),
  }));

  // Synthèse déterministe : dérivée des sources réelles, jamais inventée.
  if (sources.length < MIN_SOURCES && sources.length >= MIN_SOURCES - 1) {
    const syn = buildTennisSynthesis(sources, q.playerAName, q.playerBName);
    if (syn) sources.push(syn);
  }

  if (sources.length < MIN_SOURCES) {
    memoSet(q, null);
    await cacheWrite(q, null);
    return null;
  }

  const trimmed = sources.slice(0, MAX_SOURCES);
  const consensus = computeConsensus(trimmed, q.playerAName, q.playerBName);

  const result: PressReviewResult = {
    status: "available",
    sources: trimmed,
    consensus,
    players: { playerA: q.playerAName, playerB: q.playerBName },
    fetchedAt: new Date().toISOString(),
  };

  memoSet(q, result);
  await cacheWrite(q, result);
  return result;
}

/** Vide les caches d'un match. */
export async function invalidatePressReview(q: PressReviewQuery): Promise<void> {
  memoSet(q, null);
  try { await fs.rm(cachePath(q), { force: true }); } catch (e) { /* ok */ }
}