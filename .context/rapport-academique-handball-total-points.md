# Rapport académique — Handball : total de points (Over/Under) et backtesting

**Date** : 2026-09-25 · **Agent** : recherche académique handball total points · **Statut** : lecture seule code, rapport uniquement

**Intégrité des sources** : toutes les affirmations fortes sont couvertes par une URL réellement fetchée (8 sources de contenu). Les éléments connus uniquement par extrait de moteur de recherche ou citation secondaire sont marqués **« non vérifié »**. Aucun auteur/année/paper n'a été inventé.

---

## 1. Résumé exécutif

**Q1 — Comment calcule-t-on le total de points en handball et quels modèles existent ?**
Le total de points d'un match de handball = somme des buts des deux équipes en 60 minutes (les prolongations sont exclues des marchés Over/Under — [freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/)). Contrairement au football, les buts par équipe sont **sous-dispersés** (variance < moyenne) par rapport à une loi de Poisson : c'est le résultat central de Karlis, Michels & Ötting (2024) sur 1 844 matchs de Bundesliga (moyennes/variances domicile 28,07/19,67 ; extérieur 26,92/18,32) — [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213). Les modèles validés sont : régression de **Skellam** sur l'écart de score (et version **zero-inflated** qui corrige les matchs nuls), **Gaussien creux** (Groll et al. 2020, cité par Karlis et al.), **Conway-Maxwell-Poisson** (Felice & Ley 2023 — non vérifié au-delà de la citation de Karlis et de l'abstract Felice & Ley), **copules bivariées** reliant les deux mi-temps (corrélation observée ≈ 0,13, copule de Frank retenue), et **chaînes de Markov de possessions** in-match (Dumangane et al. 2009 ; Singh, Scarf & Baker 2023 — proba de marquer par possession jusqu'à 0,7). Les facteurs explicatifs documentés : force d'équipe (attaque/défense), avantage domicile (réel mais faible en handball selon Smiatek & Heuer 2012), tempo/possessions (règle du jeu passif impose un tir), efficacité de tir (~62→65% sur les grands tournois), gardien (arrêts 26-35%), suspensions 2 min et fins de match à 7 contre 6. Le ML (CatBoost xG : ~70% de précision de prédiction de tir — Adams et al. 2023 ; ML + forces d'équipe : >80% d'accuracy sur vainqueur — Felice & Ley 2025) complète les modèles statistiques.

**Q2 — Le backtesting affine-t-il le calcul ?**
Oui, si — et seulement si — il est **temporellement honnête**. La littérature et les implémentations publiées convergent : validation **walk-forward** (entraîner sur les saisons < t, tester sur t) pour éviter le look-ahead bias ([github.com/PlamenKraev3/sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration) ; Karlis et al. font eux-mêmes une prédiction out-of-sample sur la saison COVID interrompue), **calibration** évaluée par diagramme de fiabilité + **Brier score** / Brier Skill Score plutôt que par le simple taux de réussite, et évaluation des stratégies par **CLV** (closing line value) — corrélation CLV↔ROI ≈ 0,87 dans la simulation de [datafield.dev](https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html) (⚠️ jeu de données **synthétique** — indicatif, pas une preuve empirique). Les pièges documentés : overfitting / comparaisons multiples (tout backtest doit être jugé au regard du nombre d'essais), petits échantillons (≈300+ paris pour distinguer skill vs chance selon la même source), et l'efficience du marché : après dé-vig, **pas d'edge robuste out-of-sample** trouvé sur les marchés 1X2 EPL/La Liga sur 5 saisons ([sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration)).

**Implication Pariscore** : le backtest Vitibet actuel (66,7% sur 24 matchs évalués) est statistiquement **non significatif** (n=24), et le filtre Over 54,5 / 52,2 ne peut PAS être un seuil fixe : la moyenne de buts varie de ~55 (Bundesliga 2017-23, calculée depuis Karlis et al.) à ~60-63 (saisons récentes, [freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/)). Le seuil doit être **par ligue et par saison**, calibré sur les moyennes récentes.

---

## 2. Q1 — Modèles académiques du total de points en handball

### 2.1 Définition et ordres de grandeur du marché Over/Under

- Le total = buts des deux équipes en 60 minutes réglementaires ; prolongations et jet de 7 m exclus du règlement Over/Under ([freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/)).
- Baselines récentes par compétition (source [freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/), données 2025-26) : Ligue des Champions **62,74** buts/match (132 matchs), EHF EURO 2026 **62,25**, Liga ASOBAL **60,94**, Bundesliga **60,40**, Starligue **59,12**, Mondial IHF 2025 **58,25**.
- Tendance : le scoring a augmenté d'environ **+5 buts/match en une décennie** (LDC 57,64 sur 2014-2024 vs 62,74 en 2025-26) → toute référence historique doit être ré-ancrée sur les saisons récentes (même source).
- Dispersion : écart-type ≈ **6,6 à 7,2 buts** (LDC 2014-2024 : min 35, max 79, σ=7,22 ; Bundesliga 2014-2024 : min 31, max 79, σ=6,58) → une ligne à 60 se résout ~50/50, et un écart de ±10 buts est ordinaire (même source).
- Données académiques de référence : Bundesliga HBL 2017-18→2022-23, 1 844 matchs, total moyen ≈ **55,0** buts (28,07 + 26,92), variance < moyenne de chaque côté, corrélation domicile/extérieur faible (**0,14**) ([Karlis, Michels & Ötting, arXiv:2404.04213](https://arxiv.org/abs/2404.04213)).

> **Constat clé** : la moyenne de total dépend de la ligue ET de l'époque (≈55 en HBL 2017-23 vs ≈60-63 en 2025-26). Un seuil Over 54,5 n'a pas la même signification selon le contexte.

### 2.2 Le fait stylé central : sous-dispersion (variance < moyenne)

- Les buts par équipe en handball sont **sous-dispersés par rapport à une Poisson** → la Poisson brute est un point de départ douteux pour les queues de distribution (donc pour Over/Under extrêmes) ([Karlis et al., arXiv:2404.04213](https://arxiv.org/abs/2404.04213), abstract + §1).
- Conséquence : une Poisson indépendante sous-estime la concentration des totaux autour de la moyenne et mal estime les probabilités de scores nuls/égalités ; les modèles corrigés (Skellam ZI, COM-Poisson, Gaussien creux) sont préférables (même source ; Groll et al. 2020 et Felice & Ley cités dans leur introduction).

### 2.3 Familles de modèles validées

| Famille | Principe | Résultat documenté | Source |
|---|---|---|---|
| **Skellam / Skellam ZI** (régression) | Modélise directement l'**écart de score** (différence de Poissons) ; version zero-inflated pour les nuls | Sur HBL : le Skellam ZI est choisi par AIC sur toutes les saisons complètes et **prédit nuls/victoires/ext. plus précisément que les bookmakers** (cotes BetExplorer dé-vig) | [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213) (§3.2) |
| **Gaussien creux (sparse Gaussian)** | Poisson régularisée + approximation Gaussienne (moyenne de buts assez grande) ; creux pour la sélection de variables | Modèle utilisé pour prédire le Mondial IHF 2019 (Groll, Heiner, Schauberger & Uhrmeister 2020, *Journal of Sports Analytics* 6(3):187-197 — citation vérifiée via la bibliographie de [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213), contenu du paper **non vérifié** directement) | idem |
| **Conway-Maxwell-Poisson** | Généralisation Poisson autorisant la sous-dispersion | Proposée par Felice & Ley pour les buts home/away (décrit dans [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213) §1 ; coût computationnel élevé) | idem |
| **Copules bivariées (mi-temps 1 & 2)** | Marges Skellam par mi-temps + copule (Frank/Gumbel) ; permet les probabilités **conditionnelles au score de la mi-temps** | Corrélation inter-mi-temps ≈ 0,13 ; copule de Frank retenue (pas de dépendance de queue) ; paramètres d'équipe quasi identiques entre mi-temps (modèle parcimonieux) | [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213) (§3.3-3.4) |
| **Chaînes de Markov de possessions (« Markov-match »)** | Alternance de possessions, proba de marquer par possession élevée (**jusqu'à 0,70** pour certaines équipes) → les buts ne sont ni binomiaux ni indépendants | Violation de l'indépendance/stationnarité documentée (Dumangane, Rosati & Volossovitch 2009, *J. Applied Statistics* 36(7):723-741) ; extension par Singh, Scarf & Baker 2023 (*EJOR* 304(3):1099-1112) | décrits dans [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213) §1 (références vérifiées dans leur bibliographie) |
| **ML / xG** | CatBoost sur données d'événements + positions (distances, angles, contexte) | xG handball : **~70% de précision** après CV 5-fold + tuning (Adams, David, Hesse & Rückert, MMSports@MM 2023) ; ML + features de forces d'équipe : **accuracy > 80%** sur matchs féminins clubs, features statistiques = plus importantes (Felice & Ley, *J. Sports Analytics* 2025) | [api.semanticscholar.org (DOI 10.1145/3606038.3616152)](https://api.semanticscholar.org/graph/v1/paper/DOI:10.1145/3606038.3616152?fields=title,abstract,authors,year,venue) ; [api.semanticscholar.org (DOI 10.1177/22150218251313937)](https://api.semanticscholar.org/graph/v1/paper/DOI:10.1177/22150218251313937?fields=title,abstract,authors,year,venue) |

### 2.4 Facteurs explicatifs du total (synthèse littérature + pratique sourcée)

- **Tempo / nombre de possessions** : la règle du jeu passif (avertissement puis coup franc après ~4 passes sans tir) empêche de ralentir indéfiniment ; les équipes qui tirent tôt génèrent 55+ attaques ([freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/)).
- **Efficacité de tir** : ~62% (EURO 2024) → 64,7% (EURO 2026) ; une équipe efficace transforme les mêmes possessions en plus de buts (même source).
- **Gardien** : les élites arrêtent 26-32% des tirs sur un tournoi (>35% ponctuellement) ; un gardien top peut retirer 5-6 buts d'un match (même source).
- **Avantage domicile** : réel mais faible en handball — « nearly negligible compared to the total sum of goals » ([Smiatek & Heuer, arXiv:1207.0700](https://arxiv.org/abs/1207.0700)) ; en HBL récent, +1,15 but d'avantage domicile moyen (28,07 vs 26,92 — [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213)) ; atténué sans public pendant le COVID (Bryson et al. 2021, cité par Karlis et al.).
- **Force d'équipe / forme** : la « fitness » d'équipe (écart de buts) décroît au cours d'une saison en handball, contrairement au football ([Smiatek & Heuer, arXiv:1207.0700](https://arxiv.org/abs/1207.0700)).
- **Règles et contexte** : suspensions 2 min (attaques à 6 contre 5 → plus de buts), fins de match à 7 contre 6 (gardiens sortis → emballement des 10 dernières minutes), matchs sans enjeu (intensité en baisse), gestion d'agrégat en coupe ([freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/)).

### 2.5 Lien avec le code Pariscore

- `src/lib/prediction/total-games.ts` : le moteur tennis calcule un **lambda** de total de games (`computeLambda`), puis `poissonPMF`/`probOver` pour les marchés Over/Under (18,5→24,5), avec ajustement live (`adjustLambdaLive` branche Markov). Ce schéma lambda + queue Poisson est **directement transposable** au handball, MAIS la littérature handball impose de corriger la sous-dispersion (Skellam/COM-Poisson/Gaussien) : une Poisson pure mal estime les queues.
- `src/lib/prediction/live-markov.ts` : récursion Markov par état (`setWinProb`, `setScoreDistribution`, `setOverUnder`, `expectedRemainingGames/Sets`, `matchWinProb`) = exactement le paradigme « Markov-match » de Dumangane/Singh appliqué au tennis. L'analogue handball serait une chaîne par **possession** (proba de marquer ~0,5-0,7 selon équipes) ou par bloc de 5 minutes conditionné au score (mi-temps → copule de Karlis et al.).
- `.context/rapport-academique-snooker.md` : format de rapport suivi ici (métriques, modèles, résultats, recommandations P0/P1/P2, sources).

---

## 3. Q2 — Backtesting & affinage du calcul

### 3.1 Ce que le backtesting apporte — et sous quelles conditions

1. **Validation temporelle (walk-forward)** : entraîner/calibrer sur les saisons < t, tester out-of-sample sur t — c'est le protocole implémenté dans [sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration) (EPL + La Liga, 2019-2024) et la logique out-of-sample de [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213) (§3.2.3 : modèle calé avant l'interruption COVID, simulation Monte Carlo 10 000 itérations de la fin de saison).
2. **Calibration des probabilités** : regrouper les prédictions en bins, comparer proba prédite vs fréquence réelle (diagramme de fiabilité). Le Brier score (règle de scoring strictement propre) et le Brier Skill Score (vs baseline fréquence inconditionnelle) sont les métriques standard — [sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration) ; la décomposition Brier (calibration/résolution) est utilisée dans l'étude CLV de [datafield.dev](https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html).
3. **Résultat négatif important** : sur les marchés 1X2 EPL/La Liga, après retrait de la marge, **aucun edge out-of-sample robuste** ne subsiste — les inefficacités observées (ex. proba de nul ~0,24-0,29 sous-estimées) sont modestes et non stables d'une saison à l'autre ([sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration)). Le handball est un marché moins liquide et potentiellement moins efficient, mais rien ne permet de l'affirmer sans mesure → à tester, pas à présumer.
4. **Côté handball** : le Skellam ZI de Karlis et al. **bat les bookmakers** sur la prédiction des issues (nuls compris) en HBL 2021-22, sans inclure les news courantes (blessures) — preuve qu'un modèle simple bien spécifié peut dépasser le marché sur un sport à marché étroit ([arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213) §3.2.2).

### 3.2 Métriques recommandées et leur justification

| Métrique | Pourquoi | Source |
|---|---|---|
| **Brier score** (multiclasse pour 1/X/2, binaire pour Over/Under) | Scoring rule propre : honore les probabilités honnêtes, mesure la calibration | [sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration) ; [datafield.dev](https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html) |
| **Log-loss** | Complément pénalisant fort les confiances erronées | [sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration) (framework) |
| **Diagramme de fiabilité / bins** | Détecte les zones de sur/sous-prédiction exploitables (ex. nuls à 0,24-0,29) | [sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration) |
| **CLV (closing line value)** | Benchmark du prix d'information du marché ; corrélation CLV↔ROI **r = 0,87** sur 100 parieurs simulés × 300 paris (données synthétiques — indicatif) | [datafield.dev](https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html) |
| **ROI, hit rate, drawdown max** | Évaluation économique des stratégies en strict out-of-sample | [sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration) |
| **Taille d'échantillon** | ≈300+ paris pour distinguer skill vs luck via CLV (même étude, synthétique) ; 24 matchs = bruit pur | [datafield.dev](https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html) |

### 3.3 Pièges documentés

- **Overfitting / comparaisons multiples** : tout résultat de backtest doit être jugé au regard du nombre de stratégies testées ; l'absence de test out-of-sample ou walk-forward = « les chiffres sont un décor, pas une preuve » ([quantengines.com](https://quantengines.com/blog/walk-forward-optimization), [quantustik.com](https://quantustik.com/academy/how-to-evaluate-any-forecasting-tool/out-of-sample-testing-and-overfitting) — vus en extraits de recherche, contenus **non vérifiés** par fetch complet).
- **Look-ahead bias** : calibrer avec des informations non disponibles à la date du pari (moyennes de saison complètes, cotes clôture connues d'avance) — le walk-forward l'interdit structurellement ([sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration)).
- **Petits échantillons** : 24 matchs évalués (backtest Vitibet actuel) → intervalle de confiance du taux de réussite extrêmement large ; un 66,7% sur n=24 est compatible avec une probabilité réelle entre ~45% et ~85% (approximation binomiale — calcul interne, non sourcé).
- **Non-stationnarité** : la « fitness » d'équipe décroît sur une saison ([Smiatek & Heuer, arXiv:1207.0700](https://arxiv.org/abs/1207.0700)) et les moyennes de buts montent de ~5 buts/décennie ([freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/)) → un calibrage ancien se périme ; fenêtres glissantes nécessaires.

### 3.4 Ce que la littérature valide / invalide

- ✅ **Valide** : modèles d'écart de score (Skellam) et modèles de forces d'équipe bien spécifiés surpassent les bookmakers sur le handball ([arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213)) ; ML + features statistiques > 80% d'accuracy vainqueur ([Felice & Ley 2025](https://api.semanticscholar.org/graph/v1/paper/DOI:10.1177/22150218251313937?fields=title,abstract,authors,year,venue)) ; walk-forward + Brier = protocole d'évaluation standard.
- ❌ **Invalide / non démontré** : les stratégies de paris fondées sur des régions de probabilité in-sample ne résistent pas au walk-forward sur marchés liquides ([sports-odds-calibration](https://github.com/PlamenKraev3/sports-odds-calibration)) ; un taux de réussite brut sur petit échantillon n'établit aucun edge (voir §3.3) ; la Poisson indépendante classique est inadaptée aux totaux handball (sous-dispersion — [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213)).

---

## 4. Théorie vs pratique de paris

- **Efficience du marché** : la cote de clôture est le benchmark de l'information agrégée ; si elle est efficiente, le CLV mesure le skill, sinon tout le cadre d'évaluation est à revoir — c'est exactement la question testée par [datafield.dev](https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html) (conclusion sur données synthétiques : lignes de clôture remarquablement bien calibrées, biais faibles mais persistants par contexte — ex. primetime légèrement moins efficient ; CLV validé comme prédicteur de profit r=0,87).
- **Semi-efficience** : « le marché est assez efficient pour rendre les stratégies contrariennes aveugles non profitables, mais pas assez pour empêcher un parieur informé de trouver des bords de 1-3% » ([datafield.dev](https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html), Key Findings).
- **Marchés étroits (handball)** : le modèle Skellam ZI de Karlis et al. bat les bookmakers en HBL ([arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213)) — les marchés handball, moins liquides que l'EPL, laissent théoriquement plus de place aux modèles, mais la marge bookmaker y est aussi plus élevée (non vérifié — à mesurer sur nos cotes).
- **Gestion de bankroll** : le critère de Kelly complet est trop agressif en pratique (variance, erreurs d'estimation de p) ; le **Kelly fractionné** (1/2 ou 1/4) est la recommandation récurrente — chapitre empirique Springer « Risk Parity vs. Kelly Criterion » (2026) conclut que le Kelly fractionné fixe est un bon choix global (vu en extrait de recherche, **non vérifié** par fetch — page Springer bloquée). Le rapport snooker du repo recommande déjà le fractional Kelly 1/4-1/2 (`.context/rapport-academique-snooker.md` §5.2).
- **Realpolitik** : [freetips.com](https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/) le résume bien : « Chasing small edges on a 60-goal line requires a genuine informational advantage; the market does not gift them » — l'avantage doit venir de l'information (gardien, rotations, enjeu, tempo), pas d'un seuil fixe.

---

## 5. Plan d'améliorations et d'innovations Pariscore

### P0 — Fondations (semaines 1-2)

1. [Implémenter le filtre **Over 54,5 / Over 52,2** dans l'onglet Handball (% de probabilité de réussite affiché) — seuils paramétrables par ligue, avec garde-fou : n'afficher le pourcentage que si la moyenne de la ligue/saison est connue] → verify: `bun run lint` + `bun run typecheck` 0 erreur ET un % Over 54,5 s'affiche dans l'onglet Handball sur un match réel avec la moyenne de ligue affichée à côté.
2. [Calculer la **moyenne de buts par ligue et par saison** depuis les données matchs disponibles (vitibet_tips + historique) pour remplacer tout seuil fixe par un seuil dynamique : seuil = moyenne ligue × saison ± offset ; documenter que HBL 2017-23 ≈ 55,0 vs LDC 2025-26 ≈ 62,7 ([sources §2.1])] → verify: script/endpoint qui sort les moyennes par ligue ; Over 54,5 affiche un % sensiblement différent sur une ligue à 55 vs une ligue à 63 (contrôle manuel).
3. [Créer la table `handball_totals_backtest` (match_id, ligue, saison, total_ft, proba_over_model, proba_over_market, cote_over, closing_over, issue) — schéma Prisma + migration] → verify: `bunx prisma migrate dev` OK, insertion d'une ligne test lisible.

### P1 — Modèle total points par équipe (semaines 3-6)

4. [Modèle **attaque/défense par équipe, domicile/extérieur, par ligue** : λ_home = attaque_home × défense_away × facteur_ligue × facteur_dom ; calibrage par vraisemblance sur saisons passées — inspiration directe Groll et al. 2020 (régression régularisée, citation vérifiée via [arxiv.org/abs/2404.04213](https://arxiv.org/abs/2404.04213))] → verify: unit tests sur un jeu de données figé ; λ prédit corrélé aux totaux réels (R² ou MAE rapporté dans un test).
5. [Corriger la **sous-dispersion** : implémenter la distribution de Skellam (ou Gaussien discret) pour P(total > seuil) au lieu de la Poisson pure — la Poisson reste utilisable comme baseline ; comparer les deux dans le backtest] → verify: test unitaire — sur paramètres HBL (moyennes 28,07/26,92, variances 19,67/18,32), la proba Over calculée par Skellam diffère de la Poisson et tombe dans l'intervalle des fréquences observées.
6. [Backtest **walk-forward** sur `vitibet_tips` (406 lignes : INDEX, probas 1/X/2, scores prédits, scores FT) + saisons passées : saison t en test, saisons < t en calibration ; métriques Brier, log-loss, taux Over, ROI simulé] → verify: script `scripts/backtest-handball-totals.*` exécutable en CMD ; rapport sortant Brier + taux par saison avec ≥100 matchs de test cumulés.
7. [**Courbes de calibration** (bins de 10% : proba prédite vs fréquence réelle) pour les probas 1/X/2 Vitibet ET pour notre modèle Over/Under, export PNG/JSON] → verify: JSON des bins produit ; écart max prédit/réel affiché ; documenter si les probas Vitibet sont calibrées (66,7% sur 24 matchs ≠ calibration).

### P2 — Innovations (semaines 7-12)

8. [**Markov live totals handball** : récursion par état (score, minute, possession) inspirée de `src/lib/prediction/live-markov.ts` et du paradigme Markov-match (Dumangane 2009 / Singh 2023) ; sortie = P(Over seuil | état live)] → verify: test de sanity (probas 0-1, monotonicité : plus le score est élevé à mi-temps, plus P(Over) est grande) ; affichage dans l'onglet Handball live.
9. [**Détection de valeur vs closing line** : journaliser cote prise vs cote de clôture pour chaque tip Over/Under ; calculer le CLV moyen par stratégie] → verify: table `bet_clv` remplie sur ≥50 paris simulés ; CLV calculé et affiché dans le backtest.
10. [**Kelly fractionné** (1/4 et 1/2) sur les signaux Over/Under calibrés : taille de mise = f(edge estimé, Brier du modèle)] → verify: module de sizing testé unitairement (f* = (bp−q)/b, plafond à 2-5% de bankroll) ; historique de mises simulé dans le rapport de backtest.
11. [**Métriques de succès consolidées** dans un dashboard backtest : ROI, CLV, Brier, taux Over, n de paris, drawdown max — comparés aux lignes de base Vitibet] → verify: un seul rapport (markdown ou page admin) affichant les 5 métriques côte à côte ; le modèle n'est jugé « validé » que si Brier < baseline inconditionnelle ET CLV > 0 sur ≥300 paris.

---

## 6. Sources

| # | URL exacte | Titre | Ce qu'elle apporte |
|---|---|---|---|
| 1 | https://arxiv.org/abs/2404.04213 (+ https://arxiv.org/html/2404.04213v1) | Modelling handball outcomes using univariate and bivariate approaches — Karlis, Michels & Ötting (2024) | Sous-dispersion des buts, régression Skellam + Skellam ZI, copules mi-temps (Frank), données HBL 1 844 matchs (28,07/19,67 ; 26,92/18,32 ; corrélation 0,14), ZI Skellam > bookmakers, prédiction out-of-sample saison COVID, bibliographie (Groll 2020, Dumangane 2009, Singh 2023, Smiatek & Heuer 2012, Felice & Ley) |
| 2 | https://arxiv.org/abs/2307.11777 | Prediction of Handball Matches with Statistically Enhanced Learning via Estimated Team Strengths — Felice & Ley (2023) | ML augmenté de features statistiques, accuracy > 80% sur matchs féminins clubs, explainability |
| 3 | https://arxiv.org/abs/1207.0700 | A statistical view on team handball results: home advantage, team fitness and prediction of match outcomes — Smiatek & Heuer (2012) | 10 saisons Bundesliga, avantage domicile quasi négligeable, décroissance de la fitness sur une saison, prédiction de vainqueurs |
| 4 | https://api.semanticscholar.org/graph/v1/paper/DOI:10.1145/3606038.3616152?fields=title,abstract,authors,year,venue | Expected Goals Prediction in Professional Handball using Synchronized Event and Positional Data — Adams, David, Hesse & Rückert (MMSports@MM 2023) | xG handball CatBoost, ~70% de précision de prédiction de tir, features distances/angles/contexte, SHAP |
| 5 | https://api.semanticscholar.org/graph/v1/paper/DOI:10.1177/22150218251313937?fields=title,abstract,authors,year,venue | Predicting handball matches with machine learning and statistically estimated team strengths — Felice & Ley (Journal of Sports Analytics, 2025) | ML + forces d'équipe estimées, accuracy > 80%, features statistiques = plus importantes |
| 6 | https://datafield.dev/sports-betting-textbook/part-03/chapter-11/case-study-02.html | Case Study: Are Closing Lines Really Efficient? (Sports Betting Textbook, ch.11) | Test d'efficience des closing lines (⚠️ dataset **synthétique** de 2 720 matchs NFL), calibration + décomposition Brier, CLV↔ROI r=0,87, ~300+ paris pour séparer skill/luck, bords de 1-3% |
| 7 | https://github.com/PlamenKraev3/sports-odds-calibration | Sports Odds Calibration & Market Efficiency Analysis (README) | Protocole complet : dé-vig, calibration bins, Brier/Brier Skill Score, walk-forward saison t / saisons < t ; résultat : pas d'edge out-of-sample robuste sur 1X2 EPL/La Liga 2019-2024 |
| 8 | https://www.freetips.com/handball/handball-goals-betting-strategy-20260730-0052/ | Handball Goals Betting Strategy — Vedran Ostojic (2026) | Baselines Over/Under par compétition (LDC 62,74 ; Bundesliga 60,40 ; Mondial 58,25), σ ≈ 6,6-7,2 buts, +5 buts/décennie, facteurs tempo/efficacité/gardien/7-contre-6/2 min, team totals > match totals |

**Sources découvertes mais non fetchées (bloquées) — citées uniquement en contexte secondaire** : arXiv:2404.04213 confirme l'existence et le contenu de Groll et al. 2020 (*J. Sports Analytics* 6(3):187-197, sparse Gaussian), Dumangane et al. 2009 (*J. Applied Statistics* 36(7):723-741), Singh, Scarf & Baker 2023 (*EJOR* 304(3):1099-1112), Felice & Ley (COM-Poisson). Page « What Data Should Be Collected for a Good Handball Expected Goal model? » (hal.science/hal-04534417, link.springer.com/chapter/10.1007/978-3-031-53833-9_10) et chapitre Springer « Risk Parity vs. Kelly Criterion » (10.1007/978-3-032-27272-0_19) : **non vérifiés** (anti-bot/JS).

**Recherches de découverte** : 8 requêtes DuckDuckGo (handball total goals prediction model ; handball match outcome Poisson model academic ; handball over under total goals betting forecasting ; bivariate Poisson Dixon-Coles total goals forecasting sports ; sports betting calibration Brier score probability forecast evaluation ; closing line value sports betting market efficiency study ; Kelly criterion sports betting empirical fractional bankroll study ; walk-forward backtesting sports forecasting out-of-sample overfitting).

---

*Ce rapport est une synthèse des sources réellement consultées au 2026-09-25. Les estimations numériques non sourcées sont explicitement marquées (« calcul interne », « non vérifié »).*
