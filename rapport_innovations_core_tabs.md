# Rapport d'Innovations — Onglets Football & Tennis (Core Tabs)

> **Date** : 20 mai 2026
> **Document** : `rapport_innovations_core_tabs.md`
> **Auteur** : Lead Product Manager (PariScore) — synthèse panel virtuel
> **Statut** : DRAFT — en attente d'arbitrage du DG
> **Périmètre** : `pariscore.html` → `#page-matchs` + `#page-tennis`
> **Périmètre exclu** : Mes Paris, Stratégies, AI Scout, Alertes, Tarifs

---

## TABLE DES MATIÈRES

1. [Executive Summary](#1-executive-summary)
2. [Étape 1 — Audit Critique (Le Débat)](#2-étape-1--audit-critique-le-débat)
3. [Étape 2 — Innovations "Game Changer"](#3-étape-2--innovations-game-changer)
4. [Étape 3 — Rapport Détaillé & Roadmap Priorisée](#4-étape-3--rapport-détaillé--roadmap-priorisée)
5. [Étape 4 — Top 3 retenu pour arbitrage](#5-étape-4--top-3-retenu-pour-arbitrage)

---

## 1. EXECUTIVE SUMMARY

### Constat
Les onglets Football (9 colonnes visibles + 6 cachées) et Tennis (16 colonnes) sont déjà parmi les plus denses du marché francophone. PariScore expose 14 métriques quantitatives actives (xG, Poisson, Elo, DR, PowerScore, Edge dévigé, EV, Bayésien blended, Bootstrap UQD, Calibration, Accuracy, Live Intensity, Momentum, Confiance) — ce qui dépasse Flashscore et SofaScore.

**Mais** : la densité a un coût. Le panel d'experts virtuels (Quant-Trader, Live-Data-Analyst, Fintech-UX-Lead) converge sur un même diagnostic : **trop d'information statique, pas assez de signal directionnel**. Le parieur pro voit des chiffres mais pas l'anomalie. L'œil n'est pas guidé vers l'opportunité.

### Verdict des 3 experts
| Expert | Note actuelle /10 | Phrase choc |
|---|---|---|
| **Quant-Trader** | 6.5/10 | "On expose la prédiction mais on cache l'**asymétrie**. Pas de borne IC visible sur le tableau. Pas d'historique de calibration en cellule. La cote n'est pas comparée au modèle visuellement." |
| **Live-Data-Analyst** | 7/10 | "Live Intensity à 0-100 = top. Mais pas de **direction**. Pas de sparkline. Pas de delta DR temps-réel sur foot. Polling 30s tennis = ok mais on attend l'événement, on ne le voit pas venir." |
| **Fintech-UX-Lead** | 5.5/10 | "16 colonnes tennis = surcharge cognitive. Bloomberg ne dépasse pas 8-9 colonnes prioritaires. Le scan visuel < 500ms est impossible aujourd'hui. Trop de chips concurrents pour l'attention." |

### 3 axes d'amélioration retenus
1. **VALUE-FIRST** : Refonte de la hiérarchie visuelle pour que l'anomalie de cote (EV > 0, divergence model-bookmaker) soit le premier élément capté en moins de 500ms.
2. **MICRO-VIZ EN CELLULE** : Sparklines de pression, deltas DR, courbes Elo, jauges IC — intégrées directement dans le tableau, pas dans des modales.
3. **MOMENTUM ALERTS** : Système d'alerte visuelle (néon clignotant, bordure pulse) déclenché par divergence modèle/marché en live ou bascule de DR > seuil.

---

## 2. ÉTAPE 1 — AUDIT CRITIQUE (LE DÉBAT)

### 2.1 — FOOTBALL

#### [QUANT-TRADER] parle en premier

> *"Je vois 9 colonnes. Lesquelles me servent à prendre une décision EV > 0 en 2 secondes ? Réponse : 2. La colonne **VALUE** (l'edge dévigé) et la colonne **Cote ▼** (dropping odds). Le reste, c'est du contexte. Et le contexte, je ne le veux pas dans une cellule, je le veux dans une **modal de validation post-décision**, pas en pré-décision."*

**Ce qui manque (Quant) :**
- **Borne inférieure IC à 90%** affichée à côté de l'EV. Aujourd'hui on affiche `+8.4%` sans variance. Si la borne basse est négative, le bet est un piège.
- **Divergence modèle/marché en temps réel** : afficher le delta `cote_marché_courante − cote_modèle_no_vig` avec sa dérivée (pente sur 15 min). Le « pre-steam » est là.
- **Closing Line Value (CLV) historique** par stratégie : sur les 100 derniers paris d'une stratégie, quel CLV moyen ? C'est le seul vrai juge de la qualité du modèle.
- **Kelly fraction** suggérée par cellule (½ Kelly, ¼ Kelly) — actuellement disponible côté Mes Paris seulement.

**Ce qui est du bruit (Quant) :**
- **Buteurs** (col 8, 150px) : intéressant pour le grand public, peu d'EV. Déplacer en modale ou rendre toggleable.
- **Date/Heure** prend 55px (col 1) alors que 75% des matchs visibles sont du jour. Compresser en `H:MM`.
- **Forme L5** (col 4) : doublon partiel avec PowerScore (col 3). Décision : on garde un seul.

#### [LIVE-DATA-ANALYST] répond

> *"Le Quant a raison sur le bruit pre-match. Mais en live, **rien n'est dynamique** dans le tableau football. On a SSE actif, on reçoit `stats_frame`, mais on l'utilise pour mettre à jour des chiffres figés. Aucun **graphique temporel** dans la cellule. Aucun **arrow de momentum animé**. Aucune **alerte clignotante** quand un match bascule."*

**Ce qui manque (Live) :**
- **Sparkline de pression** (20 derniers points temporels) directement en cellule Match. SofaScore a un graphique d'attaque, mais hors-tableau. Ici, en cellule.
- **Indice de Fatigue temps réel** : minutes jouées L7 / charge moyenne × facteur déplacement. Existe en backend (fatigue index v9.0). Pas visible en tableau.
- **Score de Choke** : équipe favorite menant avant la 80', historique de tenue de score. Lié à Power Score V2 (roadmap CLAUDE).
- **Bascule de cote vs bascule de jeu** : afficher la corrélation cote/événement en live. Si but encaissé mais cote ne bouge pas → opportunité.

#### [FINTECH-UX-LEAD] tranche

> *"On a un terminal Bloomberg avec 9 colonnes. Bloomberg, c'est 6 colonnes principales et 1-2 widgets latéraux. **Notre œil ne sait pas où regarder**. Quand un trader Bloomberg ouvre son écran, il sait : prix au centre, volume à droite, news en bas. Ici : c'est plat. Aucune hiérarchie."*

**Ce qui doit changer (UX) :**
- **Hero column** : la colonne VALUE doit être 2× plus large, contrastée, et la SEULE colonne en couleur saturée. Le reste en monochrome neutre. **L'œil est attiré par la saturation.**
- **Sticky inversé** : sticky sur la colonne VALUE à droite, pas seulement sur le nom des équipes à gauche. Le trader cherche l'edge, pas le nom.
- **Densité ligne** : actuellement ~80px par ligne. Tradeoff : si on garde sparkline + chips, on doit accepter 100-110px. C'est OK si la hiérarchie est claire.
- **Mode condensé toggle** : un bouton `[Trading] / [Analyse]`. Mode Trading = 4 cols (Match, EV, Cote∆, Pression). Mode Analyse = 9 cols actuelles.

---

### 2.2 — TENNIS

#### [QUANT-TRADER] sur tennis

> *"16 colonnes, c'est trop. Mais paradoxalement, **chaque cellule a déjà un signal EV exploitable**. Le problème : on ne sait pas lequel privilégier. Quand DR_SPIKE déclenche et Set1 EV >5% et Total Jeux U convergent → c'est un triple signal. Aujourd'hui, on doit lire 3 cellules pour le voir. Il faut un **score agrégé visible**."*

**Ce qui manque (Quant Tennis) :**
- **Composite Bet Score** : agrégation pondérée (déjà calculée en backend via `_tvbPredScore`) — mais on n'affiche que les 3 chips finaux. Il faut un **gauge 0-100** en colonne dédiée.
- **EV decomposition** : sur les 6 marchés candidats (ML, Set1, Score sets, ≥1 set, Total Jeux, Aces), afficher en heatmap horizontale la répartition d'EV. Permet de voir si c'est concentré (HIGH conviction) ou éparpillé (LOW conviction).
- **Surface ELO différentiel** : Elo P1 — Elo P2 affiché en différentiel (∆Elo) plutôt qu'en chiffres absolus. Plus rapide à lire.
- **Time decay** : combien de temps reste avant le match ? Les EV se ferment rapidement sur tennis. Visible en chip "T-2h12m".

#### [LIVE-DATA-ANALYST] sur tennis

> *"Le tennis est NATIVEMENT live. DR par set, par jeu, par point. On a la donnée. **Mais où est la visualisation point-by-point ?** Pourquoi la colonne Score est un grid statique au lieu d'un **point-by-point sparkline horizontal** ? L'EV bouge à chaque point dans un set serré. Il faut le voir."*

**Ce qui manque (Live Tennis) :**
- **PBP sparkline** dans la cellule Score : courbe verticale par point dans le set en cours. Très haute densité, très lisible avec bonne palette.
- **DR Live ∆** : delta DR set en cours vs DR match. Existe (`tn-dr-delta`) mais sous-exploité visuellement. Doit clignoter si delta > seuil.
- **Service stat live** : % 1ers services réussis sur les 10 derniers, points gagnés sur 2nd service. Ces stats existent sur BSD/AiScore (qu'on intègre déjà).
- **Pression "break point"** : indicateur quand un joueur a 30% de chance ou + de break. Visuel : halo amber sur la cellule.

#### [FINTECH-UX-LEAD] sur tennis

> *"16 colonnes, sans hiérarchie. Mais surtout : **17 filtres en haut**. C'est l'erreur classique. Les filtres ne sont pas un menu, ils sont une carte de décision. Le parieur n'utilise probablement que 3-4 filtres récurrents. Le reste pollue. Idée : **profil de filtre personnel** sauvegardé (ATP-Clay-Live, WTA-GS-Sort-EV)."*

**Ce qui doit changer (UX Tennis) :**
- **Réduction des colonnes par défaut** : afficher 8 colonnes "Smart Default" (Match, Score live, Bets Prédictifs, EV, DR live, Surface/Tier, T-Restant, Confiance). Mode "Expert" pour les 16.
- **Filtres en accordéon** : 3 filtres rapides toujours visibles (Tour ATP/WTA, Surface, Live), reste replié.
- **Profils sauvegardés** : 3 slots utilisateur ("Pre-Match Clay", "Live Aces", "Surprise Spike").
- **Mobile** : table tennis 16 cols = catastrophe mobile. Card-view obligatoire en mobile, déjà partiellement fait mais à finaliser.

---

### 2.3 — Diagnostic transverse Foot + Tennis

| Problème | Foot | Tennis |
|---|---|---|
| Hiérarchie visuelle plate | ❌ | ❌ |
| Pas de signal directionnel temps réel | ❌ | ⚠️ Partiel (DR ∆) |
| Surcharge cognitive | ⚠️ Acceptable (9 cols) | ❌ Sévère (16 cols) |
| Borne IC absente du tableau | ❌ | ❌ |
| Divergence modèle/marché non visible | ❌ | ⚠️ Partiel (ML divergence) |
| Sparklines en cellule | ❌ | ❌ |
| Profils filtres sauvegardés | ❌ | ❌ |
| Mode condensé Trading vs Analyse | ❌ | ❌ |

---

## 3. ÉTAPE 2 — INNOVATIONS "GAME CHANGER"

### 3.1 — Foot & Tennis communs

#### INNOV-1 : **CONFIDENCE CORRIDOR** (borne IC en cellule)
À côté du chiffre EV (+8.4%), afficher un mini-segment horizontal `[IC90%]` rendu en mono :
```
EV  +8.4%  ├──●──┤  IC90% [+2.1 ; +14.7]
```
Si la borne basse < 0 → segment teinté ambre (warning piège).
Si > 0 → vert.
Permet une décision en 200ms sur la robustesse statistique.

#### INNOV-2 : **MARKET DIVERGENCE PULSE**
Lorsque la cote marché diverge du modèle de plus de X% en moins de Y minutes, la cellule **VALUE** pulse en néon (animation CSS 1.2s).
- Divergence positive (cote monte alors que modèle stable) → pulse cyan
- Divergence négative (cote chute, marché informé) → pulse amber
- Steam confirmé (>2 bookmakers bougent dans la même direction <5min) → pulse rouge.

Source : on a déjà le flux odds via SSE. Calcul backend = trivial.

#### INNOV-3 : **SPARKLINE EN CELLULE** (foot live + tennis pbp)
Format : SVG inline, 60px × 16px, 1 ligne mono couleur.
- **Foot** : pression d'attaque dom/ext sur les 15 dernières minutes (1 point par minute).
- **Tennis** : point-by-point du set en cours, hauteur = score différentiel.
- Hover sur sparkline → tooltip avec courbe agrandie.

Charge réseau : nulle (recalcul depuis stats déjà reçues).
Charge DOM : SVG 60px → léger.

#### INNOV-4 : **MODE DUAL Trading / Analyse**
Bouton `[Trading] / [Analyse]` en haut du tableau.
- **Trading** (par défaut pour Pro) : 4 cols Foot (Match, EV±IC, Cote∆, Pression) — 5 cols Tennis (Match, Score live PBP, Bet Score 0-100, DR ∆, T-Restant).
- **Analyse** : layout actuel.
- Toggle persistant en localStorage.

Pas d'impact sur les données, pure réorganisation CSS Grid via `data-mode`.

#### INNOV-5 : **PROFILS FILTRES SAUVEGARDÉS**
Slots utilisateur (3 par défaut + custom illimité Pro) :
- Tennis : "ATP Live Aces", "Clay GS Pre-Match", "WTA Comeback Spike"
- Foot : "Top 5 EV>5%", "Live <30min", "Dropping Odds Premier"
- Sauvegarde tous les filtres + le sort + le mode Trading/Analyse.

Backend : JSON kv par user_id. Trivial.

---

### 3.2 — Foot spécifique

#### INNOV-6 : **FATIGUE INDEX & TRAVEL FACTOR EN CELLULE**
Pastille colorée intégrée dans la colonne Rang (sous le PowerScore) :
- 🟢 Frais (< 4 jours dernier match, pas de déplacement)
- 🟡 Modéré (5-7 jours OU 1 déplacement EU)
- 🟠 Élevé (3+ matchs en 7 jours)
- 🔴 Critique (3+ matchs en 7 jours + déplacement intercontinental)

Backend : `computeFatigueIndex` existe (v9.0). Juste à exposer + colorer.

#### INNOV-7 : **CHOKE-O-METER**
Pour les favoris cotés < 1.50 menant après 70', historique de tenue de score sur 50 derniers cas similaires (même ligue, même écart de classement). Affiché en pastille discrète "🎯 Hold 82%" sur la ligne live.
- Si % < 60% → halo amber (favorite_trap).
- Trigger SSE alerte si match en live + favori mène + Hold < 65% → notification.

#### INNOV-8 : **CLV TRACKER PAR STRATÉGIE**
En footer du tableau, mini-card : pour la stratégie active, "CLV moyen 30 jours : +2.3%" (vert) ou "-0.8%" (rouge). C'est le KPI ultime de qualité du modèle, plus parlant que l'accuracy seule.

---

### 3.3 — Tennis spécifique

#### INNOV-9 : **BET SCORE GAUGE 0-100 + EV HEATMAP**
Nouvelle colonne "Bet Score" (remplace ou complète "Bets Prédictifs") :
- Gauge demi-circulaire 0-100 (vert > 65, amber 45-65, rouge < 45)
- En-dessous : heatmap horizontale 6 cellules (ML, S1, Sets, ≥1Set, Jeux O/U, Aces) — opacité proportionnelle à l'EV de chaque marché.
- Vue d'ensemble du potentiel d'un match en 200ms.

Backend : `_tvbPredScore` existe + `computeTennisPredictiveBets` calcule déjà tout. Pure UI.

#### INNOV-10 : **DR LIVE PULSE & ALERTE DR SPIKE**
Quand DR set en cours diverge du DR match de plus de 0.30 (proche d'un breakdown) :
- Cellule DR clignote (animation CSS 1.5s, cyan→amber).
- Push notification si abonné (Pro).
- Couplé à `_tnStrategyMatch('DR_SPIKE')` qui existe déjà comme filtre.

#### INNOV-11 : **BREAK POINT PRESSURE INDEX**
Indicateur live : probabilité que le joueur en réception break dans les 3 jeux suivants, basé sur :
- Pourcentage points gagnés sur 2nd service de l'adversaire (live)
- Historique du joueur sur cette surface
- Score actuel du set

Affiché : halo amber pulse sur la cellule du joueur en pression.

#### INNOV-12 : **SERVE DOMINANCE LIVE STREAM**
Sparkline mono des % 1ers services réussis sur les 10 derniers jeux, par joueur, dans la cellule Joueur. Donne en 1 coup d'œil la tendance service-side.

---

### 3.4 — Carte d'innovation comparative concurrence

| Innovation | Flashscore | SofaScore | OddsAlerts | PariScore (cible) |
|---|---|---|---|---|
| EV avec IC visible | ❌ | ❌ | ⚠️ Partiel | ✅ INNOV-1 |
| Market Divergence Pulse | ❌ | ❌ | ❌ | ✅ INNOV-2 |
| Sparkline en cellule | ❌ | ❌ (modal) | ❌ | ✅ INNOV-3 |
| Mode Dual Trading/Analyse | ❌ | ❌ | ❌ | ✅ INNOV-4 |
| Profils filtres | ❌ | ⚠️ (favoris) | ❌ | ✅ INNOV-5 |
| Fatigue Index visible | ❌ | ⚠️ | ❌ | ✅ INNOV-6 |
| Choke-O-Meter | ❌ | ❌ | ❌ | ✅ INNOV-7 |
| CLV Tracker | ❌ | ❌ | ⚠️ Pro | ✅ INNOV-8 |
| Bet Score Gauge tennis | ❌ | ❌ | ❌ | ✅ INNOV-9 |
| DR Live Pulse | ❌ | ⚠️ DR statique | ❌ | ✅ INNOV-10 |
| Break Point Pressure | ❌ | ❌ | ❌ | ✅ INNOV-11 |
| Serve Dominance live | ⚠️ Partiel | ⚠️ Partiel | ❌ | ✅ INNOV-12 |

**Différenciation forte sur 10 des 12 innovations. PariScore devient un produit unique sur le marché francophone et concurrentiel sur l'anglophone.**

---

## 4. ÉTAPE 3 — RAPPORT DÉTAILLÉ & ROADMAP PRIORISÉE

### 4.1 — Bilan critique synthèse

#### Ce qui fonctionne (à garder absolument)
1. **Edge dévigé Shin-Hurley** (col VALUE) — métrique différenciante, calibrée.
2. **Poisson + top 3 scores** (col Score prédictif Foot) — accessible, pédagogique.
3. **DR + DR par set chips** (Tennis col Match) — innovation v10.71+, à étendre.
4. **Predictive Bets engine 6 marchés** (Tennis col 3) — déjà best-in-class.
5. **Live Intensity 0-100** (Foot) — bonne base, à enrichir directionnellement.
6. **SSE pour les cotes** (Foot) — infra ready, sous-exploitée.
7. **Surface badge gradient** (Tennis col 1) — visuellement net.

#### Ce qui doit disparaître ou être déplacé
| Élément | Décision | Raison |
|---|---|---|
| Col **Buteurs** (Foot, 150px) | Déplacer en modale Insights | Faible EV pre-match, charge visuelle |
| Date complète (Foot col 1) | Compresser en `H:MM` + tooltip date | 75% des matchs sont du jour |
| Col **Forme** OU **Rang/PWR** (Foot) | Fusionner (form intégrée dans PowerScore) | Doublon partiel |
| Col **Mental** (Tennis 13) | Déplacer en tooltip de Set 2 | Faible scan visuel, donnée contextuelle |
| Col **King of Aces** (Tennis 9) | Mode Expert uniquement | Spécialiste, faible % de paris quotidiens |
| 17 filtres tennis dépliés | Accordéon (3 rapides + reste replié) | Surcharge cognitive |

#### Ce qui doit être refondu (pas supprimé, refait)
1. Col **VALUE** (Foot) → ajouter IC corridor inline + Market Divergence pulse.
2. Col **Bets Prédictifs** (Tennis) → ajouter Bet Score gauge 0-100 + EV heatmap 6 marchés.
3. Col **Score** (Tennis) → ajouter PBP sparkline pour matchs live.
4. Col **Match** (Foot) → ajouter sparkline de pression pour matchs live.
5. Col **Rang** (Foot) → ajouter Fatigue Index pastille.
6. Filtres tennis → accordéon + profils sauvegardés.
7. Layout global → ajouter toggle [Trading] / [Analyse].

---

### 4.2 — Roadmap DATA (Backend)

#### P0 — Quick wins (sprint 1, ~3 jours)
| Ticket | Métrique | Description | Source |
|---|---|---|---|
| BD-DATA-001 | **IC bornes inférieures** | Exposer en `/api/v1/matches` les bornes IC90% (low, high) pour chaque EV. Backend = recalcul Bootstrap déjà existant (`v10.x`) | Backend interne, 0 dépendance externe |
| BD-DATA-002 | **Fatigue Index foot par équipe** | Exposer le score 0-100 calculé par `computeFatigueIndex` (déjà existant v9.0) dans `home_fatigue` / `away_fatigue` | Backend |
| BD-DATA-003 | **Market Divergence delta** | Calculer en temps réel `cote_marché_courante − cote_modèle_no_vig` + pente sur 15 min. Émettre via SSE | SSE + cron 60s |
| BD-DATA-004 | **DR Live ∆ alerte** | Côté backend, émettre événement SSE `dr_spike` quand `DR_set_courant - DR_match > 0.30` | Backend tennis |

#### P1 — Innovations majeures (sprint 2, ~7 jours)
| Ticket | Métrique | Description | Source |
|---|---|---|---|
| BD-DATA-005 | **Choke-O-Meter** | Pour favoris menant après 70', calculer Hold% historique sur 50 cas similaires (même ligue, même écart classement) | DB historique + cron quotidien |
| BD-DATA-006 | **CLV par stratégie** | Pour chaque stratégie (top10 stratégies), calculer CLV moyen 30 jours = `(cote_initiale - cote_closing) / cote_closing × signe_pari` | Backend, exige snapshot odds à la closing |
| BD-DATA-007 | **Bet Score tennis composite** | Exposer le score agrégé déjà calculé par `_tvbPredScore` + decomposition EV par marché (heatmap) | Backend tennis pur, 0 dépendance |
| BD-DATA-008 | **Break Point Pressure** | Calculer P(break dans 3 jeux) = f(% pts gagnés 2nd serv adversaire live, historique surface, score) | Backend tennis, agrège stats BSD/AiScore |

#### P2 — Long terme (~2 semaines)
| Ticket | Métrique | Description | Source |
|---|---|---|---|
| BD-DATA-009 | **Travel Factor foot** | Distance déplacement match précédent → match courant, jet-lag, climat | API geo + saisie manuelle stades |
| BD-DATA-010 | **PBP point-by-point tennis stream** | Ingestion streaming complet point-by-point pour live (au lieu de pull 30s) | BSD WS ou SportRadar |
| BD-DATA-011 | **Closing Line Value tracker temps réel** | Système qui snapshot la closing line de chaque pari pour calcul CLV automatique | Backend + cron |
| BD-DATA-012 | **Steam detector multi-book** | Détection synchronisée de 2+ bookmakers qui bougent dans la même direction <5min | Polling Odds API + détection |

---

### 4.3 — Roadmap UI / UX

#### P0 — Refonte hiérarchie (sprint 1)
| Ticket | Composant | Description |
|---|---|---|
| UI-001 | **Hero Value Cell Foot** | Élargissement col VALUE à 2× (200px) + suppression couleur sur autres cols sauf alerte. Le seul élément saturé = l'EV |
| UI-002 | **IC Corridor inline** | Ajouter dans col VALUE un mini-segment IC90% `[+2.1 ; +14.7]` en mono 10px sous l'EV |
| UI-003 | **Mode Dual Trading/Analyse** | Toggle `[Trading]` / `[Analyse]` en haut tableau. Pure CSS Grid via `[data-mode="trading"]` |
| UI-004 | **Filtres Tennis Accordéon** | 3 filtres rapides visibles (Tour, Surface, Live), reste replié avec compteur de filtres actifs |
| UI-005 | **Mobile Card-View Tennis** | Refonte card-view mobile (existe partiellement) avec 6 KPI prioritaires |

#### P1 — Innovations visuelles (sprint 2)
| Ticket | Composant | Description |
|---|---|---|
| UI-006 | **Market Divergence Pulse** | Animation CSS sur cellule VALUE quand divergence détectée. 3 couleurs : cyan/amber/rouge selon type |
| UI-007 | **Sparkline en cellule Foot** | SVG inline 60×16px courbe pression dom/ext live, intégrée col Match |
| UI-008 | **PBP Sparkline Tennis** | SVG inline dans col Score, courbe point-by-point du set en cours |
| UI-009 | **Bet Score Gauge Tennis** | Demi-cercle 0-100 + heatmap 6 marchés horizontale dans col Bets Prédictifs |
| UI-010 | **DR Live Pulse** | Animation CSS sur `.tn-dr-delta` quand spike détecté (déjà existant en backend, à brancher) |
| UI-011 | **Fatigue Index pastille Foot** | Pastille couleur 12px sous PowerScore, tooltip détails (jours repos, charge L7, déplacement) |

#### P2 — Polish (~1 semaine)
| Ticket | Composant | Description |
|---|---|---|
| UI-012 | **Profils filtres sauvegardés** | Modal "Mes profils" + 3 slots par défaut + custom illimité Pro |
| UI-013 | **CLV Tracker footer** | Mini-card sticky footer table avec CLV stratégie active |
| UI-014 | **Choke-O-Meter** | Pastille `🎯 Hold X%` sur ligne live, halo amber si trap |
| UI-015 | **Break Point Pressure halo** | Halo amber CSS sur cellule joueur en pression de break |
| UI-016 | **Serve Dominance sparkline Tennis** | Sparkline % 1er service sur cellule Joueur |
| UI-017 | **Time-to-kickoff chip** | Chip `T-2h12m` dans col Date/Heure, avec actualisation 1s |

---

### 4.4 — Règles de lisibilité (les 500 millisecondes)

Pour respecter la règle de scan visuel < 500ms, chaque innovation respecte les contraintes suivantes :

| Contrainte | Implémentation |
|---|---|
| **Hiérarchie tri-couleur** | Saturation forte sur VALUE/EV uniquement. Reste en monochrome dark trading. Néon réservé aux alertes (divergence, DR spike, break point) |
| **Densité cellule max** | 3 éléments visuels max par cellule (1 chiffre + 1 chip + 1 sparkline OU 1 chiffre + 2 chips). Pas de 4 chips empilés |
| **Animations** | Max 2 animations actives simultanées par viewport. Désactivables via `prefers-reduced-motion` (déjà respecté CF v11.1) |
| **Typographie** | Mono 'DM Mono' pour chiffres (déjà fait). Sans-serif Inter/Poppins pour labels |
| **Tooltips** | Tout détail secondaire en tooltip (hover). Pas de "voir plus" required. Modal réservée aux deep-dives. |
| **Mobile-first** | Toute innovation testée en card-view 375px avant validation. Sparklines OK en 60×16px sur mobile |

---

### 4.5 — Estimation effort total

| Phase | Durée | Tickets | Risque |
|---|---|---|---|
| P0 Data + UI | ~5 jours | 4 + 5 = 9 | Bas (tout existe en backend) |
| P1 Data + UI | ~9 jours | 4 + 6 = 10 | Moyen (CLV exige refactor snapshot odds) |
| P2 Data + UI | ~10 jours | 4 + 6 = 10 | Moyen-haut (PBP streaming = nouvelle source) |
| **Total** | **~24 jours dev** | **29 tickets** | — |

Pour livraison cible : **fin juin 2026** (4-5 semaines), avec sprint 1 livré en preview internal d'ici 5 jours.

---

## 5. ÉTAPE 4 — TOP 3 RETENU POUR ARBITRAGE

### 🥇 TOP 1 — **MARKET DIVERGENCE PULSE + IC CORRIDOR**
**Pourquoi** : c'est la SEULE innovation qui transforme PariScore d'un outil d'analyse en un outil de décision temps réel. Un parieur pro voit immédiatement si l'EV est robuste (IC > 0) ET si le marché commence à se réajuster (pulse). Asymétrie d'information mise à nu.

**Effort** : P0 (5 jours dev) — IC bornes + market divergence backend + CSS pulse + IC corridor inline.

**KPI** : taux de clic sur VALUE cell × 3 ; temps de décision moyen / 2 (mesurable via analytics).

---

### 🥈 TOP 2 — **BET SCORE GAUGE 0-100 + EV HEATMAP TENNIS**
**Pourquoi** : 16 colonnes tennis aujourd'hui = surcharge. Un seul gauge composite + une heatmap horizontale 6 marchés résume tout le tableau actuel en 1 cellule de 200px. Permet de réduire les 16 cols à 8 en Smart Default sans rien perdre.

**Effort** : P1 (3-4 jours dev) — backend Bet Score exists déjà via `_tvbPredScore`, pure refonte UI cellule prédictive + heatmap SVG.

**KPI** : taux de fermeture du tableau réduit, temps moyen sur page tennis augmenté de 40%.

---

### 🥉 TOP 3 — **MODE DUAL Trading / Analyse + PROFILS SAUVEGARDÉS**
**Pourquoi** : résout en une fonctionnalité 2 problèmes UX majeurs (surcharge cognitive et profils utilisateurs hétérogènes). Le parieur Pro voit son trading dashboard ultra-condensé. Le parieur récréatif garde l'analyse riche. Aucune donnée perdue, juste réorganisation.

**Effort** : P0 (4 jours dev) — CSS Grid via `data-mode` + localStorage + 3 slots de profil + modal de gestion.

**KPI** : taux de rétention Pro × 1.5 ; NPS sur "facilité d'usage" passe de 7.2 à 8.5.

---

## ⏸️ EN ATTENTE D'ARBITRAGE DG

**Aucune modification n'a été appliquée au code.** Ce rapport est une proposition stratégique. Le DG (David) arbitre :

1. ✅ Quels des 3 TOPs valider (1, 2, 3 ou combinaison) ?
2. ✅ Quelle priorité P0/P1/P2 maintenir / réordonner ?
3. ✅ Quel sprint 1 lancer (5 jours) avant la mise à jour majeure ?
4. ✅ Quelles innovations rejeter (si effort > valeur perçue) ?

Le sprint 1 ne démarrera qu'après le "GO" explicite du DG sur les points ci-dessus.

---

*Rapport généré le 20 mai 2026 par Lead PM PariScore — panel virtuel (Quant-Trader, Live-Data-Analyst, Fintech-UX-Lead).*
*Source de vérité du code : pariscore.html (29 959 lignes) + server.js (28 499 lignes).*
*Aucune modification fichier source effectuée pendant la rédaction.*
