# 🐛 BUG REPORT — Prédictions Football (Enrichissement v1)

**Date** : 01/08/2026  
**Auditeur** : Lead QA + Code Reviewer + Architecte Frontend/Data  
**Périmètre** : `FootballMatchCard`, `football-predictions.ts`, `football-tab-content.tsx`, `football-data.ts`

---

## Tableau de Recette

| ID | Composant / Route | Description du Bug / Vulnérabilité | Sévérité | Statut | Correctif Apporté |
|----|-------------------|-------------------------------------|----------|--------|-------------------|
| **BUG-01** | `football-predictions.ts` → `computeDoubleChance` | **Absence de clamp supérieur** : si le modèle produit `homeProb + drawProb > 100` (ex: 70+40), la probabilité DC retournée dépasse 100% (ex: 110). Contredit l'invariant « toute probabilité ∈ [0, 100] ». | 🔴 Critique | ✅ Fixé | Ajout de `Math.min(100, ...)` sur le retour. |
| **BUG-02** | `football-predictions.ts` → `enrichPrediction` | **`computeUnder35` sans fallback modèle** : appelée avec `undefined` en 2ᵉ argument, donc si BSD n'a pas `odds_under_25`, retourne systématiquement 0 au lieu d'utiliser la valeur du modèle (`over25Prob` inversé). | 🟠 Élevée | ✅ Fixé | Passage de `prediction.over25Prob` en fallback (inversé : `100 - over25Prob` comme proxy under). |
| **BUG-03** | `football-match-card.tsx` → Comparatifs | **Clé React non stable** : utilisation de l'index `i` comme `key` dans `teamComparisons.map`. Si deux catégories ont le même index entre re-renders, React recycle le mauvais DOM. | 🟡 Moyenne | ✅ Fixé | Changé pour `key={comp.label}` (labels uniques : "Corners", "Tirs cadrés", etc.). |
| **BUG-04** | `football-match-card.tsx` → Badges | **Débordement sur mobile ≤375px** : les badges comme `DC 1X (85%)` avec `px-2` + icône peuvent déborder sur écrans <375px. `max-w-full` sur le conteneur parent ne suffit pas sans `overflow-hidden` sur le wrapper badges. | 🟡 Moyenne | ✅ Fixé | Ajout de `max-w-[calc(100vw-2rem)]` et `overflow-x-auto` avec `flex-nowrap` par défaut sur mobile, `flex-wrap` sur `sm+`. |
| **BUG-05** | `football-match-card.tsx` → Footer | **Duplication BTTS/O2.5** : les probabilités BTTS et Over 2.5 apparaissent à la fois dans les badges « Prédictions Clés » et dans le footer, créant une redondance visuelle qui dilue l'information. | 🟢 Mineure | ✅ Fixé | Suppression de la section footer legacy (BTTS/O2.5) — l'info est déjà dans les badges prédictions. Conservé le bouton « Analyse ». |
| **BUG-06** | `football-predictions.ts` → `computeCornerOver` | **Fallback coins live absents** : `homeCorners ?? 0` en l'absence de `live_stats` force `lambda = LEAGUE_AVG_CORNERS` (10), ce qui donne des probabilités identiques pour tous les matchs sans stats live. Pas critique mais nuit à la personnalisation. | 🟢 Mineure | ✅ Documenté | Le fallback par ligue est correct (moyenne 10 corners pour le top 5). Amélioration future : utiliser la moyenne historique par équipe depuis la DB. |

---

## ✅ Validations Croisées

| Check | Résultat |
|-------|----------|
| Toutes les probabilités ∈ [0, 100] | ✅ Confirmé après fix BUG-01 |
| `tabular-nums` sur tous les chiffres/ pourcentages | ✅ Confirmé (badges, comparatifs, odds, scores) |
| Contraste Dark Mode (`#0a0e17` / `#111827`) | ✅ Badges émeraude sur fond sombre → ratio > 4.5:1 |
| Cohérence Over Corners (seuil ≥ 65%) | ✅ Algorithme correct — choisit la ligne ≥65% la plus proche |
| Gestion fallbacks (corners, fautes, cartons absents) | ✅ 55/45 par défaut, données live prioritaires |
| TypeScript strict | ✅ `tsc --noEmit` passe |
| Tests unitaires (31 tests) | ✅ Tous passent après correctifs |

---

## 📊 Métriques de Qualité

- **Bugs critiques corrigés** : 1 (BUG-01)
- **Bugs élevés corrigés** : 1 (BUG-02)
- **Bugs moyens corrigés** : 2 (BUG-03, BUG-04)
- **Bugs mineurs corrigés/documentés** : 2 (BUG-05, BUG-06)
- **Taux de couverture de tests** : 31 tests / 6 fonctions exportées
- **Innovations livrées** : 3 (Top Confiance, Quick Filters, Radar Micro-Analysis)
