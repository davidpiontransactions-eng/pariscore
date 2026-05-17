# Bug Report — Onglet Tennis « Erreur réseau » / Chargement bloqué
**Date** : 2026-05-18
**Sévérité** : HAUTE (onglet Tennis inutilisable)
**Statut** : CORRIGÉ

## Symptôme
Onglet Tennis → bandeau « Erreur réseau », tableau Value Bets figé sur « Chargement… ». Apparu immédiatement après déploiement build 38 (Sprint 3).

## Cause racine
Régression introduite par S1/S2. Dans `_buildTennisValueBetsCore` (server.js), 3 enrichissements BSD ajoutés étaient exécutés en **`await` SÉQUENTIEL sans timeout** en tête du build, AVANT la boucle matchs :

```
predMap = await fetchBSDTennisPredictions(dateClean);   // jusqu'à 6 pages BSD
calib   = await buildBSDTennisCalibration();             // jusqu'à 8 pages BSD
rankIdx = await buildBSDTennisRankIndex();               // ATP 4 + WTA 4 pages
```

Chaque page = `bsdTennisFetch` (httpsGet timeout 15s + 2 retries backoff). Au **cold cache** (1er appel `/api/v1/tennis/value-bets` après `pm2 restart` — exactement le cas build 38), aucune de ces données n'est en cache → ~24 requêtes BSD séquentielles. `buildTennisValueBets` n'a **aucun timeout interne** ; la route attend la résolution → la requête HTTP pend plusieurs dizaines de secondes → `apiFetch` côté client expire → « Erreur réseau », `renderTennisValueBets` jamais appelé → « Chargement… » permanent.

Aggravant : `_tennisVBCache` froid à chaque restart → 100 % des premiers chargements post-déploiement touchés. Avant S1/S2 le build ne faisait pas ces fetchs → onglet OK (régression confirmée S1/S2, révélée au déploiement S3).

## Correctif appliqué (server.js)
Remplacement du bloc séquentiel par :
- **Parallélisation** : `Promise.allSettled([...])` des 3 fetchs.
- **Time-box 4 s** par fetch via helper `_raceT(promise, ms, fallback)` (race contre `setTimeout`).
- **Dégradé propre** : si un fetch n'est pas prêt en 4 s → valeur fallback (`new Map()` / `null`) → le tableau s'affiche SANS ce signal pour ce build. Le fetch sous-jacent continue en arrière-plan et **remplit son cache interne** (`apiCacheSet`) → le build suivant (cache chaud) inclut les signaux.

Cold build borné à ~4 s (3 fetchs parallèles racés) au lieu de pendre.

## Validation
- `node --check server.js` → SERVER_OK.
- Sanity `_raceT` : promesse lente (30 s) → fallback en **304 ms** (pas 30 s) ; promesse rapide → valeur réelle ; promesse rejetée → fallback. Comportement conforme.
- Effet attendu prod : 1er chargement onglet Tennis rapide (signaux S1/S2 éventuellement absents ce build), build suivant complet (cache chaud, logs `[TennisPred/Calib/Rank BSD]`).

## Prévention / reco
1. Tout enrichissement réseau dans un build servant une route synchrone DOIT être time-boxé + best-effort (jamais `await` séquentiel non borné en hot path).
2. Idéalement : warm-up boot de calib/rankings/predictions (déjà partiellement via `__tennisVBWarm`) pour éviter tout cold path utilisateur.
3. Surveiller `[TennisPred BSD]` / `[TennisCalib BSD]` : si jamais émis → fetch toujours racé-out (BSD lent) → enquêter latence BSD.

## Déploiement
```bash
# WinSCP : server.js → /home/ubuntu/pariscore
cd /home/ubuntu/pariscore && node --check server.js && pm2 restart pariscore --update-env
# ouvrir onglet Tennis : doit charger < 5 s (tableau visible, pas "Erreur réseau")
```
