# Spec — Filtre « Gagnant » Top5 Foot & Tennis

**Date** : 2026-08-27 · **Statut** : approuvé (plan mode 27/08/2026)
**Demande** : ajouter un filtre « Gagnant » dans les widgets Top5 matchs foot & tennis qui
désigne le vainqueur prédit par le meilleur modèle, classé par confiance du modèle.

## 1. Fondement littéraire

Sources (revues, thèses, essais) :

| Domaine | Source | Verdict repris |
|---|---|---|
| Tennis | Kovalchik 2016, *JQAS* (comparaison 11 modèles ATP/WTA) | Les modèles à base d'Élo dominent rankings et régressions (~70 % acc., meilleure calibration) |
| Tennis | Dryja 2025, VU Amsterdam | Recommandation n°1 : Élo **par surface** ; RF ≈ 76,4 % ≈ bookmakers ; composites srv×ret, momentum utiles mais secondaires |
| Tennis | Sipko & Knottenbelt 2015 | Élo pair-wise + NN sur stats service ≈ 64–66 % ; stats service ≈ marginal au-delà de l'Élo |
| Tennis | Willekes 2022 (SHAP) | Cotes dominantes puis stats service → l'*edge vs cotes* reste hors périmètre du filtre « Gagnant » |
| Foot | Maher 1982 ; Dixon & Coles 1997 | Poisson attaque/défense + correction bas-scores ρ + home advantage = standard académique pour P(1X2) sans cotes |
| Foot | Hvattum & Arntzen 2010 ; Goddard 2005 | Ratings Élo compétitifs (~52–55 %) ; combiner modèle-buts + rating améliore l'ajustement |
| Foot | Hubáček, Šourek & Železný 2019 (GBT relationnel) | Plafond ≈ bookmakers ; features relationnelles approchent ce plafond |

**Décision modèle** :
- **Tennis** → probabilité du vainqueur issue du blend existant `src/lib/prediction/engine.ts`
  (Élo-surface pondéré + Élo global + forme decay + H2H, IC bootstrap) — consensuel
  Kovalchik+Dryja, déjà calculé dans `TennisMatch.probA/probB` (playerA = favori).
- **Foot** → **Dixon-Coles 1X2** (`src/lib/prediction/football/dixon-coles.ts`) sur λH/λA
  estimés depuis la forme L5 BSD domicile/extérieur (mêmes λ que O/U/BTTS).

## 2. Critère de classement (validé utilisateur)

Classement par **confiance du modèle** : les 5 matchs où P(victoire du gagnant prédit)
est la plus haute d'abord. Pas de dépendance aux cotes.

## 3. Comportement fonctionnel

### Foot — stratégie `"gagnant"`
- Nouvelle clé dans `StrategyTop5Key` + `HIGHER_BETTER["gagnant"] = true`
  + membre de `PROBABILISTIC_KEYS` (cap proba 1/1.15 appliqué comme les autres clés probabilistes).
- Scoring : λH/λA depuis forme L5 (identique à over15/under35/bttsYes) →
  `dixonColesMarkets(λH, λA)` → `pick = max(P_homeWin, P_awayWin)`.
- **Match écarté si P(draw) ≥ pick** : pas de gagnant fiable → pas listé.
- Sans forme L5 exploitable : match écarté (pas de repli cotes — zéro dépendance marché).
- Widget : entrée `{ key:"gagnant", label:"Gagnant prédit (Dixon-Coles)", emoji:"🏆", isProb:true }`.

### Tennis — métrique `"gagnant"`
- Nouvelle def dans `TENNIS_TOP5_METRICS` :
  `{ key:"gagnant", label:"Gagnant prédit par le modèle", emoji:"🏆", isProb:true, format:pct1, source:"match" }`.
- Dans `buildTennisTop5`, branche spéciale : `va=m.probA`, `vb=m.probB`
  (playerA = favori par construction du type), **exclut** `m.synthetic` et `m.insufficientData`.
- Tri générique par écart décroissant = classement par confiance (probA élevé ⇒ écart grand).

### Backtest
`Top5BacktestStrip(strategyKey="gagnant")` → dégradation gracieuse (« Aucune donnée »)
jusqu'à accumulation d'historique par le settle quotidien existant.

## 4. Non-objectifs (yagni)

- Pas de decay temporel ξ Dixon-Coles (fenêtre L5 tronque déjà la récence ; backtestable plus tard).
- Pas de nouveau moteur unifié, pas de nouvelle dépendance.
- Pas de modification des stratégies/métriques existantes.

## 5. Tests (bun:test, `tests/top5-gagnant.spec.ts`)

Foot :
1. ΣP(home)+P(draw)+P(away) ≈ 1 pour tout fixture scorable.
2. Match avec nul modal écarté.
3. Tri desc par proba du pick ; cap >87 % appliqué.
4. Pick homogène (home/away uniquement).

Tennis :
5. `synthetic` / `insufficientData` exclus.
6. Pick = côté favori (value = max proba), format %.
7. Classement desc par confiance (|probA−probB|).
