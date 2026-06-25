# P1.4 — Audit SSE Connection Leak

> Date : 2026-06-25
> Source : `todo.md` P1.4 + `PLAN_SPRINT.md`
> Scope : audit code-only (pas de test runtime, pas de déploiement)

---

## Méthodologie

1. Recensement de toutes les SSE `text/event-stream` côté serveur (`server.js`)
2. Recensement de toutes les `EventSource` côté frontend (`pariscore.js`)
3. Vérification du lifecycle : ajout dans le Set/Map global, cleanup sur `req.on('close')`, heartbeat, gestion d'erreur
4. Identification des patterns à risque (leak potentiel)

---

## SSE Endpoints côté serveur (`server.js`)

| # | Route | Ligne | Set global | Heartbeat | `req.on('close')` | Statut |
|---|---|---|---|---|---|---|
| 1 | `GET /api/v1/live` | 20772 | `sseClients` (Set global) | 30s | ✅ `clearInterval(hb)` + `sseClients.delete(res)` | ✅ OK |
| 2 | `GET /api/v1/tennis/rg-live-stream` | 39253 | `_rgLiveSseClients` (Set global) | 25s | ✅ `clearInterval(heartbeat)` + `_rgLiveSseClients.delete(res)` | ✅ OK |
| 3 | `GET /api/v1/admin/power-score` (cache hit) | 43353 | aucun (one-shot, `res.end()` immédiat) | N/A | N/A | ✅ OK |
| 4 | `GET /api/v1/admin/power-score` (live) | 43368 | aucun, mais `setInterval` streaming | implicite via `req.on('close', () => { try { gemReq.destroy(); } catch { } })` (ligne 43437) | ⚠ Voir #1 |
| 5 | `GET /api/v1/insights/deep-stream-v2` (cache hit) | 43890 | aucun, mais `setInterval(iv)` 20ms | N/A | ✅ `req.on('close', () => clearInterval(iv))` (43917) | ✅ OK |
| 6 | `GET /api/v1/insights/deep-stream-v2` (live) | 43890 | aucun | N/A | ⚠ Voir #2 |

### ⚠ Risque #1 — Power Score live streaming (server.js:43368-43440)

**Code path** :
```js
res.writeHead(200, { 'Content-Type': 'text/event-stream', ... });
// ... construction prompt
const gemReq = https.request(...);
gemReq.on('response', ...); // streaming
gemReq.end();
req.on('close', () => { try { gemReq.destroy(); } catch { } });
```

**Problèmes identifiés** :
- ❌ Aucun heartbeat SSE → si la connexion client reste ouverte mais inactive > 60s, nginx peut couper (par défaut `proxy_read_timeout 60s`)
- ❌ Si `gemReq` ne respond jamais (Gemini API KO), le `req.on('close')` ne se déclenchera que si le client ferme — or le client attend indéfiniment
- ❌ Pas de timeout explicite sur `https.request` → peut rester ouvert indéfiniment
- ⚠ Si `gemReq` émet une erreur non gérée, le `res` n'est pas fermé → leak socket

**Recommandation** : ajouter `gemReq.setTimeout(45000, () => { gemReq.destroy(new Error('gemini_timeout')); })` et un heartbeat 25s similaire à RG live-stream.

### ⚠ Risque #2 — Deep Stream v2 live (server.js:43890-44043)

**Code path** :
```js
res.writeHead(200, { 'Content-Type': 'text/event-stream', ... });
// ... construction prompt
// Stream Gemini réponse vers client via setInterval-like (boucle chunk par chunk)
req.on('close', () => { }); // LIGNE 44041 — corps vide !
```

**Problèmes identifiés** :
- 🔴 **Bug critique** : `req.on('close', () => { })` ligne 44041 — corps vide, ne cleanup rien
- 🔴 Aucun heartbeat SSE
- 🔴 Aucun timeout sur la requête Gemini sous-jacente
- 🔴 Si le client ferme l'onglet, le stream Gemini continue de générer des chunks → gaspillage quota Gemini + socket leak

**Recommandation** : 
1. Implémenter le cleanup dans le `req.on('close')` : détruire la requête Gemini en cours + clear interval
2. Ajouter heartbeat 25s
3. Ajouter timeout 45s sur la requête Gemini

---

## EventSource côté frontend (`pariscore.js`)

| # | Route | Ligne | Variable | `.close()` appelé | Statut |
|---|---|---|---|---|---|
| 1 | `/api/v1/tennis/rg-live-stream` | 687 | `window._rgLiveEs` | ❌ Jamais | 🔴 Leak potentiel |
| 2 | `/api/v1/tennis/rg-live-stream` (deuxième instance) | 6502 | `window._psLtsEs` | ❌ Jamais | 🔴 Leak potentiel |
| 3 | `/api/v1/live` | 10735 | `sseConnection` (var globale) | ✅ Ligne 10733 avant `new EventSource()` | ✅ OK |
| 4 | `gmEventSource` (Gemini) | 14140, 14146, 18484 | `gmEventSource` | ✅ Avant chaque nouvelle ouverture + sur tab switch | ✅ OK |
| 5 | `psEventSource` (PowerScore) | 14388, 18350, 18483 | `psEventSource` | ✅ Sur tab switch + fermeture modal | ✅ OK |
| 6 | `_deepEvt` (Deep Stream) | 25476, 25517, 25595, 25611, 25645 | `_deepEvt` | ✅ Avant chaque nouvelle + sur done/error + cleanup explicite | ✅ OK |

### 🔴 Leak #1 — `window._rgLiveEs` (pariscore.js:687)

```js
(function() {
  if (window._rgLiveSseInit) return;
  window._rgLiveSseInit = true;
  try {
    const es = new EventSource('/api/v1/tennis/rg-live-stream');
    // ...
    window._rgLiveEs = es;
  } catch (_) {}
})();
```

**Problème** : Singleton global, jamais fermé. Si l'utilisateur navigue hors de la page RG puis revient, `_rgLiveSseInit` reste `true` donc la connexion est réutilisée — OK. Mais si la page RG n'est plus visitée, la connexion SSE reste ouverte indéfiniment en arrière-plan, consommant un slot sur le serveur (limite navigateur 6 EventSource par domaine).

**Recommandation** : ajouter un cleanup sur `showPage()` quand l'utilisateur quitte la page RG :
```js
if (pageId !== 'rg' && window._rgLiveEs) {
  try { window._rgLiveEs.close(); } catch (_) {}
  window._rgLiveEs = null;
  window._rgLiveSseInit = false;
}
```

### 🔴 Leak #2 — `window._psLtsEs` (pariscore.js:6502)

Même pattern que #1 : singleton global jamais fermé. Une seconde EventSource vers la **même route** SSE que #1 (doublon potentiel — une seule suffirait).

**Recommandation** :
1. Factoriser #1 et #2 en une seule EventSource partagée (évite 2 connexions vers la même route)
2. Ajouter cleanup sur navigation hors page tennis

---

## Synthèse

| Risque | Severity | Fichier | Impact |
|---|---|---|---|
| Power Score live sans heartbeat ni timeout | MED | `server.js:43368-43440` | Socket leak si Gemini KO |
| Deep Stream v2 `req.on('close')` vide | HIGH | `server.js:44041` | Socket leak + gaspillage quota Gemini |
| `_rgLiveEs` jamais fermé | MED | `pariscore.js:687` | Connexion fantôme, limite 6 EventSource |
| `_psLtsEs` jamais fermé + doublon avec `_rgLiveEs` | MED | `pariscore.js:6502` | Idem + 2 connexions vers même route |

## Plan de correction recommandé

| # | Tâche | Effort | Priorité |
|---|---|---|---|
| 1 | Fix `req.on('close')` Deep Stream v2 — destroy Gemini request + clear interval | 15 min | HIGH |
| 2 | Ajouter heartbeat 25s sur Power Score + Deep Stream v2 | 20 min | MED |
| 3 | Ajouter `setTimeout(45000)` sur requêtes Gemini | 15 min | MED |
| 4 | Cleanup `_rgLiveEs` sur navigation hors page RG | 10 min | MED |
| 5 | Factoriser `_rgLiveEs` + `_psLtsEs` en EventSource partagée | 30 min | LOW |
| 6 | Test runtime : `lsof -i :3000 \| grep ESTABLISHED` après 1h de trafic | 30 min | — |

## Conclusion

L'audit révèle **2 bugs critiques** (Deep Stream v2 `req.on('close')` vide) et **2 leaks potentiels** côté frontend (EventSource singletons jamais fermés). Le pattern de base (Set global + heartbeat + `req.on('close')` cleanup) est correctement appliqué sur les 2 routes SSE principales (`/api/v1/live` et `/api/v1/tennis/rg-live-stream`) — c'est sur les routes SSE secondaires (Power Score, Deep Stream) que le cleanup est incomplet.

**Recommandation** : traiter en priorité le fix Deep Stream v2 (HIGH) — c'est le seul risque réel de fuite socket en production. Les autres sont des optimisations de qualité.
