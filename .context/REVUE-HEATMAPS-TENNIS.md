# Revue : Heatmaps tennis — littérature, tenngrand, proposition produit
Réf session : `SESSION-2026-09-10-SPIDER-CHART` (T1/T2) · Date : 2026-09-10

## 1. Compilation tenngrand — « Tennis Statistics Explained » (14/01/2026)

### 1.1 Core metrics (avec benchmarks tour)
| Métrique | Lecture | Repères |
|---|---|---|
| Service Games Won % | Efficacité service globale (mieux qu'aces + %1ère) | 85 % élite · 75 % solide · <70 % vulnérable |
| Break Point Conversion % | Finition des occasions (clutch) | ~40 % moyenne · >45 % élite |
| Break Point Saved % | Sorties de crise au service | >65 % top |
| Pressure Points | Points critiques hors balles de break (0-30, 15-30, 30-40) | peu = domination ; beaucoup = hold laborieux |
| Contexte | Winners vs fautes, surface, période | jamais de brut sans comparaison |

### 1.2 Spider charts (radar)
- 8-10 metrics couvrant service, retour, efficacité ; moins = simpliste, plus = fouillis.
- Lecture : aire totale (dominance), pointes (avantages), creux (faiblesses), forme (style : serveurs ↔ retourneurs).
- Centre = pire, bord = meilleur.

### 1.3 Understanding Heatmaps (idée retenue)
- **Lignes = joueurs triés par « Power Index » composite ; colonnes = metrics.**
- Vert = au-dessus du groupe, rouge = en dessous, intensité = magnitude ; jaune = moyenne.
- **Métriques négatives inversées** (double fautes, pressure subie) pour que vert = toujours favorable.
- Avertissement : le groupe comparé est élite — « moyen » reste excellent en absolu.
- Règles transverses : **surface** (dur/clay/grass profils disjoints), **fenêtres** (52 sem. standard, YTD, carrière, tournoi), taille d'échantillon.

## 2. Revue académique — graphes spatiaux et performance au tennis

1. **Fitzpatrick et al. (2023, IJPA)** — Hawk-Eye Wimbledon 2016-18 (71 812 pts) : zones de service/retour (A-D, larges vs centrales), retours centraux dominants (réduisent les angles), vainqueurs + précis au service. Le zonage rend le tracking coach-lisible → ancêtre direct des heatmaps de placement.
2. **Wei, Lucey et al. (2016, SAM)** — 262 596 pts Hawk-Eye 2003-08 : vitesse/placement/spin du service → proba de gain ; serve impact quantifié à grande échelle.
3. **Serve spatial ML (PubMed 27189847)** — caractéristiques spatiales du service → aces (machine learning) : le PLACEMENT prime sur la puissance brute.
4. **MCP Tennis Abstract** — 16 leaderboards serve/return/rally/tactics (52 sem.) : granularité rating/pressure, la matière première d'une heatmap.
5. **Momentum (Graves 2025 ; Liu XGBoost 0.99 ; CBRF CatBoost/RF)** — serve %, distance, score : le momentum se modélise, mais bruité → poids modéré (notre Forme 15 %).
6. **Retour décisif (PMC 2022, 1990 joueurs ATP)** — % retours gagnés ↔ victoire ; 1st/2nd serve return points won parmi les plus corrélés au ranking.
7. **Points courts 0-4 = caractéristique n°1** à Wimbledon H/F (Fitzpatrick 2019/2021).

Synthèse pour nos pondérations : Service 20 ≈ Retour 15 > Forme 15 ≈ Élo 30 (fondamental, pas un "coup") — cohérent avec la littérature (serve > return > momentum).

## 3. Proposition produit — Heatmap « Top 10 × PowerScore » (tennis)

**Concept** (transposition directe tenngrand §1.3 sur nos données) :
- Lignes = Top 10 matchs/joueurs de la stratégie active, triés par PowerScore composite (= notre « Power Index »).
- Colonnes = 6 metrics PowerScore (Élo, Service, Forme, Retour, SPS, Fraîcheur).
- Cellules : écart au groupe (vert/rouge, intensité = magnitude) ; métrique Fraîcheur déjà positive ; caption "groupe élite".
- Clic cellule/ligne → focus table Top10 (même pattern que les pills).

**Faisabilité (données existantes)** : entries (serveA/retA déjà exposés) + PowerScore engine (déjà 0-100 + coverage). Aucune donnée à fabriquer ; coverage < 1 → cellule grisée "—".

**Placement pressenti** : sous le Top10 de la vue Stratégies (repliable), ou onglet dédié. **À valider avant build** (nouveau composant + tests).

## 4. Sources
- tenngrand.com (article intégral extrait via Playwright 10/09/2026 ; images spider/heatmap bloquées par challenge anti-bot — captions récupérées).
- Fitzpatrick et al. 2023 (T&F + PDF SHURA), Wei et al. 2016 (Wiley SAM), PMC 2022 (1990 ATP), PMC 2006 (Johnson), Liu et al. (XGBoost/SHAP), Graves et al. 2025 (TMM), Tennis Abstract MCP.
