# Test Report — Transfermarkt via Apify (voie D)
**Date** : 2026-05-19
**Module** : Intégration Apify `curious_coder/transfermarkt` — bd `ParisScorebis-nyg`
**Statut** : scaffold zero-dep livré + testé · data réelle BLOQUÉE (paywall Apify)

## Périmètre livré (server.js)
- `_apifyRunSync(actor, input)` — helper générique Apify run-sync-get-dataset-items (httpsPost, zero-dep), détecte 403 `actor-is-not-rented`
- `_tmBuildUrl(kind, id, slug)` — construit URL Transfermarkt (profile / market_value / transfers / injuries)
- `fetchTransfermarkt(kind, id, slug)` — cache 24h, pass-through défensif (`raw` items)
- Route `GET /api/v1/transfermarkt/:kind?id=&slug=` — gate footPro (server.js:11168)
- Token : `process.env.APIFY_TOKEN` (jamais .env committé)

## ✅ Tests passés
| Cas | Résultat |
|-----|----------|
| kind+id valide, sans APIFY_TOKEN env | 503 `APIFY_TOKEN absent` (gracieux) ✓ |
| kind invalide (`foo`) | 400 `bad_kind` ✓ |
| id non-numérique (`abc`) | 400 `bad_id` ✓ |
| non authentifié | 403 (gate footPro) ✓ |
| APIFY_TOKEN env set, full path | atteint Apify → 403 `actor-is-not-rented` → mappé 503 `Apify actor non loué (rent requis $15/mo)` ✓ |
| URL Transfermarkt | construite OK (slug `erling-haaland`, id 418560, kind→path) ✓ |
| `node --check` | OK |

Chaîne complète prouvée : env→build URL→httpsPost Apify→handling 403→cache→route→gate→validation. Zero-dep préservé (httpsPost natif, aucune lib).

## ❌ Bloqueur (externe, non-code)
Actor `curious_coder/transfermarkt` = payant **$15/mo Apify**, trial expiré sur ce compte → `403 actor-is-not-rented`. Aucune donnée réelle récupérable tant que l'actor n'est pas loué (console.apify.com/actors/xCCKG4gqfoahQJrEy).

## ⚠️ À finaliser après location
### W1 — Parser pass-through (schéma non confirmé)
`fetchTransfermarkt` retourne `raw: items` brut. L'actor est générique URL-based → schéma output inconnu sans run réel. Après location : 1 run découverte par `kind` → écrire normalizer typé (market_value série temps, transfers+fee, injuries historique) remplaçant le pass-through. Voir étude `.context/etude-transfermarkt-vs-stack-actuel-2026.md` §3 pour les champs cibles.
### W2 — Timeout run-sync
`httpsPost` timeout 30s ; un crawl Apify peut dépasser. Si runs lents observés → basculer sur run async + polling dataset, ou augmenter timeout dédié. À mesurer au 1er run réel.
### W3 — Sécurité token
`APIFY_TOKEN` doit vivre dans l'env du process serveur (VPS OVH), jamais `.env` committé. Rappel : token `apify_ui_...` exposé en clair cette session → à rotate côté Apify.

## Verdict
Scaffold voie D **livré, zero-dep, testé end-to-end** (tout sauf data réelle, bloquée par paywall actor). Prêt à servir dès location actor + finalisation parser (W1). Décision budget $15/mo+usage = DG (bd `ParisScorebis-xzo`).
