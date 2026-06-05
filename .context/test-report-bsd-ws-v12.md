# Test Report — BSD WS v12
**Date**: 2026-05-24
**Scope**: server.js ~36163–36433 + pariscore.html SSE consumers
**Method**: adversarial static review (ps-test methodology)

---

## ✅ Tests passés

1. **_wsGuardedPatch null/undefined guard** — ligne 36178: `if (value === null || value === undefined) return;` bloque correctement les valeurs vides.

2. **pair() partial data (un seul côté)** — `pair(vh, va)` retourne `undefined` uniquement si les deux sont null; si un seul est fourni, il retourne `{ home: N, away: null }`. Correct : _wsGuardedPatch écrit un objet partiel plutôt que de tout bloquer.

3. **ratioObj() partial data** — vérifie `vh == null && va == null` avant de map. Correct.

4. **_bsdMergeShotmap NaN filter** — `.filter(e => Number.isFinite(e.m) && Number.isFinite(e.v))` après `Number()` élimine les NaN. Correct.

5. **_bsdNormalizeIncident sequence null safety** — `s.pos ? { x: Number(s.pos.x), y: Number(s.pos.y) } : null` et idem pour `s.end`, `s.gk`. Ternaire correct.

6. **msg.time.minute != null check** — ligne 36320: `if (msg.time.minute != null)` utilise `!= null` (loose inequality), donc minute=0 est correctement patché (0 != null est true). Pas de bug falsy ici.

7. **_bsdLiveEnrichState purge Map** — `for (const [id] of _bsdLiveEnrichState)` itère sur un snapshot des clés, la suppression dans la boucle est safe en JS.

8. **pollBSDLiveEnrichment error handling** — TTL avancé dans le bloc `catch` (ligne 36419, 36427), évite les appels unbounded en cas d'erreur répétée.

9. **bsdFetch signature** — `async function bsdFetch(endpoint, retries = 2)` (ligne 2791). Appelé dans pollBSDLiveEnrichment avec un seul argument `bsdFetch('/api/v2/events/${eid}/incidents/')`. Correct — deuxième arg optionnel.

10. **bsdFetch retour** — retourne `res` (l'objet httpsGet complet). `res.status` et `res.data` sont les bons champs (confirmé par usage dans fetchBSDCompareOdds ligne 2825: `res.status !== 200 || !res.data`).

11. **_bsdMergeIncidents dedup key** — inclut `home_score/away_score` pour distinguer buts même minute (own goals, shootout). Robuste.

12. **_bsdMergeIncidents cap** — `m.live_incidents.slice(-50)` limite la mémoire. Correct.

13. **is_live assignment** — assigné à `true` ligne 17769 (`state === 'in'`) et 17892, ligne 30352. La gate `m.is_live` dans pollBSDLiveEnrichment est fonctionnelle pour les matchs passant par le pipeline BSD standard.

14. **SSE ws_event — live_momentum array guard** — ligne 36606: `Array.isArray(m.live_momentum) ? m.live_momentum : null`. Correct (bd 8c5).

15. **_bsdNormalizeIncident SUPPORTED Set** — filtre les types inconnus avant de les pousser. Correct.

---

## ⚠️ Avertissements

### WR-1 — `live_websocket` jamais assigné → pollBSDLiveEnrichment ne tourne jamais
**server.js:36402**

```js
const targets = db.matches.filter(m => m && m._bsd_event_id != null && m.live_websocket && m.is_live);
```

`m.live_websocket` n'est **jamais assigné nulle part dans server.js**. Grep complet : 0 résultat hors cette ligne. Résultat : `targets` sera toujours vide, pollBSDLiveEnrichment retourne immédiatement, et les enrichissements incidents/shotmap ne s'exécutent jamais en production.

**Fix** : soit supprimer la condition `m.live_websocket` (la double condition `_bsd_event_id != null && is_live` est déjà suffisante), soit l'assigner lors de la subscription WS dans `_bsdWsSubscribe` / `pollLiveScores`.

```js
// Option A — supprimer le guard mort :
const targets = db.matches.filter(m => m && m._bsd_event_id != null && m.is_live);

// Option B — assigner dans pollLiveScores au moment du subscribe :
m.live_websocket = true; // après _bsdWsSubscribe(m._bsd_event_id)
```

---

### WR-2 — Champ `{m, v}` vs `pt.min` : BSD REST momentum silencieusement ignoré
**server.js:36378 / pariscore.html:24445, 31754**

`_bsdMergeShotmap` écrit `m.live_momentum` avec des objets `{ m: Number, v: Number }` (clé `m`).

Les deux consommateurs frontend lisent `pt.min` :
- `_renderMomentumBars` (pariscore.html:24445) : `if (pt.min == null) return;`
- `drawLDMomentumSVG` (pariscore.html:31754) : `pt?.min != null ? pt.min : 0`

Conséquence : tous les points de momentum venant de l'API REST BSD sont traités comme minute=0 par drawLDMomentumSVG (fallback `0`), et complètement sautés par `_renderMomentumBars` (le guard `pt.min == null` retourne — `undefined == null` est true). Le graphe momentum REST BSD ne s'affiche pas du tout dans le Live Dashboard.

**Fix** : aligner le schema. Préférence : corriger le serveur pour émettre `{ min: …, v: … }` afin de rester compatible avec le format Sofascore déjà attendu partout.

```js
// _bsdMergeShotmap server.js:36378 — changer 'm' en 'min':
const cleaned = data.momentum
  .filter(e => e && e.m != null && e.v != null)
  .map(e => ({ min: Number(e.m), v: Math.max(-100, Math.min(100, Number(e.v))) }))
  .filter(e => Number.isFinite(e.min) && Number.isFinite(e.v));
```

---

### WR-3 — `added_time: m.live_added_time || null` supprime les valeur 0 (arrêt de jeu minute 0)
**server.js:36592**

```js
added_time: m.live_added_time || null,
```

`|| null` évalue 0 comme falsy. Si BSD envoie `added_time: 0` (aucun temps additionnel), le champ est broadcast comme `null` au lieu de `0`. Le frontend ne peut pas distinguer "0 minutes de temps additionnel" de "pas de données". Même problème pour `minute: m.live_minute || null` ligne 36591 — un match débutant à la minute 0 aurait `minute: null`.

**Fix** : utiliser `?? null` (nullish coalescing) au lieu de `|| null` pour les champs numériques.

```js
minute:     m.live_minute      ?? null,
added_time: m.live_added_time  ?? null,
```

---

### WR-4 — v12 champs broadcast SSE non lus par le handler `ws_event` frontend
**pariscore.html:25058–25085 / server.js:36608–36617**

Le serveur broadcast 9 nouveaux champs dans `ws_event` (live_saves, live_interceptions, live_recoveries, live_aerial_duels, live_crosses, live_woodwork, live_goals_prevented, live_tackles, live_clearances). Le handler `ws_event` frontend (pariscore.html:25067–25078) n'en lit **aucun**. Ces champs arrivent sur le client mais ne sont pas appliqués à l'objet `m` en mémoire.

Impact : si le modal Live Detail est ouvert pendant un match et se rafraîchit via `ws_event`, les nouvelles stats v12 ne sont pas mises à jour en temps réel (elles le sont via `live_patch` SSE ou rechargement complet, mais pas via le path ws_event).

**Fix** : ajouter les assignations dans le handler `ws_event` :

```js
// pariscore.html ~25078, après live_touches_opp_box :
if (d.live_saves)              m.live_saves              = d.live_saves;
if (d.live_interceptions)      m.live_interceptions      = d.live_interceptions;
if (d.live_recoveries)         m.live_recoveries         = d.live_recoveries;
if (d.live_aerial_duels)       m.live_aerial_duels       = d.live_aerial_duels;
if (d.live_crosses)            m.live_crosses            = d.live_crosses;
if (d.live_woodwork)           m.live_woodwork           = d.live_woodwork;
if (d.live_goals_prevented)    m.live_goals_prevented    = d.live_goals_prevented;
if (d.live_tackles)            m.live_tackles            = d.live_tackles;
if (d.live_clearances)         m.live_clearances         = d.live_clearances;
```

---

### WR-5 — `live_incidents`, `live_xg_per_minute`, `live_shotmap` absents du broadcast SSE `ws_event`
**server.js:36588–36618**

Ces trois champs sont peuplés par `pollBSDLiveEnrichment` (REST poll 30s/60s) mais ne sont inclus dans **aucun** des broadcasts SSE existants (`ws_event`, `live_patch`, `live_ws`). Le client ne les reçoit jamais en temps réel — ils ne sont visibles qu'au rechargement initial `/api/v1/matches`.

**Fix** : soit les ajouter au payload `ws_event`, soit créer un broadcast dédié `enrich_patch` déclenché à la fin de `pollBSDLiveEnrichment` après une mise à jour.

---

### WR-6 — `_WS_STATIC_FIELDS` protège `'stats'` mais pas `'live_stats'` — asymétrie potentielle
**server.js:36173**

`'stats'` est dans le Set (protège les statistiques pré-match calculées). `'live_stats'` est un champ distinct (visible ligne 36083 : `live_stats: m.live_stats`) et n'est pas protégé. Ce n'est pas un bug actuel car les fonctions v12 n'écrivent pas `live_stats` directement via `_wsGuardedPatch`, mais un futur appel `_wsGuardedPatch(m, 'live_stats', x)` pourrait écraser les stats live Sofascore par des stats BSD WS si les schemas divergent.

**Fix** : si `live_stats` doit rester sous contrôle exclusif du pipeline Sofascore, l'ajouter au Set de protection.

---

### WR-7 — `passes` : fallback `h.passes || h.accurate_passes` peut mixer deux métriques différentes
**server.js:36265**

```js
const passes = p(h.passes || h.accurate_passes, a.passes || a.accurate_passes);
```

`passes` (passes totales) et `accurate_passes` (passes réussies) sont des métriques différentes. Si BSD envoie uniquement `accurate_passes`, le champ `live_passes` contiendra le nombre de passes précises, pas le total — sans que l'UI ni les logs le signalent. La précision du pass accuracy ratio s'en trouve faussée.

**Fix** : traiter séparément, ou utiliser un champ canonique unique.

```js
const passes    = p(h.passes, a.passes);            if (passes !== undefined) _wsGuardedPatch(m, 'live_passes', passes);
const accPasses = p(h.accurate_passes, a.accurate_passes); if (accPasses !== undefined) _wsGuardedPatch(m, 'live_accurate_passes', accPasses);
```

---

## ❌ Bugs détectés

### BUG-1 — `pollBSDLiveEnrichment` entièrement dead-code en production (WR-1 amplifié)
**server.js:36402** — CRITIQUE (feature complète non fonctionnelle)

Comme établi en WR-1, `m.live_websocket` n'étant jamais `true`, la fonction filtre systématiquement à zéro cibles. Résultat : **aucun incident, aucun shotmap, aucune timeline xG/minute ne sera jamais chargé**. Le fire-and-forget ligne 36092 s'exécute mais fait du no-op immédiat. L'ensemble de la feature v12 REST enrichment est inerte.

**Preuve** :
```
grep -n "live_websocket" server.js
# Résultat : 1 seule ligne (36402) — jamais assigné
```

---

### BUG-2 — BSD REST momentum (`{m,v}`) silencieusement non rendu (WR-2 amplifié)
**server.js:36378 / pariscore.html:24445** — CRITIQUE (rendu brisé, données perdues)

Même si BUG-1 est corrigé et que `_bsdMergeShotmap` s'exécute, le graphe momentum REST BSD ne s'affichera pas car le champ est `e.m` côté serveur et `pt.min` côté client. `_renderMomentumBars` retourne immédiatement pour chaque point (`pt.min == null` → skip). `drawLDMomentumSVG` calcule `m = 0` pour tous les points, compressant toute la timeline sur la minute 0.

---

### BUG-3 — `_bsdNormalizeIncident`: types `'card'` (générique) non capturé dans SUPPORTED
**server.js:36337** — WARNING

Le Set SUPPORTED contient `'yellowcard'` et `'redcard'` mais pas `'card'`. Or le normalize ligne 36335 fait `tLow = String(inc.type).toLowerCase().replace(/[-_\s]/g, '')`. Si BSD envoie `type: "card"` (générique, possible selon doc), l'incident est rejeté (retourne null). La détection `tLow.includes('card')` ligne 36348 ne sera jamais atteinte pour ce type.

**Fix** : ajouter `'card'` au Set SUPPORTED et gérer le cas dans la branche `else if (tLow.includes('card'))`.

```js
const SUPPORTED = new Set([..., 'card', ...]);
```

---

## 💡 Recommandations

1. **Prioriser BUG-1** : c'est le bloqueur le plus simple à corriger (supprimer `&& m.live_websocket` du filtre). Sans ce fix, toute la feature REST enrichment v12 est morte.

2. **Prioriser BUG-2 immédiatement après** : corriger `m` → `min` dans `_bsdMergeShotmap` (une seule ligne serveur).

3. **Test de non-régression momentum** : après correction BUG-2, vérifier que le Sofascore momentum (format `{min, v}` existant) n'est pas écrasé par les données BSD REST, car `_bsdMergeShotmap` écrit directement `m.live_momentum = cleaned` sans passer par `_wsGuardedPatch`. Si le Sofascore a déjà peuplé `live_momentum`, BSD REST peut l'écraser à chaque poll 60s.

4. **WR-4 facile** : les 9 assignations frontend `ws_event` sont du copier-coller, ~10 lignes, effort minimal pour que les stats v12 soient réactives sans rechargement.

5. **WR-5 à arbitrer** : décider si `live_incidents` mérite un canal SSE dédié ou si le rechargement initial est suffisant (matchday UX).

6. **Ajouter un log de démarrage** dans `pollBSDLiveEnrichment` : `console.log('[BSD-Enrich] targets=', targets.length)` pour détecter immédiatement ce type de filtre mort en prod.

---

## Résumé

| ID | Sévérité | Statut | Description |
|---|---|---|---|
| BUG-1 | Critique | ❌ | `live_websocket` jamais assigné → enrichment REST entièrement mort |
| BUG-2 | Critique | ❌ | Champ `{m,v}` vs `pt.min` → momentum BSD REST non rendu |
| BUG-3 | Warning | ❌ | Type `'card'` générique rejeté par SUPPORTED |
| WR-1 | Warning | ⚠️ | live_websocket jamais assigné (détail BUG-1) |
| WR-2 | Warning | ⚠️ | Schema momentum mismatch (détail BUG-2) |
| WR-3 | Warning | ⚠️ | `|| null` coerce minute=0 et added_time=0 en null |
| WR-4 | Warning | ⚠️ | 9 champs v12 broadcast mais non lus par handler ws_event frontend |
| WR-5 | Warning | ⚠️ | incidents/shotmap/xg_per_minute absents de tous les broadcasts SSE |
| WR-6 | Info | ⚠️ | live_stats non protégé dans _WS_STATIC_FIELDS |
| WR-7 | Info | ⚠️ | passes vs accurate_passes fallback peut mixer deux métriques |
