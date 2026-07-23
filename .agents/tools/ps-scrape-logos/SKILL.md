---
name: ps-scrape-logos
description: |
  🖼️ Scraping de logos d'équipes et championnats football pour PariScore.
  Workflow en cascade de sources (BSD API → TheSportsDB → API-Football → scraping HTML BSD → fallback initiale)
  pour peupler la table `team_logos` (BSD index vide par défaut).
  Use when: l'index team_logos est vide/incomplet, l'utilisateur demande des logos d'équipes,
  on voit des initiales au lieu de logos dans l'UI, on ajoute de nouvelles équipes/ligues au suivi.
  Triggers: "logo équipe", "logo championnat", "team_logos vide", "scrape logos",
  "récupérer blason", "badge équipe", "initiales au lieu de logo".
---

# 🖼️ PariScore — Scraping logos équipes & championnats

> **Rôle** : Peupler et maintenir la table `team_logos` (SQLite, `pariscore.db`) avec les URLs de logos
> d'équipes et de championnats football, en utilisant une cascade de sources de fiabilité décroissante.

## Contexte technique

- **DB** : `pariscore.db` (better-sqlite3). Schéma de la table `team_logos` :
  ```sql
  CREATE TABLE team_logos (
    bsd_id    INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    short_name TEXT,
    country   TEXT,
    name_norm TEXT NOT NULL,        -- clé de lookup normalisée (cf. _normalizeTeamName dans server.js)
    logo_url  TEXT NOT NULL,
    indexed_at INTEGER NOT NULL
  );
  CREATE INDEX idx_team_logos_norm ON team_logos(name_norm);
  CREATE INDEX idx_team_logos_name ON team_logos(name);
  ```
- **Lookup côté server.js** : `lookupTeamLogo(name)` fait un match exact sur `name_norm`, puis
  fuzzy (`LIKE norm%` ou contient). Le serveur rebuild l'index au démarrage via `rebuildTeamLogosIndex()`
  (pagine `/api/teams/` BSD) — ce skill sert pour les équipes **non** résolues par cet index (équipes
  hors BSD, championnats spécifiques, ou quand BSD est down/sans clé).
- **Normalisation** : `name_norm` = lowercase + strip accents + strip préfixes clubs
  (`fc|cf|ac|ssc|sc|if|ik|kf|ff|afc|asd|cd|club|united|utd|city|sk|ifk|bk|fk|il|tf|vfl|sv|gs|rb|tsg|vfb`) +
  tout sauf alphanum. Reuse `_normalizeTeamName` du serveur pour rester cohérent.

## Quand l'utiliser

- ✅ La table `team_logos` est vide (`SELECT COUNT(*) FROM team_logos` → 0) ou très peu peuplée (< 100).
- ✅ L'UI affiche des initiales/cercles CSS au lieu de logos pour certaines équipes.
- ✅ On suit de nouvelles ligues/équipes non couvertes par l'index BSD.
- ✅ On ajoute un championnat et on veut les logos de league (badge de competition).
- ❌ **Ne pas utiliser** si l'index BSD est déjà peuplé et que BSD est up — `rebuildTeamLogosIndex()`
  côté serveur est plus rapide et plus fiable (3604 équipes d'un coup). Ce skill = fallback/complément.

## Sources en cascade (ordre de fiabilité décroissante)

| # | Source | Endpoint | Clé requise | Couverture | Rate limit | Fiabilité |
|---|--------|----------|-------------|------------|------------|-----------|
| 1 | **BSD API** | `GET {BSD_BASE_URL}/teams/?page=N` puis `{BSD_ROOT_URL}/img/team/{id}/?bg=transparent` | `BSD_API_KEY` (Token) | 3604 équipes (équivalent rebuild serveur) | 1 req/s | 🟢 Très haute — source primaire PariScore |
| 2 | **TheSportsDB** (team logos) | `GET https://www.thesportsdb.com/api/v1/json/{KEY}/searchteams.php?t={name}` → `strLogo` (clé test) ou `strTeamBadge` (clé Pro) | Clé test `3` = gratuite, retourne `strLogo` (PNG) | Equipes mondiales | 2 req/s | 🟢 Haute — test vérifié 15/18 équipes européennes majeures résolues avec clé test `3` |
| 2b | **TheSportsDB** (league logos) | `GET https://www.thesportsdb.com/api/v1/json/{KEY}/lookupleague.php?id={leagueId}` → `strLogo` | Clé test `3` OK | Logos de **championnats/leagues** | 2 req/s | 🟢 Haute — logos league sont gratuits |
| 3 | **API-Football** | `GET https://v3.football.api-sports.io/teams?search={name}` → `team.logo` | `API_FOOTBALL_KEY` (header `x-apisports-key`) | 900+ équipes, logos CDN media.api-sports.io | ~1 req/s (quota plan) | 🟢 Haute — logos team toujours présents |
| 4 | **beSOCCER (CDN resfu)** | `data/resfu-ids.json` (mapping pré-backfillé) → `https://cdn.resfu.com/img_data/escudos/medium/{id}.jpg` | Aucune (CDN public) — mapping peuplé par Camoufox backfill | Équipes La Liga + adversaires collectés en bonus | Lecture JSON (zéro réseau runtime) | 🟢 Haute — CDN public stable, testé 200 OK |
| 5 | **Scraping HTML BSD** | `GET https://sports.bzzoiro.com/matches/{matchId}` → `<img class="team-logo">` | Aucune (page publique) | Logos équipes vus sur un match précis | 1 req/s | 🟡 Moyenne — nécessite de connaître un matchId |
| 6 | **Fallback initiales** | Aucune (généré côté UI) | — | Universel | — | 🔴 Dernier recours — cercle CSS avec initiales |

### Détail des limites par source

**BSD API** (source primaire)
- Clé : `BSD_API_KEY` dans `.env`. Host : `https://sports.bzzoiro.com/api`.
- Pagination : `/teams/?page=N` retourne `{count, results:[{id,name,short_name,country}]}`, ~50/page.
- URL logo construite : `{BSD_ROOT_URL}/img/team/{id}/?bg=transparent` (PNG transparent fond transparent).
- Limite : pas de quota documenté, mais respecter 1 req/s par politesse.
- **Échec si** : clé absente, équipe inexistante dans BSD, ou `team.id` non trouvable par nom.

**TheSportsDB** (logos équipe = gratuits, badges transparents dédiés = Pro)
- Clé test publique : `3` (gratuite, sans inscription). **Retourne `strLogo`** (URL PNG du logo d'équipe) — test vérifié sur 18 équipes européennes majeures (15/18 résolues avec clé test). Le champ `strTeamBadge` (badge transparent dédié) est réservé à la clé Pro.
- Clé Pro : gratuite sur demande à contact@thesportsdb.com (préciser usage projet). Active `strTeamBadge` (qualité supérieure) + retraits de rate limit.
- Endpoint search : `searchteams.php?t={name}` — **fait un match PREFIXE**, donc :
  - "Hammarby IF" → retourne "Hammarby IF Women" (mauvaise équipe). Le script essaie les variantes : nom complet, sans suffixe (`IF|FF|FK|BK|SK|IK|...`), sans préfixe (`FC|CF|AC|SSC|SC|...`), les deux.
  - "PSG" → "PSG Talon" (esports). Utiliser "Paris Saint Germain".
  - Noms en langue locale ("FC Kobenhavn") ne matchent pas → utiliser le nom anglais ("FC Copenhagen").
- `lookupleague.php?id={leagueId}` pour logos de leagues (gratuit).
- Rate limit : 2 req/s max (soft). Le script attend 550ms entre requêtes.
- **Échec si** : équipe absente de TheSportsDB, alias non couvert (acronyme/local-lang), `strLogo` vide (ex: SK Brann n'a que des fanarts, pas un logo — on refuse `strFanart*` car décoratif).

**API-Football** (v3, api-sports.io)
- Clé : `API_FOOTBALL_KEY` dans `.env`. Header : `x-apisports-key: {key}`.
- Endpoint : `https://v3.football.api-sports.io/teams?search={name}` → `response[].team.logo` (URL HTTPS CDN).
- Quota : dépend du plan (Free = 100 req/jour, Mega = 900/s). Un search consomme 1 req.
- Logos CDN : `https://media.api-sports.io/football/teams/{id}.png` — **pas de clé requise pour l'URL CDN elle-même** (seul le search la nécessite).
- **Échec si** : clé absente, quota dépassé (HTTP 429), équipe non listée.

**Scraping HTML BSD** (page match publique)
- URL : `https://sports.bzzoiro.com/matches/{matchId}` — page publique, pas de clé.
- Parse avec cheerio : `$('img.team-logo')` ou sélecteur équivalent ; extraire `src`/`data-src`.
- Nécessite de connaître un `matchId` BSD où l'équipe apparaît (lookup préalable via `/matches/?team={id}`).
- Rate limit : 1 req/s (politesse, c'est notre source primaire, ne pas saturer).
- **Échec si** : structure HTML changée, page JS-rendered (logos injectés après load), matchId invalide.

**Fallback initiales** (toujours disponible)
- Pas de scraping : l'UI génère un cercle coloré avec les 2-3 initiales du nom.
- Déjà géré côté serveur quand `lookupTeamLogo()` retourne `null`.

## Outils

- **Parsing HTML** : `cheerio` (installé en dev, `--no-save`). Crawlee était prévu mais trop lourd /
  incompatible avec l'arbre V2 Next 16/React 19 → on garde cheerio seul (suffit pour du HTML statique).
  **Note** : cheerio peut être élagué par des `npm install` successifs (non listé dans package.json V2).
  Le script `scrape-logos.js` charge cheerio paresseusement et **retombe sur un regex natif** si absent —
  la source 4 (scraping BSD) reste donc fonctionnelle même sans cheerio.
- **Appels API JSON** : `fetch` natif Node 24 (plus simple que `httpsGet` maison, même résultat).
- **DB** : `better-sqlite3` (dépendance native runtime — peut nécessiter rebuild sous nouveau Node).
  Le script fait un `require()` paresseux : `--dry-run` et `--list-sources` marchent même si la build
  native manque (utile en dev).
- **Rate limiting** : `await sleep(ms)` simple entre reqs (550ms TheSportsDB, 1000ms BSD).

## Résultats de test (référence — 2026-07-12)

Test dry-run sur 18 équipes européennes majeures avec config minimale (BSD_API_KEY absente,
API_FOOTBALL_KEY absente, THE_SPORTSDB_KEY=test "3") :
- **15/18 résolus (83%)** via TheSportsDB seul (clé test gratuite).
- **Échecs (3)** : SK Brann (que fanarts), PSG (acronyme → esports "PSG Talon"), FC Kobenhavn (langue locale).
- Variante suffixe/préfixe strip éprouvée : Hammarby IF, FC Barcelona, AC Milan, SSC Napoli, SC Braga résolus.
- Cache DB vérifié : ré-exécution sert depuis `team_logos` (zéro appel API).
- Source 4 (scraping BSD) vérifiée sur match 1 (Liverpool vs Bournemouth) : extrait `https://sports.bzzoiro.com/img/team/1/`.

**Implication prod** : avec juste une clé TheSportsDB gratuite, on couvre ~83% des équipes majeures.
Les 17% restants (acronymes, équipes mineures, langues locales) nécessitent BSD_API_KEY (source 1)
ou API_FOOTBALL_KEY (source 3) — d'où l'importance de la cascade complète.

## Workflow d'exécution

### Phase 1 — Inventaire
```
1. Vérifier l'état de l'index : node -e "..." → SELECT COUNT(*), MAX(indexed_at) FROM team_logos
2. Si vide ou < 100 lignes → cible: remplir en masse via cascade
3. Lister les équipes/leagues manquantes (depuis les matches actifs en DB, ou liste fournie par l'utilisateur)
4. Checker les clés dispo : BSD_API_KEY (présente ?), API_FOOTBALL_KEY (présente ?), THE_SPORTSDB_KEY (Pro ?)
```

### Phase 2 — Cascade par équipe
Pour chaque nom d'équipe, essayer dans l'ordre, **stop au 1er succès** :
```
1. BSD API search (si BSD_API_KEY) → /teams/?search= ne filtre pas (bug BSD connu), donc
   on doit soit paginer tout, soit faire un search puis filtrer côté client par name_norm.
   Pratique : si l'index team_logos est déjà rempli par rebuildTeamLogosIndex, lookupTeamLogo(name) suffit.
2. TheSportsDB (si clé Pro pour badges) → searchteams.php?t={name}
3. API-Football (si API_FOOTBALL_KEY) → teams?search={name}
4. Scraping BSD (si matchId connu pour cette équipe) → parse img.team-logo
5. Fallback initiales (rien à scraper, juste marquer comme non-résolu)
```

### Phase 3 — Écriture cache
```js
const insert = db.prepare(
  'INSERT OR REPLACE INTO team_logos (bsd_id, name, short_name, country, name_norm, logo_url, indexed_at) VALUES (?,?,?,?,?,?,?)'
);
insert.run(bsdId, name, shortName, country, normalize(name), logoUrl, Date.now());
```
- `bsd_id` : obligatoire (PK). Pour sources non-BSD (TheSportsDB/API-Football), générer un ID négatif
  (`-1000000 - hash`) ou utiliser un range réservé (ex: `-1` à `-999999` = source externe) pour éviter
  collision avec IDs BSD réels. Documenter le convention dans le script.
- Toujours écrire même les échecs partiels (logo trouvé mais bsd_id inconnu → bsd_id = 0 ou négatif).

### Phase 4 — Rapport
- Compter : `found` (logo obtenu), `failed` (cascade épuisée sans logo), par source utilisée.
- Afficher : `X logos trouvés (BSD: A, TheSportsDB: B, API-Football: C, scraping: D), Y échecs`.

## Anti-patterns

- ❌ Lancer la cascade sans d'abord checker si `lookupTeamLogo` (côté serveur) résout déjà — gaspillage.
- ❌ Ignorer le rate limit → 429/IP ban côté TheSportsDB ou BSD.
- ❌ Surcharger `team_logos` avec des doublons de name_norm (tjrs `INSERT OR REPLACE`).
- ❌ Utiliser une clé Pro TheSportsDB sans la documenter comme limitation dans le rapport.
- ❌ Scraper BSD HTML en rafale (> 1 req/s) — c'est notre source primaire, la préserver.

## Limites & recommandations prod

- **Source 1 (BSD)** reste la référence : pour la prod, activer `rebuildTeamLogosIndex()` côté serveur
  au démarrage (une fois / 30j) couvre 3604 équipes. Ce skill = complément pour le reste.
- **TheSportsDB** : n'investir dans une clé Pro que si BSD + API-Football ne suffisent pas (rare).
- **API-Football** : clé Free (100 req/jour) suffit pour un backfill ponctuel de ~100 équipes/jour.
- **Scraping BSD HTML** : fragile (dépend du DOM), à n'utiliser qu'en dernier recours manuel.
- **Recommandation** : pour la prod, brancher une route serveur `POST /api/v1/logos/refresh` qui appelle
  `rebuildTeamLogosIndex()` (déjà codé), puis ce script en complément pour les équipes non-BSD.

## Référence script

Le script autonome `scripts/scrape-logos.js` implémente cette cascade (wrapper CLI fin
autour du module partagé `lib/logo-cascade.js`). Usage :
```bash
node scripts/scrape-logos.js "Arsenal,Chelsea,Real Madrid"
node scripts/scrape-logos.js --from-file teams.txt
node scripts/scrape-logos.js "Arsenal" --dry-run   # sans écrire en DB
```

## Workflow runtime (live enrichissement)

En plus du CLI ponctuel, l'enrichissement live est automatisé côté serveur via :

- **`lib/logo-cascade.js`** — module partagé : cascade équipes (4 sources) + cascade
  championnats (table curatée top leagues → BSD image_path → TheSportsDB lookupleague).
- **`services/liveLogoEnricher.js`** — worker démarré dans `bootInit()` (server.js),
  cron 60s + 1er tick boot 90s. Scanne `db.matches`, cache-first (`team_logos` + `league_logos`),
  cascade en miss, attache `m.home_logo`/`m.away_logo`/`m.league_logo_url`, broadcast SSE
  `matches_update` si changements. Dédup via Set in-memory + cache DB.
- **`scripts/enrich-live-logos.js`** — CLI standalone pour backfill/test/dev. Modes
  `--once` (1 snapshot SSE), `--watch` (SSE continu avec backoff), `--audit` (liste manquants),
  `--from-db` (backfill depuis `match_stats_history`).

Table `league_logos` (miroir de `team_logos`) créée idempotemment dans `initSQLite()` :
`bsd_league_id PK, name, name_norm, country, sport, logo_url, source, indexed_at`.

Sources logos CHAMPIONNATS (par ordre de fiabilité) :
| # | Source | Couverture | Fiabilité |
|---|--------|------------|-----------|
| 0 | Table curatée `TOP_LEAGUE_LOGOS` | 20 top leagues mondiales (EPL, La Liga, Serie A, Bundesliga, Ligue 1/2, UCL, UEL, MLS, etc.) | 🟢 Instantanée, 100% |
| 1 | BSD `image_path` | Logos fournis par BSD dans le flux events | 🟢 Haute |
| 2 | TheSportsDB `lookupleague.php` | Toutes leagues répertoriées (free key "3") | 🟡 Moyenne (listing par pays limité à 5/pays en free) |

## Fix propagatio IDs BSD (2026-07-23) — Phase A

**Cause racine des logos absents en Football Live** : BSD expose `home_team_id` (int) dans
`/api/v2/events/`, mais `fetchBSDMatches` (server.js) mappait uniquement `home_team` (string) et
**jetait l'ID**. Or le frontend `pariscore.js:teamLogoImg()` construit l'URL logo
`/img/team/{home_bsd_id}/?bg=transparent` **directement depuis l'ID** — sans propagation de cet ID,
les logos BSD n'apparaissaient jamais, même avec `team_logos` peuplé.

**3 points de fix appliqués** (`server.js`) :
1. `fetchBSDMatches` (~l.15485) — ajout `home_bsd_id: e.home_team_id || null` + `away_bsd_id`.
2. `fetchBSDTeamFixtures` (~l.16278) — **bug sémantique corrigé** : `home_team_id: e.home_team?.id`
   (ID BSD envoyé vers le CDN API-Football = 404) → `home_bsd_id` (CDN BSD = correct).
3. `_bsdWsTryInjectMatch` (~l.49541) — propagation des IDs équipes sur les matchs synthétiques WS.

→ Couverture **immédiate** de ~3600 équipes BSD via `/img/team/{id}/` (testé 200 OK PNG),
sans dépendre du peuplement de `team_logos`.

## Endpoints logos (DB consultation + refresh)

| Endpoint | Méthode | Rôle |
|----------|---------|------|
| `/api/v1/team-logo?name=...` | GET | Lookup ponctuel (cache 30j, fallback Sofascore/Wikipedia) |
| `/api/v1/team-logos?names=...` | GET | Batch lookup |
| **`/api/v1/logos/teams`** | GET | **Consultation DB** : `?q=<search>&country=<c>&limit=<n>&offset=<n>&bsd_id=<id>`. Retourne `{count,total,results:[{bsd_id,name,short_name,country,logo_url,indexed_at}]}` |
| **`/api/v1/logos/refresh`** | POST | **Force rebuild** `team_logos` (`rebuildTeamLogosIndex(true)`). Répond 202 (async), pagine `/teams/?page=N` puis `/img/team/{id}/`. Le boot ne rebuild que si count<100 OU >30j — cet endpoint permet un refresh manuel. |

**Schéma `team_logos`** (la "DB Logos Equipes foot") :
```sql
CREATE TABLE team_logos (
  bsd_id    INTEGER PRIMARY KEY,    -- ID BSD (positif) ou externalId() négatif [-1.9M;-1M]
  name      TEXT NOT NULL,
  short_name TEXT,
  country   TEXT,
  name_norm TEXT NOT NULL,          -- clé lookup normalisée (normalizeTeamName)
  logo_url  TEXT NOT NULL,          -- /img/team/{bsd_id}/?bg=transparent (BSD) ou CDN externe
  indexed_at INTEGER NOT NULL
);
```

## Source 4 — beSOCCER via CDN resfu (2026-07-23)

**Architecture en 2 temps** (Camoufox pour la découverte, CDN public pour le runtime) :

```
[fr.besoccer.com]  ← WAF Fastly (406 + JS challenge)
       │  scripts/besoccer-backfill-ids.py (Camoufox stealth, ~3min/équipe)
       ▼
[data/resfu-ids.json]  ← mapping {name_norm → resfu_id} persistant
       │  lib/logo-cascade.js sourceBeSoccer() (lecture JSON, zéro réseau)
       ▼
[https://cdn.resfu.com/img_data/escudos/medium/{id}.jpg]  ← CDN PUBLIC, fetch natif 200 OK
```

**Pourquoi ce split** : beSOCCER (`fr.besoccer.com`) bloque tout fetch non-navigateur (HTTP 406 +
Client Challenge Fastly). Mais ses logos sont servis par un CDN public `cdn.resfu.com` **sans
aucune protection** (testé : `equipos/2107.png` = Real Madrid, 200 OK, 353KB HD). Le défi est
uniquement de **découvrir l'ID resfu** (qui n'est PAS dans l'URL beSOCCER, slug-only).

**Workflow backfill** (one-shot, pas de runtime Camoufox) :
```bash
# 1. Backfill : 1 fetch Camoufox/équipe, collecte les adversaires en bonus (~13 équipes/fetch)
python scripts/besoccer-backfill-ids.py --team "Real Madrid"
python scripts/besoccer-backfill-ids.py --from-file teams.txt --limit 50

# 2. Import en DB team_logos (cache-first, filtre faux positifs joueurs)
node scripts/import-resfu-logos.js            # import data/resfu-ids.json
node scripts/import-resfu-logos.js --dry-run  # aperçu
node scripts/import-resfu-logos.js --force    # écrase URLs existantes
```

**Spike de validation (Phase B0)** — `scripts/test-besoccer-stealth.py` + `scripts/inspect-besoccer-dom.py` :
- Camoufox v152.0.4 résout le challenge Fastly → HTTP 200 sur `/team/real-madrid` (vs 406 natif).
- DOM rendu (47KB) expose les shields via `<img class="team-shield" src=".../escudos/medium/{id}.jpg" alt="{team}">`.
- CDN resfu public : `escudos/medium/{id}.jpg` (shield), `equipos/{id}.png` (logo HD 120x),
  `media/img/league_logos/{slug}.png` (championnats), `media/img/flags/round/{cc}.png` (drapeaux).

**Dépendances** : `scrapling[camoufox]` + `camoufox fetch` (Firefox patché ~150MB, une fois).
Runtime cascade : **zéro** (lecture JSON uniquement). Le frontend sert `logo_url` directement.

**Limites connues** :
- Le backfill collecte parfois des joueurs (initiales "D. Dumfries") à côté de shields → filtrés par
  `_PLAYER_NAME_RE = /^[A-Z]\.\s/` dans `sourceBeSoccer` et `import-resfu-logos.js`.
- Couverture limitée aux équipes dont on a crawlé la page + leurs adversaires visibles (matchs récents).
  Pour une couverture large : backfiller les ~100 top équipes mondiales (`--from-file`).
- beSOCCER déployant un WAF pour refuser l'extraction, usage interne PariScore (pas de redistribution).

---

*Skill métier PariScore — scraping logos équipes & championnats.*
