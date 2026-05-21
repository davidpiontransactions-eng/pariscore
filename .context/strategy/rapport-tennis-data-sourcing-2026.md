# 🎾 RAPPORT — Tennis Data Sourcing : Solution 100% Efficace

> **bd ParisScorebis-8uoc** — Brainstorm équipe 4 agents experts (Legal, Engineering Lead, Karpathy Réviseur, CTO)
> **Date** : 2026-05-21
> **Statut** : ⚠️ ATTENTE GO DG — décision compliance + budget requise
> **Auteur** : Claude (synthèse agents virtuels CLAUDE.md personas)

---

## 🚨 ALERT IMMÉDIATE — COMPLIANCE RISK ACTIF

**Découverte critique pendant brainstorm** : PariScore ingère **déjà** les CSV Jeff Sackmann (`tennis_atp` + `tennis_wta`) dans la table `tennis_matches` (server.js:15445+) avec rationale "server-side only, in-house Elo training, model outputs = œuvres dérivées".

**Verdict Legal** : ce raisonnement est INCORRECT.
- CC BY-NC-SA 4.0 "NonCommercial" couvre TOUT acte requérant permission copyright (reproduction sur VPS = déjà infraction)
- Pas de zone grise "usage interne" pour un SaaS payant (€19/mois)
- "ShareAlike" contamine les œuvres dérivées (Elo recalculé hérite NC-SA)
- EU Art. 4 TDM (Directive 2019/790) ne débloque PAS — la licence NC = opt-out valide

**Action immédiate requise DG** : décider GO/NO-GO migration vers source CC BY 4.0 ou licence commerciale Sackmann.

---

## 1. État des lieux actuel (post-rxh Phase 1+2+4)

| Source | Statut | Licence | Couverture | Risque legal |
|--------|--------|---------|------------|--------------|
| **ESPN public** (rxh Phase 1) | ✅ Live | Free undocumented | Match results + sets live | Faible |
| **BSD Tennis** (rxh Phase 2) | ✅ 14968 settled | Commercial $5/mo (déjà payé) | ML predictions + accuracy 62.9% | Aucun |
| **Sackmann CSV** (server.js:15445) | ⚠️ INGÉRÉ | **CC BY-NC-SA 4.0** | ATP+WTA 1968+, serve/return stats 1991+, 50 cols | **⛔ NC interdit SaaS commercial** |
| `computeTennisElo()` (server.js:15793) | ✅ V1 fonctionnel | — | Surface Elo (ALL/Hard/Clay/Grass), MoV multiplier, inactivity decay | Hérite contamination NC-SA |
| Odds API tennis | ✅ Markets | Commercial | Cotes live ATP/WTA | Aucun |

**Bilan** : architecture data riche, MAIS le pillier historique (Sackmann) est juridiquement incompatible avec le modèle commercial.

---

## 2. Brainstorm 4 axes — synthèse experts

### Axe A — Legal (Réglementation & Qualité)

**Verdict** : CC BY-NC-SA 4.0 ferme TOUTES les portes pour SaaS commercial :
- Usage interne : INTERDIT (CC FAQ + doctrine majoritaire)
- Transformation Elo : INTERDIT (ShareAlike contamine)
- EU Art. 4 TDM : opt-out via licence NC = valide (CC statement 2021)
- Fair Use US : facteur #4 (effet marché) défavorable SaaS payant
- Licence commerciale Sackmann : aucune offre publique, contact incertain (DM Twitter, prix arbitraire 2k-15k$/an estimation)

**Alternative trouvée — CC BY 4.0 (commercial OK)** :
- **Datahub.io ATP World Tour Tennis Data** — CC-BY-4.0, scores 1877-2017, rankings 1973-2017, stats 1991+
- Limite : pas de mise à jour depuis 2017 → compléter avec ESPN live (déjà en place)
- Attribution requise : footer + page `/about`
- **Coût juridique : 0 €**

### Axe B — Technique (Engineering Lead)

**Si licence permet** (hypothèse Sackmann GitHub raw OK) :
- URL pattern : `https://raw.githubusercontent.com/JeffSackmann/tennis_atp/master/atp_matches_<YYYY>.csv`
- Volume : 20 MB total ATP+WTA 2010-2026, 35 MB full 1968-2026
- GitHub raw = CDN backed, ~99.99% SLA, no auth, ETag support pour diff detection
- Effort intégration : 2 jours (déjà fait pour Sackmann, à porter vers Datahub)

**Anti-fragilité multi-source cascade** :
1. Primary : Datahub.io ATP/WTA CC-BY-4.0 (historique 1877-2017)
2. Backup : archive.org snapshot Datahub
3. Live : ESPN public + BSD (déjà en place)
4. Enrichment optionnel : api-tennis.com Premium (PBP + odds, voir Axe D)

**À écarter techniquement** :
- oddsportal.com / tennislive.net / tennisexplorer.com : Cloudflare anti-bot + ToS hostile
- Tennis Abstract HTML scraping : single hobbyist site, hérite NC Sackmann

### Axe C — Data Science (Karpathy Réviseur)

**Bombshell** : Sackmann CSV déjà ingéré, `computeTennisElo()` v1 déjà en prod. La question "comment récupérer Sackmann Elo" est mal posée — on a déjà les match results bruts pour computer notre Elo proprio.

**Feature importance (Klaassen-Magnus 2003, Kovalchik 2016)** :
1. Surface-adjusted Elo + recency decay (~67-70% accuracy single feature)
2. Service hold probability per-surface, opponent-adjusted
3. Recent form L10 with surface filter (+1-2% log-loss)
4. Fatigue (minutes 7d, sets 72h) (3-5% upset detection)

**80/20** : Elo-surface + serve/return + L10 form = ~85% du lift modèle. H2H, height, age, travel = <1% chacun.

**Vrai bottleneck PariScore tennis = calibration, pas data** :
- Backtest tennis sur l'historique disponible
- Compute Brier/log-loss par modèle
- Learn blend weights via isotonic regression
- Pas besoin de plus de sources, besoin de plus de rigueur

**Verdict Karpathy** : "Skip pulling Sackmann's Elo entirely; keep the raw match data (déjà fait), finish v2 Elo (decay+MoV+bayesian init), ship serve/return point-level from existing columns."

### Axe D — Stratégique (CTO)

**Matrice ROI top 5 sur 13 sources évaluées** :

| Rang | Source | Composite /40 | Action |
|------|--------|---------------|--------|
| 1 | Sackmann CSV | 39 | ⛔ migrer vers Datahub CC-BY |
| 2 | ESPN public | 34 | ✅ déjà live, garder |
| 3 | **api-tennis.com Premium** | 34 | 🎯 **À ADD** ($60/mo, PBP + odds) |
| 4 | Tennis Abstract scrape | 33 | ⛔ hérite NC, skip |
| 5 | MatchStat RapidAPI | 32 | exploiter mieux (déjà payé) |

**À rejeter** : Sportradar ($2k-10k+, overkill), UTR ($250 setup, ratings only), Goalserve ($150+, redondant), ATP/WTA scrape (legal block).

**Portfolio recommandé 3 sources diversifiées** :
| Layer | Source | Rôle | Coût/mo |
|-------|--------|------|---------|
| Primary historique | **Datahub CC-BY-4.0** + tennis-data.co.uk | Elo, serve/return backtest | 0 € |
| Primary live | **api-tennis.com Premium** | PBP + live odds + fixtures | 60 $ |
| Fallback live | ESPN public + BSD tennis ($5 payé) | Redondance | 0 € marginal |

**Total budget mensuel additionnel** : 60 $ (+5 $ BSD déjà payé)
**Time to MVP** : 2-3 semaines (1w api-tennis.com, 1w cascade refactor, 1w QA Roland-Garros)

**Lock-in strategy** : abstraction `tennisLiveProvider` interface dans server.js (`getLiveMatches/getMatch/getPBP`) → 3 implémentations swappables (api-tennis, ESPN, BSD) via env var. Vendor switch = 1 jour.

---

## 3. Recommandation finale (synthèse)

### Solution principale (recommandée)

**Plan A — Migration Compliance + Upgrade Live** :

1. **Phase 1 (compliance urgent, 1-2j)** :
   - ⛔ **Désactiver ingestion Sackmann CSV** (server.js _initTennisSackmannSchema + crons)
   - ✅ Implémenter ETL Datahub ATP/WTA CC-BY-4.0 (1877-2017)
   - ✅ Ajouter attribution "Data: Datahub.io ATP World Tour Tennis Data (CC BY 4.0)" en footer + /about
   - ✅ Purger table `tennis_matches` existante (rows Sackmann) — remplacer par Datahub
   - ✅ Recompute Elo from scratch sur corpus CC-BY uniquement

2. **Phase 2 (live PBP, 2-3 semaines)** :
   - 🎯 Souscrire api-tennis.com Premium (trial 14j d'abord pour valider data quality)
   - 🎯 Implémenter `tennisLiveProvider` abstraction
   - 🎯 Integrate PBP feed pour models live (3 features : pressure index, momentum, fatigue minute-by-minute)
   - 🎯 ESPN + BSD restent fallback redondance

3. **Phase 3 (calibration data science, 1 semaine)** :
   - 📊 Brier/log-loss backtest sur corpus Datahub
   - 📊 Blend weights isotonic regression (PariScore Elo + BSD ML)
   - 📊 Surface-specific tuning (Hard/Clay/Grass)
   - 📊 Karpathy recommandation prioritaire

**Coût total** : 60 $/mo + ~3-4 semaines dev
**Risque** : faible (sources éprouvées, code patterns déjà en place)

### Plan B (si DG veut éviter migration immédiate)

**Plan B — Achat licence commerciale Sackmann** :
- DM Jeff Sackmann (Twitter @jeffsackmann ou form Tennis Abstract)
- Demander quote licence commerciale annuelle
- Risque : pas de réponse, prix arbitraire, délai indéfini
- ⚠️ Maintien risque légal en attendant

### Plan C (minimaliste)

**Plan C — Build internal Elo from BSD only** :
- Skip Sackmann ET Datahub
- Compute Elo from BSD 14968 settled (cold-start ~6 mois, convergence ~1 an)
- Karpathy : "On a déjà la formule, suffit d'attendre la convergence"
- Pas de risque légal, pas de coût, mais accuracy initiale dégradée

---

## 4. Décisions DG requises

| Question | Options | Recommandation |
|----------|---------|----------------|
| **Compliance Sackmann ?** | Migrer (Plan A) / Acheter licence (Plan B) / Désactiver simple (Plan C) | **Plan A** (légal propre + data gold) |
| **Budget api-tennis.com Premium ($60/mo) ?** | OUI / NON / Trial 14j d'abord | Trial d'abord, conversion si validé |
| **Effort sprint 3-4 semaines acceptable ?** | OUI / Phaser sur 2 mois | OUI compliance urgent |
| **Attribution UI footer + /about acceptable ?** | OUI / Préfère licence payante | OUI (standard secteur) |

---

## 5. Métriques succès post-implémentation

- **Compliance** : 0 rows Sackmann dans tennis_matches, attribution Datahub visible footer/about
- **Coverage historique** : 100% matchs ATP+WTA 1877-2017 ingéres, gap 2017-2026 comblé par ESPN
- **Live PBP** : api-tennis.com integré sur ≥80% matchs Top 100 ATP/WTA
- **Modèle** : Brier tennis ≤ 0.21 sur backtest 2024-2026 (benchmark : BSD 62.9% baseline)
- **Latence live** : <3s end-to-end ingest → frontend

---

## 6. Annexes — sources consultées par agents

- [CC BY-NC-SA 4.0 — University of York Guide](https://subjectguides.york.ac.uk/creative-commons/by-nc-sa)
- [Creative Commons FAQ — NC use](https://creativecommons.org/share-your-work/cclicenses/)
- [TDM Article 4 — Kluwer Copyright Blog](https://legalblogs.wolterskluwer.com/copyright-blog/the-new-copyright-directive-text-and-data-mining-articles-3-and-4/)
- [CC Statement on TDM Exception Art 4 DSM](https://creativecommons.org/wp-content/uploads/2021/12/CC-Statement-on-the-TDM-Exception-Art-4-DSM-Final.pdf)
- [Datahub.io ATP World Tour Tennis Data (CC BY 4.0)](https://datahub.io/core/atp-world-tour-tennis-data)
- [JeffSackmann/tennis_atp](https://github.com/JeffSackmann/tennis_atp)
- [Tennis Abstract ATP Elo](https://www.tennisabstract.com/reports/atp_elo_ratings.html)
- [api-tennis.com](https://api-tennis.com/)
- [Sportradar Tennis v3](https://sharpapi.io/compare/sportradar-alternative)
- [UTR Engage API](https://www.utrsports.net/pages/engage-api)
- [tennis-data.co.uk](http://www.tennis-data.co.uk/)
- Klaassen & Magnus 2003 — "Forecasting the winner of a tennis match"
- Kovalchik 2016 — "Searching for the GOAT of men's tennis"

---

## 7. Statut bd

- **bd ParisScorebis-8uoc** : OPEN, attente GO DG
- **bd ParisScorebis-rxh** : Phase 3 Tennis Abstract = REMPLACÉ par Datahub CC-BY (Plan A)
- **bd ParisScorebis-bbul** : Kaggle wontfix confirme leçon licence NC
- **bd ParisScorebis-4cog** : Tennis Consolidation LOT P0 = bénéficiaire (Elo v2 sur Datahub corpus)
- **bd ParisScorebis-e3mr** : Tennis LOT P1+P2 (Brier + UQD) = bénéficiaire

**Nouveaux tickets à créer post-GO DG** :
- ⛔ P0 : "Compliance — désactiver ingestion Sackmann + purge table tennis_matches"
- ✅ P0 : "ETL Datahub ATP/WTA CC-BY-4.0 (historique 1877-2017)"
- 🎯 P1 : "api-tennis.com Premium integration (PBP + live odds)"
- 📊 P1 : "Brier backtest tennis + blend weights isotonic regression"

---

*Rapport généré par 4 agents experts virtuels (CLAUDE.md personas). Total tokens : ~282k. Total durée : ~7 min. Aucune décision exécutée — attente validation DG.*
