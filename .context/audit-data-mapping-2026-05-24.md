# Audit Data Mapping — PariScore End-to-End
**Date:** 2026-05-24 | **Auteur:** Lead Data Architect (systematic-debugging)  
**Périmètre:** BSD → server.js → pariscore.html (Football + Tennis)

---

## SYNTHÈSE EXÉCUTIVE

| Niveau | Bugs trouvés |
|--------|-------------|
| 🔴 BLOQUANT | 2 (dont 2 déjà corrigés ce jour) |
| 🟠 MAJEUR | 4 |
| 🟡 MINEUR | 2 |

---

## 🔴 BLOQUANTS

### BUG-01 — surfaceClean toujours null (CORRIGÉ commit a89a1bb)
**Fichier:** `server.js:28674`  
**Symptôme:** `surf_rank`, `surf_form` = null pour TOUS les matchs tennis.

```javascript
// AVANT (cassé) — .toLowerCase() vs array Title Case → always false
TENNIS_ELO_SURFACES.includes(String(_surfN).toLowerCase())
// = includes('clay') contre ['Clay'] = FALSE

// APRÈS (fix)
const _surfNorm = _surfRaw.charAt(0).toUpperCase() + _surfRaw.slice(1).toLowerCase();
TENNIS_ELO_SURFACES.includes(_surfNorm) // = includes('Clay') = TRUE
```

---

### BUG-02 — tourGuess null pour circuits BSD non-standard (CORRIGÉ commit a89a1bb)
**Fichier:** `server.js:28667`  
**Symptôme:** Zéro Elo, surf_rank, Markov pour tout match BSD sauf exact `'ATP'`/`'WTA'`.

BSD envoie : `'ATP 250'`, `'WTA 1000'`, `'Grand Slam'`, `'ATP Tour'` → ancienne garde retournait null.

```javascript
// AVANT (cassé)
['ATP', 'WTA'].includes(String(_tourN).toUpperCase()) ? ... : null

// APRÈS (fix)
if (t === 'ATP' || t === 'WTA') return t;
if (t.startsWith('ATP')) return 'ATP';
if (t.startsWith('WTA')) return 'WTA';
// Grand Slam fallback : gender depuis player1.gender
```

---

## 🟠 MAJEURS

### BUG-03 — `player1.rank` (classement ATP/WTA) jamais injecté dans le match
**Fichier:** `server.js:28872` + `pariscore.html:19949`  
**Symptôme:** Frontend affiche `RK —` même quand `surf_rank` est corrigé.

**Traçage :**
```
pariscore.html:19949  →  m.player1.rank       ← LU
server.js:28872       →  Object.assign({ name }, m.player1 || {}, { surf_rank, ... })
                      ←  m.player1 vient de BSD : BSD ne fournit PAS rank ATP/WTA
DB tennis_players_elo →  atp_rank, wta_rank existent en base
                      ←  JAMAIS lookupés et attachés au match payload
```

**Zone morte confirmée :** `atp_rank`/`wta_rank` présents dans `tennis_players_elo` mais non reliés au pipeline d'enrichissement match.

**Correctif :**
```javascript
// server.js — dans enrichMatchRecord (après getTennisSurfStats, ~ligne 28840)
// Lookup ranking ATP/WTA depuis DB et attacher à player1/player2

function _getTennisPlayerRank(playerName, tour) {
  if (!playerName || !tour) return null;
  try {
    const row = sqldb.prepare(
      `SELECT atp_rank, wta_rank FROM tennis_players_elo
       WHERE LOWER(player_name) = LOWER(?) AND tour = ? LIMIT 1`
    ).get(playerName.trim(), tour);
    if (!row) return null;
    return tour === 'ATP' ? row.atp_rank : row.wta_rank;
  } catch (_) { return null; }
}

// Dans Object.assign player1/player2 (ligne 28850) :
player1: Object.assign({ name: p1Name }, m.player1 || {}, {
  surf_rank: _p1ss.rk,
  surf_rank_total: _p1ss.total,
  surf_form: _p1ss.form,
  l5_pts: _p1ss.l5_pts,
  l10_pts: _p1ss.l10_pts,
  powerscore: _p1ss.powerscore,
  ps_rank: _p1ss.ps_rank,
  ps_total: _p1ss.ps_total,
  rank: _getTennisPlayerRank(p1Name, tourGuess),  // ← AJOUT
}),
```

---

### BUG-04 — `player1.elo_surface` jamais calculé pour la réponse match
**Fichier:** `server.js:28872` + `pariscore.html:19949`  
**Symptôme:** `m.player1.elo_surface` toujours undefined sauf si BSD l'envoie (il ne l'envoie pas).

**Traçage :**
```
pariscore.html:19949  →  m.player1.elo_surface   ← LU
server.js:28688       →  eloProb = _tennisLookupEloPair(...)
                           → renvoie { p1_surface, p2_surface, p1_all, p2_all }
server.js:28872       →  Object.assign({}, m.player1 || {}, {...})
                           → eloProb.p1_surface JAMAIS injecté dans player1
API response          →  predictions.elo.p1_surface existe
                           → mais frontend lit player1.elo_surface (clé différente)
```

**Correctif :**
```javascript
// Dans Object.assign player1 (ligne 28850) :
player1: Object.assign({ name: p1Name }, m.player1 || {}, {
  surf_rank: _p1ss.rk,
  ...
  rank: _getTennisPlayerRank(p1Name, tourGuess),
  elo_surface: (eloProb && eloProb.p1_surface) ? Math.round(eloProb.p1_surface) : null, // ← AJOUT
}),
player2: Object.assign({ name: p2Name }, m.player2 || {}, {
  surf_rank: _p2ss.rk,
  ...
  rank: _getTennisPlayerRank(p2Name, tourGuess),
  elo_surface: (eloProb && eloProb.p2_surface) ? Math.round(eloProb.p2_surface) : null, // ← AJOUT
}),
```

---

### BUG-05 — `bsd_xg` dead zone (BSD→backend OK, frontend ignore le champ)
**Fichier:** `server.js:12371` + `server.js:7773`  
**Symptôme:** xG réels BSD récupérés mais frontend n'affiche que le xG Poisson calculé.

**Traçage :**
```
BSD event              → e.actual_home_xg / e.home_xg_live
fetchBSDMatches:12371  → xg: { home: e.actual_home_xg || e.home_xg_live || null }
bsdToOddsApiFormat:13571 → bsd_xg: bsdMatch.xg
buildMatchRecord:7773  → record.bsd_xg = raw.bsd_xg || raw.xg || null

pariscore.html         → lit m.expectedGoals (Poisson calculé)
                         → m.bsd_xg JAMAIS utilisé dans le rendu
```

**Correctif recommandé :** Fusionner dans buildMatchRecord :
```javascript
// server.js ~ligne 7773 — après record.bsd_xg
// Si bsd_xg réel disponible, override expectedGoals.home/away
if (record.bsd_xg && (record.bsd_xg.home != null || record.bsd_xg.away != null)) {
  if (!record.expectedGoals) record.expectedGoals = {};
  if (record.bsd_xg.home != null) {
    record.expectedGoals.home = parseFloat(record.bsd_xg.home.toFixed(2));
    record.expectedGoals.home_source = 'bsd_real';
  }
  if (record.bsd_xg.away != null) {
    record.expectedGoals.away = parseFloat(record.bsd_xg.away.toFixed(2));
    record.expectedGoals.away_source = 'bsd_real';
  }
}
```

---

### BUG-06 — Gender detection fragile dans tourGuess fallback
**Fichier:** `server.js:28674` (fix BUG-02)  
**Symptôme:** Grand Slam WTA non détecté si BSD envoie `gender = 'W'` / `'WOMAN'` / `'WOMEN'`.

**Correctif :**
```javascript
// Remplacer la garde gender dans tourGuess
const p1g = m.player1 && (m.player1.gender || m.player1.sex);
if (p1g) {
  const g = String(p1g).toUpperCase().trim();
  const isWoman = g === 'F' || g === 'FEMALE' || g === 'W' || g === 'WOMAN' || g === 'WOMEN';
  return isWoman ? 'WTA' : 'ATP';
}
```

---

## 🟡 MINEURS

### BUG-07 — `bsd_xg` objet `{home:null, away:null}` truthy (faux positif)
**Fichier:** `server.js:7773`

```javascript
record.bsd_xg = raw.bsd_xg || raw.xg || null;
// Si bsd_xg = { home: null, away: null } → truthy → storé comme objet vide
// Consommateurs doivent toujours vérifier .home != null, pas juste bsd_xg
```

**Correctif :**
```javascript
const rawXg = raw.bsd_xg || raw.xg;
record.bsd_xg = (rawXg && (rawXg.home != null || rawXg.away != null)) ? rawXg : null;
```

---

### BUG-08 — `[TennisSurf] Skipped` spam logs en production
**Fichier:** `server.js:28848` (fix BUG-02/03 — bloc ajouté ce jour)

L'`else` log `[TennisSurf] Skipped` s'imprime pour chaque match football (où tourGuess=null est attendu). Ajouter filtre sport :

```javascript
} else if (tourGuess === null && _tourN && ['ATP','WTA'].some(t => String(_tourN).toUpperCase().includes(t))) {
  // Log uniquement si on attendait un tourGuess (circuit tennis reconnu mais non parsé)
  console.warn(`[TennisSurf] Skipped — tourGuess=${tourGuess} surfaceClean=${surfaceClean} circuit="${_tourN}"`);
}
```

---

## ARCHITECTURE DTO PROPOSÉE

### Pattern Validator sans dépendance npm (vanilla JS)

```javascript
// server.js — ajouter section "Schema Validators"

const SCHEMA = {
  bsdEvent: {
    required: ['id', 'home_team', 'away_team', 'event_date'],
    optional: ['odds_home', 'odds_away', 'odds_draw', 'actual_home_xg', 'status',
               'league', 'home_score', 'away_score', 'current_minute'],
  },
  tennisEnriched: {
    required: ['id', 'player1', 'player2', 'surface', 'tour'],
    optional: ['surf_rank', 'elo_surface', 'rank', 'surf_form', 'powerscore'],
  },
};

function validateSchema(obj, schema, label) {
  const missing = schema.required.filter(k => obj[k] == null);
  if (missing.length) {
    console.warn(`[Schema] ${label} — champs requis manquants: [${missing.join(', ')}]`);
    return false;
  }
  return true;
}

// Usage dans fetchBSDMatches (après collected.map) :
return collected
  .map(e => mapBSDEvent(e))
  .filter(e => validateSchema(e, SCHEMA.bsdEvent, 'BSD Event') || true); // log sans bloquer
```

### Activation du cache buffer sur échec validation

```javascript
// Intégrer dans fetchWithCacheBuffer (déjà déployé) :
// Le validator existant fait office de DTO guard.
// Si validator(freshData) = false → fallback cache 24h automatique.
// Ajouter log explicite :
if (!validator(freshData)) {
  console.warn(`[CacheBuffer] Schema mismatch ${source}/${dataKey} — fallback cache 24h activé`);
}
```

---

## PRIORITÉ D'APPLICATION DES CORRECTIFS

| # | Bug | Fichier | Effort | Impact |
|---|-----|---------|--------|--------|
| 1 | BUG-03 — `player1.rank` lookup DB | server.js:28850 | 30min | Affiche rang ATP/WTA dans RK badge |
| 2 | BUG-04 — `player1.elo_surface` inject | server.js:28850 | 15min | Affiche Elo surface dans badge |
| 3 | BUG-06 — Gender detection élargie | server.js:28674 | 5min | Grand Slam WTA couverts |
| 4 | BUG-05 — bsd_xg override expectedGoals | server.js:7773 | 45min | xG réels BSD utilisés |
| 5 | BUG-07 — bsd_xg truthy guard | server.js:7773 | 5min | Qualité données |
| 6 | BUG-08 — Log spam filtre sport | server.js:28848 | 5min | Logs propres |

---

*Audit généré le 2026-05-24 18:05 UTC+2. Tous les bugs identifiés par traçage systematique sans modification de production.*
