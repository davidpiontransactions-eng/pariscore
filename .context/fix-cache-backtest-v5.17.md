# Fix Cache Matchs + Backtest UI — v5.17

## Problème : Force Refresh requis pour voir les "Matchs à venir"

### Root Cause
Le serveur ne mettait pas à jour les matchs automatiquement car :

1. **Cache 12h trop long** — `API_CACHE_TTL = 12 * 3600 * 1000` (12 heures)
2. **Early return sans vérification** — `fetchOdds()` retournait immédiatement si le cache existait, sans vérifier si les matchs étaient toujours dans le futur
3. **Pas de scheduler quotidien** — Aucun refresh forcé chaque matin pour charger les nouveaux matchs du jour

### Scénario avant fix
```
T0 12:00 → fetchOdds() charge 20 matchs (tous aujourd'hui)
T0 14:00 → Cron 12h → cache valide → SKIP ❌
T0 18:00 → 20 matchs terminés → aucun match à venir ❌
T0 19:00 → User ouvre app → "Aucun match" → Force refresh requis ❌
T0 19:01 → fetchOdds(true) → 20 nouveaux matchs chargés ✅
```

### Scénario après fix
```
T0 12:00 → fetchOdds() charge 20 matchs
T0 14:00 → Cron → cache OK + matchs à venir → SKIP ✅
T0 18:00 → Cron → cache OK mais TOUS matchs passés → FORCE REFRESH ✅
T0 19:00 → User ouvre app → 20 nouveaux matchs disponibles ✅
T1 06:00 → Morning refresh → force fetch pour demain ✅
```

## Changes apportées

### 1. server.js — Cache freshness check (line ~2422)
```javascript
// AVANT : Skip si cache existe
if (!force && cacheData && db.matches.length > 0) {
  console.log(`  [Cron:Odds] ⚡ Données en cache — skip API`);
  return; // ← PROBLÈME: même si tous les matchs sont passés
}

// APRÈS : Vérifie si matchs à venir existent
if (!force && cacheData && db.matches.length > 0) {
  const now = Date.now();
  const upcoming = db.matches.filter(m => new Date(m.commence_time).getTime() > now).length;
  const past = db.matches.length - upcoming;
  
  if (upcoming === 0) {
    console.log(`  [Cron:Odds] ⚠ Cache valide mais ${past} matchs passés — FORCING REFRESH`);
    // Continue → fetch new matches
  } else {
    console.log(`  [Cron:Odds] ⚡ Données en cache (${upcoming} à venir/${db.matches.length}) — skip API`);
    return;
  }
}
```

### 2. server.js — Morning refresh scheduler (line ~4828)
```javascript
function scheduleMorningRefresh() {
  // Calcule temps jusqu'à 6h00 Paris
  const target = new Date(parisNow);
  target.setHours(6, 0, 0, 0);
  if (target <= parisNow) target.setDate(target.getDate() + 1);
  
  setTimeout(() => {
    fetchOdds(true); // Force refresh
    setInterval(() => fetchOdds(true), 24 * 3600 * 1000); // Puis chaque 24h
  }, msUntil);
}
```

### 3. server.js — Backtest endpoint ouvert à Premium (line ~3823)
```javascript
// AVANT : Admin seul
if (!user || user.role !== 'admin') return jsonResponse(res, 403, { error: 'Accès refusé' });

// APRÈS : Admin + Premium
if (!user || (user.role !== 'admin' && user.role !== 'premium')) 
  return jsonResponse(res, 403, { error: 'Accès refusé — Premium requis' });
```

### 4. pariscore.html — Backtest UI (line ~1728)
```html
<div id="backtest-section" style="display:none;">
  <select id="backtest-days">
    <option value="7">7 jours</option>
    <option value="14">14 jours</option>
    <option value="30">30 jours</option>
  </select>
  <button onclick="triggerBacktest()">Lancer</button>
  <span id="backtest-status"></span>
</div>
```

### 5. pariscore.html — triggerBacktest() function
```javascript
async function triggerBacktest() {
  // Vérifie auth premium
  const days = document.getElementById('backtest-days').value;
  const res = await apiFetch('/api/v1/admin/backtest-bsd', {
    method: 'POST',
    body: JSON.stringify({ days: parseInt(days) })
  });
  // Affiche résultat: "✓ 23 vérifiés sur 30j · Over: 68% · BTTS: 72%"
  // Recharge l'historique automatiquement
}
```

## Comment ça marche maintenant

### Matchs à venir
1. **Cron 12h** — Vérifie si matchs à venir existent avant de skipper
2. **Auto-force** — Si tous les matchs sont passés → fetch automatique
3. **Morning refresh** — 6h00 Paris → force refresh pour charger les matchs du jour
4. **Log clair** — Affiche "3 matchs à venir/210" au lieu de "TTL valide"

### Back-testing
1. **UI Historique** — Section visible uniquement pour Premium/Admin
2. **Select** — 7, 14 ou 30 jours à back-tester
3. **Résultat** — Affiche nombre de matchs vérifiés + accuracy Over/BTTS
4. **Auto-reload** — Recharge les charts et KPIs après backtest

## Fichiers modifiés
- `server.js` — 3 changements (cache check + scheduler + endpoint auth)
- `pariscore.html` — 3 changements (UI + JS + init hook)
- `CLAUDE.md` — v5.16 → v5.17, session ajoutée
