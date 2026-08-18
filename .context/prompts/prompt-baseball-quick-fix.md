# Restauration cotes rapides Baseball : Winner / O/U / Handicap sur les cards

> Prompt généré le 2026-08-14 après analyse réelle du pipeline
> `src/lib/baseball/` (cause identifiée : commit `6b34c5e1` qui a ajouté un verrou
> `statsAvailable` — comportement d'origine en `9208bf93`).

## Contexte
PariScore (Next.js 16 + Bun). Onglet Baseball = pipeline sabermétrique Monte Carlo
(`src/lib/baseball/`). Les cards (`BaseballMatchCard.tsx`) affichent des chips de cotes
rapides : **O/U (line + over prob), Total attendu, ✓ Over/Under · conf** — et le winner via
la modal d'analyse.

Problème produit : depuis le commit `6b34c5e1`, quand les stats de saison d'un lanceur
partant sont absentes (`statsAvailable=false`), les cards affichent
« Cotes indisponibles — partants incomplets » et la modal affiche
« Stats saison d'un lanceur partant indisponibles — le moteur ne prédit que sur des
données réelles. ».

**L'utilisateur ne joue que Winner, Over/Under runs et Handicap — il n'a pas besoin des
données de lanceur.** Objectif : supprimer ce blocage et restaurer le comportement
d'origine (commit `9208bf93`), où la prédiction rapide était calculée dès que les deux
partants étaient annoncés, sans exigence de stats de saison.

## Rôle de l'agent : CHEF DE PROJET — orchestration, Gantt, boucle d'ingénierie

Tu es un **chef de projet d'ingénierie**, pas un simple implémenteur. Tu pilotes le projet en
boucle d'ingénierie et tu délègues l'exécution. Tu ne codes pas toi-même les sous-tâches : tu
orchestres, review et valides. (Pour ce fix, le périmètre est volontairement réduit : 1 fichier
source à modifier — la boucle reste la même, mais courte.)

### Boucle d'ingénierie (répéter à chaque itération)
1. **Planifier** : découper le projet en sous-tâches indépendantes et ordonnées (dépendances explicites).
2. **Déléguer** : dispatcher les sous-tâches en parallèle à des sub-agents spécialisés (voir plus bas).
3. **Intégrer** : vérifier l'intégration des livrables (pas de conflit, pas de régression).
4. **Reviewer** : faire relire chaque livrable (revue de code + QA ciblée).
5. **Valider** : appliquer les critères d'acceptation de la section Validation avant de fermer.
6. **Piloter** : mettre à jour le Gantt + les issues `bd` (statut, dates, blocages) et itérer.
Boucles courtes : une sous-tâche = une boucle. Ne jamais avancer 2 boucles sans passer la review.

### Orchestration des agents (sub-agents opencode disponibles)
- `explore` — recherche pré-implantation (vérifier qu'aucun autre composant ne référence le message)
- `general` — exécution des sous-tâches isolées (modifs provider, tests, validation)
- `code-reviewer` — revue systématique avant intégration (correctness, régression, conventions)
- `test-engineer` — écriture/vérification des tests (moteur, provider)
- `web-performance-auditor` — impact cache (le hash de prédiction ne change pas : pas de re-calcul massif)
Dispatch en parallèle quand les sous-tâches sont indépendantes ; chaque sub-agent reçoit un
contexte minimal et le critère de complétude de SA sous-tâche uniquement.

### Skills à activer (présents dans le repo)
`writing-plans` (découpage avant code), `subagent-driven-development` / `dispatching-parallel-agents`
(dispatch), `executing-plans` (exécution pas-à-pas), `aos-incremental-implementation` (changements
atomiques), `aos-code-review-and-quality` / `requesting-code-review` (gate de qualité),
`verification-before-completion` (preuve avant "fait"), `aos-doubt-driven-development` (adversarial
review : vérifier que le moteur ne peut pas produire de NaN avec des stats null),
`systematic-debugging` (si un test échoue).

### Gantt : réaliser ET piloter
1. **Réaliser** : créer `gantt-baseball-quick-fix.json` à la racine du repo, format de la convention
   existante (`scripts/gen-gantt-svg.js`) :
   `{ "title": "...", "timeline": { "labels": ["2026-08-14", ...] }, "tracks": [ { "name": "...",
   "items": [ { "label": "...", "start": "2026-08-14", "end": "2026-08-14" } ] } ] }`
   → générer le SVG : `node scripts/gen-gantt-svg.js gantt-baseball-quick-fix.json > gantt-baseball-quick-fix.svg`
   Tracks proposées : `Analyse & spec`, `Provider (suppression verrous)`, `UI vérification`,
   `QA & validation`, `Gantt & pilotage`.
2. **Piloter** : à chaque boucle, mettre à jour le JSON (dates réelles, done/blocked, écarts) et
   régénérer le SVG. En cas de dérive > 1 jour, ré-estimer et ajuster le plan — documenter l'écart.
3. Le Gantt est un livrable du projet au même titre que le code : il doit exister dès la 1ère
   boucle et être à jour en fin de session.

### Tracking des sous-tâches (règle repo)
Chaque sous-tâche = une issue `bd` (beads) : `bd create`, `bd update <id> --claim` avant le dispatch,
`bd close <id>` seulement après validation. Pas de TODO list markdown.

### Livrable final de pilotage
En fin de session : rapport court — sous-tâches faites/blocked, écarts Gantt (plan vs réel),
décisions d'arbitrage, et issues `bd` restantes.

## Modifications (2 points dans `src/lib/baseball/data/provider.ts`)

1. **`computeQuickForMatch()` (~lignes 119-137)** — supprimer l'early-return stats-unavailable :
   - Supprimer le bloc `if (!homePitcher.statsAvailable || !awayPitcher.statsAvailable) { return { ...match, quick: null }; }`
   - **GARDER** le garde `if (!homePitcher || !awayPitcher) return match;` (partant inconnu = pas de
     prédiction, inchangé).
   - Résultat : la prédiction rapide (O/U line, over prob, expected total, winner) est toujours
     calculée dès que les deux partants sont annoncés → les chips « O/U », « Total attendu » et
     « ✓ Over/Under · conf » réapparaissent sur `BaseballMatchCard.tsx`.

2. **Constructeur de détails (~lignes 332-341)** — supprimer la branche stats-unavailable :
   - Supprimer `if (!homePitcher.statsAvailable || !awayPitcher.statsAvailable) { prediction = null;
     predictionBlockedReason = "Stats saison d'un lanceur partant indisponibles — le moteur ne
     prédit que sur des données réelles."; }`
   - Restaurer la structure d'origine (`git show 9208bf93:src/lib/baseball/data/provider.ts`) :
     `if (homePitcher && awayPitcher && game.status !== "final") { ... prediction = cachedPrediction(...) }`
   - **GARDER inchangés** les deux autres messages : « Match terminé — le moteur ne prédit que les
     matchs à venir. » et « Un des lanceurs partants n'est pas encore annoncé — le moteur attend la
     confirmation des deux partants. »

## Pourquoi c'est sûr
- Le moteur (`src/lib/baseball/engine/baseball-predictive-engine.ts`, `buildBatterProfile`) retombe
  déjà sur les moyennes de ligue via `?? p.ops`, `?? p.k9`, `?? p.bb9`, `?? p.hr9` (shrinkage
  bayésien) — aucune NaN possible avec des stats null.
- Test unitaire existant qui le prouve : `src/lib/baseball/engine/baseball-predictive-engine.test.ts:75`
  (« opsAgainst lanceur absent → repli sur la moyenne de ligue (aucune NaN) »).
- Le `predictionBlockedReason` est affiché dans `BaseballMatchAnalysisModal.tsx` (lignes 518-538) :
  une fois null, la modal revient à l'affichage normal des prédictions (winner, O/U, handicap).
- Le champ `statsAvailable` reste utilisé par l'UI des badges lanceurs (`PitcherBadge.tsx`, affichage
  « — ») : ne pas le supprimer.

## Pièges connus
- Vérifier par `grep` que le message « lanceur partant indisponibles » n'est référencé nulle part
  ailleurs après suppression (grep "lanceur partant indisponibles" sur le repo).
- Ne pas toucher au moteur, aux seeds curés (`curated-provider.ts`), ni au message « partant non annoncé ».
- `quick: null` reste légitime dans `curated-provider.ts:172` (slate sans partants) : ne pas modifier.
- Ne pas casser le cache : `predictionInputHash` ne dépend pas de `statsAvailable`, donc le cache
  existant reste valide — aucun re-calcul massif attendu.
- Fichiers TypeScript : suivre les conventions repo (commentaires FR, camelCase).

## Validation
0. **Gantt** : `gantt-baseball-quick-fix.json` + `.svg` existants dès la 1ère boucle, à jour
   (items done/blocked, dates réelles) à chaque itération et en fin de session.
1. `bun run typecheck` et `bun run lint` → 0 erreur.
2. `bun test src/lib/baseball/engine/baseball-predictive-engine.test.ts` → vert.
3. Manuel : `bun run dev`, onglet Baseball → les cards avec partants annoncés affichent à nouveau
   les chips O/U (over/under runs) + winner + handicap ; plus aucun message « Stats saison d'un
   lanceur... » ; la modal d'analyse montre les prédictions (verdict, moteur) normalement.
4. Cas inchangés à vérifier : partant non annoncé → « Cotes indisponibles — partants incomplets »
   sur la card ; match terminé → « Match terminé ».
5. Chaque sous-tâche relue par un sub-agent (code-reviewer ou test-engineer) avant `bd close`.
