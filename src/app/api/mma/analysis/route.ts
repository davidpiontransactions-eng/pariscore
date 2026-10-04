import { NextRequest, NextResponse } from "next/server";
import { generateText, LlmError } from "@/lib/llm";

// L'ancien code appelait en dur
//   generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
// Modele retire => Google repond 404, la route relayeait le statut tel quel et
// l'UI affichait « Gemini 404 » sur les 43 cartes. On passe par le transport
// partage : llmConfig().geminiModel vaut `gemini-3.6-flash` (surchargeable par
// GEMINI_MODEL), et surtout on recupere la cascade de providers + le fallback
// que la route dupliquee perdait. Le meme modele retire est code en dur dans
// ~15 endroits de server.js (lignes 8020, 14020, 23619, 49220...) : a traiter
// dans un bead dedie, sinon le meme 404 revient par un autre angle.

function buildPrompt(
  fa: string,
  fb: string,
  params: Record<string, string>,
): string {
  const probA = parseFloat(params.prob_a || "0");
  const probB = parseFloat(params.prob_b || "0");
  const evA = parseFloat(params.ev_a || "0");
  const evB = parseFloat(params.ev_b || "0");
  const bestA = parseFloat(params.best_odds_a || "0");
  const bestB = parseFloat(params.best_odds_b || "0");
  const hasBetA = params.bet_a === "true";
  const hasBetB = params.bet_b === "true";

  return `Tu es un analyste MMA expert de PariScore. Analyse ce combat avec rigueur.

[DONNÉES]
${fa} vs ${fb}
Probabilités marché: ${fa} ${(probA * 100).toFixed(1)}% / ${fb} ${(probB * 100).toFixed(1)}%
Meilleures cotes: ${fa} ${bestA > 0 ? bestA.toFixed(2) : "—"} / ${fb} ${bestB > 0 ? bestB.toFixed(2) : "—"}
EV: ${fa} ${evA > 0 ? "+" : ""}${evA.toFixed(1)}% / ${fb} ${evB > 0 ? "+" : ""}${evB.toFixed(1)}%
Value Bet: ${hasBetA ? fa : hasBetB ? fb : "Aucun"}

FORMAT:
**ANALYSE**
• Style matchup (1 ligne)
• Facteur X décisif
• Convergence signaux

**TOP 3 PARIS**
🥇 BANKROLL BUILDER
Pari: [...] | Cote: [...] | EV: [...] → [1 phrase]

🎯 VALUE BET
Pari: [...] | Cote: [...] | EV: [...] → [1 phrase]

⚡ WILD CARD
Pari: [...] | Cote: [...] | EV: [...] → [1 phrase]

Français. Max 300 mots. Zéro disclaimer.`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fa = searchParams.get("fa") || "";
  const fb = searchParams.get("fb") || "";
  if (!fa || !fb) {
    return NextResponse.json({ error: "fa and fb required" }, { status: 400 });
  }

  const params: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) params[k] = v;

  try {
    const out = await generateText({
      prompt: buildPrompt(fa, fb, params),
      temperature: 0.6,
      maxOutputTokens: 900,
      timeoutMs: 15_000,
    });

    if (!out.text) {
      return NextResponse.json(
        { error: "Réponse vide du modèle" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      text: out.text,
      provider: out.provider,
      model: out.model,
      latencyMs: out.latencyMs,
    });
  } catch (err) {
    // LlmError porte un message et un code deja penses pour le client ; on ne
    // laisse pas fuiter le detail upstream (le transport le logue cote serveur).
    if (err instanceof LlmError) {
      const status = err.status >= 500 ? 502 : err.status;
      const message =
        err.code === "GEMINI_NOT_CONFIGURED" || err.code === "LLM_ALL_PROVIDERS_FAILED"
          ? "Analyse indisponible (aucun fournisseur IA configuré)"
          : err.status === 429
            ? "Analyse indisponible temporairement (quota IA atteint)"
            : "Analyse indisponible";
      return NextResponse.json({ error: message, code: err.code }, { status });
    }
    return NextResponse.json(
      { error: "Analyse indisponible" },
      { status: 503 },
    );
  }
}
