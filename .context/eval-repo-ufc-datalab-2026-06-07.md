# Eval repo — komaksym/UFC-DataLab (2026-06-07)

GM/CTO eval. Source: https://github.com/komaksym/UFC-DataLab

## 1. Extraction
- **Type** : repo de **DONNÉES** (pas de modèle, pas d'algo, pas de métrique prédictive). Scraping ufcstats + OCR scorecards (PaddleOCR) + EDA.
- **Modèle/algo** : aucun.
- **Données / outputs** (CSV committés, réutilisables directement) :
  - `stats_processed.csv` (2.6MB) — table décisive **delta winner−loser**, ~42 colonnes.
  - `stats_processed_all_bouts.csv` / `merged_stats_n_scorecards.csv` (4.2MB) — red/blue + `fight_outcome` + scorecards.
  - `SCORECARDS.csv` — **scores juges OCR** (`red/blue_total_pts` ex "29 28 28").
  - `raw_fighter_details.csv`.
- **Source** : ufcstats.com + ufc.com/scorecards. Update **trimestriel**.
- **Métriques** : aucune (data/EDA).
- **Stack** : Python, Scrapy, PaddleOCR, pandas, conda. **Licence : MIT** ✅ (classifieur GitHub confirme).

## 2. Odds circulaire ? N/A (pas de modèle).

## 3. Analyse vs PariScore
PariScore entraîne déjà sur **Greco1899 ufcstats (GPL-v3)** via `.context/_mma_data/`. komaksym = **même source ufcstats** MAIS :

| Critère | komaksym UFC-DataLab | PariScore actuel | Verdict |
|---|---|---|---|
| Licence data | **MIT** | Greco1899 **GPL-v3** (flag legal dans build) | **upgrade légal** ✅ |
| Stats brutes | ufcstats | ufcstats (Greco) | redondant |
| **Career advanced stats pré-calc** | `_cs`: SLpM, StrAcc, **SApM, StrDef, TDDef**, TDAvg, TDAcc, **SubAvg** | model utilise rolling-5 perso, **PAS** SApM/StrDef/TDDef/SubAvg | **NOUVEAU** ✅ |
| Grappling | `sub_att`, `rev` (reversals) | absent du model | **NOUVEAU** (= Ground Effectiveness thèse) |
| Striking positionnel | head/body/leg + distance/clinch/ground acc% & tar% | absent | nouveau (granulaire) |
| **Scorecards juges** | OCR (29-28…) | absent | nouveau mais **post-fight** (leakage si prédicteur → analytique only) |
| Modèle/edge | aucun | logistic+ensemble+devig | PariScore ✅ |
| Stack ingestion | Scrapy+PaddleOCR+conda | CSV statique Node | NO-GO pipeline (mais CSV output téléchargeable direct) |

## 4. Recommandation GM : **NO-GO pipeline / GO-PARTIEL données**
1. **NO-GO** sur le scraper/OCR Python (sidecar conda+PaddleOCR lourd ; ufcstats déjà droppé Cloudflare côté prod). Mais **inutile de le runner** : les CSV de sortie sont committés (MIT) → download direct.
2. **GO-PARTIEL (le meilleur à prendre)** : ingérer `stats_processed.csv` (MIT) et **A/B-tester les stats défensives career** que notre modèle n'a pas — surtout `StrDef`, `SApM`, **`TDDef`**, `SubAvg`, `sub_att`, `rev`. Ce sont les features prédictives standard (mmamodel.ai, thèse) absentes du 15-feat. **Plus prometteur que le test td_acc** (qui était ≈0) car défense + career-level.
3. **Bonus légal** : remplacer la source training Greco1899 (GPL-v3) → komaksym (MIT) = hygiène licence + updates trimestriels.

**Effort** : moyen (~1-2h) — parser le CSV komaksym (sep `;`, schéma delta red/blue), mapper vers `build_mma_model.js`, A/B vs 63.5%, propagation 3 fichiers SI gain. Scorecards = piste UI/analytique séparée (basse prio, pas prédicteur).

## 5. Décision
Repo data = **GO-PARTIEL** : vaut le coup pour (a) **stats défensives/career** (A/B à lancer — vraie chance de battre 63.5%), (b) **licence MIT**. Scraper/OCR/scorecards-predictor = NO-GO.

Différence clé vs eval précédent (calicartels) : ici il y a de **vraies features inédites** (défense, sub, reversals) — un A/B justifié, pas juste redondance.

Attente : ton GO/NO-GO pour lancer l'A/B (ingestion komaksym + features défensives career).
