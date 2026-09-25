// GET /api/handball/ai-analysis?home=…&away=…&league=…&date=…
//
// Analyse IA prédictive handball (onglet « IA » du popup) :
//   1. calcul des données RÉELLES via le même moteur que /api/handball/analysis ;
//   2. lecture du cache VPS (génération unique par match, TTL 24h) ;
//   3. à défaut, génération Gemini (clé côté serveur, timeout 60 s) puis
//      persistance dans data/handball-ai-cache.json.
//
// Contraintes : le prompt ne quitte jamais le serveur, aucune erreur n'est
// mise en cache (quota → l'utilisateur peut réessayer), réponses en no-store
// (le cache de référence est celui du VPS, pas le CDN).

import { NextResponse } from "next/server";
import { GET as analysisGET, type HandballAnalysisPayload } from "../analysis/route";
import {
  AI_CACHE_TTL_MS,
  getOrGenerateAiAnalysis,
} from "@/lib/handball-ai-analysis";
import { LlmError } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const home = searchParams.get("home") ?? "";
  const away = searchParams.get("away") ?? "";
  const league = searchParams.get("league") ?? "";
  const date = searchParams.get("date");

  if (!home || !away) {
    return NextResponse.json(
      { ok: false, error: "home/away requis" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 1. Données réelles du match (moteur maison) ------------------------------
  const qs = new URLSearchParams({ home, away });
  if (league) qs.set("league", league);
  if (date) qs.set("date", date);
  let analysis: HandballAnalysisPayload;
  try {
    const res = await analysisGET(new Request(`http://internal/api/handball/analysis?${qs}`));
    analysis = (await res.json()) as HandballAnalysisPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Analyse du match indisponible" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!analysis?.ok) {
    return NextResponse.json(
      { ok: false, error: "Analyse du match invalide" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2. Cache 24h ou génération (une seule fois) ------------------------------
  try {
    const { entry, cached } = await getOrGenerateAiAnalysis(analysis, { home, away, league, date });
    const ageMs = Date.now() - Date.parse(entry.generatedAt);
    return NextResponse.json(
      {
        ok: true,
        cached,
        generatedAt: entry.generatedAt,
        /** Heures restantes avant régénération (cache VPS 24h). */
        expiresInHours: Math.max(0, Math.round((AI_CACHE_TTL_MS - ageMs) / 3_600_000)),
        model: entry.model,
        latencyMs: entry.latencyMs,
        text: entry.text,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const e = err instanceof LlmError ? err : new LlmError(String(err), 500, "AI_ANALYSIS_FAILED");
    const status = e.status >= 400 && e.status < 600 ? e.status : 500;
    return NextResponse.json(
      { ok: false, error: e.message, code: e.code },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}
