# Eval repo — FritzCapuyan/ufc-api (2026-06-07)

GM/CTO eval. Source: https://github.com/FritzCapuyan/ufc-api
Demandé : éval pour (a) DB MMA/UFC, (b) **photos combattants**.

## 1. Extraction
- **Type** : crawler Python **on-demand** (pip `ufc_api`), `ufc.py` (9.5KB). Pas de modèle, pas de dataset statique.
- **API** : `get_fighter(name)` → bio (nickname, nationality, birthplace, birthdate, age, height, weight, association/gym, weight_class), wins/losses **par méthode** (ko/sub/dec), `fights[]` (date, result, method, referee, round, time, opponent, **sherdog URL**). `get_event(name)` → fights red/blue corner + **odds** (ufc.com) + **ufc.com/athlete/{slug} links** + strike breakdown (landed/attempted, standing/clinch/ground), takedowns, submissions.
- **Source** : **Sherdog + ufc.com** (scrape live).
- **Métriques** : N/A (scraper).
- **Stack** : Python, `lxml`, `requests`. **Licence : MIT** ✅.

## 2. PHOTOS — la demande clé
**AUCUNE photo.** grep `ufc.py` sur image/img/photo/headshot/png/jpg/src = **vide**. L'API renvoie des **liens de page** (`ufc.com/athlete/{slug}`, sherdog) — pas d'URL d'image. → **zéro apport photo.** Notre cascade ESPN (déployée, resized, OK) résout déjà ça.

## 3. Odds circulaire ? N/A (pas de modèle). Odds = affichage ufc.com.

## 4. Analyse vs PariScore

| Critère | ufc-api | PariScore | Verdict |
|---|---|---|---|
| **Photos** | **0 URL image** (liens page only) | cascade ESPN combiner resized (live) | **rien à prendre** |
| DB stats | strike/TD/sub breakdown, bio, méthodes win | ufcstats CSV + BSD + finishes (agentmma) | redondant |
| Dataset | **aucun** (scrape on-demand) | CSV statiques + BSD WS | pas de dataset à ingérer |
| Fiabilité | scrape **Sherdog live** = fragile (blocage/layout) | sources stables | risque |
| Stack | Python sidecar (lxml/requests) | Node zero-dep | NO-GO infra |
| Edge | odds affichage only | devig ensemble | PariScore ✅ |
| Licence | MIT ✅ | — | ok mais moot |

## 5. Recommandation GM : **NO-GO** (DB + photos)
1. **Photos = 0** : le repo n'extrait aucune image (confirmé code). Notre ESPN cascade fait déjà le job. Rien à prendre.
2. **DB = redondant + fragile** : scraper Sherdog on-demand (pas de dataset), data ufcstats-class qu'on a déjà, Python sidecar contre zero-dep.
3. **Pas d'edge** : odds en affichage, aucun modèle/métrique.

**Effort incorporation : non justifié.**

### Note photos (hors repo, si tu veux + de couverture)
Vraie piste pour photos officielles = **UFC.com headshots** (CDN CloudFront, via slug `ufc.com/athlete/{slug}`) ou Sherdog image — à ajouter en source haute-prio dans notre cascade `getFighterPhoto`. Mais ESPN couvre déjà la carte actuelle (8/8). Basse prio.

## 6. Décision
**NO-GO.** 4e repo de la série sans apport net. PariScore (DB + cascade photos + modèle) reste devant.

Attente : ton GO/NO-GO (défaut = NO-GO, rien à implémenter).
