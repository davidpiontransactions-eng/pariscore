# Étude — soccerdata (FBref + 9 sources) pour PariScore

**Date** : 2026-05-13
**Auteur** : Claude (CTO/Quant)
**Statut** : Étude only — validation requise avant intégration
**Source primaire** : [soccerdata 1.9.0 docs](https://soccerdata.readthedocs.io/en/latest/datasources/FBref.html), [GitHub probberechts/soccerdata](https://github.com/probberechts/soccerdata)
**Documentation context7** : library ID `/probberechts/soccerdata` (121 code snippets, source reputation High, benchmark 38)

---

## 1. Identité provider

| Élément | Valeur |
|---|---|
| Type | Librairie Python — pas une API HTTP |
| Repo | github.com/probberechts/soccerdata |
| Maintainer | Pieter Robberechts (KU Leuven, soccer analytics academic) |
| Version | 1.9.0 (dernière MAJ 27 février 2026) |
| Licence | MPL-2.0 (Mozilla Public License) — commercial-friendly |
| Install | `pip install soccerdata` |
| Format de sortie | Pandas DataFrames (colonnes normalisées cross-sources) |
| Cache | Auto local (`~/soccerdata` ou `SOCCERDATA_DIR`) |
| Proxy | Tor SOCKS5 + rotating proxies supportés (`proxy='tor'`) |

**Différence fondamentale vs autres APIs** : ce n'est **pas un service HTTP** mais une lib **scraper Python**. Aucun endpoint hébergé. Le code tourne chez l'utilisateur, scrape les sites publics, retourne DataFrames.

---

## 2. Sources scrapées (10 au total)

| Source | Type | Données phares |
|---|---|---|
| **FBref** | Stats Opta | xG, xA, PSxG, possession 16+ metrics, passing networks, pressures, switches, progressive passes, shotmap, lineups, events |
| **ClubElo** | Rankings | Elo ratings historiques équipes club, séries temporelles |
| **ESPN** | Scores + schedules | Multi-ligues, multi-sports |
| **FiveThirtyEight** | Predictions | Prédictions SPI (Soccer Power Index) — archive figée depuis 2023 |
| **Football-Data.co.uk** | Odds historiques | CSVs historiques 30+ ligues, odds closing line |
| **FotMob** | Mobile-first | Lineups, ratings post-match, events, momentum, shotmap |
| **Sofascore** | Mobile-first | Lineups, ratings, shotmap, events, statistics live |
| **SoFIFA** | Player attributes | Ratings FIFA video game, transferts, market value |
| **Understat** | xG advanced | Shot-level xG par tir, Big 5 + RPL |
| **WhoScored** | Stats matchs | Ratings post-match, formations, events, statistics |

→ **Soccerdata = méta-API** unifiant 10 providers déjà partiellement utilisés ou évalués dans PariScore (Sofascore, Understat, FBref).

---

## 3. API FBref — méthodes complètes

```python
from soccerdata import FBref

fbref = FBref('ENG-Premier League', '2025-26')

# Méthodes documentées (10)
fbref.available_leagues()           # liste ligues supportées
fbref.read_leagues()                # info ligues
fbref.read_seasons()                # saisons disponibles
fbref.read_schedule()               # fixtures + scores
fbref.read_team_season_stats(stat_type='shooting')   # passing|shooting|defense|possession|misc|keeper|keeper_adv|goal_shot_creation|standard
fbref.read_team_match_stats(stat_type='schedule', team='Manchester City')
fbref.read_player_season_stats(stat_type='standard')
fbref.read_player_match_stats(stat_type='summary', match_id='...')
fbref.read_lineup(match_id='...')
fbref.read_events(match_id='...')        # play-by-play timeline
fbref.read_shot_events(match_id='...')   # shotmap avec coordonnées par tir
```

**stat_type FBref** : standard, shooting, passing, passing_types, goal_shot_creation, defense, possession, playing_time, misc, keeper, keeper_adv.

---

## 4. Comparaison vs stack PariScore actuelle

### 4.1 vs BSD (L1 primaire)

| Donnée | BSD | FBref via soccerdata |
|---|---|---|
| xG match/player | ✅ basique (`expected_goals`) | ✅ **profondeur Opta** (xG, xGA, PSxG, xG/Shot, xG depuis open-play vs set-piece) |
| Possession | ✅ % seul | ✅ 16+ métriques (touches par zone, pressures, dispossessions, succès dribbles) |
| Passing | ❌ | ✅ **complet** (passes courtes/moyennes/longues, progressive passes, passes vers final third, switches, key passes) |
| Shotmap | ❌ (Sofa only) | ✅ coordonnées par tir + xG par tir |
| Lineups XI starting | ❌ (Sofa only) | ✅ via `read_lineup` |
| Passing networks | ❌ | ✅ (via possession events) |
| Defensive actions | ❌ | ✅ tackles, interceptions, blocks, pressures, recoveries |
| ML predictions | ✅ CatBoost BSD | ❌ |
| Live scores | ✅ | ❌ (FBref = post-match seulement) |
| Multi-bookmaker odds | ✅ 41+ | ❌ |
| Latence | ✅ realtime | ❌ post-match (FBref publish 1-2h après FT) |

**Conclusion** : FBref **complète BSD** sur la **profondeur des stats Opta post-match** (pour modélisation Bayésienne P0 roadmap). BSD reste primaire pour live + odds + predictions.

### 4.2 vs Understat (P2 audit étude — skipé)

| Aspect | Understat | FBref via soccerdata |
|---|---|---|
| Couverture | Big 5 + RPL | **Big 5 + Championship + autres FBref-supported leagues** |
| Profondeur xG | shot-level | **shot-level + team-level avancé** |
| Sources unifiées | Understat seul | **FBref + Understat + 8 autres** dans même lib |
| Cloudflare bloque | ❌ pas de bot protection | ✅ FBref CF mais soccerdata gère |
| Effort dev | scraping custom | **lib mature, API unifiée** |

→ Si on veut Understat-like data, soccerdata fait mieux (couvre + Understat lui-même).

### 4.3 vs Sofascore microservice (live actuel)

| Aspect | Sofa microservice PariScore | Soccerdata Sofascore |
|---|---|---|
| Latence | live optimisé | mobile-first API, latence similaire |
| Données | xG live + shotmap + possession | identique + ratings post-match |
| Pattern | Node.js custom | Python lib |

→ Doublon partiel. Sofa déjà OK pour live ; soccerdata pertinent surtout pour FBref + Understat post-match.

### 4.4 vs Football-Data.org (L2 actuel)

| Aspect | Football-Data.org | soccerdata Football-Data.co.uk |
|---|---|---|
| Source | api.football-data.org | football-data.co.uk (CSV statique) |
| Free tier | 10 req/min, 12 ligues | illimité (CSV download) |
| Données | match data live | **odds historiques closing line** 30+ ligues |
| Latence | real-time | hebdo (CSV update fin de week-end) |

→ Différents. Soccerdata FootballData.co.uk = **odds historiques** pour backtesting, complémentaire à L2 PariScore.

---

## 5. Rate limiting & contraintes techniques

| Contrainte | Détail |
|---|---|
| FBref policy officielle | **10 req/min** (Sports-Reference.com bot policy) |
| Cloudflare sur FBref | Présent — soccerdata gère via délais configurables + retries |
| Selenium fallback | Pour Cloudflare hard-blocks, soccerdata peut piloter Chrome (paramètre `path_to_browser`) |
| Cache automatique | local disk, configurable via `SOCCERDATA_NOCACHE` ou `data_dir` |
| Proxy support | Tor SOCKS5 (`proxy='tor'`) ou dict custom |
| Latence init | premier scrape lent (download massive), cache rapide après |
| Volume données | Big 5 saison complète = ~50 MB DataFrames |

**Implication** : usage **batch nocturne** plutôt qu'on-demand temps réel.

---

## 6. Apports en routing PariScore — 3 patterns d'intégration possibles

### 6.1 Pattern A — Python microservice HTTP (RECOMMANDÉ pour roadmap P0)

```
PariScore (Node.js)  ──HTTP──>  Python microservice (Flask/FastAPI)
                                  │
                                  ├── soccerdata.FBref(...)
                                  ├── soccerdata.Understat(...)
                                  ├── soccerdata.Sofascore(...)
                                  └── cache local (~/soccerdata)
```

**Endpoints microservice à exposer** :
- `GET /scrape/fbref/team-season?league=&season=&stat_type=` → JSON DataFrames
- `GET /scrape/fbref/shot-events?match_id=` → shotmap coords
- `GET /scrape/understat/xg?team=&season=`
- `GET /scrape/clubelo/team?team=&date=` → Elo historique

**Avantages** :
- Isolation pythonique de PariScore Node.js
- Cache mutualisé pour toutes les requêtes
- Scalable indépendamment

**Inconvénients** :
- Stack hybride Node.js + Python → ops complexity
- Déploiement Render = container Python séparé

**Effort dev** : 2-3 jours.

### 6.2 Pattern B — Cron job batch nocturne (RECOMMANDÉ pour quick win)

```
crontab 03:00 nightly:
  python pipeline.py
  → soccerdata.FBref(...).read_team_season_stats(...)
  → écrit JSON dans data/advanced_stats/{league}_{season}.json

PariScore Node.js readonly load JSON au démarrage + reload toutes les 24h
```

**Avantages** :
- Découplé du runtime PariScore (pas de Python dans la stack serveur)
- Cache disque seul, pas de service
- Trivial à déployer (cron sur serveur Render ou GitHub Actions nightly)

**Inconvénients** :
- Pas de scrape on-demand
- Données figées 24h
- Pas adapté pour match-by-match deep-stats à la volée

**Effort dev** : 6-8h.

**Use case idéal** : enrichir `db.advancedTeamStats` (déjà existant, server.js:1525-1648) avec données FBref-profondes pour les 12 ligues majeures hebdomadairement.

### 6.3 Pattern C — Réécriture en Node.js (REJETÉ)

Recoder les scrapers Python en Node.js. Effort énorme, brittle, maintenance lourde, duplication du travail soccerdata. **Skip**.

---

## 7. Roadmap d'intégration suggérée (3 phases)

### Phase 1 — POC offline (1-2j)

- Installer soccerdata localement (`pip install soccerdata`)
- Tester scrapes FBref Premier League 2025-26 (team_season + player_season + shot_events)
- Mesurer latence, volume données, qualité matching équipes vs BSD
- Comparer xG FBref vs xG BSD sur 30 matchs PL/L1 → mesurer divergence
- Décision GO/NO-GO sur Pattern A vs B

### Phase 2 — Pattern B batch nocturne (6-8h dev)

- Script Python `scripts/scrape_advanced_stats.py`
- Output : `data/fbref_advanced/{league}_{season}_team.json` + `{league}_{season}_player.json`
- Cron Render nightly 03:00 UTC
- Node.js : `loadAdvancedFBrefStats()` au boot, intégrer dans `db.advancedTeamStats` existant
- Frontend : badge "xG FBref" sur colonnes deep-stats, distinguer source BSD vs FBref

### Phase 3 — Pattern A microservice (roadmap P0 Bayesian P1)

- Container Python séparé sur Render (worker)
- Endpoints HTTP scrape on-demand pour deep-stats route
- Cache mutualisé avec PariScore via Redis ou SQLite partagée
- Use case : entraînement modèle bayésien xG Logistic + UQD (P1 roadmap)

---

## 8. +/- pour PariScore

### Avantages

- ✅ **Profondeur Opta-grade** : FBref expose xG/xGA/PSxG split, possession 16+ métriques, passing networks, defensive actions — niveau au-delà de BSD et Sofa.
- ✅ **Multi-sources unifiés** : ClubElo (Elo historique pour roadmap), Understat (shot-level xG), Football-Data.co.uk (odds historiques backtesting), FBref (Opta-grade) — sous **un seul wrapper**.
- ✅ **Données normalisées** : Pandas DataFrames avec colonnes/IDs cross-sources — joins triviaux.
- ✅ **Lib mature** : Pieter Robberechts académique soccer analytics (KU Leuven, ML4SA), commits actifs, v1.9.0 récente.
- ✅ **Cache automatique** + proxy support natif.
- ✅ **Licence MPL-2.0** : commercial-friendly.
- ✅ **Couverture étendue** : >50 ligues via FBref (vs 22 BSD).
- ✅ **ML training ready** : DataFrames Pandas = pipeline scikit-learn / PyTorch direct pour Bayesian Value Radar (P0 roadmap).

### Inconvénients

- ❌ **Stack hybride** : ajoute Python à PariScore (actuellement pure Node.js + SQLite) → ops complexity.
- ❌ **Pas un runtime live** : FBref publish 1-2h post-FT → inadapté à l'analyse pre-match courte fenêtre.
- ❌ **Rate limit FBref 10 req/min** : bottleneck pour scrapes massifs, OK pour batch nocturne.
- ❌ **Cloudflare risk** : FBref peut renforcer protections → fragile à long terme.
- ❌ **Légalité grise** : scraping public mais TOS FBref/Sports-Reference non explicite pour SaaS commercial — relire avant prod.
- ❌ **Pas d'API HTTP officielle** : doit être wrappé (microservice) pour Node.js → infra additionnelle.
- ❌ **Volume disque** : cache local Big 5 = ~200 MB / saison → planifier disk Render.

---

## 9. Verdict

🎯 **Recommandation : GO conditionnel pour POC + Pattern B batch nocturne (Phase 2)**.

**Justifications** :

1. **Gap réel** : audit BSD a montré l'absence de **stats Opta profondes** (passing networks, defensive actions, possession granulaire). FBref via soccerdata comble ce gap mieux que toute autre source gratuite.
2. **Stack pattern B = simple** : cron job nocturne + JSON files = ajout minimal de complexité. Pas de container Python en runtime.
3. **Use case roadmap P0/P1** : "Bayesian Value Radar" + "xG Logistic blending" + "Calibration sur 500 matchs" — soccerdata est **parfaitement aligné** sur ces besoins ML.
4. **Alternatives évaluées** : Understat seul (skipé en audit P2 — doublon BSD xG basique). Soccerdata fait mieux car **profondeur Opta** ≠ xG basique BSD.

**Conditions** :
- Confirmer empiriquement la divergence xG BSD vs xG FBref sur 30 matchs (validation hypothèse "profondeur réelle").
- Relire TOS Sports-Reference pour usage SaaS commercial.
- Mesurer latence/volume sur POC avant industrialisation.

**Pas de GO** sur :
- Pattern A microservice tant que pas de besoin live profond (overkill maintenant).
- Soccerdata Sofascore / Understat seuls (doublons BSD + Sofa déjà actifs).
- Live runtime intégration FBref (latence post-match incompatible).

---

## 10. Décision attendue de David

- [ ] **GO POC Phase 1** (1-2j local, mesure divergence xG BSD vs FBref) ?
- [ ] **GO Phase 2 batch** (6-8h, cron nocturne + JSON load Node.js) si Phase 1 concluante ?
- [ ] **Pattern A microservice** différé à roadmap P0/P1 Bayesian Value Radar ?
- [ ] Audit TOS Sports-Reference avant code (relecture obligatoire) ?

---

## 11. Sources

- [soccerdata FBref docs 1.9.0](https://soccerdata.readthedocs.io/en/latest/datasources/FBref.html)
- [GitHub probberechts/soccerdata](https://github.com/probberechts/soccerdata)
- [PyPI soccerdata](https://pypi.org/project/soccerdata/)
- [Getting started intro.rst](https://soccerdata.readthedocs.io/en/latest/intro.html)
- [DeepWiki Understat + Sofascore scrapers](https://deepwiki.com/probberechts/soccerdata/3.5-understat-and-sofascore-scrapers)
- [Sports-Reference bot traffic policy](https://www.sports-reference.com/bot-traffic.html) — 10 req/min FBref
- Context7 : library ID `/probberechts/soccerdata` (121 snippets indexés, source High reputation, benchmark 38)
