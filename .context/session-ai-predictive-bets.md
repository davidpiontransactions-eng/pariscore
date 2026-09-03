# Session: AI Predictive Bets — Football Prematch

**Date**: 2026-08-26
**Scope**: Intégration d'un prompt d'analyse IA et de 3 paris prédictifs dans la card Analyse du prematch football.

---

## 1. Problème initial

Le bouton "Analyse" dans la card prematch football ouvre le `FootballMatchDetailDialog` qui rend `AIMatchReport`. Ce composant appelle `POST /api/ai/football-match-report` → `generateText()` → Gemini. **Le flux existait mais ne générait que synthesis + keyFacts + combo** — aucun pari prédictif IA.

---

## 2. Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/lib/football-match-report.ts` | Ajout type `AIPredictiveBet` + champ `predictiveBets` au `FootballAIReport` |
| `src/app/api/ai/football-match-report/route.ts` | Enhance `buildPrompt()` avec 3 paris prédictifs + normalisation `predictiveBets` dans `callLlm()` |
| `src/components/football/AIMatchReport.tsx` | Ajout `PredictiveBetCard` + `ConfianceBadge` + section rendu des 3 paris |
| `src/lib/llm.ts` | Default model `gemini-2.5-flash` → `gemini-3.6-flash` (2.5 déprécié) |
| `tests/ai-predictive-bets.spec.ts` | Tests unitaires + integration test (mock Tottenham vs Charlton) |
| `tests/ai-predictive-bets-standalone.ts` | Script standalone Gemini direct (sans serveur Next.js) |

---

## 3. Nouveau type `AIPredictiveBet`

```typescript
type AIPredictiveBet = {
  label: string;      // "Victoire domicile", "Over 2.5 Buts", etc.
  prob: number;       // 0-100
  odds: number | null; // cote décimale indicative
  confidence: number;  // 1-5
  rationale: string;   // justification courte
};
```

---

## 4. Prompt enhanced

Le prompt demande au LLM de générer 3 paris DIFFÉRENTS :
1. **Issue principale** (vainqueur, double chance)
2. **Volume** (over/under buts, corners)
3. **Value/spécifique** (handicap, score exact, combiné)

Avec des règles strictes : probabilités réalistes, cotes cohérentes (≈ 1/prob), appui sur les données fournies.

---

## 5. Résultat test — Tottenham vs Charlton

**Match**: Tottenham Hotspur (3e, 2.25 PPG) vs Charlton Athletic (18e, 0.75 PPG)
**Modèle**: gemini-3.6-flash
**Latence**: 11.9s

### 3 Paris générés par l'IA

| # | Paris | Prob | Cote | Conf | Rationale |
|---|-------|------|------|------|-----------|
| 1 | Victoire domicile | 62% | 1.55 | 4/5 | Tottenham survole ce début de saison avec un PPG de 2.25 face à Charlton qui stagne à la 18e place |
| 2 | Plus de 2.5 Buts | 54% | 1.85 | 3/5 | xG total de 2.7 et probabilité Over 1.5 à 78% créent une opportunité sur match prolifique |
| 3 | Tottenham gagne & Over 1.5 | 52% | 1.80 | 3/5 | Charlton génère très peu de danger (0.9 xG) tandis que Tottenham dispose du potentiel offensif |

**Combo suggéré**: Double Chance 1X & Plus de 1.5 Buts (84% × 78%)
**Confiance globale**: 4/5

---

## 6. Assertions validées

```
✅ synthesis est une string
✅ keyFacts a 3 éléments
✅ predictiveBets a 3 éléments
✅ bet 1/2/3 a label + prob
✅ prob 1/2/3 entre 0-100
✅ confidence 1-5
```

**10/10 assertions passées**

---

## 7. Fix Gemini model

Le modèle `gemini-2.5-flash` est déprécié (404). Cascade de fallback testée :
- `gemini-2.5-flash` → 404 (déprécié)
- `gemini-2.5-pro` → 404 (déprécié)
- `gemini-2.0-flash-001` → 404 (déprécié)
- `gemini-1.5-pro` → 404 (introuvable)
- `gemini-2.5-flash-preview-04-17` → 404 (introuvable)
- `gemini-2.0-flash-lite` → 404 (déprécié)
- **`gemini-3.6-flash` → ✅ fonctionne**

Default mis à jour dans `src/lib/llm.ts` : `gemini-3.6-flash`.

---

## 8. Boucle ingénierie

```
1. [Research] Grep/Read composants Analyse → verify: flux identifié
2. [Types] AIPredictiveBet + FootballAIReport étendu → verify: type-safe
3. [Prompt] buildPrompt() enhanced + callLlm() normalisé → verify: JSON output
4. [UI] PredictiveBetCard + ConfidenceBadge + section rendu → verify: 3 cartes affichées
5. [Test] Mock Tottenham vs Charlton + assertions → verify: 10/10 pass
6. [GEMINI] Fix model déprécié → verify: gemini-3.6-flash répond
7. [Lint] bun run lint → verify: 0 erreurs
```

---

## 9. Notes techniques

- **Cache**: le rapport est mis en cache 12h via `gemini-cache.ts` (clé `football-report:{matchId}:{date}`)
- **Rate limiting**: 10 requêtes / 5 min par IP
- **Payload max**: 10KB (validation côté serveur)
- **Fallback**: si le LLM renvoie moins de 3 paris, le serveur complète avec des placeholders "Non disponible"
- **Client**: `useFootballAIReport` hook déduplique en mémoire (pas de re-POST à chaque ouverture dialog)
