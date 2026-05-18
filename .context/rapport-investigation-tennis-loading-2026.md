# Rapport Final d'Investigation — Onglet Tennis « Erreur réseau » / Chargement bloqué
**Date** : 2026-05-18
**Méthode** : brainstorm 3 agents parallèles — Ingénieur Réseau, Architecte Backend, Testeur Senior
**Statut** : CAUSE RACINE TROUVÉE · FIX IMPLÉMENTÉ & TESTÉ

## 1. Symptôme
Onglet Tennis (`TENNIS — VALUE BETS`) : bandeau « Erreur réseau » + tableau figé « Chargement… », jamais peuplé. Persistant malgré 2 itérations de correctif précédentes (race 4s, cache-only BSD, gardes route/per-match).

## 2. Convergence des 3 audits

| Agent | Verdict |
|---|---|
| **Testeur Senior** | PAS un bug de syntaxe JS (script entier parse OK), PAS un throw render (helpers `_tvb*` tous null-gardés), PAS auth (403 → « Accès réservé » distinct). → throw/reject **couche réseau** : `await fetch` rejeté (transport) → catch « Erreur réseau », tbody jamais réécrit (reste « Chargement… »). `apiFetch` SANS timeout/retry client. |
| **Architecte Backend** | **CAUSE PRIMAIRE** : `await resolveTennisSurface(m.tournament)` **encore sur le chemin requête par-match** (raté par fix v2). Cold → `_buildTennisSurfaceIndex` = 2× scrape tennisexplorer (httpsGet 15s). **Caché uniquement si `map.size>0`** → si Sackmann vide ET scrape TE échoue → re-fire 2×15s **pour chacun des ~200 matchs** → runaway non borné. Build de base (~200 matchs CPU Markov/TA) ~20-40s = pré-existant borderline. |
| **Ingénieur Réseau** | Coupure socket/reverse-proxy d'une 1ère réponse cold lente. `apiFetch` aucun AbortController/timeout → le reject vient du réseau (proxy `proxy_read_timeout` ~60s coupe la connexion mid-flight). Aucun `server.timeout`/`keepAliveTimeout` configuré. Cold post-`pm2 restart` (cache `_tennisVBCache` vide) = build synchrone long > timeout proxy → reset → `fetch` reject → « Erreur réseau » + tbody gelé. |

**Synthèse** : le chemin requête `/api/v1/tennis/value-bets` à froid contenait un `await` réseau **par-match non borné et non caché** (`resolveTennisSurface` → scrape TE), provoquant un temps de build runaway dépassant le timeout du reverse-proxy → connexion coupée → `apiFetch` (sans timeout/retry) rejette → UI « Erreur réseau » + « Chargement… » figé. Régression : introduite/aggravée par l'usage massif de matchs ESPN-fallback (`surface:null`) qui force ce résolveur sur chaque ligne.

## 3. Correctif implémenté (server.js)
1. **`resolveTennisSurfaceSync(tournamentName)`** — version 100 % synchrone, **zéro scrape, zéro await** : utilise l'index Sackmann mémoïsé 6h (`_getSackSurfIdxCached`, SQLite sync) + l'index TE **seulement s'il est déjà chaud** (`_texSurfaceIndex.map`) ; sinon fallback mots-clés. Même logique exact→fuzzy→keyword.
2. **Call-site core** (`_buildTennisValueBetsCore`) : `await resolveTennisSurface(...)` → `resolveTennisSurfaceSync(...)` (plus aucun await réseau par-match).
3. **Warmer background** : `_buildTennisSurfaceIndex()` ajouté au `Promise.allSettled` de `pollTennisLive` (toutes les 30 s, fire-and-forget) → l'index TE (scrape) se remplit **hors chemin requête**. Cumulé aux fix v2 (pred/calib/rank cache-only + warmer).

Effet : chemin requête cold = aucun fetch réseau bloquant. Build borné au CPU (~200 matchs Markov/TA, pré-existant) ; plus de runaway 2×15s×N.

## 4. Tests
- `node --check server.js` → SERVER_OK.
- `grep` : 0 `await resolveTennisSurface` résiduel sur le hot path (seul le call-site = `resolveTennisSurfaceSync`, le scrape = warmer).
- Sanity `resolveTennisSurfaceSync` : Roland Garros→clay (idx), Wimbledon→grass (keyword), inconnu→fallback, null→null, **retour synchrone** (typeof object, pas de Promise).
- Helpers frontend confirmés null-safe (audit testeur) → pas de throw render même si signaux absents cold.

## 5. Recommandations résiduelles (hors fix immédiat)
1. **`apiFetch` : ajouter AbortController + timeout (~25 s) + 1 retry** côté `pariscore.html` → en cas de cold lent, message « Chargement (démarrage, ~30 s)… » + retry auto au lieu de « Erreur réseau » sans recours.
2. **Cold-cache fast path** : `buildTennisValueBets` pourrait renvoyer immédiatement `{loading:true,matches:[]}` à froid + build background → 0 attente utilisateur (nécessite gestion `loading` côté front).
3. **Réduire le coût base build** : cap matchs enrichis pour 1er paint, ou pré-warm `__tennisVBWarm` au boot.
4. Configurer `server.keepAliveTimeout`/`headersTimeout` cohérents avec le proxy.

## 6. Déploiement
```bash
# WinSCP : server.js → /home/ubuntu/pariscore
cd /home/ubuntu/pariscore && node --check server.js && pm2 restart pariscore --update-env
# onglet Tennis : doit charger (cold = sans badges S1/S2 ~1ère min, warmer remplit) ; plus de "Erreur réseau"
pm2 logs pariscore --lines 60 | grep -E "\[Tennis(Live|Pred|Calib|Rank) BSD?\]|\[TennisVB\]"
```
Si « Erreur réseau » persiste après ça → goulot = base build CPU pré-existant (~200 matchs) > timeout proxy : appliquer reco #1/#2 (timeout/retry client + fast-path cold).
