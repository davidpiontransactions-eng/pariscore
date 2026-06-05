# Éval Repo — luizcieslak/cs2-match-prediction vs PariScore

**Date** : 2026-06-05
**Évaluateur** : GM/CTO PariScore
**Repo cible** : https://github.com/luizcieslak/cs2-match-prediction
**Verdict** : ❌ **NO-GO** (LLM-agent non calibré + redondant p2if + stack lent/coûteux) — GO-partiel concept uniquement

---

## 1. Ce qu'est le repo (verbatim)

> "An **LLM-based agent** that predicts professional Counter-Strike 2 match outcomes by analyzing team statistics and recent news articles from HLTV."

> "Key technique: **Chain-of-Thought reasoning** with 'analysis' and 'conclusion' fields for improved results"

**Traduction** : agent LLM (GPT-compatible) qui scrape HLTV (stats + articles news) et raisonne en chain-of-thought pour prédire le vainqueur. Pas de modèle math — c'est du prompt engineering sur LLM.

---

## 2. Extraction

| Champ | Valeur (verbatim) |
|---|---|
| **Modèle/algo** | LLM agent OpenAI-compatible. "Data Mapper Pattern for web scraping; function-calling tools with JSON schemas". Chain-of-Thought (champs `analysis`+`conclusion`). **Aucune archi ML** (pas de layers/loss/optimizer — c'est un wrapper LLM). |
| **Features/inputs** | KDA ratio, win rate, event history, previous matchups, map pool stats, **news articles**, championship context, best-of format. |
| **Target** | Match winner (binaire). |
| **Données** | HLTV scrapé via **Patchright/Playwright**. Taille non spécifiée. Pas de dataset livré. |
| **Métriques** | Accuracy **58.3%** (avancement bracket) / **~65%** (matchs individuels). Test = Blast Austin 2025 Major. ❌ **PAS de Brier, ROI, calibration, IC**. |
| **Perf** | "~30-second LLM calls", "several minutes to complete" par prédiction. |
| **Stack** | TypeScript + Patchright/Playwright + pnpm + API LLM OpenAI-compatible. |
| **Licence** | ❌ **Non spécifiée** → all-rights-reserved (flag legal). |
| **Odds en entrée** | ✅ **Non** — pas de cote bookmaker → non-circulaire. |

---

## 3. Analyse vs PariScore

| Critère | Verdict |
|---|---|
| **Edge marché réel** | ⚠️ Non-circulaire (pas d'odds) = bon. MAIS 65% accuracy ≈ **baseline favori CS2** (le favori gagne ~65-70%). Sans ROI ni comparaison à la proba implicite cote → **edge non prouvé**. Peut juste "prédire le favori". |
| **Calibration / UQD** | 🔴 **ZÉRO** (pas de Brier/reliability/IC). Viole règle CLAUDE.md "pas de prod sans IC". Inéligible prod tel quel. |
| **Redondance** | 🔴 **Forte**. PariScore a déjà : (a) **p2if "Revue de Presse" AI panel Gemini** qui lit les news pré-match et raisonne → exactement le "LLM + news articles" du repo. (b) BSD CS2 predictions + HLTV stats + csapi.de. Le repo réinvente le pattern p2if appliqué à CS2. |
| **Features inédites** | ❌ Aucune feature math pour `buildMatchRecord`. Le "chain-of-thought analysis+conclusion" = structure de prompt, pas une feature. Déjà couvert par l'approche p2if. |
| **Compat stack** | 🔴 TS + Playwright + **LLM par appel (30s, minutes/prédiction)**. PariScore = Node zero-dep + Gemini déjà câblé. Trop **lent + coûteux** pour cockpit live. Playwright = dépendance lourde anti zero-dep. |
| **Légalité** | 🚩 Pas de licence + scraping HLTV Playwright (CF/ToS). |
| **Leçons passées** | Confirme : un prédicteur sans calibration = NO-GO automatique (règle UQD). |

---

## 4. Recommandation GM — ❌ NO-GO (incorporation) / 🟡 concept récupérable

1. **Inéligible UQD** : zéro calibration/Brier/IC. 65% accuracy = potentiellement juste le favori, jamais comparé à la cote → edge non démontré. Règle CLAUDE.md interdit la prod sans IC.
2. **Redondant p2if** : PariScore fait DÉJÀ "LLM lit news + stats → analyse" via la Revue de Presse Gemini (p2if, foot+tennis). Incorporer ce repo = réinventer un pattern maison, pour CS2.
3. **Stack lent/coûteux/fragile** : TS+Playwright+LLM 30s/appel, minutes par match, pas de licence. Incompatible cockpit temps réel + anti zero-dep.

**🟡 GO-partiel CONCEPT (pas le repo)** : la seule idée à voler = **structure de prompt chain-of-thought `analysis`/`conclusion`** pour étendre **p2if à CS2** (Gemini lit stats bo3.gg/HLTV + news HLTV → verdict explicable). C'est un **build interne** réutilisant l'infra p2if existante, PAS une incorporation du repo. Effort ~3-4h si DG veut un onglet "AI Scout CS2". Mais : reste explicatif/UI, **jamais** dans `bayesianBlend` sans backtest Brier (cf. leçons age/hand NO-GO).

**Effort** :
- Incorporation repo : N/A (NO-GO).
- Extension p2if→CS2 (concept volé) : 3-4h, infra Gemini réutilisée.

---

Attente : ton GO/NO-GO — (a) NO-GO net, ou (b) GO-partiel extension p2if CS2 (concept chain-of-thought, build interne, UI-only).
