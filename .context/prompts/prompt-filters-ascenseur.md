# PariScore — Filtres « ascenseur » multi-choix (championnats + stratégies) pour live & prematch

> Prompt Chef de Projet — généré le 2026-08-15. Chantier UI legacy (pariscore.html/pariscore.js),
> page Matchs (`#page-matchs`), 3 onglets : All / Live / Prematch.

## Contexte

PariScore (Next.js 16 + Bun + server.js ES5 legacy better-sqlite3 + pariscore.html vanilla JS).
La page Matchs possède une « filter console » (`#filter-console`, masquée hors page Matchs)
avec des dropdowns multi-select **`.mls`** (composant maison : `mls-trigger`, `mls-panel`,
`mls-search`, `mls-list`, `mls-opt`, `mls-league`) pour ligues (`#ml-league`) et stratégies
(`#ts-select`), plus une barre rapide `#ps-quick-filters` (pills `.qfb-pill[data-qfb-strat]`).
Trois onglets cohabitent via `activeMatchTab` ('all' | 'live' | 'prematch'), pilotés par
`setMatchTab()` (pariscore.js:10504).

Objectif : transformer ces filtres en **panneaux « ascenseur » (accordéon dépliable)** avec
**sélection multiple**, appliqués **à la fois aux matchs live et aux matchs prematch**
(identiquement sur les 3 onglets), et fonctionnels sur mobile (la console est relocalisée dans
`#mfs-body` via `_mfsRelocate()` pariscore.js:29149).

## Rôle de l'agent : CHEF DE PROJET — orchestration, Gantt, boucle d'ingénierie

Tu es un **chef de projet d'ingénierie**, pas un simple implémenteur. Tu pilotes le projet en
boucle d'ingénierie et tu délègues l'exécution. Tu ne codes pas toi-même les sous-tâches : tu
orchestres, review et valides. **Tu mobilises TOUS les agents, sub-agents et skills à ta
disposition** — la liste ci-dessous est exhaustive des capacités disponibles dans le repo :
aucune sous-tâche ne doit être exécutée par toi-même quand un sub-agent ou skill est plus adapté.

### Boucle d'ingénierie (répéter à chaque itération)
1. **Planifier** : découper le projet en sous-tâches indépendantes et ordonnées (dépendances explicites).
2. **Déléguer** : dispatcher les sous-tâches en parallèle à des sub-agents spécialisés (voir plus bas).
3. **Intégrer** : vérifier l'intégration des livrables (pas de conflit, pas de régression).
4. **Reviewer** : faire relire chaque livrable (revue de code + QA ciblée).
5. **Valider** : appliquer les critères d'acceptation de la section Validation avant de fermer.
6. **Piloter** : mettre à jour le Gantt + les issues `bd` (statut, dates, blocages) et itérer.
Boucles courtes : une sous-tâche = une boucle. Ne jamais avancer 2 boucles sans passer la review.

### Orchestration des agents — UTILISE TOUS les sub-agents opencode disponibles
- `explore` — recherche pré-implantation (structure actuelle de #filter-console, composant .mls,
  flux renderMatches, comportement mobile _mfsRelocate, synchro pills rapides)
- `general` — exécution des sous-tâches isolées (refonte composant, CSS accordéon, état partagé)
- `code-reviewer` — revue systématique avant intégration (correctness, sécurité, perf, conventions)
- `test-engineer` — écriture des scripts de validation (multi-choix, persistance entre onglets,
  comportement live vs prematch, mobile)
- `security-auditor` — audit XSS/`_jsStr()` sur les nouvelles interpolations et handlers
- `web-performance-auditor` — impact rendu (re-render à chaque toggle, debounce, mobile)
Dispatch en parallèle quand les sous-tâches sont indépendantes ; chaque sub-agent reçoit un
contexte minimal et le critère de complétude de SA sous-tâche uniquement.

### Skills à activer — UTILISE TOUS les skills pertinents du repo (liste non exhaustive, à compléter)
- Planification : `writing-plans`, `aos-planning-and-task-breakdown`, `writing-shape`
- Dispatch : `subagent-driven-development`, `dispatching-parallel-agents`
- Exécution : `executing-plans`, `aos-incremental-implementation` (changements atomiques)
- Qualité : `aos-code-review-and-quality`, `requesting-code-review`, `receiving-code-review`,
  `verification-before-completion` (preuve avant « fait »), `aos-doubt-driven-development`
  (adversarial review sur les choix à risque : état partagé onglets, relocalisation mobile)
- Debug : `systematic-debugging` (si bug), `diagnosing-bugs`
- UI/UX : `frontend-design` (direction visuelle accordéon), `ui-ux-pro-max` (a11y, states),
  `accessibility-agents` (ARIA `aria-expanded`, `role=listbox`, focus trap panneau)
- Perf : `performance`, `core-web-vitals` (si impact rendu table)
- Spécifiques repo : `ps-audit`, `ps-test` (QA module), `ps-changelog` (CHANGELOG après livraison)
Charge le skill via l'outil `skill` avant chaque phase concernée ; ne réinvente jamais un pattern
qu'un skill documente.

### Gantt : réaliser ET piloter
1. **Réaliser** : créer `gantt-filters-ascenseur.json` à la racine du repo, format de la convention
   existante (`scripts/gen-gantt-svg.js`) :
   `{ "title": "...", "timeline": { "labels": ["2026-08-15", ...] }, "tracks": [ { "name": "...",
   "items": [ { "label": "...", "start": "2026-08-15", "end": "2026-08-16" } ] } ] }`
   → générer le SVG : `node scripts/gen-gantt-svg.js gantt-filters-ascenseur.json > gantt-filters-ascenseur.svg`
   Tracks proposées : `Recherche & spec`, `Composant accordéon championnats`, `Composant accordéon
   stratégies`, `Application live + prematch`, `Mobile (#mfs-body)`, `QA & validation`,
   `Gantt & pilotage`. Marquer les items avec les classes visuelles existantes
   (item-done, item-critical, item-premium, item-setup) si supportées.
2. **Piloter** : à chaque boucle, mettre à jour le JSON (dates réelles, done/blocked, écarts) et
   régénérer le SVG. En cas de dérive > 1 jour, ré-estimer et ajuster le plan — documenter l'écart.
   Versionner les itérations comme l'historique existant (`gantt-filters-ascenseur-v2.json`, …).
3. Le Gantt est un livrable du projet au même titre que le code : il doit exister dès la 1ère
   boucle et être à jour en fin de session.

### Tracking des sous-tâches (règle repo)
Chaque sous-tâche = une issue `bd` (beads) : `bd create`, `bd update <id> --claim` avant le dispatch,
`bd close <id>` seulement après validation. Pas de TODO list markdown.

### Livrable final de pilotage
En fin de session : rapport court — sous-tâches faites/blocked, écarts Gantt (plan vs réel),
décisions d'arbitrage (réutilisation .mls vs nouveau composant, état partagé, mobile), et issues
`bd` restantes.

## Spécification fonctionnelle

### 1. Filtre championnats — accordéon multi-choix
- Panneau accordéon (dépliable) listant les pays → ligues (structure actuelle : `leaguesByCountry`,
  libellés FR `COUNTRY_FR`, drapeaux), avec **cases à cocher multiples** (pas de radio, pas de mono-select).
- Recherche dans le panneau (existant `mlSearch`), compteur de matchs par ligue (existant `mlMatchCount`).
- Bouton « Toutes les ligues » (reset) conservé ; état « sélection partielle » visuellement distinct.
- L'état sélectionné doit être **partagé entre les onglets Live / Prematch / All** : cocher une ligue
  en Prematch doit filtrer Live à l'identique (même tableau `renderMatches`).

### 2. Filtre stratégies — accordéon multi-choix
- Panneau accordéon **multi-choix** (existant `tsSelect`/`tsToggleStrat` sur `activeStrategies[]`),
  combinable avec le curseur « Degré de Confiance » (`#o25-slider`, `calcTopStrategiesScore`).
- Recherche dans le panneau conservée ; « Toutes stratégies » (reset) conservé.
- Les stratégies cochées restent actives sur les 3 onglets (live + prematch + all).

### 3. Application live + prematch
- Les filtres s'appliquent identiquement sur les onglets **Live**, **Prematch** et **All**
  (le filtrage central dans `renderMatches` ~pariscore.js:14940 filtre déjà par `activeMatchTab`,
  puis par ligues ∪ pays ∪ stratégies — vérifier que chaque branche passe par le même chemin).
- Aucun filtre réservé à un seul onglet. Un changement de filtre déclenche un re-render du tableau
  courant quel que soit l'onglet actif.

### 4. Mobile
- Conserver le relogement de la console dans `#mfs-body` (`_mfsRelocate()`) : les panneaux
  accordéon doivent rester utilisables (scroll interne, hauteur max, fermeture au tap extérieur).

## État existant à réutiliser (ne pas réinventer)
- `pariscore.html` : `#filter-console` (~ligne 13813), `#ml-league`/`#ts-select` (composant `.mls`),
  `#ps-quick-filters` (pills stratégies `.qfb-pill[data-qfb-strat]`).
- `pariscore.js` :
  - État : `activeLeagues[]`, `activeCountries[]`, `activeStrategies[]`, `activeMatchTab`
    ('all'|'live'|'prematch'), `activeLeague` (legacy).
  - Fonctions : `mlToggle/mlFilter/mlPickAll/mlToggleCountry/mlToggleLeague`,
    `tsToggle/tsFilter/tsPickAll/tsToggleStrat`, `setMatchTab()` (10504), `filterLeagueChips()`,
    `renderMatches()` (~14940), `_mfsRelocate()` (~29149), `buildLeagueMS()`.
- Décision d'architecture à trancher en début de chantier (avec justificatif) : étendre le composant
  `.mls` existant pour le rendre accordéon vs créer un composant accordéon dédié — en documentant
  l'impact sur la barre rapide `#ps-quick-filters` (synchro d'état dans les deux sens).

## Contraintes
- Code ES5 legacy dans pariscore.js (pas d'arrow-only, pattern `(async () => {...})()` respecté).
- XSS obligatoire : `_jsStr()` sur toute interpolation utilisateur dans `onclick` (pattern repo).
- Ne pas casser `#ps-quick-filters`, `#day-filter-row`, `#fav-filter-chip`, `#steam-filter-chip`.
- Respecter `STRATEGIES_UI` (clés hardcodées, ne pas inventer de clés).
- Ne pas toucher au backend (`server.js`) sauf besoin justifié explicitement.
- Vérifier `node --check pariscore.js` à chaque sous-tâche.

## Validation
0. **Gantt** : `gantt-filters-ascenseur.json` + `.svg` existants dès la 1ère boucle, à jour
   (items done/blocked, dates réelles) à chaque itération et en fin de session.
1. `node --check pariscore.js` (et `pariscore.html` scripts inline si modifiés).
2. Multi-choix championnats : cocher 3 ligues → seuls les matchs de ces ligues s'affichent ;
   décocher une ligue → mise à jour immédiate ; « Toutes les ligues » → reset.
3. Multi-choix stratégies : cocher 2 stratégies + confiance 50% → tableau filtré par score
   combiné (`calcTopStrategiesScore`) ; décocher → mise à jour immédiate.
4. **Live = Prematch** : avec les mêmes sélections, basculer All → Live → Prematch : le filtre
   reste appliqué et les compteurs/tableaux reflètent chaque onglet sans reset de sélection.
5. Mobile (viewport < 768px ou émulateur) : la console relogée dans `#mfs-body` garde les panneaux
   accordéon ouverts/fermables, scroll interne OK, pas de débordement horizontal.
6. Accessibilité : `aria-expanded` sur les triggers, `role=listbox`/`aria-selected` sur les options,
   navigation clavier du panneau (Escape ferme).
7. Chaque sous-tâche relue par un sub-agent (code-reviewer ou test-engineer) avant `bd close`.
8. `bun run lint` si applicable au changement.