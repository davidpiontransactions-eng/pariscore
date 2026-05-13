# Étude de marché — APIs Foot gratuites complémentaires à BSD

**Date** : 2026-05-13
**Auteur** : Claude (CTO/Quant PariScore)
**Statut** : Étude only — validation utilisateur requise avant implémentation
**Objectif** : identifier APIs foot gratuites apportant des données ou couverture **non couvertes par BSD**, intégrables comme layers de routing (L2/L3/L4) sans coût récurrent.

---

## 1. Rappel — Position actuelle de BSD dans le routing PariScore

**BSD = Best Sports Data (Bzzoiro Sports Data)** — `bzzoiro.com` / `sports.bzzoiro.com`.
Source primaire du routing PariScore. Référencée dans `server.js:1094` (`BSD_API_KEY`), `:1884` (`BSD_CONFIG_TO_BSD`), `:6499` (`fetchBSDMatches`), `:7377` (`bsdToOddsApiFormat`), `:7478` (étape 1 du `fetchOdds`).

**Forces BSD** :
- ✅ Multi-bookmaker odds (41+ books)
- ✅ Managers profiles + ML predictions
- ✅ 21k+ players
- ✅ Live scores
- ✅ Pas de rate limit annoncé
- ✅ Gratuit sans CB
- ✅ 22 ligues couvertes

**Gaps suspectés BSD** (à confirmer empiriquement) :
- ❓ xG / Expected Goals — pas mentionnés
- ❓ Lineups / formations dynamiques
- ❓ Événements détaillés (cartons, subs, shotmap)
- ❓ Vidéo highlights
- ❓ Ligues hors-22 (Eredivisie, Primeira Liga, Championship, Serie B, Bundesliga 2, J1, MLS, Brasileirão tier 2…)
- ❓ Données historiques profondes (saisons -3 ans)
- ❓ Couverture coupes nationales mineures
- ❓ Logos / artwork équipes (UX)

---

## 2. Candidats — APIs Foot gratuites évaluées

### 2.1 football-data.org ✅ **DÉJÀ INTÉGRÉ (L2)**

| Élément | Valeur |
|---|---|
| URL | `https://api.football-data.org/v4/` |
| Auth | `X-Auth-Token: <free key>` |
| Rate limit free | **10 calls/min** (~14 400/jour) |
| Couverture | 12 compétitions : PL, La Liga, Bundesliga, Serie A, Ligue 1, UCL, Eredivisie, Primeira Liga, Championship, Brasileirão, World Cup, Euro |
| Données free | Standings, fixtures, scorers (goals only), squads |
| Données payantes | Assists, minutes, shots, cards (Tier One = €49/mo) |
| Statut PariScore | Déjà câblé dans `server.js:7489-7502` (L2 vérification ligues majeures) |
| Maturité | Depuis 2013 (Daniel Freitag), commitment "free forever" sur compétitions free |

**Action recommandée** : déjà OK, étendre exploitation — actuellement on appelle seulement `/competitions`, on pourrait tirer **fixtures + standings** pour fallback complet si BSD KO sur top 12.

---

### 2.2 TheSportsDB 🆕 **CANDIDAT FORT — complémentarité UX/visuelle**

| Élément | Valeur |
|---|---|
| URL | `https://www.thesportsdb.com/api/v1/json/3/` |
| Auth | Free key publique `3` (no register) ; Premium $9/mo Patreon → 100 req/min |
| Rate limit free | **30 req/min** |
| Données | Logos haute-rés, kits, badges, **artwork** stadiums, joueurs (photos), team descriptions multilangues, TV listings |
| Couverture | Crowdsourced — quasi tous les championnats existants, profondeur variable |
| Lacunes | Pas de live xG, pas d'odds, pas de ML predictions |

**Complémentarité BSD** : ✅ **fort** — apporte **logos + kits + photos joueurs + stadiums** que BSD ne fournit pas. Idéal pour enrichir l'UI PariScore (modals match, page équipe, header live).

**Pattern intégration suggéré** : layer "enrichment visuel" déclenché on-demand au render, **pas dans le cron**.

---

### 2.3 OpenFootball (football.json sur GitHub) 🆕 **CANDIDAT NICHE — zero-key fallback**

| Élément | Valeur |
|---|---|
| URL | `https://raw.githubusercontent.com/openfootball/football.json/master/` |
| Auth | **Aucune clé requise** |
| Rate limit | GitHub raw : ~5k req/h IP |
| Données | Fixtures + scores FT, top 5 ligues européennes + Bundesliga 2/3, World Cup 2026 (Canada/USA/Mexico), historique saisons |
| Maintenance | Crowdsourced GitHub, MAJ manuelle (peut être en retard de 24-48h sur la dernière journée) |
| Public domain | Oui |

**Complémentarité BSD** : ⚠️ **moyenne** — duplique fixtures BSD, mais utile comme **filet de sécurité zéro-clé** si BSD ET football-data.org tombent simultanément (rare mais possible).

**Pattern intégration suggéré** : layer "ultimate fallback" L5, lecture statique JSON, cache 12h.

---

### 2.4 OpenLigaDB 🆕 **CANDIDAT NICHE — Bundesliga**

| Élément | Valeur |
|---|---|
| URL | `https://www.openligadb.de/api/` |
| Auth | **Aucune clé requise** |
| Rate limit | Non documenté, communautaire |
| Données | Bundesliga 1/2/3 + DFB Pokal + équipe Allemagne, JSON REST |
| Couverture | Allemand only |

**Complémentarité BSD** : ⚠️ **faible** sauf si Bundesliga est tier-1 prioritaire dans PariScore et BSD se montre instable dessus.

---

### 2.5 Highlightly 🆕 **CANDIDAT DIFFÉRENCIATEUR — vidéo highlights**

| Élément | Valeur |
|---|---|
| URL | `https://highlightly.net/` |
| Auth | API key (registration free) |
| Rate limit free | Non publié précisément, "free tier included" |
| Données | **Vidéo highlights match** + live scores + odds + predictions, 950+ leagues, 9 sports |
| Différenciateur | **Seul fournisseur free + vidéo intégrée** |

**Complémentarité BSD** : ✅ **fort** — ajoute couche vidéo absente de tout autre provider gratuit. Potentiel UX premium pour la v10 (visionner les highlights des matchs Top 3 KPI déjà affichés).

**Risque** : provider récent (2024), maturité incertaine.

---

### 2.6 Understat 🆕 **CANDIDAT FORT — xG Big 5 leagues**

| Élément | Valeur |
|---|---|
| URL | `https://understat.com/` |
| Auth | **Scraping** — pas d'API officielle |
| Rate limit | Pas de bot protection agressive (CF-friendly) |
| Données | **xG, xA, xGChain, xGBuildup** par match + par joueur, shotmap, Big 5 leagues + RPL |
| Limitation | Bracket scraping → légalité grise pour SaaS payant |

**Complémentarité BSD** : ✅ **très fort sur xG** — si BSD ne fournit pas xG (à vérifier).

**Risque légal** : scraping public mais TOS Understat non explicite sur usage commercial. **Reco** : limiter à enrichissement post-match (archivage / backtesting), pas en live.

---

### 2.7 StatsBomb Open Data 🆕 **CANDIDAT BACKTESTING — gold-standard mais limité**

| Élément | Valeur |
|---|---|
| URL | `https://github.com/statsbomb/open-data` |
| Auth | **Aucune** — repo GitHub public |
| Format | JSON statique, events niveau frame (touches, passes, shots) |
| Couverture | **Quelques compétitions sélectionnées** : Euro 2020/2024, World Cup 2018/2022, FAWSL, Champions League historique partielle |
| Limitation | **Pas de live, pas de fixtures récents** — usage uniquement R&D / ML training |

**Complémentarité BSD** : ⚠️ **niche R&D** — utile pour entraîner modèles bayésiens (P0 roadmap PariScore), pas pour le scout temps-réel.

---

### 2.8 ESPN Public Endpoints 🆕 **CANDIDAT BACKUP — multi-sport**

| Élément | Valeur |
|---|---|
| URL | `https://site.api.espn.com/apis/site/v2/sports/soccer/...` |
| Auth | **Aucune clé** (undocumented public endpoints) |
| Rate limit | Pas annoncé, raisonnable (skills `football-data` utilisent déjà ESPN) |
| Données | Scores live, schedules, standings, news, team info, 13 ligues majeures |
| Stabilité | Endpoints stables depuis années mais "undocumented" → risque changement silencieux |

**Complémentarité BSD** : ✅ **moyen-fort** — backup scores live + schedules zéro-clé, utile en mode dégradé.

**Note** : les skills `.claude/skills/football-data/` Anthropic exploitent déjà ces endpoints → patterns testés disponibles dans le projet.

---

### 2.9 API-Football (free tier) ❌ **REJET — quota trop bas**

| Élément | Valeur |
|---|---|
| Rate limit free | **100 requêtes/jour** ❌ |
| Couverture | 1236 leagues nominalement |
| Réalité | 100/jour = inutilisable pour PariScore (volume scout ~2-10k/jour) |

**Verdict** : non viable comme layer routing. PariScore tourne déjà sur le **plan PRO payant** (7 500 req/jour, $19/mo) pour les stats — pas d'intérêt à ajouter le free tier en complément.

---

### 2.10 Sportmonks (free tier) ❌ **REJET — 2 ligues seulement**

| Élément | Valeur |
|---|---|
| Couverture free | **Danish Superliga + Scottish Premiership uniquement** |
| Plan minimal payant | €29/mo (5 ligues) |

**Verdict** : free tier inutilisable. Sportmonks excellent en payant (xG + 2 200 leagues + EUR 29/mo entry) mais hors scope "gratuit".

---

### 2.11 Live-Score API 🟡 **À VÉRIFIER**

| Élément | Valeur |
|---|---|
| URL | `https://live-score-api.com/` |
| Free tier | Existe (volumes non publiés en snippet) |
| Couverture | 400+ compétitions, 30+ langues |
| Données | Live scores, fixtures, events, statistics, lineups, standings |

**Action recommandée** : POC inscription nécessaire pour évaluer quota free réel. Potentiellement intéressant si lineups gratuits.

---

### 2.12 SoccersAPI 🟡 **À VÉRIFIER**

| Élément | Valeur |
|---|---|
| URL | `https://soccersapi.com/` |
| Free tier | "Get started for free" — limites non publiées dans recherche |
| Couverture | Football data temps-réel |

**Action recommandée** : POC inscription requis.

---

## 3. Matrice de complémentarité avec BSD

Légende : ✅ apporte / ⚠️ partiel / ❌ doublonne / — non applicable

| API | Fixtures | Live scores | Odds | xG | Lineups | Logos/Art | Vidéo | Coupes | Backtesting |
|---|---|---|---|---|---|---|---|---|---|
| **BSD (référence)** | ✅ | ✅ | ✅ 41+ books | ❓ | ❓ | ❌ | ❌ | ⚠️ | ⚠️ |
| football-data.org | ❌ doublon | ❌ doublon | — | — | — | — | — | ✅ secours | — |
| TheSportsDB | ⚠️ | ⚠️ | — | — | — | ✅ **STRONG** | — | ✅ | ⚠️ |
| OpenFootball.gh | ⚠️ ultimate | — | — | — | — | — | — | — | ✅ public domain |
| OpenLigaDB | ⚠️ Bundesliga | ⚠️ | — | — | — | — | — | ✅ DFB Pokal | — |
| Highlightly | ⚠️ | ⚠️ | ⚠️ | — | — | — | ✅ **STRONG** | — | — |
| Understat | — | — | — | ✅ **STRONG** | — | — | — | — | ✅ |
| StatsBomb OD | — | — | — | ✅ events | ✅ events | — | — | ⚠️ | ✅ **STRONG R&D** |
| ESPN public | ⚠️ | ✅ backup | ⚠️ | — | ⚠️ | ⚠️ | — | ⚠️ | — |
| Live-Score API | ❓ | ❓ | — | — | ❓ lineups | — | — | ❓ | — |

---

## 4. Recommandation — 3 layers à ajouter (par priorité d'impact)

### 🥇 Priorité 1 — TheSportsDB (UX visual enrichment)

**Pourquoi** : BSD = données froides, sans artwork. TheSportsDB injecte logos kits photos qui rendent PariScore visuellement crédible vs OddAlerts/Sofascore.

**Pattern** : layer enrichment **on-demand au render**, pas dans cron. Cache 7 jours côté serveur (logos changent peu).

**Coût** : 0€. 30 req/min largement suffisant pour 18 ligues × team enrichment.

**Effort dev estimé** : 4-6h.

---

### 🥈 Priorité 2 — Understat (xG Big 5 leagues)

**Pourquoi** : si BSD ne fournit pas xG, c'est un trou majeur pour PariScore (le moteur Poisson roadmap P0 mentionne **xG Logistic blending**). Understat couvre Premier League, La Liga, Bundesliga, Serie A, Ligue 1 + RPL.

**Pattern** : scraping post-match → enrichment `db.advancedTeamStats` ou table dédiée `xg_history`. Cache 24h.

**Coût** : 0€ mais effort scraping + risque légal grise zone.

**Effort dev estimé** : 1-2 jours.

**Pré-requis** : confirmer empiriquement que BSD ne fournit pas xG (sinon doublon).

---

### 🥉 Priorité 3 — OpenFootball GitHub (ultimate zero-key fallback)

**Pourquoi** : sécurité opérationnelle. Si BSD + football-data.org KO simultanément → on a un L5 sans clé qui sert au moins les fixtures top 5 + World Cup 2026.

**Pattern** : layer L5 dans `fetchOdds` après The Odds API, fetch raw JSON GitHub, cache 12h.

**Coût** : 0€.

**Effort dev estimé** : 2-3h.

---

## 5. Recommandations secondaires (post-validation des 3 prioritaires)

- **Highlightly** : à évaluer pour v10 si UX vidéo devient un différenciateur produit (pricing free pas verrouillé, POC inscription requis).
- **ESPN public** : intégrable comme L6 backup live scores en mode dégradé. Patterns disponibles dans `.claude/skills/football-data/`.
- **StatsBomb Open Data** : repo R&D séparé pour calibration des modèles bayésiens (roadmap P0/P1 "Bayesian Value Radar"). Pas dans le runtime production.
- **OpenLigaDB** : seulement si analyse des logs montre BSD défaillant spécifiquement sur Bundesliga.
- **Live-Score API + SoccersAPI** : POC inscription requis pour évaluer quotas réels. Pas de décision sans data.

---

## 6. Rejets motivés

| API | Raison rejet |
|---|---|
| API-Football free tier | 100 req/jour ridicule — déjà sur plan PRO $19/mo |
| Sportmonks free | 2 ligues (Danemark + Écosse) |
| FBref scraping | Cloudflare blocking → browser headless coûteux |
| Sportradar | Pas de free tier |
| Sportsdata.io | Pas de free tier viable |

---

## 7. Architecture cible — Layers de routing post-intégration

```
fetchOdds (server.js:7446)
├── L1 : BSD (primaire, fixtures + odds + managers + ML preds)    [EXISTANT]
├── L2 : Football-Data.org (vérif top 12 ligues)                  [EXISTANT, à étendre fixtures]
├── L3 : The Odds API (enrichissement odds 5 ligues priority)     [EXISTANT]
├── L4 : OpenFootball GitHub JSON (ultimate zero-key fallback)    [🆕 PROPOSÉ]
└── enrichment ON-DEMAND (au render):
    ├── TheSportsDB (logos, kits, photos)                         [🆕 PROPOSÉ — Priorité 1]
    └── Understat (xG post-match, cache 24h)                      [🆕 PROPOSÉ — Priorité 2]

fetchStats (server.js:7607)
├── Phase 1 : BSD standings (zéro quota)                          [EXISTANT]
└── Phase 2 : API-Football PRO (fallback payant $19/mo)           [EXISTANT]
    ↑ aucun ajout free tier proposé : free API-Football = 100/j inutile
```

---

## 8. Synthèse économique

| Provider proposé | Coût mensuel | Coût annuel | Valeur ajoutée |
|---|---|---|---|
| TheSportsDB free | **0 €** | **0 €** | Logos/kits/photos → UX premium |
| Understat scraping | **0 €** | **0 €** | xG Big 5 leagues (gap critique modèle) |
| OpenFootball GH | **0 €** | **0 €** | Filet sécurité zéro-clé |
| **Total ajout** | **0 €/mo** | **0 €/an** | 3 capacités neuves sans coût |

**Stack PariScore actuelle** : $19/mo (API-Football PRO) + $0 (BSD, football-data, The Odds API free).
**Stack post-intégration** : identique financièrement, +3 capacités fonctionnelles.

---

## 9. Inconnues à lever avant implémentation

1. **BSD fournit-il xG ?** — empirique : appel `/match-detail/{id}` et grep `xg` dans payload. **À confirmer** avant Priorité 2 (Understat) sinon doublon.
2. **BSD fournit-il logos haute-rés ?** — empirique : appel team-detail et inspect champ `logo`. Si oui, Priorité 1 (TheSportsDB) downgraded.
3. **TOS Understat scraping commercial** — relecture obligatoire avant build.
4. **Latence OpenFootball GitHub** — GitHub raw peut throttle, mesurer p95.
5. **Stabilité Highlightly** — provider 2024, risque churn.

---

## 10. Décision attendue de David

Pour passer à l'implémentation, valider :

- [ ] Priorité 1 — **TheSportsDB enrichment visuel** : GO / NO-GO ?
- [ ] Priorité 2 — **Understat xG scraping** : GO conditionnel à confirmation gap BSD xG / NO-GO ?
- [ ] Priorité 3 — **OpenFootball GitHub L5 fallback** : GO / NO-GO ?
- [ ] Ordre d'attaque préféré (1→2→3 ou autre) ?
- [ ] Veut-on aussi POCer Highlightly / Live-Score API / SoccersAPI en parallèle ?
- [ ] Audit BSD préalable (vérifier présence xG + logos dans payloads BSD réels) — accepté ou skip ?

---

## 11. Sources

- [Free Football APIs in 2026 — TheStatsAPI](https://www.thestatsapi.com/blog/free-football-api-alternatives)
- [football-data.org coverage](https://www.football-data.org/coverage) — 12 compétitions free forever, 10 req/min
- [TheSportsDB documentation](https://www.thesportsdb.com/documentation) — 30 req/min free, Patreon $9/mo premium
- [OpenFootball football.json GitHub](https://github.com/openfootball/football.json) — public domain, no key
- [OpenLigaDB facts.dev](https://www.facts.dev/api/openligadb/) — Bundesliga focus, no key
- [Sportmonks free plan](https://www.sportmonks.com/football-api/free-plan/) — 2 ligues only
- [Highlightly](https://highlightly.net/) — 950+ leagues, video highlights free tier
- [StatsBomb open-data GitHub](https://github.com/statsbomb/open-data) — JSON events gold standard
- [Understat scraper Apify](https://apify.com/mirthful_radish/understat-xg-football-scraper) — xG Big 5
- [Best Football Data APIs 2026 — footyapps](https://footyapps.com/guide/free-football-apis)
- [Top API-Football alternatives — Slashdot](https://slashdot.org/software/p/API-Football/alternatives)
- [BSD product page bzzoiro](https://sports.bzzoiro.com/free-football-api/) — 41+ books, 21k+ players, no rate limit

---

**Fin de l'étude. En attente de validation utilisateur avant implémentation.**
