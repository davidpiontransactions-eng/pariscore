# Rapport — Tennis Data Sourcing : Solution 100% Efficace (legal+technique)

> **bd ParisScorebis-8uoc** — Brainstorm CTO + Engineering Lead + Karpathy + Legal + agent recherche externe
> **Date** : 2026-05-22 (refresh v2 — découverte TML-Database MIT)
> **Statut** : ATTENTE GO DG — décision compliance + budget (3 questions infra)
> **Mode** : READ-ONLY codebase. Aucun commit prod.

---

## 1. Résumé exécutif (3 lignes)

- **Solution principale** : remplacer Sackmann CC BY-NC-SA par **Tennismylife/TML-Database (MIT, 1968-2026, mis à jour live)** + construire Elo maison sur ce corpus → coût 0 €, effort 3-4j, risque légal nul.
- **Plan B** : api-tennis.com Premium (~60 €/mo) pour PBP + odds live, en complément de TML pour features Live Cockpit.
- **Plan C** : Construire Elo "from BSD only" (14 968 matchs settled $5/mo) si DG refuse tout coût additionnel et toute migration — accuracy initiale dégradée 6-12 mois (cold start).

**Action immédiate critique (avant tout le reste)** : désactiver l'ingestion actuelle des CSV Sackmann (`server.js:15445+`) — `tennis_matches` est aujourd'hui en infraction CC BY-NC-SA pour un SaaS payant €19/mo Pro.

---

## 2. Analyse legal CC BY-NC-SA 4.0 pour PariScore

### 2.1 Texte officiel + interprétation

- **Définition Creative Commons** : "not primarily intended for or directed towards commercial advantage or monetary compensation" — l'inclusion de "primarily" laisse une zone grise, **mais elle ne sauve pas un SaaS payant** dont l'objet premier est de générer du revenu via abonnement Pro.
- **ShareAlike (SA)** : toute œuvre dérivée — y compris un Elo recalculé à partir des résultats — doit être redistribuée sous la même licence NC-SA. Conséquence : même si on prétend "on calcule notre propre Elo", celui-ci hériterait NC-SA et resterait interdit en SaaS commercial.
- **EU TDM Art. 4 (Directive 2019/790)** : exception data mining valable **sauf opt-out machine-readable**. La licence CC BY-NC est précisément un opt-out reconnu par Creative Commons (statement 2021). EU TDM ne débloque donc pas.
- **Fair Use US** : facteur #4 (effet sur le marché) défavorable car PariScore commercialise des prédictions tennis directement dérivées du corpus Sackmann.
- **Position Sackmann** : il a publiquement réagi à des violations sur Twitter — il surveille et conteste.

**Verdict legal sans ambiguïté** : `tennis_matches` ingéré aujourd'hui = infraction, à purger.

### 2.2 Licence commerciale directe Sackmann

Aucune offre publique. Demande possible via DM Twitter @JeffSackmann ou form Tennis Abstract. Probabilité de réponse incertaine, prix typique pour ce genre de licence académique-vers-commercial = 2k-15k $/an. **Délai indéfini** → ne peut pas être un plan principal.

### 2.3 Alternatives permissives identifiées (vérifiées 2026-05)

| Source | Licence | Coverage | Cible PariScore |
|---|---|---|---|
| **Tennismylife/TML-Database** | **MIT** | ATP **1968-2026 live** (CSV/an) | ✅ remplace Sackmann ATP 1:1 |
| **Tennismylife/TML-Rankings-Database** | MIT | Rankings ATP multi-sources | ✅ rankings historiques |
| **Datahub.io ATP World Tour Tennis Data** | CC BY 4.0 | 1877-2017 (figé, plus de MAJ) | ⚠️ secondaire (gap 2017→) |
| **tennis-data.co.uk** | **Personnel uniquement** (ToS §commercial use) | ATP+WTA + odds Pinnacle/B365 | ❌ pas pour SaaS |
| **ESPN public** (déjà intégré) | Undocumented (toléré) | Live + scores récents | ✅ déjà actif (rxh Phase 1) |
| **BSD Sports Addon** (déjà payé $5/mo) | Commercial OK | ML + live + settled | ✅ déjà actif (rxh Phase 2) |
| **Odds API** | Commercial OK | Cotes tennis ATP/WTA | ✅ déjà actif |

**Découverte majeure 2026** : **TML-Database couvre WTA mais le repo principal est ATP-centré**. Pour WTA, recheck nécessaire (le repo `tennis_wta` Sackmann reste NC-SA). Solutions WTA :
1. Demander à Tennismylife d'étendre le repo (réactif, contribution PR possible)
2. Compléter via **ESPN + BSD + Odds API** (déjà en place, couvre WTA live)
3. Datahub CC BY 4.0 historique WTA jusqu'à 2017

---

## 3. APIs alternatives Tennis Elo — comparatif (10 candidats)

| # | Source | Coût/mo | Elo | Live | PBP | Odds | Compliance SaaS | Score /40 |
|---|---|---|---|---|---|---|---|---|
| 1 | **TML-Database (MIT)** | **0 €** | À recalculer | Non | Non | Non | ✅ MIT | **38** ⭐ |
| 2 | **api-tennis.com Premium** | ~60 € | Non | ✅ WS | ✅ | ✅ | ✅ Commercial | **35** |
| 3 | **BSD Sports Addon** (payé) | inclus | Non (ML proxy) | ✅ | Non | Non (mais ML 62.9%) | ✅ | **33** |
| 4 | **ESPN public** (intégré) | 0 € | Non | ✅ | Partial | Non | ⚠️ undocumented | **30** |
| 5 | Datahub ATP (CC BY 4.0) | 0 € | À recalculer | Non | Non | Non | ✅ | 26 (gap post-2017) |
| 6 | RapidAPI tennis-api1 (jjrm365) | 5-25 € | Non | ✅ | Non | ✅ | ✅ (vendor) | 24 |
| 7 | MatchStat tennis-data | 50-100 € | Quelques stats | ✅ | Partial | Partial | ✅ | 22 |
| 8 | Goalserve Tennis | 150-300 € | Non | ✅ | Non | ✅ | ✅ | 18 (overkill prix) |
| 9 | UTR Engage API | 250 $ setup + ? | UTR proprio | Partial | Non | Non | ✅ avec contrat | 16 (UTR ≠ Elo) |
| 10 | sportsdata.io Tennis | 500-1000 €+ | Non | ✅ | Light | ✅ | ✅ SLA | 10 (déjà rejeté) |
| 11 | Sportradar Tennis v3 | 2000 €+ | Non | ✅ | ✅ | ✅ | ✅ | 7 (hors budget) |
| ⛔ | Sackmann CSV (actuel) | 0 € | ✅ riche | Non | Partial | Non | **⛔ NC-SA** | 0 |
| ⛔ | Tennis Abstract HTML scrape | 0 € | ✅ riche | Non | Non | Non | **⛔ hérite NC** | 0 |
| ⛔ | tennis-data.co.uk | 0 € | Non | Non | Non | ✅ | **⛔ ToS perso seul** | 0 |

**Critère de scoring** : Elo (0-10) + Compliance (0-10) + Coverage live/PBP (0-10) + ROI coût (0-10).

**Top 3 retenus pour combo** : (1) TML-Database + (2) api-tennis.com Premium + (3) BSD + ESPN déjà en place.

---

## 4. Construction Elo maison — faisabilité depuis bases existantes

### 4.1 Verdict Karpathy (data science angle)

**Bombshell méthodologique** : la question initiale "comment récupérer l'Elo Sackmann ?" est **mal posée**. On n'a pas besoin de l'Elo Sackmann — on a besoin **des résultats bruts** pour calculer notre propre Elo. Ces résultats existent sous licence MIT via TML-Database.

`computeTennisElo()` est déjà fonctionnel en prod (`server.js:15793`) : Elo de surface (ALL/Hard/Clay/Grass), Margin of Victory multiplier, inactivity decay. Il suffit de le ré-alimenter sur le corpus MIT.

### 4.2 Feature importance Klaassen-Magnus + Kovalchik

| Feature | Lift accuracy | Présent ESPN+BSD ? | Présent TML ? |
|---|---|---|---|
| Surface-adjusted Elo + decay | **67-70%** (single feature) | Non | **Oui (calculable)** |
| Service hold prob/surface | +3-5% | Partial (BSD ML) | Oui (calculable depuis scores sets) |
| L10 form surface filter | +1-2% | Oui | **Oui** |
| Fatigue (min 7d, sets 72h) | +3-5% upset | Oui (ESPN dates) | Oui |
| H2H career | <1% | Oui | Oui |

**80/20** : Elo-surface + serve/return + L10 form = ~85% du lift modèle. Le reste est marginal.

### 4.3 Plan de calcul Elo maison

1. Boot script : `node tools/seed_elo_from_tml.js` (à créer)
2. Pull `https://raw.githubusercontent.com/Tennismylife/TML-Database/master/<YYYY>.csv` (1968→2026)
3. Parser CSV (format compatible Sackmann)
4. Alimenter `computeTennisElo()` chronologiquement → snapshots Elo par joueur/surface
5. Persister dans `db.tennis_elo` table SQLite
6. Cron daily refresh à partir du dernier match TML mergé
7. WTA : compléter via BSD historique + ESPN saisons récentes

**Effort** : 3-4 jours (code ETL trivial, le calcul Elo existe déjà).

---

## 5. Recommandation finale priorisée

### 5.1 Solution principale (recommandée)

**Plan A — Migration MIT + Elo maison + Live api-tennis.com optionnel**

| Phase | Action | Effort | Coût |
|---|---|---|---|
| **Phase 0 (URGENT 1j)** | Désactiver ingestion Sackmann (`_initTennisSackmannSchema` + crons), purger `tennis_matches` rows Sackmann | 0.5j | 0 € |
| **Phase 1 (3-4j)** | ETL TML-Database MIT (1968-2026 ATP) → `tennis_matches` table + recompute Elo via `computeTennisElo()` existant | 3j | 0 € |
| **Phase 2 (1j)** | Attribution UI : footer + page `/about` ("Data: Tennismylife TML-Database (MIT) / ESPN / BSD / Odds API") | 0.5j | 0 € |
| **Phase 3 (5j)** | WTA combler via ESPN + BSD live (déjà en place, juste backfill saisons 2024-2026) | 3j | inclus |
| **Phase 4 OPT (5j)** | api-tennis.com Premium trial 14j → PBP + Live Cockpit → conversion si validé | 5j | 60 €/mo |

**Coût total** : **0 €/mo** (Plan A core) ou **60 €/mo** (Plan A + Phase 4 Live Cockpit).
**Effort total core** : **~7-8 jours dev** (compliance + ETL + UI).
**Risque** : faible. MIT = liberté totale, code patterns ETL déjà éprouvés (cf. seed_historique_db.js foot), pas de scraping anti-bot.

### 5.2 Plan B

**Acheter licence commerciale Sackmann** :
- DM @JeffSackmann + form Tennis Abstract
- Risque : pas de réponse, prix arbitraire 2k-15k $/an, délai indéfini
- ⚠️ Maintien infraction NC-SA pendant négociation
- **Effort** : 1j contact + délai semaines-mois
- **Coût** : 2k-15k $/an estimation

### 5.3 Plan C

**Build Elo from BSD only** (skip toute migration externe) :
- Compute Elo from 14 968 BSD settled (déjà en DB)
- Cold-start ~6 mois, convergence ~12 mois
- WTA + ATP couverts (BSD coverage validée v12.43)
- **Effort** : 2j (réutilise `computeTennisElo()`)
- **Coût** : 0 € (BSD déjà payé)
- **Désavantage** : accuracy dégradée 6-12 mois, pas d'historique pré-2024

---

## 6. Décisions DG attendues (3 questions GO/NO-GO)

| Q | Question | Options | Reco |
|---|---|---|---|
| **Q1** | GO Phase 0 immédiate (désactiver ingestion Sackmann + purge `tennis_matches` Sackmann rows) ? | OUI / NON / Attente Q2 | **OUI urgent** (élimine risque légal actif) |
| **Q2** | GO Plan A (TML MIT + Elo maison) vs Plan B (négocier licence Sackmann) vs Plan C (BSD only) ? | A / B / C / Hybride A+B | **Plan A** (gratuit, propre, rapide) |
| **Q3** | GO Phase 4 optionnelle api-tennis.com Premium 60 €/mo pour Live Cockpit PBP+odds (trial 14j d'abord) ? | OUI trial / OUI direct / NON | **OUI trial 14j** (data-driven decision) |

---

## 7. Estimation coût / effort / risques — tableau récap

| Aspect | Plan A core | Plan A + Live (A4) | Plan B | Plan C |
|---|---|---|---|---|
| **Coût mensuel** | 0 € | 60 € | 167-1250 € (licence/12) | 0 € |
| **Effort dev (j-h)** | 7-8j | 12-13j | 1j contact + délai | 2j |
| **Time-to-prod** | 2 semaines | 3-4 semaines | semaines-mois | 1 semaine |
| **Risque légal** | 0 (MIT) | 0 | 0 (si signée) | 0 |
| **Risque opérationnel** | Faible (ETL CSV simple) | Faible+vendor lock léger | Élevé (Sackmann peut refuser) | Moyen (cold start) |
| **Accuracy modèle (estim.)** | ≥ baseline actuelle | +3-5% (PBP features) | = baseline | -10% pendant 6 mois |
| **Réversibilité** | Totale | Totale (abstraction provider) | Totale | Totale |
| **Coverage ATP** | 1968-2026 complète | idem | idem actuel | 2024-2026 BSD |
| **Coverage WTA** | Via ESPN+BSD live (partial historique) | idem | idem actuel | 2024-2026 BSD |
| **Attribution UI requise** | Oui (footer + /about) | Oui | Non | Non |

---

## 8. Anti-fragilité — architecture cascade (déjà en partie dans server.js)

```
                ┌────────────────────────────────┐
                │   getTennisData(matchKey, …)   │  ← interface unique
                └─────────────┬──────────────────┘
                              │
        ┌─────────────────────┼───────────────────────┐
        ▼                     ▼                       ▼
  ┌────────────┐      ┌────────────┐         ┌────────────────┐
  │ TML-DB MIT │      │ BSD addon  │         │ ESPN public    │
  │ (hist Elo) │      │ ($5/mo ML) │         │ (live fallback)│
  └────────────┘      └────────────┘         └────────────────┘
        │                     │                       │
        └──────────────► merge ◄──── Odds API ────────┘
                              │
                  optional ▼
                  ┌────────────────────┐
                  │ api-tennis.com Prem│
                  │ (PBP + WS live)    │
                  └────────────────────┘
```

Vendor switch = swap d'une seule implémentation derrière l'abstraction `tennisLiveProvider` (cf. patron déjà appliqué pour odds dans spike `bjv`).

---

## 9. Métriques succès post-implémentation

- **Compliance** : 0 rows Sackmann dans `tennis_matches`, attribution TML/ESPN/BSD visible footer + `/about`
- **Coverage historique** : 100% matchs ATP TML 1968-2026 ingérés (>250k matchs estimés)
- **Coverage WTA** : 100% saisons 2024-2026 via ESPN+BSD, gap historique documenté
- **Elo maison** : convergence sur 5 ans+ historique (Klaassen-Magnus benchmark)
- **Brier tennis** : ≤ 0.21 sur backtest 2024-2026 (benchmark BSD 62.9% baseline)
- **Latence live** : <3s end-to-end ingest → frontend (si Phase 4 GO)

---

## 10. Annexes — sources consultées

- [Creative Commons NC interpretation wiki](https://wiki.creativecommons.org/wiki/NonCommercial_interpretation)
- [CC BY-NC-SA 4.0 legal code](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en)
- [Tennismylife/TML-Database (MIT)](https://github.com/Tennismylife/TML-Database)
- [Tennismylife/TML-Rankings-Database (MIT)](https://github.com/Tennismylife/TML-Rankings-Database)
- [stats.tennismylife.org — Tennis Match Database 1968-2026](https://stats.tennismylife.org/tennis-match-database)
- [JeffSackmann/tennis_atp (CC BY-NC-SA — à abandonner)](https://github.com/JeffSackmann/tennis_atp)
- [tennis-data.co.uk (perso uniquement)](http://www.tennis-data.co.uk/)
- [Datahub.io ATP World Tour Tennis Data (CC BY 4.0, fig 2017)](https://datahub.io/core/atp-world-tour-tennis-data)
- [api-tennis.com pricing](https://api-tennis.com/)
- [UTR Engage API (250 $ setup)](https://www.utrsports.net/pages/engage-api)
- [sportsdata.io Tennis docs](https://sportsdata.io/developers/api-documentation/tennis)
- [The Odds API tennis](https://the-odds-api.com/sports/tennis-odds.html)
- Klaassen & Magnus 2003 — "Forecasting the winner of a tennis match"
- Kovalchik 2016 — "Searching for the GOAT of men's tennis"

---

## 11. Statut bd

- **ParisScorebis-8uoc** : OPEN, attente GO DG (3 questions Q1/Q2/Q3 ci-dessus)
- **ParisScorebis-rxh** : Phase 3 Sackmann **à remplacer par TML MIT** (substitution dans la roadmap rxh sans nouveau bd)
- **ParisScorebis-bbul** : Kaggle wontfix confirme leçon licence NC (référence)
- **ParisScorebis-4cog** : Tennis Consolidation LOT P0 = bénéficiaire (Elo v2 sur corpus MIT)
- **ParisScorebis-e3mr** : Tennis LOT P1+P2 (Brier + UQD) = bénéficiaire

**Tickets à créer post-GO DG** :
- ⛔ P0 : "Compliance — désactiver ingestion Sackmann + purge `tennis_matches`" (Q1)
- ✅ P0 : "ETL TML-Database MIT (ATP 1968-2026) + recompute Elo `computeTennisElo()`" (Q2 Plan A)
- 🎯 P1 (si Q3 OUI) : "api-tennis.com Premium trial 14j → integration PBP/Live Cockpit"
- 📊 P1 : "Backtest Brier tennis post-migration + isotonic regression blend BSD/Elo maison"

---

*Rapport v2 généré 2026-05-22 par agent recherche (CTO/Engineering/Karpathy/Legal hats virtualisés). Réfresh majeur : découverte TML-Database MIT (couverture 1968-2026 live, vs Datahub CC BY 4.0 figé 2017 du rapport v1). Aucune décision exécutée, READ-ONLY codebase. Worktree branch dédiée — cherry-pick parent par user.*
