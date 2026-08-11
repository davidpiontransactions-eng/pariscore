// Service de revue de presse football — aggregateur multi-sources.
// Server-only. Cache 24h (memoire + disque). LLM fallback si scraping insuffisant.
//
// Sources cibles : Forebet, FootyStats, SportyTrader, WhoScored, LastWordOnSports.
// Chaque source fournit : resume tactique, pronostic (1X2, O/U, BTTS), score exact.

import { promises as fs } from "fs";
import path from "path";

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
const MIN_SOURCES = 3;
const MAX_SOURCES = 5;
const MAX_PREDICTION_CHARS = 200;

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

// ---- Helpers ----

function shortName(n: string): string {
  const parts = n.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : n;
}

function stripHtml(h: string): string {
  return h
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---- Scraping multi-sources ----

interface FetchedArticle { text: string; host: string; url: string; sourceName: string; icon: string; }

async function discoverArticles(q: FootballPressReviewQuery): Promise<FetchedArticle[]> {
  const results: FetchedArticle[] = [];
  const H = {
    "User-Agent": "Mozilla/5.0 (compatible; PariScoreBot/1.0; +https://pariscore.fr)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  // Google News RSS
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
        const si = PRESS_SOURCES.find(function(s) { return sh.includes(s.domain); });
        if (!si || seen.has(si.domain)) continue;
        seen.add(si.domain);
        try {
          const ar = await fetch(ru, { headers: H, redirect: "follow", signal: AbortSignal.timeout(8000) });
          if (!ar.ok) continue;
          const fh = new URL(ar.url).hostname.replace(/^www\./, "");
          if (!PRESS_SOURCES.some(function(s) { return fh.includes(s.domain); })) continue;
          const h = await ar.text();
          if (h.length < 500) continue;
          results.push({ text: stripHtml(h), host: fh, url: ru, sourceName: si.name, icon: si.icon });
        } catch (e) { continue; }
      }
    }
  } catch (e) { /* RSS offline */ }

  // Fallback Google Search
  if (results.length < MIN_SOURCES) {
    for (let j = 0; j < PRESS_SOURCES.length; j++) {
      if (results.length >= MAX_SOURCES) break;
      const src = PRESS_SOURCES[j];
      if (results.some(function(r) { return r.sourceName === src.name; })) continue;
      try {
        const searchUrl = "https://www.google.com/search?q=" +
          encodeURIComponent(q.homeTeam + " " + q.awayTeam + " prediction site:" + src.domain);
        const sr = await fetch(searchUrl, {
          headers: { "User-Agent": H["User-Agent"], Accept: "text/html" },
          signal: AbortSignal.timeout(8000),
        });
        if (!sr.ok) continue;
        const shHtml = await sr.text();
        const lm = shHtml.match(new RegExp("https?://(?:www\\.)?" + escRe(src.domain) + "/[^\"\\s<>]+", "i"));
        if (!lm) continue;
        const ar2 = await fetch(lm[0], { headers: H, redirect: "follow", signal: AbortSignal.timeout(8000) });
        if (!ar2.ok) continue;
        const h2 = await ar2.text();
        if (h2.length < 500) continue;
        results.push({ text: stripHtml(h2), host: src.domain, url: lm[0], sourceName: src.name, icon: src.icon });
      } catch (e) { continue; }
    }
  }
  return results;
}

// ---- Extraction du pronostic depuis le texte ----

function extractPrediction(text: string, home: string, away: string): FootballPressPrediction {
  const lower = text.toLowerCase();
  const hShort = shortName(home).toLowerCase();
  const aShort = shortName(away).toLowerCase();

  const scoreMatch = lower.match(/(\d+)\s*[-:]\s*(\d+)/);
  const exactScore = scoreMatch ? `${scoreMatch[1]}-${scoreMatch[2]}` : undefined;

  const bttsYes = /\bboth teams to score.*yes\b/i.test(lower) || /\bbtts.*yes\b/i.test(lower) ||
    /both teams (?:to )?score/i.test(lower) && !/\bwon'?t score\b/i.test(lower);

  const over25 = /\bover\s*2\.5\b/i.test(lower) || /\bmore than 2\.5\b/i.test(lower) ||
    /\bover\s*2,5\b/i.test(lower) || /\b\+2\.5\b/.test(lower);
  const under25 = /\bunder\s*2\.5\b/i.test(lower) || /\bless than 2\.5\b/i.test(lower) ||
    /\bunder\s*2,5\b/i.test(lower);

  let homeWin = false, draw = false, awayWin = false;
  const hPatterns = [hShort, "home win", "home victory", "hosts to win"];
  const aPatterns = [aShort, "away win", "away victory", "visitors to win"];
  const dPatterns = ["draw", "stalemate", "share the points", "points shared"];

  for (const p of hPatterns) { if (lower.includes(p)) { homeWin = true; break; } }
  for (const p of aPatterns) { if (lower.includes(p)) { awayWin = true; break; } }
  for (const p of dPatterns) { if (lower.includes(p)) { draw = true; break; } }

  let confidence = 60;
  if (homeWin || awayWin) confidence = 70;
  if (draw) confidence = 55;

  if (homeWin) {
    return { text: `Victoire ${shortName(home)}`, type: "1X2", exactScore, confidence };
  }
  if (awayWin) {
    return { text: `Victoire ${shortName(away)}`, type: "1X2", exactScore, confidence };
  }
  if (draw) {
    return { text: "Match Nul", type: "1X2", exactScore, confidence: 55 };
  }
  if (over25) {
    return { text: "Over 2.5 Buts", type: "over_under", exactScore, confidence: 65 };
  }
  if (under25) {
    return { text: "Under 2.5 Buts", type: "over_under", exactScore, confidence: 65 };
  }
  if (bttsYes) {
    return { text: "Les 2 équipes marquent", type: "btts", exactScore, confidence: 62 };
  }

  return { text: "Pronostic mixte", type: "other", exactScore, confidence: 55 };
}

function extractSummary(text: string, home: string, away: string): string {
  const sentences = text.split(/[.?!]+/).filter(function(s) { return s.trim().length > 30; });
  const hShort = shortName(home).toLowerCase();
  const aShort = shortName(away).toLowerCase();
  const rel = sentences.filter(function(s) {
    const l = s.toLowerCase();
    return l.includes(hShort) || l.includes(aShort);
  });
  const chosen = (rel.length >= 2 ? rel : sentences).slice(0, 3);
  if (chosen.length === 0) return `Analyse tactique du match ${home} vs ${away}.`;
  return chosen.map(function(s) { return s.trim(); }).join(". ") + ".";
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
    if (t.includes("victoire") && t.includes(shortName(home).toLowerCase())) homeW++;
    else if (t.includes("victoire") && t.includes(shortName(away).toLowerCase())) awayW++;
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
// ---- LLM Fallback ----

async function llmFallback(q: FootballPressReviewQuery): Promise<FootballPressSource[]> {
  if (!process.env.GEMINI_API_KEY) return [];

  const prompt = "Football expert. For \"" + q.homeTeam + " vs " + q.awayTeam + "\"" +
    (q.leagueName ? " in " + q.leagueName : "") +
    ", generate " + MIN_SOURCES + " press predictions. Return ONLY valid JSON (no markdown):\n" +
    '{"sources":[\n' +
    '  {"name":"Forebet","expertSummary":"2-3 sentences tactical analysis in french","prediction":{"text":"Victoire ' + shortName(q.homeTeam) + '","type":"1X2","exactScore":"2-1","confidence":72}},\n' +
    '  {"name":"FootyStats","expertSummary":"...","prediction":{"text":"Over 2.5 Buts","type":"over_under","exactScore":"2-1","confidence":68}},\n' +
    '  {"name":"SportyTrader","expertSummary":"...","prediction":{"text":"Les 2 équipes marquent","type":"btts","exactScore":"1-1","confidence":65}}\n' +
    ']}\n' +
    'Rules: expertSummary in french 2-3 sentences max 400 chars. prediction.text concise max 100 chars. ' +
    'prediction.type: "1X2"|"over_under"|"btts"|"exact_score". confidence 0-100. ONLY JSON.';

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1000 },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!r.ok) return [];
    const d = await r.json() as Record<string, unknown>;
    const raw = (d as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return [];
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.sources || !Array.isArray(parsed.sources)) return [];
    return parsed.sources.map(function(s: {
      name?: string; expertSummary?: string;
      prediction?: { text?: string; type?: string; exactScore?: string; confidence?: number };
    }) {
      const meta = PRESS_SOURCES.find(function(x) { return x.name.toLowerCase() === (s.name || "").toLowerCase(); }) ||
        { name: s.name || "Media", domain: "n/a", icon: "📰" };
      return {
        name: meta.name,
        domain: meta.domain,
        icon: meta.icon,
        url: "",
        expertSummary: String(s.expertSummary || "").slice(0, 400),
        prediction: {
          text: String(s.prediction?.text || "N/D").slice(0, MAX_PREDICTION_CHARS),
          type: (["1X2","over_under","btts","exact_score","other"].includes(String(s.prediction?.type)) ? s.prediction!.type : "other") as FootballPressPrediction["type"],
          exactScore: s.prediction?.exactScore || undefined,
          confidence: Math.min(100, Math.max(0, Math.round(Number(s.prediction?.confidence) || 60))),
        },
      };
    });
  } catch (e) { return []; }
}

// ---- Entry point ----

export async function getFootballPressReview(q: FootballPressReviewQuery): Promise<FootballPressReviewResult | null> {
  if (!q.matchId || !q.homeTeam || !q.awayTeam) return null;

  const mem = memoGet(q);
  if (mem !== undefined) return mem;
  const file = await cacheRead(q);
  if (file !== undefined) { memoSet(q, file); return file; }

  const articles = await discoverArticles(q);
  let sources: FootballPressSource[] = articles.map(function(a) {
    return {
      name: a.sourceName,
      domain: a.host,
      icon: a.icon,
      url: a.url,
      expertSummary: extractSummary(a.text, q.homeTeam, q.awayTeam),
      prediction: extractPrediction(a.text, q.homeTeam, q.awayTeam),
    };
  });

  if (sources.length < MIN_SOURCES) {
    const llmSources = await llmFallback(q);
    const existing = new Set(sources.map(function(s) { return s.name.toLowerCase(); }));
    for (const ls of llmSources) {
      if (!existing.has(ls.name.toLowerCase()) && sources.length < MAX_SOURCES) {
        sources.push(ls);
        existing.add(ls.name.toLowerCase());
      }
    }
  }

  if (sources.length < MIN_SOURCES) {
    memoSet(q, null);
    await cacheWrite(q, null);
    return null;
  }

  sources = sources.slice(0, MAX_SOURCES);
  const consensus = computeConsensus(sources, q.homeTeam, q.awayTeam);

  const result: FootballPressReviewResult = {
    status: "available",
    sources,
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


