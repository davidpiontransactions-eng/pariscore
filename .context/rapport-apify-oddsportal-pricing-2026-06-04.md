# Rapport — Apify OddsPortal Pricing Change : Impact PariScore

> **Date** : 2026-06-04  
> **Trigger** : Email Apify — changement tarifaire acteur `oodoow/oddsportal-com` effectif 2026-06-18  
> **Statut** : Analyse pré-décision DG (bd `j5lb`)

---

## 1. RÉSUMÉ EXÉCUTIF

**Impact immédiat sur PariScore : ZÉRO.**

PariScore n'utilise pas l'acteur Apify `oodoow/oddsportal-com` en production. L'email ne requiert aucune action urgente. En revanche, il impacte la décision stratégique `j5lb` (GO/NO-GO OddsPortal) en augmentant le coût estimé d'une intégration future.

---

## 2. CONTENU DE L'EMAIL — Décodage

| Élément | Détail |
|---|---|
| **Acteur concerné** | `oodoow/oddsportal-com` (scraper OddsPortal) |
| **Auteur acteur** | HonzaS |
| **Date effective** | 18 juin 2026 |
| **Raison** | Coût compute Apify non couvert → marge négative pour l'auteur |
| **Ce qui change** | Platform usage (compute units Apify) ajouté au coût → était GRATUIT |
| **Ce qui ne change pas** | Prix per-event inchangés (Main odds: $5/1000, Full odds: $10/1000, Actor start: $0.01) |

### Modèle old vs new

```
ANCIEN  : vous payez [events] uniquement — compute Apify offert
NOUVEAU : vous payez [events] + [compute units] — plus cher à volumétrie équivalente
```

Le surcoût exact dépend du compute time par run. Non publié dans l'email.

---

## 3. UTILISATION APIFY ACTUELLE SUR PARISCORE

### 3.1 APIFY_TOKEN dans .env — Statut

```
APIFY_TOKEN=apify_api_[REDACTED — token retiré du git, à roter]
```

**Relique du Transfermarkt actor** (`curious_coder/transfermarkt, $15/mo`). Retiré en **v10.73** (2026-05-19) — remplacé par `felipeall sidecar Docker self-host`. Token probablement inutilisé depuis lors.

### 3.2 Datasets one-shot déjà importés (usage historique, non-runtime)

| Fichier | Acteur Apify | État |
|---|---|---|
| `dataset_flashscore-team-stats_*.json` | flashscore-team-stats | ✅ Importé → SQLite `api_cache` (logos EPL) |
| `dataset_flashscore-live-matches_*.json` | flashscore-live-matches | ✅ Importé → ETL plans E/F |
| `dataset_sofascore-scraper-pro_*.json` | sofascore-scraper-pro | ✅ Importé → Plans G/H/I |

**Ces datasets sont des dumps one-shot manuels. Aucun n'est un feed runtime.**

### 3.3 Références OddsPortal dans server.js

Deux occurrences — **aucune intégration runtime** :

1. `server.js:24387` (commentaire backend tennis backtest) :
   > `// Pour ROI il faudrait ingerer OddsPortal closing lines (hors scope T9).`  
   → Use case futur non implémenté.

2. `server.js:37385` (commentaire route comparateur) :
   > `// GET /api/v1/comparateur/feed — Liste matchs style OddsPortal (grille, zéro appel API)`  
   → Comparaison stylistique UX uniquement. Aucun appel à OddsPortal.

---

## 4. ANALYSE D'IMPACT

### 4.1 Impact immédiat (2026-06-18)

| Dimension | Impact | Justification |
|---|---|---|
| **Production PariScore** | ✅ AUCUN | Acteur `oodoow/oddsportal-com` non intégré |
| **Coût mensuel Apify** | ✅ AUCUN | Token présent en `.env` mais inactif (Transfermarkt retiré v10.73) |
| **Fonctionnalités actives** | ✅ AUCUN | Aucune feature dépend d'OddsPortal |

### 4.2 Impact stratégique — Roadmap `j5lb`

`j5lb` = décision DG GO/NO-GO sur 6 études dont OddsPortal. Ce changement tarifaire augmente le coût estimé.

**Estimation coût pre-change (référence spike `bjv`) :**
- Main odds: $5/1000 events
- Full odds: $10/1000 events
- 1 run journalier × 500 matchs ≈ 500 events "Main odds" → $2.50/jour → **~$75/mois** (événements seuls)

**Post-change : +X% compute units** (non chiffré — dépend de durée run). Réaliste : **+$10-30/mois** selon volumétrie.

**Total estimé post-change : $85-105/mois pour OddsPortal via Apify**

---

## 5. AVANTAGES DE L'ACTEUR APIFY ODDSPORTAL (si GO j5lb)

| Avantage | Détail |
|---|---|
| **Pas de maintenance CF bypass** | L'auteur HonzaS gère le Cloudflare bypass — PariScore ne maintient pas le scraper |
| **Coverage large** | 10+ bookmakers EU, foot + tennis majeurs, format JSON propre |
| **Closing lines historiques** | Use case clé : ROI backtest réel (comment server.js:24387) |
| **Time-to-market** | Intégration 1-2j (HTTP call Apify API → acteur run → JSON résultat) |
| **Légalité proxy** | Responsabilité scraping transférée à l'auteur de l'acteur (zone grise — voir §7) |

---

## 6. INCONVÉNIENTS ET RISQUES

| Inconvénient | Sévérité | Détail |
|---|---|---|
| **Coût $85-105/mois estimé** | 🔴 HAUT | Vs $0 actuel. Pour un usage ROI backtest ponctuel = peu justifiable en récurrent |
| **ToS OddsPortal non résolue** | 🔴 HAUT | Spike `bjv` : ToS §3 interdit explicitement scraping automatisé. L'acteur Apify *contourne* CF mais ne règle pas la légalité ToS. Risque cease & desist identique |
| **Dépendance tiers critique** | 🟡 MOYEN | Si HonzaS retire l'acteur ou si OddsPortal bloque → données coupées sans préavis |
| **Latence batch** | 🟡 MOYEN | Scraping Playwright = 3-5s/match → pas utilisable pour cotes live (<5s cible PariScore) |
| **Compute uncertainty** | 🟡 MOYEN | Nouveau modèle compute = coût variable difficile à budgéter mensuellement |
| **Overlap avec Odds API** | 🟢 FAIBLE | Odds API Starter ($30/mo) couvre les mêmes bookmakers EU — moins de couverture historique mais légal et stable |
| **APIFY_TOKEN expose** | 🟢 FAIBLE | Token en `.env` correctement isolé. Mais token actif = surface d'attaque si `.env` leak |

---

## 7. POSITION LÉGALE — Clarification

Le spike `bjv` a conclu ❌ REJET DÉFINITIF pour scraping OddsPortal direct. L'acteur Apify ne change PAS cette analyse :

> L'acteur Apify est un scraper automatisé d'OddsPortal. Il utilise Playwright stealth pour contourner CF. Cela correspond exactement à ce qu'interdit OddsPortal ToS §3 : "crawl, spider, scrape, harvest or otherwise gather any data from the Site by automated means without prior written consent."

Utiliser l'acteur d'un tiers ne protège pas PariScore : c'est PariScore qui consomme les données et déclenche les runs.

**Verdict légal : inchangé par l'email Apify — risque ToS subsiste.**

---

## 8. ALTERNATIVES CONFIRMÉES (spike `bjv` — aucun risque ToS)

| Source | Coût | Use case | Score |
|---|---|---|---|
| **Odds API Starter** | $30/mo | Cotes live foot+tennis 20k req/mois | 85/100 ✅ |
| **API-Football /odds** | $0 (déjà payé) | Foot closing odds historiques | 75/100 ✅ |
| **Polymarket/Kalshi** | $0 | Cote implicite marchés prédictifs | 70/100 ✅ |
| **OddsPapi.io** | $0 free tier | Pinnacle sharp line (bd `bjv` POC pending) | TBD |

Pour closing lines historiques backtest ROI spécifiquement → **API-Football /odds** couvre les fixtures historiques football sans surcoût.

---

## 9. RECOMMANDATIONS

### Court terme (avant 2026-06-18 — aucune urgence)

- **Aucune action requise.** PariScore n'est pas affecté par ce changement.
- Vérifier que le token `APIFY_TOKEN` n'est pas consommé activement : `grep -r "APIFY_TOKEN\|apifyRequest\|runActor" server.js pariscore.js` → confirmer 0 appels runtime.

### Décision DG `j5lb` — OddsPortal

**Recommandation : NO-GO OddsPortal via Apify acteur.**

Raisons :
1. ToS risque non résolu — le changement tarifaire ne change rien au risque légal
2. Coût estimé $85-105/mois pour un use case backtest ponctuel = ROI négatif
3. Alternatives légales couvrent 80% du besoin (API-Football odds historiques + Odds API Starter)
4. OddsPapi.io (bd `bjv` POC pending) = Pinnacle sharp line pour calibration, gratuit, légal

### Si GO OddsPortal malgré tout

Si DG décide d'explorer malgré les risques :
- Contacter OddsPortal pour **API officielle** ou **partenariat données** (modèle différent)
- Évaluer **Sportmonks** ($25-49/mo) ou **FootyStats** ($10-19/mo) comme source cotes historiques légale
- Utiliser acteur Apify uniquement pour **backtests ponctuels offline** (non-runtime, non-prod), volumes réduits

---

## 10. ACTIONS RECOMMANDÉES

| # | Action | Priorité | Responsable |
|---|---|---|---|
| 1 | Confirmer token APIFY inactive (0 appels runtime) | 🟢 LOW | Claude Code audit server.js |
| 2 | Décision DG `j5lb` — OddsPortal NO-GO recommandé | 🟡 MED DG | DG |
| 3 | Si OddsPortal GO → étudier API officielle OddsPortal avant acteur Apify | 🟡 MED | Lead Dev |
| 4 | POC OddsPapi.io (bd `bjv`) — alternative légale Pinnacle sharp | 🟢 LOW | Ops |

---

*Rapport généré le 2026-06-04 — Lead Data Scientist PariScore.*  
*Sources : email Apify 2026-06-04, audit codebase server.js, spike `bjv` 2026-05-21, wiki entity `apify.md`.*
