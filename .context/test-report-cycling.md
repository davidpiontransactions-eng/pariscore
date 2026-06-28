# QA Report — Module Cyclisme (TDF 2026)

**Date :** 2026-06-28  
**Auditeur :** gsd-code-reviewer  
**Périmètre :** `pariscore.js` (frontend cycling block ~l.1105–1160), `pariscore.html` (#page-cycling ~l.22637), `services/cyclingService.js` (265 lignes), `server.js` (routage ~l.21608)

---

## Résumé

4 blocs audités : lifecycle frontend, rendu HTML, service backend, routage serveur.  
**1 BLOCKER**, **4 WARNING**, **2 INFO** trouvés.

Le module suit fidèlement le pattern F1 (Plackett-Luce, Monte-Carlo, 3 bets + grille). La plupart des défauts proviennent de la copie conforme du pattern F1 sans adaptation au contexte cyclisme.

---

## Blocker

### CR-01 : `_model()` exécuté DEUX FOIS par requête `/api/v1/cycling`

**Fichier :** `server.js:21612–21613`  
**Issue :** Le handler `/api/v1/cycling` appelle `cyclingService.getCyclingBets()` puis `cyclingService.getCyclingRiders()`. Chacune de ces fonctions appelle `await _model()` indépendamment, ce qui relance les 4000 simulations Monte-Carlo à chaque appel. Soit **8000 simulations par requête** — dont 4000 totalement redondantes.

```javascript
// server.js:21611-21613
const betsResp = await cyclingService.getCyclingBets();   // → _model()  = 4000 sims
const ridersResp = await cyclingService.getCyclingRiders(); // → _model()  = 4000 sims
```

**Fix :** Créer une seule fonction `getCyclingFull()` dans `cyclingService.js` qui appelle `_model()` une fois et renvoie `{ bets, riders }`, puis l'utiliser dans le handler `/api/v1/cycling`.

```javascript
// cyclingService.js — ajouter :
async function getCyclingFull() {
  var m = await _model();
  if (!m) return _empty('model_unavailable', { bets: [], riders: [] });
  return {
    ok: true, updatedAt: new Date().toISOString(),
    stage: m.stage, date: m.date, route: m.route, km: m.km,
    type: m.type, elev: m.elev, country: m.country,
    season: 2026, race: 'Tour de France',
    model: m.model, calibrated: m.calibrated, note: m.note, sims: m.sims,
    bets: m.bets, riders: m.riders,
  };
}

// server.js — remplacer :
const full = await cyclingService.getCyclingFull();
```

---

## Warnings

### WR-01 : Stale data affiché quand l'API retourne `{ ok: false }`

**Fichier :** `pariscore.js:1119`  
**Issue :** Quand l'API répond avec `{ ok: false }` (service indisponible, erreur modèle), la fonction met à jour le texte de statut mais **ne vide pas** les containers `cyc-bets`, `cyc-grid`, `cyc-note`. Les données de la précédente réponse restent visibles.

```javascript
.then(function(j) {
  // ...
  if (!j || j.ok === false) { if (st) st.textContent = '...'; return; }
  // ← bets/grid/note ne sont PAS nettoyés
```

**Fix :** Ajouter le cleanup avant le `return` :

```javascript
if (!j || j.ok === false) {
  if (st) st.textContent = 'Données cyclisme indisponibles';
  var bc = document.getElementById('cyc-bets'); if (bc) bc.innerHTML = '';
  var gc = document.getElementById('cyc-grid'); if (gc) gc.innerHTML = '';
  if (nt) nt.textContent = '';
  return;
}
```

### WR-02 : `getCyclingRiders()` — clé dupliquée `stage`

**Fichier :** `services/cyclingService.js:252–256`  
**Issue :** La clé `stage` apparaît deux fois dans l'objet retourné (lignes 252 et 256). En JS, la seconde écrase la première → le résultat est correct mais la première assignation est du **dead code** qui nuit à la lisibilité.

```javascript
return {
  ok: true, ...,
  stage: m.stage, date: m.date, route: m.route, type: m.type,  // ← 1ère fois (l.252)
  model: m.model, calibrated: m.calibrated,
  stage: m.stage, riders: m.riders,                              // ← 2ème fois (l.256)
};
```

**Fix :** Supprimer la première occurrence de `stage` (ligne 252).

### WR-03 : Aucun `catch` de rejet individuel dans `initCyclingPage`

**Fichier :** `pariscore.js:1108–1112`  
**Issue :** `initCyclingPage()` est wrappée dans un `try/catch` au niveau de `showPage` (l.943), mais si `_fetchAndRenderCycling()` rejette une promesse (hors HTTP, ex: `fetch` échoue avec une TypeError réseau), le `.catch()` à la ligne 1126 le gère correctement. Cependant, `setInterval(() => ..., 300000)` crée un intervalle même si le premier appel échoue. Si le réseau est mort, les polling successifs vont tous échouer sans backoff.

C'est un défaut mineur — le même pattern existe pour F1 et NBA. À noter pour robustesse.

**Fix (optionnel) :** Ajouter un délai exponentiel ou stopper le poll si 3 échecs consécutifs.

### WR-04 : `_renderCyclingBets` — pas de protection `null` sur les items du tableau

**Fichier :** `pariscore.js:1140`  
**Issue :** Le `.map()` itère sans vérifier que chaque élément `b` n'est pas `null`/`undefined`. Si l'API renvoie un tableau avec un trou (`[null, {...}]`), `b.probPct` lève `TypeError`.

```javascript
c.innerHTML = bets.map(function (b) {
  var pct = (b.probPct != null) ? b.probPct : ...; // TypeError si b est null
```

Même défaut dans F1 (`_renderF1Bets`, l.1079). Probabilité faible (l'API ne génère que des objets valides), mais défense manquante.

**Fix :** Filtrer les nulls avant le map :

```javascript
c.innerHTML = bets.filter(Boolean).map(function (b) { ... }).join('');
```

---

## Info

### IN-01 : Grille vide — message absent (contrairement aux bets)

**Fichier :** `pariscore.js:1151`  
**Issue :** Quand `riders.length === 0`, la grille est effacée sans message utilisateur (`c.innerHTML = ''`). Les bets, eux, affichent `'<div class="cyc-empty">Aucun bet disponible</div>'`.

```javascript
// Bets — indique l'état vide
if (!bets.length) { c.innerHTML = '<div class="cyc-empty">Aucun bet disponible</div>'; return; }

// Riders — ne dit rien
if (!riders.length) { c.innerHTML = ''; return; }
```

**Suggestion :** Ajouter un message vide pour la grille, par ex. `'<div class="cyc-empty">Aucun coureur disponible</div>'`.

### IN-02 : `route` de l'étape non affichée dans le statut

**Fichier :** `pariscore.js:1121`  
**Issue :** La réponse API contient `j.route` (ex: `"Barcelona → Barcelona"`) mais le statut n'affiche que `Étape N · DATE · X simulations`. Le profil (`j.type`) et le parcours (`j.route`) ne sont pas visibles, contrairement à F1 qui affiche le nom du circuit via `j.race.name`.

**Suggestion :** Ajouter le type d'étape et le parcours :

```javascript
if (st) st.textContent = 'Étape ' + (j.stage || '') + ' · ' + (j.route || '') + ' · ' + (j.type || '') + ' · ' + (j.date || '') + ' · ' + Number(j.sims || 0).toLocaleString('fr') + ' simulations' + (j.calibrated ? '' : ' · non calibré');
```

---

## Vérification de conformité

| Élément | Statut | Détail |
|---|---|---|
| **IDs HTML** | ✅ | `cyc-status`, `cyc-race-badge`, `cyc-note`, `cyc-bets`, `cyc-grid` — tous matchent JS |
| **Classes CSS** | ✅ | `cycbet`, `cycbet-ring`, `cycbet-ico`, `cycbet-type`, `cycbet-pick`, `cycbet-foot`, `cycbet-info`, `cycbet-team`, `cycbet-ci`, `cyc-empty`, `cycdrv`, `cycdrv-h`, `cycdrv-pos`, `cycdrv-ava`, `cycdrv-id`, `cycdrv-name`, `cycdrv-type`, `cycdrv-team`, `cycdrv-bars`, `cycbar`, `cycbar--pod`, `cycdrv-top10` — tous définis dans `<style>` |
| **État chargement** | ✅ | `<div class="cyc-status">Chargement…</div>` présent en HTML statique |
| **État vide (bets)** | ✅ | `'<div class="cyc-empty">Aucun bet disponible</div>'` |
| **État vide (grid)** | ⚠️ | `c.innerHTML = ''` — pas de message (IN-01) |
| **Escaping XSS** | ✅ | `_cycEsc()` utilisé pour tout texte utilisateur ; `textContent` pour status/note |
| **Nav desktop** | ✅ | `<a data-page="cycling">CYCLISME</a>` avant `CdM 2026` (l.12410) |
| **Nav mobile (bottom)** | ✅ | `<a data-page="cycling">Cyclisme</a>` après F1 (l.12493) |
| **showPage routing** | ✅ | stop/init cycling adjacent à F1 (l.942–943) |
| **Lifecycle poll** | ✅ | stop → clearInterval ; init → fetch + setInterval 5 min |
| **Service exports** | ✅ | `getCyclingStages`, `getCyclingBets`, `getCyclingRiders` — tous utilisés |
| **Routes serveur** | ✅ | `GET /api/v1/cycling`, `/api/v1/cycling/bets`, `/api/v1/cycling/races` |
| **Error handler serveur** | ✅ | catch → `{ ok: false, error: e.message }` |

---

## Vue d'ensemble

| Catégorie | Nombre |
|---|---|
| **BLOCKER** | 1 |
| **WARNING** | 4 |
| **INFO** | 2 |
| **Total** | 7 |

**Priorité immédiate :** Corriger le double appel à `_model()` dans `server.js` (CR-01) — divise la charge CPU du Monte-Carlo par 2 sans changer une ligne de logique métier.

---

*Rapport généré le 2026-06-28 par gsd-code-reviewer*
