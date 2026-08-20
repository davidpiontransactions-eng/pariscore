/**
 * AI Match Report — rapport de match football généré depuis le modèle PariScore.
 *
 * POST /api/ai/football-match-report
 * Body: { matchId: string, matchData: object }
 * Response: FootballAIReport + { source: "cache" | "gemini" }
 * Cache: 12h (gemini-cache), clé football-report:{matchId}:{jour}.
 *
 * Transport unifié via generateText() (src/lib/llm.ts) : Gemini cloud ou
 * serveur local OpenAI-compatible selon LLM_PROVIDER / LLM_FALLBACK_ENABLED.
 */
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { generateText } from "@/lib/llm";
import {
  geminiCacheKey,
  geminiCacheGet,
  geminiCacheSet,
  geminiCachePrune,
} from "@/lib/gemini-cache";
import type { FootballAIReport } from "@/lib/football-match-report";

const MAX_MATCHDATA_BYTES = 10_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

function buildPrompt(matchData: Record<string, unknown>): string {
  const data = JSON.stringify(matchData, null, 2);
  return `Tu es un analyste football expert. À partir des données du match ci-dessous, rédige un rapport concis en français.

Structure ta réponse en JSON strict (sans markdown, sans texte autour) :
{
  "synthesis": "<2-3 phrases sur la physionomie attendue du match et la valeur éventuelle>",
  "keyFacts": ["<fait statistique marquant 1>", "<fait 2>", "<fait 3>"],
  "combo": {"label": "<suggestion de combiné, ex: 'Double Chance 1X + Plus de 1.5 buts'>", "rationale": "<pourquoi en une phrase>"} ou null si aucun combiné ne se détache,
  "confidence": <entier 1-5>
}

Les keyFacts doivent être des faits chiffrés concrets (forme, PPG, xG, classement, clean sheets…). Ne les invente pas : appuie-toi uniquement sur les données fournies.

Données du match :
${data}`;
}

/** Extrait le premier objet JSON d'un texte (robuste aux fences/markdown). */
function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

async function callLlm(prompt: string): Promise<FootballAIReport & { provider: "gemini" | "local" }> {
  const result = await generateText({
    prompt,
    temperature: 0.5,
    maxOutputTokens: 2048,
    json: true,
  });

  const cleaned = extractJson(result.text);
  const parsed = JSON.parse(cleaned) as Partial<FootballAIReport>;

  if (!parsed.synthesis || !Array.isArray(parsed.keyFacts)) {
    throw new Error("Réponse LLM mal formée");
  }

  return {
    synthesis: String(parsed.synthesis).slice(0, 600),
    keyFacts: parsed.keyFacts.slice(0, 3).map((f) => String(f).slice(0, 160)),
    combo:
      parsed.combo && typeof parsed.combo.label === "string"
        ? {
            label: parsed.combo.label.slice(0, 80),
            rationale: String(parsed.combo.rationale ?? "").slice(0, 200),
          }
        : null,
    confidence: Math.min(5, Math.max(1, Math.round(parsed.confidence || 3))),
    provider: result.provider,
  };
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    const rl = rateLimitMap.get(ip);
    if (rl && now < rl.resetAt && rl.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Trop de requêtes. Réessayez dans quelques minutes." },
        { status: 429 },
      );
    }
    if (!rl || now >= (rl?.resetAt ?? 0)) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else {
      rl.count++;
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.matchId !== "string" || !body.matchData) {
      return NextResponse.json(
        { error: "Body requis : { matchId, matchData }" },
        { status: 400 },
      );
    }
    const { matchId, matchData } = body as { matchId: string; matchData: Record<string, unknown> };
    if (matchId.length > 100) {
      return NextResponse.json({ error: "matchId invalide" }, { status: 400 });
    }
    if (JSON.stringify(matchData).length > MAX_MATCHDATA_BYTES) {
      return NextResponse.json({ error: "matchData trop volumineux (max 10KB)" }, { status: 400 });
    }

    geminiCachePrune();
    const key = geminiCacheKey("football-report", matchId);
    const cached = geminiCacheGet<FootballAIReport>(key);
    if (cached) {
      return NextResponse.json({ ...cached, source: "cache" });
    }

    const report = await callLlm(buildPrompt(matchData));
    geminiCacheSet(key, report);
    return NextResponse.json({ ...report, source: "gemini", provider: report.provider });
  } catch (err) {
    return apiErrorHandler(err, "ai/football-match-report");
  }
}