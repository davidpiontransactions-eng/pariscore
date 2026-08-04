/**
 * Gemini Cache Cron — pré-calcul quotidien des analyses pour les matchs du jour.
 *
 * GET /api/ai/gemini-cron?token=CRON_SECRET
 *
 * Appelé par un cron VPS (ex: 6h, 12h, 18h UTC).
 * Parcourt les matchs tennis/football du jour, vérifie le cache, et pré-calcule
 * les analyses Gemini manquantes. Respecte le rate limit de l'API Gemini.
 *
 * Réponse: { cached: number, computed: number, skipped: number, errors: string[] }
 */
import { NextResponse } from "next/server";
import {
  geminiCacheKey,
  geminiCacheGet,
  geminiCacheSet,
  geminiCachePrune,
  geminiCacheSize,
  type CachedGeminiInsight,
} from "@/lib/gemini-cache";

const CRON_SECRET = process.env.CRON_SECRET;
const ALLOWED_SPORTS = ["tennis", "football"] as const;
const GEMINI_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchMatches(sport: string): Promise<{ id: string; matchData: Record<string, unknown> }[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const endpoint = sport === "tennis" ? "/api/tennis/prematch" : "/api/football/matches";
  const res = await fetch(`${baseUrl}${endpoint}`);
  if (!res.ok) throw new Error(`Failed to fetch ${sport} matches: ${res.status}`);
  const json = await res.json();
  const matches = json?.matches ?? [];
  return matches.map((m: any) => ({ id: String(m.id), matchData: m }));
}

function buildCronPrompt(sport: string, matchData: Record<string, unknown>): string {
  const matchStr = JSON.stringify(matchData, null, 2);
  return `Tu es un analyste sportif expert en ${sport === "tennis" ? "tennis" : "football"}.
Analyse le match suivant de façon concise (max 150 mots). Structure ta réponse en JSON avec :
- "analysis": texte d'analyse
- "factors": tableau de {label, value} (max 4)
- "edge": nombre entier (% value)
- "confidence": entier 1-5

Données : ${matchStr}
Réponds UNIQUEMENT avec le JSON.`;
}

async function callGeminiCron(prompt: string): Promise<CachedGeminiInsight> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY non configurée");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) throw new Error("Gemini a retourné une réponse vide");

  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned) as CachedGeminiInsight;
  return {
    analysis: parsed.analysis,
    factors: (parsed.factors ?? []).slice(0, 4).map((f) => ({
      label: String(f.label).slice(0, 50),
      value: String(f.value).slice(0, 30),
    })),
    edge: Number.isFinite(parsed.edge) ? Math.round(parsed.edge) : 0,
    confidence: Math.min(5, Math.max(1, Math.round(parsed.confidence || 3))),
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const errors: string[] = [];
  let cached = 0;
  let computed = 0;
  let skipped = 0;

  try {
    geminiCachePrune();

    for (const sport of ALLOWED_SPORTS) {
      let matches: { id: string; matchData: Record<string, unknown> }[];
      try {
        matches = await fetchMatches(sport);
      } catch (err: any) {
        errors.push(`fetch ${sport}: ${err.message}`);
        continue;
      }

      const toProcess = matches.slice(0, 5);

      for (const match of toProcess) {
        const key = geminiCacheKey(sport, match.id);
        if (geminiCacheGet(key)) { cached++; continue; }

        try {
          const prompt = buildCronPrompt(sport, match.matchData);
          const insight = await callGeminiCron(prompt);
          geminiCacheSet(key, insight);
          computed++;
          if (computed < toProcess.length) {
            await new Promise((r) => setTimeout(r, GEMINI_DELAY_MS));
          }
        } catch (err: any) {
          errors.push(`gemini ${sport}/${match.id}: ${err.message}`);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      ok: true, cached, computed, skipped,
      errors: errors.length > 0 ? errors : undefined,
      cacheSize: geminiCacheSize(),
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message, cached, computed, skipped, errors },
      { status: 500 },
    );
  }
}
