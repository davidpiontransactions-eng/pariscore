# Transferts & Rumeurs façon Transfermarkt — Rapport de recherche

*Généré : 2026-05-19 · Sources : 12 · Confiance : Moyenne (quotas RapidAPI/openapi non récupérables — pages JS/503, signalé)*
*Contexte : PariScore, 25 membres, ADN zéro-dépendance npm, économique. Source cible = transfermarkt.fr/navigation/transfersundgeruechte (transferts + rumeurs). Sofascore exclu (demande DG).*

## Executive summary

Aucune **API officielle Transfermarkt** n'existe (confirmé). 4 voies réalistes : (1) **felipeall/transfermarkt-api** — wrapper open-source MIT (FastAPI, Docker, 398★, actif v3.0.0 déc. 2024) qui scrape Transfermarkt directement → données les plus proches de « la bible », gratuit, auto-hébergeable en sidecar ; (2) **RapidAPI apidojo « transfermarket »** — API managée qui expose explicitement *transfer news, latest/record transfers, **rumors**, market value*, tier BASIC gratuit (quota exact non lisible — page JS) ; (3) **Sportmonks Transfer Rumours API** — officielle, structurée (probabilité/source/montant/date) mais €99+/mois → écartée budget 25 ; (4) **transfermarkt-datasets** — snapshots quotidiens GitHub gratuits, mais batch (pas rumeurs temps réel). Reco : **felipeall self-hosted en sidecar HTTP** (préserve zéro-dep Node, même schéma que le scaffold Apify v10.69), fallback managé RapidAPI apidojo pour les rumeurs si le scrape devient fragile.

## 1. Pas d'API officielle Transfermarkt

Transfermarkt n'a pas d'API publique : la donnée vit uniquement sur le site (transferts, rumeurs, valeurs marchandes, news) ([Transfermarkt](https://www.transfermarkt.us/), [page Transfers & Rumours](https://www.transfermarkt.us/navigation/transfersundgeruechte)). Tout accès programmatique = wrapper non officiel (scrape) ou API tierce qui ré-agrège.

## 2. Option A — felipeall/transfermarkt-api (recommandé)

- Open-source **MIT**, **Python/FastAPI**, **Docker** auto-hébergeable (port 8000), 398★, 9 releases, dernière **v3.0.0 (29 déc. 2024)**, ~114 commits, 11 issues / 8 PR ouvertes → activement maintenu ([GitHub](https://github.com/felipeall/transfermarkt-api), [README](https://github.com/felipeall/transfermarkt-api/blob/main/README.md)).
- Scrape Transfermarkt directement → **données = exactement « la bible »** (clubs, joueurs, transferts, valeurs marchandes). Rate-limit intégré configurable (`RATE_LIMITING_ENABLE`, `RATE_LIMITING_FREQUENCY` défaut 2/3 s, slowapi).
- ⚠️ L'instance publique `transfermarkt-api.fly.dev` est **« testing purposes only »** (renvoyait 503 pendant la recherche) → **auto-héberger obligatoire** en prod.
- ⚠️ **Endpoint « rumeurs » non confirmé** dans la doc lue (Swagger fly.dev inaccessible). À vérifier sur l'instance self-host ; si absent, le wrapper étant MIT/extensible, ajouter une route custom scrappant `/navigation/transfersundgeruechte`.
- Risques : fragilité scrape (changement HTML Transfermarkt), zone grise ToS Transfermarkt, microservice **Python** (pas Node).
- **Fit PariScore** : déployer en *sidecar* ; le serveur Node l'appelle en HTTP (clé-zéro), cache 6–24 h. Architecture identique au scaffold Apify v10.69 → **ADN zéro-dépendance npm préservé** (aucune lib npm ajoutée au cœur).

## 3. Option B — RapidAPI apidojo « transfermarket » (fallback managé)

- API tierce managée : « query for transfer news, latest or record transfers, **rumors**, player market value… to create a site such as transfermarkt.com » ([RapidAPI apidojo/transfermarket](https://rapidapi.com/apidojo/api/transfermarket), [docs apidojo.net](https://apidojo.net/documentations/transfermarkt)).
- **Couvre explicitement les rumeurs** (≠ felipeall non confirmé) et pas de scrape à maintenir côté nous.
- Pricing : pages RapidAPI 100 % JS → **quota BASIC gratuit + tarifs PRO/ULTRA non récupérables ici** (gap). Modèle RapidAPI freemium typique = BASIC gratuit à quota mensuel bas + hard-limit, payant au-delà ([RapidAPI pricing model](https://docs.rapidapi.com/v1.0/docs/plans-pricing)).
- Risques : dépendance uptime tiers, quota free probablement serré (à vérifier en console RapidAPI), appel via clé RapidAPI (header `x-rapidapi-key`).
- Alternatives RapidAPI similaires : `tipsters/transfermarkt-db`, `ntd119/transfermarkt6` (mêmes inconnues pricing).

## 4. Option C — Sportmonks Transfer Rumours API (écartée budget)

- **Officielle, structurée** : chaque rumeur = joueur → club, **probabilité (LOW/MEDIUM/HIGH)**, **source (auteur + URL)**, **montant + devise**, **date** ; 5 endpoints (all, by ID, by date range, by team, by player), mise à jour continue ([Sportmonks Transfer Rumours](https://www.sportmonks.com/football-api/transfer-rumours-api/), [docs v3](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/transfer-rumours)).
- Coût : **pas de plan gratuit**. Starter **€29/mois mais 5 ligues seulement** ; Transfer Rumours = **add-on à partir de €99/mois** (ou tier Growth €99, 30 ligues) ([Plans & pricing](https://www.sportmonks.com/football-api/plans-pricing/)). Données les plus propres du marché mais **trop cher pour 25 membres**.

## 5. Option D — transfermarkt-datasets (backfill gratuit)

- Jeux de données Transfermarkt rafraîchis quotidiennement, publiés sur GitHub (même auteur, écosystème felipeall) — **gratuit, sans scrape live**. Bon pour valeurs marchandes & transferts **confirmés** en batch, **PAS pour rumeurs temps réel** ([transfermarkt GitHub topic](https://github.com/topics/transfermarkt)).

## Recommandation

| Voie | Rumeurs ? | Coût/mois | Zéro-dep Node | Fiabilité | Verdict |
|---|---|---|---|---|---|
| **A — felipeall self-host (sidecar)** | À confirmer/extensible | **0 €** | ✅ (HTTP, comme Apify scaffold) | Moyenne (scrape, mais MIT/maîtrisé) | **Recommandé** |
| B — RapidAPI apidojo | ✅ explicite | 0 € BASIC puis payant | ✅ (clé HTTP) | Moyenne (tiers) | **Fallback managé rumeurs** |
| C — Sportmonks | ✅ structuré officiel | €99+/mois | ✅ | Élevée | Écarté (budget) |
| D — transfermarkt-datasets | ❌ (batch) | 0 € | ✅ | Élevée (snapshot) | Backfill transferts confirmés |

**Plan d'action proposé :**
1. Déployer **felipeall/transfermarkt-api** en conteneur Docker sidecar (rate-limit ON), Node l'appelle via HTTP, cache 12 h. Vérifier sur le Swagger self-host si une route rumeurs existe.
2. Si rumeurs absentes → soit ajouter une route custom `/geruechte` au wrapper (MIT), soit brancher **RapidAPI apidojo** (tier BASIC gratuit) uniquement pour le flux rumeurs.
3. **transfermarkt-datasets** en complément gratuit pour valeurs marchandes / transferts confirmés (batch quotidien).
4. Ne PAS payer Sportmonks ni l'actor Apify Transfermarkt à 25 membres.

## Limites / gaps

- Quotas exacts RapidAPI apidojo (BASIC gratuit, paliers payants) **non récupérés** : pages 100 % JS — à valider manuellement en console RapidAPI.
- Endpoint rumeurs de felipeall **non confirmé** (Swagger fly.dev en 503) — à valider sur instance self-host avant décision finale.
- Légalité scraping Transfermarkt = zone grise (ToS) ; usage interne 25 membres, cache, rate-limit recommandés pour limiter l'exposition.

## Sources

1. [Transfermarkt — accueil](https://www.transfermarkt.us/) — confirme données transferts/rumeurs/valeurs, pas d'API officielle.
2. [Transfermarkt — Transfers & Rumours](https://www.transfermarkt.us/navigation/transfersundgeruechte) — page source cible.
3. [felipeall/transfermarkt-api GitHub](https://github.com/felipeall/transfermarkt-api) — wrapper MIT, 398★, v3.0.0.
4. [felipeall README](https://github.com/felipeall/transfermarkt-api/blob/main/README.md) — Docker, rate-limit, « testing only » public.
5. [RapidAPI apidojo/transfermarket](https://rapidapi.com/apidojo/api/transfermarket) — API managée, rumors explicites.
6. [apidojo.net docs Transfermarkt](https://apidojo.net/documentations/transfermarkt) — doc endpoints (JS, non lue).
7. [Sportmonks Transfer Rumours API](https://www.sportmonks.com/football-api/transfer-rumours-api/) — structure rumeurs officielle.
8. [Sportmonks docs v3 transfer-rumours](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/transfer-rumours) — 5 endpoints.
9. [Sportmonks Plans & pricing](https://www.sportmonks.com/football-api/plans-pricing/) — Starter €29 / Growth €99 / add-on rumeurs €99.
10. [RapidAPI pricing model](https://docs.rapidapi.com/v1.0/docs/plans-pricing) — modèle freemium BASIC.
11. [GitHub topic transfermarkt](https://github.com/topics/transfermarkt) — écosystème wrappers + datasets.
12. [BeSoccer transfers/rumours](https://www.besoccer.com/transfers/rumor) — source rumeurs alternative (pas d'API propre).

## Méthodologie

6 requêtes WebSearch + 6 WebFetch (firecrawl/exa indisponibles). Sous-questions : API officielle Transfermarkt ? · wrapper open-source felipeall fiabilité ? · APIs RapidAPI Transfermarkt + pricing ? · API rumeurs Sportmonks/feed ? · alternatives datasets/légalité. Pages RapidAPI/apidojo JS non extractibles → quotas à confirmer manuellement.
