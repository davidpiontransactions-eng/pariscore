// Service de revue de presse football — aggregateur multi-sources.
// Server-only. Cache 24h (memoire + disque). Pipeline Zero-LLM :
// découverte RSS → connecteurs ciblés → extraction regex → synthèse déterministe.
// Aucun appel Gemini (llmFallback supprimé).
//
// Sources cibles : Forebet, FootyStats, SportyTrader, WhoScored, LastWordOnSports.
// Chaque source fournit : resume tactique, pronostic (1X2, O/U, BTTS), score exact.

import { promises as fs } from "fs";
import path from "path";

import {
  extractFootballPrediction,
  extractSummary,
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
import { buildFootballSynthesis } from "@/lib/press-synthesis-template";

// ---- Types exportés ----

export type FootballPressPrediction = {
  text: string;
  type: "1X2" | "over_under" | "btts" | "exact_score" | "other";
  exactScore?: string;
  confidence: number;
};

export type FootballPressSource = {
  name: string;
  domain: string;
  icon: string;
  url: string;
  expertSummary: string;
  prediction: FootballPressPrediction;
  /** true = entrée de synthèse déterministe (dérivée des sources réelles), jamais une source de presse externe. */
  generated?: boolean;
};

export type FootballPressConsensus = {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  over25Pct: number;
  bttsYesPct: number;
  totalSources: number;
  dominant: "home" | "draw" | "away" | "mixed";
};

export type FootballPressReviewResult = {
  status: "available";
  sources: FootballPressSource[];
  consensus: FootballPressConsensus;
  teams: { home: string; away: string };
  fetchedAt: string;
};

export type FootballPressReviewQuery = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  leagueName?: string;
};

// ---- Constantes ----

const TTL_MS = 24 * 60 * 60 * 1000;

const PRESS_SOURCES = [
  { name: "Forebet", domain: "forebet.com", icon: "📊" },
  { name: "FootyStats", domain: "footystats.org", icon: "📈" },
  { name: "SportyTrader", domain: "sportytrader.com", icon: "🎯" },
  { name: "WhoScored", domain: "whoscored.com", icon: "⚽" },
  { name: "LastWordOnSports", domain: "lastwordonsports.com", icon: "📰" },
];

// ---- Cache ----

type MemoEntry = { data: FootballPressReviewResult | null; at: number };
const gCache = globalThis as unknown as Record<string, MemoEntry | undefined>;
function cacheDir() { return path.join(process.cwd(), ".cache", "press-review"); }
function cachePath(q: FootballPressReviewQuery) {
  return path.join(cacheDir(), "football-" + q.matchId.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
}
function memoGet(q: FootballPressReviewQuery): FootballPressReviewResult | null | undefined {
  const e = gCache["__fpr_" + q.matchId];
  if (!e || Date.now() - e.at >= TTL_MS) return undefined;
  return e.data;
}
function memoSet(q: FootballPressReviewQuery, d: FootballPressReviewResult | null) {
  gCache["__fpr_" + q.matchId] = { data: d, at: Date.now() };
}
async function cacheRead(q: FootballPressReviewQuery): Promise<FootballPressReviewResult | null | undefined> {
  try {
    const raw = await fs.readFile(cachePath(q), "utf8");
    const e = JSON.parse(raw) as MemoEntry;
    if (!e || Date.now() - e.at >= TTL_MS) return undefined;
    return e.data;
  } catch { return undefined; }
}
async function cacheWrite(q: FootballPressReviewQuery, d: FootballPressReviewResult | null) {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(cachePath(q), JSON.stringify({ data: d, at: Date.now() }), "utf8");
  } catch { /* best-effort */ }
}

/** Découverte multi-articles via Google News RSS (unique canal — le fallback Google Search HTML a été supprimé, trop fragile). */
async function discoverArticles(q: FootballPressReviewQuery): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = [];
  const H = buildFetchHeaders();

  try {
    const rssUrl = "https://news.google.com/rss/search?q=" +
      encodeURIComponent(q.homeTeam + " vs " + q.awayTeam + " prediction preview football") +
      "&hl=en&gl=US&ceid=US:en";
    const rr = await fetch(rssUrl, { headers: H, signal: AbortSignal.timeout(10000) });
    if (rr.ok) {
      const rt = await rr.text();
      const items = rt.match(/<item>[\s\S]*?<\/item>/g) || [];
      const seen = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        if (results.length >= MAX_SOURCES) break;
        const it = items[i];
        const um = it.match(/<link>(.*?)<\/link>/);
        if (!um) continue;
        const ru = um[1].replace(/&amp;/g, "&");
        const sh = new URL(ru).hostname.replace(/^www\./, "");
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

function computeConsensus(sources: FootballPressSource[], home: string, away: string): FootballPressConsensus {
  const n = sources.length;
  if (n === 0) {
    return {
      homeWinPct: 33, drawPct: 34, awayWinPct: 33,
      over25Pct: 50, bttsYesPct: 50, totalSources: 0, dominant: "mixed",
    };
  }

  let homeW = 0, drawW = 0, awayW = 0, over25W = 0, bttsW = 0;

  for (const s of sources) {
    const p = s.prediction;
    const t = p.text.toLowerCase();
    const hShort = home.split(/\s+/).pop() || home;
    const aShort = away.split(/\s+/).pop() || away;
    if (t.includes("victoire") && t.includes(hShort.toLowerCase())) homeW++;
    else if (t.includes("victoire") && t.includes(aShort.toLowerCase())) awayW++;
    else if (t.includes("nul")) drawW++;
    else if (t.includes("home") || t.includes("domicile")) homeW++;
    else if (t.includes("away") || t.includes("extérieur") || t.includes("exterieur")) awayW++;
    else { homeW += 0.5; awayW += 0.5; }

    if (p.type === "over_under" && t.includes("over")) over25W++;
    if (p.type === "btts" || t.includes("marquent")) bttsW++;
  }

  const hp = Math.round((homeW / n) * 100);
  const ap = Math.round((awayW / n) * 100);
  const dp = 100 - hp - ap;

  let dominant: FootballPressConsensus["dominant"] = "mixed";
  if (hp >= 50) dominant = "home";
  else if (ap >= 50) dominant = "away";
  else if (dp >= 40) dominant = "draw";

  return {
    homeWinPct: hp,
    drawPct: Math.max(0, dp),
    awayWinPct: ap,
    over25Pct: Math.round((over25W / n) * 100),
    bttsYesPct: Math.round((bttsW / n) * 100),
    totalSources: n,
    dominant,
  };
}

// ---- Entry point ----

export async function getFootballPressReview(q: FootballPressReviewQuery): Promise<FootballPressReviewResult | null> {
  if (!q.matchId || !q.homeTeam || !q.awayTeam) return null;

  const mem = memoGet(q);
  if (mem !== undefined) return mem;
  const file = await cacheRead(q);
  if (file !== undefined) { memoSet(q, file); return file; }

  const articles = await discoverArticles(q);
  const sources: FootballPressSource[] = articles.map((a) => ({
    name: a.sourceName,
    domain: a.host,
    icon: a.icon,
    url: a.url,
    expertSummary: extractSummary(a.text, [q.homeTeam, q.awayTeam]),
    prediction: extractFootballPrediction(a.text, q.homeTeam, q.awayTeam, a.predictText),
  }));

  // Synthèse déterministe : dérivée des sources réelles, jamais inventée.
  // prediction.type est obligatoire chez FootballPressSource → coerce.
  if (sources.length < MIN_SOURCES && sources.length >= MIN_SOURCES - 1) {
    const syn = buildFootballSynthesis(sources, q.homeTeam, q.awayTeam);
    if (syn) {
      sources.push({
        ...syn,
        prediction: {
          ...syn.prediction,
          type: (syn.prediction.type ?? "other") as FootballPressPrediction["type"],
        },
      });
    }
  }

  if (sources.length < MIN_SOURCES) {
    memoSet(q, null);
    await cacheWrite(q, null);
    return null;
  }

  const trimmed = sources.slice(0, MAX_SOURCES);
  const consensus = computeConsensus(trimmed, q.homeTeam, q.awayTeam);

  const result: FootballPressReviewResult = {
    status: "available",
    sources: trimmed,
    consensus,
    teams: { home: q.homeTeam, away: q.awayTeam },
    fetchedAt: new Date().toISOString(),
  };

  memoSet(q, result);
  await cacheWrite(q, result);
  return result;
}

export async function invalidateFootballPressReview(q: FootballPressReviewQuery): Promise<void> {
  memoSet(q, null);
  try { await fs.rm(cachePath(q), { force: true }); } catch (e) { /* ok */ }
}