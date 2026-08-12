// Extracteurs partagés revue de presse — Tennis & Football (Zero-LLM).
// Server-only. Fonctions pures : regex ciblées, méta, JSON-LD, blocs « Prediction ».
// Aucun appel API externe — remplace l'ancien fallback Gemini.

export const MIN_SOURCES = 3;
export const MAX_SOURCES = 5;
export const MAX_PREDICTION_CHARS = 200;

// ---- HTML / Markdown bruts ────────────────────────────────────────────────

export function stripHtml(h: string): string {
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

/** Markdown → texte (sortie de r.jina.ai). */
export function markdownToText(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, " ")
    .replace(/^\s*>\s?/gm, "")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/^(\s*)\|.*\|(\s*)$/gm, "$1")
    .replace(/[|]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- Méta / JSON-LD / blocs ciblés ────────────────────────────────────────

export function extractMetaDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  return m ? m[1].trim() : null;
}

export function extractOgDescription(html: string): string | null {
  const m = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  return m ? m[1].trim() : null;
}

export type JsonLdBlock = {
  headline?: string;
  description?: string;
  articleBody?: string;
};

/** Premier bloc JSON-LD parsable (Article/NewsArticle le cas échéant). */
export function extractJsonLd(html: string): JsonLdBlock | null {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const raw of blocks) {
    const inner = raw.replace(/^<script[^>]*>/, "").replace(/<\/script>$/i, "");
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(inner);
    } catch {
      continue;
    }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const n = item as Record<string, unknown>;
      const body = typeof n.articleBody === "string" ? n.articleBody : undefined;
      const desc = typeof n.description === "string" ? n.description : undefined;
      const headline = typeof n.headline === "string" ? n.headline : undefined;
      if (body || desc || headline) return { headline, description: desc, articleBody: body };
    }
  }
  return null;
}

const PREDICTION_KEYWORDS = [
  "prediction", "predict", "verdict", "our pick", "our prediction", "who will win",
  "winner", "favorite", "favour", "favor", "pronostic", "notre pronostic",
  "pronostique", "pari", "pronostico", "prognose", "tipp", "predicci", "pick",
  "1x2", "over 2.5", "under 2.5", "exact score", "score exact", "btts",
];

/**
 * Extrait le bloc texte qui suit la première occurrence d'un mot-clé
 * de pronostic (heading ou paragraphe). Retourne au plus 400 caractères.
 * Ne coupe PAS à la première phrase : le verdict suit souvent le contexte
 * (ex. mot-clé dans le <h1> ou la méta description, prédiction au 2e paragraphe).
 */
export function extractPredictionBlock(html: string): string | null {
  const lower = html.toLowerCase();
  let best: { idx: number; keyword: string } | null = null;
  for (const k of PREDICTION_KEYWORDS) {
    const idx = lower.indexOf(k);
    if (idx >= 0 && (!best || idx < best.idx)) best = { idx, keyword: k };
  }
  if (!best) return null;

  const start = Math.max(0, best.idx - 10);
  const slice = html.slice(start, start + 800);
  const txt = stripHtml(slice);
  return (txt.trim().slice(0, MAX_PREDICTION_CHARS * 2)) || null;
}

// ---- Extraction du pronostic Tennis (déterministe) ────────────────────────

export function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Dernier mot d'un nom (nom de famille / nom court). */
export function shortName(n: string): string {
  const p = n.trim().split(/\s+/);
  return p[p.length - 1];
}

export type TennisPressPrediction = { text: string; favoredPlayer: string | null; confidence: number };

export function extractTennisPrediction(
  text: string,
  pA: string,
  pB: string,
  predictText?: string | null,
): TennisPressPrediction {
  const subject = predictText && predictText.length > 10 ? predictText : text;
  const aL = shortName(pA).toLowerCase();
  const bL = shortName(pB).toLowerCase();
  const patterns = [
    new RegExp("(" + escRe(aL) + "|" + escRe(bL) + ")\\s+(?:should|will|to)\\s+win\\s+(?:in\\s+)?(?:straight\\s+sets|\\d+\\s+sets?)", "i"),
    new RegExp("(?:predict|expect|forecast|favor)\\s+(?:" + escRe(aL) + "|" + escRe(bL) + ")\\s+(?:in\\s+\\d+|to\\s+win)", "i"),
    new RegExp("(?:favors?|favoring)\\s+(?:" + escRe(aL) + "|" + escRe(bL) + ")", "i"),
    new RegExp("(?:advantage|edge)\\s+(?:goes\\s+to\\s+)?(?:" + escRe(aL) + "|" + escRe(bL) + ")", "i"),
    new RegExp("(?:pick|call|choice)(?:s|:)?\\s+(?:" + escRe(aL) + "|" + escRe(bL) + ")", "i"),
    new RegExp("(" + escRe(aL) + "|" + escRe(bL) + ")\\s+(?:is|remains)\\s+(?:the\\s+)?favo(?:u?)rite", "i"),
  ];
  let txt = "";
  let fav: string | null = null;
  let conf = 50;
  for (let i = 0; i < patterns.length; i++) {
    const pat = patterns[i];
    const m = subject.match(pat);
    if (!m) continue;
    if (m[0].toLowerCase().includes(aL)) fav = pA;
    else if (m[0].toLowerCase().includes(bL)) fav = pB;
    const sentences = subject.split(/[.!?]+/);
    for (let j = 0; j < sentences.length; j++) {
      const s = sentences[j];
      if (pat.test(s)) {
        txt = s.trim().slice(0, MAX_PREDICTION_CHARS);
        break;
      }
    }
    if (!txt) txt = m[0].trim();
    break;
  }
  if (!fav) {
    const ac = (subject.toLowerCase().match(new RegExp(escRe(aL), "g")) || []).length;
    const bc = (subject.toLowerCase().match(new RegExp(escRe(bL), "g")) || []).length;
    if (ac > bc + 1) fav = pA;
    else if (bc > ac + 1) fav = pB;
    conf = 40;
  } else {
    if (/should|will|clearly|definitely|easily|dominant|expected/i.test(txt || text)) conf = 70;
    else if (/expect|likely|probably/i.test(txt || text)) conf = 60;
  }
  if (!txt) {
    const first = (predictText || text).split(/[.!?]+/)[0]?.trim();
    txt = (first && first.length > 20 ? first : predictText || text).slice(0, MAX_PREDICTION_CHARS);
  }
  return { text: txt || "Analyse — article complet", favoredPlayer: fav, confidence: conf };
}

// ---- Extraction du pronostic Football (déterministe) ──────────────────────

export type FootballPressPredictionOut = {
  text: string;
  type: "1X2" | "over_under" | "btts" | "exact_score" | "other";
  exactScore?: string;
  confidence: number;
};

export function extractFootballPrediction(
  text: string,
  home: string,
  away: string,
  predictText?: string | null,
): FootballPressPredictionOut {
  const lower = (predictText && predictText.length > 10 ? predictText : text).toLowerCase();
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
  const hPatterns = [hShort, "home win", "home victory", "hosts to win", "victoire de " + hShort, "vainqueur : " + hShort];
  const aPatterns = [aShort, "away win", "away victory", "visitors to win", "victoire de " + aShort, "vainqueur : " + aShort];
  const dPatterns = ["draw", "match nul", "stalemate", "share the points", "points shared"];

  for (const p of hPatterns) { if (lower.includes(p)) { homeWin = true; break; } }
  for (const p of aPatterns) { if (lower.includes(p)) { awayWin = true; break; } }
  for (const p of dPatterns) { if (lower.includes(p)) { draw = true; break; } }

  let confidence = 60;
  if (homeWin || awayWin) confidence = 70;
  if (draw) confidence = 55;

  if (homeWin) return { text: `Victoire ${shortName(home)}`, type: "1X2", exactScore, confidence };
  if (awayWin) return { text: `Victoire ${shortName(away)}`, type: "1X2", exactScore, confidence };
  if (draw) return { text: "Match Nul", type: "1X2", exactScore, confidence: 55 };
  if (over25) return { text: "Over 2.5 Buts", type: "over_under", exactScore, confidence: 65 };
  if (under25) return { text: "Under 2.5 Buts", type: "over_under", exactScore, confidence: 65 };
  if (bttsYes) return { text: "Les 2 équipes marquent", type: "btts", exactScore, confidence: 62 };

  return { text: "Pronostic mixte", type: "other", exactScore, confidence: 55 };
}

// ---- Résumé expert (déterministe, commun) ─────────────────────────────────

export function extractSummary(text: string, names: string[]): string {
  const sentences = text.split(/[.!?]+/).filter(function (s) { return s.trim().length > 30; });
  const shorts = names.map(function (n) { return shortName(n).toLowerCase(); });
  const rel = sentences.filter(function (s) {
    const l = s.toLowerCase();
    return shorts.some(function (sh) { return l.includes(sh); });
  });
  const chosen = (rel.length >= 2 ? rel : sentences).slice(0, 3);
  if (chosen.length === 0) return "";
  return chosen.map(function (s) { return s.trim(); }).join(". ") + ".";
}

// ---- Headers HTTP ─────────────────────────────────────────────────────────

export function buildFetchHeaders(): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; PariScoreBot/1.0; +https://pariscore.fr)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}