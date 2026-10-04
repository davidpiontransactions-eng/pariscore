# TRACEABILITY — Mission 1 & 2 (Handball)

**Date** : 2026-10-04
**Périmètre** : missions handball successives — (1) 2. Bundesliga + ingestion Vitibet, (2) audit/correction Backtesting, (3) 3 ligues **danoises**, (4) **MOL Liga Women** + moteur de backtesting.
**Référence utilisateur** : `https://pariscore.fr/?sport=handball&time=today&view=live`

---

## Livrables

| # | Livrable | Fichier |
|---|----------|---------|
| 1 | Fonctions de calcul Pariscore (Index, Forme, Power, Winrate, seuil O/U) | `src/lib/handball-pariscore.ts` |
| 2 | Correctif racine de la paramétrisation CMP | `src/lib/handball-cmp.ts` |
| 3 | Composant « Score Prédit » (banner marine) | `src/components/handball/handball-score-banner.tsx` |
| 4 | Cartes Prédiction IA (winrate + total) | `src/components/handball/handball-prediction-cards.tsx` |
| 5 | Tableau Statistiques d'équipe (2 onglets) | `src/components/handball/handball-team-stats-table.tsx` |
| 6 | Intégration popup Calendrier | `src/components/handball/handball-match-detail-dialog.tsx` |
| 7 | Vue Backtesting | `src/components/handball/handball-backtesting-view.tsx` |
| 8 | Correctif navigation (sous-onglet) | `src/components/layout/sport-sub-tabs.tsx` |
| 9 | Routing onglet ↔ store | `src/components/handball/handball-tab-content.tsx` |
| 10 | Fixture JSON 2. Bundesliga (données réelles) | `src/lib/fixtures/bundesliga2-handball-2026.json` |
| 11 | Vérification exécutable (35 tests) | `src/lib/__tests__/handball-pariscore.test.ts` |
| 12 | Couche générique Vitibet → Pariscore | `src/lib/handball-vitibet-league.ts` |
| 13 | Binding 3 ligues danoises (23 / 25 / 16) | `src/lib/handball-danish.ts` |
| 14 | Fixture JSON 3 ligues danoises (40 équipes réelles) | `src/lib/fixtures/danish-handball-2026.json` |
| 15 | Bloc splits D/E + forme (ligues couvertes) | `src/components/handball/handball-danish-stats.tsx` |
| 16 | Binding MOL Liga Women (140) | `src/lib/handball-mol-liga.ts` |
| 17 | Fixture JSON MOL Liga (12 équipes + 15 matchs) | `src/lib/fixtures/mol-liga-women-2026.json` |
| 18 | Moteur de backtesting walk-forward | `src/lib/handball-backtest-pariscore.ts` |
| 19 | Vue Backtesting (KPI + courbe + historique) | `src/components/handball/handball-pariscore-backtest.tsx` |
| 20 | Tests Danoises (34) | `src/lib/__tests__/handball-danish.test.ts` |
| 21 | Tests MOL Liga + backtest (27) | `src/lib/__tests__/handball-mol-liga.test.ts` |
| 22 | Badge « Dernière synchro » (Résultats + Backtesting) | `src/components/handball/handball-sync-badge.tsx` |
| 23 | Correctif ingestion : fusion + fenêtre J-7 + garde anti-écrasement | `scripts/scrape-flashscore-handball.js` |
| 24 | Tests de la fusion (10) | `src/lib/__tests__/flashscore-handball-merge.test.ts` |
| 25 | Cron handball 4 h | `ecosystem.config.js:399` |
| 26 | Calibration ν sur 35 matchs réels | `src/lib/handball-goals-calibration.ts` |
| 27 | Seuils Over/Under optimaux (≥ 65 %) | `src/lib/handball-optimal-thresholds.ts` |
| 28 | Type `TopMatchStrategy` + drapeaux + date/heure | `src/lib/handball-top10.ts` |
| 29 | Tableau TOP 10 6 colonnes responsive | `src/components/handball/handball-top10-table.tsx` |
| 30 | JSON mock TOP 10 (12 matchs réels + 3 cas limites) | `src/lib/fixtures/handball-top10-mock.json` |
| 31 | Manifest egress : `2.flashscore.ninja` + Task historique | `ax/hockey-scrapers.yaml` |

---

## Mission 5 — Résultats figés au 28/09 : diagnostic + ingestion 4 h

### 5.1 Cause racine (hiérarchisée)

| # | Hypothèse | Verdict | Preuve |
|---|-----------|---------|--------|
| **H2** | **Défaut structurel d'ingestion** | **Confirmée — 100 %** | Le scripteur ne récupérait que **J-1 et J+0..J+N** (`scrape-flashscore-handball.js:274` + boucle `:300`) puis **écrasait** le fichier (`:330`). Un match « à venir » au run de J-2 était **supprimé** au run de J-1 avant d'avoir jamais reçu son score final. Le snapshot ne pouvait donc structurellement contenir des scores que pour **J-1 et J+0** : une fenêtre glissante de 7 jours ne pouvait **jamais** être remplie par ce fichier. |
| **H1** | Ingestion arrêtée depuis le 28/09 | Très probable (~80 %) — **hors périmètre local** | Les deux sources sont gelées à la même date : `data/flashscore_handball.json` (`scraped_at` 2026-09-28T17:26Z) et `handball_match_history` (`last_run` 2026-09-28T15:23Z). Argument fort : le scripteur écrit **inconditionnellement**, donc un run en échec aurait laissé un fichier **vide** — or il contient 661 matchs, donc **aucun run n'a abouti depuis 6 jours**. |
| **H3** | Cache serveur / SWR | **Écartée** (< 2 %) | TTL 5 min (`results-today/route.ts:10`), garde `matches.length > 0` qui empêche de servir une fenêtre vide (`:47`, `:64`), SWR `refreshInterval: 5 min`. Le cache ne recopie que ce que `loadFinishedWindow` renvoie. |

**Aggravant structurel** : la seule source de profondeur restante, `handball_match_history`, a un cron **HEBDOMADAIRE** (lundi 04:20 UTC). Le 28/09/2026 était un **lundi** → le prochain run est le 05/10. Même avec des crons parfaitement sains, le trou du 29/09→04/10 était structurel.

**Ce qui est sain et n'a pas été touché** : la fenêtre glissante (`handball-results-week.ts:90-101`) est correcte et utilise bien `Date.now()` ; le fuseau Europe/Paris est explicite (`handball-backtest-today.ts:36-55`) ; aucune date figée côté serveur.

### 5.2 Correctifs appliqués

| Correctif | Fichier | Effet |
|-----------|---------|-------|
| **Fenêtre J-7..J-7** | `scrape-flashscore-handball.js:296-315` | Boucle `J-2..J-7` ne remontant que les matchs **ayant un score final** → la fenêtre 7 jours peut enfin être remplie par le snapshot. |
| **Fusion au lieu d'écrasement** | `mergeSnapshots()` | À clé identique, on **préfère l'entrée qui porte un score**. Un score acquis n'est plus perdu quand le feed rejoue un jour. |
| **Garde anti-écrasement** | `main()` | Si le run frais ne rapporte **aucun** score final alors que le fichier précédent en contient → écriture **annulée**, `exitCode = 1`. Un 403/WAF ne peut plus effacer l'historique. |
| **Cron 4 h** | `ecosystem.config.js:407` | `0 23 * * *` → `0 */4 * * *`. |
| **Badge « Dernière synchro »** | `handball-sync-badge.tsx` | 3 états (vert < 6 h / ambre < 24 h / rouge + « cron possiblement arrêté »), affiché dans **Résultats** ET **Backtesting**. |

`mergeSnapshots` et `hasFinalScore` sont **exportés et testés** (10 tests) : upgrade sans-score→score, non-régression score→sans-score, dédup, déterminisme, cas limites, et le scénario « run en échec ⇒ historique conservé ».

### 5.3 ⚠️ Action requise sur le VPS (hors périmètre local)

Je n'ai **pas** accès au VPS : H1 ne peut être ni confirmée ni corrigée d'ici. Commandes à exécuter :

```bash
pm2 ls | grep handball
pm2 logs pariscore-cron-flashscore-handball --lines 50 --nostream
stat -c %y /home/ubuntu/pariscore/data/flashscore_handball.json
```

- Si le `mtime` est ≥ 05/10 → H1 est fausse, le problème est en amont du parseur (feed `f_7_-1_1_en_1` qui ne rend plus les matchs terminés, ou `x-fsign` `SW9D1eZo` expiré — `scrape-flashscore-handball.js:39`).
- Si le `mtime` est figé au 28/09 → relancer : `pm2 restart ecosystem.config.js --only pariscore-cron-flashscore-handball`.
- L'audit du 23/09 listait déjà `pariscore-cron-handball-history` à l'état **stopped** dans pm2 → à vérifier aussi.

## Mission 6 — Calibration ν + recalibrage des seuils (TOP 10)

### 6.1 Le paramètre ν était faux (bug préexistant, mesuré)

J'avais constaté en mission 1 que le modèle ajusté donne un écart-type total de ~4 buts
quand la réalité est ~8, sans le corriger. **Corrigé, avec mesure.**

**Mesure** : 35 matchs RÉELS (scores finaux) relevés sur les 5 pages Vitibet
« Latest results » du 2026-10-04 (6 à 9 matchs par ligue).

| σ du total de buts | Valeur |
|---|---|
| **Empirique, intra-ligue (35 matchs, 5 ligues)** | **7.25** |
| Modèle à ν = 1.3 (`CMP_DEFAULT_NU`) | 4.53 (−38 %) |
| Modèle à ν = 1.0 (Poisson) | 7.62 (+5 %) |

**ν = 1.3 est écarté** : il prédit une dispersion 1.6× trop faible. Les écarts
intra-ligue (5.87 → 9.22) sont moyennés en **variances**, pas en σ bruts : les ligues
ont des moyennes différentes (51 → 64 buts), donc moyenner les σ confondrait la
dispersion inter-ligue avec celle d'un match.

`CALIBRATED_NU = 1.0` est désormais utilisé par **tous les nouveaux chemins** (seuils
TOP 10, seuil de total du popup, backtesting MOL Liga). `CMP_DEFAULT_NU` n'est **pas
modifié** : il conditionne 6 stratégies existantes et un golden figé — c'est un
changement de portée produit, pas une correction de bug.

**Limite assumée** : 6 à 9 matchs par ligue ⇒ erreur-type sur σ de l'ordre de
σ/√(2n) ≈ 2 buts. Les ν **par ligue** ne sont pas distinguables (estimations de 0.9
à 1.3, toutes compatibles avec 1.0). Un calibrage par ligue exigerait ~40+ matchs
chacune — c'est précisément ce qu'apporte la DB d'historique (mission 7).

### 6.2 Effet mesuré sur les probabilités

Le défaut de ν = 1.3 n'était pas « aucune probabilité » mais une **marche** :
avec un λ moyen-corrigé (76.5), `Over 55.5` vaut ~0 % et `Over 51.5` ~100 % — deux
buts d'écart font basculer la probabilité de 0 à 100 %, ce qui n'existe pas sur un
marché. Avec ν = 1.0 la transition est progressive et exploitable.

C'est le mécanisme du symptôme « Over plafonne à 57-58 % » remonté sur le TOP 10.

### 6.3 Cause racine du TOP 10 vide : `bestOverLine`

`src/lib/vitibet/over.ts:60` — le calcul de seuil historique :
1. **exige `scoreErrorSigma() != null`**, or `db.ts:176` exige **≥ 30 matchs
   terminés**. L'ingestion étant bloquée depuis le 28/09, la condition n'est pas
   remplie → **aucun conseil affiché** ;
2. ne connaît que le **total prédit Vitibet**, sans distinguer les forces
   offensives et défensives des deux équipes ;
3. **ignore la cote** — impossible d'appliquer « ≥ 1.15 ».

Remplacé pour le TOP 10 par `calculateOptimalOverGoals` / `calculateOptimalUnderGoals`
(attaque ET défense des deux équipes, ν calibré, seuil de cote). `bestOverLine` reste
utilisé par `handball-vitibet-top10.tsx` (non modifié — hors périmètre).

---

## Mission 7 — Source de données pour l'historique (recherche web)

### 7.1 Contrainte mesurée : les sources actuelles ne peuvent PAS servir

| Source | Test | Verdict |
|---|---|---|
| **Flashscore** `f_7_{day}` | `day=-7` → 85 matchs ; **`-8`, `-10`, `-30`, `-365`, `-800` → 0 octet** | **Plafond dur J-7.** Aucune archive. |
| **Vitibet** `quicktips&date=` | 2026-09 et 2026-10 OK ; **2025-09, 2024-10 renvoient la page du jour** | **1 saison seulement.** |
| API-Sports handball | clé projet (`api-football.com` v3) **refusée** sur l'hôte handball | clé **séparée** requise ; 100 req/jour gratuit |
| the-sports.org | 13 compétitions handball, dont Starligue + Bundesliga | **2/9 ligues** |

Conséquence : la fenêtre 7 jours ne peut être remplie QUE par la table SQLite, et
l'historique 2 saisons ne peut venir d'aucune source actuelle.

### 7.2 Source retenue : BetExplorer (gratuit, sans clé)

`https://www.betexplorer.com/handball/{pays}/{ligue}/{ligue}-{saison}/results/`

- **⚠️ robots.txt (vérifié 2026-10-04)** : `Disallow: /*?year=`, `/*?month=`,
  `/*?page=`, `/*?stage=`… → **les pages datées `/results/?year=&month=&day=` sont
  INTERDITES**. Les **pages de saison (chemin pur, sans query string) sont
  AUTORISÉES**. Le plan d'ingestion n'utilise donc QUE ces dernières.
- Colonnes disponibles : date + heure, équipes, **score final**, **score
  1re/2e période** `(12:13, 16:12)`, et **cotes 1X2** (`data-odd`) sur les pages
  de saison — bonus pour calibrer les ROI.
- Profondeur mesurée (extrait du `<select>` saisons) : Starligue 25 saisons
  (depuis 2002/03), HLA 26, Danish 26, D1 Women 19, 2. Bundesliga 16,
  Proligue 9, D2 Women 17, MOL Liga 17.
- **Volume** : backfill 2 saisons × 9 ligues = **18 requêtes** ; maintenance
  9 requêtes/jour (re-fetch saison en cours + diff par id de match).
- **~33 % d'ECONNRESET** mesurés → retry/backoff obligatoire, intervalle 1,2 s.

### 7.3 Omission d'egress trouvée

`2.flashscore.ninja` **n'était pas** dans l'allowlist de `ax/hockey-scrapers.yaml`
alors que `scripts/scrape-flashscore-handball.js` en dépend. Si le gateway fence la
liste, le cron échoue **en silence** — piste plausible pour H1 (§5.1). Hôte ajouté.

### 7.4 Scraper écrit + backfill exécuté

| Livrable | État |
|----------|-------|
| `scripts/lib/betexplorer-season.mjs` — parseur pur + découverte de saisons | **Fait**, 17 tests |
| `scripts/scrape-handball-history.mjs` — source non conforme retirée, pages de saison branchées, cotes stockées, migration | **Fait** |
| Cron quotidien 00:00 Paris | **Fait** (`ecosystem.config.js:532`) |
| Backfill 2 saisons | **Exécuté** |

**Résultat mesuré du backfill** (`bun scripts/scrape-handball-history.mjs --seasons=2`) :

```
collectés=1260  insertés=598  adjacents(dédup)=662
table handball_match_history : 8 643 matchs
période 2025-08-29 → 2026-10-04 · 1 643 équipes
```

Le trou du 29/09 → 04/10 est comblé. Les 9 ligues cibles sont maintenant peuplées
(2. Bundesliga 163, Starligue 134, Proligue 129, Herre 129, Kvindeligaen 126…).

**3 bugs trouvés et corrigés pendant l'implémentation** (tous détectés par exécution réelle, pas par relecture) :

| Bug | Symptôme | Correctif |
|-----|----------|-----------|
| **Saison future sélectionnée** | Dry-run : `starligue 2027/2028 : 0 matchs` sur les 9 ligues — BetExplorer publie la saison prochencemaine, vide. | Règle auto-correctrice : on avance jusqu'à avoir `SEASONS` saisons RÉELLEMENT peuplées. |
| **Libellé de saison au slash** | 190 pages récupérées, **0 match** : `isoFromDayMonth` attendait `2025-2026`, `discoverSeasonLinks` renvoie `2025/2026` → toutes les dates à null. | Regex `[-/]` + test dédié. |
| **`CREATE TABLE IF NOT EXISTS` n'altère pas** | `SQLiteError: no column named odds_home` sur la base existante. Puis `20 values for 19 columns`. | Migration idempotente `PRAGMA table_info` + placeholders corrigés. |

**Limite assumée** : les pages de saison ne donnent **pas** le score mi-temps (seules
les pages journalières l'ont, et elles sont interdites). `home_half`/`away_half`
restent donc NULL pour ces matchs — seule la stratégie `htLeader` en pâtit. La forme,
le Team Power et les totaux n'en ont pas besoin.

**Bonus** : les pages de saison fournissent les **cotes 1X2 réelles**
(`data-odd="1.40"/"9.47"/"3.77"`), désormais stockées dans `odds_home/draw/away`.
Elles n'étaient pas conservées avant. Impact : les 3 nouvelles colonnes permettent de
remplacer les cotes simulées 1xbet du backtest par des cotes réelles.

### 7.5 TOP 10 branché sur la table d'historique

| Livrable | Fichier |
|----------|---------|
| `loadTeamSeries(teamKey, limit)` + `loadTeamSeriesByNames(names, limit)` | `src/lib/handball-history-db.ts` |
| Route `GET /api/handball/history-series?teams=A\|B&limit=10` | `src/app/api/handball/history-series/route.ts` |
| Hook `useHandballHistorySeries(teams, limit)` | `src/hooks/use-handball-history-series.ts` |
| Branchement TOP 10 (TODO form-store retiré) | `src/components/handball/handball-tab-content.tsx` |

`loadTeamSeries` renvoie `{ gf, ga, atHome }` en ordre **chronologique croissant**
(convention du form-store), avec `atHome[i]` indispensable à la Forme Calculée
pondérée. Une équipe absente de l'historique renvoie **`null`**, jamais `{0,0,[]}` —
le composant distingue « pas d'historique » de « historique vide ».

**Vérifié sur la base réelle** (8 643 matchs) :

```
GOG     n=10 gf=[35,34,29,32,33,35,36,32,33,36] ga=[29,31,…] atHome=[DEDEEEDDEE] moy=33.5/32.1
Hagen   n=10 gf=[37,34,35,41,…]                          atHome=[DEEEDEDEDE] moy=35.0/28.8
Paris Saint-Germain   null (absente de l'historique)
```

Cohérent avec le classement Vitibet de GOG (272:233 en 8 matchs = 34.0:29.1 de
moyenne contre 33.5:32.1 sur les 10 derniers).

**Cache de la route** : 15 min, clé = liste d'équipes + `limit` + **`last_run` de
la table**. Un cron qui passe invalide donc immédiatement, sans attendre le TTL.

### 7.6 Reste à faire

- ~~Recalculer le golden de backtest sur **cotes réelles**~~ → fait en mission 9
  (§ 9.2) : les colonnes `odds_home/draw/away` sont peuplées et exploitées.

---

## Mission 8 — Un backtest qui mesurait l'inverse de la réalité

### 8.1 Le parseur de pages de saison ne gardait que les victoires à domicile

BetExplorer n'entoure que le **vainqueur** de `<strong>`. `parseSeasonRows`
ancrait sa regex de 2ᵉ nom d'équipe sur `</strong>…</a>` : chaîne vide dès que
l'**extérieur** gagnait → ligne rejetée ; un **nul** n'a aucun `<strong>` → ligne
rejetée aussi.

Mesuré sur Starligue 2025/2026 (241 lignes jouées) :

| cause | lignes perdues |
|---|---|
| vainqueur extérieur → `away = ""` | 101 |
| nul → pas de `<strong>` | 19 |
| cellule parasite (footer OddsPortal) | 1 |
| **conservé** | **121** |

**Conséquence** : `handball_match_history` ne contenait que des victoires à
domicile. Un backtest y aurait trouvé un modèle « parfait » à 100 % alors qu'il
n'avait jamais vu une seule défaite à domicile ni un seul nul.

Correction : lecture **positionnelle** via le séparateur littéral `\s+-\s+`
(espaces obligatoires, sinon `St. Raphael` et `Cesson Rennes-Metropole` se font
couper en deux). Le vainqueur se déduit du score `NN:NN`, qui le donne déjà.

→ **121 → 240 lignes** (241 jouées), toutes datées, toutes avec cotes 1X2.

Le test qui aurait dû attraper ça **passait pour la mauvaise raison** : son fixture
portait `<strong>Nantes</strong>` sur un match scoré 27:31 (Limoges vainqueur),
un markup que BetExplorer n'émet jamais. Fixture refaite sur du vrai HTML
couvrant les 3 issues + invariant `["away","draw","home"]`.

### 8.2 Deux autres pertes silencieuses

1. **Dates relatives** — BetExplorer affiche `Today` / `Yesterday` (et non
   `DD.MM.`) pour les matchs récents → `date = null` → rejet. Le cron
   **quotidien** perdait précisément les matchs de la veille. Corrigé par un
   `refDate` transmis à `isoFromDayMonth`.
2. **Chemin « adjacent » de `persist()`** — ne faisait que `UPDATE last_seen` :
   les cotes réelles de la page de saison étaient **jetées** dès qu'un match
   existait déjà à ±1 jour, soit toute la fenêtre déjà couverte par une autre
   source (mesuré : février 2026 → 10 cotes sur 15 matchs, octobre → 2 sur 5).
   Les deux chemins fusionnent maintenant (COALESCE cotes + mi-temps + ligue).

### 8.3 Trois conventions de nommage de ligue

`handball_match_history` recevait la même colonne de 3 scrapers indépendants :

| src | écriture | exemple |
|---|---|---|
| `betexplorer` | `Pays: Ligue` | `France: Starligue` |
| `flashscore` | nom nu | `Starligue` |
| `betexplorer-season` | slug interne | `starligue` |

259 couples (league, src) pour ~150 ligues réelles ; **tout agrégat filtré par
ligue était faux, silencieusement**. Registre canonique
`src/lib/handball-league-registry.ts` — variantes **listées, jamais déduites**
(`Division 1`, 7 lignes src=flashscore, reste de côté : polonais I Liga ou
danois 1. Division, deviner fusionnerait deux ligues distinctes).

Le `GROUP BY` après coalescence retombe exactement : 3 + 134 + 72 = 209 Starligue.

### 8.4 Effet mesuré

| | avant | après |
|---|---|---|
| Table | 8 643 matchs | **8 998** |
| Lignes lues / jouées | 121 / 241 | **240 / 241** |
| Matchs avec cotes | 353 | **1 444** |
| Ligues du registre qui répondent | 7 / 9 | **9 / 9** |
| Biais de résultat (pages de saison) | 100 % domicile | **53.2 / 7.5 / 39.3** |

Contrôle de cohérence : la source **indépendante** `betexplorer` donne
53.5 / 4.8 / 41.8 sur 8 021 matchs. Les deux sources concordent.

---

## Mission 9 — Backtest sur l'historique, 9 ligues, et pourquoi le 1N2 est −16 %

### 9.1 Pas de fixture JSON

La base couvre 2 saisons des 9 ligues avec les cotes BetExplorer. Un JSON figé
n'aurait été que du bruit périmé. `src/lib/handball-backtest-history.ts`
(serveur seul) + route `/api/handball/backtest-db` (cache 30 min indexé sur
`last_run`). **Fail-closed** : ligue inconnue → `result: null` + raison, jamais
une ligue substituée en silence.

La note de méthode annonçait « COTES SIMULÉES » en dur alors que la base a des
cotes réelles → remplacée par `methodologyNote(realOdds, total)`.

### 9.2 ⚠️ Piège d'unité : `leagueMean` est un λ PAR ÉQUIPE

Les lignes affichaient **« Under 129 »** pour des matchs totalisant ~62 buts.
`runPariscoreBacktest` consomme `leagueMean` comme un λ **par équipe**
(`lambdaH = lambdaE = leagueMean`) ; `leagueGoalsPerMatch()` mesure des buts
**par match**. Le prior était donc **doublé**.

Référence qui tranche : `CMP_NEUTRAL_LAMBDA = 28.5` est déjà un λ par équipe.

→ « Under 129 » devient « Under 65 » (total mesuré 62.3). Et le ROI HLA
retombait de **+46.7 % à +10.8 %** : le gain était un artefact.

Verrouillé par test : plage de lignes 30-75 + invariant `goalsPerMatch / 2 ∈ (20, 38)`.

### 9.3 ⚠️ Enquête sur le 1N2 à −16.1 % : le modèle est inutilisable sur ce marché

**Ce qui a été vérifié comme sain** (pour ne pas accuser les données à tort) :

- Équipes : Metz Handball 39 V / 2 N / 1 D sur 42 matchs, Oppenweiler/Backnang
  1 / 35. Ce sont de vrais clubs, pas des artefacts de parse.
- Cotes : somme des probabilités implicites dans 1.05-1.10 pour **1 134 lignes
  sur 1 444**. L'alignement domicile/nul/extérieur est correct.
  (`Metz W vs Achenheim 33-20 → 1.00/37/34.88`, Metz favori à 1.00 : cohérent.)
- Règlement : **558/558** concordants sur la cote engagée, le pick, le résultat
  et le profit. La machinerie de règlement est intacte.
- 2 lignes de cotes impossibles (`80.9/86.73/1.98`, somme 1/p = 0.53) —
  reste à expliquer, 2 sur 1 444, sans effet sur le constat.

**Le modèle, lui, est en cause** — 597 paris 1N2 sur 9 ligues :

| P modèle | n ||winrate réel |
|---|---|---|
| 65-70 % | 98 | 60.2 % |
| 70-75 % | 94 | 68.1 % |
| 75-80 % | 72 | 59.7 % |
| 80-90 % | 84 | 65.5 % |
| **90-101 %** | **249** | **47.8 %** |

- **42 % des paris sont à ≥ 90 % de confiance affichée et se-solvent à 47.8 %** —
  pile une pièce.
- Le bucket « cote 3-99 » (93 paris, cote moy 7.21) perd **−39.1 %**.
- Le moteur place le pari sur le **sous-cote du marché dans 28.3 % des cas**.
- Concordance du sens prédit avec le score réel : **59.8 %**.

**Cause racine identifiée dans le moteur** — deux échelles qui ne se parlent pas :

```ts
predH = Math.round(cmpMean(lambdaH, nuH));   // CMP, conscient de ν
predE = Math.round(cmpMean(lambdaE, nuE));
const w = skellamMatchProbs(lambdaH, lambdaE);  // Skellam, ν IGNORÉ
```

`cmpMean(30, 1.3) ≈ 13.6` (mesuré) alors que `skellamMatchProbs` traite λ comme
la moyenne d'une Poisson. Le score affiché est donc à **~45 % de l'attendu réel**,
et il pointe dans le **sens opposé du pari retenu sur 216 paris sur 558 (39 %)**.

Deux conséquences distinctes, à ne pas confondre :

1. **Bug d'affichage, à corriger** : la colonne « Prédit » est incohérente avec
   le pari juste à côté. Elle ne se comprend pas.
2. **Limite de modélisation, à trancher** : même recalibré, le 1N2 ne paraît
   pas exploitable en l'état (concordance 59.8 %, 28.3 % de paris sur le
   sous-cote). Suspect principal : la gestion de ν — `skellamMatchProbs` suppose
   λ = moyenne, ce qui n'est vrai que pour ν = 1.

### 9.5 ✅ Correctif ν APPLIQUÉ (go reçu le 2026-10-04)

Le go a été vérifié avant d'agir, pour confirmer que le correctif était **local** :
grep des imports de `runPariscoreBacktest` → module base-driven +
`getMolLigaBacktest` (supprimé depuis) + tests. **Aucun chemin live**, donc les
6 stratégies historiques et le golden figé n'étaient pas exposés, et le go
suffisait.

```ts
lambdaH = cmpLambdaForMean(cmpMean(lam.lambdaH, lam.nuH), CALIBRATED_NU);
lambdaE = cmpLambdaForMean(cmpMean(lam.lambdaE, lam.nuE), CALIBRATED_NU);
```

À ν = 1, `cmpLambdaForMean(moyenne, 1) = moyenne` : la conversion est l'identité,
donc tout l'aval (cmpMean, Skellam, scan de lignes) partage une échelle.

| | avant | après |
|---|---|---|
| Score prédit vs pari retenu | 38.7 % d'incohérence | **0.0 %** (197/197) |
| Lignes de total | « Under 129 » | 50-82, médiane à **3.1 buts** du total réel |
| Picks 1N2 à ≥ 99 % | 92 | **0** |
| 1N2 Starligue | −16.1 % | **+6.3 %** |
| 1N2 Proligue | −7.2 % | **+4.4 %** |
| Paris 1N2 retenus | 597 | 197 |

**À ne pas surinterpréter** : 197 paris seulement — les probabilités étant moins
saturées, moins passent le seuil P ≥ 65 %. d2women ressort à −18.6 % et mol /
herre n'ont que 3 paris chacun : leur ROI est du bruit, pas une tendance.

**Ce que le correctif ne répare pas** : la surconfiance résiduelle. P 85-95 %
donne encore 53.6 % de winrate réel (36 pts d'écart), et le moteur place encore
le pari sur le sous-cote du marché dans 34 % des cas. Le correctif répare la
**cohérence mécanique** du moteur, pas sa qualité prédictive sur le 1N2.

### 9.6 ✅ Cotes illisibles — validation par invariant métier

Les cellules de cote sont lues par **position** (`tds[2..4]`), ce qui casse sur
une ligne dont la mise en page diffère (match reporté) :
`SIK Viborg W vs Rodovre W` stockait `80.9 / 86.73 / 1.98`, soit une somme de
probabilités implicites de **0.53** — mathématiquement impossible.

Plutôt que deviner le markup du cas dégénéré, on valide l'invariant métier, plus
fort que n'importe quelle heuristique de sélection : 3 cotes ≥ 1 et
Σ 1/cote ∈ [0.9 ; 1.4]. Triplet invalide → mis à `null` : le match reste (score
bon), il sort du segment 1N2. **Une cote inventée est pire qu'une cote absente.**

**2 lignes réparées** (1 444 → 1 442 avec cotes, 0 incohérent restant) : une
franchement corrompue (somme 0.53), l'autre limite (0.889 — un bookmaker paie
rarement).

⚠️ **Piège trouvé par un test sur données réelles** : un garde-fou à `cote > 1.01`
rejetait les favoris lourds à **1.00 et 1.01 qui sont réels** (`Metz W vs
Achenheim → 1.00/37/34.88`, `Brest Bretagne → 1.01/43.25/33.63`). Seuil ramené à
`< 1`, avec un test dédié qui verrouille ces deux lignes.

### 9.7 Garde-fous ajoutés

- Bandeau si `nFormMatches === 0` : sans forme ajustée, les KPI mesurent le
  prior neutre, pas le modèle.
- Sélecteur affichant `n matchs (n cotés)` par ligue : une ligue sans cote est
  visible comme telle au lieu de produire un ROI muet sur cotes simulées.
- `PARISCORE_MIN_ODDS = 1.15` est un **plancher de valeur**, pas un test de
  valeur/probabilité : il admet des paris à EV négatif (123 sur 597, 20.6 %).
  Non corrigé — paramètre produit, **go requis**.

---

## Mission 3 — 3 ligues danoises (Vitibet 23 / 25 / 16)

### 3.1 Données réelles + bases de ligue dérivées

| Ligue | leagueId | Équipes | Base (buts/équipe) | Buts/match |
|-------|----------|---------|--------------------|------------|
| Herre Handbold Ligaen (M, D1) | 23 | 14 | **31.8** | 63.6 |
| Bambusa Kvindeligaen (F, D1) | 25 | 14 | **28.5** | 57.0 |
| 1. Division Women (F, D2) | 16 | 12 | **25.6** | 51.2 |

Écart de **24 %** entre la plus et la moins scoring. Comparer un club de D2 féminine
au 28.5 « tous championnats » surévaluerait tous ses buts d'environ 11 % : d'où la
`leagueMean` threading dans tout le modèle.

### 3.2 Trois défauts de conception trouvés et corrigés (par les tests)

| Défaut | Symptôme | Correctif |
|--------|----------|-----------|
| **`computePower` insensible à la base de ligue** | La forme `50·(1 + 0.5·log₂(gf/ref) − 0.5·log₂(ga/ref))` se **réduit à log₂(gf/ga)** : `ref` disparaît algebraiquement. Deux bases différentes donnaient EXACTEMENT le même indice. | Passage à des écarts **absolus** vs la moyenne : `50 + 25·tanh((gfAvg−ref)/8) + 25·tanh((ref−gaAvg)/8)`. Contrôle : `fit(ref, ref, ref) = 50` pour tout ref. |
| **Pénalité de lieu annulée par la normalisation** | Normaliser par `2·Σ(w·lieu)` fait disparaître le facteur lieu (présent au numérateur ET au dénominateur) → une série 100 % à l'extérieur ressortait à 100 %. | Normaliser par `2·Σw` (le dénominateur ignore le lieu) → 100 % à domicile, **92 %** à l'extérieur, et le bonus d'amplitude ne peut plus déborder l'échelle. |
| **Crédit de forme non borné** | Le bonus d'écart multipliait des points déjà au max (2) → une équipeominant 100 % à domicile comme à l'extérieur, le clamp masquant la différence. | Crédit par match **borné dans [0, 2]** : `1 ± min(1, |Δ|/8)`. Victoire d'1 but = 1.125 pts, de 8+ = 2.0 ; défaite d'1 but = 0.875 (point de consolation), de 8+ = 0. |

### 3.3 Anomalie vérifiée de la source Vitibet

Le match **Ikast Handbold W – Sonderjyske W** était EN COURS (« 2H ») au scrape. Pour
ces 2 équipes, les 3 tableaux Vitibet ne totalisent pas : Overall annonce 4 matchs /
122:103, Home + Away donnent 5 matchs / 157:123 (et l'onglet Form concorde avec
Home+Away). C'est la **page** qui est mise à jour partiellement pendant un match live,
pas une erreur de scraping. Le test les exclut de la somme mais **vérifie qu'il n'y en a
pas d'autres** — une nouvelle anomalie au prochain scrape le fait échouer.

### 3.4 Intégrité vérifiée par test exécutable

`Home + Away = Overall` sur les **38** équipes cohérentes (buts ET nombre de matchs).
La MOL Liga Women passe le même contrôle sur ses **12/12** équipes sans exception.

---

## Mission 4 — MOL Liga Women (Vitibet 140) + moteur de backtesting

### 4.1 Données réelles

12 équipes, 6 tableaux, **12/12** cohérents. Base dérivée : **29.2 buts/équipe =
58.4 buts/match** (Σ GF 1577 / 27 matchs). La spec annonçait « ~52 à 58 buts/match » pour
le handball féminin européen : la valeur dérivée est au sommet de cette fourchette
(début de saison) — **c'est elle qui fait foi**, une base écrite en dur se
désynchroniserait dès la première journée complète.

### 4.2 ⚠️ Deux limites assumées (données réelles, pas des bugs)

| Limite | Réalité | Traitement |
|--------|---------|------------|
| **15 matchs d'historique** | Vitibet n'expose que **6** matchs terminés (« Latest results »). | Les 6 sont RÉELS ; les 9 autres portent `synthetic: true`. Le moteur les traite à l'identique, mais `nSyntheticMatches` est affiché et chaque ligne est marquée `syn.` + atténuée. Un bandeau le dit explicitement avant les KPI. |
| **Marché 1N2 vide** | 12 équipes / 15 matchs → aucune équipe n'a **3 matchs antérieurs** (`CMP_MIN_HISTORY`) → le modèle ajusté ne s'active jamais (`nFormMatches = 0`), toutes les prédictions retombent sur le prior neutre symétrique où le favori plafonne à **47.4 %** (sous le seuil 65 %). | Le seuil n'est **pas abaissé** : le backtest doit mesurer le modèle déployé, pas une variante. `nFormMatches` est exposé pour que ce fait soit lisible au lieu d'être caché dans un ROI flatteur. Un test à 20 journées prouve que le mécanisme de forme s'active dès qu'un historique existe. |

### 4.3 Bug réel du moteur trouvé par les tests

Les clés du store walk-forward étaient `` `h:${equipe}` `` et `` `a:${equipe}` `` :
l'historique d'un club était **scindé en deux seaux selon le lieu**, donc personne
n'atteignait jamais 3 matchs. Symptôme mesuré : **47.4 % sur les 15 matchs**, 0 pari 1N2
retenu. Correctif : **une seule clé par équipe**, le lieu étant porté par `atHome[]`
(déjà présent dans `TeamForm`).

### 4.4 Moteur `runPariscoreBacktest`

- **Walk-forward strict** : la forme est reconstruite sur les matchs strictement
  antérieurs ; le match courant n'est injecté qu'APRÈS sa prédiction.
- **Cotes simulées 1xbet** (favori 1X2 @1.55, nul @12, total @1.9) — Vitibet et le
  snapshot Flashscore ne publient pas les cotes de cette ligue. La `methodology` est
  rendue dans l'UI pour que ce rappel ne puisse pas être raté.
- **KPI** : taux de réussite, ROI flat 1u, profit net en u, **par marché**
  (1N2 vs Total), **progression par journée** (profit cumulé).
- **Seuils** : P ≥ 65 %, cote ≥ 1.15, et refus des lignes de total > 95 %
  (quasi-certitude = défaut de ligne, pas coup gagnant).
- **Cotes réelles** : si `match.odds` est fourni, elles écrasent les simulées.

---

## Graph Engineering Loop — Étape 1 : RECHERCHE

### 1.1 Bug « Statistiques » vide dans le popup Calendrier

Constat de depart : « la pastille Statistiques n'est pas renseignée ».

Le popup **ne** displayait pas la pastille : il n'existait aucune métrique Pariscore.
`HandballMatchDetailDialog` exposait 7 onglets (Score / Analyse / Stats / Over & Buteurs /
Bets / ✨ IA / 📊 Backtest) mais **aucun score prédit**, aucun Index, aucune Forme, aucun
Team Power. Sans tip Vitibet (match hors fenêtre J→J+3, ligue non modélisée, cron en
retard), la ligne « Verdict du modèle » ne montrait qu'un favori + une probabilité.

### 1.2 Bug « sous-onglet Backtesting absent » — CAUSE RACINE

| Étape | Constat |
|-------|---------|
| Symptôme | Le sous-onglet « Backtesting » ne s'affiche pas dans l'onglet Handball. |
| Vérification routage | `SPORT_SUB_TABS` (`src/components/layout/sport-sub-tabs.tsx:17`) ne contenait que `football`, `basketball`, `snooker`. **Aucune clé `handball`.** |
| Vérification condition d'affichage | `SportSubTabs` ligne 63 : `if (!activeSport || !tabs || tabs.length === 0) return null;` → **early return systématique** pour handball. La rangée de sous-onglets n'était jamais rendue. |
| Vérification state | `HandballTabContent` avait un state local `mode: "live" \| "prematch" \| "results" \| "top10"` — **aucune valeur `backtesting`**, et aucun lien vers le store. |
| Vérification CSS | Aucune classe `hidden` en cause : le composant n'était pas monté du tout. |

**Cause racine** : double. (a) handball absent de `SPORT_SUB_TABS` ; (b) `mode` local au
contenu au lieu du store partagé — les deux rangées de navigation ne pouvaient pas
synchroniser. Le même défaut que celui documenté en commentaire à
`football-sub-tabs.tsx:18-20` (« les ids doivent rester synchronisés »).

### 1.3 Analyse Vitibet 2. Bundesliga (`leagueId 43`)

Source : `https://www.vitibet.com/handball/tips/2-bundesliga/germany/43/` (scrape 2026-10-04).

Structure de la page :

| Élément Vitibet | Structure | Équivalent Pariscore |
|---|---|---|
| **Index** | `+8.96` / `−21.82`, signé, > 0 = avantage domicile | `Index Pariscore` (échelle ≈ ±45) |
| **Forecast** | `Score 28:27 (Probabilities: Home 50%, Draw 7%, Away 43%)` | `Score Prédit` + `Winrate 1N2` |
| Colonnes du tableau | `Score` (Score:Buts), `P W D L`, `PTS` | `Buts`, `Matchs joués`, `Victoires`, `Nuls`, `Défaites`, `Points` |
| Onglets de tableau | Overall / Home / Away / Form (last 6) / 1st Half / 2nd Half | `Forme Calculée` (pondération récence) |
| Classement (season 2026) | Hagen 6P 5V 204:164 · Potsdam 5P 5V 150:137 · Leipzig 6P 5V 188:177 · Elbflorenz 5P 4V 195:153 | Team Power (attaque/défense) |
| Prochaine journée | 9 fixtures, ex. `195259 Minden 32:28 Dessauer` | Fixture JSON |

**« Calculated Form » et « Team Power » n'existent pas chez Vitibet** : Vitibet n'expose
qu'un INDEX global et des probabilités. Ces deux métriques sont donc une décomposition
PariScore (cf. §2.2), pas un scraping.

Donnée réelle notable : les scores affichés par Vitibet (32:28, 37:23, 37:31, 30:29) sont
des **scores prédits**, pas des résultats — c'est ce qui alimente le bandeau.

---

## Étape 2 : IMPLÉMENTATION

### 2.1 Métriques Pariscore (`handball-pariscore.ts`)

**Ladder appliqué** : le score prédit et le 1X2 ne sont **pas** réimplémentés — les moteurs
CMP (`handball-cmp.ts`) et Skellam (`handball-skellam.ts`) sont déjà en production, donc
réutilisés (échelon 2 « existe déjà »). Seules les 3 métriques absentes sont nouvelles.

| Fonction | Formule | Notes |
|---|---|---|
| `computeFormPct` | `Σ wᵢ·points(gfᵢ,gaᵢ) / (2·Σwᵢ) × 100`, wᵢ = 0.82^(n−1−i), fenêtre L10 | 0..100. Historique vide → `null` (jamais 0). |
| `computePower` | `50·(1 + 0.5·log₂(gfAvg/28.5) − 0.5·log₂(gaAvg/28.5))`, borné | 50 = niveau de référence league. |
| `computePariscoreIndex` | `6 + 0.25·ΔForme + 0.20·ΔPower` | Signé du point de vue domicile, échelle ≈ ±45 ( comparable Vitibet). |
| `pickTotalThreshold` | scan ±12 buts en pas 0.5 ; bande **65 % ≤ P ≤ 95 %** ; on retient la ligne **la plus proche du total attendu** | null si rien ne passe. |
| `computePariscorePrediction` | Orchestration | Même `formStore` que les 3 paris existants → λs non divergents. |

**Plafond à 95 %** : à 75 buts attendus, la distribution CMP est si serrée qu'« Under 75 »
resort à **100 %** — mathématiquement vrai, invendable. Une quasi-certitude est un défaut
de ligne, pas un coup gagnant ; on refuse de la publier.

**Ligne la plus proche, pas la plus sûre** : « Over 53.5 à 67 % » est le pari jouable ;
« Over 45.5 à 99 % » est vrai mais sans valeur. `HandballRule #11` (simplicité) et le
protocole « ne jamais inventer » imposent de refuser les deux.

### 2.2 ⚠️ Correctif racine : la PMF CMP n'est PAS moyen-paramétrée

En implémentant §2.1 j'ai mesuré un défaut **préexistant** dans `handball-cmp.ts`.

La PMF du moteur est `P(k) ∝ λ^k / (k!)^ν`. Or **λ n'y est pas la moyenne** : ν = 1 est le
seul cas où λ = moyenne. Mesures (`cmpMean`) :

| λ | ν | E[X] |
|---|----|----|
| 28.0 | 1.0 | 28.00 (Poisson exact) |
| 30.0 | 1.3 | **13.57** |
| 28.0 | 1.3 | **12.86** |

Les replis de `fitCMP` renvoyaient `lambda: mean`, donc une distribution centrée à ~13 buts
au lieu de ~30 sur toutes les séries courtes (`n < CMP_MIN_HISTORY`) ou dégénérées (ridge de
Newton). Effet mesuré sur un Over/Under de ligue (`overUnderProb`, λ = 28, ν = 1.3) :

```
AVANT : 48.5 → over 0.0 %   55.5 → over 0.0 %   63.5 → over 0.0 %   (TOUT à zéro)
APRÈS : 48.5 → over 87.4 %  55.5 → over 52.3 %  63.5 → over 12.8 %
```

**Correctif** : nouvelle fonction exportée `cmpLambdaForMean(mean, nu)` (bisection 30 pas,
mémoïsée) qui inverse la relation. Appliquée aux **4 replis** de `fitCMP` (n = 0,
wSum ≤ 0, n < CMP_MIN_HISTORY, Newton non convergé). Test de régression ajouté :
« tous les replis de fitCMP préservent E[X] = moyenne ».

**Contrat préservé** : `CMP_NEUTRAL_LAMBDA` reste une **moyenne** (28.5) et son usage avec
ν = 1 est intact — `resolveLambdas` de `handball-predictive-bets.ts:247-253` pose
déjà `nuH/nuE = 1` en le documentant explicitement. *Premier essai de correctif : j'avais
reconverti la constante en taux, ce qui cassait ce contrat et faisait passer le bet « total »
de l'onglet Bets à 100 %. Annulé.* Le commentaire du test
`handball-predictive-bets.test.ts:317` documente d'ailleurs ce même piège (« bug détecté G3 »).

**Golden de backtest régénéré** (`handball-backtest-regression.test.ts`) : passage de
432 → 439 paris, −119.45 u → −131.10 u. Seules `bestTeam1x2` et `valueBet` bougent (les
deux seules stratégies dépendant des forces CMP ajustées) ; `over55`, `under62`, `btts30`,
`htLeader`, `handicap` sont **inchangés à l'identique**. Golden v1 conservé en commentaire.
Un échantillon de 57 paris ne juge pas la qualité d'un modèle : ce golden reste un
détecteur de changement, pas un judgement de performance.

### 2.3 Composant « Score Prédit » (`handball-score-banner.tsx`)

- Fond `bg-[#0A2E5C]`, `rounded-2xl`.
- En-tête : `Score Prédit` + date/heure Europe/Paris via `Intl.DateTimeFormat` (« 04.10.2026 | 15:00 »).
- Layout 3 colonnes : logo + nom + **5 pastilles** de forme + Power/Forme | score géant + badge `TIP` jaune + Index | logo + nom + 5 pastilles.
- Rendu **avant** les onglets du dialog (première réponse à « quel score ? »).
- Badge `TIP` alimenté par `useVitibetTips().tipFor(match)` — même clé SWR que la carte du
  calendrier, donc **0 requête supplémentaire**.

### 2.4 Cartes Prédiction IA (`handball-prediction-cards.tsx`)

- **Winrate 1N2** : barre tri-couleur (emerald / amber / sky), probabilités % et cotes.
  Badge « Pari Favori » si P ≥ 65 % **et** cote ≥ 1.15.
- **Total Over Goals** : seuil optimal du modèle, ou motif explicite de refus (aucune ligne
  n'atteint 65 %, ou cote < 1.15 → `qualifies: false` sans badge).

### 2.5 Tableau Statistiques d'équipe (`handball-team-stats-table.tsx`)

- Onglets `role="tablist"` / `role="tabpanel"` + `aria-selected` / `aria-controls` /
  `aria-labelledby` : « Statistiques de l'équipe » (actif) et « Tableau des scores ».
- **3 lignes Pariscore surlignées en tête** (bandeau `#0A2E5C` + badge `Pariscore`) :
  Forme Calculée, Team Power, Index Pariscore.
- Puis les stats classiques : Matchs joués, Victoires, Nuls, Défaites, Buts Marqués,
  Buts Encaissés, Points, et les moyennes dérivées des **mêmes** fenêtres que le modèle.
- L'Index Pariscore n'a qu'une valeur (signée du point de vue domicile) : la colonne
  « extérieur » affiche `—` plutôt qu'un miroir inversé, qui serait trompeur.
- Onglet « Tableau des scores » : fusion des 2 historiques, chaque résultat n'occupant que
  la colonne de l'équipe qui l'a joué.

### 2.6 Correction du sous-onglet Backtesting

1. **`sport-sub-tabs.tsx`** — ajout de la clé `handball` (5 entrées, ids alignés sur
   `HandballMode`). Supprime l'early return ligne 63.
2. **`handball-tab-content.tsx`** — `HandballMode` exporté + tables de correspondance
   `SUBTAB_TO_MODE` / `MODE_TO_SUBTAB`. Le `mode` dérive désormais du **store**
   (`useSportsSidebarStore.sportSubTabs.handball`) ; `localMode` ne sert que de repli si le
   store est vide. Les deux rangées de navigation (headbar + pilules internes) écrivent donc
   la même clé → plus de divergence possible.
3. **`handball-backtesting-view.tsx`** — nouvelle vue, 3 sources déjà en production
   (0 route nouvelle) :
   - `/api/handball/backtest` → synthèse (taux de réussite, ROI, volume) + ROI par stratégie ;
   - `/api/handball/backtest-today` → historique des prédictions réglées (20 récents) ;
   - `/api/v1/vitibet?backtest=1` → taux de réussite des tips Vitibet par type (1/X/2).

L'URL `?sub=backtesting` est déjà supportée par `hydrateStoreFromUrl` — le partage de lien
fonctionne sans changement.

---

## Étape 3 : VÉRIFICATIONS

| Gate | Commande | Résultat |
|------|----------|----------|
| Lint ciblé | `bun x eslint --quiet <fichiers>` | 0 erreur |
| Lint complet | `bun run lint` | 0 erreur |
| Typecheck | `bun run typecheck` | 0 erreur |
| Tests handball | `bun test src/lib/__tests__/handball src/lib/__tests__/flashscore-handball-merge.test.ts` | **373 / 373**, 3818 assertions |
| Build Next | `bun run build` | compile ✓ · TypeScript ✓ · 168/168 pages ✓ · **copie standalone bloquée par ENOSPC** (disque à 119 Mo — blocage environnemental ; purge `.next/standalone` + `.next/cache` → 6.68 Go libres) |

### 3.1 Couverture du test exécutable (35 tests)

| Bloc | Ce qui casse si le cas casse |
|------|------------------------------|
| `cmpLambdaForMean` | E[X] du taux inversé = moyenne demandée, pour ν ∈ [1, 3] et 5 moyennes ; contrat « CMP_NEUTRAL_LAMBDA est une moyenne » ; les 4 replis de `fitCMP` ; Over 55.5 plausible |
| `computeFormPct` | 100 % / 0 % aux extrêmes ; `null` si vide ; borné 0..100 sur les 7 équipes réelles ; monotonie |
| `computePower` | 50 au niveau de référence ; ≈100 / ≈0 aux extrêmes ; défense de signe inverse ; borné sur la fixture |
| `computePariscoreIndex` | = avantage terrain seul si équipes égales ; > 6 si domicile meilleure ; signé correct côté extérieur ; \|index\| ≤ 45 ; pas de throw si équipe inconnue |
| `pickTotalThreshold` | bande [65, 95] ; refus de la ligne dégénérée « under 75 » ; ligne conservative ; `qualifies` false sous 1.15 / true au-dessus ; contrat taux-vs-moyenne |
| `computePariscorePrediction` | score prédit dans la plage de ligue (50–65) vs 59 prédit par Vitibet ; winrate somme à 100 ± 0.35 ; hasForm=false sans historique ; historique partiel ; les 9 fixtures réelles ; cotes traversées ; champion vs 7e |

### 3.2 Traçabilité de l'honnêteté des données

Le JSON porte un bloc `_meta.avertissements` qui distingue explicitement :
- `standings` et `fixtures` → **données réelles** lues sur Vitibet (leagueId 43) ;
- `formSeries` → **séries reconstituées** à partir des agrégats réels GF:GA, pour exercer
  les métriques sur une fenêtre L10. Ce ne sont **pas** les 10 derniers matchs réels ;
- `vitibetPredictedHome/Away` → scores **prédits** par Vitibet, pas des résultats.

`oddsSimulees` est isolé et commenté comme tel : aucune cote réelle 2. Bundesliga n'est
stockée, ces valeurs servent uniquement à valider le chemin « cote ≥ 1.15 ».

---

## Hors périmètre — signalé, non fait

| Point | Pourquoi |
|-------|----------|
| **Backfill réel des séries L10** | `formSeries` est reconstitué. Brancher l'historique SQLite réel (`handball-history-stats.ts` → `TeamHistoryStats.scoredSeries/concededSeries`) ferait disparaître l'avertissement. Le dialog reçoit déjà ce type de données pour l'onglet Stats. |
| **Historique MOL Liga** | ~~6 matchs réels sur 15~~ → **FAIT** : la table d'historique apporte 67 matchs réels avec cotes sur 34 d'entre eux. Le fixture JSON et ses 9 entrées `synthetic` ne sont plus utilisés par le backtest. |
| **Marché 1N2 du backtest** | ~~Vide sur l'échantillon MOL Liga~~ → **FAIT** : 597 paris 1N2 sur 9 ligues, avec cotes réelles. **Mais** l'enquête du §9.3 conclut que le modèle y est inexploitable (concordance 59.8 %, 28.3 % de paris sur le sous-cote, 42 % des picks à ≥90 % de confiance pour 47.8 % de réussite). Correction proposée, **go requis**. |
| **Design de `CMP_DEFAULT_NU = 1.3`** | ~~Recalibrer ν est un chantier à part~~ → **FAIT en mission 6** : mesuré sur 35 matchs réels, σ empirique 7.25 contre 4.53 au modèle. `CALIBRATED_NU = 1.0` est désormais utilisé par tous les nouveaux chemins. `CMP_DEFAULT_NU` n'est **pas** modifié (6 stratégies existantes + golden figé = changement de portée produit, pas correction de bug). |
| **Backfill historique** | Flashscore plafonné à J-7, Vitibet à 1 saison (mesuré, §7.1) → **BetExplorer, pages de saison uniquement** (robots.txt interdit `?year=`/`?month=`). Scraper + table : **FAIT** mission 7, étendu mission 8 (8 998 matchs). |
| **Cotes de total réelles par ligne** | `pickTotalThreshold` accepte `oddsByLine`, mais aucune source ne fournit aujourd'hui des cotes O/U par ligne (le snapshot ne porte que `over55`/`under62`). L'UI affiche `—` pour la cote et n'affiche le badge « Pari » que si la proba passe. |
| **Bouton de calibration** | Le Ladder shortened ici le scan de lignes (pas 0.5 fixe, ±12 buts). Le pas 0.5 correspond aux lignes de marché handball réelles ; la calibration future passerait par les lignes réellement observées. |
| **Suppression des 3 widgets backtest du bas** | `HandballVitibetBacktest`, `HandballBacktestWidget`, `HandballBacktestMatrix` restent montés sous le calendrier. La nouvelle vue les **agrège**, elle ne les remplace pas — évite de casser les liens et la QA existants. |

---

## Récapitulatif des missions

| # | Mission | État |
|---|---------|------|
| 1 | 2. Bundesliga : métriques + ingestion Vitibet | **Terminé** |
| 2 | Backtesting : cause racine + vue + navigation | **Terminé** |
| 3 | 3 ligues danoises (23/25/16) | **Terminé** |
| 4 | MOL Liga Women + moteur de backtesting | **Terminé** |
| 5 | Résultats figés 28/09 : diagnostic + ingestion 4 h | **Terminé** — correctif VPS en attente (§5.3) |
| 6 | Calibration ν + seuils Over/Under ≥ 65 % | **Terminé** |
| 7 | Source d'historique 2 saisons | **Terminé** — parseur + cron quotidien + backfill exécuté + TOP 10 branché |
| 8 | Parseur biaisé + 3 noms de ligue | **Terminé** — 121 → 240 lignes, biais 100 % domicile → 53/7/39, cotes 353 → 1 444 |
| 9 | Backtest historique 9 ligues + enquête 1N2 | **Terminé** pour la livraison · **diagnostic 1N2 livré, correction en attente de go** (§9.3) |
| TOP 10 | Date/heure + drapeaux + tableau 6 colonnes | **Terminé** |

### Bugs préexistants trouvés et corrigés

| Bug | Fichier | Effet mesuré |
|-----|---------|--------------|
| Parseur de pages de saison ancré sur `<strong>` | `scripts/lib/betexplorer-season.mjs` | Ne conservait que les **victoires à domicile** (121/241). Un backtest y trouvait 100 % de réussite. Lecture positionnelle → 240/241. |
| Dates relatives `Today`/`Yesterday` rejetées | `scripts/lib/betexplorer-season.mjs` | Le cron **quotidien** perdait les matchs de la veille. |
| Cotes jetées sur le chemin « adjacent » | `scrape-handball-history.mjs` | `UPDATE last_seen` seul : les cotes réelles disparaissaient quand le match existait déjà (fév. 2026 = 10 cotes/15). |
| 3 conventions de nommage de ligue | `src/lib/handball-league-registry.ts` | 259 couples (league, src) pour ~150 ligues ; tout agrégat par ligue était faux. |
| `leagueMean` en buts/match passé comme λ/équipe | `src/lib/handball-backtest-history.ts` | Prior **doublé** : lignes « Under 129 » pour des matchs à ~62 buts ; ROI HLA gonflé de +10.8 % à +46.7 %. |
| `METHODOLOGY` en « COTES SIMULÉES » en dur | `handball-backtest-pariscore.ts` | Un ROI calculé sur cotes réelles était étiqueté « simulé ». Remplacé par `methodologyNote`. |
| PMF CMP non moyen-paramétrée | `handball-cmp.ts` | Replis de `fitCMP` centraient à 13 buts au lieu de 30 ; tous les Over/Under sortaient à **0.0 %**. Corrigé via `cmpLambdaForMean`. |
| `computePower` insensible à la base de ligue | `handball-pariscore.ts` | Le terme `ref` s'annulait algébriquement : deux bases différentes donnaient le même indice. Passé en écarts absolus. |
| Pénalité de lieu annulée | `handball-pariscore.ts` | Normaliser par `Σ(w·lieu)` faisait disparaître le facteur. Dénominateur corrigé → 92 % hors domicile. |
| Crédit de forme non borné | `handball-pariscore.ts` | Bonus d'écart qui débordait l'échelle, clamp masquant la différence. Crédit borné dans [0, 2]. |
| Store walk-forward scindé | `handball-backtest-pariscore.ts` | Clés `h:` / `a:` : historique d'un club réparti par lieu → 47.4 % partout, 0 pari 1N2. |
| Ingestion incapable de remplir 7 jours | `scrape-flashscore-handball.js` | J-1..J+7 + écrasement : un match à venir à J-2 était supprimé avant son score. Fusion + remontée J-7 + garde anti-écrasement. |
| ν sous-dispersé (TOP 10) | `handball-goals-calibration.ts` | σ 4.53 vs 7.25 mesuré sur 35 matchs réels. `CALIBRATED_NU = 1.0` pour les nouveaux chemins. |
| `bestOverLine` exige ≥ 30 matchs | `vitibet/over.ts` | Aucun conseil affiché dès que l'ingestion décroche. Contourné pour le TOP 10, fonction d'origine laissée intacte. |
| `2.flashscore.ninja` absent de l'allowlist | `ax/hockey-scrapers.yaml` | Si le gateway fence, le cron échoue en silence. Hôte ajouté. |

### Bugs trouvés et NON corrigés (décision de portée produit)

| Bug | Fichier | Pourquoi pas corrigé |
|-----|---------|---------------------|
| `MIN_ODDS = 1.15` est un plancher de valeur, pas un test de valeur/probabilité | `handball-backtest-pariscore.ts` | Admet des paris à EV négatif (123/597, 20.6 %). Le seuil est un **paramètre produit** : le changer modifie le nombre de paris émis, donc le comportement de toutes les stratégies qui l'utilisent. **Go requis.** |
| `CMP_DEFAULT_NU = 1.3` | `handball-cmp.ts` | 6 stratégies historiques + golden figé en dépendent. `CALIBRATED_NU = 1.0` utilisé par les nouveaux chemins (§6.1) et désormais par le backtest (§9.5). |
| Surconfiance résiduelle du modèle 1N2 | `handball-backtest-pariscore.ts` | Après le correctif ν, P 85-95 % donne encore 53.6 % de winrate réel (36 pts d'écart). Le modèle reste à peine meilleur qu'une pièce sur ce marché. Recalibration = recherche, pas correctif. |
| `TOTAL_PROB_CEILING` / lignes de total par ligue | `handball-backtest-pariscore.ts` | Le scan balaie ±12 buts autour de l'attendu du modèle. Les **lignes réellement observées** par ligue (O/U) ne sont pas dans la table — `odds_by_line` est inexistant. Le "bouton de calibration" reste ouvert. |
