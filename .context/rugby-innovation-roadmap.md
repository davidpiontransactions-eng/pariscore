# Rugby4Cast — Benchmark concurrentiel & Plan d'innovations

Date : 2026-08-14 · Session : Audit + benchmark Rugby (Phase 2)
Statut : plan — priorisation P0/P1/P2, aucun item démarré.

## 1. Benchmark concurrentiel

| Concurrent | Modèle | Force | Faiblesse vs Rugby4Cast |
|---|---|---|---|
| **Rugby Vision** (Niven Winchester, MIT) | Ratings points-exchange (≈ Elo), marge = Δ ratings, home adv 5,5 pts, 10 000 simulations de tournoi, essais attendus, bonus points | Calibration publiée (3 CdB : favoris gagnent 85,4 %, erreur moyenne 13,2 pts) ; spread bets > 50 % sur 3 éditions ; top 4 % Superbru | Pas de UI en temps réel, pas de league (XIII), publication événementielle |
| **Forebet** | 100 % mathématique : Poisson correct score, 1X2 %, OU, BTTS, Double Chance, **Kelly Criterion → section Value**, forme pondérée par récence, splits domicile/extérieur, H2H, calibration par les cotes bookmakers | Volume massif, transparence des probas | Rugby = produit secondaire (12 sports), pas de modélisation de marge fine |
| **RugbyPass** | Journalisme + crowdsourcing (fan predictor RWC : 80 000 votants) | Écosystème éditorial | **Zéro modèle statistique** — prédictions = votes/experts |
| **Flashscore** | Livescore temps réel, tableaux | Vitesse et fraîcheur | **Zéro prédiction** — données brutes |

**Positionnement Rugby4Cast** : seul acteur francophone combinant (a) moteur prédictif transparent (Elo + Poisson + Monte Carlo, méthodes publiées), (b) les deux codes (XV + XIII), (c) markets dérivés (spread, OU, score probable, marqueurs d'essai) — là où Forebet ne fait que du 1X2 rugby et RugbyVision ne couvre que l'international masculin.

**Ce qu'il faut copier** : calibration publique (Rugby Vision publie ses taux de réussite), section « value » (Kelly, Forebet), granularité correct score (Poisson, déjà là).

## 2. Plan d'innovations

### P0 — Rugby PowerScore & Fair Handicap Predictor
- **Concept** : score 0-100 par équipe (attaque/défense/Elo synthétisés, comme le PowerScore football de PariScore) + handicap « équitable » = marge attendue arrondie au .5 près (déjà calculée par la grille 2D — la rendre *explicite* en UI et API).
- **Différenciateur** : bâton de hockey du marché — RugbyVision démontre que le spread est le marché où un modèle bat les bookmakers (56-58 %).
- **Livrables** : champ `powerScore` dans `StandingRow`/`PredictedMatch` ; API `/api/rugby/power` (top 10 par compétition) ; badge PowerScore sur les cartes ; page « Marchés » avec couverture du spread par bande de proba.
- **Validation** : backtest sur matchs terminés (déjà disponibles dans `cs.matches`) — % de couverture du spread vs line « équitable », objectif > 52 %.

### P1 — Kicking & Weather Impact Index
- **Concept** : le jeu au pied domine le rugby ; la météo (vent/pluie) déplace les scores. Indice 0-100 = impact attendu sur le total de points.
- **Données** : météo du stade le jour du match (API gratuite type Open-Meteo — pas de clé), style de jeu (ratio essais/pénalités par équipe via ESPN summary — à enrichir, cf. gaps).
- **Livrables** : ajustement des lambdas Poisson quand pluie/vent fort (ex. −8 % de total, dispersion vers les pénalités) ; badge « Météo : pluie attendue — total sous-évalué » sur la carte ; mention dans le panneau détail.
- **Prudence** : signal faible → plafonner l'ajustement (jamais plus de ±10 %) et l'afficher comme « indice », pas comme certitude.

### P1 — Try Scorer Value module
- **Concept** : transformer le marqueur d'essai déjà calculé (`buildTryScorers`) en module de valeur : proba d'essai par joueur + comparaison avec les cotes bookmakers (quand dispo) → « opportunité ».
- **Livrables** : proba d'essai individuelle (déjà ~calculée par position) affichée en %, top 3 marqueurs probables dans le modal ; alerte « valeur » si cote marché > proba modèle (nécessite source de cotes rugby — backlog API : Odds API couvre le rugby).
- **Validation** : suivi des marqueurs réels vs probas (log 1 mois), calibration par décile.

### P1 — Distribution des marges (1-12 / 13+)
- **Concept** : graphique de la distribution des écarts de points (histogramme 0-5, 6-12, 13-20, 21+) dérivé de la grille 2D — réponse directe au besoin « la ligne 1-12 est-elle rentable ? ».
- **Livrables** : histogramme SVG/Tailwind dans le modal (pas de lib), proba cumulée « écart ≤ 12 » vs « > 12 », same-game par compétition (les matches serrés du Six Nations vs les cartons NRL).
- **Sans coût** : déjà calculable depuis `grid` — un pure render component.

### P2 — Gaps d'audit identifiés (backlog)
- **Bonus points union** (4 essais+, défaite ≤ 7) : nécessite le détail des essais — endpoint ESPN `/summary?event=` (aussi la source du **live scoring 5/2/3 pts** et des **cartons** jaune/rouge/bunker). Scope : après P1.
- **Tests unitaires du moteur** (le reviewer note : grille Poisson, 1X2, OU, verdicts non testés) : propriétés invariantes (Σ grille = 1, OU complémentaire, seuils de verdict).
- **Calibration publique** : page « Notre fiabilité » (taux de favoris gagnants, erreur moyenne, % couverture spread — façon Rugby Vision).
- **Cotes bookmakers rugby** (Odds API) : section « value » façon Forebet.
- **Contraste slate-500 à 10-11 px** (≈ 3,9:1, WCAG AA 4,5:1) : harmoniser avec le reste du design system (pattern global PariScore, pas rugby-only).

## 3. Décisions à trancher (avant implémentation P0)
1. PowerScore : composante météo incluse dès P0 ou en P1 (avec l'indice météo) ? → recommandation : P1, pour ne pas changer l'échelle deux fois.
2. Backtest spread : fenêtre glissante sur `cs.matches` (fini) — le backtest des spreads « passés » doit rejouer les lignes du moment (ligne = marge attendue au moment du match, pas recalculée avec les ratings actuels) → nécessite un snapshot des ratings par match (le plus simple : logger `marginLine` + `actualMargin` dans un store de backtest au moment de la prédiction).
3. API météo : Open-Meteo (gratuit, sans clé) — valider le quota (10 000 req/j, largement suffisant pour ~14 comps × 40 matchs).