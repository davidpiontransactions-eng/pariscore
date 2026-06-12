# POC xvalue.ai — Rapport d'exploration

**Issue**: ParisScorebis-qyfr  
**Date**: 2026-06-12  
**Status**: RECHERCHE TERMINÉE — synthèse ci-dessous

---

## 1. Qu'est-ce que xvalue.ai ?

xvalue.ai = plateforme de **Soccerment** (Italie, fondée 2017). Cible : clubs pros (Torino FC, Parma, Inter Milan, Ferencvaros), médias (Sky Sport, DAZN), agences (Roc Nation). Pas un simple fournisseur de xG — une suite analytics complète avec **ML clustering**, **IA générative** (AIDA), et **scouting** automatisé.

### Produits

| Module | Description |
|---|---|
| **Game Analysis** | Match preview/report 25+ pages, shot maps, xT heatmaps, xG timelines |
| **Team Analysis** | Rapport saison 60+ pages, analysis offensive/défensive/set-pieces |
| **Player Analysis** | Clustering ML, smart rankings, rapport 15+ pages, rôles tactiques |
| **AI Scouting (AIDA)** | Génération de shortlists et rapports par prompt IA |
| **API Service** | REST — stats avancées joueurs/équipes/ligues, saison + per-match |

### Métriques propriétaires

| Métrique | Description |
|---|---|
| **xG** | Expected Goals (shot quality, contexte positionnel) |
| **xA** | Expected Assists (passe décisive probable) |
| **xOVA** | Expected Offensive Value Added (contribution offensive isolée) |
| **xGoT** | Expected Goals on Target (qualité de tir/gardien) |
| **xPass** | Expected Passes (qualité de passe au-dessus de la moyenne) |
| **npxG** | Non-penalty xG |
| **Clustering ML** | Profilage joueur par rôles tactiques cachés |

### Couverture

- **30+ ligues** (Big 5 + Championship, Serie B, 2.Bundesliga, Eredivisie, Primeira Liga, Super Lig, Jupiler Pro, MLS, Argentina, Brazil, Saudi Pro League...)
- **680+ équipes**, **15K+ joueurs**, **250+ stats**

---

## 2. Fit avec ParisScore

### Ce que xvalue apporte QUE BSD n'a PAS

| Manque BSD | Apport xvalue | Impact PariScore |
|---|---|---|
| xG de surface basique (un seul chiffre par mi-temps) | **xG per-shot** + contexte positionnel + qualité d'occasion | Poisson plus précis, calibration fine |
| Pas de clustering ML | **Profils joueurs par cluster** (rôle tactique sous-jacent) | Player Props, "Fiche Quant" joueur, différentiation produit |
| Pas de xA/xOVA/xGoT/xPass | **Métriques avancées complètes** | Analyse plus riche, nouveaux signaux pour Power Score |
| Pas d'IA générative | **AIDA** — rapports automatisés en NL | Contenu SEO auto-généré |
| Pas d'API scouting | **API scouting endpoint** | Pipeline recommandation joueurs |

### xG xvalue vs xG BSD : qui est meilleur ?

- **BSD** : xG opaque (pas de publication de leur modèle). xG live pendant match. Suffisant pour calcul Poisson.
- **xvalue** : modèle **public et documenté** (Soccerment publie sa méthodologie). Contexte positionnel + angle + distance + type de tir + assister. **Probablement plus précis** que BSD (Soccerment est un pure-player analytics, pas un agrégateur).
- **Benchmark à faire** : corrélation xG xvalue vs xG BSD sur 30 matchs Big 5.

### Coût estimé

| Période | Coût |
|---|---|
| Free trial | 1 jour (platform UI, pas clair si API key programmable) |
| Pricing API | **NON PUBLIÉ** — "contact sales" |
| Estimation startup tier | $50-300/mo (spike `ffh` §6) |
| Estimation entreprise | €5K-50K+/an (clients: Sky Sport, DAZN, clubs Serie A) |

**Risque principal** : pricing complètement opaque. Peut être un blocker budget.

---

## 3. Analyse critique — Pourquoi c'est probablement NO-GO

### ⚠️ Problème Nº1 : Pas de "1 jour gratuit API"

La page xvalue.ai **ne propose pas d'API key en self-service**. Le "free trial" concerne la **platform web** (UI analytics), pas un endpoint REST programmable. Pour l'API, il faut **remplir un formulaire de contact** et parler à leur sales.

**Conclusion** : le "1 jour gratuit" de l'issue n'existe probablement pas pour l'API. C'est un lead gen B2B.

### ⚠️ Problème Nº2 : Pricing enterprise

Clients affichés : Sky Sport, DAZN, Roc Nation, Torino FC, Inter Milan. Ce ne sont pas des startups SaaS à €19/mo. Le pricing API sera calibré pour des **budgets clubs/médias**, pas pour un projet solo.

### ⚠️ Problème Nº3 : Stack actuel déjà fonctionnel

BSD fournit déjà :
- xG live + historique
- Shotmap par minute
- Incidents temps réel
- Stats avancées (corners, possession, tirs)
- Lineups

Le gain marginal de xvalue serait surtout sur :
- **xOVA/xGoT/xPass** (métriques fines) → utile pour *Player Props* et *Fiche Quant* (roadmap future)
- **Clustering ML** → différenciation produit

### ⚠️ Problème Nº4 : Déjà évalué — jamais actionné

Le spike `ffh` (22 mai 2026) a déjà noté xvalue **85/100 GO POC** — mais n'a jamais été exécuté car :
- Pas d'API key self-service
- Pricing inconnu
- Effort POC ~1j pour un résultat incertain

---

## 4. Si GO malgré tout — Plan d'intégration minimal

Ce plan est **conditionnel** à l'obtention d'un accès API gratuit ou d'un pricing < $100/mo.

### Architecture

```
services/xvalueService.js
  ├── fetchMatchXG(matchId)     → xG per-shot + cumul home/away
  ├── fetchTeamSeason(teamId)   → xG/xA/xOVA/xGoT saison
  ├── fetchPlayerProfile(playerId) → clustering + advanced metrics
  └── compareXG(bsdXg, xvalueXg) → divergence report
```

### Endpoints à appeler (estimés, docs pas publiques)

```
GET /api/v1/matches/{id}/xg         → per-shot xG
GET /api/v1/teams/{id}/season       → seasonal advanced metrics
GET /api/v1/players/{id}/profile    → clustering + advanced metrics
GET /api/v1/scouting/shortlist      → AI-generated scouting
```

### Bénéfice potentiel

| Métrique | Avant (BSD seul) | Après (+xvalue) |
|---|---|---|
| xG match | 1 scalaire mi-temps | per-shot, contexte, quality grading |
| Prédiction Poisson | Mean Absolute Error ~0.45 buts | Cible ~0.38 buts (amélioration ~15%) |
| Player Props | Impossible (pas de données joueur) | Clustering + advanced metrics |
| Différenciation produit | "Encore un site de pronos" | "IA + ML scouting + clustering" |

### Effort

- **POC** : 4-6h (offline, 30 matchs sample)
- **Prod** : 2-3j (service + cache 24h + UI badge source)

---

## 5. RECOMMANDATION FINALE

### ⚠️ NO-GO (réserve levée si pricing < $100/mo)

**Raisons :**

1. **Pas d'API self-service** — nécessite contact commercial, pas de "1j gratuit" programmable
2. **Pricing inconnu** — probablement enterprise (€5K+/an), hors budget PariScore
3. **Déjà évalué** (spike `ffh`, 85/100) — jamais actionné car ces mêmes blocages
4. **BSD fait le job** pour le use case actuel (xG → Poisson → pronostics)
5. **xvalue serait utile pour** Player Props + Fiche Quant — mais ces features ne sont pas encore roadmap P0

### Si tu veux vraiment explorer → plan B plus pragmatique

Au lieu de contacter le sales xvalue sans visibilité pricing :

1. **FBref via soccerdata** (déjà spike `8lqf`, pattern Python batch) — xG Opta-grade **gratuit**, latence 1-2h acceptable pour batch nocturne
2. **Puis xvalue plus tard** quand Player Props devient priorité produit et que le budget existe

### Si tu décides GO malgré tout

Étapes :
1. Remplir formulaire API → obtenir pricing
2. Si < $100/mo → POC 30 matchs, comparer xG vs BSD
3. Si corrélation > 0.85 ET metrics inédits utiles → intégration prod 2-3j

---

*Rapport généré pour ParisScorebis-qyfr. S'appuie sur : websearch xvalue.ai, exploration site, spike `ffh` existant, codebase audit.*
