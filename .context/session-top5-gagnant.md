# Boucle ingénierie — Filtre « Gagnant » Top5 Foot & Tennis

**Date début** : 2026-08-27 · **Spec** : `docs/superpowers/specs/2026-08-27-top5-gagnant-design.md`
**Mode** : boucle d'ingénierie complète (brainstorming ✔ approuvé → TDD → gates verts)

## [Iter-0] Recherche & contexte

- Sources lues en ligne : Kovalchik 2016 (JQAS — méta-analyse 11 modèles tennis),
  Hubáček 2019 (GBT football), Hvattum & Arntzen 2010 (Élo football),
  Dixon-Coles 1997 (correction bas-scores), Dryja 2025 & Willekes 2022
  (déjà synthétisées dans `TENNIS_SIDEBAR_DEBUG.md` Iter-0).
- Note méthode : plusieurs URLs académiques bloquées/bot-walled (De Gruyter, DDG captcha,
  arXiv IDs erronés trouvés via fetch direct, Semantic Scholar 429) — verdicts croisés
  par résumés archi-connus des papiers clés + synthèses déjà présentes dans le repo.
- Cartographie codebase :
  - `src/lib/tennis-top5.ts` (7 métriques, builder pur, tri par écart décroissant)
  - `src/lib/football-strategy-top5.ts` (12 stratégies, λ L5, cap 87 %)
  - `src/lib/prediction/engine.ts` (blend tennis : Élo-surface .55/.45 + forme .20 + H2H .10)
  - `src/lib/prediction/football/dixon-coles.ts` (matrice DC + marchés 1X2 — jamais branché Top5)
  - Routes API `/api/{tennis,football}/top5` + widgets sidebar (Select shadcn)
  - Backtest strip tolérant aux clés sans historique (dégradation gracieuse vérifiée).
- Décision produit validée : classement par **confiance modèle** (pas edge vs cotes).

## [Iter-1] Plan micro-tâches & branche

- Branche : `feat/top5-gagnant` (trunk-based, PR contre main).
- Ordre TDD : specs rouges (foot DC gagnant → tennis builder → UI keys) → implémentation minimale → vert.
