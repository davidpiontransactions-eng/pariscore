# Couverture ligues BSD vs PariScore — Gap analysis (2026-08-09)

> **Objet** : comparer les compétitions disponibles sur l'API BSD
> (`https://sports.bzzoiro.com`, docs officielles `/docs/football/`) avec les
> ligues internes PariScore (`leagues_config.json`, `league-mapping.ts`,
> pipeline rankings) et décider le canal d'intégration pour chaque manquante,
> **à commencer par la 2. Bundesliga**.
>
> **Méthode** : `GET /api/v2/leagues/?limit=200` (+ `include_inactive=true`)
> et `GET /api/leagues/?limit=100` (v1) — résultats **identiques** : 79 ligues,
> toutes `is_active=true`. Vérifié le 2026-08-09 avec le token `BSD_API_KEY`.

---

## 1. Faits établis

1. **BSD couvre 79 ligues** (football). L'Allemagne n'y a que : `5=Bundesliga`,
   `43=DFB Pokal`. **Pas de 2. Bundesliga**, même avec `include_inactive=true`.
2. **`league-mapping.ts` contenait une confusion de sources** : le tableau
   `BSD_LEAGUE_IDS` stockait les ids `leagues_config.json` (alignés API-Football
   v3, ex. 2. Bundesliga = 79) en les présentant comme ids BSD. Or BSD id 79 =
   "Club Friendlies". → le filtre `/matches/?status=finished&league.id===79`
   mélangeait friendlies et 2. Bundesliga (bug corrigé, voir §4).
3. **API-Football est retiré du critical path** (kill-switch v10.77,
   `.env.example`) — pas de clé configurée pour un backfill.
4. **`bsd_config.json`** (legacy server.js) avait déjà un mapping config↔BSD,
   mais avec des trous (Ligue 2, Superliga DK, Primera A CO, Liga Prof. AR…).

## 2. Étapes de l'Engineering Loop

| # | Étape | Résultat |
|---|-------|----------|
| 1 | Explorer la doc officielle BSD (`/docs/football/`: leagues, seasons, standings) | Base URL `/api/v2/`, auth `Authorization: Token`, 79 ligues, résolution saison via `/leagues/{id}/season/` |
| 2 | Comparer compétitions BSD ↔ existant codebase | Table §3 ci-dessous |
| 3 | Détecter les ligues manquantes | 13 slugs internes sans BSD ; 4 2nd divisions absentes du pipeline rankings |
| 4 | Intégrer (2. Bundesliga d'abord) | OpenLigaDB (matchs + classement) + soccerstats rankings + fixes mapping (§4) |
| 5 | Valider | Scraper génère `bundesliga2.json`, fetcher testé (12 matchs/7j), typecheck + eslint OK |

## 3. Comparaison BSD (79) ↔ ligues internes

### 3a. Slugs internes COUVERTS par BSD (ids BSD réels désormais dans `BSD_LEAGUE_IDS`)

| slug PariScore | id BSD | nom BSD |
|---|---|---|
| `ligue1` | 6 | Ligue 1 |
| `ligue2` | 89 | Ligue 2 |
| `epl` | 1 | Premier League |
| `championship` | 12 | Championship |
| `fa_cup` | 39 | FA Cup |
| `league_cup` | 40 | Carabao Cup |
| `laliga` | 3 | La Liga |
| `laliga2` | 38 | Segunda División |
| `bundesliga` | 5 | Bundesliga |
| `seriea` | 4 | Serie A |
| `coppa_italia` | 42 | Coppa Italia |
| `primeira_liga` | 2 | Liga Portugal Betclic |
| `eredivisie` | 10 | Eredivisie |
| `jupiler` | 14 | Pro League (BE) |
| `super_lig` | 11 | Trendyol Super Lig |
| `scot_prem` | 13 | Scottish Premiership |
| `superleague_greece` | 24 | Stoiximan Super League |
| `super_league_swiss` | 15 | Super League (CH) |
| `allsvenskan` | 26 | Allsvenskan |
| `liga_1_romania` | 23 | Superliga (RO) |
| `j1_league` | 49 | J1 League |
| `k_league1` | 50 | K League 1 |
| `argentina_primera` | 85 | Liga Profesional de Fútbol |
| `colombia_primera` | 80 | Categoría Primera A |
| `denmark_superliga` | 84 | Danish Superliga |
| `norway_eliteserien` | 54 | Eliteserien |

### 3b. Slugs internes NON couverts par BSD (`BSD_UNCOVERED_LEAGUES`)

| slug | ligue | canal d'intégration recommandé |
|---|---|---|
| **`bundesliga2`** | 2. Bundesliga | ✅ **OpenLigaDB** (gratuit, sans clé) : premiatch + classement. ✅ soccerstats `germany2` → rankings Home/Away. BSD : achetable $29 one-time (option parité enrichie). |
| `serieb` | Serie B | soccerstats `italy2` (rankings) | BSD $29 |
| `russian_premier` | RPL | suspendu / soccerstats `russia` |
| `scot_champ` | Scottish Championship | soccerstats `scotland2` | BSD $29 |
| `challenge_swiss` | Challenge League | BSD $29 |
| `superettan` | Superettan | soccerstats `sweden2` | BSD $29 |
| `first_league_cze` | First League Tchéquie | soccerstats `czech` | BSD $29 |
| `j2_league` | J2 League | soccerstats `japan2` | BSD $29 |
| `chile_primera` | Primera Chile | BSD $29 |
| `ecuador_serie_a` | Serie A Équateur | BSD $29 |
| `paraguay_primera` | Primera Paraguay | BSD $29 |
| `austria_bundesliga` | Bundesliga Autriche | BSD $29 |
| `australia_a_league` | A-League | BSD $29 |

> ⚠️ `laliga2` (BSD 38) et `ligue2` (BSD 89) sont en réalité **couverts** :
> ils ont été retirés de `BSD_UNCOVERED_LEAGUES` et mappés dans `BSD_LEAGUE_IDS`.

### 3c. Ligues BSD non mappées dans `league-mapping.ts` (potentielles additions)

MLS (18), Liga MX (19/20), NWSL (72), USL Championship (57), Brasileirão
(9/34), Copa do Brasil (35), Chinese SL (52), Ekstraklasa (25), Puchar Polski
(46), Parva Liga (22), Superliga RO (23), Botola (53), Tunisian Ligue 1 (47),
Coupe de Tunisie (48), Veikkausliiga (55), Suomen Cup (56), Copa Colombia
(81), Liga 3 (82), Liga Portugal 2 (88), Libertadores (32), Sudamericana
(33), World Cup qualifiers, Nations League, Coupes continentales…
→ plusieurs ligues sont déjà dans `leagues_config.json` + `bsd_config.json`
(legacy) ; l'ajout côté Next.js se fait en 1 ligne dans `BSD_LEAGUE_IDS` +
`LEAGUE_INFO`.

## 4. Changements implémentés (session 2026-08-09)

1. **`src/lib/league-mapping.ts`** — `BSD_LEAGUE_IDS` = vrais ids BSD (vérifiés
   live) ; `CONFIG_LEAGUE_IDS` = ids legacy conservés en référence ;
   `BSD_UNCOVERED_LEAGUES` = slugs sans source BSD.
2. **`src/lib/openligadb-fetcher.ts`** *(nouveau)* — 2. Bundesliga (`bl2`) :
   résolution saison active, premiatch fenêtre 7 jours (cap 40), classement
   `getbltable` (18 équipes). Sans clé, timeout 15s.
3. **`src/app/api/football/matches/route.ts`** — merge OpenLigaDB dans le feed
   pré-match (source `bsd+openligadb`). La 2. Bundesliga apparaît dans l'onglet
   Football (chip ligue + cartes + lien `/league/bundesliga2/stats`).
4. **`src/app/api/v1/leagues/[league_id]/stats/route.ts`** — ligues non BSD →
   OpenLigaDB (réel) pour `bundesliga2`, mock explicite sinon ; plus jamais de
   filtre sur un id BSD erroné ; `source: "openligadb"` ajouté au type.
5. **`scripts/scrape_rankings.py`** — +4 ligues : `germany2→bundesliga2`,
   `france2→ligue2`, `italy2→serieb`, `spain2→laliga2` (slugs soccerstats
   validés). CRON GitHub Actions régénère quotidiennement.
6. **`scripts/team_name_mapping.py`** — overrides 2. Bundesliga (20+ équipes).
7. **`public/data/rankings/{bundesliga2,ligue2,serieb,laliga2}.json`** générés
   (18 équipes, saison 2026-27) — servis via `/api/football/rankings` (SWR).
8. **`bsd_config.json`** — ajout mappings vérifiés manquants : 62→89 (L2),
   119→84 (Superliga DK), 239→80 (Primera A CO), 128→85 (Liga Prof. AR).

## 5. Prochaines étapes (décision maker/buyer)

- **Parité BSD enrichie 2. Bundesliga** : acheter la ligue à Bzzoiro ($29
  one-time, wiki `bsd-bzzoiro.md`). D'ici là, OpenLigaDB + soccerstats couvrent
  premiatch, classement et rankings H/A sans coût.
- **DB historique gratuite (fait) ↗** : football-data.co.uk (`D2`, 2023-24 →
  2025-26, **918 matchs avec stats + cotes clôture**) + openfootball (`de.2`,
  2020-21 → 2025-26, **1836 matchs** FT/HT). Route
  `GET /api/v1/leagues/bundesliga2/history` pour consommer ; regénérer via
  `node seed_historique_footballdata.js --div D2 --seasons 4` et
  `node seed_historique_openfootball.js --league de.2 --all-seasons`.
- **Étendre OpenLigaDB** à `bl1` (Bundesliga) en backup gratuit si besoin.
- **Brancher `useLeagueRankings`** dans un widget UI (hook existant, JSON prêts).
- **Ajouter les ligues BSD §3c** dans `LEAGUE_INFO`/`BSD_LEAGUE_IDS` selon la
  priorité produit (MLS, Brasileirão, Liga MX…).