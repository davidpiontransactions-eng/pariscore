# Traçabilité du Débuggage : Sidebar Tennis

**Date** : 2026-08-24 · **Agent** : ox-alpha · **Boucle d'ingénierie** : systematic-debugging (4 phases)
**Symptôme rapporté** : les matchs de Tennis (Prematch **et** Live) n'apparaissent pas dans la sidebar multi-sports.

---

## [0] Phase d'Initialisation

- **Tâche** : Audit de l'état actuel de la chaîne de données sidebar.
- **Actions réalisées** :
  - Cartographie via graphify (`graphify query "tennis sidebar prematch live display flow"`) :
    `sports-sidebar.tsx` → `useSportsTree()` → `loadTennis()` → `/api/tennis/live` + `/api/tennis/prematch` → `tennisToRaw()` → `groupRawMatches()`.
  - Lecture des fichiers clés : `src/hooks/use-sports-tree.ts`, `src/lib/sports-tree.ts`, `src/components/layout/sports-sidebar.tsx`, `src/app/api/tennis/{live,prematch}/route.ts`, `src/lib/bsd-fetcher.ts`, `src/stores/use-sports-sidebar-store.ts`.
  - Constat git : HEAD = commit `13dc5834` (« Fix tennis sidebar… », 22h14 aujourd'hui) déjà poussé ; diff non-commité résiduel sur `sports-tree.ts` (détection `isLive`).
- **État env** : `BSD_API_KEY=SET`, `BSD_TENNIS_ENABLED=SET`, `ODDS_API_KEY=VIDE` (fallback odds-api inactif — BSD est la source primaire).

## [Iter-1] Investigation & Audit (Hypothèses)

- **Investigation** (chaîne FE → Hook → API → Service → Source) :
  - API locales : `GET /api/tennis/live` → HTTP 200, `source=bsd`, **31 matchs** · `GET /api/tennis/prematch` → HTTP 200, `source=bsd`, **30 matchs**.
  - API prod (pariscore.fr) : 28 + 30 matchs, source=bsd. ✅ Backend sain.
  - Simulation exacte du hook (`bun scripts/diag-tennis-tree.ts`) : 61 brutes → 61 après `tennisToRaw` (0 filtrées) → nœud tennis valide (**61 matchs, 31 live, 3 pays**). ✅ Transformation saine.
  - Sonde navigateur Playwright (sans filtre) : badge « Tennis | 30 | 60 », arbre dépliable, 75 lignes. ✅ **Bug NON reproductible en local avec le code courant.**
- **Hypothèse de panne** (validée en Iter-2) : le filtre temporel persisté.
  1. La payload BSD **live** (`LiveMatchItem`) ne contient **aucune date de coup d'envoi** → `tennisToRaw` produit `scheduledAt: null`.
  2. `matchInTimeWindow()` appelle `filterLiveByWindow`/`filterByStartWindow` qui éjectent toute date vide (`if (!raw) return false`) → **les matchs live disparaissent sous toute pillule ≠ « Tout »** ; le slate prematch BSD étant daté demain (>24h), il disparaît aussi des fenêtres ≤12h et « Aujourd'hui ».
  3. `selectedTimeFilter` est **persisté en localStorage** (`zustand/persist`) → l'utilisateur reste bloqué sur « Tennis | 0 » après rechargement, d'où l'impression d'une panne permanente Prematch+Live.

## [Iter-2] Test de l'Hypothèse & MVP

- **Test** : sonde Playwright avec store persisté simulé (`scripts/probe-tennis-sidebar.js <url> 6h` — seed localStorage `pariscore.sportsSidebar.selectedTimeFilter="6h"`).
- **Résultats** :
  - Avant correctif, seed `6h` : badge **« Tennis | 0 »**, zéro match tennis affiché — alors que les 2 API renvoient 200 avec 58 matchs. **Hypothèse VALIDÉE** (reproduction déterministe du symptôme rapporté).
  - Diagnostic complémentaire par fenêtre (diag script) : fenêtres 1h→12h = **0 match tennis** ; 24h = 11 (prematch uniquement, live éjectés faute de date).

## [Iter-3] Implémentation de la Solution Reliable

- **Action** — 2 gardes à la racine (+ conservation du fix `isLive` présent au working tree) :
  1. `src/lib/sports-tree.ts` · `tennisToRaw()` : un match **live** sans `scheduledAt` exploitable est ancré à `new Date().toISOString()` (un live se joue *maintenant*) → conservé par les fenêtres temporelles et trié en tête.
  2. `src/lib/sports-tree.ts` · `matchInTimeWindow()` : un match `isLive` appartient toujours aux fenêtres « heures » et « Aujourd'hui », même si sa source ne fournit pas de date (défense en profondeur couvrant tous les sports).
  3. (Working tree, rattaché au même bug) détection `isLive = !!live_stats || !!currentPoint` pour les items du flux BSD live.
- **Files Modified** :
  - `src/lib/sports-tree.ts`
  - `scripts/diag-tennis-tree.ts` (nouveau — sonde diagnostic chaîne de données)
  - `scripts/probe-tennis-sidebar.js` (nouveau — sonde QA navigateur Playwright, simulation store persisté)
- **Solution détaillée** : la fiabilité 100% ne repose pas sur un retry mais sur l'invariant métier « un match en direct est systématiquement visible ». Les deux gardes garantissent qu'aucun état du store persisté (aucune pillule temporelle) ne peut masquer le live tennis, quel que soit le contenu de la payload source.

## [Iter-4] Vérification & Validation

- **Vérification** :
  - Sonde seedée `6h` après correctif : **« Tennis | 8 | 8 »** (8 = cap volontaire `MAX_LEVEL4_MATCHES` par ligue, comportement standard toutes ligues) — matchs à nouveau visibles. ✅
  - Régression sans filtre : « Tennis | 26 | 56 » (flux live fluctuant entre passes), arbre complet dépliable, 0 erreur console. ✅
  - TypeScript : `npx tsc --noEmit` → **0 erreur dans `src/`** (5862 erreurs préexistantes limitées aux dossiers vendor `tools/`, tests legacy hors périmètre). Fichiers touchés : 0 erreur. ✅
  - Screenshots : `.context/probe-tennis-sidebar.png`.
- **État Final** : **Fonctionnel** — Prematch et Live visibles dans la sidebar avec ou sans filtre temporel persisté.

---

## Suivi recommandé (hors périmètre immédiat)

- [ ] Déployer sur VPS (`deploy.bat "msg"`) — le correctif n'est que local tant que non déployé.
- [ ] Envisager l'affichage des cotes tennis (2 volets Joueur A/B) dans `MatchRow` au lieu du format 1X2 foot (cf. `TENNIS_SIDEBAR_AUDIT.md` §3.2).
- [ ] Propager une date de début BSD live côté `bsd-fetcher` si le champ existe dans l'API amont (affiner l'heure affichée).

---

## Ajout 2026-08-24 — Visibilité de l'heure de début sur la carte tennis

**Symptôme** : l'heure de début de match est visuellement cachée sur les cartes.

**Diagnostic** : dans `match-card-broadcast.tsx`, la colonne gauche date+heure était en
`flex min-w-0 flex-1` face à un bloc central `shrink-0` (tournoi max-w-180px) et une
colonne droite `flex-1`. En largeur réduite, la ligne `whitespace-nowrap` débordait
sa boîte compressée et était **rognée par l'`overflow-hidden` de la `<article>`**.

**Correctif** :
- `src/components/tennis/match-card-broadcast.tsx` — date+heure déplacées dans une
  chip compacte `shrink-0 bg-black/35 backdrop-blur-sm` (jamais compressable) ;
  le bloc central passe en `min-w-0` (tronque au lieu de masquer) ; colonne droite
  en `shrink-0`.
- `src/components/tennis/match-card-header.tsx` — variante non-broadcast durcie :
  ligne date/heure en `flex-wrap` (repli propre au lieu du rognage).

**QA Playwright** (`scripts/probe-card-time.js`) : heure visible + dans les bornes
de la carte à 1600px **et** 400px ; zéro chevauchement chip↔bloc central en 400px ;
screenshots `.context/card-time-{desktop,mobile}.png`. `tsc --noEmit` src/: 0 erreur.

---

# Feature — Top 5 matchs tennis à filtres déroulants (boucle d'ingénierie)

**Date** : 2026-08-25 · Objectif : répliquer le widget foot « Top 5 matchs » pour le
tennis, avec des métriques issues de la littérature de prédiction (thèses demandées).

## [Iter-0] Recherche métriques — lecture des thèses

- **Sources lues** (PDF → texte via pypdf, analyse subagent) :
  - Dryja, *Data-Driven Prediction of ATP Tennis Match Outcomes Using ML* (VU Amsterdam) :
    **ELO_SURFACE = ladder Elo séparé par surface (K fixe, sans decay)** — recommandation
    n°1 « meilleur joueur selon la surface » (validation Nadal terre battue) ;
    composites `CMPLT = SRV_PTS_WON × RET_PTS_WON`, `SRV_ADV(P1) = SRV_PTS_WON(P1) −
    RET_PTS_WON(P2)`, `MOMENTUM` ; RF accuracy 76,42 % ≈ bookmakers.
  - Willekes (2022) : SHAP → cotes moyennes dominantes, puis aces proportionnels,
    1re/2e balle gagnée, BB sauvées ; surface en dummy simple. MLP/RF 70,3 % vs Elo 67,2 %.
- **Traduction en 7 métriques du widget** : Élo surface 🎯 · Élo global 🌐 · Momentum 🔥
  (payload BSD) · Domination service ⚡ (`serviceGamesWonPct`) · Efficacité retour 🧲
  (`returnGamesWonPct`) · Complétude all-round 🧩 (srv% × ret%, proxy CMPLT) · Pression 💥
  (TB + sets décisifs) — ces 4 dernières via le moteur interne
  `getStatsLeaderboard` (hard/clay/grass × 52w/ytd/all × ATP/WTA).

## [Iter-1] Architecture (miroir foot)

- `src/lib/tennis-top5.ts` — types + définitions métriques + builder pur
  (exige les DEUX côtés valués, pick = max, tri par écart décroissant).
- `src/app/api/tennis/top5/route.ts` — matchs via le cache global partagé du route
  prematch (`__tennisPrematchCache`, zéro hit BSD superflu) + leaderboard DB readonly
  (ATP+WTA fusionnés) + cache réponse 60 s.
- `src/hooks/use-tennis-top5.ts` — SWR par combinaison (métrique×surface×période).
- `src/components/tennis/tennis-strategy-top5-widget.tsx` — 3 Selects (shadcn),
  description émeraude dynamique, lignes A-vs-B avec valeurs par côté et favori vert.
- Montage sidebar `{activeSport === "tennis" && …}` + COMPONENTS.md (54 composants).

## [Iter-2] Test — constats

- Widget rendu, « Élo surface » → 5 lignes ✅ ; mais métriques leaderboard → 0 lignes.
- Diagnostic API directe : `playersInLeaderboard: 0` partout.

## [Iter-3] Causes racines & correctifs

1. **`tennis_matches_internal` vide en dev** (ETL `tools/build-tennis-internal-history.js`
   jamais lancé ici ; 23 197 rows en prod). Fix : repli officiel ATP/WTA
   (`getOfficialLeaderboard`) — même stratégie que `/api/tennis/stats-leaderboard`.
   Les caches officiels ne remplissent que les champs du board demandé (serve→svc,
   return→ret…) → fusion des **3 boards** par joueur avec coalesce des champs nulls
   (399 joueurs fusionnés en dev).
2. **Le filtre surface n'affectait pas les matchs** des métriques payload. Fix :
   mapping tolérant FR/BSD → clé (`surfaceToKey`) + filtrage des matchs avant build
   (« Élo surface × Terre battue » → 5/5 matchs sur terre).

## [Iter-4] Validation

- Sonde navigateur (`scripts/probe-tennis-top5.js`) : widget visible ; Élo surface=5,
  service=2 (les 2 matchs dont les joueurs figurent aux caches officiels), service×terre=0
  (dégradation gracieuse attendue — qualifiés sur Dur), élo×terre=5 ; **0 erreur console**.
- API : serveDominance/returnEfficiency/completeness/pressure → entrées cohérentes,
  picks corrects (ex. Marozsán 80,7 % jeux de service > Kecmanović 79 %).
- TypeScript : `tsc --noEmit` → **0 erreur src/** (5 erreurs introduites puis corrigées).
- Screenshot : `.context/tennis-top5.png`.

## Limites connues & suivi

- [x] ~~Couverture métriques limitée aux caches officiels~~ → résolu par le pipeline V2 ci-dessous.
- [ ] Intégrer la sélection de match au store Top5SelectionPanel (cards côté droit)
  comme le widget foot — non inclus dans ce périmètre.
- [ ] Option : masquer automatiquement les métriques sans données (source coverage).

---

# V2 — Couverture métriques & pipeline de données (boucle d'ingénierie)

**Date** : 2026-08-25 · Constat de départ : les 4 métriques leaderboard ne qualifiaient
que 2/30 matchs (repli officiel ≈ top ~100 ATP) ; table interne vide en dev.

## [Iter-1] Audit des sources

- `tools/build-tennis-internal-history.js` (ETL) : 3 sources propriétaires
  (`api_cache` bsd/espn + archive legacy) — **toutes vides localement**.
- `tools/fetch-tennisabstract-serve-stats.js` (Tennis Abstract) : backfill
  `w_ace…bpFaced` mais **ni SvGms ni points** ; IDs TA 2026 cassés côté serveur TA
  (traceback Python `matching_rows[0]`) et slate dominé par UTR PTT non mappés.
- `tools/backfill-tennis-serve-stats.js` (BSD detail) : pcts seulement, pas de jeux.

## [Iter-2] Découverte clé & peuplement

- **Sonde détail BSD** `/matches/{id}/` : le payload expose NATIVEMENT toutes les
  métriques des thèses — `p{1,2}_first_serve_pct/_first_serve_won_pct`,
  `_second_serve_won_pct`, `_return_points_won_pct`, `_break_points_saved_pct`,
  `_tiebreaks_won`…
- ETL exécuté : `--backfill-days=30` → **3 219 rows** insérées (0 erreur).

## [Iter-3] Nouveau pipeline + bugs corrigés

1. **Nouveau tool** `tools/backfill-tennis-detail-pcts.js` : colonnes pct dédiées
   (`w/l_1st_in_pct`, `_1st_won_pct`, `_2nd_won_pct`, `_ret_pts_won_pct`,
   `_bp_saved_pct`, `_tb_won`), mapping gagnant/perdant via `winner_id`.
   Bugs trouvés/corrigés en route :
   - **Perte WAL** : sans `db.close()` explicite, les commits étaient perdus à
     l'exit (ALTERs persistés, UPDATEs non) → close ajouté ;
   - **Champs à plat** : lecture initiale `player1.first_serve_pct` (inexistant)
     au lieu de `p1_first_serve_pct` → NULL silencieux → fix préfixes ;
   Résultat : **3 211/3 219 rows enrichies** (99,8 %).
2. **Nouveau module** `src/lib/tennis-top5-stats.ts` : agrégation readonly des pct
   par joueur (moyennes, seuil minMatches=3 adapté à une fenêtre ~30 j) +
   TB/sets décisifs via `parseTiebreaks`/`isDecidingSetMatch`. Passage aux
   métriques **points** fidèles à Dryja : `servicePointsWonPct`,
   `returnPointsWonPct` ajoutés à `LeaderboardRow` (+2 littéraux complétés).
3. **Route top5** : source interne prioritaire, repli caches officiels conservé ;
   doublon `surfaceToKey` (local+importé) supprimé → déplacé dans `tennis-top5.ts`.

## [Iter-4] Validation

- API : serveDominance **5 lignes / 1 032 joueurs** (avant : 2/399) — valeurs
  plausibles (JACQUET 61 % vs DOUGAZ 69,9 %…) ; returnEfficiency/completeness/
  pressure OK ; surfaceElo×hard = 5 (Medvedev…).
- Cas « terre » : comportement CORRECT — les matchs terre du programme sont des
  qualifications avec placeholders (`R16P*`) ou <3 matchs d'historique ⇒ état vide
  expliqué à l'utilisateur (« N joueurs suivis »). En prod 52w la profondeur lève ça.
- Widget navigateur : Élo surface 5 ✓, service 5 ✓, 0 erreur console.
- TypeScript : **0 erreur src/** après corrections (3 introduites puis fixées).

## Suivi V2

- [ ] Planifier `backfill-days=30` + `backfill-tennis-detail-pcts.js` en cron VPS
      (pm2) pour maintenir la fraîcheur — cf. ecosystem.config.js.
- [ ] Retenter Tennis Abstract quand les IDs 2026 seront réparés côté TA
      (utile surtout pour l'historique profond >30 j hors BSD).

