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
import {
  geminiCacheKey,
  geminiCacheGet,
  geminiCacheSet,
  geminiCachePrune,
  type CachedGeminiInsight,
} from "@/lib/gemini-cache";

// ---------------------------------------------------------------------------
// Cache config
// ---------------------------------------------------------------------------
const ALLOWED_SPORTS = ["tennis", "football"] as const;
const MAX_MATCHDATA_BYTES = 10_000;

// Rate limiting: max 10 req/5min per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
async function callGemini(prompt: string): Promise<CachedGeminiInsight> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non configurée");
  }

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
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

  const parsed = JSON.parse(cleaned) as CachedGeminiInsight;

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
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    const rl = rateLimitMap.get(ip);
    if (rl && now < rl.resetAt && rl.count >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: "Trop de requêtes. Réessayez dans quelques minutes." }, { status: 429 });
    }
    if (!rl || now >= (rl?.resetAt ?? 0)) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
      rl.count++;
    }

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

    // Input validation
    if (!ALLOWED_SPORTS.includes(sport as typeof ALLOWED_SPORTS[number])) {
      return NextResponse.json({ error: `Sport non supporté: ${sport}` }, { status: 400 });
    }
    if (JSON.stringify(matchData).length > MAX_MATCHDATA_BYTES) {
      return NextResponse.json({ error: "matchData trop volumineux (max 10KB)" }, { status: 400 });
    }
    if (typeof matchId !== "string" || matchId.length > 100) {
      return NextResponse.json({ error: "matchId invalide" }, { status: 400 });
    }

    geminiCachePrune();

    // Vérification cache : clé spécifique au match demandé
    const key = geminiCacheKey(sport, matchId);
    const cached = geminiCacheGet(key);
    if (cached) {
      return NextResponse.json({
        ...cached,
        source: "cache",
        cachedAt: new Date().toISOString(),
      });
    }

    // Pas de cache → appel Gemini
    const prompt = buildPrompt(sport, matchData);
    const insight = await callGemini(prompt);

    // Stockage dans le cache
    geminiCacheSet(key, insight);

    return NextResponse.json({
      ...insight,
      source: "gemini",
    });
  } catch (err) {
    return apiErrorHandler(err, "ai/gemini-insight");
  }
}
