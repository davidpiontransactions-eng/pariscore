// QA revue de presse Zero-LLM — fixtures HTML + assertions sur les
// extracteurs partagés, la synthèse déterministe et les circuit-breakers.
// Exécution : bun run qa:press-review (aucun réseau requis).
// Sortie : une ligne PASS/FAIL par assertion, exit 1 si une assertion échoue.

import { readFileSync } from "fs";
import { resolve } from "path";

import {
  extractTennisPrediction,
  extractFootballPrediction,
  extractSummary,
  extractJsonLd,
  extractPredictionBlock,
  markdownToText,
} from "../src/lib/press-extractors";
import { extractTargeted, isDomainBlocked, reportDomainResult, resetDomainState } from "../src/lib/press-connectors";
import { buildTennisSynthesis, buildFootballSynthesis } from "../src/lib/press-synthesis-template";

// ---- Fixtures ----

const TENNIS_HTML = `<!doctype html>
<html><head>
<meta name="description" content="Match preview for the quarter-final clash between Iga Swiatek and Diana Shnaider.">
</head><body>
<article class="entry-content">
<h1>Swiatek vs Shnaider: Quarter-final preview and prediction</h1>
<p>Iga Swiatek enters the match in stunning form, having lost only one set all tournament.</p>
<p>Diana Shnaider will rely on her powerful forehand to trouble the world number one.</p>
<h2>Prediction</h2>
<p>Prediction: Swiatek to win in straight sets, the favorite should dominate court conditions.</p>
</article></body></html>`;

const FOOTBALL_HTML = `<!doctype html>
<html><head><title>PSG vs Marseille prediction</title></head><body>
<article>
<p>Le PSG reçoit Marseille pour le choc de la semaine, avec un effectif au complet.</p>
<p>Notre pronostic : Victoire du PSG et over 2.5 buts, score exact 3-1 pour le club de la capitale.</p>
</article></body></html>`;

const JSONLD_HTML = `<!doctype html>
<html><head>
<script type="application/ld+json">{"@type":"NewsArticle","headline":"Ubitennis: Swiatek favourite","articleBody":"Ubitennis experts expect Swiatek to win in two sets, favouring the Polish star. Shnaider will fight but lacks the consistency."}</script>
</head><body><p>menu</p></body></html>`;

// ---- Assertions ----

let failures = 0;
let passed = 0;

function assert(name: string, cond: boolean, detail?: string): void {
  if (cond) {
    passed++;
    console.log("PASS  " + name);
  } else {
    failures++;
    console.log("FAIL  " + name + (detail ? "  — " + detail : ""));
  }
}

// 1. Extraction ciblée tennis (bloc Prediction) — chemin nominal
{
  const t = extractTargeted("lastwordonsports.com", TENNIS_HTML, false);
  assert("tennis: predictText extrait du bloc Prediction", !!t.predictText && t.predictText.toLowerCase().includes("swiatek"), t.predictText);
  const pred = extractTennisPrediction(t.text, "Iga Swiatek", "Diana Shnaider", t.predictText);
  assert("tennis: favori détecté (Swiatek)", pred.favoredPlayer === "Iga Swiatek", pred.favoredPlayer ?? "null");
  assert("tennis: confidence haute sur 'will/dominant'", pred.confidence >= 70, String(pred.confidence));
  assert("tennis: résumé extrait (expertSummary non vide)", extractSummary(t.text, ["Iga Swiatek", "Diana Shnaider"]).length > 30);
}

// 2. Extraction ciblée football (bloc pronostic français)
{
  const t = extractTargeted("sportytrader.com", FOOTBALL_HTML, false);
  assert("football: predictText contient 'pronostic'", !!t.predictText && t.predictText.toLowerCase().includes("pronostic"), t.predictText);
  const pred = extractFootballPrediction(t.text, "PSG", "Marseille", t.predictText);
  assert("football: victoire domicile détectée", pred.text === "Victoire PSG", pred.text);
  assert("football: type 1X2", pred.type === "1X2", pred.type);
  assert("football: score exact extrait (3-1)", pred.exactScore === "3-1", pred.exactScore);
  assert("football: over 2.5 détecté", pred.text === "Victoire PSG", "(priorité 1X2)");
}

// 3. JSON-LD (articleBody comme texte ciblé)
{
  const json = extractJsonLd(JSONLD_HTML);
  assert("jsonld: articleBody parsé", !!json?.articleBody && json.articleBody.includes("Swiatek"), json?.articleBody?.slice(0, 60));
  const t = extractTargeted("ubitennis.com", JSONLD_HTML, false);
  assert("jsonld: predictText = articleBody", !!t.predictText && t.predictText.includes("favour"), t.predictText);
  const pred = extractTennisPrediction(t.text, "Iga Swiatek", "Diana Shnaider", t.predictText);
  assert("jsonld: favori Swiatek", pred.favoredPlayer === "Iga Swiatek", pred.favoredPlayer ?? "null");
}

// 4. Markdown Jina
{
  const md = markdownToText("## Preview\n\n[Swiatek](https://x.com) wins **in two** sets, *clearly* the better player.\n\n- item one\n- item two\n\n| A | B |\n| 1 | 2 |");
  assert("markdown: liens et bold nettoyés", md.includes("Swiatek wins in two sets") && !md.includes("**"), md.slice(0, 80));
}

// 5. Synthèse déterministe tennis (2 sources réelles → 1 entrée générée)
{
  const real = [
    { expertSummary: "a", prediction: { text: "Swiatek in 2", favoredPlayer: "Iga Swiatek", confidence: 75 } },
    { expertSummary: "b", prediction: { text: "expected three-setter", favoredPlayer: null, confidence: 60 } },
  ];
  const syn = buildTennisSynthesis(real, "Iga Swiatek", "Diana Shnaider");
  assert("synthesis tennis: générée", !!syn, syn ? "null" : "absent");
  assert("synthesis tennis: generated flag", syn?.generated === true);
  assert("synthesis tennis: favori majoritaire (1/2)", syn?.prediction.favoredPlayer === "Iga Swiatek", syn?.prediction.favoredPlayer ?? "null");
  assert("synthesis tennis: résumé cite 1/2 médias", !!syn?.expertSummary.includes("1/2"), syn?.expertSummary);
}

// 6. Synthèse déterministe football
{
  const real = [
    { expertSummary: "a", prediction: { text: "Victoire PSG", confidence: 70, exactScore: "2-1" } },
    { expertSummary: "b", prediction: { text: "Over 2.5 Buts", confidence: 65, exactScore: "2-1" } },
  ];
  const syn = buildFootballSynthesis(real, "PSG", "Marseille");
  assert("synthesis football: générée", !!syn);
  assert("synthesis football: victoire PSG dominante", !!syn?.prediction.text.includes("PSG"), syn?.prediction.text);
  assert("synthesis football: détail Over 2.5 cité", !!syn?.expertSummary.includes("Over 2.5"), syn?.expertSummary);
  assert("synthesis football: score le plus cité (2-1)", !!syn?.expertSummary.includes("2-1"), syn?.expertSummary);
}

// 7. Circuit-breaker par domaine
{
  resetDomainState();
  reportDomainResult("forebet.com", false);
  reportDomainResult("forebet.com", false);
  assert("breaker domaine: bloqué après 2 échecs", isDomainBlocked("forebet.com"));
  reportDomainResult("forebet.com", true);
  assert("breaker domaine: débloqué après succès", !isDomainBlocked("forebet.com"));
  assert("breaker domaine: autre domaine intact", !isDomainBlocked("sportytrader.com"));
}

// 8. Zéro référence Gemini dans les services
{
  const files = [
    resolve(__dirname, "../src/lib/tennis-press-review-service.ts"),
    resolve(__dirname, "../src/lib/football-press-review-service.ts"),
  ];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const banned = ["generativelanguage", "GEMINI_API_KEY"];
    for (const b of banned) {
      assert(`zero-gemini: ${f.split("/").pop()} sans "${b}"`, !src.includes(b), src.includes(b) ? "présent" : undefined);
    }
  }
}

// 9. Bloc Prediction à la volée
{
  const block = extractPredictionBlock('<div class="tip">Notre pronostic : victoire de Lyon, les deux équipes marquent.</div>');
  assert("bloc: keyword 'pronostic' trouvé", !!block && block.toLowerCase().includes("victoire de lyon"), block ?? "null");
}

console.log(`\n${passed} PASS / ${failures} FAIL`);
process.exit(failures > 0 ? 1 : 0);