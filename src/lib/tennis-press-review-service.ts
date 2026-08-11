// Service de revue de presse tennis — aggregateur multi-sources.
// Server-only. Cache 24h (memoire + disque). LLM fallback si scraping insuffisant.

import { promises as fs } from "fs";
import path from "path";

export type PressPrediction = { text: string; favoredPlayer: string | null; confidence: number; };
export type PressSource = { name: string; domain: string; icon: string; url: string; expertSummary: string; prediction: PressPrediction; };
export type PressConsensus = { playerAPct: number; playerBPct: number; totalSources: number; favoredPlayer: string | null; };
export type PressReviewResult = { status: "available"; sources: PressSource[]; consensus: PressConsensus; players: { playerA: string; playerB: string }; fetchedAt: string; };
export type PressReviewQuery = { matchId: string; playerAName: string; playerBName: string; tournamentName?: string; surface?: string; };

const TTL_MS = 24 * 60 * 60 * 1000;
const MIN_SOURCES = 3;
const MAX_SOURCES = 5;
const MAX_PREDICTION_CHARS = 200;

const PRESS_SOURCES = [
  { name: "TennisMajors", domain: "tennismajors.com", icon: "\uD83C\uDFBE" },
  { name: "LastWordOnSports", domain: "lastwordonsports.com", icon: "\uD83D\uDCF0" },
  { name: "Tennis.com", domain: "tennis.com", icon: "\uD83C\uDFC6" },
  { name: "Ubitennis", domain: "ubitennis.com", icon: "\uD83C\uDDEE\uD83C\uDDF9" },
  { name: "Eurosport", domain: "eurosport.com", icon: "\uD83D\uDCFA" },
];

// ---- Cache ----
type MemoEntry = { data: PressReviewResult | null; at: number; };
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

// ---- Helpers ----
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

function lastName(n: string): string {
  const p = n.trim().split(/\s+/);
  return p[p.length - 1];
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPrediction(text: string, pA: string, pB: string): PressPrediction {
  const aL = lastName(pA).toLowerCase();
  const bL = lastName(pB).toLowerCase();
  const patterns = [
    new RegExp("(" + escRe(aL) + "|" + escRe(bL) + ")\\s+(?:should|will|to)\\s+win\\s+(?:in\\s+)?(?:straight\\s+sets|\\d+\\s+sets?)", "i"),
    new RegExp("(?:predict|expect|forecast|favor)\\s+(?:" + escRe(aL) + "|" + escRe(bL) + ")\\s+(?:in\\s+\\d+|to\\s+win)", "i"),
    new RegExp("(?:favors?|favoring)\\s+(?:" + escRe(aL) + "|" + escRe(bL) + ")", "i"),
    new RegExp("(?:advantage|edge)\\s+(?:goes\\s+to\\s+)?(?:" + escRe(aL) + "|" + escRe(bL) + ")", "i"),
    new RegExp("(?:pick|call|choice)(?:s|:)?\\s+(?:" + escRe(aL) + "|" + escRe(bL) + ")", "i"),
    new RegExp("(" + escRe(aL) + "|" + escRe(bL) + ")\\s+(?:is|remains)\\s+(?:the\\s+)?favo(?:u?)rite", "i"),
  ];
  var txt = "";
  var fav: string | null = null;
  var conf = 50;
  for (var i = 0; i < patterns.length; i++) {
    var pat = patterns[i];
    const m = text.match(pat);
    if (!m) continue;
    if (m[0].toLowerCase().includes(aL)) fav = pA;
    else if (m[0].toLowerCase().includes(bL)) fav = pB;
    for (var j = 0; j < text.split(/[.!?]+/).length; j++) {
      var s = text.split(/[.!?]+/)[j];
      if (pat.test(s)) {
        txt = s.trim().slice(0, MAX_PREDICTION_CHARS);
        break;
      }
    }
    if (!txt) txt = m[0].trim();
    break;
  }
  if (!fav) {
    const ac = (text.toLowerCase().match(new RegExp(escRe(aL), "g")) || []).length;
    const bc = (text.toLowerCase().match(new RegExp(escRe(bL), "g")) || []).length;
    if (ac > bc + 1) fav = pA;
    else if (bc > ac + 1) fav = pB;
    conf = 40;
  } else {
    if (/should|will|clearly|definitely|easily|dominant|expected/i.test(txt || text)) conf = 70;
    else if (/expect|likely|probably/i.test(txt || text)) conf = 60;
  }
  if (!txt) {
    const first = text.split(/[.!?]+/)[0]?.trim();
    txt = (first && first.length > 20 ? first : text).slice(0, MAX_PREDICTION_CHARS);
  }
  return { text: txt || "Analyse \u2014 article complet", favoredPlayer: fav, confidence: conf };
}

function extractSummary(text: string, pA: string, pB: string): string {
  const sents = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 30; });
  const aL = lastName(pA).toLowerCase();
  const bL = lastName(pB).toLowerCase();
  const rel = sents.filter(function(s) {
    var l = s.toLowerCase();
    return l.includes(aL) || l.includes(bL);
  });
  var chosen = (rel.length >= 2 ? rel : sents).slice(0, 3);
  return chosen.map(function(s) { return s.trim(); }).join(". ") + ".";
}

// ---- Recherche multi-articles ----
interface FetchedArticle { text: string; host: string; url: string; sourceName: string; icon: string; }

async function discoverArticles(q: PressReviewQuery): Promise<FetchedArticle[]> {
  var results: FetchedArticle[] = [];
  var H = {
    "User-Agent": "Mozilla/5.0 (compatible; PariScoreBot/1.0; +https://pariscore.fr)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  // Google News RSS
  try {
    var rssUrl = "https://news.google.com/rss/search?q=" + encodeURIComponent(q.playerAName + " vs " + q.playerBName + " prediction preview tennis") + "&hl=en&gl=US&ceid=US:en";
    var rr = await fetch(rssUrl, { headers: H, signal: AbortSignal.timeout(10000) });
    if (rr.ok) {
      var rt = await rr.text();
      var items = rt.match(/<item>[\s\S]*?<\/item>/g) || [];
      var seen = new Set<string>();
      for (var i = 0; i < items.length; i++) {
        if (results.length >= MAX_SOURCES) break;
        var it = items[i];
        var um = it.match(/<link>(.*?)<\/link>/);
        var sm = it.match(/<source[^>]*>(.*?)<\/source>/);
        if (!um) continue;
        var ru = um[1].replace(/&amp;/g, "&");
        var sh = sm ? sm[1].replace(/^www\./, "").toLowerCase() : new URL(ru).hostname.replace(/^www\./, "");
        var si = PRESS_SOURCES.find(function(s) { return sh.includes(s.domain); });
        if (!si || seen.has(si.domain)) continue;
        seen.add(si.domain);
        try {
          var ar = await fetch(ru, { headers: H, redirect: "follow", signal: AbortSignal.timeout(8000) });
          if (!ar.ok) continue;
          var fh = new URL(ar.url).hostname.replace(/^www\./, "");
          if (!PRESS_SOURCES.some(function(s) { return fh.includes(s.domain); })) continue;
          var h = await ar.text();
          if (h.length < 500) continue;
          results.push({ text: stripHtml(h), host: fh, url: ru, sourceName: si.name, icon: si.icon });
        } catch (e) { continue; }
      }
    }
  } catch (e) { /* RSS offline */ }

  // Fallback Google Search
  if (results.length < MIN_SOURCES) {
    for (var j = 0; j < PRESS_SOURCES.length; j++) {
      if (results.length >= MAX_SOURCES) break;
      var src = PRESS_SOURCES[j];
      if (results.some(function(r) { return r.sourceName === src.name; })) continue;
      try {
        var searchUrl = "https://www.google.com/search?q=" + encodeURIComponent(q.playerAName + " " + q.playerBName + " prediction site:" + src.domain);
        var sr = await fetch(searchUrl, { headers: { "User-Agent": H["User-Agent"], Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
        if (!sr.ok) continue;
        var shHtml = await sr.text();
        var lm = shHtml.match(new RegExp("https?://(?:www\\.)?" + escRe(src.domain) + "/[^\"\\s<>]+", "i"));
        if (!lm) continue;
        var ar2 = await fetch(lm[0], { headers: H, redirect: "follow", signal: AbortSignal.timeout(8000) });
        if (!ar2.ok) continue;
        var h2 = await ar2.text();
        if (h2.length < 500) continue;
        results.push({ text: stripHtml(h2), host: src.domain, url: lm[0], sourceName: src.name, icon: src.icon });
      } catch (e) { continue; }
    }
  }
  return results;
}

// ---- Consensus ----
function computeConsensus(sources: PressSource[], pA: string, pB: string): PressConsensus {
  var n = sources.length;
  if (n === 0) return { playerAPct: 50, playerBPct: 50, totalSources: 0, favoredPlayer: null };
  var a = 0, b = 0;
  for (var k = 0; k < sources.length; k++) {
    var s = sources[k];
    if (s.prediction.favoredPlayer === pA) a++;
    else if (s.prediction.favoredPlayer === pB) b++;
    else { a += 0.5; b += 0.5; }
  }
  var ap = Math.round((a / n) * 100);
  var bp = Math.round((b / n) * 100);
  return { playerAPct: ap, playerBPct: bp, totalSources: n, favoredPlayer: ap > bp ? pA : bp > ap ? pB : null };
}

// ---- LLM Fallback ----
async function llmFallback(q: PressReviewQuery): Promise<PressSource[]> {
  if (!process.env.GEMINI_API_KEY) return [];
  var prompt = "Tennis expert. For \"" + q.playerAName + " vs " + q.playerBName + "\"";
  if (q.tournamentName) prompt += " at " + q.tournamentName;
  if (q.surface) prompt += " on " + q.surface;
  prompt += ", generate 3 press predictions. Return ONLY valid JSON (no markdown):\n";
  prompt += '{"sources":[\n';
  prompt += '  {"name":"TennisMajors","expertSummary":"2-3 sentences","prediction":{"text":"Swiatek in 2","favoredPlayer":"' + q.playerAName + '","confidence":75}},\n';
  prompt += '  {"name":"LastWordOnSports","expertSummary":"...","prediction":{"text":"...","favoredPlayer":"' + q.playerBName + '","confidence":70}},\n';
  prompt += '  {"name":"Eurosport","expertSummary":"...","prediction":{"text":"...","favoredPlayer":null,"confidence":65}}\n';
  prompt += ']}\n';
  prompt += 'Rules: expertSummary 2-3 sentences, prediction concise, favoredPlayer exact "' + q.playerAName + '"/"' + q.playerBName + '"/null, confidence 0-100. ONLY JSON.';

  try {
    var r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 1000 } }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!r.ok) return [];
    var d = await r.json() as Record<string, unknown>;
    var raw = (d as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return [];
    var clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    var parsed = JSON.parse(clean);
    if (!parsed.sources || !Array.isArray(parsed.sources)) return [];
    return parsed.sources.map(function(s: { name?: string; expertSummary?: string; prediction?: { text?: string; favoredPlayer?: string | null; confidence?: number } }) {
      var meta = PRESS_SOURCES.find(function(x) { return x.name.toLowerCase() === (s.name || "").toLowerCase(); }) || { name: s.name || "Media", domain: "n/a", icon: "\uD83D\uDCF0" };
      return {
        name: meta.name, domain: meta.domain, icon: meta.icon, url: "",
        expertSummary: String(s.expertSummary || "").slice(0, 400),
        prediction: {
          text: String(s.prediction?.text || "N/D").slice(0, MAX_PREDICTION_CHARS),
          favoredPlayer: s.prediction?.favoredPlayer || null,
          confidence: Math.min(100, Math.max(0, Math.round(Number(s.prediction?.confidence) || 60))),
        },
      };
    });
  } catch (e) { return []; }
}

// ---- Entry point ----
export async function getPressReview(q: PressReviewQuery): Promise<PressReviewResult | null> {
  if (!q.matchId || !q.playerAName || !q.playerBName) return null;
  var mem = memoGet(q);
  if (mem !== undefined) return mem;
  var file = await cacheRead(q);
  if (file !== undefined) { memoSet(q, file); return file; }

  var articles = await discoverArticles(q);
  var sources: PressSource[] = articles.map(function(a) {
    return {
      name: a.sourceName, domain: a.host, icon: a.icon, url: a.url,
      expertSummary: extractSummary(a.text, q.playerAName, q.playerBName),
      prediction: extractPrediction(a.text, q.playerAName, q.playerBName),
    };
  });

  if (sources.length < MIN_SOURCES) {
    var llmSources = await llmFallback(q);
    var existing = new Set(sources.map(function(s) { return s.name.toLowerCase(); }));
    for (var x = 0; x < llmSources.length; x++) {
      var ls = llmSources[x];
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
  var consensus = computeConsensus(sources, q.playerAName, q.playerBName);

  var result: PressReviewResult = {
    status: "available",
    sources: sources,
    consensus: consensus,
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
