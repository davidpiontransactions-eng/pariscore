# PRIORISATION_METRIQUES.md
## Livrable Session 1 — Kickoff DS + Parieur Pro

**Date :** 17 Juin 2026
**Participants :** Expert Documentaire + Data Scientist + Parieur Pro
**Statut :** ✅ Session terminée, divergences documentées

---

## Résumé Exécutif

Sur 20 métriques candidates issues de 14 thèses, le Data Scientist et le Parieur Pro ont chacun rendu leur verdict. **Le croisement des deux expertises donne :**

| Verdict | Nombre | Action |
|---------|--------|--------|
| ✅ **Accord DS + Parieur** | **4 métriques** | Noyau dur → priorité #1 |
| ⚠️ **DS OK / Parieur pas OK** | **4 métriques** | À arbitrer en Session 3 |
| ⚠️ **Parieur OK / DS pas OK** | **2 métriques** | À arbitrer en Session 3 |
| ❌ **Accord pour rejeter** | **5 métriques** | Écartées |
| 🔍 **Angles morts (hors thèses)** | **6 facteurs** | À intégrer dans le modèle |

---

## Top 4 : Noyau Dur Validé par les Deux Expertises

Ces métriques sont approuvées à la fois par la rigueur statistique (DS) ET par l'expérience terrain (Parieur). **Priorité absolue d'implémentation.**

| # | Métrique | Note DS | Note Parieur | Edge | Priorité Engineering |
|---|----------|---------|-------------|------|---------------------|
| **1** | **SRV_PTS_WON_S** ← EWMA 5 matchs, % points service gagnés | LOFO −4.0 pts ✅ | "Mon arme secrète depuis 2022" — 8.400€ gagnés | 7/10 | **MVP — SPRINT 1** |
| **2** | **RET_PTS_WON_S** ← EWMA 5 matchs, % points retour gagnés | LOFO −3.5 pts ✅ | "5.200€ sur De Minaur Acapulco 2024" | 6/10 | **MVP — SPRINT 1** |
| **3** | **H2H_SURFACE** ← H2H filtré par surface ET année | LOFO −1.0 pt ⚠️ | "Repère les mismatchs psychologiques" | 4/10 | **SPRINT 1** |
| **4** | **PRESSURE_INDEX** ← ratio points importants gagnés | Donnée difficile ❌ | "9.600€ gagnés — personne ne regarde ça" | 7/10 | **SPRINT 2** (scraping nécessaire) |

### Pourquoi ces 4 ?

> **SRV_PTS_WON_S** est la métrique #1 des deux côtés : le Data Scientist la valide scientifiquement (LOFO −4.0, la plus haute), le Parieur Pro la valide par l'argent gagné. C'est le consensus le plus fort de toute l'analyse.

> **PRESSURE_INDEX** est le désaccord le plus intéressant : le DS le rejette car difficile à calculer, le Parieur en fait sa métrique préférée. La décision est stratégique : investir dans le scraping nécessaire ou pas ?

---

## Zone d'Arbitrage : 6 Métriques en Désaccord

Ces métriques doivent être discutées en Session 3 (Atelier Feature Engineering). Chaque camp a des arguments solides.

### Groupe A : DS ✅, Parieur ❌

| Métrique | Argument DS | Argument Parieur | Enjeu |
|----------|-------------|-----------------|-------|
| **AGE.30** (|age-30|) | Buhamra SEL : +2.5% accuracy, zéro fuite, gratuit | "Djokovic 37 ans #1, Alcaraz 21 ans #2. L'âge ne prédit rien dans le Top 10." | Faible — métrique gratuite, la garder ne coûte rien |
| **BP_CONV** (% conversion balles de break) | Klaassen 2023 : −1.5 pts LOFO, stable | "Bruit d'échantillonnage immense, un joueur passe de 55% à 35% sur 5 matchs" | À garder mais avec EWMA long (α=0.05) pour lisser |
| **BP_SAVED** (% balles de break sauvées) | Synergie avec BP_CONV, corrélation r=0.4 avec SRV | "Jamais un facteur unique de décision" | Moyen — utile en combinaison |
| **ATP_POINTS** (points ATP) | Continue, bonne discrimination Top 10 | "Inclut des résultats d'il y a 1 an, Rublev top 5 jouait top 30" | À tronquer sur 6 mois glissants |

### Groupe B : Parieur ✅, DS ❌

| Métrique | Argument Parieur | Argument DS | Enjeu |
|----------|-----------------|-------------|-------|
| **WINNING_DERIV** (dérivée taux de victoire) | "Capter le momentum de performance avant le marché" | "Look-ahead bias si mal bordée, r=0.8 avec MOMENTUM" | Élevé — potentiel d'edge unique mais risqué |
| **SERVE_DECAY** (déclin service avec âge) | "4.200€ sur Isner US Open — marché n'avait pas intégré" | "Sous-spécifié, déjà capturé par SRV_PTS_WON_S" | Moyen — utile pour les joueurs >32 ans |

---

## Top 5 : Rejetées par les Deux Expertises

Ces métriques sont écartées — ni la science ni le terrain ne les valident pour le Top 10.

| Métrique | Raison scientifique | Raison terrain |
|----------|-------------------|----------------|
| **ATP_RANK** | Variance trop faible dans Top 10 (1→15) | "Indicateur retardé 52 semaines" |
| **MOMENTUM** | Non reproductible (2015-19 vs 2023-24) | "Mythe de commentateur TV — 7.000€ perdus" |
| **H2H_TIEBREAK** | N catastrophique (< 10 échantillons) | "Statistiquement insignifiant" |
| **H2H_5TH_SET** | N < 5, impossible à modéliser | "15-20 cas sur 5 ans" |
| **AGE.INT** | Redondant avec AGE.30 (r=0.7) | "Aucun sens pour un joueur spécifique" |

---

## Les 6 Angles Morts que les Thèses ne couvrent PAS

Le Parieur Pro a identifié 6 facteurs que les 14 thèses ignorent mais qui sont CRITIQUES pour gagner de l'argent :

| Facteur | Edge estimée | Comment le capter | Priorité |
|---------|-------------|-------------------|----------|
| **1. Blessures non déclarées** | 9/10 | Scrape médias locaux, Twitter internes tournoi, photos échauffement | **SPRINT 2** |
| **2. Motivation** (joueur après Grand Chelem, petit tournoi) | 8/10 | Tracker « dernière perf », statut du tournoi, distance au dernier match | **SPRINT 1** — facile |
| **3. Fatigue / Décalage horaire** | 8/10 | Dernier tournoi, distance géographique, jours de repos | **SPRINT 1** — facile |
| **4. Climat** (chaleur, vent, humidité, indoor/outdoor) | 7/10 | OpenWeather API (gratuit) | **SPRINT 2** |
| **5. Changement d'entraîneur** | 6/10 | Scrape news tennis, API ATP | **SPRINT 2** |
| **6. Présence famille / public** (joueur jouant dans son pays) | 5/10 | Nationalité joueur, ville du tournoi | **SPRINT 1** — gratuit |

### Coût estimé de l'implémentation des angles morts

`
Angles morts SPRINT 1 (motivation, fatigue, public) : ~2 jours de scraping
Angles morts SPRINT 2 (blessures, climat, entraîneur) : ~1 semaine de scraping + NLP
`

---

## Plan d'Action pour les Sessions Suivantes

### Session 2 (Data Dive) — À faire par le Data Scientist
`
Valider SUR DONNÉES RÉELLES les 4 métriques du noyau dur :
  - SRV_PTS_WON_S → Tester l'EWMA avec différentes fenêtres (3, 5, 8, 15 matchs)
  - RET_PTS_WON_S → Symétrique
  - H2H_SURFACE   → Tester différentes fenêtres temporelles (1 an, 2 ans, 5 ans, illimité)
  - PRESSURE_INDEX → Prototyper le calcul, tester la faisabilité

Pour chaque métrique :
  - Time-aware expanding window CV
  - Test de stabilité 2010-2024
  - Matrice de corrélation avec les autres métriques
  - Distribution Top 10 vs Top 50 vs tous
`

### Session 3 (Atelier Feature Engineering) — Points à arbitrer
`
1. AGE.30 : garder (coût nul) ou jeter (aucun edge) ?
2. BP_CONV + BP_SAVED : les garder avec EWMA long, ou les jeter ?
3. PRESSURE_INDEX : investir dans le scraping ou pas ?
4. Construire les métriques composées Pariscore :
   - SERVE_EDGE = (SRV_PTS_WON_S - RET_PTS_WON_OPP_S) × SURFACE_WEIGHT
   - CLUTCH_FACTOR = (BP_CONV_S × BP_SAVED_S × TIEBREAK_WINRATE)^(1/3)
   - MOMENTUM_ELITE = (EWMA_5matchs - EWMA_20matchs) × TOP10_BOOST
`

### Session 4 (Stratégies de Paris) — Déjà esquissé par le Parieur
`
Filtrer les 3 stratégies candidates selon les données disponibles
Définir la gestion de bankroll précise
Estimer le ROI réalisable
`

---

## Annexe : Grille de Décision Finale

`
20 métriques candidates (14 thèses)
  │
  ├── ✅ ACCORD DS + PARIEUR (4)
  │   └── Sprint 1 : SRV_PTS_WON_S, RET_PTS_WON_S, H2H_SURFACE
  │   └── Sprint 2 : PRESSURE_INDEX
  │
  ├── ⚠️ DÉSACCORD (6)
  │   ├── Groupe A (DS OK, Parieur pas) : AGE.30, BP_CONV, BP_SAVED, ATP_POINTS
  │   │   └── Session 3 → Décision : garder avec modulations
  │   └── Groupe B (Parieur OK, DS pas) : WINNING_DERIV, SERVE_DECAY
  │       └── Session 3 → Décision : garder un seul des deux
  │
  ├── ❌ REJET (5)
  │   └── ATP_RANK, MOMENTUM, H2H_TIEBREAK, H2H_5TH_SET, AGE.INT
  │
  └── 🔍 ANGLES MORTS (6)
      ├── Sprint 1 : Motivation, Fatigue, Public
      └── Sprint 2 : Blessures, Climat, Entraîneur

NOYAU DUR PROVISOIRE = 4 + 3 (après arbitrage) + 3 (angles morts S1)
                      = 10 métriques pour le Sprint 1
`

---

*Document produit par l'Expert Documentaire — Pariscore*
*Basé sur les travaux du Data Scientist et du Parieur Pro*
*Juin 2026*
