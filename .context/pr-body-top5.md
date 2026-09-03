# Filtre « Gagnant » Top5 Foot & Tennis

## Résumé

Nouvelle métrique « 🏆 Gagnant prédit » dans les widgets Top5 matchs foot et tennis, classée par **confiance du modèle** (pas d'edge vs cotes — zéro dépendance marché) :

- **Foot** → Dixon-Coles 1X2 sur λH/λA forme L5 BSD domicile/extérieur ; pick = max(P_dom, P_ext) en % ; match écarté si nul modal ≥ pick ou sans forme L5 exploitable ; cap proba 1/1.15 comme les autres clés probabilistes.
- **Tennis** → probabilité du vainqueur issue du blend existant `engine.ts` (Élo-surface .55/.45 + forme .20 + H2H .10, playerA = favori par construction) ; exclusions `synthetic` / `insufficientData` ; tri générique par écart décroissant = classement par confiance.

## Fondements académiques

Kovalchik 2016 (Élo dominent), Dryja 2025 (Élo par surface n°1), Sipko & Knottenbelt 2015, Maher 1982 / Dixon & Coles 1997 (1X2 Poisson + ρ bas-scores). Détails dans la spec.

## Tests & gates

- `bun test tests/top5-gagnant.spec.ts` : **8/8 pass** (21 expect) — invariants Σ1X2=100, exclusion nul modal/λ=0, tri confiance desc, pick homogène home/away, auto-wire tennis, régression surfaceElo intacte.
- `tsc --noEmit` : **PASS**
- `eslint` scopé 4 fichiers modifiés : **0 error / 1 warning** (« File ignored » sur le spec de tests — pattern attendu)

## Commits

- `docs(top5)` spec et plan filtre gagnant
- `feat(top5)` filtre gagnant Dixon-Coles au top5 foot
- `feat(top5)` metrique gagnant confiance modele tennis
- `feat(top5)` entree gagnant au widget top5 foot
- `docs(context)` trace boucle top5-gagnant gates et cloture

## Références

- Spec : `docs/superpowers/specs/2026-08-27-top5-gagnant-design.md`
- Trace boucle : `.context/session-top5-gagnant.md`
- Backtest strip : dégradation gracieuse « Aucune donnée » jusqu'à accumulation d'historique par le settle quotidien existant.
