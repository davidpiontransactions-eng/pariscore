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

- Branche : `feat/top5-gagnant` créée depuis main (`a34fc217`).
- Ordre TDD : specs rouges (foot DC gagnant → tennis builder) → implémentation minimale → vert.
- Commit docs : `28a03d69 docs(top5): spec et plan filtre gagnant`.

## [Iter-2] Foot — boucle RED→GREEN

**RED** (tests avant code, `tests/top5-gagnant.spec.ts`) : 4/4 fail
(`strategies.gagnant` undefined) — reproduction du manque ✓.

**Deux causes racines diagnostiquées pendant la phase verte** :
1. `dixonColesMarkets()` retourne des **pourcentages** (Σ1X2 = 100), pas des fractions —
   détecté par sonde temporaire (`DC(1.4,1.1): 44.44/25.37/30.19`). Le premier jet
   multipliait encore ×100 ⇒ valeurs absurdement hautes ⇒ filtrées par le cap 87 %.
   Corrigé sans conversion ; test d'invariant ajusté (Σ=100).
2. Dataset de test : `home_team_obj.id` régénéré à chaque fixture fini ⇒ le store BSD
   voyait chaque match comme une équipe différente (n=1 < MIN_PLAYED=2) ⇒ forme nulle
   pour TOUTES les stratégies (y compris bestTeam, preuve que l'exclusion venait des
   fixtures et pas du code gagnant). Fix : `fid(nom)` = id stable par nom d'équipe,
   partagé entre `fixture()` (planifié) et `fini()` (historique).

**Implémentation minimale** (`src/lib/football-strategy-top5.ts`, 6 edits) : import DC,
clé `"gagnant"` (union + HIGHER_BETTER=true + PROBABILISTIC_KEYS pour cap 1/1.15),
branche dédiée dans la boucle principale (garde `!form → skip` ; skip si nul modal ;
value = max(P_dom,P_ext) en %), cas exhaustif TS dans scoreMatch (jamais atteint,
même pattern que edgeOU25).

**GREEN** : 8 expect, 4/4 pass — dont exclusion λ=0 (nul modal) et sans-forme.
Commit : `d5daf224 feat(top5): filtre gagnant Dixon-Coles au top5 foot`.

## [Iter-3] Tennis — boucle RED→GREEN

**RED** : déf absente ⇒ 3 fail (auto-wire, tri confiance, exclusions) ; régression
surfaceElo verte dès le départ.

**Implémentation minimale** (`src/lib/tennis-top5.ts`, 3 edits) : clé `"gagnant"` en fin
d'union ; def `{emoji:🏆, isProb:true, format:pct1, source:"match"}` ; branche builder
avant le test leaderboard lisant `m.probA/m.probB` avec garde unique
`fiable = !synthetic && !insufficientData`. Pick = "A" par construction du type
(playerA = favori, probA > 50) ; le tri générique par |diff| décroissant classe par
confiance sans modification.

**GREEN** : 8/8 pass (foot+tennis).
Commit : `951397ea feat(top5): métrique gagnant confiance modèle tennis`.

## [Iter-4] UI + quality gates

- Widget foot : entrée `🏆 Gagnant prédit (Dixon-Coles)` appender après over65Corners
  (position finale = zéro changement de comportement par défaut, bestTeam reste le
  premier écran). Tennis : aucun edit widget — auto-wire via TENNIS_TOP5_METRICS ;
  défaut local inchangé (`useState("surfaceElo")`).
- Backtest strip : tolérance clé sans historique déjà vérifiée (« Aucune donnée »).
- Sélection Top5 (panel/store) : formatage `%` automatique via def.isProb.

**Constat environnemental gates** : la machine met >10 min au full-scope
(`eslint src scripts public packages`) et tout spawn bunx/tsc reste bloqué façon
« cold start » (logs à 0 octet, process vivants 39–650 Mo). Contournements essayés :
bun run → Start-Process bg + logs → binaires directs `.node_modules\.bin\*.cmd`.
Décision : laisser tourner les runners bg (eslint scopé 4 fichiers + tsc --noEmit)
et poller les marqueurs `.done` ; résultat tracé ci-dessous dès completion.

[Session reprise — Iter-4 clôturé]

## [Iter-4bis] Gates collectées & nettoyage

- **tsc --noEmit : PASS** (`gate-tsc.exitcode=0`) — couvre l'arbre courant (edit widget
  15:18 < run tsc 15:25).
- **eslint scopé 4 fichiers : 0 error, 1 warning** — warning « File ignored because of a
  matching ignore pattern » sur `tests/top5-gagnant.spec.ts` (pattern `tests/` attendu,
  pas un défaut de code). Exit 3 du runner bg = conséquence du warning, pas d'erreur.
  Durée 116 s.
- **bun test tests/top5-gagnant.spec.ts : 8/8 pass** (21 expect, ~1,4 s),
  re-exécuté à la reprise de session.
- Nettoyage des artefacts de contournement machine lente : `gate-lint{,2,3}.log`,
  `.elapsed`, `.exitcode`, `gate-tsc.{log,exitcode}`, `g-lint.exitcode`,
  `scripts/tmp-gate-*.ps1`.
- Lint/tsc full-scope (`bun run lint` packages complets) non relancés : >10 min cold start
  bloquant sur cette machine — verdict porté par les artefacts scopés ci-dessus.

**Statut boucle : terminée.** Foot (DC gagnant) + tennis (confiance blend) + UI widgets +
tests verts + gates vertes.

