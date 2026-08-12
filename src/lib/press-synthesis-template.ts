// Synthèse média déterministe — remplace l'ancien fallback Gemini.
// Server-only. Génère UNE entrée « Consensus médias » dérivée UNIQUEMENT des
// sources réelles déjà scrapées (aucune fabrication, aucune API LLM).
// Marquée `generated: true` — jamais présentée comme source de presse externe.

export type SynthesisSource = {
  name: string;
  domain: "n/a";
  icon: string;
  url: "";
  generated: true;
  expertSummary: string;
  prediction: {
    text: string;
    favoredPlayer: string | null;
    confidence: number;
    type?: string;
    exactScore?: string;
  };
};

type AnyRealSource = {
  expertSummary: string;
  prediction: { text: string; favoredPlayer?: string | null; confidence?: number; type?: string; exactScore?: string };
};

const SYNTHESIS_NAME = "Consensus médias";
const SYNTHESIS_ICON = "🧠";

function pct(n: number, total: number): string {
  return String(Math.round((n / total) * 100)) + "%";
}

/** Entrée de synthèse tennis — dérivée des favoris réels majoritaires. */
export function buildTennisSynthesis(
  real: AnyRealSource[],
  playerA: string,
  playerB: string,
): SynthesisSource | null {
  if (real.length === 0) return null;
  const n = real.length;

  let a = 0, b = 0, confSum = 0;
  for (const s of real) {
    confSum += s.prediction.confidence ?? 60;
    if (s.prediction.favoredPlayer === playerA) a++;
    else if (s.prediction.favoredPlayer === playerB) b++;
  }
  const favored = a > b ? playerA : b > a ? playerB : null;
  const majority = Math.max(a, b);
  const confidence = Math.min(90, Math.round(confSum / n));

  const labelA = playerA.split(/\s+/).pop() || playerA;
  const labelB = playerB.split(/\s+/).pop() || playerB;

  const expertSummary = favored
    ? `Synthèse déterministe : ${majority}/${n} des médias analysés placent ${favored} favori (${pct(majority, n)}). Les autres sources sont partagées ou sans pronostic explicite.`
    : `Synthèse déterministe : les ${n} médias analysés sont partagés (${labelA} ${pct(a, n)} contre ${labelB} ${pct(b, n)}), aucun favori net.`;

  return {
    name: SYNTHESIS_NAME,
    domain: "n/a",
    icon: SYNTHESIS_ICON,
    url: "",
    generated: true,
    expertSummary,
    prediction: {
      text: favored ? `${favored.split(/\s+/).pop()} en tête des médias` : "Pronostics partagés",
      favoredPlayer: favored,
      confidence,
    },
  };
}

/** Entrée de synthèse football — dérivée des pronostics 1X2 / O-U / BTTS réels. */
export function buildFootballSynthesis(
  real: AnyRealSource[],
  homeTeam: string,
  awayTeam: string,
): SynthesisSource | null {
  if (real.length === 0) return null;
  const n = real.length;

  let homeW = 0, awayW = 0, drawW = 0, overW = 0, bttsW = 0, confSum = 0;
  const scoreCounts = new Map<string, number>();
  const hShort = (homeTeam.split(/\s+/).pop() || homeTeam).toLowerCase();
  const aShort = (awayTeam.split(/\s+/).pop() || awayTeam).toLowerCase();

  for (const s of real) {
    confSum += s.prediction.confidence ?? 60;
    const t = (s.prediction.text || "").toLowerCase();
    if (t.includes("victoire") && t.includes(hShort)) homeW++;
    else if (t.includes("victoire") && t.includes(aShort)) awayW++;
    else if (t.includes("nul")) drawW++;
    else if (t.includes("home") || t.includes("domicile")) homeW++;
    else if (t.includes("away") || t.includes("extérieur") || t.includes("exterieur")) awayW++;
    if (t.includes("over")) overW++;
    if (t.includes("marquent") || t.includes("btts")) bttsW++;
    if (s.prediction.exactScore) {
      scoreCounts.set(s.prediction.exactScore, (scoreCounts.get(s.prediction.exactScore) || 0) + 1);
    }
  }

  const dominant = homeW >= awayW && homeW >= drawW && homeW > 0
    ? { label: `Victoire ${homeTeam.split(/\s+/).pop()}`, side: "home" as const }
    : awayW >= homeW && awayW >= drawW && awayW > 0
      ? { label: `Victoire ${awayTeam.split(/\s+/).pop()}`, side: "away" as const }
      : drawW >= homeW && drawW >= awayW && drawW > 0
        ? { label: "Match Nul", side: "draw" as const }
        : null;

  let bestScore: string | undefined;
  let bestCount = 0;
  for (const [score, count] of scoreCounts) {
    if (count > bestCount) { bestCount = count; bestScore = score; }
  }
  const details: string[] = [];
  if (overW > 0) details.push(`Over 2.5 dans ${overW}/${n}`);
  if (bttsW > 0) details.push(`BTTS dans ${bttsW}/${n}`);
  if (bestScore) details.push(`score le plus cité : ${bestScore}`);

  const confidence = Math.min(90, Math.round(confSum / n));
  const expertSummary = dominant
    ? `Synthèse déterministe : ${dominant.label} privilégié par la presse analysée (${homeW}/${n} domicile, ${drawW}/${n} nul, ${awayW}/${n} extérieur).${details.length ? " " + details.join(" — ") + "." : ""}`
    : `Synthèse déterministe : la presse analysée est partagée (${homeW}/${n} domicile, ${drawW}/${n} nul, ${awayW}/${n} extérieur), aucun pronostic dominant.${details.length ? " " + details.join(" — ") + "." : ""}`;

  return {
    name: SYNTHESIS_NAME,
    domain: "n/a",
    icon: SYNTHESIS_ICON,
    url: "",
    generated: true,
    expertSummary,
    prediction: {
      text: dominant
        ? dominant.label
        : overW > 0 ? "Over 2.5 Buts" : bttsW > 0 ? "Les 2 équipes marquent" : "Pronostic mixte",
      favoredPlayer: null,
      confidence,
      type: dominant ? "1X2" : overW > 0 ? "over_under" : bttsW > 0 ? "btts" : "other",
      exactScore: bestScore,
    },
  };
}