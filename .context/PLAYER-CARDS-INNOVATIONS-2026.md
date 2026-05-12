# PariScore — PLAYER CARDS v2 : Brainstorm & Innovations 2026

> Document de pilotage GM — Mai 2026 — PariScore v9.7
> Périmètre : refonte complète des fiches joueur, fix retrieval photo, roadmap d'innovations.
> Cible : ~100 utilisateurs sur 75 ligues, plan API-Football PRO.

---

## OUTPUT 1 — Analyse de l'état actuel

### Route `/api/v1/player` (server.js:8246)

La route accepte `?id=` (BSD ID) ou `?name=` (recherche fuzzy). Pipeline actuel :

1. `bsdSearchPlayers(name)` → `/players/?search=<name>&page_size=10` → liste compactée (`id`, `name`, `position`, `team`).
2. `bsdGetPlayerDetail(id)` → `/players/{id}/` + `/player-stats/?player={id}&page_size=30` puis agrégation locale.
3. Cache `apiCacheSet(..., 7 jours)`.

### Payload retourné aujourd'hui

| Bloc | Contenu | Source |
|------|---------|--------|
| Identité | `id, name, short_name, position, specific_position, nationality, age, birthdate, height, weight, preferred_foot, market_value` | BSD `/players/{id}/` |
| Photo | `https://sports.bzzoiro.com${p.image_path}` (server.js:570) | BSD CDN |
| Saison stats `base` | matches, minutes, goals, assists, yellow/red, avg_rating, saves | BSD `/player-stats` agrégé |
| `shooting` | shots_total, on_target, off, in_box, conversion_rate, shots_per_game | BSD |
| `expected` | xG total, xA total, xG/game, xA/game, **xG_overperformance** (= goals − xG), xG per shot | BSD |
| `creativity` | key_passes, key_passes_per_game | BSD |
| `per90` | goals_p90, xg_p90, shots_p90, assists_p90 | BSD |
| `kpi_score` | `(goals*3 + assists*2 + rating) / per90` | composite maison |
| `form_l5` | 5 derniers matchs : date, opp + logo, home/away, result, min, G, A, shots, xG, rating | BSD `/player-stats` slice(0,5) |

### Source actuelle de la photo

**Unique** : `https://sports.bzzoiro.com${p.image_path}`. Test curl : **HTTP 200, image/png, 7067 bytes ✅**. Mais :
- Couverture inégale (BSD a beaucoup de Top 5 ligues + UCL, mais peu de J1/MLS/K-League).
- Pas de fallback → silhouette par défaut côté front si `image_path` est `null`.
- Pas de retry si BSD est down (single point of failure pour les fiches joueur entières).

### Gaps identifiés (avant refonte)

| Gap | Impact betting |
|-----|----------------|
| Pas de **L10** ni filtre **L25** (uniquement `form_l5`) | Impossible de calibrer momentum vs saison |
| Pas de **shotmap** par match | Pas de vue qualitative xG (intérieur/extérieur surface) |
| Pas de **heatmap** | Pas de signal sur zones d'influence (defenseur central vs latéral offensif) |
| Pas de **comparables** (similar players) | Pas de différenciation vs Sofascore/FotMob |
| Pas de **betting impact** | Pas de chiffrage du delta cotes avec/sans le joueur (USP unique pour PariScore) |
| Pas de **live pulse** | Pendant un match en cours, fiche statique |
| Pas de **share** (OG image) | Pas de viralité gratuite |
| `kpi_score` opaque | Pas d'intervalle de confiance, pas de comparaison de ligue |
| `xg_overperformance` brut (G-xG) | Ne dit pas si chance ou skill (UQD Bootstrap absent) |
| Cache 7j pour stats actives | Trop long en pleine saison, infos figées |
| Pas de "minutes since last cache" exposé | Utilisateur ne sait pas la fraicheur |
| Pas de schéma `integrity` (LIVE/SIM/SAMPLE_TOO_LOW) | Risque d'afficher des stats sur 1-2 matchs |

---

## OUTPUT 2 — Cinq perspectives expertes

### CTO / Engineering Lead — Caching hybride pré-cache + on-demand

Le wrapper Sofascore via Playwright (cf. `scripts/sofa-microservice.py` et `.context/SOFASCORE-WRAPPERS-ANALYSIS-2026.md`) coûte ~800 ms/page hot et ~3 s cold. Lancer ça à la demande pour un joueur de Q2 ligue chinoise est gaspilleur. **Stratégie** : (a) **pré-cache nocturne** (cron 04:00 Europe/Paris) des **200 joueurs TOP** (les 11 titulaires × matchs J0+J1 + AI Scout picks) → SQLite `player_extended` TTL 24 h ; (b) **on-demand** pour la longue traîne, avec TTL 6 h et **queue** Promise-pool max 4 parallèles pour ne pas saturer le microservice. (c) **Photos** mises en cache 30 jours dans `api_cache` (clé `photo_<provider>_<id>`) — mêmes coordonnées que `team_logo`. (d) ETag/304 sur les réponses : `cache-control: public, max-age=21600, stale-while-revalidate=43200` pour soulager le front.

### UX Researcher — Layout above-the-fold orienté décision pari

L'utilisateur PariScore arrive sur la fiche via le tableau de matchs (intent : **"dois-je miser sur ce match ?"**), pas via une recherche libre. Donc above-the-fold (~600 px) = **(1) photo 96 × 96 + nom + équipe + drapeau + N° maillot + position spécifique + market_value** ; **(2) badge "Forme L5"** = sparkline de 5 ratings colorée vert→rouge ; **(3) 3 chiffres clé en grand** : `xG_per90`, `KPI`, `avg_rating` avec **comparaison ligue** (rang percentile, ex : top 8 %). Below-the-fold : onglets `Stats / Forme / Shotmap / Comparables / Live`. Mobile : sidebar plein écran avec drag-to-dismiss. **Anti-pattern à éviter** : ne jamais afficher un graph avant le KPI textuel (cognitif terminal, pas dashboard analyste).

### Quant / Data Scientist — Métriques actionables pour paris

Pour des marchés btts/over/anytime-scorer, ce qui prédit le mieux n'est pas le but brut mais : **(1) xG per 90** (signal stable, R² ~0.62 vs goals saison suivante) ; **(2) shots in box per 90** (volume, calibre la queue de Poisson) ; **(3) xG_per_shot** (qualité, sépare opportunisme/forçage) ; **(4) Key passes per 90 + xA_per90** pour assists markets ; **(5) Conversion rate avec IC Wilson** (jamais raw, sample-bias garanti < 10 tirs) ; **(6) Form velocity** = pente de régression linéaire sur les 10 derniers ratings (positif → momentum, négatif → fatigue/perte de niveau). **À cacher absolument** : tous les ratios calculés sur **moins de 5 matchs** (badge `SAMPLE_TOO_LOW`) ou < 270 minutes joué. **À ajouter** : **percentile dans la ligue** pour chaque métrique (z-score normalisé sur la population de la ligue) — c'est ça qui transforme "1.4 xG/90" en signal exploitable.

### Product Manager — Différenciation vs Sofa/FotMob/OddAlerts

Sofascore et FotMob ont déjà shotmap, heatmap, ratings. OddAlerts a les cotes. **Personne n'a le betting context du joueur**. La feature signature de PariScore doit être **"Player Betting Impact"** : pour chaque joueur, on calcule sur les 20 derniers matchs de son équipe la **différence de moyenne d'expG total** quand il est titulaire vs absent → exprimé en `Δ home win % = +4.2 pts` et `Δ over 2.5 = +6.8 pts`. C'est unique, ça parle directement au pari, et c'est calculable avec uniquement la donnée qu'on a déjà (lineups + match stats + résultats). **V1 minimum viable** : Badge "🔥 Game-changer" si Δ home win % > +5 pts. C'est l'angle marketing : *"Sofa te montre ce qu'il fait, on te montre ce que ça change pour ton ticket."*

### Risk / Quality — Intégrité des données affichées

Règles strictes à coder dans la couche `validatePlayerIntegrity()` : **(R1)** masquer toute métrique calculée sur < 5 matchs ou < 270 minutes (afficher `–` + tooltip "Pas assez de matchs"). **(R2)** distinguer **LIVE** (BSD `season_stats` à jour < 24 h) / **CACHED** (24-72 h) / **STALE** (> 72 h) / **SIM** (deduit, ex: ESPN sans xG → ne pas afficher xG). **(R3)** gardiens : NE PAS afficher xG/xA (toujours 0), afficher **`save_pct`, `clean_sheets`, `goals_conceded_per_90`** à la place — config par position dans `playerCardSchema.js`. **(R4)** Si avg_rating dérive de < 3 ratings ou tous égaux à `null`, masquer la sparkline (jamais une fake droite plate). **(R5)** Log toutes les requêtes "stats à 0 mais matches > 5" pour détection de mapping cassé (cf. v9.2 deep mapping fix).

---

## OUTPUT 3 — Fix retrieval photo : chaîne de fallback testée

### Résultats tests `curl` (depuis Windows, headers basiques + browser headers pour Sofa)

| Source | URL pattern | HTTP | Content-Type | Verdict |
|--------|-------------|------|--------------|---------|
| **BSD Bzzoiro** | `https://sports.bzzoiro.com{p.image_path}` | **200** | image/png (~7 KB) | ✅ Source primaire, conserver |
| **FotMob CDN** | `https://images.fotmob.com/image_resources/playerimages/{id}.png` | **200** | image/png (~12 KB) | ✅ Sans auth, sans referer |
| **Transfermarkt CDN** | `https://img.a.transfermarkt.technology/portrait/header/{id}-{ts}.jpg` | **200** | image/jpeg (~6 KB) | ✅ Mais besoin du `{ts}` (scraping unique) |
| **ESPN CDN** | `https://a.espncdn.com/i/headshots/soccer/players/full/{id}.png` | **200** | image/png (~300 KB) | ✅ Haute résolution, idéal hero |
| **Wikipedia REST** | `https://en.wikipedia.org/api/rest_v1/page/summary/{Player_Name}` (URL-encoded) | **200** | application/json (avec `thumbnail.source`) | ✅ Fallback long tail, license CC |
| **Sofascore CDN** | `https://api.sofascore.app/api/v1/player/{id}/image` | **403** | Cloudflare | ❌ Direct impossible — passer par microservice Playwright |
| **API-Football media** | `https://media.api-sports.io/football/players/{id}.png` | timeout/`000` | — | ⚠️ Lent depuis Windows ; OK via plan PRO côté serveur Render |
| **football-data.org** | `/v4/persons/{id}` | **403** | — | ❌ Free tier ne couvre pas |
| **ESPN search API** | `/sports/soccer/players?search=` | **404** | — | ❌ Endpoint dépréciée |

### Chaîne de fallback recommandée (`/api/v1/player/:id/photo`)

```
1. SQLite api_cache hit (TTL 30j)        → return cached URL
2. BSD :  GET /players/{bsdId}/          → if image_path → return + cache
3. FotMob CDN HEAD probe {fotmobId}.png  → if 200 → return + cache
4. ESPN CDN HEAD probe {espnId}.png      → if 200 → return + cache
5. API-Football photo field (PRO plan)   → if 200 → return + cache
6. Wikipedia REST summary thumbnail      → if exists → return + cache (TTL 90j, CC)
7. Sofascore via microservice Playwright → cache résultat 30j (coût: 1 hit)
8. Fallback ultime : SVG initiales       → renvoyer data:image/svg+xml inline
```

**Mapping cross-provider** : on a déjà `bsd_id` et souvent `sofa_id` via mapping de matchs. Ajouter table `player_id_map (bsd_id, sofa_id, fotmob_id, espn_id, transfermarkt_id, wiki_slug)`. Pré-remplie au boot pour le pool TOP 200, peuplée à la volée sur on-demand (1 search Sofa via microservice → on stocke pour la prochaine fois).

---

## OUTPUT 4 — 5 propositions d'innovation

| # | Feature | Impact betting | Coût dev | Donnée requise |
|---|---------|----------------|----------|----------------|
| 1 | **Betting Impact Card** | ★★★★★ (signature PariScore) | 1.5 jour | Lineups + résultats archivés (déjà en DB) |
| 2 | **Form Velocity Sparkline** | ★★★★ | 4 h | `form_l5/l10` ratings (déjà calculé) |
| 3 | **Comparable Players** | ★★★ (engagement) | 1 jour | Vecteurs xG/xA/KP/min par ligue |
| 4 | **Live Pulse** | ★★★★ (live betting) | 1 jour | Sofascore live rating via microservice |
| 5 | **Share Card OG Image** | ★★ (acquisition) | 1 jour | Canvas/satori serveur |

### 1. Betting Impact Card (USP)

Pour chaque joueur, sur ses 20 derniers matchs disputés par son équipe :
```
home_win_pct_with    = wins_when_started / matches_when_started
home_win_pct_without = wins_when_absent / matches_when_absent
Δ_home_win = home_win_pct_with - home_win_pct_without  (× 100 = %pts)
Δ_over25  = idem sur total goals > 2
Δ_xG_for  = expG moyen équipe avec / sans
```
Badge `🔥 Game-changer` si `Δ_home_win >= +5 pts` & sample ≥ 5 sur chaque branche. Bootstrap 500 itérations pour IC 90 %.

### 2. Form Velocity

Régression linéaire ordinaire sur ratings L10 (pente α). Affiché en sparkline avec gradient vert/rouge. Drapeau **`📈 Rising`** si α > +0.05/match, **`📉 Falling`** si α < −0.05/match. Coût zéro, ces données existent dans `form_l5` étendu à L10.

### 3. Comparable Players

k-NN sur vecteur normalisé `[xG/90, xA/90, key_passes/90, shots/90, age, position_class]` parmi joueurs même ligue / saison. Top 3 voisins. Pré-calculé en cron quotidien dans `player_neighbors (player_id, neighbors_json)`. Use-case betting : *"Si tu aimes ce buteur à 3.50 anytime, regarde aussi X à 4.20 même profil"*.

### 4. Live Pulse

Quand match in-progress (status `1H/HT/2H`), exposer `live_rating`, `live_minutes`, `live_actions` (G/A/SOT/KP) via Sofascore microservice polling 60 s. Affiché dans onglet `Live` de la fiche.

### 5. Share Card OG Image

Route `GET /api/v1/player/:id/og.png` → génération canvas/satori côté serveur (1024×512) : photo + nom + KPI + 3 stats + watermark PariScore. Open Graph pour partage Twitter/Discord/WhatsApp. Acquisition virale gratuite, ROI marketing.

---

## OUTPUT 5 — Plan d'implémentation backend

### Nouvelles routes

| Route | Méthode | TTL cache | Description |
|-------|---------|-----------|-------------|
| `GET /api/v1/player/:id/extended` | GET | 6 h (TOP200: 24 h pré-cache) | Tout : profile + stats + form L10 + percentiles + integrity |
| `GET /api/v1/player/:id/photo` | GET (302) | 30 j | Redirige vers la 1re URL valide de la chaîne fallback |
| `GET /api/v1/player/:id/comparables` | GET | 24 h | Top 3 voisins k-NN même ligue |
| `GET /api/v1/player/:id/betting-impact` | GET | 12 h | Δ home_win, Δ over25, sample, IC90 |
| `GET /api/v1/player/:id/live` | GET (SSE) | 60 s | Live rating + actions (uniquement si match in-play) |
| `GET /api/v1/player/:id/og.png` | GET | 1 h | Image PNG 1024×512 |
| `POST /api/v1/player/cache/warm` | POST admin | — | Force re-cache TOP200 |

### Tiers de cache

| Tier | TTL | Stockage | Trigger refresh |
|------|-----|----------|-----------------|
| Photos | 30 j | SQLite `api_cache` clé `photo_<provider>_<id>` | Miss + cron mensuel |
| Stats season | 24 h (TOP200) / 6 h (longue traîne) | SQLite `player_extended` | Cron 04:00 + on-demand |
| Form L10 | 6 h | SQLite `player_form` | Cron post-match (fin J+0) |
| Comparables | 24 h | SQLite `player_neighbors` | Cron 03:00 daily |
| Betting impact | 12 h | SQLite `player_betting_impact` | Cron 05:00 daily |
| Live | 60 s | Mémoire (Map) | Polling Sofa MS si in-play |

### Extension `sofa-microservice.py`

Ajouter endpoints :
- `GET /player/{id}` → page Sofascore HTML → JSON (rating, position, photo url).
- `GET /player/{id}/heatmap` → image bytes.
- `GET /player/{id}/shotmap/{match_id}` → JSON shots.
- `GET /player/{id}/live` → live rating + actions in-play.

### Estimation coûts (mensuel pour 100 users)

| Poste | Coût | Notes |
|-------|------|-------|
| API-Football PRO | déjà payé ($19) | Photos publiques incluses |
| Compute Render | déjà payé | +2 % CPU pour cron pré-cache |
| Sofascore microservice | $0 | Playwright sur Render service séparé |
| Stockage photo | $0 | URL-only en cache, pas binaire |
| **Total marginal** | **$0** | Pure compute |

---

## OUTPUT 6 — Spec frontend (mockup)

### Modal vs sidebar

**Décision : sidebar droite full-height** (largeur 480 px desktop, 100 % mobile). Justification : permet de garder le tableau de matchs visible (cross-référence rapide). Cohérent avec patterns Live Detail (v9.5) déjà en place.

### Structure d'onglets

```
┌─────────────────────────────────────────────────┐
│ [×]  KYLIAN MBAPPÉ                  [⤢] [↗]     │  ← header sticky
│ ┌─────┐ #7 · ATT · 🇫🇷 26 ans · €180M           │
│ │PHOTO│ Real Madrid · La Liga                    │
│ │96x96│ [🔥 Game-changer]                        │
│ └─────┘                                          │
├─────────────────────────────────────────────────┤
│  xG/90   KPI   ⭐ Rating   Δ Home Win           │
│  0.92    8.4    7.6 (P85)  +6.2 pts             │
│  📈 Rising velocity                              │
├─────────────────────────────────────────────────┤
│ [Profile] [Stats] [Forme] [Shotmap] [Compare]   │
│           [Betting Impact] [Live●]              │
├─────────────────────────────────────────────────┤
│  < contenu de l'onglet actif >                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Onglets — détail

| Onglet | Contenu | Source |
|--------|---------|--------|
| Profile | Identité étendue + carrière + clauses | BSD + Wikipedia |
| Stats | Tableau saison : base / shooting / expected / per90 + percentiles ligue | `/extended` |
| Forme | Sparkline L10 + table 10 matchs (date, opp, min, G/A, xG, rating) | `/extended.form_l10` |
| Shotmap | Heatmap canvas + filtre par match | Sofa MS |
| Compare | 3 cards joueurs voisins + radar 5-axes | `/comparables` |
| Betting Impact | Δ home_win, Δ over25, Δ xG_for + IC90 | `/betting-impact` |
| Live ● | Visible uniquement si match in-play | SSE `/live` |

### Responsive

- ≥ 1024 px : sidebar droite 480 px, tableau visible.
- 768–1023 px : sidebar droite plein écran avec close.
- < 768 px : bottom sheet full screen, drag-to-dismiss, sticky header avec photo réduite 48×48.

### Accessibilité & perfs

- Body lock (v9.6 bulletproof) : `position: fixed` + `top: -scrollY`.
- Chart containers `min-height: 240px` (anti-CLS).
- Lazy loading photos (`loading="lazy"` + `decoding="async"`).
- Préchargement intelligent : au hover du nom dans la table > 300 ms, fetch `/extended` en arrière-plan.
- Skeleton loader vert néon pendant fetch (cohérence design system).

---

## ANNEXE — Punch list d'implémentation (ordonnée)

1. **Photo fallback chain** (4 h) — créer `/api/v1/player/:id/photo` + `player_id_map` + cache 30 j.
2. **Form L10 extended** (2 h) — étendre `bsdGetPlayerDetail` `slice(0,5)` → `slice(0,10)` + velocity α.
3. **Sidebar UI** (1 jour) — onglets Profile/Stats/Forme.
4. **Percentile ligue** (4 h) — cron quotidien compute z-score par position×ligue.
5. **Betting Impact** (1.5 jour) — la USP. À pousser dès le sprint suivant.
6. **Comparables k-NN** (1 jour) — pré-calcul cron.
7. **Shotmap + Live** (2 jours) — extension microservice Sofa.
8. **Share OG image** (1 jour) — satori/canvas server-side.

Effort total v1 ~5 jours homme. Coût marginal ~0 $/mois.

---

*Document rédigé sous casquette GM PariScore — Mai 2026 — synthèse CTO + UXR + Quant + PM + Risk + Marketing.*
