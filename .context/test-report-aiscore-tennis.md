# Test Report — AiScore Tennis (Option A scrape)
**Date** : 2026-05-19
**Module** : Intégration AiScore tennis (sitemap-driven scrape) — bd `ParisScorebis-ruy`

## Périmètre livré
Backend server.js : module scraper aiscore (`_aiscoreFetch`/`_aiscoreParseMatch`/`getAiscoreTennisIndex`/`getAiscoreMatch`) + 2 routes :
- `GET /api/v1/tennis/aiscore/index?limit=N` — discovery via sitemap tennismatches.xml
- `GET /api/v1/tennis/aiscore/match/:id?slug=` — scrape match-detail (slug auto-résolu via index si absent)

## ✅ Tests passés
- Feasibility live : sitemap 200 (2.9MB), match-detail 200 (235KB), zéro challenge Cloudflare via curl
- Parser offline vs sample réel : tournament, start_time, status, players (nom/pays/logo/sets/sets_won), stats (Aces/DF/BP/1st serve), pbp 3 sets — tous OK
- Route INDEX authed : count 285, {id,slug,url} corrects
- Route MATCH authed : payload complet, slug auto-résolu via index
- Cache 5min : hit ~190ms vs cold ~1.4s (TTL Map opérationnel, pattern identique texCache)
- Validation : bad id → 400 ; id inexistant → 404 gracieux ; non-auth → 403 (gate Pro tennis cohérent autres routes)
- Throttle : gate séquentiel 1 req/2s en place (anti-CF-ban)
- `node --check server.js` : OK

## ❌ Bugs détectés & corrigés (durant QA)
### BUG-A — tournament null (CORRIGÉ)
`.mediaTitle` contient `<div class="split">` imbriqué → regex coupait au 1er `</div>`. Fix : ancrer après le split div.
### BUG-B — stats Aces/DF manquants (CORRIGÉ)
Classe réelle `"flex mainContent_1"` ; regex cherchait `class="mainContent_1"` exact. Fix : `class="[^"]*\bmainContent_1\b[^"]*"`.
### BUG-C — TypeError sidePairs (CORRIGÉ)
`sidePairs(keyGroups[0])` recevait le RegExpMatchArray au lieu de la string capturée. Fix : `keyGroups[0][1]`.
### BUG-D — Cloudflare 403 sur httpsGet Node (CORRIGÉ — changement archi)
Node `https` natif bloqué par CF sur JA3/TLS fingerprint (403 même avec headers browser complets). curl (OpenSSL) passe. Fix : `_aiscoreFetch` shell `curl` via `execFile` (args array = pas de shell, injection-safe), URL whitelistée `^https://www\.aiscore\.com/...$`. Seul scraper du repo à déroger au zero-dep — justifié, isolé, documenté inline.
### BUG-E — env test : port non libéré (process, pas code)
`kill <bashpid>` ≠ kill Windows node PID → port squatté. Résolu via taskkill netstat PID. Aucun impact prod.

## ⚠️ Avertissements (non bloquants → roadmap)
### W1 — point_by_point : paires de points partielles
`.point_item` → souvent 1 valeur capturée au lieu de la paire [p1,p2]. Game-score par set + serve position corrects. Impact paris faible (proposal : signal point-par-point non exploitable à l'échelle). À raffiner si besoin produit.
### W2 — Dépendance système `curl`
Requis sur l'hôte (présent VPS OVH Linux + Windows dev). Si absent → route renvoie 502 propre. Documenter prérequis déploiement.
### W3 — Fragilité Nuxt SSR
Structure DOM aiscore = Nuxt rebuild fréquent → regex parser à re-valider périodiquement. Monitorer taux d'échec parse en prod.
### W4 — Pas d'odds
API privée aiscore 403 (inchangé). Aucune cote — uniquement live score/stats/pbp.

## 💡 Recommandations
1. Frontend hook (proposal Option A étape 5) NON livré — sous contrainte style mobile Flashscore×L'Équipe sans direction design. → bd follow-up créé.
2. Monitoring : compteur échecs `_aiscoreFetch` + alerte si parse vide (détection CF-ban ou refonte DOM).
3. Reconfirmer décision DG : proposal verdict restait SKIP (ROI vs 6 sources tennis existantes). Backend livré sur demande explicite.

## Verdict
Backend Option A **livré + testé fonctionnel end-to-end**. 5 bugs trouvés/corrigés durant QA. Données live exactes vs source. Limitations W1-W4 documentées (non bloquantes). Frontend = follow-up.
