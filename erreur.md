# Rapport d'erreur — Bandeau tennis non visible en frontend

## Date
2026-07-01

## Symptôme
Le nouveau bandeau tennis (3 zones : logo+nom tournoi · round+Bo · date/heure+surface)
n'apparaît pas en frontend. L'utilisateur voit l'ancien design malgré plusieurs déploiements.

## Cause racine — IDENTIFIÉE ✅

### Le Service Worker (`sw.js`) sert une version obsolète de `pariscore.html`

**Mécanisme :**
1. `sw.js` met en cache `pariscore.html` dans `CACHE_SHELL` (ligne 139 : `'/pariscore.html'`)
2. Stratégie de cache : `staleWhileRevalidate` pour les navigations (lignes 225-263)
   → Le navigateur reçoit d'abord la **version cache** (ancienne), puis met à jour en arrière-plan
3. Le cache est versionné par `CACHE_VERSION` (ligne 132)
4. Tant que le navigateur n'a pas **désenregistré l'ancien SW et activé le nouveau**,
   l'ancien `pariscore.html` reste servi

**Pourquoi le bump `v70 → v71` n'a pas suffi :**
- Le cycle de vie du SW nécessite :
  1. Chargement de la page avec l'ancien SW (qui sert l'ancien HTML)
  2. Découverte du nouveau `sw.js` (byte-for-byte différent)
  3. Installation du nouveau SW (en arrière-plan)
  4. **Activation** — seulement quand **tous les onglets de l'ancien SW sont fermés**
     (sauf si `skipWaiting()` est appelé)
  5. Rechargement pour prendre en compte

- Un `F5` (refresh normal) ne déclenche PAS ce cycle.
- Il faut `Ctrl+Shift+R` (hard reload) ou fermer tous les onglets.

### Vérifications effectuées (serveur OK)

| Vérification | Résultat |
|---|---|
| Code VPS présent | ✅ `sc-banner-left` (3×), `matchBanner` (7×) dans pariscore.html |
| HTML servi par localhost:3000 | ✅ `sc-banner` (43×), `matchBanner` (10×) |
| sw.js servi en v71 | ✅ Confirmé |
| API `/api/v1/tennis/live` | ✅ 427 matchs, tournament="Wimbledon" etc. |
| PM2 process | ✅ online, stable (PID stable après 23s) |
| Git commit VPS | ✅ `993e807` (dernier) |

**Conclusion : le serveur est 100% correct. Le problème est exclusivement côté cache navigateur / Service Worker.**

## Solution appliquée

### 1. SW `skipWaiting()` (forçage activation immédiate)
Ajout de `self.skipWaiting()` dans le handler `install` du SW pour que la nouvelle version
s'active immédiatement sans attendre la fermeture des onglets.

### 2. Message client → reload auto
Le SW notifie les clients contrôlés (`clients.claim()` + `postMessage`) pour déclencher
un rechargement automatique de la page dès qu'une nouvelle version est active.

### 3. Versioning du HTML servi (cache-busting header)
Le serveur envoie `Cache-Control: no-cache` sur `pariscore.html` (au lieu de max-age=300)
pour empêcher le cache HTTP navigateur de retenir une vieille version.

## Action utilisateur requise (ponctuelle)
Une fois la solution déployée, faire **un seul** `Ctrl+Shift+R` (hard reload).
Le nouveau SW s'installera et les déploiements futurs se propageront automatiquement.

## Leçons
- Toujours bumper `CACHE_VERSION` du SW à chaque release frontend
- `skipWaiting()` + `clients.claim()` nécessaires pour propagation immédiate
- Le cache navigateur (HTTP max-age) se cumule au cache SW → double couche d'obsolescence
