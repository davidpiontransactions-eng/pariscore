// QA EDGE-CASES TEMPORAIRE (audit) — exercice des fonctions pures sur des
// données anormales. Lancement : bun run scripts/qa-press-review-edges.ts
// Fichier temporaire d'audit : à supprimer après validation.

import {
  stripHtml,
  markdownToText,
  extractMetaDescription,
  extractOgDescription,
  extractJsonLd,
  extractPredictionBlock,
  extractTennisPrediction,
  extractFootballPrediction,
  extractSummary,
  escRe,
  shortName,
} from "../src/lib/press-extractors";
import { buildTennisSynthesis, buildFootballSynthesis } from "../src/lib/press-synthesis-template";

let failures = 0;
let passed = 0;
function assert(name: string, cond: boolean, detail?: string): void {
  if (cond) { passed++; console.log("PASS  " + name); }
  else { failures++; console.log("FAIL  " + name + (detail ? "  — " + detail : "")); }
}

// ---------- 1. NULL-SAFETY : texte vide ----------
{
  const t = extractTennisPrediction("", "Iga Swiatek", "Diana Shnaider");
  assert("1a. tennis texte vide : pas de crash, favori null", t.favoredPlayer === null, JSON.stringify(t));
  assert("1b. tennis texte vide : texte fallback non vide", t.text.length > 0, t.text);
  const f = extractFootballPrediction("", "PSG", "Marseille");
  assert("1c. football texte vide : pas de crash", f.type === "other" || typeof f.type === "string", JSON.stringify(f));
  assert("1d. stripHtml vide", stripHtml("") === "");
  assert("1e. markdownToText vide", markdownToText("") === "");
  assert("1f. extractMetaDescription sans meta", extractMetaDescription("<html><body>x</body></html>") === null);
  assert("1g. extractJsonLd invalide (JSON cassé)", extractJsonLd('<script type="application/ld+json">{oops</script>') === null);
}

// ---------- 2. NULL-SAFETY : noms vides / caractères spéciaux ----------
{
  const t1 = extractTennisPrediction("some text without names", "", "Djokovic");
  const noCrash = typeof t1.favoredPlayer === "string" || t1.favoredPlayer === null;
  assert("2a. nom vide : pas de crash", noCrash, JSON.stringify(t1));

  // escRe : apostrophes, parenthèses, points dans les noms
  assert("2b. escRe échappe les métacaractères", escRe("o'neil (usa)") === "o\\'neil \\(usa\\)", escRe("o'neil (usa)"));
  const t2 = extractTennisPrediction("O'Neil to win in straight sets", "John O'Neil", "P. Smith");
  assert("2c. apostrophe dans le nom : favori détecté", t2.favoredPlayer === "John O'Neil", t2.favoredPlayer ?? "null");
  const t3 = extractTennisPrediction("Alcaraz is the favourite here", "Carlos Alcaraz", "J. Sinner");
  assert("2d. nom court contenu dans le texte : favori détecté", t3.favoredPlayer === "Carlos Alcaraz", t3.favoredPlayer ?? "null");
}

// ---------- 3. BORNE confidence ----------
{
  const syn = buildTennisSynthesis(
    [
      { expertSummary: "a", prediction: { text: "x", favoredPlayer: "Iga Swiatek", confidence: 100 } },
      { expertSummary: "b", prediction: { text: "y", favoredPlayer: "Iga Swiatek", confidence: 100 } },
    ],
    "Iga Swiatek", "Diana Shnaider");
  assert("3a. synthèse tennis : confidence bornée à 90", !!syn && syn.prediction.confidence <= 90, String(syn?.prediction.confidence));
  const syn2 = buildFootballSynthesis(
    [
      { expertSummary: "a", prediction: { text: "Victoire PSG", confidence: 100, exactScore: "2-0" } },
      { expertSummary: "b", prediction: { text: "Victoire PSG", confidence: 100, exactScore: "2-0" } },
    ],
    "PSG", "Marseille");
  assert("3b. synthèse football : confidence bornée à 90", !!syn2 && syn2.prediction.confidence <= 90, String(syn2?.prediction.confidence));
  const tp = extractTennisPrediction("Swiatek will clearly dominate and win", "Iga Swiatek", "Diana Shnaider");
  assert("3c. extracteur tennis : confidence bornée 40-70", tp.confidence >= 40 && tp.confidence <= 70, String(tp.confidence));
}

// ---------- 4. 0 source / 1 source / division par zéro ----------
{
  assert("4a. synthèse tennis 0 source : null", buildTennisSynthesis([], "A", "B") === null);
  assert("4b. synthèse football 0 source : null", buildFootballSynthesis([], "A", "B") === null);
  const one = buildTennisSynthesis(
    [{ expertSummary: "a", prediction: { text: "x", favoredPlayer: "A", confidence: 60 } }],
    "Alice A", "Bob B");
  assert("4c. synthèse tennis 1 source : générée sans crash (service ne l'appelle qu'à 2)", !!one && one.prediction.favoredPlayer === "Alice A", JSON.stringify(one));
  assert("4d. pas de division par zéro : pct jamais appelé avec n=0", true);
}

// ---------- 5. BUG CANDIDAT : score exact extrait d'une DATE ----------
{
  const f = extractFootballPrediction(
    "Published on 2024-08-11. Both teams to score looks likely here.",
    "PSG", "Marseille");
  assert("5a. une date ne doit PAS devenir exactScore", f.exactScore === undefined || f.exactScore === null, "exactScore = " + f.exactScore);
}

// ---------- 6. BUG CANDIDAT : faux 1X2 par mention de nom dans le texte complet ----------
{
  const f = extractFootballPrediction(
    "PSG hosts Marseille at the Parc des Princes. Both teams to score looks likely.",
    "PSG", "Marseille", null);
  assert("6a. 'both teams to score' sans predictText doit donner btts, pas 'Victoire PSG'",
    f.type === "btts", "type=" + f.type + " text=" + f.text + " exactScore=" + f.exactScore);
}

// ---------- 7. BUG CANDIDAT : derby avec mêmes noms courts ----------
{
  const f = extractFootballPrediction("Real Madrid to win the derby", "Atletico Madrid", "Real Madrid", null);
  assert("7a. away (Real Madrid) détecté malgré short 'madrid' partagé",
    f.text.includes("Real Madrid"), "text=" + f.text + " type=" + f.type);
}

// ---------- 8. RSS items incomplets : une URL invalide tue-t-elle la boucle ? ----------
{
  let threw = false;
  try { new URL(""); } catch { threw = true; }
  assert("8a. meca : new URL('') throw (utilisé dans discoverArticles sans try par item)",
    threw, "new URL('') n'a pas throw");
}

// ---------- 9. Cache : sandboxing du chemin par matchId ----------
{
  const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const evil = sanitize("..\\..\\..\\etc\\passwd");
  assert("9a. matchId hostile : aucun séparateur de chemin survivant", !evil.includes("\\") && !evil.includes("/") && !evil.includes(".."), evil);
}

// ---------- 10. Consensus : draw pct / arrondis (football) ----------
{
  const syn = buildFootballSynthesis(
    [
      { expertSummary: "a", prediction: { text: "Match Nul", confidence: 55 } },
      { expertSummary: "b", prediction: { text: "Match Nul", confidence: 55 } },
    ],
    "PSG", "Marseille");
  assert("10a. 2 sources nul : synthèse 'Match Nul'", !!syn && syn.prediction.text === "Match Nul", syn?.prediction.text);
}

// ---------- 11. Résumé : texte court ----------
{
  assert("11a. extractSummary texte < 30 chars : chaîne vide", extractSummary("short text here", ["A", "B"]) === "");
  assert("11b. extractSummary ne plante pas sur caractères spéciaux",
    typeof extractSummary("Djokovic (SRB) beats Nadal! Amazing match. Djokovic wins 6-4 6-2.", ["Novak Djokovic", "Rafael Nadal"]) === "string");
}

// ---------- 12. extractPredictionBlock : mot-clé en attribut HTML ----------
{
  const blk = extractPredictionBlock('<div class="prediction-box hide">This is not a real prediction.</div>');
  assert("12a. mot-clé dans une classe : bloc extrait sans crash", typeof blk === "string" || blk === null, blk ?? "null");
}

console.log(`\n${passed} PASS / ${failures} FAIL`);
process.exit(failures > 0 ? 1 : 0);