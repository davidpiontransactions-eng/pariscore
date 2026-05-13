# Audit BSD — payloads réels exploités par PariScore

**Date** : 2026-05-13
**Auteur** : Claude (CTO/Quant)
**Scope** : map exhaustive endpoints BSD utilisés dans `server.js`, champs extraits, gaps confirmés
**Méthode** : grep statique du code `server.js` (pas d'appel live API)
**Objectif** : qualifier les gaps réels BSD avant tout choix de provider complémentaire

---

## 1. Surface API BSD utilisée (11 endpoints distincts)

Wrapper unique : `bsdFetch(endpoint)` — `server.js:1861` — base `https://sports.bzzoiro.com/api`, header `Authorization: Token ${BSD_API_KEY}`, query auto-append `tz=Europe/Paris`.

| # | Endpoint BSD | Fonction wrapper | Ligne | Usage |
|---|---|---|---|---|
| 1 | `/events/?date_from=&date_to=&league=` | `fetchBSDMatches` | 6499 | Discovery primaire fixtures + live + odds |
| 2 | `/events/{id}/` | `fetchBSDEventDetail` | 13535 | Live stats détaillées (sr_stats) |
| 3 | `/predictions/?league={eventId}` | `fetchBSDPrediction` | 6550 | ML CatBoost predictions par match |
| 4 | `/teams/{id}/` | `bsdGetTeamDetail` | 1666 | Profil équipe (logo, stadium, manager) |
| 5 | `/teams/{id}/matches/?page_size=10` | (inline) | 1676 | Recent matches équipe |
| 6 | `/players/{id}/` | `bsdGetPlayerDetail` | 1489 | Profil joueur |
| 7 | `/player-stats/?player={id}&page_size=100` | `bsdGetPlayerDetail` | 1499 | Stats per-match joueur |
| 8 | `/players/?team={id}&page_size=100` | `fetchBSDTeamSquad` | 6829 | Effectif équipe + attributs psychométriques |
| 9 | `/seasons/?league={id}&current=true` | `fetchBSDStandings` | 6343 | Résolution season ID |
| 10 | `/leagues/{id}/standings/?season={id}` | `fetchBSDStandings` | 6374 | Classement avec splits home/away |
| 11 | `/player-stats/?team_season=` | `fetchBSDPlayerRatings` | 6864 | Ratings aggregation team/season |
| 12 | `/teams/{id}/matches/?team=X&page_size=N` | `fetchBSDTeamLastFixtures` | 6731 | Derniers matchs équipe (avec corner history) |
| 13 | `/teams/{id}/matches/` (corners) | `fetchBSDTeamCornerHistory` | 6783 | Historique corners équipe |

---

## 2. Champs BSD effectivement extraits (par catégorie)

### 2.1 Match / Event

Source : `fetchBSDMatches` (server.js:6499-6542) + `fetchBSDEventDetail` (13535).

| Champ | Source BSD | Statut |
|---|---|---|
| `id`, `home_team`, `away_team` | `e.id`, `e.home_team`, `e.away_team` | ✅ |
| `league.name`, `league.country` | `e.league.name`, `e.league.country` | ✅ |
| `commence_time` | `e.event_date` | ✅ |
| `status`, `live_minute` | `e.status`, `e.current_minute` | ✅ |
| `home_score`, `away_score` | `e.home_score`, `e.away_score` | ✅ |
| **Odds 1X2** | `e.odds_home/draw/away` | ✅ |
| **Odds Over 2.5** | `e.odds_over_25 / under_25` | ✅ |
| **Odds BTTS** | `e.odds_btts_yes` | ✅ |
| **xG live** | `e.actual_home_xg / home_xg_live` | ✅ |
| Coaches + formation préférée | `e.home_coach.name + preferred_formation` | ✅ |
| Joueurs indisponibles | `e.unavailable_players` | ✅ |
| Live shots / SOT / corners | `match.live_shots / live_shots_on_target / live_corners` (mais via Sofa enrichment, **pas direct BSD**) | ⚠️ partiel |
| Live possession | `sr.ball_safe_pct` ou `match.live_possession` (Sofa) | ⚠️ partiel |
| Dangerous attacks | `sr.dangerous_attack` (BSD event detail sr_stats) | ✅ |
| Shotmap coords | **Sofa only** (`sofaEnrich.shotmap`, server.js:10552) | ❌ BSD |

### 2.2 Team

Source : `bsdGetTeamDetail` (server.js:1666-1705).

| Champ | Source BSD | Statut |
|---|---|---|
| `id`, `name`, `short_name` | `t.id`, `t.name`, `t.short_code` | ✅ |
| `logo` | `https://sports.bzzoiro.com${t.image_path}` | ✅ basse-rés |
| `country`, `country_code` | `t.country.name`, `t.country.code` | ✅ |
| `stadium` (nom) | `t.venue.name` | ✅ |
| `stadium_capacity` | `t.venue.capacity` | ✅ |
| `founded` | `t.founded` | ✅ |
| `manager` | `t.coach.name` | ✅ |
| **Kit images** (home/away/third) | — | ❌ ABSENT |
| **Stadium image** | — | ❌ ABSENT |
| **Stadium GPS** | — | ❌ ABSENT |
| **Logo HD / multi-format** | — | ❌ ABSENT |
| **Team description / bio multilangue** | — | ❌ ABSENT |
| **Team colors hex** | — | ❌ ABSENT |
| **Social media** | — | ❌ ABSENT |
| **Honours / palmarès** | — | ❌ ABSENT |

### 2.3 Player

Source : `bsdGetPlayerDetail` (1489), `fetchBSDTeamSquad` (6829), `fetchBSDPlayerRatings` (6864).

| Champ | Source BSD | Statut |
|---|---|---|
| `id`, `name`, `short_name` | `p.id`, `p.name`, `p.short_name` | ✅ |
| Photo | `https://sports.bzzoiro.com/img/player/{id}/` (5936, 5994, 6952) ou `p.image_path` (1603) | ✅ |
| Position (G/D/M/F + specific) | `p.position`, `p.specific_position` | ✅ |
| Jersey number | `p.jersey_number` | ✅ |
| **Attributes psychométriques** | `p.attributes` (tactical/attacking/defending/technical/creativity) | ✅ **différenciateur BSD** |
| **Strengths / weaknesses** | `p.strengths`, `p.weaknesses` | ✅ **différenciateur BSD** |
| Availability + injury | `p.availability`, `p.injury_type`, `p.injury_expected_return` | ✅ |
| Preferred foot | `p.preferred_foot` | ✅ |
| Nationality | `p.nationality` | ✅ |
| Market value | `p.market_value` | ✅ |
| **Stats per-match** | goals, assists, minutes, yellow/red, saves, shots_on/total/in_box, key_pass, **xG/xA**, rating | ✅ complet |
| Photo HD / render / cutout | — | ❌ ABSENT (format BSD = thumb basique) |
| Bio biographie | — | ❌ ABSENT |
| Honours individuels | — | ❌ ABSENT |
| Date de naissance | — | ❌ non vérifié (probable absent) |
| Hauteur / poids | — | ❌ non vérifié (probable absent) |

### 2.4 Standings

Source : `fetchBSDStandings` (6337-6500).

| Champ | Statut |
|---|---|
| Position, played, won/drawn/lost, gf/ga, points | ✅ |
| **Splits home/away** (played_home/away, won_home/away, gf_home/away, ga_home/away) | ✅ avec fallback Math.floor si BSD ne renvoie pas |
| Form L5 (W/D/L string) | ✅ (`entry.form`) |

### 2.5 Predictions ML

Source : `fetchBSDPrediction` (6550).

| Champ | Statut |
|---|---|
| Predictions CatBoost ML | ✅ via `/predictions/?league={eventId}` |
| Contenu détaillé du payload predictions | ⚠️ non documenté dans audit (juste passé tel quel au front) |

### 2.6 Live (event detail sr_stats)

Source : `fetchBSDEventDetail` (13535) + `computePressureIndex`/`computeCompositeMomentum` (13614/13555).

| Champ | Statut |
|---|---|
| `sr.dangerous_attack.home/away` | ✅ |
| `sr.ball_safe_pct.home/away` (possession) | ✅ |
| `actual_home_xg / home_xg_live` | ✅ |
| Shots / SOT / corners live | ⚠️ **Sofa primaire** (`enrichMatchWithSofaLiveStats`, server.js:14142) |
| Shotmap coordinates | ❌ **Sofa only** (10552) |
| Momentum chart | ✅ calculé par PariScore (composite signed -100..+100) |

---

## 3. Gaps BSD confirmés (= opportunités complémentaires réelles)

### 3.1 Visuels / branding (UX)

| Gap | Impact PariScore | Provider qui couvre |
|---|---|---|
| **Kits home/away/third** | UX modal match (affichage kit) | TheSportsDB (`strKitHome/Away/Third`) |
| **Stadium image / photo** | UX modal match / page équipe | TheSportsDB (`strStadiumThumb`), Wikidata |
| **Stadium GPS coords** | Calcul kilométrage déplacement (roadmap P2 Context Engine) | OpenStreetMap Nominatim, Wikidata |
| **Logo HD / SVG / multi-format** | UI haute densité (Retina) | TheSportsDB (`strBadge`, `strLogo`), Wikipedia Commons |
| **Team description multilangue** | SEO / pages équipe | TheSportsDB (`strDescriptionFR/EN/...`) |
| **Team colors hex** | Thématisation UI dynamique | TheSportsDB (`strColour1/2/3`) |

### 3.2 Données match enrichies

| Gap | Impact PariScore | Provider qui couvre |
|---|---|---|
| **Match events détaillés** (timeline cartons/buts/subs avec minute exacte + scorer) | Live tracker / résumé post-match | football-data.org (`/matches/{id}` détaillé), ESPN public, Sofa |
| **Lineups XI starting + bench + formation drawing** | Modal match avant kickoff | football-data.org PRO, Sofa, API-Football |
| **Referee + assistants** | Roadmap P2 "Context Engine" | football-data.org, API-Football |
| **Weather conditions** | Roadmap P2 ajustement xG | OpenWeatherMap, AccuWeather (free tier) |
| **TV broadcasters** | UX (déjà via Sofa public — server.js:1707) | Sofa public (existant), TheSportsDB (`strTvNetwork`) |

### 3.3 Player détaillés

| Gap | Impact | Provider |
|---|---|---|
| **Photo HD / cutout / render PNG transparent** | UX modal joueur | TheSportsDB (`strThumb`, `strCutout`, `strRender`) — DÉJÀ INTÉGRÉ partiellement (server.js:423) |
| **Bio / Wikipédia** | Page joueur | TheSportsDB (`strDescriptionFR/EN`), Wikipedia API |
| **Date naissance / âge / hauteur / poids** | Affichage profil | TheSportsDB, API-Football |
| **Honours individuels** | Crédibilité | TheSportsDB (`strHonours`), Wikipedia |

### 3.4 Vidéo

| Gap | Impact | Provider |
|---|---|---|
| **Highlights vidéo post-match** | Différenciateur UX v10 | Highlightly (950+ leagues, free tier), Sofascore (URL embed) |
| **Embeds buts / actions clés** | UX live tracker | Highlightly |

### 3.5 Couverture ligues

| Gap suspecté | Statut |
|---|---|
| Ligues hors-22 (Championship, Bundesliga 2, J1, MLS, Eredivisie, Primeira, Brasileirão tier 2, coupes nationales mineures) | À mesurer empiriquement — `BSD_CONFIG_TO_BSD` mapping = liste limitative |
| Historique > 3 saisons | Limité par BSD `bsdCurrentSeasonYear()` (server.js:2418) |

→ Pour ces gaps : **football-data.org** (12 compétitions free forever) couvre Championship + Eredivisie + Primeira + Brasileirão tier 1 + Euro/WC. **OpenFootball GitHub** couvre top 5 + WC2026.

### 3.6 Backtesting / R&D

| Gap | Provider |
|---|---|
| Events frame-by-frame (pass touches, shotmap raw coords par tir) | StatsBomb Open Data (R&D ML uniquement, compétitions limitées) |
| xG par tir individuel hors Big 5 | Understat (Big 5 seulement) |

---

## 4. Verdict — re-priorisation post-audit

### 4.1 Étude initiale vs audit empirique

| Item étude | Verdict post-audit | Action |
|---|---|---|
| P1 — TheSportsDB enrichment | ⚠️ **partiellement intégré** (photos joueurs). Vrais gaps = kits + stadium image + logo HD + bio + colors | Reformuler P1bis (kits/stadiums/HD/bio/colors) |
| P2 — Understat xG scraping | ❌ **DOUBLON** — BSD fournit xG match + player + live + xG_per90 + xG_overperformance | **SKIP DÉFINITIF** |
| P3 — OpenFootball GitHub L5 fallback | ✅ valable — pas couvert | Maintenir |

### 4.2 Nouveaux candidats émergeant de l'audit

| Candidat | Gap réel comblé | Effort | Coût |
|---|---|---|---|
| **football-data.org étendre** | Match events timeline, lineups, referee, Championship/Eredivisie/Primeira coverage | 4-6h | 0€ (déjà L2, juste étendre les calls) |
| **TheSportsDB élargi** (P1bis) | Kits, stadiums, logos HD, colors, bio, team description | 6-8h | 0€ (30 req/min free) |
| **Highlightly POC** | Vidéo highlights (différenciateur UX) | 6-8h après POC inscription | 0€ free tier |
| **Wikidata / OpenStreetMap** | Stadium GPS pour kilométrage roadmap P2 | 4h | 0€ |
| **Sofa public TV channels** | DÉJÀ INTÉGRÉ (`fetchTVChannels` server.js:1707) | — | — |

### 4.3 Re-rankée Top 3 finale (post-audit)

🥇 **P1bis — TheSportsDB étendu (kits + stadiums + logos HD + colors + bio)**
- Effort : 6-8h (étendre `fetchTheSportsDBPlayerPhoto` existant vers `fetchTheSportsDBTeamBranding`)
- Coût : 0€
- Gap réel comblé : visuels premium absents de BSD
- Risque : faible (provider mature 2026, API publique stable)

🥈 **P2bis — football-data.org étendu (match events + lineups + referee + extra leagues)**
- Effort : 4-6h
- Coût : 0€ (provider déjà L2)
- Gap réel comblé : timeline événements + lineups + couverture Championship/Eredivisie/Primeira
- Risque : nul (commitment "free forever")

🥉 **P3 — OpenFootball GitHub L5 fallback (zero-key)**
- Effort : 2-3h
- Coût : 0€
- Gap réel comblé : sécurité opérationnelle si BSD + football-data.org KO
- Risque : faible (lag 24-48h mais filet seulement)

### 4.4 Différé / rejet

- ❌ Understat (doublon xG BSD)
- ❌ API-Football free (100 req/j = inutile, plan PRO payant déjà en place)
- ❌ Sportmonks free (2 ligues seulement)
- ⏸️ Highlightly (potentiel v10 vidéo, POC inscription d'abord)
- ⏸️ StatsBomb Open Data (R&D ML, pas runtime — chantier roadmap P0 Bayesian)
- ⏸️ Wikidata/OSM Stadium GPS (utile roadmap P2 Context Engine, pas urgent)

---

## 5. Inconnues qui restent à lever (POC empirique requis)

1. **Couverture ligues réelle BSD** : liste précise `BSD_CONFIG_TO_BSD` vs liste rêvée roadmap. À auditer via `leagues_config.json` + grep mapping.
2. **Profondeur predictions ML BSD** : payload `/predictions/?league={eventId}` jamais doc dans audit, juste forwardé. Inspect payload réel pour mesurer valeur ajoutée vs Poisson PariScore maison.
3. **Match events timeline BSD** : `fetchBSDEventDetail` retourne `sr_stats` mais pas un payload events timeline structuré ? À tester sur un match terminé.
4. **TheSportsDB kits/stadiums disponibilité par ligue** : couverture variable (crowdsourced). Mesurer % d'équipes Ligue 1 / PL avec kits HD avant code.

---

## 6. Décision attendue post-audit

GO/NO-GO sur chaque item rerangé :

- [ ] **P1bis** — TheSportsDB étendu (kits + stadiums + logos HD + colors + bio)
- [ ] **P2bis** — football-data.org étendu (match events + lineups + referee + extra leagues)
- [ ] **P3** — OpenFootball GitHub L5 fallback

Et ordre d'attaque.

---

## 7. Sources de l'audit

Audit statique 100% codé sur `server.js` — toutes lignes documentées ci-dessus, vérifiables par grep :

- `server.js:1085-1095` — config BSD base URL + API key
- `server.js:1472-1705` — search/detail BSD wrappers
- `server.js:1861` — bsdFetch wrapper
- `server.js:6337-7400` — standings + matches + predictions + squad + ratings
- `server.js:13535` — event detail
- `server.js:10539-10555` — Sofa override sur xG/shotmap/momentum/possession
- `server.js:14118-14160` — pollLiveScores + enrichMatchWithSofaLiveStats

**Pas d'appel live API BSD** — audit pur grep code. Pour valider empiriquement les gaps (notamment kits/stadiums/predictions payload), POC `curl -H "Authorization: Token $BSD_API_KEY" https://sports.bzzoiro.com/api/...` requis.
