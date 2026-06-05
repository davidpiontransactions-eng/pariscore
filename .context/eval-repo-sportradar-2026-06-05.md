# Éval Repo — api-evangelist/sportradar vs PariScore

**Date** : 2026-06-05
**Évaluateur** : GM/CTO PariScore
**Repo cible** : https://github.com/api-evangelist/sportradar
**Verdict** : ❌ **NO-GO** (pas un modèle — catalogue de specs API commerciale)

---

## 1. Ce qu'est le repo (verbatim)

> "This is an **API specification and documentation repository** for Sportradar's sports data APIs. It contains structured metadata, schemas, and documentation **rather than executable code or ML models**."

> Sportradar = "the world's leading sports technology company, providing comprehensive sports data APIs delivering real-time scores, statistics, **odds**, and content for over 80 sports and 500 leagues worldwide."

**Traduction** : repo maintenu par Kin Lane (API Evangelist) qui **indexe/documente** les API commerciales de Sportradar (OpenAPI, JSON Schema, json-ld, vocabulary, rate-limits, pricing plans). C'est de la **méta-doc**, pas un produit, pas un modèle.

---

## 2. Extraction (modèle / features / data / métriques)

| Champ attendu | Trouvé |
|---|---|
| **Modèle / algo** | ❌ AUCUN. Que des fichiers YAML/JSON/Markdown (`openapi/`, `json-schema/`, `vocabulary/`, `rules/` Spectral). Zéro Python/JS exécutable, zéro layer/loss/optimizer. |
| **Features / target** | ❌ N/A. Pas de prédiction. |
| **Données** | Aucune donnée livrée — le repo **décrit** l'API payante Sportradar (NBA, NFL, Soccer, Odds, Sports Data). L'accès réel = abonnement entreprise Sportradar (pricing à 4-5 chiffres/mois). |
| **Métriques** (accuracy/Brier/ROI/calibration) | ❌ AUCUNE. Rien à calibrer. |
| **Stack** | YAML / JSON / Markdown (config + doc). Pas d'app. |
| **Licence** | ❌ **Non spécifiée** → all-rights-reserved par défaut (flag legal mineur, mais moot car rien à incorporer). |

---

## 3. Analyse vs PariScore

| Critère | Verdict |
|---|---|
| **Edge marché réel** | ❌ Néant. Aucun modèle, aucune proba. Sportradar fournit des `odds` = **cotes bookmaker en entrée** → si un jour on plugait leur feed odds dans un modèle, circulaire (pas de value). |
| **Calibration / UQD** | ❌ N/A. |
| **Redondance vs existant** | 🔴 Forte au niveau *source data* : Sportradar = scores/stats/odds live. On couvre déjà via **BSD (WS push, $5/mo)** + ESPN + Odds API + Wikidata. Sportradar enterprise = doublon ultra-cher. |
| **Features inédites** | ❌ Aucune feature pour `buildMatchRecord`. |
| **Compat stack** | ⚠️ Intégrer Sportradar = nouvelle source payante + auth OAuth + quotas. Coût/bénéfice nul vs sources actuelles. |
| **Légalité** | Repo sans licence (mineur). Sportradar API elle-même = ToS entreprise stricte. |
| **Leçons passées** | Confirme : repos externes off-mission n'apportent rien. Ici = doc d'un fournisseur qu'on n'a aucune raison d'adopter. |

---

## 4. Recommandation GM — ❌ NO-GO

1. **Rien à incorporer** : repo = collection d'OpenAPI/JSON Schema documentant l'API Sportradar. Pas de code, pas de modèle, pas de dataset téléchargeable. `/eval-repo` cherche des modèles tennis/foot/ML — cible inadéquate.
2. **Source redondante et chère** : même *si* on visait l'API Sportradar derrière, elle duplique BSD+ESPN+Odds API (déjà en prod, $5/mo) à un coût entreprise hors-budget. Aucun edge incrémental.
3. **Odds en entrée = circulaire** : le seul "plus" Sportradar (feed odds) tomberait dans le piège value-bet circulaire qu'on évite par règle.

**Idée à voler (0 code)** : les fichiers `json-schema/` et `vocabulary/` pourraient servir de **référence de normalisation** si jamais on standardisait nos schémas internes de matchs (noms de marchés, codes sports). Valeur marginale, pas une incorporation. Backlog P3 si besoin de référentiel.

**Effort** : N/A — rien à intégrer.

---

Attente : ton GO/NO-GO.
