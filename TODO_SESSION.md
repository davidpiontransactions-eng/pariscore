# TODO — Session en cours

## Comparateur de Cotes
- [x] Nettoyage UI : suppression labels "BSD" / noms serveurs de l'interface
- [x] Ligne "Moyenne du Marché" calculée dynamiquement (moyenne cotes 1/N/2 + payout moyen)
- [x] Dropdown filtre marché : 1N2, Plus/Moins 2.5, Les deux marquent
- [x] Design : ligne "Meilleure cote" rouge léger, ligne "Moyenne" gris clair
- [x] Backend : `processAllBookmakers` extrait `totals` (OU25) + `btts` par bookmaker
- [x] Backend : route `/api/v1/comparateur` accepte `?market=1N2|OU25|BTTS` + retourne `avgRow`
- [x] Finalisation du comparateur : intégration 1xbet, calcul des moyennes et filtres par marché (1N2, U/O, BTTS) — Routes opérationnelles `/api/v1/comparateur/:id?market=1N2|OU25|BTTS` ✓ avgRow + bestRow + isBestHome/Draw/Away/Over25/BTTS detection. (12 mai 2026 commit 40aa5ae)
- [ ] Tester avec des matchs ayant cotes `totals` / `both_teams_score` réelles — En attente cycle fetchOdds avec markets totals + both_teams_score (state actuel : seuls 1N2 retournés non-null)
- [ ] Vérifier affichage 1xbet dans section non-ANJ — 1xbet absent du payload actuel (seul BSD bookmaker présent dans rows). Dépendant fetchOdds couvrant Pinnacle/1xBet via The Odds API config régions.

- [x] Mutation de l'onglet Live : Passage d'un flux scrollé à un Dashboard de Stratégie (Momentum + Intensity Gauge + Predictive Bet).

## Live Dashboard V2 — Refonte Radicale
- [x] Destruction totale de l'ancienne boucle de rendu Live scrollable. (commit b9e5e23)
- [x] Implémentation du Dashboard Live V2 (Momentum SVG + Barres dynamiques + Polling partial-update sans flicker). (commits b9e5e23 + 179bc40 Phase 1)
- [x] Fix UI : Rétablir l'affichage de la liste des matchs en direct via le filtre 'Live' du tableau principal. (commit d971c6b)
- [x] Fix Dashboard Live : Remplacer le flux de données vide par un scraping/fetching des endpoints statistiques et momentum de SofaScore. (Phase 1 commit 179bc40 + Phase 2 commit a14f7aa)
- [x] Étude API football complète (prematch + live + scraping sans anti-bot). Analyse comparative gratuit vs payant. Recommandation stack rapport qualité/économique pour 100 membres. (.context/API-STUDY-FOOTBALL-2026.md commit db8b51f)
- [x] Étude couverture LIVE par ligue (K-League + toutes ligues PariScore) avec APIs/scraping. Rapport routing correct + double routing (primary/fallback). (.context/ROUTING-LIVE-COVERAGE-2026.md commit 79c71fb)
- [x] Installer skill : `npx skills add machina-sports/sports-skills` — 17 skills installés dans .agents/skills/ (betting, football-data, kalshi, polymarket, sports-news, sports-reporter, mlb/nba/nfl/nhl/cbb/cfb/golf/tennis/wnba/volleyball/xctf-data, markets)

## En cours / Debug
- [x] Création d'un environnement de test (Mock Match) pour simuler une physionomie de match en direct.
- [x] Intégration du module Top 3 Joueurs (Ratings Live BSD) dans le Dashboard Live.

## Roadmap suivante
- [x] Filtres L5/L10/L25 dans tableau principal (PPG/forme X derniers matchs) — Existant L4747-4755 pariscore.html (filter-chip Saison/L5/L10/L25). setPeriod(period) toggle activePeriod + renderMatches re-trigger. ppgFromFormStr(form, n) calcule PPG sur N derniers matchs. Verified preview port 61772 : 4 boutons, click L5 → activePeriod='l5' + periodNote 'Calculé sur les 5 derniers matchs'.
- [ ] Onglet Tendances version Full (route `/api/v1/trends`)
- [ ] Intégrer sur chaque ligne du tableau Matchs le logo de la chaîne TV qui diffuse le match. Route backend `/api/v1/tv-channels` déjà existante (server.js:8512). À câbler côté frontend : enrichir payload `/api/v1/matches` avec champ `tv_channel` (id + name + logo_url) puis rendre dans renderMatches (ajouter colonne ou badge sous heure de coup d'envoi). Fallback gracieux si pas de diffuseur connu.
- [x] Élargissement régions/markets fetchOdds — server.js:5747 régions `eu,uk` + markets `h2h,totals,both_teams_score` (config override via env ODDS_REGIONS / ODDS_MARKETS). Coût quota multiplié par 3 (markets) × 2 (régions) = 6x — surveillance quota nécessaire pour plan 500 credits/mois.
- [x] Rédaction du glossaire expert dans le Guide
- [x] Injection de matchs de test avec couverture bookmakers totale (ANJ, 1x, Betfair)
