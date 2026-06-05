# Éval Repo — aviranmz/booking-converter (BookingLab) vs PariScore

**Date** : 2026-06-05
**Évaluateur** : GM/CTO PariScore
**Repo cible** : https://github.com/aviranmz/booking-converter
**Verdict** : ❌ **NO-GO** (off-mission — pas un modèle prédictif)

---

## 1. Ce qu'est le repo (verbatim README)

> "BookingLab is a Node.js + React web application that **resolves and converts sports betting booking codes** across multiple operators. It integrates with the Betway Africa Odds Feed API, consumer-site booking resolvers for various betting platforms, and Sportradar for match data enrichment."

> "Multi-operator resolve: **Decode booking codes** from Betway, Bet9ja, SportyBet, 1xBet, Bet365, BetKing, Betano, and 15+ other African/global betting operators"

> "Consumer API replay: **Captures and replicates booking resolver endpoints** without direct API access"

**Traduction** : outil qui prend un *code de coupon* (booking code) d'un bookmaker et le décode/reconstruit pour le rejouer chez un autre opérateur. Aggrégateur de paris partagés, **pas un modèle de prédiction**.

---

## 2. Extraction (modèle / features / data / métriques)

| Champ attendu | Trouvé |
|---|---|
| **Modèle / algo** | ❌ AUCUN. Pas de Poisson, pas d'Elo, pas de ML, pas de classifier. Logique = OAuth + scraping resolver endpoints + normalisation de legs. |
| **Features / target** | ❌ N/A. Pas de prédiction. Sortie = liste de legs décodés (match, marché, cote affichée). |
| **Données** | Betway Africa Odds Feed API (clé requise), Sportradar (clé requise, payant), resolver consumer-sites (scraping non-officiel). |
| **Métriques** (accuracy/Brier/ROI/calibration) | ❌ AUCUNE. Rien à calibrer — pas de proba produite. |
| **Stack** | Dart 64.6% (app Flutter MatchCorner) / JS 18.1% (Express server :3001 + React client :3000) / TS 5.1%. Deps : `concurrency`, `@aws-sdk/client-s3`, `husky`, Firebase, Playwright (capture). |
| **Licence** | ❌ **AUCUNE licence** (README + package.json : "Not specified"). Pas de fichier LICENSE → "all rights reserved" par défaut = **flag legal** (cf. leçon TML-Database). |

---

## 3. Analyse vs PariScore

| Critère | Verdict |
|---|---|
| **Edge marché réel** | ❌ Néant. Le repo ne calcule **aucune proba**. Il décode des coupons. Zéro edge value-bet. |
| **Calibration / UQD** | ❌ Inexistant. Règle CLAUDE.md (pas de prod sans IC) → rien à shipper. |
| **Redondance vs existant** | N/A — domaine orthogonal. Aucun recouvrement avec Elo/Klaassen-Magnus/Poisson/bayesianBlend/bootstrap UQD. |
| **Features inédites** | ❌ Aucune feature exploitable dans `buildMatchRecord`. |
| **Compat stack** | ⚠️ Le cœur de valeur est en **Dart/Flutter** (64.6%) + dépendances lourdes (Firebase, AWS S3, Playwright). Anti-pattern vs PariScore Node zero-dep. |
| **Légalité** | 🚩 Double flag : (1) **aucune licence** = pas réutilisable légalement. (2) Le repo lui-même fait du **scraping resolver non-officiel** ("replicates endpoints without direct API access") — risque ToS/legal qu'on ne veut pas absorber. |
| **Leçons passées** | Confirme le pattern : repos externes = soit redondants, soit off-mission. Ici off-mission total. |

---

## 4. Recommandation GM — ❌ NO-GO

1. **Hors mission** : PariScore = moteur de *prédiction calibrée* (Poisson/Elo/value-bet). BookingLab = *converter de coupons inter-bookmakers*. Zéro intersection produit. Aucun modèle, aucune feature, aucune métrique à incorporer.
2. **Blocage légal** : pas de licence (all-rights-reserved) + scraping resolver non-officiel. Réutilisation = risque, à l'opposé de la rigueur QA/légale du projet (leçon TML-Database CC-NC).
3. **Anti-stack** : valeur concentrée en Dart/Flutter + Firebase + AWS S3 + Playwright. Incompatible Node zero-dep sauf better-sqlite3.

**Idée à voler (0 code)** : le concept "décoder un booking code partagé" pourrait *inspirer* une feature produit lointaine (importer un coupon utilisateur → analyser EV de chaque leg via notre moteur). Mais c'est un **build interne from scratch**, pas une incorporation de ce repo. À mettre en backlog DG si intérêt commercial, sinon ignorer.

**Effort si incorporation** : N/A — rien à incorporer. Effort feature "import coupon" inspirée = 3-5j build interne, non prioritaire.

---

Attente : ton GO/NO-GO.
