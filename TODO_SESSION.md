# TODO — Session en cours

## Comparateur de Cotes
- [x] Nettoyage UI : suppression labels "BSD" / noms serveurs de l'interface
- [x] Ligne "Moyenne du Marché" calculée dynamiquement (moyenne cotes 1/N/2 + payout moyen)
- [x] Dropdown filtre marché : 1N2, Plus/Moins 2.5, Les deux marquent
- [x] Design : ligne "Meilleure cote" rouge léger, ligne "Moyenne" gris clair
- [x] Backend : `processAllBookmakers` extrait `totals` (OU25) + `btts` par bookmaker
- [x] Backend : route `/api/v1/comparateur` accepte `?market=1N2|OU25|BTTS` + retourne `avgRow`
- [ ] Finalisation du comparateur : intégration 1xbet, calcul des moyennes et filtres par marché (1N2, U/O, BTTS)
- [ ] Tester avec des matchs ayant cotes `totals` / `both_teams_score` réelles (cycle fetchOdds suivant)
- [ ] Vérifier affichage 1xbet dans section non-ANJ si présent dans The Odds API

- [x] Mutation de l'onglet Live : Passage d'un flux scrollé à un Dashboard de Stratégie (Momentum + Intensity Gauge + Predictive Bet).

## Live Dashboard V2 — Refonte Radicale
- [ ] Destruction totale de l'ancienne boucle de rendu Live scrollable.
- [ ] Implémentation du Dashboard Live V2 (Momentum SVG + Barres dynamiques + Polling partial-update sans flicker).
- [ ] Fix UI : Rétablir l'affichage de la liste des matchs en direct via le filtre 'Live' du tableau principal.
- [ ] Fix Dashboard Live : Remplacer le flux de données vide par un scraping/fetching des endpoints statistiques et momentum de SofaScore.
- [ ] Étude API football complète (prematch + live + scraping sans anti-bot). Analyse comparative gratuit vs payant. Recommandation stack rapport qualité/économique pour 100 membres.

## En cours / Debug
- [x] Création d'un environnement de test (Mock Match) pour simuler une physionomie de match en direct.
- [x] Intégration du module Top 3 Joueurs (Ratings Live BSD) dans le Dashboard Live.

## Roadmap suivante
- [ ] Filtres L5/L10/L25 dans tableau principal (PPG/forme X derniers matchs)
- [ ] Onglet Tendances version Full (route `/api/v1/trends`)
- [x] Rédaction du glossaire expert dans le Guide
- [x] Injection de matchs de test avec couverture bookmakers totale (ANJ, 1x, Betfair)
