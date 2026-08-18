# Enrichissement PariScore : Stats de saison précédente par équipe (modèle fcstats.com)

> Prompt généré le 2026-08-14 après analyse réelle de
> https://fcstats.com/club,statistics,galatasaray,632,90513.php
> (page Cloudflare-protégée, récupérée via Scrapling StealthyFetcher → `fcstats_galatasaray.html`
> à la racine du repo, à analyser avant de coder).

## Contexte
PariScore (Next.js 16 + Bun + server.js ES5 legacy better-sqlite3 + pariscore.html vanilla JS).
Aujourd'hui, cliquer sur une équipe ouvre `openTeamDetail()` (pariscore.js:12949) → modal basique
via `GET /api/v1/team/:id` (server.js:34028, bsdGetTeamDetail server.js:3579) : logo, nom, ligue,
pays, stade, fondation, capacité, coach, 5 derniers matchs. **Aucune stats de saison passée.**

Objectif : ajouter pour TOUTE équipe des ligues couvertes les statistiques des 2 saisons précédentes
(ex: 2025/2026 et 2024/2025 pour la Süper Lig 2026/2027 qui commence), en s'inspirant de la page
fcstats Galatasaray (7 sections analysées : General statistics, Comparative table, Sequences,
Streaks, Recent matches, Challenge table, Records — toutes avec tabs All/Home/Away).

## Rôle de l'agent : CHEF DE PROJET — orchestration, Gantt, boucle d'ingénierie

Tu es un **chef de projet d'ingénierie**, pas un simple implémenteur. Tu pilotes le projet en
boucle d'ingénierie et tu délègues l'exécution. Tu ne code pas toi-même les sous-tâches : tu
orchestres, review et valides.

### Boucle d'ingénierie (répéter à chaque itération)
1. **Planifier** : découper le projet en sous-tâches indépendantes et ordonnées (dépendances explicites).
2. **Déléguer** : dispatcher les sous-tâches en parallèle à des sub-agents spécialisés (voir plus bas).
3. **Intégrer** : vérifier l'intégration des livrables (pas de conflit, pas de régression).
4. **Reviewer** : faire relire chaque livrable (revue de code + QA ciblée).
5. **Valider** : appliquer les critères d'acceptation de la section Validation avant de fermer.
6. **Piloter** : mettre à jour le Gantt + les issues `bd` (statut, dates, blocages) et itérer.
Boucles courtes : une sous-tâche = une boucle. Ne jamais avancer 2 boucles sans passer la review.

### Orchestration des agents (sub-agents opencode disponibles)
- `explore` — recherche pré-implantation (structure HTML fcstats, routes existantes, mappings équipes)
- `general` — exécution des sous-tâches isolées (route API, calculs streaks/records, UI, cache)
- `code-reviewer` — revue systématique avant intégration (correctness, sécurité, perf, conventions)
- `test-engineer` — écriture des tests/scripts de validation des calculs (over 2.5, BTTS, streaks)
- `security-auditor` — audit XSS/`_jsStr()` et exposition de la nouvelle route
- `web-performance-auditor` — cache, latence, pré-chauffage
Dispatch en parallèle quand les sous-tâches sont indépendantes ; chaque sub-agent reçoit un
contexte minimal et le critère de complétude de SA sous-tâche uniquement.

### Skills à activer (présents dans le repo)
`writing-plans` (découpage avant code), `aos-planning-and-task-breakdown` (décomposition),
`subagent-driven-development` / `dispatching-parallel-agents` (dispatch),
`executing-plans` (exécution pas-à-pas), `aos-incremental-implementation` (changements atomiques),
`aos-code-review-and-quality` / `requesting-code-review` (gate de qualité),
`verification-before-completion` (preuve avant "fait"), `aos-doubt-driven-development` (adversarial
review sur les choix à risque : mapping équipes, saisons chevauchantes), `systematic-debugging` (si bug).

### Gantt : réaliser ET piloter
1. **Réaliser** : créer `gantt-team-season-stats.json` à la racine du repo, format de la convention
   existante (`scripts/gen-gantt-svg.js`) :
   `{ "title": "...", "timeline": { "labels": ["2026-08-14", ...] }, "tracks": [ { "name": "...",
   "items": [ { "label": "...", "start": "2026-08-14", "end": "2026-08-15" } ] } ] }`
   → générer le SVG : `node scripts/gen-gantt-svg.js gantt-team-season-stats.json > gantt-team-season-stats.svg`
   Tracks proposées : `Recherche & spec`, `API serveur`, `Calculs stats`, `UI modal`,
   `Cache & pré-chauffage`, `QA & validation`, `Gantt & pilotage`. Marquer les items avec les classes
   visuelles existantes (item-done, item-critical, item-premium, item-setup) si supportées.
2. **Piloter** : à chaque boucle, mettre à jour le JSON (dates réelles, done/blocked, écarts) et
   régénérer le SVG. En cas de dérive > 1 jour, ré-estimer et ajuster le plan — documenter l'écart.
   Versionner les itérations comme l'historique existant (`gantt-team-season-stats-v2.json`, …).
3. Le Gantt est un livrable du projet au même titre que le code : il doit exister dès la 1ère
   boucle et être à jour en fin de session.

### Tracking des sous-tâches (règle repo)
Chaque sous-tâche = une issue `bd` (beads) : `bd create`, `bd update <id> --claim` avant le dispatch,
`bd close <id>` seulement après validation. Pas de TODO list markdown.

### Livrable final de pilotage
En fin de session : rapport court — sous-tâches faites/blocked, écarts Gantt (plan vs réel),
décisions d'arbitrage (source choisie, mapping, cache), et issues `bd` restantes.

## Données à produire (par équipe × saison × compétition)
1. **General** : position, matchs, V/N/D (avec %), points (et par match), buts pour/contre (et par
   match), Over 2.5, Under 2.5, Clean sheet, Failed to score, BTTS — le tout en All/Home/Away.
2. **Classement comparatif** : tableau complet de la ligue (P, M, W:D:L, G, Pts) avec splits
   All/Home/Away, équipe consultée surlignée.
3. **Séquences & Streaks** : 13 colonnes (W D L nW nD nL G+ G- nG+ nG- +2.5 -2.5 BTTS) pour
   All/Home/Away, avec légende (W = victoires consécutives, nW = sans victoire, G+ = marque, …).
4. **Matchs récents** : 10 derniers de la saison, groupés par compétition, avec date, adversaire +
   rang de l'adversaire (N), score, badge V/N/D.
5. **Records** : plus large victoire/défaite (domicile/extérieur), plus de buts marqués/encaissés.
6. (Optionnel) Challenge table : résultat vs chaque équipe de la ligue.

## Sources (hiérarchie stricte, cascade silencieuse)
1. **API-Football v4** (header `x-apisports-key`, clé `API_FOOTBALL_KEY` déjà dans .env) :
   - `/teams?search={name}` → id équipe + id ligue (réutiliser le mapping équipes existant
     `team_name_mapping.py` / `lib/logo-cascade.js` pour normaliser les noms, fallback team_logos.sofaId)
   - `/teams/statistics?season={N-1}&team={id}&league={lid}` → general stats (fixtures.played,
     wins/draws/loses.total, points, goals.for/against, clean_sheet, failed_to_score)
   - `/standings?season={N-1}&league={lid}` → position + classement complet + splits home/away
   - `/fixtures?season={N-1}&team={id}` → matchs récents (calcul Over/Under 2.5, BTTS, streaks,
     records en local — pas de requête supplémentaire)
   - ⚠️ Free tier 100 req/jour : cache SQLite `api_cache` 7 jours, clé `team_season_{id}_{season}_{league}`,
     et pré-chauffage des équipes des matchs du jour (ex: Galatasaray, Çorum) au démarrage du serveur.
2. **Sofascore public** (utiliser `sofaGet` existant server.js:2366, aucun quota) :
   - `/api/v1/team/{sofaId}/unique-tournament/{tid}/season/{sid}/statistics/overall` → stats agrégées
   - `/api/v1/team/{sofaId}/events/last/{10}` → résultats (param seasonId si supporté)
   - C'est le fallback principal si API-Football est saturé/absent.
3. **BSD** (`BSD_API_KEY`) : recent matches via `bsdGetTeamDetail` existant — complément identité.
4. **fcstats.com** : JAMAIS de scraping automatisé (Cloudflare délibéré). Usage manuel de
   vérification de cohérence uniquement (±1 sur position/buts).

## API serveur
Nouvelle route `GET /api/v1/team/:id/season-stats?season=2025` (et `?season=2024`) retournant :
`{ team, season, competitions: [{id,name,type}], general: {all,home,away}, comparativeTable,
sequences: {all,home,away,last5,over25,cleanSheet,scored,btts}, streaks: {all,home,away},
recentMatches: [{date,competition,home,away,score,homeRank,awayRank}], records: {...} }`.
Si plusieurs compétitions dans la saison (Süper Lig + UCL), retourner toutes + param `?competition=`.
Cache 7 j via `apiCacheGet/apiCacheSet` (pattern `bsd_team_v2` existant). Garder la route
`/api/v1/team/:id` intacte pour compat.

## UI (pariscore.html, modal openTeamDetail enrichi)
- Modal élargi (max-width ~800px), header actuel conservé (logo, nom, ligue, pays, stade).
- **Sélecteur de saison** façon fcstats : [2026/2027 en cours] [2025/2026] [2024/2025], tabs
  quand plusieurs compétitions par saison.
- **Section "Statistiques générales"** : grille de KPI (Position, Matchs, V/N/D + %, Pts, GF,
  GA, Over 2.5, Under 2.5, Clean sheet, Failed to score, BTTS) + toggle All/Home/Away.
- **Section "Classement"** : tableau complet avec l'équipe surlignée (accent vert --accent #00e676).
- **Section "Séquences & Streaks"** : deux mini-tableaux 13 colonnes + légende inline.
- **Section "Matchs récents"** : 10 lignes groupées par compétition, badges V/N/D (vert/gris/rouge).
- **Section "Records"** : 6 cartes.
- Design system PariScore : fonds `var(--bg2)/var(--bg4)`, labels `var(--text3)`, chiffres en
  DM Mono, libellés FR (V/N/D, "Clean sheet", "BTTS"), responsive (grille 2 colonnes mobile),
  skeleton pendant le chargement, erreur silencieuse si source indisponible (conserver le contenu actuel).
- **XSS obligatoire** : `_jsStr()` sur toute interpolation utilisateur (pattern existant).

## Pièges connus
- Saisons chevauchantes (2025/2026) : dériver `N-1`/`N-2` depuis la saison de la compétition
  courante, pas depuis l'année civile.
- Résolution de l'équipe par nom : utiliser le mapping/normalisation existant (TEAM_NAME_OVERRIDES,
  logo-cascade), pas de fuzzy matching maison.
- API-Football peut renvoyer "Rate limit" → retry 1× puis bascule Sofascore, jamais de blocage UI.
- Ne pas casser `bsdGetTeamDetail` ni les consommateurs actuels de `/api/v1/team/:id`.
- Legacy ES5 dans server.js (pas d'async/await top-level, pattern `(async () => {...})()`).

## Validation
0. **Gantt** : `gantt-team-season-stats.json` + `.svg` existants dès la 1ère boucle, à jour
   (items done/blocked, dates réelles) à chaque itération et en fin de session.
1. `node --check server.js` et `node --check pariscore.js`.
2. Démarrage serveur local + `GET /api/v1/team/632/season-stats?season=2025` (Galatasaray) :
   position, V/N/D, GF/GA, clean sheets, records cohérents avec fcstats_galatasaray.html (écart ±1 toléré).
3. Clic Galatasaray dans l'UI : toutes les sections s'affichent, sélecteur 2025/2026 ↔ 2024/2025
   fonctionne, cache chaud = rendu < 1,5 s.
4. Tester 3 équipes de ligues différentes (ex: PSG, Bayern, Fenerbahçe) + 1 équipe sans saison
   précédente (promotion) → section "aucune donnée" propre, pas de crash.
5. `bun run lint` si applicable au changement.
6. Chaque sous-tâche relue par un sub-agent (code-reviewer ou test-engineer) avant `bd close`.
