/**
 * Gemini AI Insight — analyse de match via l'API Gemini avec cache VPS 12h.
 *
 * POST /api/ai/gemini-insight
 * Body: { sport: "tennis" | "football", matchId: string, matchData: object }
 * Cache key: gemini-insight:{sport}:{matchId}:{YYYY-MM-DD}
 * TTL: 12 heures (cross-utilisateur)
 */
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { createTtlCache, isFresh } from "@/lib/cached-route";

// ---------------------------------------------------------------------------
// Cache config
// ---------------------------------------------------------------------------
const GEMINI_CACHE_TTL_MS = 12 * 60 * 60_000; // 12 heures

type CachedInsight = {
  analysis: string;
  factors: { label: string; value: string }[];
  edge: number;
  confidence: number;
};

const insightCache = createTtlCache<CachedInsight>("__geminiInsightCache");


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Construit une clé de cache déterministe. */
function cacheKey(sport: string, matchId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `gemini-insight:${sport}:${matchId}:${today}`;
}

/** Nettoie les clés expirées du globalThis (garde les entrées < 12h). */
function pruneExpiredCache(): void {
  const g = globalThis as unknown as Record<string, { data: unknown; at: number }>;
  const now = Date.now();
  for (const key of Object.keys(g)) {
    if (key.startsWith("gemini-insight:") && now - g[key].at > GEMINI_CACHE_TTL_MS) {
      delete g[key];
    }
  }
}

/** Construit le prompt Gemini à partir des données du match. */
function buildPrompt(sport: string, matchData: Record<string, unknown>): string {
  const matchStr = JSON.stringify(matchData, null, 2);
  return `Tu es un analyste sportif expert en ${sport === "tennis" ? "tennis" : "football"}.
Analyse le match suivant de façon concise (max 150 mots). Structure ta réponse en JSON avec :
- "analysis": texte d'analyse (value détectée, points clés, niveau de confiance)
- "factors": tableau de {label, value} (max 4 facteurs : H2H, surface/domicile, forme, écart Elo)
- "edge": nombre entier (écart de value en %, positif = value favorable, toujours présent)
- "confidence": entier 1-5 (niveau de confiance)

Données du match :
${matchStr}

Réponds UNIQUEMENT avec le JSON, pas de markdown, pas de texte autour.`;
}

/** Appelle l'API Gemini via fetch direct. */
async function callGemini(prompt: string): Promise<CachedInsight> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non configurée");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText) {
    throw new Error("Gemini a retourné une réponse vide");
  }

  // Nettoyer le markdown potentiel autour du JSON
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as CachedInsight;

  if (!parsed.analysis || !Array.isArray(parsed.factors)) {
    throw new Error("Réponse Gemini mal formée (JSON invalide)");
  }

  return {
    analysis: parsed.analysis,
    factors: parsed.factors.slice(0, 4).map((f) => ({
      label: String(f.label).slice(0, 50),
      value: String(f.value).slice(0, 30),
    })),
    edge: Number.isFinite(parsed.edge) ? Math.round(parsed.edge) : 0,
    confidence: Math.min(5, Math.max(1, Math.round(parsed.confidence || 3))),
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.sport || !body.matchId || !body.matchData) {
      return NextResponse.json(
        { error: "Body requis : { sport, matchId, matchData }" },
        { status: 400 },
      );
    }

    const { sport, matchId, matchData } = body as {
      sport: string;
      matchId: string;
      matchData: Record<string, unknown>;
    };

    pruneExpiredCache();

    // Vérification cache : clé spécifique au match demandé
    const key = cacheKey(sport, matchId);
    const g = globalThis as unknown as Record<string, { data: CachedInsight; at: number }>;
    const specificEntry = g[key];
    if (specificEntry && Date.now() - specificEntry.at < GEMINI_CACHE_TTL_MS) {
      return NextResponse.json({
        ...specificEntry.data,
        source: "cache",
        cachedAt: new Date(specificEntry.at).toISOString(),
      });
    }

    // Pas de cache → appel Gemini
    const prompt = buildPrompt(sport, matchData);
    const insight = await callGemini(prompt);

    // Stockage dans le cache
    g[key] = { data: insight, at: Date.now() };

    return NextResponse.json({
      ...insight,
      source: "gemini",
    });
  } catch (err) {
    return apiErrorHandler(err, "ai/gemini-insight");
  }
}
