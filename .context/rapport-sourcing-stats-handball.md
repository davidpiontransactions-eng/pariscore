# Rapport — Sourcing des stats handball : `opel-hbl.de` & `handballstats247.com`

> **Date** : 2026-09-27 · **Demande** : lire/analyser les 2 sites, dire ce qu'on peut scraper pour enrichir la BDD PariScore, livrer un `.md`, et statuer sur un scraping **à 100 %** avec les meilleurs agents.
> **Méthode** : sondes HTTP réelles (≈ 55 requêtes GET, 1 s de pause, UA navigateur), recon déléguée à un agent (`general`) pour l'API opel-hbl, sondes manuelles pour handballstats247.
> **Contexte projet** : bead `ParisScorebis-wvwv` (stats équipes Bundesliga = source racine introuvable aujourd'hui : `src/lib/lnh-stats.ts` ne lit que `data/lnh_*.json` = StarLigue/LNH France), pattern existant à répliquer : snapshot `data/*.json` → reader `src/lib/*-stats.ts` → route `/api/handball/analysis` → onglet « Stats équipes ».

---

## 1. Verdict en une ligne

| Site | Technique | Coûat / licence | Verdict « 100 % » |
|---|---|---|---|
| **www.opel-hbl.de** (source officielle HBL) | API JSON publique, **sans auth**, sans quota | **Gratuit**, robots.txt absent (404), aucune CGU anti-scraping trouvée | ✅ **OUI — 100 % récupérable** (≈ 8-12 GET par run, ~1,5 Mo) |
| **www.handballstats247.com** (agrégateur tiers) | Next.js + Cloudflare, pages **SSR** (classements en HTML) | Gratuit « personal/editorial use » **MAIS CGU interdisent explicitement le scraping automatisé** + `robots.txt` interdit `/api/` et `?*` | ❌ **NON — à ne pas工业化** (source de vérification ponctuelle manuelle uniquement) |

**Recommandation** : pipeline complet sur **opel-hbl.de uniquement** ; handballstats247 réservé à des contrôles ponctuels manuels ou à un partenariat officiel (le site propose un programme « Widgets »).

---

## 2. Site A — `www.opel-hbl.de` (opinions : la source à工业化iser)

### 2.1 Architecture observée

Site **Nuxt 3 (SSR)**, 3 couches :

| Couche | Hôte | Rôle | Utile ? |
|---|---|---|---|
| CMS pages/nav | `www.opel-hbl.de/api/config`, `api/content` | textes, arborescence | non |
| Vidéo OTT | `ott.opel-hbl.de/api/v3/contents/` | highlights vidéo, DRM, géo-restrictions | **non** (faux positif fréquent) |
| **Stats** | **`www.opel-hbl.de/api/synergy/*`** | proxy same-origin → **Sportradar Synergy** (org `h1s44`) | ✅ **oui** |

- Upstream direct `api.dc.connect.sportradar.com` → **401 Unauthorized** (token serveur) → **inutilisable**, et de toute façon produit **commercial payant**.
- `robots.txt` → **HTTP 404** (aucune restriction publiée).
- En-têtes : `cache-control: public, max-age=60`, **aucun header `rate-limit`**, aucun 429 observé (39 requêtes à 1 req/s).
- **Pas d'en-tête CORS** → appelable **uniquement côté serveur/scraper** (pas depuis le navigateur) → parfait pour un cron serveur.
- reCAPTCHA présent dans la config (`siteKey`), **jamais déclenché** sur ces GET.

### 2.2 Identifiants vérifiés

```
competitionId HBL (DAIKIN/Opel HBL) : 4c445e5c-3956-11ef-9d0e-b74f5c057367
competitionId 2. HBL                : 4c5a3af0-3956-11ef-9b6c-b74f5c057367
saison ACTIVE HBL   : c4a3125f-79f2-11f1-9a19-5f7c8c2ed877  ("Opel HBL 2026/27", start 2026-08-27)
saison ACTIVE 2.HBL : c4a17ef0-79f2-11f1-a11a-bd92ba3d42e7  ("2. Handball-Bundesliga 2026/27")
Saisons disponibles : 63 (HBL, 1980/81 → 2026/27) et 16 (2. HBL) — status DRAFT|PENDING|ACTIVE|COMPLETE
```

### 2.3 Endpoints (tous **GET, HTTP 200, sans token**)

| Endpoint | Params | Payload réellement observé | Taille | Confiance |
|---|---|---|---|---|
| `/api/synergy/seasons` | `competitionId` | 63 / 16 saisons (`seasonId, year, status, nameLocal, standingConfigurationId`) | 88 / 22 Ko | haute |
| `/api/synergy/standings` | `seasonId` | **18 clubs** (`position`, `points`, `calculated.OVERALL.{played,wins,draws,losses,scoredFor,scoredAgainst,standingPoints}`, `roundNumber`) | 220 Ko | haute |
| `/api/synergy/season-statistic/team-overview` | `seasonId` (+ `roundCode`, `entityId`) | **18 clubs × 43 stats** : `games, goalsScored, shots, shootingAccuracy, field/backCourt/wing/pivot/nineMetre/sevenMetre/fastBreakGoalsScored, goalKeeperGoalsAgainst, goalKeeperShotsSaved, goalKeeperSaveAccuracy, blocks, steals, twoMinuteSuspensions, yellow/red/blueCards…` | 77 Ko | haute |
| `/api/synergy/season/teams-in-season` | `seasonId` | 18 entités club (`nameFullLatin`, `codeLatin`, `images[]` type LOGO) | 61 Ko | haute |
| `/api/synergy/season-statistic/player-overview` | `seasonId` + `statisticType=fieldplayer\|goalkeeper` | **309 joueurs** : buts, passes, tirs, précision, vitesse, distance, temps de jeu (`PT122M50S`) / stats gardiens (`goalKeeperSaveAccuracy`, par zone 7m/aile/pivot/9m/défense rapide) | 955 / 990 Ko | haute |
| `/api/synergy/season/rounds` | `seasonId` | journées + `roundCode` (ex. `047e38`) | 20 Ko | haute |
| `/api/synergy/competition-statistic/team` | `competitionId`, `offset`, `limit=1000` | **96 clubs toutes époques** (`played, wins, draws, losses, scoredFor/Against, standingPointsPerGame, winPercentage, seasonsParticipatedIn`) | 260 Ko | haute |
| `/api/synergy/competition-statistic/player` | `competitionId`, `statisticKey` | meilleurs buteurs toutes époques | — | moyenne (bundle confirmé) |
| `/api/synergy/season/fixtures` | `seasonId`, `roundCode` | calendrier/affluence/venues | — | moyenne (bundle confirmé) |
| `/api/synergy/{team,player}/*` | `seasonId`, `entityId`, `personId` | fiches club/joueur, stats par match, leaders | — | moyenne (bundle confirmé) |

**Format commun** (JSON:API light) :
```json
{ "data": [ … ],
  "includes": { "resources": { "h1s44:<uuid>": { "nameFullLatin": "…", "images": [ … ] } },
                "persons":  { "h1s44:<uuid>": { … } } } }
```
→ **les noms de clubs/joueurs sont TOUJOURS dans `includes.resources`/`includes.persons`**, jamais dans `data` (clé `h1s44:` obligatoire).

### 2.4 Couverture « 100 % » du site

✅ **Récupérable à 100 %** (techniquement) :
- classement (18 clubs), stats équipes **43 colonnes**, stats joueurs de champ **309**, stats gardiens (globales + par zone), liste clubs + logos, journées, historique toutes époques (96 clubs), fites/rounds.
- **Étendue** : HBL + 2. HBL + (à confirmer par `competitionId`) DHB-Pokal, pages `history`, `handball-performance-index` (HPI).
- Saisons passées : intégralement via `seasons?competitionId=` (63 + 16).

⚠️ **Points de vigilance** :
- Le **palmarès/records** (`/en/hbl/statistics/history`) et le **HPI** sont des calculs côté site → vérifier s'ils sont exposés par un endpoint (non testés faute de budget) ou déduits de nos snapshots.
- Pas de **live/in-play** identifié (les stats sont « season/round », mises à jour avec `max-age=60`).

### 2.5 Coût & cadre légal

- **Coût monétaire** : **0 €** — aucune clé, aucun quota, aucun abonnement. Notre coût : ≈ 8-12 GET/run × 1-2 runs/semaine ≈ **10-20 Mo/semaine**, cron pm2 déjà en place.
- **CGU** : pas de page « Terms of Use » repérée dans le footer (seulement `Datenschutz` + `Impressum`), **aucune clause anti-scraping** relevée ; `robots.txt` absent.
- **Contenu** : © HBL GmbH, données fournies par **Sportradar** → **usage éditorial/interne avec attribution** recommandé (mention source « opel-hbl.de / HBL »), pas de republication brute massive, User-Agent identifié, fréquence raisonnable (1-2×/semaine conforme à la demande).

---

## 3. Site B — `www.handballstats247.com` (agrégateur mondial)

### 3.1 Architecture observée

- **Next.js (App Router) + Cloudflare** (`server: cloudflare`, `cf-ray`, `x-powered-by: Next.js`), pas de challenge WAF constaté (HTTP 200).
- **Rendu majoritairement serveur** : la page ligue renvoie **les classements en HTML brut** (ex. `/competitions/germany/bundesliga/` → 721 Ko, 2 tables, 18 lignes exploitables : `# Team P W D L GF GA GD Form Pts`).
- Pas de `__NEXT_DATA__` (App Router) mais payload RSC (`self.__next_f.push`) embarqué.
- **Sous-domaines linguistiques** : `fr.`, `de.`, `en.`, `es.`, `it.`, `nl.`, `se.`, `no.`, `dk.`, `fi.`, `pt.`, `pl.`, `hu.`, `cz.`, `ee.`, `ro.` → **version FR disponible**.
- `robots.txt` **HTTP 200** :
  ```
  User-Agent: *
  Allow: /
  Disallow: /mgm/
  Disallow: /api/
  Disallow: /*?*
  Sitemap: https://www.handballstats247.com/sitemap.xml
  ```

### 3.2 Données disponibles (inventaire)

- **Couverture mondiale** : 33 liens de compétitions sur la home (Allemagne : `/competitions/germany/bundesliga/` + `/competitions/germany/2-bundesliga/` ; aussi Autriche, Bulgarie, Croatie, Tchéquie, Danemark 1. Division, Asie, etc.).
- **Saisons proposées (sélecteur)** : **2026/2027, 2025/2026, 2024/2025, 2023/2024, 2022/2023, 2021/2022** (6 saisons).
- **Par ligue** : classement complet (`P W D L GF GA GD Form Pts`), résultats/calendrier, « Current Sequences » (séries W/D/L), tendances.
- **Par équipe** (`/teams/<pays>/<slug>/`) : tableau `Total | Home | Away` (stats domicile/extérieur).
- **Autres modules** : `/matches/` (scores du jour), `/h2h/<a>-b-<id1>-<id2>/` (H2H), `/predictions/`, `/trends/`.
- Noms d'équipes **alignés avec notre flux Flashscore** (Flensburg-H., Kiel, SC Magdeburg, Fuchse Berlin, MT Melsungen, Hannover-Burgdorf, Rhein-Neckar, Goppingen, Gummersbach, Erlangen, Stuttgart, HBW Balingen-Weilstetten, Lemgo, **Eisenach**, **Bietigheim-Metterzimmern**, Hamburg, HSG Wetzlar, Bergischer) → matching de noms **direct** avec `normHandballName`.

### 3.3 Coût & cadre légal — ⚠️ point bloquant

- **About Us** : « *The use of HandballStats247.com website is **free of charge within limits for personal or editorial use**. »
- **Terms & Conditions** (`/terms-conditions/`) :
  > « *You may not: Reproduce, distribute, or commercially exploit our content without permission · **Use automated tools to scrape or extract data from our website** · Misrepresent or claim ownership of our content* »
  > « *Statistics are sourced from various providers and may contain occasional errors.* »
- **robots.txt** : `/api/` **interdit**, toute URL avec `?` (donc paramètres `season=`) **interdite**.

**Conséquence** : même si le site est techniquement facile à scraper (HTML SSR, tables brutes), **un pipeline automatisé violerait explicitement leurs CGU** (et une partie du robots.txt). Le sélecteur de saisons passant probablement par un query string, même le historique serait hors `robots.txt`.

### 3.4 Verdict « 100 % »

- **Techniquement** : ~95-100 % scrapable (HTML brut + saisons en query) — mais pas de garantie sur joueurs/buteurs détaillés (non vérifié : pages non explorées faute de budget).
- **Contractuellement** : ❌ **NON autorisé pour du scraping automatisé**.
- **Alternatives légitimes** : (a) programme « **Explore Widgets** » proposé par le site (intégration officielle), (b) contact direct pour un accord de reprise, (c) usage **manuel et ponctuel** de contrôle (quelques pages, à la main), (d) **ne pas** en faire la source du pipeline.

---

## 4. Comparatif final & recommandation

| Critère | opel-hbl.de | handballstats247.com |
|---|---|---|
| Officiel / primaire | ✅ HBL = organisateur | ❌ agrégateur tiers |
| Format | API JSON (proxy Sportradar) | HTML SSR + query strings |
| Auth / coût | aucune / 0 € | gratuite « personal/editorial » |
| robots.txt | absent (404) | `/api/` + `?*` **interdits** |
| CGU anti-scraping | aucune trouvée | **explicite (interdit)** |
| Profondeur | 63 saisons HBL + 16 en 2.HBL, 43 stats/club, 309 joueurs, gardiens | 6 saisons, classements + séries + domicile/extérieur |
| Noms d'équipes vs notre flux | noms officiels (→ mapping requis) | **noms Flashscore** (→ mapping direct) |
| CORS | absent (côté serveur OK) | idem |
| **Verdict** | ✅ **source principale** | ⚠️ **contrôle manuel / partenariat widgets** |

### Ce qu'on peut donc scraper à 100 % (réponse à la demande)

1. **Stats équipes Bundesliga (1. + 2.)** → `season-statistic/team-overview` (43 colonnes) : **exactement le besoin du bead `ParisScorebis-wvwv`** (remplace avantageusement le pattern LNH).
2. **Classement** → `standings` (position, points, V-N-D, buts, forme).
3. **Stats gardiens** → `player-overview?statisticType=goalkeeper`.
4. **Buteurs & stats joueurs** → `player-overview?statisticType=fieldplayer` (309 lignes).
5. **Historique toutes époques** → `competition-statistic/team` (96 clubs) + `competition-statistic/player`.
6. **Journées / fixtures** → `season/rounds` + `season/fixtures` (à confirmer), pour du « par journée ».
7. **Logos clubs** → `includes.resources.images` (type `LOGO`) → réutilisable pour combler `TEAM_LOGOS`.

**Non couvert / à confirmer** : HPI et records `history` (calculs site), live/in-play (absent), DHB-Pokal & coupes (`competitionId` à extraire du payload SSR des pages dédiées).

---

## 5. Plan d'implémentation proposé (mêmes conventions que LNH)

```
scripts/scrape-hbl.js            # node:https, zéro dép, UA navigateur, 1 req/s
  ├─ GET /seasons?competitionId=<HBL|2.HBL>        → saison ACTIVE
  ├─ GET /standings?seasonId=<SID>                 → data/hbl_standing.json
  ├─ GET /season-statistic/team-overview?seasonId   → data/hbl_teamstats.json
  ├─ GET /season-statistic/player-overview (x2)     → data/hbl_players.json (champ + gardiens)
  └─ GET /season/teams-in-season                    → logos via includes.images
src/lib/hbl-stats.ts             # reader readonly (pattern DATA_DIR, cache mémoire, purge)
src/app/api/handball/analysis    # → onglet « Stats équipes » : LNH d'abord, sinon HBL
cron : 2×/semaine (ex. lun. 05:00 + jeu. 21:30 UTC, pm2 `pariscore-cron-hbl`)
```
- **Volume** : ≈ 8-12 GET, ≈ 1,5 Mo/run, ~12 Mo/mois.
- **Matching d'équipes** : `findLnhRow`-like (norm + inclusion ≥5) — noms officiels HBL vs Flashscore ; 7 clubs sans logo restent en initiales.
- **Repli garanti** : snapshot absent → UI dégrade proprement (pattern existant).
- **Acceptance** : lint + tsc 0 erreur, QA 390/1440, capture onglet « Stats équipes » rempli pour un match Bundesliga.

---

## 6. Blocages & risques

1. **Outil agent** : le dispatcher `task` a échoué 3 fois avec `FileSystem.writeFile …\snapshot\…\info\exclude` (erreur d'infra OpenCode) → la recon opel-hbl a été menée par un agent **avant** la panne, la partie handballstats247 **manuellement**. À réessayer pour la phase d'implémentation si corrigé.
2. **handballstats247** : CGU explicites contre le scraping automatisé → **décision produit requise** (ne pas industrialiser ; éventuel contact « Widgets »).
3. **Sportradar en amont** : `api.dc.connect.sportradar.com` = 401 + produit payant → jamais y aller directement.
4. **opel-hbl** : pas de ToS publiée → prudent : attribution + fréquence douce + User-Agent identifié ; ré-sonder `robots.txt` à chaque gros changement de cadence.
5. **DHB-Pokal / coupes** : `competitionId` à extraire du payload SSR (`<script id="__NUXT_DATA__">`) des pages `/en/dhb-pokal/...` — non fait faute de budget sonde.

---

## 7. Preuves (échantillon)

- `GET https://www.opel-hbl.de/api/synergy/standings?seasonId=c4a3125f-79f2-11f1-9a19-5f7c8c2ed877` → 200, 220 719 o, 18 clubs.
- `GET https://www.opel-hbl.de/api/synergy/season-statistic/team-overview?seasonId=c4a3125f-…` → 200, 77 264 o, 43 stats/club.
- `GET https://www.opel-hbl.de/robots.txt` → **404**.
- `GET https://www.handballstats247.com/robots.txt` → 200 (`Disallow: /api/`, `Disallow: /*?*`).
- `GET https://www.handballstats247.com/competitions/germany/bundesliga/` → 200, 721 192 o, 18 lignes de classement en HTML.
- `GET https://www.handballstats247.com/terms-conditions/` → clause « **Use automated tools to scrape or extract data** » interdite.
- Budget total de la phase de sondage : ≈ 55 requêtes GET, 0 x-ratelimit, 0 429.
