/**
 * LLM Status — diagnostic des providers LLM configurés (Gemini cloud vs
 * serveur local OpenAI-compatible MAX/Ollama).
 *
 * GET /api/ai/llm-status?token=CRON_SECRET
 *
 * Retourne la config effective (LLM_PROVIDER, fallback) + sondage de
 * disponibilité du serveur local (/v1/models, timeout 3s). Utile pour
 * vérifier que l'inférence locale répond avant de basculer en mode "local".
 */
import { NextResponse } from "next/server";
import { llmStatus } from "@/lib/llm";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const status = await llmStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}