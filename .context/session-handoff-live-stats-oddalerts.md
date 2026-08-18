# Handoff session — Publicité "OddAlerts live stats" : QA + audit (reprise)

> Fichier de reprise à usage unique pour qu'un modèle reprenne cette session
> sans ambivalence. Reprendre les sujets dans l'ordre de la section **ETAPE SUIVANTE**.
> Date : 2026-08-15 · Branche : (working tree non commité, profil conservateur).

---

## 1. Objectif de la mission (demande utilisateur, inchangée)

1. **QA test visuel** des features live football OddAlerts + corrections de bugs
   (avec l'agent `code-reviewer`), puis **rapport de fin de mission `.md`**.
2. **Audit d'améliorations & innovations** avec agents spécialisés : mêmes agents
   qu'en (1) + **1 ingénieur data + 1 ingénieur server + 1 expert paris sportifs + 1 webdesigner senior**.
   → Chaque agent doit faire une **analyse comparative de ≥ 5 sites concurrents de live football**
   (les plus visuels / les plus fréquentés). Livrable : **rapport d'améliorations & innovations `.md`**.

---

## 2. L'implémentation cible — ce qui est AVANT la session de reprise

Feature **terminée, testée, clôturée** (bead `ParisScorebis-5r7d = done`) :
implémentation des reco §6.1/4/5/6/7 du rapport source
`.context/pm/oddalerts-live-stats-analysis.md`.

Fichiers concernés (tous non commités dans le working tree) :
- **Nouveaux** :
  - `src/lib/football-live-thresholds.ts` — `LIVE_FUNNEL_THRESHOLDS`,
    `evaluateLiveFunnel`, `expectedPressureBaseline`, `detectPressureAnomaly`,
    `projectLiveMarkets` (Poisson sur temps restant, xG live → fallback probas pré-match).
  - `src/components/football/pressure-duo-donuts.tsx` — donuts Pression LIVE vs ATTENDU + badge anomalie.
  - `src/components/football/live-stats-breakdown.tsx` — jauges bilatérales + table métriques
    + surbrillance seuils funnel + compteur signaux + probabilités live (1X2/O1.5/O2.5/BTTS).
  - `src/lib/__tests__/football-live-thresholds.test.ts` — 25 tests bun.
- **Modifiés** :
  - `src/components/football/momentum-chart.tsx` — ticker d'événements agrégés (`TickerRow`,
    `aggregateEventTicker`, `@/` import `ChevronRight`).
  - `src/components/football/football-match-detail-dialog.tsx` — bloc « Pression LIVE vs ATTENDU +
    stats live » rendu quand `view.live` (lignes ~457→478).
  - `src/lib/football-data.ts` — `FootballLiveState` étendu (attaques/dangerous/fautes/cartons/xg, optionnels).
  - `src/lib/bsd-football-fetcher.ts` — `BSDLiveStats` + `mapLiveState` étendus (xG `home_xg_live`/`actual_home_xg`,
    `sr_stats.attack/dangerous_attack` fallback).
  - `src/lib/espn-soccer-fetcher.ts` — émission d'événements `corner` minute-par-minute (avant : buckets seuls).
  - `src/lib/football-pressure-index.ts` — conservation des events corners + fix `layers.goals`/`layouts.corners`.
  - Docs : `COMPONENTS.md` (football → 14, total 148), `CHANGELOG.md` (entrée v12.99).
- **Fichier temporaire à supprimer** : `.next/dev/types/routes.d.ts` a été **supprimé puis restauré**
  par copie depuis `.next/types/routes.d.ts` (version build valide) — il était corrompu (erreurs TS1109),
  gitignored, régénéré par `next dev`. Ne plus y toucher.

### Qualité validée (avant reprise)
- Tests bun (3 fichiers foot) : **78/78 PASS** (dont 25 nouveaux + corner-passthrough).
- eslint ciblé sur fichiers modifiés : **0 erreur**.
- `tsc --noEmit` : **0 erreur sur mes fichiers**. ⚠️ Le workspace a **5877 erreurs TS pré-existantes**
  (outils `tools/skyvern` vendored, WIP d'autres sessions : `baseball/provider.ts` `overUnderHit`,
  tennis `live-decisions-drawer.tsx`, `scripts/tmp-*.ts`, etc.). Ne PAS essayer de corriger tout ça.
- `bun test` complet (racine) crashe sur les specs Playwright + tests vitest vendored → test uniquement
  `src/` ou les fichiers par nom.

---

## 3. État actuel RÉEL de la phase QA (vérifiée, scripts créés)

### Serveur dev
- **En cours d'exécution** sur `http://localhost:3000` (Next 16.1.3 turbopack, démarré via le premier
  `start` avorté — l'abort n'a tué que le wrapper `oc_bash`, PAS le serveur).
- Démarré proprement par : `node scripts/qa-start-dev.js` (créé pour pallier le gel :
  spawn détaché `detached:true` + `stdio`→fichier `dev-qa.log` + `unref()` + poll readiness).
  Modes : `--status`, `--nowait`. **Le fix du gel = ce script** (utiliser QUI, car `start /min cmd /c`
  laisse le pipe du tool ouvert → blocage).
- **`BSD_API_KEY` présent dans `.env`** → les API live BSD fonctionnent.

### Scripts QA (créés)
- `scripts/qa-start-dev.js` (static start/ready).
- `scripts/qa-live-stats-visual.mjs` (Playwright, chromium, viewport 1440×1000, capture console/pageerror).
  Ouvre : onglet Football → clique CTA `button[title="Voir le momentum du match"]` → dialog → asserts.

### RÉSULTAT CLÉ / ROOT-CAUSE (le blocker principal)
**Le QA a révélé que l'onglet football live actuel affiche des matchs MOCK, pas les vrais BSD.**
Preuves :
- `/api/football/live` renvoie **22 matchs live réels BSD** (dont `bsd-215474` Udinese vs Padova,
  `bsd-210810` FC Utrecht vs AZ, xG réels...).
- Mais le tab football (hébergé par `use-live-football.ts`) consomme **`/api/v2/matches/live`**
  qui renvoie les **mocks** (`mock_fl2` MCI 1-1 ARS 35', `RMA/FCB`, etc. — cf. `ApiV2Response`).
- Cliquer le CTA Momentum d'un mock → `/api/football/matches/mock_fl2/stats` → **503** (BSD 404 sur id mock)
  → le dialog affiche « Momentum indisponible (HTTP 503) » ; le **donut ne s'affiche pas** ;
  la `LiveStatsBreakdown` s'affiche mais sans données (mock = 0 tirs/0 corners) → **aucun badge funnel**.
- ⚠️ Ma preuve initiale d'un « bug donut » était un **faux positif** : le QA clickait le mock (index 0),
  pas un vrai match. **Le donut n'est PAS buggé** — il ne s'affiche simplement que si `stats`
  (endpoint `/api/football/matches/{id}/stats`) répond 200, ce qui n'arrive que sur les vrais matchs BSD.
- `/stats` sur un vrai id BSD : **200 stable** (testé 6× sur `bsd-215474`).

### Implications pour le QA / l'audit
1. **Pour VOIR les features fonctionner en visuel** → il faut un match issu de la vraie feed BSD.
   Option A : corriger `use-live-football.ts`/`/api/v2/matches/live` pour servir les vrais BSD.
   Option B (rapide pour QA) : le script doit cliquer un CTA dont la carte contient un nom d'équipe
   réel issu de `/api/football/live` (je n'ai PAS réussi à matière « Utrecht » dans le DOM car seuls
   les 2 mocks ont un CTA actuellement) — donc **le fix réel est l'Option A**.
2. **Bug réel pré-existant rapportable** : la UI live football sert des mocks au lieu des vrais BSD
   (fichiers WIP d'une autre session : v2 route mocks + `use-live-football.ts`). Hors périmètre
   OddAlerts mais à mentionner dans le rapport de fin de mission & l'audit.

---

## 4. ETAPE SUIVANTE (ordre recommandé, depuis un état propre)

> Nota : `node modules` non installés ? Ils le sont (Playwright dispo). Si l'env a changé : `bun install`.

1. **Vérifier que le serveur tourne** : `node scripts/qa-start-dev.js --status` ; sinon le lancer.
2. **Décider de l'Option A ou B** ci-dessus pour rendre la démo des features visible.
   - Si l'on veut une preuve visuelle rapide : fixer le script QA pour viser un vrai match BSD,
     EN ATTENDANT une correction de la v2. Le plus robuste : dans le script, avant le clique,
     retrouver le vrai id via `/api/football/live`, puis ouvrir directement
     `/api/football/matches/...` — ou corriger la v2 pour trouver le vrai CTA.
   - Recommandation : corriger feed v2 (voir §3) pour que le live affiche les vrais BSD — cela sert
     à la fois le QA et la prod.
3. **Relancer** `node scripts/qa-live-stats-visual.mjs` jusqu'au **vert intégral** :
   donut PRESSION LIVE + donut ATTENDU doivent passer sur un vrai match live.
   Corriger les vrais bugs rencontrés (ne pas « repâcher » le QA pour masquer un bug).
4. **Dispatch agent `code-reviewer`** (task) sur le diff de la phase implémentation
   (fichiers du §2, vs HEAD via `git diff`). Appliquer les corrections, re-valider tests/lint/typecheck.
5. **Rédiger le rapport de fin de mission `.md`** :
   emplacement suggéré `.context/fin-mission-live-stats-oddalerts.md` (analogue `.context/pm/…`).
   Contenu : scope, ce qui est livré, preuve QA (scripts + captures), découverte du bug v2-mocks,
   limites (5877 erreurs TS pré-existantes hors périmètre), prochains pas.
6. **Choisir 5+ concurrents** à analyser (suggestions) :
   **FotMob, Flashscore, SofaScore, LiveScore, WhoScored, OddAlerts.com, Bet365 (live), Sofascore**.
   Via `webfetch` (pas MCP browser si Playwright indisponible). Chaque agent analyse au moins 5,
   focus **live football** : présentation stats live/possession/xG, design, réactivité, innovations
   (PrédictionAI, Momentum, animation), UX mobile, montérisation.
7. **Dispatch agents de l'audit** (task, en parallèle si possible) avec l'analyse concurrentielle :
   - `code-reviewer` (re) — lecture diff + sûreté des nouvelles features.
   - **ingénieur data** — couverture/qualité xG-live BSD, seuils funnel, modèles Poisson, backtest.
   - **ingénieur server** — perf/latence des routes `/stats`/`/live`, cache, coût API BSD, offline.
   - **expert paris sportifs** — pertinence des marchés live (1X2/O/U/BTTS live), Kelly, value.
   - **webdesigner senior** — ergonomie des donuts/jauges/ticker, DQ du design system, mobile.
   Chacun rend un mini-rapport structuré (forces / faiblesses vs concurrents / recommandations priorisées).
8. **Synthétiser** dans `.context/audit-innovations-live-football.md` + proposition priorisée.
9. **Clôturer beads** : `ParisScorebis-jk6h` (QA+fix+rapport fin de mission) et
   `ParisScorebis-jb6d` (audit innovations). Profil conservateur → **ne pas commit/push sans ordre explicite**.

---

## 5. Pièges / règles à respecter (AGENTS.md + découvertes session)

- **Jamais `oc_bash` avec `start /min`** ni processus long en avant-plan → gel. Utiliser
  `node scripts/qa-start-dev.js`. Pour lancer un binaire via un agent : spawn détaché node.
- **CMD uniquement** (pas Git Bash) : `del`, `type`, `dir /b`, pas de `ls/cat/grep/rm`.
- **Ne PAS utiliser `find`, `findstr | find`** (comportement MSYS/`find` scannait C:\ → très lent).
  Compter à la place avec node (`readFileSync`).
- **Glob/Grep** : seulement sur `src/**`, `scripts/**`, jamais de `**/*` sur `.next/` (890 Mo).
- **Beads** pour la gestion des tâches (pas de toso/TodoWrite) ; `bd create|claim|close|update`.
- **Debug via capture DOM** (Text/dialog) plutôt que lire les PNG (illisibles par l'outil Read).
  Utiliser `[role=dialog][data-state=open]` (il existe 2 dialogs radix : consent cookies + match).
- **Ne pas corriger les 5877 erreurs TS pré-existantes** (WIP autres sessions / tools vendored).
- **Pas d'emoji dans le code**, commentaires FR, pas de création de docs sans demande explicite
  (excepté les 2 rapports demandés par l'utilisateur).
- Ne PAS re-run `node scripts/sync-skills.js` (corrompt `opencode.json`).

---

## 6. Boussole : décisions déjà prises

- Donut gating : `!loading && !error && stats` (masqué si `/stats` KO) → comportement voulu et sûr.
- Baseline « ATTENDU » = probas pré-match du modèle (`expectedPressureBaseline`) — équivalent
  fonctionnel du `*_pressure_avg` d'OddAlerts (pas d'historique réel dispo côté BSD).
- Seuils funnel codés dans `LIVE_FUNNEL_THRESHOLDS` = ceux du rapport (§6.5).
- `projectLiveMarkets` source `"xg"` si xG live présent sinon `"prematch"` — étiquette UI affichée.
- Recos §8 (IA/Telegram) = basse priorité, non implémentées par choix de périmètre.