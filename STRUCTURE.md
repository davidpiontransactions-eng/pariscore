# 📦 Structure du bundle `refonte-tennis-v2-bundle.zip`

> **Date** : 2026-07-20 (v2 — mis à jour après P7+P8)
> **Branche git** : `refonte-tennis-v2` (10 commits atomiques)
> **Taille zip** : 237 KB (73 fichiers)
> **Contenu** : Travail de la session refonte tennis (Phases 1-9 + P7 + P8)

---

## 🗺️ Vue d'ensemble

```
refonte-tennis-v2/
├── README.md                           ← Point d'entrée du bundle
├── STRUCTURE.md                        ← CE FICHIER (définition par fichier)
├── todo.md                             ← Journal de session complet
├── GANTT.md                            ← GANTT historique du projet
├── GANTT-REFONTE-TENNIS-V2.md          ← Matrice d'affectation agent/skill/MCP
│
├── docs/                               ← Documentation (8 fichiers)
├── gantt/                              ← GANTT JSON + SVG (8 fichiers)
├── scripts/                            ← Scripts utilitaires (3 fichiers)
│
└── src/
    ├── app/
    │   ├── api/tennis/                 ← Backend (vide — P8 à créer)
    │   └── tennis/                     ← Pages Next.js (2 fichiers)
    ├── components/
    │   ├── football/                   ← Onglet tennis (1 fichier)
    │   └── tennis/                     ← Composants tennis (30+ fichiers)
    ├── lib/                            ← Helpers tennis (7 fichiers)
    └── messages/                       ← i18n (2 fichiers)
```

---

## 📄 Définition de chaque fichier

### 📚 docs/ (8 fichiers — 2200 lignes)

#### `docs/P8-START-HERE.md` ⭐ POINT D'ENTRÉE TÂCHE DIFFICILE
**130 lignes** — Point d'entrée pour reprendre la tâche difficile P8.
Ordonne les lectures, fournit le squelette TypeScript de la route
`/api/tennis/search`, et liste les tests curl à passer.

#### `docs/P8-TASK-BRIEF.md` ⭐ BRIEF COMPLET TÂCHE DURE
**250 lignes** — Brief détaillé de la tâche P8 (APIs backend recherche).
Définit : objectif, 3 options stratégiques (A fallback hardcodé / B seed DB /
C API payante), critères d'acceptation (DoD), modèle de rapport à remplir.

#### `docs/P8-CONTEXT-DB-LEGACY.md` ⚠️ INVESTIGATION CRITIQUE
**130 lignes** — Investigation de la DB legacy `pariscore.db`. Conclusion :
**les 15 tables tennis sont VIDES** (jamais peuplées). Schémas documentés
(Sackmann-style : `tennis_matches` 56 colonnes). Implication : Option A
(fallback hardcodé) recommandée pour P8.

#### `docs/STRUCTURE-ONGLET-TENNIS.md`
**180 lignes** — Plan UX de la refonte onglet tennis. Architecture cible :
3 sous-onglets (Live / Aujourd'hui / Tournois) + recherche unifiée +
vraies heures via TennisTemple. Workflow data flow + plan de migration
progressif réversible.

#### `docs/ARCHITECTURE-REFONTE-TENNIS.md`
**200 lignes** — Arbre de rendu détaillé de `MatchCard`. Règles de rendu
conditionnel (prematch vs live vs synthetic), data flow (BSD → hooks →
composants), points d'attention performance (lazy load Recharts, etc.).

#### `docs/SKILLS-INSTALL-TIER2-TIER3.md`
**733 lignes** — Inventaire complet des skills frontend à installer
(Tier 1/2/3 + procédure PowerShell pour chaque). Inclut MCP servers
et la liste noire des MCP inexistants.

#### `docs/AGENTS-MCP-FRONTEND-INSTALL.md`
**697 lignes** — Inventaire des **agents** (personas/sous-agents) et
**MCP servers** frontend (distinct des skills). Procédures d'installation
par type (`.claude/agents/` vs `.opencode/agent/` vs `.mcp.json`).

---

### 📊 gantt/ (8 fichiers)

#### `gantt/gantt-refonte-tennis.json` + `.svg`
**v1** — Sprint initial Phases 1-6 (20-30/07). Format JSON + rendu SVG
navy/emerald (13 KB).

#### `gantt/gantt-refonte-tennis-v2.json` + `.svg`
**v2** — Sprint enrichi avec affectations agent/skill/MCP par tâche.
Phase 1 marquée ✅ DONE avec commit hashes.

#### `gantt/gantt-refonte-tennis-v3.json` + `.svg`
**v3** — Phases 4-5-6 (intégration + polish + deploy) avec matrice
d'affectation détaillée.

#### `gantt/gantt-refonte-tennis-v4.json` + `.svg`
**v4** — Phases 7-8-9 (refonte onglet + recherche + vraies heures
TennisTemple). Dernier GANTT en date.

---

### 🛠️ scripts/ (3 fichiers)

#### `scripts/scrap-tennistemple.ts` 🆕
**170 lignes** — Script Node.js qui scrap `en.tennistemple.com` (ATP+WTA)
respectueusement : User-Agent réaliste, retry 429/503, délai 500ms,
robots.txt respecté (`index, follow`). Output : `data/tennis-schedule-<date>.json`.

**Usage** : `npx tsx scripts/scrap-tennistemple.ts --year 2026 --tour atp`

#### `scripts/gen-gantt-svg.js`
**226 lignes** — Générateur SVG Gantt depuis un fichier JSON. Réutilisable
pour tout GANTT du projet. Palette navy/emerald cohérente avec DESIGN_CHARTER.
Détection automatique weekend (gris foncé).

**Usage** : `node scripts/gen-gantt-svg.js gantt.json > output.svg`

#### `scripts/sync-skills.js`
**160 lignes** — Synchronise l'allowlist OpenCode depuis `.agents/tools/`.
**Bug path corrigé** en Tier 1 (cherchait `opencode.json` racine au lieu de
`.opencode/opencode.json`). Sans ce fix, l'allowlist restait vide.

**Usage** : `node scripts/sync-skills.js [--check|--verify-junction]`

---

### 🎾 src/components/tennis/ (30 composants)

#### Composants Phase 1 — Score live CRITICAL ✅

##### `src/components/tennis/set-scoreline.tsx` (83 lignes) ⭐
**Phase 1** — Affiche le score set-par-set `6-4 6-3 3-2`. Set en cours en
emerald bold. Docstring JSDoc complète. Gestion edge cases (pré-match 0-0).

##### `src/components/tennis/current-game-score.tsx` (50 lignes) ⭐
**Phase 1** — Score du jeu en cours `30-15` / `Av.-40` / `40-40` (deuce).
Utilise `formatPoints()` partagé depuis `src/lib/tennis-format.ts`.

##### `src/components/tennis/server-indicator.tsx` (48 lignes) ⭐
**Phase 1** — Icône `CircleDot` lucide avec `animate-pulse` (lucide n'a pas
d'icône Tennis, documenté dans le code). `aria-label` complet.

#### Composants Phase 2 — Stats live Sofascore-like ✅

##### `src/components/tennis/serve-stats-bars.tsx` (229 lignes) ⭐
**Phase 2** — 3 paires de barres horizontales divergentes (style Sofascore
"Performance") : 1st serve in%, 1st serve won%, return won%. Gagnant emerald,
perdant muted. Layout `grid-cols-[1fr_auto_1fr]`.

##### `src/components/tennis/break-points-grid.tsx` (289 lignes) ⭐
**Phase 2** — Matrice de dots `●`/`○` pour balles de break. 3 paliers couleur
(emerald ≥67%, amber 50-66%, rose <50%). Props optionnelles `bp_faced`
forward-compat quand le hook exposera cette data.

##### `src/components/tennis/set-by-set-table.tsx` (218 lignes) ⭐
**Phase 2** — Table dense par set avec colonne Score optionnelle (winner en
gras emerald, set en cours en muted). Remplace l'ancien per-set breakdown.

#### Composants Phase 3 — Live premium ✅

##### `src/components/tennis/win-probability-chart.tsx` (204 lignes) ⭐
**Phase 3** — AreaChart Recharts avec rolling buffer (max 50 entrées) de
`liveProbA`. ReferenceLine Y=50 (even money). Gradient emerald. Direct
labeling (pas de légende). Reset sur match change.

##### `src/components/tennis/point-timeline.tsx` (148 lignes) ⭐
**Phase 3** — Timeline horizontale compacte des points du jeu courant.
Dots colorés (winner color), anneau doré pour break points, bordure épaisse
quand receveur gagne (break).

##### `src/components/tennis/stats-radar-chart.tsx` (311 lignes) ⭐
**Phase 3** — Radar 6 axes (Sofascore "Player Comparison") : Service,
1st won, Return, Total pts, Aces, DF-inverse. P1 emerald, P2 rose, fill
opacity 0.2. Aces normalisés 0-15→0-100.

##### `src/components/tennis/live-score-announcer.tsx` (344 lignes) ⭐
**Phase 3** — `sr-only` LiveRegion (`aria-live="polite"`) qui annonce les
changements de jeu/set/score aux lecteurs d'écran. WCAG 4.1.3 (Status
Messages). Throttle 1 annonce/sec.

#### Composants Phase 4 — Intégration ✅

##### `src/components/tennis/last-matches-list.tsx` (159 lignes) ⭐
**Phase 4** — Liste des 10 derniers matchs d'un joueur. Layout grille 5
colonnes : résultat W/L (badge emerald/rose), score, "vs", adversaire,
tournoi+surface+round. Empty state "Aucun match récent".

#### Composants tennis existants (non modifiés ou refactorés)

##### `src/components/tennis/match-card.tsx` (579 lignes) 🔧 REFACTORED
**P4** — Carte principale. Modifié pour : retirer `LiveScoreBar` (doublon),
intégrer `WinProbabilityChart` + `PointTimeline` + `LiveScoreAnnouncer`.
Appelle `useMomentumDR` directement pour `pointHistory`.

##### `src/components/tennis/match-card-header.tsx` 🔧 REFACTORED
**P1** — Header de carte. Modifié pour : intégrer `SetScoreline` +
`CurrentGameScore` + `ServerIndicator` (cluster `LiveHeaderScore` quand
`isLive`). Fix bug i18n date `fr-FR` hardcodé → `getDateLocaleTag(locale)`.

##### `src/components/tennis/match-detail-dialog.tsx` 🔧 REFACTORED
**P4** — Dialog modal. Modifié pour : remplacer 2 `<img>` par `PlayerAvatar`
(fallback initiales sur erreur), intégrer `LastMatchesList` dans tab form,
TODO pour `StatsRadarChart`.

##### `src/components/tennis/momentum-dr.tsx` 🔧 REFACTORED
**P1 + P3** — Sparkline momentum EWMA. Fixes : bug off-by-one labels set
(`S${d.set}` au lieu de `S${d.set + 1}`), typo ≥11px (WCAG), ARIA SVG
(`role="img"` + `<title>` + clavier), `DR_HISTORY_MAX` 36→60 (5 sets).

##### `src/components/tennis/live-stats-panel.tsx` 🔧 REFACTORED
**P2** — Panel stats live. -86 lignes net : suppression 4 `ServiceCircle`
redondants + per-set breakdown texte. Intégration `ServeStatsBars` +
`BreakPointsGrid` + `SetBySetTable`.

##### `src/components/tennis/match-card-detail.tsx` 🔧
Existant — Accordéon 4 indicateurs. À fusionner avec `stats-indicators-grid`
(future Phase 4.C).

##### `src/components/tennis/probability-bar.tsx` 🔧 À FIXER (P4.D)
Existant — Barre proba + IC bracket. Bug : tick médian `bg-white` invisible
dark mode (devrait être `bg-foreground`).

##### `src/components/tennis/odds-comparator.tsx` 🔧 À FIXER (P4.D)
Existant — Table cotes bookmakers triable. Bug a11y : `<th onClick>` non
clavier-accessible, pas de `aria-sort`.

##### `src/components/tennis/player-statline.tsx` 🔧 À FIXER (P4.C)
Existant — `#rank · Elo · SPS ⓘ`. Tooltip SPS retiré (crash hydration) à
restaurer via lazy mount.

##### `src/components/tennis/player-profile-view.tsx` 🆕
**Phase 9** — Vue page joueur `/tennis/player/[slug]`. Placeholder client
avec TODO pour `/api/tennis/player/[slug]`.

##### `src/components/tennis/tournament-view.tsx` 🆕
**Phase 9** — Vue page tournoi `/tennis/tournament/[slug]`. Placeholder
client avec TODO pour `/api/tennis/tournament/[slug]`.

##### Autres composants tennis existants (non listés en détail)
`backtest-badge.tsx`, `best-odd-badge.tsx`, `form-dots.tsx`, `match-card-footer.tsx`,
`odds-comparator.tsx`, `player-block.tsx`, `player-profile-header.tsx`,
`probability-ring.tsx`, `quick-add-ring.tsx`, `sparkline.tsx`, `stat-chip.tsx`,
`stats-indicators-grid.tsx` — Composants existants non modifiés.

---

### 📚 src/lib/ (7 helpers tennis)

#### `src/lib/tennis-format.ts` 🆕 (63 lignes) ⭐
**Phase 1** — Fonctions partagées `formatPoints()` + `formatScoreline()`.
Extraites de `match-card.tsx:62` pour éviter la duplication. Source unique
pour `current-game-score.tsx`.

#### `src/lib/i18n-locales.ts` 🆕 (39 lignes) ⭐
**Phase 1** — Helper partagé `getDateLocaleTag(locale)` + `DATE_LOCALE` map
(`{ fr: "fr-FR", en: "en-GB" }`). Centralise ce qui était dupliqué dans
`match-detail-dialog.tsx`. Choix `en-GB` documenté.

#### `src/lib/tennistemple-parser.ts` 🆕 (290 lignes) ⭐
**Phase 9** — Parser **pur** (pas de side effects, testable) qui extrait
les schedules depuis le HTML TennisTemple. `guessTimezone()` mappe 50+
tournois → timezone IANA. Gère l'offset UTC via `Intl.DateTimeFormat`.

Exports :
- `parseTennisTempleSchedule(html, date, tournament?)` → matchs du jour
- `parseTennisTempleTournaments(html, year)` → calendrier tournois année

#### `src/lib/schedule-merger.ts` 🆕 (130 lignes) ⭐
**Phase 9** — Fusionne schedules TennisTemple + matchs BSD. Match par nom
via `normForLookup` (NFD+diacritics). Détecte BSD fallback (scheduledAt ≈
now) et le flag. Helper `summarizeScheduleSources()` pour monitoring.

#### `src/lib/tennis-search-types.ts` 🆕 (88 lignes) ⭐ PRÉ-REQUIS P8
**P8 prep** — Types TS partagés pour la recherche tennis. `PlayerResult`,
`TournamentResult`, `SearchResponse`, `TournamentsResponse`, `SEARCH_TYPES`.
Utilisé par routes API + composants UI search.

#### `src/lib/tennis-search-index.ts` 🆕 (~700 lignes) ⭐ PRÉ-REQUIS P8
**P8 prep** — **93 top joueurs ATP** (généré automatiquement depuis
`tennis-player-photos.json`). Export `searchPlayers(query, limit)` fait du
fuzzy insensible aux accents. Rangs ATP approximés juillet 2026.

#### `src/lib/tennis-tournaments-index.ts` 🆕 (540 lignes) ⭐ PRÉ-REQUIS P8
**P8 prep** — **62 tournois ATP principaux** : Grand Slams (4) + Masters
1000 (9) + ATP Finals (1) + ATP 500 (13) + ATP 250 (35). Export
`searchTournaments(query, limit)` fuzzy sur nom + ville + pays.

---

### 🌐 src/app/ (6 fichiers)

#### `src/app/tennis/player/[slug]/page.tsx` 🆕
**Phase 9** — Server Component Next.js (App Router). Route `/tennis/player/[slug]`.
Metadata générée dynamiquement (SEO). Délègue à `<PlayerProfileView>`.

#### `src/app/tennis/tournament/[slug]/page.tsx` 🆕
**Phase 9** — Server Component Next.js. Route `/tennis/tournament/[slug]`.
Metadata générée. Délègue à `<TournamentView>`.

#### `src/app/api/tennis/search/route.ts` 🆕 ⭐
**Phase 8** — Route `GET /api/tennis/search?q=<query>&type=players|tournaments|all`.
Autocomplete unifié joueurs + tournois. Cache 60s. Validation query (q >= 2 chars).
Source fallback hardcodé marquée dans la réponse (transparence).

#### `src/app/api/tennis/tournaments/route.ts` 🆕 ⭐
**Phase 8** — Route `GET /api/tennis/tournaments?date=<YYYY-MM-DD>`.
Liste 62 tournois ATP principaux. Cache 5 min. Date optionnelle validée.

#### `src/components/football/tennis-tab-content.tsx` 🔧 REFACTORED
**Phase 7** — Onglet tennis complet refactoré : ajout state `subTab`,
`TennisSubTabs` inséré après le Hero, logique de filtrage 'live'/'today'/
'tournaments'. 'tournaments' affiche `TournamentsList` à la place de la grille.

### 🎾 src/components/tennis/ — Composants Phase 7 (nouveaux)

#### `src/components/tennis/tennis-sub-tabs.tsx` 🆕 ⭐
**Phase 7** — Composant `TennisSubTabs` avec 3 onglets : 🟢 Live (badge count
dynamique), 📅 Aujourd'hui (badge count), 🏆 Tournois. Style shadcn compact,
ARIA `role="tablist"`. Pure/présentationnel (parent gère state).

#### `src/components/tennis/tournaments-list.tsx` 🆕 ⭐
**Phase 7** — Grille de tournois ATP/WTA/ITF. Auto-fetch via `/api/tennis/tournaments`
si pas de prop. Groupement par catégorie (Grand Slam / Masters 1000 / ATP 500 /
ATP 250). Card cliquable → `/tennis/tournament/[slug]`. Drapeau emoji via
`countryToFlagEmoji()`.

---

### 🌍 src/messages/ (2 fichiers i18n)

#### `src/messages/fr.json` 🔧
**Modifié** — Traductions françaises. Namespace `tennis` enrichi de +30 clés
(scoreAria, breakPoints.*, firstServePct, winProbability, pointTimelineAria,
momentumChartAria, setBySet, backToTennis, etc.).

#### `src/messages/en.json` 🔧
**Modifié** — Traductions anglaises (mirror de `fr.json`).

---

### 📋 Root (4 fichiers)

#### `todo.md` 🔧
Journal de session complet (+549 lignes). Documente : install skills Tier 1/2/3,
bugs corrigés (A9, sync-skills path), plan refonte tennis 7 phases, procédure
PowerShell pour réinstaller sur un autre poste.

#### `GANTT.md` 🔧
GANTT historique du projet (Session 10 ajoutée : skills install + Phase 1 kickoff).

#### `GANTT-REFONTE-TENNIS-V2.md` 🆕
**150 lignes** — Matrice d'affectation détaillée par phase : pour chaque
tâche, l'agent + skill + MCP assigné. Statut ✅/🟡/⏳ par tâche.

#### `README.md` 🆕
Point d'entrée du bundle avec quick stats et lien vers `STRUCTURE.md`.

---

## 📊 Statistiques

| Métrique | Valeur |
|---|---|
| Fichiers total | 73 |
| Composants tennis | 32 (13 créés + 6 modifiés + 13 existants) |
| Routes API | 7 existantes + 2 créées (P8) |
| Pages Next.js | 2 nouvelles (player/tournament) |
| Helpers lib | 7 (5 créés + 2 existants) |
| Lignes code tennis nouveau | ~3000 |
| Docs | 8 (2400 lignes) |
| Commits atomiques | 10 sur `refonte-tennis-v2` |
| Skills frontend installés | 21 (Tier 1+2+3) |
| MCP servers | 19 (15 + 4 nouveaux) |
| Bundle zip | 237 KB |

---

## 🎯 Comment utiliser ce bundle

### Si tu veux reprendre la tâche P8 (la plus dure)

```bash
# 1. Extraire le zip
unzip refonte-tennis-v2-bundle.zip

# 2. Lire dans l'ordre
cat docs/P8-START-HERE.md       # ← Point d'entrée
cat docs/P8-TASK-BRIEF.md       # ← Brief complet
cat docs/P8-CONTEXT-DB-LEGACY.md # ← DB vide !

# 3. Les pré-requis sont déjà prêts dans src/lib/
ls src/lib/tennis-search-*.ts src/lib/tennis-tournaments-index.ts

# 4. Créer les 2 routes manquantes
#    (squelette fourni dans P8-START-HERE.md)
```

### Si tu veux comprendre l'architecture complète

```bash
cat docs/ARCHITECTURE-REFONTE-TENNIS.md  # Arbre de rendu MatchCard
cat docs/STRUCTURE-ONGLET-TENNIS.md      # Plan UX onglet tennis
cat GANTT-REFONTE-TENNIS-V2.md           # Matrice affectations
```

### Si tu veux réinstaller les skills sur un autre poste

```bash
cat docs/SKILLS-INSTALL-TIER2-TIER3.md     # Procédure PowerShell
cat docs/AGENTS-MCP-FRONTEND-INSTALL.md    # Agents + MCP
```

---

## 🚦 État d'avancement (session 2026-07-20)

```
✅ Phase 1 — SetScoreline + CurrentGameScore + ServerIndicator (8ffcde7)
✅ Phase 2 — ServeStatsBars + BreakPointsGrid + SetBySetTable (8700e01)
✅ Phase 3 — WinProb + PointTimeline + Radar + Announcer + momentum a11y (7f0bdb5)
✅ Phase 4 — Intégration MatchCard + LastMatchesList + dialog (7c83704)
✅ Phase 7 — SubTabs Live/Aujourd'hui/Tournois + TournamentsList (88c9799)
✅ Phase 8 — Routes API /search + /tournaments Option A (1982c10)
✅ Phase 9 — Scraper TennisTemple + pages joueur/tournoi (daf5e21)
✅ P8 prep — Brief + 3 fichiers data pré-créés (8a8043f)

✅ Phase 4.D — a11y fixes proba-bar + odds-comparator (19550c0)
⏳ Phase 5 — Polish + validation (impeccable/hallmark/playwright/CWV)
⏳ Phase 6 — Déploiement VPS + vérif prod
```
