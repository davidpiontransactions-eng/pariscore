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
import type { FootballAIReport, AIPredictiveBet } from "@/lib/football-match-report";

const MAX_MATCHDATA_BYTES = 10_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

function buildPrompt(matchData: Record<string, unknown>): string {
  const data = JSON.stringify(matchData, null, 2);
  return `Tu es un analyste football expert. À partir des données du match ci-dessous, génère un rapport complet avec 3 paris prédictifs en français.

Structure ta réponse en JSON strict (sans markdown, sans texte autour) :
{
  "synthesis": "<2-3 phrases sur la physionomie attendue du match, la valeur détectée et le contexte clé>",
  "keyFacts": ["<fait statistique marquant 1 chiffré>", "<fait 2>", "<fait 3>"],
  "predictiveBets": [
    {
      "label": "<Paris 1 — l'issue la plus probable, ex: 'Double Chance 1X', 'Victoire domicile', 'BTTS Yes'>",
      "prob": <entier 0-100, probabilité estimée>,
      "odds": <cote décimale indicative, ex: 1.35, ou null si non estimable>,
      "confidence": <entier 1-5>,
      "rationale": "<1 phrase justificative basée sur les données>"
    },
    {
      "label": "<Paris 2 — volume/marqueurs, ex: 'Over 2.5 Buts', 'Under 3.5 Buts', 'Plus de 9.5 corners'>",
      "prob": <entier 0-100>,
      "odds": <cote décimale ou null>,
      "confidence": <entier 1-5>,
      "rationale": "<1 phrase>"
    },
    {
      "label": "<Paris 3 — value/spécifique, ex: 'Handicap -1 domicile', 'Score exact 2-1', 'BTTS + Over 2.5'>",
      "prob": <entier 0-100>,
      "odds": <cote décimale ou null>,
      "confidence": <entier 1-5>,
      "rationale": "<1 phrase>"
    }
  ],
  "combo": {"label": "<suggestion de combiné 2-3 sélections>", "rationale": "<pourquoi en une phrase>"} ou null,
  "confidence": <entier 1-5, confiance globale du rapport>
}

Règles pour les predictiveBets :
- Les 3 paris doivent être DIFFÉRENTS (issue principale, volume, value)
- Les probabilités doivent être réalistes (jamais 95%+ sauf favori écrasant)
- Les cotes décimales doivent correspondre approximativement à la proba (cote ≈ 1/prob)
- Appuie-toi sur les données : forme, PPG, xG, classement, domicile/extérieur, buts marqués/encaissés
- Ne les invente pas : si les données manquent, mets une confiance basse (1-2)

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

async function callLlm(prompt: string): Promise<FootballAIReport & { provider: "gemini" | "local" | "orcarouter" | "openrouter" | "nvidia" | "groq" }> {
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

  // Normalisation des predictiveBets (3 paris requis)
  const rawBets = Array.isArray(parsed.predictiveBets) ? parsed.predictiveBets : [];
  const predictiveBets: AIPredictiveBet[] = rawBets.slice(0, 3).map((b) => ({
    label: String(b.label ?? "").slice(0, 80),
    prob: Math.min(100, Math.max(0, Math.round(Number(b.prob) || 50))),
    odds: b.odds != null && Number(b.odds) > 0 ? Math.round(Number(b.odds) * 100) / 100 : null,
    confidence: Math.min(5, Math.max(1, Math.round(Number(b.confidence) || 3))),
    rationale: String(b.rationale ?? "").slice(0, 200),
  }));

  // Compléter à 3 paris si le LLM en renvoie moins
  while (predictiveBets.length < 3) {
    predictiveBets.push({
      label: "Non disponible",
      prob: 0,
      odds: null,
      confidence: 1,
      rationale: "Données insuffisantes pour cette prédiction",
    });
  }

  return {
    synthesis: String(parsed.synthesis).slice(0, 600),
    keyFacts: parsed.keyFacts.slice(0, 3).map((f) => String(f).slice(0, 160)),
    predictiveBets,
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