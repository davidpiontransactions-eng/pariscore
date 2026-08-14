/**
 * Gemini AI — Comparaison de 2 matchs (même sport) via l'API Gemini.
 *
 * POST /api/ai/gemini-insight/compare
 * Body: { sport: "tennis" | "football", matches: [{ matchId, label?, matchData }, { matchId, label?, matchData }] }
 *  - matches : EXACTEMENT 2 éléments, même sport implicitement (sport unique au body),
 *  - chaque matchData ≤ 10 000 octets, matchId string ≤ 100 chars.
 *
 * Cache key: gemini-insight:compare:{sport}:{idA}+{idB}:{YYYY-MM-DD}
 * TTL: 12 heures (cross-utilisateur).
 *
 * La route mono-match (/api/ai/gemini-insight) reste INCHANGÉE : la distinction
 * mono/compare se fait par URL (sous-route dédiée `/compare`), aucun risque de
 * régression sur l'existant.
 */
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { AppError, ValidationError } from "@/lib/api-error";
import {
  geminiCompareCacheKey,
  geminiCacheGet,
  geminiCacheSet,
  geminiCachePrune,
  type GeminiCompareInsight,
} from "@/lib/gemini-cache";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ALLOWED_SPORTS = ["tennis", "football"] as const;
const MAX_MATCHES = 2;
const MAX_MATCHDATA_BYTES = 10_000;
const MAX_MATCHID_LENGTH = 100;

// Rate limiting: 10 req/5min par IP (budget partagé avec la route mono)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

// Purge périodique : évite une croissance mémoire non bornée (une entrée par IP).
function pruneRateLimitMap(now: number) {
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit le prompt comparatif Gemini. Ce n'est PAS une concaténation de 2
 * analyses mono : le prompt force une analyse croisée (forces/faiblesses en
 * regard, écart Elo, forme, cote) et une recommandation A/B.
 */
function buildPrompt(
  sport: string,
  matchA: { label: string; data: Record<string, unknown> },
  matchB: { label: string; data: Record<string, unknown> },
): string {
  const a = JSON.stringify(matchA.data, null, 2);
  const b = JSON.stringify(matchB.data, null, 2);

  return `Tu es un analyste sportif expert en ${sport}. On te présente 2 matchs du jour (même discipline). Tu dois les COMPARER pour aider un parieur à choisir lequel est le plus intéressant à jouer.

IMPORTANT : ne produis PAS deux analyses séparées. Produis UNE analyse cote-à-cote : dans chacun, évalue l'écart Elo/forces, la forme récente, la surface/domicile, la probabilité de victoire par rapport à la cote (value = edge), puis désigne le match le plus pertinent à jouer.

Match A (${matchA.label}) :
${a}

Match B (${matchB.label}) :
${b}

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de texte autour) au format :
{
  "summary": "analyse comparée globale (max 180 mots)",
  "matchA": { "label": "nom du match A", "analysis": "analyse A (60 mots max)", "edge": entier (-/+ % value), "probability": entier (proba victoire A, %) },
  "matchB": { "label": "nom du match B", "analysis": "analyse B (60 mots max)", "edge": entier (-/+ % value), "probability": entier (proba victoire B, %) },
  "factors": [ { "dimension": "nom", "matchA": "valeur A", "matchB": "valeur B", "advantage": "A ou B ou egal" } ],
  "recommendation": { "side": "matchA ou matchB ou aucun", "reason": "justification (40 mots max)" },
  "confidence": entier 1-5
}`;
}

/**
 * Erreur upstream Gemini — mappée sur un statut HTTP propre :
 * - 429 (quota) → 429
 * - toute autre erreur Gemini (clé invalide, surcharge, timeout) → 502
 * Le message est porté au client, jamais de crash 500 générique.
 */
class GeminiUpstreamError extends AppError {
  constructor(status: number, message: string) {
    const code =
      status === 429 ? "GEMINI_RATE_LIMITED" : `GEMINI_UPSTREAM_${status}`;
    super(message, code, status === 429 ? 429 : 502);
    this.name = "GeminiUpstreamError";
  }
}

/** Appelle l'API Gemini (gemini-2.5-flash) via JSON direct. */
async function callGeminiCompare(prompt: string): Promise<GeminiCompareInsight> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiUpstreamError(503, "GEMINI_API_KEY non configurée");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new GeminiUpstreamError(
      res.status,
      res.status === 429
        ? "Quota Gemini dépassé (429). Réessayez dans quelques minutes."
        : `Gemini API error ${res.status}: ${errText.slice(0, 200)}`,
    );
  }

  const json = await res.json();
  const rawText: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) {
    throw new GeminiUpstreamError(502, "Gemini a retourné une réponse vide");
  }

  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return normalizeCompareResponse(JSON.parse(cleaned));
  } catch {
    throw new GeminiUpstreamError(
      502,
      "Réponse Gemini illisible (JSON invalide)",
    );
  }
}

/**
 * Normalise la réponse brute de Gemini en GeminiCompareInsight.
 * Tolérant aux champs manquants / types étrangers — ne lève une erreur que si
 * l'essentiel (analysis A + B) est absent.
 */
function normalizeCompareResponse(raw: unknown): GeminiCompareInsight {
  const obj = (raw ?? {}) as Record<string, any>;

  if (
    !obj.matchA ||
    typeof obj.matchA.analysis !== "string" ||
    !obj.matchB ||
    typeof obj.matchB.analysis !== "string"
  ) {
    throw new Error("Réponse Gemini mal formée (comparaison JSON invalide)");
  }

  const mkMatch = (m: any, matchId: string) => ({
    matchId,
    label: String(m?.label ?? matchId).slice(0, 80),
    analysis: String(m?.analysis ?? "").slice(0, 1200),
    edge: Number.isFinite(Number(m?.edge)) ? Math.round(Number(m.edge)) : 0,
    probability: Number.isFinite(Number(m?.probability))
      ? Math.min(100, Math.max(0, Math.round(Number(m.probability))))
      : 0,
  });

  const factors = Array.isArray(obj.factors)
    ? obj.factors.slice(0, 6).map((f: any) => ({
        dimension: String(f?.dimension ?? "?").slice(0, 40),
        matchA: String(f?.matchA ?? "—").slice(0, 60),
        matchB: String(f?.matchB ?? "—").slice(0, 60),
        advantage: (["A", "B", "egal"].includes(f?.advantage)
          ? f.advantage
          : "egal") as "A" | "B" | "egal",
      }))
    : [];

  const side = (["matchA", "matchB", "aucun"].includes(
    obj.recommendation?.side,
  )
    ? obj.recommendation.side
    : "aucun") as "matchA" | "matchB" | "aucun";

  return {
    summary: String(obj.summary ?? "").slice(0, 2400),
    matchA: mkMatch(obj.matchA, "A"),
    matchB: mkMatch(obj.matchB, "B"),
    factors,
    recommendation: {
      side,
      reason: String(obj.recommendation?.reason ?? "").slice(0, 500),
    },
    confidence: Number.isFinite(Number(obj.confidence))
      ? Math.min(5, Math.max(1, Math.round(Number(obj.confidence))))
      : 3,
  };
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // Rate limiting (Map dédiée à la comparaison — budget séparé de la mono)
    // Note : x-forwarded-for est fiable car la route est derrière le reverse
    // proxy (nginx) — il écrase toute valeur client.
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    pruneRateLimitMap(now);
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
    if (!body?.sport || !Array.isArray(body.matches)) {
      return NextResponse.json(
        {
          error:
            "Body requis : { sport: \"tennis\" | \"football\", matches: [{ matchId, matchData }, { matchId, matchData }] }",
        },
        { status: 400 },
      );
    }

    const { sport } = body as { sport: string };
    const matches = body.matches as Array<Record<string, unknown>>;

    if (!ALLOWED_SPORTS.includes(sport as typeof ALLOWED_SPORTS[number])) {
      return NextResponse.json(
        { error: `Sport non supporté: ${sport}` },
        { status: 400 },
      );
    }

    if (matches.length !== MAX_MATCHES) {
      return NextResponse.json(
        { error: `Vous devez fournir exactement ${MAX_MATCHES} matchs à comparer` },
        { status: 400 },
      );
    }

    // Validation stricte des 2 matchs
    const parsed = matches.map((m) => {
      if (
        typeof m?.matchId !== "string" ||
        m.matchId.length > MAX_MATCHID_LENGTH
      ) {
        throw new ValidationError("matchId invalide (chaîne ≤ 100 chars)");
      }
      if (
        typeof m?.matchData !== "object" ||
        m.matchData === null ||
        Array.isArray(m.matchData)
      ) {
        throw new ValidationError("matchData manquant ou non-objet");
      }
      if (JSON.stringify(m.matchData).length > MAX_MATCHDATA_BYTES) {
        throw new ValidationError("matchData trop volumineux (max 10 Ko par match)");
      }
      return {
        matchId: m.matchId as string,
        label:
          typeof m.label === "string" && m.label.trim().length > 0
            ? m.label.trim().slice(0, 80)
            : String(m.matchId),
        data: m.matchData as Record<string, unknown>,
      };
    });

    const [matchA, matchB] = parsed;

    if (matchA.matchId === matchB.matchId) {
      return NextResponse.json(
        { error: "Impossible de comparer un match avec lui-même" },
        { status: 400 },
      );
    }

    geminiCachePrune();

    // Cache dédié compare : clés ordonnées pour que A+B === B+A (1 seule requête)
    const key = geminiCompareCacheKey(sport, matchA.matchId, matchB.matchId);
    const cached = geminiCacheGet<GeminiCompareInsight>(key);
    if (cached) {
      return NextResponse.json({
        ...cached,
        source: "cache",
        cachedAt: new Date().toISOString(),
      });
    }

    // Pas de cache → appel Gemini avec un prompt spécifiquement comparatif
    const prompt = buildPrompt(sport, matchA, matchB);
    const insight = await callGeminiCompare(prompt);

    // Injecte les matchId réels (Gemini ne connaît que des labels)
    insight.matchA.matchId = matchA.matchId;
    insight.matchB.matchId = matchB.matchId;

    geminiCacheSet<GeminiCompareInsight>(key, insight);

    return NextResponse.json({
      ...insight,
      source: "gemini",
    });
  } catch (err) {
    return apiErrorHandler(err, "ai/gemini-insight/compare");
  }
}