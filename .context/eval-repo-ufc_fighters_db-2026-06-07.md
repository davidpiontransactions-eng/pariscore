# Eval repo — jasonchanhku/ufc_fighters_db (2026-06-07)

GM/CTO eval. Source: https://github.com/jasonchanhku/ufc_fighters_db

## 1. Extraction
- **Type** : scraper Python (`scraper.py`, 6.7KB) tournant sur **morph.io**. 2022. Pas de modèle, pas de dataset committé (la sortie vit sur morph.io).
- **Scrape** : **Fightmetric** (= ufcstats.com) — profils combattants : career stats **SLpM / SApM / Str_Def / TD / Sub / record / name / nick** (le tale-of-the-tape ufcstats standard).
- **Métriques** : aucune (scraper).
- **Photos** : **aucune** (grep image/photo/url = vide).
- **Stack** : Python, requests/BeautifulSoup, Docker, morph.io. **Licence : AUCUNE** (null → tous droits réservés = flag legal).

## 2. Odds circulaire ? N/A (pas de modèle).

## 3. Analyse vs PariScore

| Critère | ufc_fighters_db | PariScore | Verdict |
|---|---|---|---|
| Données | ufcstats career stats (SLpM/SApM/StrDef/TD/Sub) | **déjà via komaksym MIT** (`.context/_mma_data/komaksym_fighter_details.csv`) | **redondant** |
| **Déjà testé** | ces mêmes stats career | **A/B fait → OVERFIT** (63.5→62.3, logloss↑) | **déjà échoué** |
| Photos | **0** | cascade UFC.com + ESPN | rien |
| Licence | **aucune** (ARR) | — | pire que komaksym (MIT) |
| Modèle/métrique | aucun | logistic+ensemble+devig | PariScore ✅ |
| Stack | Python morph.io scraper | Node zero-dep | NO-GO infra |
| Fraîcheur | 2022, morph.io (peut être mort) | sources à jour | stale |

## 4. Recommandation GM : **NO-GO** (3 raisons)
1. **Données redondantes ET déjà testées** : exactement les career stats ufcstats que j'ai déjà ingérées (komaksym MIT) et **A/B-testées → overfit** (verdict komaksym). Rien de neuf.
2. **Licence absente** (tous droits réservés) — pire que komaksym MIT pour la même data. Aucun intérêt à switcher vers une source ARR.
3. **Zéro photo, zéro modèle, scraper Python 2022** sur morph.io (probablement inactif).

**Effort : 0 — rien à prendre.**

## 5. Décision
**NO-GO.** 5e repo de la série. Même data ufcstats que komaksym (déjà éval + testée overfit), sans licence, sans photos, sans modèle. PariScore reste devant.

Attente : ton GO/NO-GO (défaut NO-GO, rien à implémenter).
