/**
 * AI NL Filter Compiler — compile une requête en langage naturel en règles de
 * filtrage typées pour l'onglet Football (Phase 1 suite AI Pricing).
 *
 * POST /api/ai/football-nl-filter
 * Body: { text: string }
 * Response: { preset: { label, description, rules: CompiledFilterRule[] } }
 *
 * Le vocabulaire de champs est partagé avec le client via
 * `FILTER_FIELD_VOCABULARY` (src/lib/football-nl-filter.ts) : le prompt ne
 * peut produire que des champs/opérateurs que le moteur sait évaluer.
 *
 * Transport unifié via generateText() (src/lib/llm.ts) : Gemini cloud ou
 * serveur local OpenAI-compatible selon LLM_PROVIDER / LLM_FALLBACK_ENABLED.
 */
import { NextResponse } from "next/server";
import { apiErrorHandler } from "@/lib/api-error-handler";
import { generateText } from "@/lib/llm";
import {
  FILTER_FIELD_VOCABULARY,
  type CompiledFilterRule,
  type FilterOperator,
} from "@/lib/football-nl-filter";

const MAX_TEXT_LEN = 600;
const MAX_RULES = 8;
const VALID_FIELDS = new Set(FILTER_FIELD_VOCABULARY.map((f) => f.field));
const VALID_OPERATORS: FilterOperator[] = [">=", "<=", "==", "delta_gt"];

// Rate limiting: max 8 req/5min per IP (appels LLM coûteux).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;

function buildPrompt(text: string): string {
  const vocab = FILTER_FIELD_VOCABULARY.map((f) => `- ${f.field} : ${f.description}`).join("\n");
  return `Tu es un compilateur de filtres de paris sportifs. Transforme la requête utilisateur en règles de filtrage JSON.

CHAMPS DISPONIBLES (utilise UNIQUEMENT ces noms) :
${vocab}

OPÉRATEURS DISPONIBLES : ">=", "<=", "==", "delta_gt" (delta_gt = écart relatif strictement supérieur, pour les champs LIVE delta).

RÈGLES DE TRADUCTION :
- "au moins X", "≥ X", "minimum X" → ">="
- "au plus X", "≤ X", "maximum X" → "<="
- "X de plus que" (écart relatif live) → "delta_gt"
- Les probabilités sont sur 0-100 (ex: "55%" → 55).
- PPG = points par match (valeur décimale, ex: 1.2).
- Si la requête mentionne l'équipe visiteuse/away, utilise les champs away. Domicile/home → champs home.
- Génère entre 1 et ${MAX_RULES} règles. Sois fidèle à l'intention, sans inventer de champ.

FORMAT DE SORTIE (JSON strict, sans markdown, sans texte autour) :
{"label":"<nom court du filtre, max 30 caractères>","description":"<résumé en une phrase, max 120 caractères>","rules":[{"field":"<champ>","operator":"<opérateur>","value":<nombre>,"unit":"percentage|ppg|count"}]}

Requête utilisateur : ${text}`;
}

/** Extrait le premier objet JSON d'un texte (robuste aux fences/markdown). */
function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

async function callLlm(prompt: string): Promise<Record<string, unknown>> {
  const result = await generateText({
    prompt,
    temperature: 0.2,
    maxOutputTokens: 2048,
    json: true,
  });

  const cleaned = extractJson(result.text);
  return JSON.parse(cleaned) as Record<string, unknown>;
}

/** Valide et assainit les règles produites (rejette champs/opérateurs inconnus). */
function sanitizeRules(raw: unknown): CompiledFilterRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: CompiledFilterRule[] = [];
  for (const r of raw.slice(0, MAX_RULES)) {
    if (!r || typeof r !== "object") continue;
    const rule = r as Record<string, unknown>;
    const field = typeof rule.field === "string" ? rule.field : "";
    const operator = rule.operator as FilterOperator;
    const value = Number(rule.value);
    if (!VALID_FIELDS.has(field)) continue;
    if (!VALID_OPERATORS.includes(operator)) continue;
    if (!Number.isFinite(value)) continue;
    const unit = rule.unit === "percentage" || rule.unit === "ppg" || rule.unit === "count"
      ? rule.unit
      : undefined;
    rules.push({ field, operator, value, unit });
  }
  return rules;
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
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Champ 'text' requis." }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LEN) {
      return NextResponse.json(
        { error: `Requête trop longue (max ${MAX_TEXT_LEN} caractères).` },
        { status: 400 },
      );
    }

    const prompt = buildPrompt(text);
    const parsed = await callLlm(prompt);
    const rules = sanitizeRules(parsed.rules);
    if (rules.length === 0) {
      return NextResponse.json(
        { error: "Aucune règle valide n'a pu être générée. Reformulez votre requête." },
        { status: 422 },
      );
    }

    const label = typeof parsed.label === "string" && parsed.label.trim()
      ? parsed.label.trim().slice(0, 30)
      : "Filtre IA";
    const description = typeof parsed.description === "string"
      ? parsed.description.trim().slice(0, 120)
      : "";

    return NextResponse.json({ preset: { label, description, rules } });
  } catch (err) {
    return apiErrorHandler(err, "ai/football-nl-filter");
  }
}