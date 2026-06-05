# Analyse — CS2 AI Benchmark (cieslak.dev) · Avis GM PariScore

**Date** : 2026-06-05
**Source** : https://cieslak.dev/en/blog/2025-07-17-cs2-ai-benchmark/ (Luiz Cieslak, 17 juil. 2025)
**Lien projet** : auteur du repo `luizcieslak/cs2-match-prediction` (évalué ce jour → GO-partiel AI Scout CS2 livré)
**Pertinence** : benchmark direct de l'approche qu'on vient d'implémenter (LLM lit stats HLTV + news → prédit winner CS2).

---

## 1. Ce que mesure le benchmark (verbatim)

Test = **Blast Austin Major 2025**, prédictions faites **AVANT** le tournoi (30 mai 2025). Format Swiss.

**Données injectées au LLM** (identiques à notre AI Scout) :
- Résumé des 10 derniers articles news par équipe
- Stats globales équipe (win rate, K/D)
- World ranking
- Historique events (6 mois)
- Map pool détaillé (winrate, pistol%, CT/T%, pick/ban% par carte)
- Contexte championnat (stage, format BO1/BO3)
- **Chain-of-thought imposé** : `analysis` AVANT `conclusion` (exactement notre pattern AI Scout)

---

## 2. Résultats (verbatim)

| Métrique | Meilleur modèle | Score |
|---|---|---|
| **Avancement entre stages** | `deepseek-chat` = `gpt-4.1` | **58.3%** avg accuracy |
| **Matchs individuels** (réels) | `claude-sonnet-4` | **18 corrects** (~64%) |
| Matchs (2e) | `sabia-3` (MaritacaAI) | 17 corrects |
| **Reasoning models** (`claude-opus-4`) | — | **PIRES** que modèles standard (surprise auteur) |

**Citations clés :**
> "there were **no improvements from the last experiment** [GPT-4 2024]"
> "the reasoning models performed **worse** than the other models… it was a surprise to me"
> "It is a feature, not a bug… the fact the LLMs **did not have a great performance** might be a feature of the sport itself that is **hardly predictable**"

**Absents** : ❌ aucun ROI, ❌ aucun Brier/calibration, ❌ aucune comparaison à la cote bookmaker, ❌ aucun coût/token chiffré.

---

## 3. Lecture betting (math)

L'accuracy LLM ≈ **probabilité implicite du favori**, donc edge nul :

```
Favori CS2 BO1 typique (#1 vs #25) : cote -160 à -200 → implicite 61.5% à 66.7%
LLM best (claude-sonnet-4)         : 18/28 ≈ 64.3%
→ fair 64.3% vs marché 64.5% : edge -0.2pp, EV -0.3%  (ZÉRO/négatif)
```

**Conclusion betting** : 64% d'accuracy "brut" sonne bien, mais c'est **exactement ce que paie déjà la cote du favori**. Sans battre la proba implicite du marché, **pas d'edge value bet**. Le benchmark ne le teste même pas (pas de devig, pas de ROI) → c'est un benchmark de *prédiction*, pas de *value*.

---

## 4. Avis GM pour PariScore

### Ce que ça VALIDE (notre décision de ce matin)
1. **NO-GO blend confirmé** : on a refusé d'injecter l'AI Scout dans `bayesianBlend` sans backtest Brier. Le benchmark le prouve a posteriori — l'approche n'a **aucune calibration** et **aucun edge mesuré**. Règle CLAUDE.md "pas de prod sans IC" pleinement justifiée.
2. **UI-only correct** : on a positionné l'AI Scout CS2 en **explicabilité** (verdict lisible), pas en source de proba. C'est le seul usage défendable de cette techno selon le benchmark lui-même.
3. **Reasoning models pires** : utile pour notre stack — inutile de payer un modèle "reasoning" coûteux pour l'AI Scout. **Gemini 2.0 Flash** (notre choix) ou deepseek-chat = bon rapport qualité/prix/latence. Validé.

### Ce que ça nous APPREND (edge réel ailleurs)
4. **Le map pool est la vraie mine** : la donnée la plus riche du prompt = winrate/pistol/CT-T par carte. C'est structuré, mesurable, **backtestable** — contrairement au verdict LLM. → conforte le pivot **bo3.gg avg rounds/map** (over/under) trouvé aujourd'hui : marché de **rounds** sur map précise, granulaire, où un modèle Poisson/empirique peut battre la ligne. C'est là qu'est l'edge, pas dans "qui gagne le match".
5. **Pistol round** : le benchmark expose pistol_win% par carte → notre `computePistolIndex` existant est aligné. Piste : marché "1er pistol round" en live trading (déjà noté dans `cs2_hltv_deep_audit.md`).

### Risques rappelés
6. Notre AI Scout dépend de RSS news (HLTV/Dexerto) + enrichment HLTV/bo3 — mêmes sources que le benchmark, **mêmes limites** (CF, fraîcheur). Le verdict LLM reste cosmétique/narratif. Ne JAMAIS le vendre au user comme "proba PariScore" (prompt déjà cadenassé en ce sens).

---

## 5. Recommandation GM

| Sujet | Verdict |
|---|---|
| AI Scout CS2 (livré) | ✅ **Garder UI-only**. Benchmark valide le positionnement explicabilité. Ne pas chercher à le rendre "prédictif officiel". |
| Modèle LLM | ✅ Gemini Flash / deepseek-chat. **Éviter reasoning models** (pires + chers). |
| Edge betting réel | ➡️ **Prioriser bo3.gg avg rounds/map → marché Over/Under rounds** (backtestable, Poisson/empirique). C'est l'edge mesurable, pas le winner LLM. |
| Marché winner CS2 | ⚠️ LLM ≈ favori = pas d'edge. Pour battre le winner, il faut un **modèle calibré devig vs Pinnacle**, pas un LLM. |
| Prochaine étape data | Construire `tools/refresh_bo3_map_rounds.js` (bd ticket ouvert) + backtest Brier over/under avant tout signal BET. |

**Verdict en une ligne** : le benchmark de cieslak est une **confirmation honnête que la prédiction LLM de winner CS2 n'a pas d'edge** — ce qui valide notre AI Scout en mode explicabilité et **redirige l'effort edge vers le marché rounds/map (bo3.gg)**, seul terrain backtestable.

---

*Rapport GM PariScore — analyse benchmark externe. Aucune ligne de code modifiée.*
