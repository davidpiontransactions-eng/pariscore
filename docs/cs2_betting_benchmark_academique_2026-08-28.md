# CS2 PariScore — Benchmark Académique des Modèles de Prédiction & Vision d'Implémentation HLTV-style

**Date** : 2026-08-28
**Auteur** : GM/CTO PariScore (bootstrap cline superpowers)
**Périmètre** : Benchmark des revues académiques et thèses sur les paris sportifs CS2, analyse des prédicteurs web (bo3.gg, egamersworld, esportsoracle, X/Twitter), et vision d'implémentation pour l'onglet CS2 de PariScore (copie HLTV : infos matchs + stats maps + décision de bet).

---

## 1. SYNTHÈSE EXÉCUTIVE

La littérature académique est **unanime** sur un point central : **la précision brute (accuracy) n'est PAS la métrique qui rend un modèle de paris rentable — c'est la calibration (probabilités correctement estimées, riches en information) combinée à la détection d'écart vs les cotes du marché (value bet)**. Un modèle "64% d'accuracy" qui copie simplement le favori ne bat pas la cote : il est exactement au prix du marché.

Trois conclusions structurantes pour PariScore :

1. **Le gisement d'edge CS2 n'est pas "qui gagne le match"** (absorbé par les cotes/Elo) **mais les marchés granulaires** : Over/Under rounds par carte, handicap rounds par carte, winner de map (bénéficie du veto). C'est le terrain backtestable, avec des lignes serrées où un modèle Poisson/empirique peut battre le marché de quelques points — assez pour le seuil 65% demandé.
2. **La calibration prime tout** : le papier Walsh & Joshi (arXiv 2303.06021) mesure **ROI +34.69% en sélectionnant le modèle sur calibration vs −35.17% sur accuracy** sur le même marché NBA. PariScore doit donc backtester ses probas CS2 en Brier + ROI, pas en "nombre de bons pronostics".
3. **Le veto est un multiplicateur de victoire caché** : le papier Bandit Map Selection (arXiv 2106.08888) montre +19.8% de probabilité de victoire de match pour une équipe optimale au veto. PariScore simule déjà le veto — il faut le transformer en **probabilité de map jouée** et l'injecter dans les marchés map/over/handicap.

La vision d'implémentation (§6) s'appuie sur l'existant : le moteur `cs2-predictive-ml-engine.ts` (Bradley-Terry par carte + Monte-Carlo MR12 + veto) est déjà aligné sur la littérature. Les gaps sont : **backtest/calibration formel, dévig vs marché (cotes), handicap rounds quantifié par map, et l'UI HLTV-like**.

---

## 2. ÉTAT DES LIEUX PARISCORE CS2 (base de départ)

| Brique | Locus | Statut |
|---|---|---|
| Pipeline BSD + csapi.de + ByMykel + HLTV JSON | `services/cs2Service.js` | ✅ Prod |
| Routes API `/api/cs2/{matches,enrich,veto}` | `src/app/api/cs2/` | ✅ Prod |
| Schedule HLTV-like (étoiles, LAN, scores, carts) | `src/components/cs2/HLTVMatchSchedule.tsx` | ✅ Prod |
| Fiche match 3 onglets (Aperçu/Rosters/Map Pool & H2H) | `src/components/cs2/HLTVMatchSheetModal.tsx` | ✅ Prod |
| Moteur prédictif Bradley-Terry + Monte-Carlo MR12 + veto | `src/lib/prediction/cs2/cs2-predictive-ml-engine.ts` | ✅ Prod |
| Marchés : winner match, winner map, Over/Under rounds (seuil ≥65%), handicap −1.5 maps | idem | ✅ Prod (partiel) |
| Over/Under avg rounds/map (bo3.gg dataset) | `/api/v1/cs2/map-rounds` + `src/app/api/cs2/` | ✅ Prod |
| AI Scout LLM (UI-only, explicabilité) | `/api/v1/ai/cs2-analyze` | ✅ Prod (UI-only — benchmark cieslak validé) |
| Pistol index, roster strength, map pool entropy | `cs2Service.js` | ✅ Prod |
| Cron refresh HLTV JSON | — | ❌ Manquant (ops VPS 15 min) |
| Backtest Brier/ROI des marchés CS2 | — | ❌ **GAP #1** |
| Dévig vs cotes marché (Pinnacle/bo3) | — | ❌ **GAP #2** |
| Handicap rounds quantifié (proba de couvrir −/+) | — | ❌ **GAP #3** |
| Probabilité de map jouée (Markov veto) dans les marchés | — | ❌ **GAP #4** |
| Score rounds live par map (blocké : BSD ne l'expose pas) | — | ❌ (bead ParisScorebis-uon4) |
| Split W/L avg rounds (scraper par match) | — | ❌ (bead ParisScorebis-hptw) |

Le seuil **≥65% de probabilité de réussite** demandé par l'utilisateur est **déjà codé** (`CONFIDENCE_THRESHOLD = 0.65` dans le moteur). Ce qui manque n'est pas le seuil mais la **preuve que ces probas ≥65% sont calibrées** (sinon le seuil donne une fausse sécurité).
---

## 3. BENCHMARK ACADÉMIQUE — REVUES, MÉTRIQUES ET MODÈLES LES PLUS RENTABLES

### 3.1. Fiches papiers analysés (arXiv / journaux)

| # | Papier | Réf | Trouvaille clé | Pertinence PariScore |
|---|---|---|---|---|
| 1 | **Skill Issues: An Analysis of CS:GO Skill Rating Systems** (Bober-Irizar et al.) | arXiv 2410.02831 | Elo 62.8%, Glicko-2 63.1%, TrueSkill **per-joueur 64.1%** sur gros dataset CS:GO ; le rating par joueur bat le rating d'équipe | Marginale (Elo BSD ≈ déjà là) ; **l'incertitude (RD Glicko-2) reste un input de confiance inexploité** |
| 2 | **Optimal Team Economic Decisions in Counter-Strike** (Xenopoulos et al.) | arXiv 2109.12990 | Modèle de win-prob game-level avec features **scores, équipement, argent, dépenses** → identifie la "sub-optimalité" économique des équipes (métrique OSE) | **Forte** : l'économie est LE prédicteur de round ; mais feed économie live bloqué (BSD) |
| 3 | **ESTA: Esports Trajectory and Action Dataset** (Xenopoulos & Silva) | arXiv 2209.09861 | awpy parse démos : 7.9m frames, 417k trajectoires ; benchmarks win pred positionnels | Hors-stack (démos, pas temps réel) |
| 4 | **Valuing Player Actions in CS:GO** (Xenopoulos et al.) | arXiv 2011.01324 | Framework context-aware : valeur d'une action = **Δ probabilité de victoire** (70m événements) | Conceptuel : c'est exactement ce qu'un "Round Swing proxy" ferait |
| 5 | **Bandit Modeling of Map Selection in CS:GO** (Petri et al.) | arXiv 2106.08888 | Contextual bandit sur 3 500 matchs / 25 000 décisions veto : les équipes sont **sous-optimales** au veto ; modèle optimal → **+11% map win prob, +19.8% match win prob** pour équipes égales | **Très forte** : valide la simulation de veto déjà codée + ouvre le "Markov veto predictor" |
| 6 | **Machine learning for sports betting: accuracy or calibration?** (Walsh & Joshi) | arXiv 2303.06021 | **ROI +34.69% en sélectionnant sur calibration vs −35.17% sur accuracy** (NBA, cotes publiées) | **CRITIQUE** : justifie le GAP #1 (backtest Brier/ROI avant tout signal CS2) |
| 7 | **A Systematic Review of ML in Sports Betting** (Galekwa et al.) | arXiv 2410.21484 | SVM/RF/NN appliqués foot, basket, tennis ; challenges : qualité données, temps réel, imprévisibilité ; direction : modèles adaptatifs + gestion risque façon portefeuille | Cadre général ; confirme l'approche → "gestion de risque façon Kelly" |
| 8 | **Asian Handicap football betting market efficiency** (Constantinou) | arXiv 2003.09384 / J. Sports Analytics | Le marché AH partage les inefficiences du marché 1X2 ; modèle ratings + Bayesian nets pour l'exploiter | **Forte** : transposition directe au handicap rounds **CS2** (même structure : ligne fractionnaire) |
| 9 | **Rethinking Evaluation Metric for Probability Estimation Using Esports Data** (Choi et al.) | arXiv 2309.06248 | Brier score + ECE + nouveau **Balance score** pour les modèles de win-prob esports | Forte : la métrique d'éval à adopter pour nos signaux ≥65% |
| 10 | **Real-time eSports Match Result Prediction** (Yang et al., Dota 2) | arXiv 1701.03162 | Features pre-match : 71.49% ; + features temps réel → **93.73% à la 40e min** | Conceptuel (Dota) : le live bourre l'accuracy mais n'apporte de l'edge que si on trade plus vite que la cote |
| 11 | **Scalable Psychological Momentum Forecasting in Esports** (White & Romano) | arXiv 2001.11274 | Représentation apprise du momentum/tilt améliore la prédiction pre/post draft | Faible-mais-utile : cohérent avec notre Live Momentum kill-based |
| 12 | **Cieslak AI Benchmark (LLM CS2)** (analyse PariScore 2026-06-05) | cieslak.dev | LLM best 64.3% ≈ proba implicite du favori (64.5%) → **edge 0** ; reasoning models pires | Déjà intégré : AI Scout = UI-only, jamais source de proba officielle |
| 13 | **Predicting the NFL using Twitter** (Sinha et al.) | arXiv 1310.6998 | Features Twitter (volume de tweets) **égalent ou dépassent** les stats de jeu pour prédire winner & over/under | **Forte pour X/Twitter (§5)** : le sentiment social a un pouvoir prédictif réel mesuré en académique |
| 14 | **Betting the system: Using lineups to predict football scores** (Peters & Pacheco) | arXiv 2210.06327 | SVR + lineups → **+42% return** sur cotes réelles (football EPL) | Preuve : un modèle "simple mais bien calibré + cotes réelles" = ROI positif |
| 15 | **Conversational Collective Intelligence (MLB)** (Schumann et al.) | arXiv 2511.03732 | Groupes de fans débattant via IA : 78% accuracy high-confidence vs Vegas 57% (p=0.020), **46% ROI ATS** | Idée produit : combiner plusieurs modèles/opinions = "consensus intelligence" |
### 3.2. Synthèse des métriques utilisées dans la littérature CS2

| Métrique | Utilisée par | Ce que la littérature dit |
|---|---|---|
| **Elo / Glicko-2 / rating par joueur** | Skill Issues (1) | Benchmark de base ; per-joueur > équipe de ~1pp ; RD = incertitude |
| **Map winrate %** (fenêtres 3m/6m/1y) | Produit de la majorité des papiers + bo3.gg | LE feature par carte ; lissage Laplace obligatoire |
| **CT/T round winrate** | Esports Oracle, bo3.gg, BSD | Séparation des côtés essentielle (side bias par map) |
| **Pistol round winrate** | HLTV pistols stats, audit HLTV PariScore | Petit mais réel edge live (rounds 1/13) |
| **Économie (armor+weapon value, money)** | Optimal Economic Decisions (2) | **Meilleur prédicteur du round à venir** ; OSE pour classer la rationalité d'équipe |
| **Rating individuel (1.0/2.0/3.0, ADR, KAST, K/D)** | HLTV Rating 3.0 + OAR ; csapi.de | Proxy de "skill latent" ; à pondérer par adversaire (OAR) |
| **Form récente 5-10 matchs** | Egamersworld, bo3.gg, Oracle Form Score | Simple et robuste ; opponent-weighted >> brut |
| **H2H** | bo3.gg, Oracle | Faible seul, confirmateur |
| **Veto / pick-ban historique** | Bandit Map Selection (5) | +19.8% win prob d'équipe quand optimal ; **probabilité de chaque map jouée** |
| **Springs/rounds moyens, distribution** | Marché Over/Under | Distribution totale {13..30+} → probabilité exacte par ligne (20.5…26.5) |

### 3.3. Tendances des paris les plus rentables (consensus académique + marché)

1. **Calibration > accuracy** (papiers 6, 9) : la rentabilité vient de probas justes et de l'écart avec la cote, pas du taux de réussite. → backtest Brier/ROI systématique.
2. **Marchés de total (Over/Under rounds)** : les modèles de distribution (Poisson/gamma/empirique) battent plus facilement des lignes serrées que les modèles de vainqueur. Le marché des rounds CS2 a une **variance structurelle** (eco rounds, pistols) que les bookmakers lissent.
3. **Handicap (Asian-style) rounds** : papier 8 transféré au CS2 — le handicap fractionnaire (ex : −1.5, −2.5 rounds) est sous-exploré en académique esports, mais le marché esports le cote ; zone d'edge potentiel.
4. **Winner de map + veto** : papier 5 — savoir QUELLE map sera jouée change la proba de +19.8% ; c'est l'edge le plus accessible pour PariScore (données bo3.gg + HLTV déjà en stock).
5. **Consensus / sentiment** : papiers 13 & 15 — mélanger modèle + signal social améliore le ROI ; mais jamais sans gate de calibration.
6. **Fréquence vs valeur** : les tipsters rentables à long terme jouent **peu de paris, à forte valeur** (recommandation implicite des papiers bankroll/Kelly) — cohérent avec le seuil ≥65% PariScore.
---

## 4. ANALYSE DES PRÉDICTEURS WEB : COMMENT ILS FORMALISENT UNE PRÉDICTION

### 4.1. bo3.gg/predictions (analyse en direct, 2026-08-28)

Structure exacte d'un article de prédiction (ex. Falcons vs MongolZ, EWC 2026) :

```
Titre : "Falcons vs The MongolZ Match Prediction and Analysis — EWC 2026 Playoffs"
Auteur + date : "Siemka · 09:37, 19.08.2026"
§1 Current form of the teams :
   - rang Valve, winrate overall / 12m / 6m / 1m (ex : 56% / 73% / 75% / 67%)
   - streak, résultats récents du tournoi (2-0 vs Astralis…)
   - earnings 6m (ex : $765k, No.1)
§2 Teams' Map Pool :
   - **séquence de veto prédite** (Falcons ban Inferno, MongolZ ban Train,
     Falcons pick Mirage 56%, MongolZ pick Ancient 40%, bans Nuke/Anubis,
     decider Dust2) → rationnel qualitatif par map
§3 Historical Maps winrate (tableau Last 6 months) :
   Map | Falcons WR | M(atches) | B(ans) | Last 5 maps (W/L)
   ex : Mirage 58% · 19 · 3 · w l w l l
§4 Head-to-Head : bilan séries + dates + scores maps
§5 Match Prediction : verdict qualitatif + score PRÉDIT EXACT :
   "Prediction: Falcons 2:1 The MongolZ"
```

**Points à retenir** : (a) données = winrate par fenêtre + bans + last-5 = le même matériau que PariScore ; (b) **aucune probabilité chiffrée, aucun calcul EV, aucune cote affichée, aucune calibration/backtest** — c'est de l'analyse humaine structurée, pas un modèle. PariScore peut faire **mieux** : proba chiffrée + backtest + EV vs cote.

### 4.2. egamersworld.com/counterstrike/tips

- Tips **par analystes humains** (Stanislav Yablonskyi, Dima Ostapchuk…), format article :
  `Tournoi · #rang · date · BoX · score réel vs prédiction ("Vitality Will win", "2:0 (FURIA)")`
- 2 types de verdict : **winner simple** OU **score exact de série**.
- La page est un **hub éditorial** (news + guides "Basic CS2 Betting Tips" : learn teams, check map pool, understand tournament value, manage money).
- **Aucune donnée chiffrée structurée** : pas de proba, pas de cote, pas de ROI visible. Qualité informative faible vs bo3.gg.

### 4.3. esportsoracle (audit existant PariScore, 2026-06-02)

- "10-component model using real HLTV data for top-50 teams" ; Form Score **0-100 opponent-weighted 30j** ; tables CT/T/Pistol/LAN/BO3 ; H2H par map.
- Pas de cotes, pas d'EV → **prédiction pure**. PariScore a l'avantage cotes+trading.

### 4.4. Ce que PariScore doit copier vs inventer

| Élément | bo3.gg | egamersworld | Oracle | **PariScore (cible)** |
|---|---|---|---|---|
| Form par fenêtres (1m/3m/6m/1y) | ✅ | partiel | ✅ 30j | ✅ enrich |
| Veto prédit avec rationnel | ✅ | ❌ | ❌ | ✅ simulé ; **→ + proba par map** |
| Tableau map WR + bans + last-5 | ✅ | ❌ | ✅ | ✅ map_trends ; **→ + bans, last-5** |
| H2H détaillé | ✅ | partiel | ✅ | ✅ h2h.detail |
| Score prédit exact ("2:1") | ✅ | ✅ | ❌ | ⚠️ média + proba (statistiquement 2-1 > 2-0) |
| **Proba chiffrée par marché** | ❌ | ❌ | ❌ | ✅ **AVANTAGE PariScore** |
| EV vs cote + backtest | ❌ | ❌ | ❌ | ✅ **AVANTAGE PariScore (à ajouter)** |
| Verdict binaire BET/SKIP ≥65% | ❌ | ❌ | ❌ | ✅ **AVANTAGE PariScore (existant)** |
---

## 5. PRÉDICTIONS X/TWITTER — COMMENT ELLES SONT FORMÉES

### 5.1. Typologie des comptes

1. **Tipsters solo** (comptes dédiés CS2 betting) : un humain publie 1-3 picks/jour, format `[MATCH] Map pool + form → pick @cote — Bank: XU` avec une capture des stats. Méthodologie déclarée : lecture HLTV (rankings, map winrates), forme récente, veto potentiel, puis **intuition + ajustement subjectif**. Aucune calibration publiée, ROI affiché en périodes gagnantes. Biais de survie massif.
2. **Agrégateurs/communautés** (souvent sponsorisés) : ils republient les cotes et un consensus de tipsters ; la "prédiction" est en réalité la **cote implicite du marché** transposée en favori + justification narrative.
3. **Comptes data/statistiques** (bots feeds HLTV : résultats, map stats) : pas des prédictions mais la **matière première** que tout le monde cite (mêmes sources que PariScore).
4. **Analystes reconnus** (casteurs, anciens pros) : analyse éditoriale longue, basée sur l'expérience + données ; rarement des cotes, jamais de série longue publiée.

### 5.2. Limites documentées (académique + observation)

- **Le papier "Predicting the NFL using Twitter" (arXiv 1310.6998)** montre que le simple **volume de tweets** prédit aussi bien que les stats de jeu pour winner et over/under : il y a un vrai signal de sentiment/diffusion d'information. Mais ce signal se **dégrade vite** (le pari doit être pris avant que la cote absorbe l'information).
- Les tipsters X ne publient quasiment jamais de **matrice de calibration/Brier** ; leurs probas implicites ("je suis sûr à 80%") sont **non vérifiables**.
- Le consensus des tipsters X ≈ la cote du marché (ils lisent la même data HLTV que les traders bookmakers) → peu d'edge, sauf sur marchés de niche (rounds, over/under maps).
- **Conclusion PariScore** : ne pas copier les tipsters pour la prédiction (pas de calibration), mais deux usages défendables : (a) **sentiment social comme feature mineure** (à la Sinha, pondérée basse, derrière les features quantitatives) — cohérent avec le papier 15 (consensus CI) ; (b) **transparence narrative** façon bo3.gg/egamersworld pour l'UI.
---

## 6. VISION D'IMPLÉMENTATION PARISCORE (refonte HLTV-style + edge betting)

### 6.1. Objectifs vérifiables

1. **[Pipeline data] → verify** : feed cotes marché (Pinnacle/bo3 ou OddsAPI via provider existant) par match CS2 + backfill historique pour backtest.
2. **[Calibration] → verify** : rapport Brier / Balance score / ROI sur 90j glissants de chaque marché (winner, map, over/under, handicap) ; **aucun signal BET sans calibration admissible**.
3. **[Marchés] → verify** : 4 marchés prédictifs avec proba : winner match, winner map, **Over/Under rounds (lignes 20.5-26.5)**, **handicap rounds (−1.5/−2.5/+1.5/+2.5)** — tous affichés avec confiance et **seuil ≥65%** pour émettre un verdict BET/SKIP.
4. **[UI HLTV-like] → verify** : fiche match enrichie type HLTV/bo3.gg (form fenêtres, map pool avec bans + last-5, veto séquence + proba par map, H2H maps) — **zéro emoji, charte PariScore**.
5. **[Traçabilité] → verify** : beads + rapport + PR focalisée, lint/typecheck verts.

### 6.2. Architecture cible (3 couches, zéro dépendance nouvelle)

```
services/cs2Service.js  (existant) — normalise BSD + csapi + HLTV JSON
        ↓ enrich (60+ champs)
src/lib/prediction/cs2/cs2-predictive-ml-engine.ts  (existant, à étendre)
   + GAP #3  handicapRoundsMarket(): proba P(T1−T2 ≥ ligne) depuis dist.t1Wins−t2Wins
   + GAP #4  mapPlayProb Markov veto: P(map jouée) depuis modèles veto sim + historique pick/ban
   + GAP #2  evCompute(): P_model vs P_implicite_cote → EV, Kelly fraction, verdict
        ↓
src/app/api/cs2/*  (existant) + /api/cs2/markets (nouveau, agrégé)
        ↓
UI HLTV-like : HLTVMatchSchedule (existant) + HLTVMatchSheetModal enrichi
   + onglet "Marchés & Value" avec proba/EV/badges ≥65%
```

### 6.3. Plan d'exécution par lot (chaque lot = 1 commit conventionnel)

| Lot | Tâches | Fichiers | Effort | Dépend de |
|---|---|---|---|---|
| L0 | **Backtest harness** : collecte résultats passés (csapi 180j), calcule Brier/ROI par marché | `scripts/cs2-backtest.ts` + `tests/` | 4h | — |
| L1 | **Handicap rounds market** : distribution MC → P(cover ligne ±1.5/2.5) ; exposé dans moteur + API | `cs2-predictive-ml-engine.ts`, `route.ts` | 3h | L0 |
| L2 | **Map play prob** : poids veto sim × fréquence historique pick/ban (données bo3/HLTV en stock) | engine + `computeBSDMapRankings` | 3h | — |
| L3 | **EV vs cotes** : dévig (méthode multiplicative/Shin), P_model vs cote → EV% + Kelly ; badge BET/SKIP | `src/lib/cs2/ev.ts` + UI | 4h | L0 |
| L4 | **UI HLTV-like** : fiche match enrichie (form, map pool bans+last-5, veto+proba, marchés, EV) | `HLTVMatchSheetModal.tsx` + sous-composants | 5h | L1-L3 |
| L5 | **Cron HLTV JSON auto** (ops VPS) | crontab VPS | 30min | — |

> ⚠️ **Bloquant data** (beads ouverts) : score rounds live par map (BSD ne l'expose pas), split W/L avg rounds (scraper per-match). **Le live round par map n'est pas requis pour la v1 (pré-match seulement).**

### 6.4. Décisions de design justifiées par la littérature

1. **Seuil 65% maintenu** (demande utilisateur) mais **conditionné à la calibration** (papiers 6/9) : un signal ≥65% non calibré est dangereux. Le backtest L0 décidera si on garde un buffer (ex : n'afficher BET que si proba≥65% ET EV≥4% ET calibration OK).
2. **Modèle par carte (Bradley-Terry) + Monte-Carlo MR12** : validé par les papiers 1/5/2 ; on **ne** refait **pas** de DNN sur démos (hors-stack, papiers 3/4).
3. **Probabilité de map jouée via veto** : papier 5 (+19.8%) — c'est notre levier n°1.
4. **YAGNI** : pas de TrueSkill per-player (lourd, +1pp), pas d'économie live (bloqué feed), pas de sentiment X côté prédiction (feature faible non backtestable proprement ici) — **on documente**, on n'implémente pas.
5. **Kelly fraction (cap 0.25)** déjà présent dans PariScore (beads T2/m13e) → réutiliser pour la taille de mise CS2.

### 6.5. Risques

| Risque | Mitigation |
|---|---|
| Probas non calibrées → faux "65%" | Harness backtest L0 AVANT tout signal prod ; gate de déploiement |
| Cotes stale/biaisées (marché CS2 peu liquide) | Dévig multi-échantillons + fenêtre de fraîcheur |
| Données map winrate sparse (faible échantillon) | Laplace smoothing déjà en place ; prior sample 6 |
| HLTV bloque scraping VPS | Scripts locaux (IP résidentielle) déjà en place ; FlareSolverr option |
---

## 7. TRACABILITÉ

### 7.1 État d'avancement de l'implémentation (mis à jour 2026-08-28 —Tasks 0-9 exécutées)

| Livrable | Statut | Locus |
|---|---|---|
| Lib calibration (Brier/ECE/ROI + verdict) | ✅ livré | `src/lib/prediction/cs2/cs2-calibration.ts` |
| Marché handicap rounds ±1.5/2.5 (proba cover MC) | ✅ livré | `src/lib/prediction/cs2/handicap-rounds.ts` |
| Proba de map jouée (veto + historique) | ✅ livré | `src/lib/prediction/cs2/map-play-prob.ts` |
| EV/devig/Kelly/gate BET-SKIP | ✅ livré | `src/lib/cs2/ev.ts` |
| Backtest harness walk-forward (495 matchs réels) | ✅ livré | `scripts/cs2-backtest.ts` + `data/cs2-backtest-report.json` |
| API agrégée /api/cs2/markets (gate calibration) | ✅ livré | `src/app/api/cs2/markets/route.ts` |
| UI panneau marchés calibrés dans fiche match | ✅ livré | `src/components/cs2/Cs2MarketsPanel.tsx` |
| UI bans + last-5 (style bo3.gg) | ⚠️ N/A | bans non exposées par csapi/BSD — bead ouvert |
| Cron HLTV JSON auto (L5) | ⏳ restant | ops VPS 15 min |

**Résultat backtest réel** (495 matchs 90j, walk-forward) : le marché **Over/Under rounds est le seul calibré** (Brier 0.236, ECE 0.033 → OK) — les marchés winner/map/handicap sont en surconfiance (ECE 0.11-0.18 → NO-GO). Le gate de calibration bloque donc leurs signaux BET jusqu'à amélioration (blend ELO, vraies cotes). Détail : `.context/trace-cs2-implementation.md`.

### 7.2 Références

- **Beads liés** : ParisScorebis-xog5 (implémentation, close), ParisScorebis-hptw (split W/L rounds), ParisScorebis-uon4 (score rounds live), ParisScorebis-kruy/mx8x (logos tournois), ParisScorebis-m13e (Kelly display).
- **Plan** : `docs/superpowers/plans/2026-08-28-cs2-hltv-markets.md` · **Trace** : `.context/trace-cs2-implementation.md`.
- **Rapport issu de recherches web en direct** (2026-08-28) : arXiv API (15+ papiers), bo3.gg (2 articles de prédiction lus en entier), egamersworld (pages tips/accueil), esportsoracle (audit antérieur), Google Scholar/Bing (bloqués pour tipsters X → analyse par typologie + papier 13).
- **Prochaine étape** : PR vers main + deploy (validation utilisateur), puis recalibration winner/map avec blend ELO + vraies cotes.

---

*Rapport généré via pipeline brainstorming/recherche Cline — aucune ligne de code modifiée dans ce livrable. Sources principales : arXiv 2410.02831, 2303.06021, 2106.08888, 2109.12990, 2003.09384, 2410.21484, 2309.06248, 1310.6998, 2210.06327, 2011.01324, 2511.03732 + audits PariScore existants (docs/cs2_*.md).*