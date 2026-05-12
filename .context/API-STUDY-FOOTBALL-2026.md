# Étude API Football 2026 — PariScore Stack Decision

> **Mission :** identifier le meilleur stack qualité/coût pour PariScore (SaaS ~100 users, prematch + live complets) afin de remplacer / compléter la chaîne actuelle (Odds API 500/mois + API-Football Free 100/jour + BSD proxy + Sofascore 403).
> **Date :** mai 2026 — données vérifiées via WebSearch sur les pages de pricing officielles.

---

## 1. Contexte stack actuel PariScore

| Source utilisée | Statut | Problème |
|---|---|---|
| The Odds API (free) | 500 req/mois | Saturé — empêche refresh cotes < 12h |
| API-Football (Free) | 100 req/jour, **pas de live**, 10 ligues max | Bloque `fixtures?live=all` et `teams/statistics` en cours de match |
| BSD / Bzzoiro (proxy Sportradar) | Token payant | Live OK (possession via `ball_safe_pct`, `attack`, `dangerous_attack`) mais **pas de tirs/SOT/corners/momentum graph** |
| Sofascore (direct serveur) | **403 Cloudflare** | Inutilisable serveur-side sans Playwright headless |

**Manques critiques :** tirs cadrés live, courbe momentum, xG live, dropping odds tracker, couverture marchés (BTTS/Over) côté book.

---

## 2. Table A — PAID PROVIDERS

| Provider | Plan | Prix / mois | Quota | Live stats (poss/shots/SOT/corners/xG/momentum) | Prematch (xG/standings/lineups/H2H) | Ligues | Notes |
|---|---|---|---|---|---|---|---|
| **API-Football (api-sports.io)** | Free | 0 € | 100 req/jour | Endpoint dispo mais 100/j tue le polling | Limité (10 leagues) | 10 | Bloque l'usage live réel |
| **API-Football** | **Pro** | **19 $** | 7 500 req/jour | OUI : possession, tirs, SOT, corners, fouls, cartons (xG via stats avancées) | Standings + lineups + H2H + injuries | 1 100+ | **Sweet spot** pour SaaS <500 users |
| **API-Football** | Ultra | 29 $ | 75 000 req/jour | Idem Pro | Idem Pro | 1 100+ | Pour 2 000+ matchs/jour multi-marchés |
| **API-Football** | Mega | 39 $ | 150 000 req/jour | Idem Pro | Idem Pro | 1 100+ | Overkill pour 100 users |
| **Sportmonks** | Starter | 69 € | 3 000 req/h | Possession + cards + corners + shots — pas momentum | xG depuis saison 2024, prédictions IA | 5 ligues | Trop limité (5 ligues) |
| **Sportmonks** | Growth | ~149 € | 6 000 req/h | Idem + xG live (Advanced add-on) | xG + Pressure Index + Predictions | 30 ligues | Bien si focus top-30 |
| **Sportmonks** | Pro | ~249 € | 12 000 req/h | xG live, Pressure Index natif | xG complet + value bets endpoint | 120 ligues | Concurrent direct OddAlerts |
| **The Odds API** | Free | 0 € | 500 req/mois | N/A (cotes uniquement, pas stats) | 40 books cotes prematch + live | Toutes | Trop tight pour SaaS |
| **The Odds API** | Starter | ~30 $ | 20 000 req/mois | Live odds h2h + spreads + totals | + player props add-on | Toutes | Bon pour devigging |
| **The Odds API** | Pro | ~119 $ | 5 M req/mois | Live full markets | Player props inclus | Toutes | Pour edge engine sérieux |
| **Pinnacle (officiel)** | Direct API | **FERMÉ** depuis 23/07/2025 | — | Sharp lines référence du marché | — | — | Demander accès par email — résevré aux pros |
| **Pinnacle via SportsGameOdds** | Standard | 299 $+ | Variable | Lignes Pinnacle relayées | Idem | Toutes | Alternative pour CLV tracking |
| **Pinnacle via Bettingiscool/Feed.arbing** | Feed | 150 €/feed (min 3) | Selon contrat | Sharp odds + closing lines | Historique CLV | — | 450€/mo mini |
| **SportsDataIO** | Trial (Soccer) | 0 $ | Illimité mais UCL only | Limité au test | UCL uniquement | 1 | Pas exploitable prod |
| **SportsDataIO** | Soccer prod | **Quote** ($500-2 000 enterprise) | Custom | Live full | Full coverage | Mondial | Sales engagement obligatoire |
| **Sportradar** | Enterprise | **Quote** ($500-1 000+/mo entry, souvent 5 000+) | Custom | Top-tier live (data officielle FIFA/UEFA pour certaines ligues) | Tout + player props + probabilities | Mondial | Sales lourd, contrats annuels |
| **Genius Sports** | Enterprise | Quote (premium tier) | Custom | Données officielles + ultra-low latency | Full | Mondial | Hors budget SaaS indé |
| **LSports** | Enterprise modular | Quote (plus accessible) | Custom | 100+ sports, low latency | Full | Mondial | Alternative crédible Sportradar/Genius |
| **Opta / Stats Perform** | Enterprise | Quote (premium) | Custom | Référence absolue (xG Opta = standard industrie) | Référence | Mondial | Trop cher pour 100 users |
| **OpticOdds** | Standard | ~$300-500 quote | Variable | Live odds 150+ books | Sharp + soft books | Mondial | Concurrent direct The Odds API |
| **Goalserve** | Live Stats | 200 $ | Illimité | Possession, cards, corners, tirs — pas xG ni momentum | Livescore + lineups | 400+ ligues | Solide milieu de gamme |
| **Goalserve** | Full Package | 550 $ | Illimité | Live stats + inplay odds | Tout | 1 000+ | Concurrent SportsDataIO moins cher |
| **Allsportsapi.com** | Custom | Pricing privé (env. 25-100 $) | Variable | Livescore + lineups + standings + live stats | OK | Mondial | Peu documenté, à tester |
| **Live-Score-API.com** | Starter | ~$15 | 5 000 req/jour | Livescore basique (pas xG/momentum) | Standings + H2H | 100+ | Low-cost option |

> **NB :** Sportradar/Genius/Opta/Stats Perform sont systématiquement hors budget pour un SaaS à 100 users (entry ~5 000 €/mo + contrats annuels). À écarter sauf pivot B2B.

---

## 3. Table B — FREE PROVIDERS

| Provider | Coverage | Limites | Live ? | Notes |
|---|---|---|---|---|
| **Football-Data.org** (free) | UCL, EPL, Ligue 1, Bundesliga, La Liga, Serie A, Eredivisie, Primeira, Championship, Brasileirão, World Cup, Euro | 10 req/min, scores **retardés** | Partiel (livescore € 12/mo pour temps réel) | Fondateur engagé "free forever" sur ces compétitions — fiable backup standings/scores |
| **OpenLigaDB** | Bundesliga 1/2/3, DFB-Pokal, équipe nationale Allemagne | Aucune (crowdsourced) | Oui (basique) | Réservé à l'Allemagne — utile si focus Bundesliga |
| **TheSportsDB (free)** | 617 ligues soccer crowdsourcées | 30 req/min, **commercial = $9 Patreon** | Non (livescores en V2 premium) | Riche en metadata/logos/fanart, faible en stats |
| **TheSportsDB Premium** | 617 ligues + V2 livescores | 100 req/min, 9 $/mo | Oui (2min refresh) | Best ratio prix/livescore pour ligues exotiques |
| **API-Football Free** | 10 ligues | 100 req/jour | Endpoint OK mais quota tue le polling | À utiliser uniquement comme test bed |
| **The Odds API Free** | 40 books, toutes ligues | 500 credits/mois ≈ 16/jour | Oui (mais consomme vite) | Tient 1 refresh/jour, pas plus |
| **Sportmonks Free** | 1 ligue (Danish Superliga uniquement) | Très limité | Non | Utile pour dev sandbox seulement |

---

## 4. Table C — SCRAPING TARGETS

| Source | Anti-bot | Data depth | Légal | Notes |
|---|---|---|---|---|
| **FBref (Sports-Reference.com)** | Léger (rate limit) — **1 req / 3 s max**, 10/min total | Très riche : xG, xGA, npxG, shots, pass maps, possession adjusted stats | TOS : "scraping toléré sauf si nuit aux perfs ; **interdit pour entraîner GenAI** ; interdit construire un produit dérivé" | **Risque pour SaaS commercial** — Buchdahl exclut explicitement les sites/tools dérivés. Usage prudent : enrichissement personnel/recherche uniquement |
| **Understat.com** | **Aucun** (JSON injecté dans `<script>` du HTML) | xG, xGA, shot-by-shot avec coordonnées, par joueur et match — Top 6 ligues européennes | Pas de TOS explicite scraping — gris légal | **Source la plus exploitable** pour xG live et historique. Plusieurs libs Python matures (`understatapi`, `understat`) |
| **Sofascore** | **Cloudflare strict** — 403 sur User-Agent serveur | Très complet : possession, tirs, SOT, corners, xG, momentum, ratings joueurs, heatmaps | TOS interdit scraping | **Workaround :** `sofascore-wrapper` 1.0.24+ via Playwright Chromium headless. Latence ~5-10s/req, limite 25-30s entre calls pour éviter ban Cloudflare |
| **WhoScored** | **Cloudflare Pro + dynamic content** | xG, ratings, lineups, situation events | TOS strict | Nécessite Selenium/Playwright full. Plus dur que Sofascore. Souvent pas worth le coût infra |
| **Soccerway** | Modéré (Cloudflare lite) | Scores, lineups, H2H, formes | TOS strict | Solide backup pour standings/calendriers — niveau anti-bot < Sofascore |
| **Football-data.co.uk** | **Aucun** — CSV téléchargeables directs | Résultats + cotes prematch (Bet365, Pinnacle, William Hill historiques) depuis 2001 | "Usage personnel + commercial OK avec attribution" — bonne foi | **Source en or** pour backtesting + closing lines Pinnacle historiques |
| **StatsBomb open-data** | GitHub repo public | Events ultra-riches (passes, shots avec xG, freeze frames partiels) — sélection compétitions (Euros, WC, certains championnats) | "User Agreement obligatoire + attribution StatsBomb logo, **interdit redistribuer**" | Idéal pour entraîner modèles xG custom, pas pour live |
| **Wyscout open-data** | GitHub — Public ML datasets | Events 2017-18 (top 5 ligues + WC2018) | CC BY-NC-SA — **non-commercial** | Dataset legacy académique uniquement. Pas pour prod |
| **Club Elo** | Aucun (CSV download) | Elo ratings dynamiques par club, depuis 1960 | Pas de restriction explicite | Pour feature engineering Elo dans Bayesian Blender |

### Infra scraping comparée

| Solution | Coût | Robustesse Cloudflare | Verdict pour PariScore |
|---|---|---|---|
| **Puppeteer/Playwright stealth** plain | Gratuit (compute Render) | **Faible** en 2026 — détecté par Cloudflare Turnstile | Out — à éviter (cassé sur Sofascore) |
| **Camoufox / SeleniumBase / Scrapling** | Gratuit + 2-4 Go RAM | **Bon** — projets actifs 2026 | Recommandé pour Sofascore/WhoScored |
| **Bright Data résidentiel** | À partir de **499 $/mo** (8.40 $/Go) | Excellent | Trop cher pour SaaS indé |
| **Oxylabs résidentiel** | **45.50 $/mo (Micro)** ou 4 $/Go pay-as-you-go | Excellent | Crédible si scraping ciblé < 10 Go/mo |
| **BSD/Bzzoiro (déjà payé)** | Token existant | N/A (proxy datacenter privé) | Déjà en place — garder pour live `sr_stats` |

---

## 5. RECOMMENDATION — Stack optimal PariScore (100 users)

### Stack A — "Lean Pro" (budget < 50 €/mo) — **RECOMMANDÉ**

| Couche | Provider | Prix | Rôle |
|---|---|---|---|
| **Live + Prematch coeur** | API-Football Pro | **19 $/mo (~17 €)** | 7 500 req/jour : statistics live (possession, tirs, SOT, corners), fixtures, standings, lineups, H2H, predictions |
| **Cotes prematch + live** | The Odds API Starter | **~30 $/mo (~27 €)** | 20 000 req/mois : devigging Shin-Hurley sur 40 books, dropping odds tracker |
| **Sharp reference** | Football-data.co.uk | **0 €** (CSV scheduled) | Backtesting + closing lines Pinnacle historiques |
| **xG enrichi** | Understat scraper natif (no anti-bot) | **0 €** | xG live top 6 ligues, shot maps, complément Bayesian Blender |
| **Backup standings** | Football-Data.org free | **0 €** | Fallback si API-Football down — 12 compétitions tier-1 |
| **Live momentum** | BSD/Bzzoiro existant | **Token déjà payé** | `sr_stats` (ball_safe_pct, dangerous_attack) — gardé pour momentum chart |
| **Total mensuel** | | **~44 €/mo** | Couverture mondiale prematch + live top 6 ligues |

**Ce que ça débloque vs stack actuel :**
- Live statistics (tirs/SOT/corners) débloqués via API-Football Pro — fin du blocage 100 req/jour
- Refresh odds < 1 h sans crever le quota
- xG live ajouté (Understat) → permet de pousser le module Live Intensity Score V2
- Closing lines Pinnacle dispo gratuitement → métriques CLV pour KPIs admin

---

### Stack B — "Scale Pro" (budget ~200-300 €/mo) — pour atteindre 500-1 000 users

| Couche | Provider | Prix |
|---|---|---|
| Live + Prematch | **Sportmonks Growth** (xG live + Pressure Index natif) | 149 € |
| Cotes | The Odds API Pro (5 M req/mo) | ~110 € |
| Sharp reference | Pinnacle via SportsGameOdds | 0 (free tier 1k req/mo) |
| Scraping ciblé | Oxylabs Micro résidentiel | 45 $ |
| **Total** | | **~310 €/mo** |

À déclencher si MRR Pro > 1 000 €/mo (50 abonnés à 19 €/mo).

---

### Stack C — "Lab/Dev" (budget 0 €) — pour itérer le modèle Bayésien

API-Football Free + Football-Data.org free + Understat + StatsBomb open-data + Football-data.co.uk + Club Elo.
Limité à 10 ligues / 100 req/jour mais suffisant pour calibrer le Bayesian Blender en local sur 500 matchs historiques avant déploiement.

---

## 6. Décision et plan d'action

1. **Upgrade immédiat** : API-Football Free → **Pro 19 $/mo** (débloque live stats + 7 500 req/jour).
2. **Migrer The Odds API Free → Starter** (30 $/mo) dès que le quota mensuel sature.
3. **Implémenter scraper Understat natif** (Python ou Node, JSON dans `<script>` — pas d'anti-bot) → feed xG live au moteur Poisson Bivarié.
4. **Conserver BSD/Bzzoiro** pour le momentum live (déjà payé, `sr_stats` complète bien API-Football).
5. **Brancher Football-Data.org en backup** sur standings (free, 10 req/min suffit avec cron 6h).
6. **Ne PAS investir** dans Sportradar/Genius/Opta tant que MRR < 2 000 €. Coût d'entrée prohibitif.
7. **Éviter le scraping FBref** pour usage commercial — TOS explicitement contre les produits dérivés. Privilégier Understat.
8. **Réserver Sofascore scraping** au mode "enrichissement opportuniste" via `sofascore-wrapper` Playwright, max 1 req / 30 s, en background uniquement (pas dans le chemin critique).

**Budget total recommandé phase 1 : ~44 €/mo** pour passer de "stack contraint" à "stack pro complet" couvrant prematch + live sur 1 100+ ligues avec xG enrichi.

---

## Sources
- [API-Football pricing](https://www.api-football.com/pricing)
- [Sportmonks plans & pricing](https://www.sportmonks.com/football-api/plans-pricing/)
- [Sportmonks coverage (xG depuis 2024)](https://www.sportmonks.com/football-api/coverage/)
- [The Odds API guide v4](https://the-odds-api.com/liveapi/guides/v4/)
- [Odds API pricing 2026 comparison](https://oddspapi.io/blog/odds-api-pricing-2026-comparison/)
- [SportsDataIO Soccer API](https://sportsdata.io/developers/api-documentation/soccer)
- [Pinnacle API closure July 2025 via SportsGameOdds](https://sportsgameodds.com/pinnacle-odds-api/)
- [Sportradar Soccer API overview](https://developer.sportradar.com/soccer/reference/soccer-api-overview)
- [LSports vs Genius Sports comparison](https://www.lsports.eu/blog/genius-sports-vs-lsports/)
- [Goalserve football pricing](https://www.goalserve.com/en/sport-data-feeds/football-api/prices)
- [Goalserve soccer pricing](https://www.goalserve.com/en/sport-data-feeds/soccer-api/prices)
- [Football-Data.org pricing](https://www.football-data.org/pricing)
- [Football-Data.org coverage](https://www.football-data.org/coverage)
- [TheSportsDB pricing](https://www.thesportsdb.com/pricing)
- [FBref bot/scraping policy](https://www.sports-reference.com/bot-traffic.html)
- [Sports Reference Terms of Use](https://static.fbref.com/termsofuse.html)
- [Understat Python wrapper](https://pypi.org/project/understatapi/)
- [sofascore-wrapper PyPI (Playwright workaround)](https://pypi.org/project/sofascore-wrapper/)
- [Bright Data vs Oxylabs comparison 2026](https://brightdata.com/blog/comparison/bright-data-vs-oxylabs)
- [Oxylabs residential pricing](https://oxylabs.io/pricing/residential-proxy-pool)
- [StatsBomb open-data GitHub](https://github.com/statsbomb/open-data)
- [Football-data.co.uk CSV downloads](https://www.football-data.co.uk/data.php)
- [SoccerData library (probberechts)](https://github.com/probberechts/soccerdata)

*Document : `.context/API-STUDY-FOOTBALL-2026.md` — PariScore v9.7 — étude marché API football mai 2026.*
