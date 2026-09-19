import { NextRequest, NextResponse } from "next/server";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY manquante" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const fa = searchParams.get("fa") || "";
  const fb = searchParams.get("fb") || "";
  if (!fa || !fb) {
    return NextResponse.json({ error: "fa and fb required" }, { status: 400 });
  }

  const params: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) params[k] = v;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(fa, fb, params) }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 900 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Gemini ${res.status}` },
        { status: res.status >= 500 ? 502 : res.status },
      );
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "Réponse Gemini vide" },
        { status: 502 },
      );
    }

    return NextResponse.json({ text, provider: "gemini-2.0-flash" });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes("timeout")) {
      return NextResponse.json({ error: "Analyse timeout" }, { status: 504 });
    }
    return NextResponse.json(
      { error: "Analyse indisponible" },
      { status: 503 },
    );
  }
}
