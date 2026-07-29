# Capacités Live de l'API BSD vs Scraping Web — Décision Rapide en Match

> Rapport d'analyse pour arbitrer les sources de statistiques **en direct** de la plateforme PariScore.
> Date : 2026-07-29 — Sources : inspection du code réel (`server.js`, `bsd-football-fetcher.ts`, `services/`), doc publique Betsapi/Sportradar, évaluation scraping tierce, papier arxiv [2410.21484v1](https://arxiv.org/html/2410.21484v1).
> **Statut : analyse uniquement. Aucune modification de code — en attente du GO utilisateur.**

---

## 0. TL;DR (exécutif)

1. **BSD ici ≠ Betsapi générique.** Le provider branché (`https://sports.bzzoiro.com`) est un agrégateur de type Betsapi/SofaScore-like **bien plus riche** que le Betsapi public documenté : il fournit **déjà nativement** xG live, momentum (array temporel), possession, tirs détaillés (inside/outside box, blocked, woodwork), corners, duels, constructions, shotmap par tir, incidents géométriques, **et** un **WebSocket push live**.
2. **Les métriques "manquantes" supposées dans la mission sont en grande partie déjà là.** Le vrai gap BSD n'est pas la richesse statistique, c'est : **(a) la latence** (push WS ~30s, enrich REST 30–60s — trop lent pour du trading sub-seconde), **(b) la fiabilité** (402 quand Sports Addon requis, orphelins ESPN/Odds sans `_bsd_event_id`), **(c) le tennis avancé** (PBP momentum/pressure), **(d) H2H + sentiment** (absents V2), **(e) heatmaps/tracking** (jamais fournis par ce type d'API).
3. **Le scraping web ne doit JAMAIS entrer dans le chemin de décision rapide.** Latence +1–5s par appel, ToS interdits (SofaScore, Flashscore, FotMob), anti-bot actifs (Cloudflare, header `x-fm-req`). Architecture recommandée : **worker async + cache**, BSD primaire temps réel, scraping uniquement en **fallback enrichissement** derrière un `feature flag`.
4. **Décision recommandée (cf. §7)** : ne pas ouvrir un chantier scraping massif. Prioriser (i) la **dérivation d'un momentum index côté serveur** à partir des 38 champs BSD déjà disponibles, (ii) la **stabilisation de la latence WS** (cap 10 matchs/socket, reconnexion), (iii) un **fallback Flashscore déjà câblé (Plan E)** et ESPN comme simples secours — plutôt que d'exposer PariScore au risque juridique de SofaScore/Flashscore scraping.

---

## 1. Ce que BSD fournit RÉELLEMENT aujourd'hui (inspection code)

### 1.1 Identification du provider

- **Base** : `https://sports.bzzoiro.com/api` — pagination Django REST (`{count,next,previous,results}`), header `Authorization: Token ${BSD_API_KEY}`. Tennis Addon : `https://sports.bzzoiro.com/tennis`.
- **Vars env** (`.env.example:52-55`) : `BSD_API_KEY`, `BSD_TENNIS_ENABLED=false`, `BSD_LIVE_TOKEN`, `BSD_LIVE_WS_HOST`, `BSD_LIVE_WS_PATH`, `BSD_LIVE_WS_ENABLED`.
- **Client** : `bsdFetch(endpoint, retries=2)` (`server.js:3772`) — `&tz=Europe/Paris`, retry sur 5xx/429.

### 1.2 Métriques live réellement récupérées — 38 champs canoniques

Le mapper WS `_bsdWsApplyEventStats` (`server.js:49743`) couvre :

| Catégorie | Champs BSD disponibles |
|---|---|
| **Score & temps** | `live_score`, `live_minute`, `live_added_time`, `live_period`, `status` |
| **xG** ✅ | `live_xg` (cumulé home/away) + `live_xg_per_minute` (timeline) — via shotmap REST `_bsdMergeShotmap` (`server.js:49893`) |
| **Possession** ✅ | `live_possession` |
| **Tirs** ✅ | `live_shots`, `_on_target`, `_off_target`, `_inside_box`, `_outside_box`, `_blocked`, `_woodwork` |
| **Corners** ✅ | `live_corners` (`corner_kicks`) |
| **Momentum** ✅ | `live_momentum` (array `[{min,v}]`, v∈[-100,+100]) + `live_momentum_pct` (attack_pct / dangerous_attack_pct / ball_safe_pct) + `live_dangerous_attacks` |
| **Duels/contrôle** | `live_aerial_duels`, `_ground_duels`, `_dribbles`, `_tackles`, `_interceptions`, `_recoveries`, `_dispossessed` |
| **Construction** | `live_passes`, `_pass_accuracy`, `_crosses`, `_long_balls`, `_final_third_entries`, `_final_third_pct`, `_touches_opp_box`, `_big_chances` (+ missed/scored), `_clearances`, `_throw_ins`, `_goal_kicks`, `_free_kicks` |
| **Gardien** | `live_saves`, `_goals_prevented` |
| **Discipline** | `live_cards` (yellow/red), `_fouls`, `_offsides` |
| **Shotmap par tir** ✅ | `live_shotsmap` (min, xg, xgot, body, situation, position xy) |
| **Incidents** ✅ | `live_incidents` (buts/carts/subs/VAR/penalty + `sequence` xy, `_bsdNormalizeIncident`) |

### 1.3 Latence / polling observé

| Boucle | Intervalle | Source |
|---|---|---|
| Scores live football (`pollLiveScoresSmart`) | **20 s** | `setInterval server.js:50811` (skip si pas de contexte live actif) |
| Enrich incidents REST | 30 s (`_BSD_ENRICH_INC_TTL`) | `server.js:49917` |
| Enrich shotmap/momentum/xG REST | 60 s (`_BSD_ENRICH_SHOT_TTL`) | `server.js:49918` |
| **WebSocket push live** | frame `event` **~30 s** | `server.js:49579`, cap **10 matchs/socket** (`BSD_WS_SUB_CAP`) |
| Cron `cronEnrichBSDFullStack` | 5 min | `server.js:50815` |
| Cache Next `/api/football/live` | TTL 30 s | `route.ts:5` |
| Tennis live (`pollTennisLive`) | 30 s | `server.js:51618` |

**Stockage** : stats live **en mémoire** (`db.matches` mutés), PAS en base (Prisma n'a que `User`/`Post` démo ; SQLite ad-hoc via `sqldb` better-sqlite3 pour `api_cache`, `team_logos`, `archive_matches`).

### 1.4 Scraping DÉJÀ branché dans le codebase

BSD n'est pas seul — ces canaux existent déjà et constituent les modèles à suivre :

| Source | Rôle | Localisation | TTL cache |
|---|---|---|---|
| **Flashscore (Plan E)** | Live stats fallback quand `!live_score && !live_minute` | ETL Apify → table `api_cache`, clé `flashscore_live_stats_<normHome>_<normAway>` ; `loadFlashscoreLiveStatsCache` recharge 60s | 30 min |
| **Flashscore standings (Plan B)** | Classement secours | `server.js:4910` | 7 j |
| **TNNS Live** | Tennis point-by-point | `services/tnnsLiveScraper.js`, flag `TNNS_LIVE_ENABLED` | n/a |
| **Sofascore (microservice `sofa`)** | Momentum/DR tennis, TV channels | `resolveSofaEventId`, `_sofaServiceFetch`, `getSofascoreDRCached` | — |
| **ESPN** | Standings/buteurs secours ligues non-BSD | `ESPN_SOCCER_SLUG server.js:1872` | — |
| **FBref** | Stats football historique | `maybeReloadFBrefStats server.js:50422` | — |

### 1.5 Gaps BSD documentés (`MAPPING_BSD_V1_V2.md`)

- **2 endpoints sans équivalent V1** : **foot H2H** + **sentiment** → cibles évidentes pour scraping / calcul dérivé.
- **15 endpoints partiels** (form équipe, topscorers, weather, stats-players) → un scraper peut compléter.
- **Logos équipes** : BSD n'en fournit pas → `ps-scrape-logos` + table `team_logos`.
- **Sports Addon payant** : `BSD_TENNIS_ENABLED=false` par défaut ; quand désactivé, les routes V2 renvoient **503 brut** sur 402.
- **Orphelins** : matchs ESPN/Odds sans `_bsd_event_id` n'ont pas d'enrichissement incidents/shotmap.

---

## 2. Comparatif : BSD réel vs Betsapi générique vs scraping web

> Point-clé : la plupart des métriques "manquantes au BSD" supposées dans la mission **existent déjà** dans le BSD branché. Le tableau ci-dessous lève l'ambiguïté.

| Métrique live (foot) | **BSD réel (bzzoiro)** | Betsapi public | API-Football | Sportmonks | Scraping (SofaScore/Flashscore/FotMob) |
|---|:---:|:---:|:---:|:---:|:---:|
| Possession % | ✅ **natif** | ✅ | ✅ | ✅ | ✅ |
| Shots / on target | ✅ **natif** | ✅ | ✅ | ✅ | ✅ |
| Shots inside/outside box, blocked, woodwork | ✅ **natif** | ❌ | ❌ | partiel | ✅ |
| Corners | ✅ **natif** | ✅ | ✅ | ✅ | ✅ |
| Dangerous attacks | ✅ **natif** | ✅ | partiel | ✅ | ✅ |
| Cards (Y/R), fouls, offsides | ✅ **natif** | ✅ | ✅ | ✅ | ✅ |
| **xG live (cumulé + per-minute)** | ✅ **natif (shotmap)** | ❌ | ❌ (pré/final) | ✅ add-on € | ✅ (SofaScore/FotMob) |
| **Momentum / pressure index** | ✅ **natif** (array temporel) | ❌ | ❌ | add-on | ✅ **SofaScore = signature** |
| **Shotmap par tir (xy, xg, body, sit)** | ✅ **natif** | ❌ | ❌ | partiel | ✅ |
| **Heatmaps / positions joueurs** | ❌ | ❌ | ❌ | ❌ | ❌ (sauf tracking Opta/2nd Spectrum) |
| Win probability live | ❌ (à dériver) | ❌ | ❌ | ❌ | ESPN (US sports fort, soccer limité) |
| H2H live | ❌ (absent V2) | partiel | ❌ | ✅ | ✅ |
| Sentiment (réseaux) | ❌ (absent V2) | ❌ | ❌ | ❌ | NLP sur Twitter/Reddit |
| **Tennis PBP + momentum/pressure** | partiel (Addon off) | faible | ❌ | ❌ | Tennis-API.com / ShotQuality (payant) |

### 2.1 Latence comparée (pour décision rapide en-match)

| Source | Latence event→API | Modèle | Fiabilité |
|---|---|---|---|
| **BSD WS push** | ~30 s | push WebSocket (cap 10/soc) | correcte, à surveiller |
| BSD enrich REST | 30–60 s | pull | correcte |
| Betsapi public | 10 s → **jusqu'à 5 min** signalé | pull (3600 req/h) | variable (~20% retard 10–30s) |
| Sportradar UOF (Betradar) | **<1 s push XML** | push temps réel | gold standard **€ enterprise** |
| API-Football (plan payant) | ~15 s | pull | bonne |
| Sportmonks | 15–30 s | pull (pas de WS nat) | bonne |
| Scraping SofaScore non-officiel | 5–15 s (polling) | pull + headers/proxy | **fragile** (403, ToS) |
| Flashscore WS Betradar | <5 s (si accès) | WS obfusqué | **ingrippable** (Cloudflare) |

---

## 3. Ce qui manque RÉELLEMENT sur BSD et peut être complété via web

### 3.1 Gaps à combler (par priorité d'impact décision)

1. **Win probability live** — BSD ne la donne pas. **2 voies** :
   - **Dérivation maison** à partir des 38 champs BSD (recommandé, zéro risque juridique). Le papier arxiv recommande des modèles **LSTM/XGBoost** sur features temporelles avec **calibration (RPS/Brier)** plutôt que pure accuracy — `optimizing for calibration increases profit`.
   - Scraping ESPN hidden API (`sports.core.api.espn.com`) — robuste US sports, **limité soccer**.
2. **Latence <5 s** — le WS BSD pousse ~30s. Pour du trading live, c'est le **vrai goulot**. Sportradar UOF push sub-seconde est la seule solution pro (coût enterprise).
3. **Tennis avancé** (momentum shifts, pressure points, WP) — BSD Addon off par défaut. Compléments légitimes : **Tennis-API.com** (PBP payant), **ShotQuality Tennis** (enterprise).
4. **H2H live + sentiment** — absents V2, cibles scraping/NLP naturelles.
5. **Heatmaps / tracking joueurs** — **jamais** via ce type d'API ; nécessite Opta/Second Spectrum/TRACAB (papier arxiv). Hors scope réaliste.
6. **Fiabilité / couverture** — matchs orphelins (ESPN/Odds sans `_bsd_event_id`), 503 sur 402 Sports Addon, logos manquants (déjà partiellement résolu par `ps-scrape-logos`).

### 3.2 Opportunités de scraping identifiées

| Source | Métrique à capter | Latence | Méthode | Risque ToS | Verdict production |
|---|---|---|---|---|---|
| **Flashscore** (déjà branché Plan E) | Stats live fallback | 30 min cache | ETL Apify → `api_cache` | déjà en place | ✅ **Étendre** (existant) |
| **ESPN** (déjà branché) | Standings, WP | near-RT | hidden API | non-officiel | ✅ **Étendre** WP soccer |
| **SofaScore** (déjà microservice `sofa`) | Momentum/xG tennis, momentum foot | 5–15s | API non-officielle | 🔴 interdit ToS | ⚠️ best-effort flag |
| **Understat** | xG shot-level | **différé** (post-match) | POST JSON échappé | stable depuis 2014 | ✅ **pré-match uniquement** |
| **FotMob** | xG live | 5–15s | API mobile RE | 🔴 header `x-fm-req` rotatif | ❌ fragile |
| **Flashscore WS direct** | flux temps réel | <5s | WS Betradar obfusqué | 🔴 Cloudflare+evasion | ❌ **à écarter** |

---

## 4. Impact sur la vitesse d'exécution et la latence

**Règle cardinale : aucune source synchrone dans le chemin de décision rapide.**

| Approche | Latence ajoutée | Décision rapide ? |
|---|---|---|
| Scraping synchrone dans le handler | +1–5s, **bloquant** | ❌ dégrade UX, timeout |
| Worker async + cache (polling 10–15s) | ~0 (lecture cache) | ✅ **recommandé** |
| WebSocket persistant légitime | <1s push | ✅ idéal (rare/légal) |

**Architecture cible** (sans contredire l'existant) :
- BSD reste **primaire temps réel** (scores/events/incidents via WS).
- Workers async dédiés par source secondaire, écrivent en cache (Map TTL 5–10s ou SQLite `api_cache`).
- Le handler de décision **lit le cache uniquement** → latence ~0.
- Le papier arxiv confirme : **pipeline multimodal** fusionnant flux live + historique + marché, avec **réévaluation de la probabilité à chaque event** (modèles séquentiels LSTM/CNN-LSTM) et **gestion de portefeuille adaptative** (Kelly + modern portfolio theory) pour la taille des mises.

---

## 5. Limites & risques

### 5.1 Juridique (scraping)
- **SofaScore, Flashscore, FotMob** : ToS **interdisent explicitement** l'accès API automatisé. Pour un produit **monétisé** (PariScore), le risque est **asymétrique** (cessation, dommages).
- **Contourner Cloudflare/reCAPTCHA** (Flashscore) = evasion de mesure de sécurité → à éviter absolument.
- Données **sous licence** (Betradar/Sportradar chez Flashscore, ATP/WTA officiel) : scraping = appropriation de données propriétaires.
- **Règle pratique** : source non-officielle = ok pour **PoC/exploration** avec `feature flag` off par défaut ; production monétisée = API contractuelle uniquement.

### 5.2 Technique (BSD)
- Stats live **en mémoire seulement** → perte au redémarrage, pas d'historique ré-queryable (le papier arxiv insiste sur l'historique pour l'entraînement ML).
- Cap **10 matchs/socket WS** → scalability limitée (multi-sockets à gérer pour >10 matchs simultanés).
- `BSD_TENNIS_ENABLED=false` par défaut → tennis Addon non exploité.
- Mutex `_isPollingLive` fragile si crash mid-poll.
- Enrich shotmap/momentum **60s** → momentum graph "saccadé" pour la décision rapide.

### 5.3 Qualité des données
- Le papier arxiv souligne : **la calibration prime sur l'accuracy** pour la profitabilité — pas de valeur sans confiance calibrée sur la probabilité prédite.
- Sources non-officielles = **pas de SLA**, cassent sans préavis (ex. header `x-fm-req` de FotMob).

---

## 6. Stratégie recommandée

### 6.1 Ne PAS faire
- ❌ Ouvrir un chantier de scraping massif SofaScore/Flashscore/FotMob pour la production monétisée (risque juridique + fragilité).
- ❌ Mettre du scraping dans le chemin synchrone de décision.
- ❌ Payer Sportradar UOF enterprise à ce stade (budget disproportionné vs besoin actuel).

### 6.2 Faire — priorité décroissante (chacun = chantier indépendant, en attente GO)

**P0 — Dérivation maison du momentum index & win prob (zéro risque juridique)**
BSD fournit déjà `live_momentum`, `live_dangerous_attacks`, `live_shots_on_target`, `live_xg`, `live_possession`, `live_corners`, etc. Construire côté serveur :
- Un **momentum index normalisé** (fenêtre glissante 5–10 min) si celui de BSD est trop "saccadé" (60s).
- Un **modèle de win probability live** (régression logistique / XGBoost initialisé sur historique FBref/API-Football) réévalué à chaque event BSD, **calibré au RPS/Brier** (leçon arxiv). Points d'extension : `_bsdMergeShotmap`, `_bsdWsApplyEventStats`.
- Stocker en base (pas seulement `db.matches` en mémoire) pour permettre réentraînement + historique.

**P1 — Stabiliser la latence WS BSD**
- Diagnostiquer pourquoi le push `event` est à ~30s (vs <5s attendu) — vérifier `_bsdWsApplyEventStats`, le cap 10/soc, la reconnexion.
- Multi-sockets pour >10 matchs, healthcheck `ws-status` route.

**P2 — Étendre les fallbacks déjà câblés (existant → fiable)**
- **Flashscore Plan E** : élargir le matching par clé normalisée, réduire le TTL cache (30 min → 5 min) pour les matchs actifs.
- **ESPN** : exposer la win probability soccer via hidden API en secours.
- **TNNS Live** : activer le PBP tennis momentum quand `BSD_TENNIS_ENABLED=false`.

**P3 — Comblement ciblé des gaps V2 (H2H, sentiment)**
- H2H : scraping léger ou calcul dérivé depuis l'historique.
- Sentiment : NLP léger sur Twitter/Reddit (leçon arxiv : le sentiment public affine les prédictions live).

**P4 — Tennis avancé (si le métier le justifie)**
- Trial **Tennis-API.com** (PBP momentum/pressure, légitime payant) ou ShotQuality — évaluation avant engagement.

### 6.3 Décision d'architecture
- **BSD primaire temps réel** (scores/events/incidents/shotmap).
- **Workers async + cache** pour toute source secondaire (jamais synchrone).
- **Modèle ML maison calibré** pour win prob/momentum dérivés (leçons arxiv : LSTM/XGBoost + calibration + Kelly/portfolio).
- **`feature flags`** sur chaque source non-officielle, off par défaut en production.

---

## 7. Synthèse pour la décision

| Question de la mission | Réponse factuelle |
|---|---|
| BSD fournit possession, tirs, cadrés, corners, momentum, xG en live ? | **Oui, nativement** (38 champs, shotmap, momentum array, xG per-minute). BSD ici ≠ Betsapi public. |
| Ce qui manque sur BSD | Win prob live, H2H V2, sentiment, tennis avancé, heatmaps/tracking, **surtout la latence <5s**. |
| Scraping web pour compléter ? | Flashscore/ESPN/SofaScore **déjà partiellement branchés**. SofaScore/Flashscore/FotMob directs = **risque juridique + fragilité**, à réserver best-effort flag. |
| Impact vitesse/latence | Scraping synchrone = **trop lent**. Worker async + cache obligatoire. WS BSD à stabiliser (~30s → <5s). |
| Stratégie recommandée | **Dérivation maison** momentum/WP (P0) > stabilisation WS (P1) > étendre fallbacks existants (P2) > gaps V2 (P3) > tennis payant (P4). **Pas de scraping massif en production monétisée.** |

---

## Sources

**Inspection code interne** : `server.js`, `bsd-football-fetcher.ts`, `services/tnnsLiveScraper.js`, `.env.example`, `bsd_config.json`, `MAPPING_BSD_V1_V2.md`, `prisma/schema.prisma`.

**Betsapi / Sportradar** :
- https://betsapi.com/docs/ , /docs/events/view.html , /docs/events/stats_trend.html (soccer only, post-oct.2019)
- https://docs.sportradar.com/uof (Unified Odds Feed, push XML)
- https://marketplace.sportradar.com/products/6765996ea1f380e469a27947 (Live Odds 15–30s)
- https://www.reddit.com/r/algobetting/comments/1qc6ej3/ (retards jusqu'à 5 min rapportés)

**Scraping tierce** :
- SofaScore : https://www.sofascore.com/news/how-sofascores-attack-momentum-changed-sport-analysis , https://github.com/apdmatos/sofascore-api , ToS https://sofascore.helpscoutdocs.com/article/129
- Flashscore / Cloudflare : https://www.zenrows.com/blog/bypass-cloudflare , https://scrapfly.io/blog/posts/how-to-bypass-cloudflare-anti-scraping
- FotMob : https://github.com/probberechts/soccerdata/issues/742 (header `x-fm-req`)
- Understat : https://collinb9.github.io/understatAPI/ (différé, pas live)
- API-Football : https://api-sports.io/documentation/football/v3
- Sportmonks : https://www.sportmonks.com/football-api/plans-pricing/ , https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/expected
- ESPN : https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c
- Tennis : https://tennis-api.com/tennis-point-by-point-api/ , https://shotquality.com/tennis/

**Papier de recherche** :
- arxiv 2410.21484v1 : ML systématique dans paris sportifs (PRISMA, 219 articles 2010–2024). Leçons : **calibration > accuracy**, modèles séquentiels LSTM/CNN-LSTM, architecture **multimodale** (live + historique + marché), gestion de portefeuille **adaptative (Kelly + modern portfolio theory)**, sources tracking (TRACAB, SportVU, Wyscout).

---

**EN ATTENTE DU GO UTILISATEUR pour toute implémentation.** Aucune modification de code effectuée.
