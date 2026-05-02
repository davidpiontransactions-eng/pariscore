# Audit Stratégique — Onglet "Tendances" (inspiré OddAlerts Trends)

> Document produit le 28 avril 2026 — pour implémentation dans PariScore v5.x
> Référence compétitive : OddAlerts Trends (séries BTTS, Win, Over 2.5)

---

## 1. Analyse UX/UI

### Ce que fait OddAlerts
OddAlerts Trends met en avant les **séries en cours** des équipes : équipe qui n'a pas encaissé de but depuis X matchs, équipe avec BTTS sur Y matchs consécutifs, Over 2.5 sur Z matchs. Le tout en tableau dense, filtrable par ligue, trié par longueur de série.

### Adaptation au design system PariScore

**Contraintes de notre DS :**
- Fond noir `#0a0d0f`, accents vert néon `#00e676`
- Police : Syne (titres) + DM Mono (chiffres/badges)
- Pas de mode clair — design "terminal de données"
- Mobile : scroll horizontal acceptable sur onglet Matchs, mais Tendances doit être plus lisible

**Structure visuelle proposée :**

```
┌────────────────────────────────────────────────────────────────────┐
│  🔥 TENDANCES EN COURS             [Ligue 1 ▾] [BTTS ▾] [5+ ▾]   │
├─────────────────────────────────────────────────────────────────────┤
│ SÉRIE              ÉQUIPE              LIGUE      MARCHÉ   DURÉE   │
├─────────────────────────────────────────────────────────────────────┤
│ ████████████ 8     Arsenal            PL         BTTS     ████     │
│ ██████████  7     PSG                L1         Over 2.5  ██████   │
│ ████████    6     Bayern             BL         Wins      ████     │
│ ██████      5     Barça              LL         CS        ████     │
└─────────────────────────────────────────────────────────────────────┘
```

**Composants UI :**

1. **Badge de série** — chip coloré `DM Mono` : `🔥 8` en vert si ≥5, orange si 3-4, blanc si 1-2
2. **Barre de progression** — `width: (streak/10)*100%`, fond `rgba(0,230,118,0.15)`, fill `--green`
3. **Filtre Marché** — boutons type pill : `Tout | Win | BTTS | Over 2.5 | CS | Défaite`
4. **Filtre Durée min** — `3+ | 5+ | 7+` (masque le bruit)
5. **Tri** — par défaut : longueur décroissante. Clic colonne : ordre inversé

**Règle de couleur badge :**
| Longueur | Couleur | Signification |
|----------|---------|---------------|
| ≥ 7 | `#00e676` vert pulsant | Série chaude, haute valeur |
| 4-6 | `#ffa726` orange | Tendance notable |
| 2-3 | `#8d9399` gris | Tendance émergente |

**Pas de tableau de 1400px ici.** Cards empilées verticalement (max-width 900px), lisibles sur mobile sans scroll horizontal.

---

## 2. Faisabilité Data — Approche Lean (quota 100 req/jour)

### Ce que nous avons déjà (0 appel API supplémentaire)

Le champ `form` des standings API-Football est **déjà stocké** dans `db.teamStats[key].form` sous forme de string : `"WWDLW"` (5 derniers matchs, du plus récent au plus ancien).

Depuis ce string, on peut calculer immédiatement :
- **Série de victoires** : compter les `W` consécutifs depuis le début
- **Série sans défaite** : compter tant qu'on ne voit pas `L`
- **Série de défaites** : compter les `L` consécutifs
- **Série de nuls** : compter les `D` consécutifs

→ **Ces 4 tendances sont disponibles sans aucun appel API supplémentaire.** C'est la version **Gratuite**.

### Ce qui nécessite des appels supplémentaires (version Premium)

Pour BTTS, Over 2.5, Clean Sheet, on a besoin du nombre de buts par match → endpoint `/fixtures?team={id}&last=5` (1 req/équipe).

**Budget quotidien actuel :**
| Usage existant | Req/jour |
|---------------|---------|
| `fetchStats()` — fixtures + standings (18 ligues × ~2) | ~36 |
| `fetchOdds()` — The Odds API (séparé) | ~0 quota Football |
| `archivePastMatches()` — scores réels | ~1 |
| `fetchTeamAdvancedStats()` — AI Scout (10 équipes max) | ~10 |
| **Solde disponible** | **~53 req/jour** |

**Stratégie quota pour les tendances Premium :**

```
Tendances calculées 1x/jour (cron 06:00)
→ On prend les N équipes les plus "chaudes" (form ≥ "WW" ou déjà en série)
→ Max 30 équipes × 1 req = 30 req/jour
→ Résultat : solde ~23 req/jour de marge
```

**Cache :** `db.trends = {}` dans `database.json`, TTL 24h. Clé = `normName(team)`.

### Pipeline de calcul des tendances

```javascript
// 1. Depuis le form string (0 API call)
function parseFormStreak(form, targetChar) {
  let streak = 0;
  for (const c of (form || '')) {
    if (c === targetChar) streak++;
    else break;
  }
  return streak;
}

// 2. Depuis les fixtures détaillés (1 API call/équipe, version Premium)
async function fetchTeamForm(teamId, count = 5) {
  // GET /fixtures?team={teamId}&last={count}&status=FT
  // Retourne goals scored/conceded par match
  // → calcule bttsStreak, over25Streak, csStreak
}

// 3. Agrégation dans generateTrends()
function generateTrends() {
  const trends = [];
  for (const [key, stat] of Object.entries(db.teamStats)) {
    const form = stat.form || '';
    trends.push({
      team: key,
      league: stat.leagueId,
      winStreak:    parseFormStreak(form, 'W'),
      lossStreak:   parseFormStreak(form, 'L'),
      drawStreak:   parseFormStreak(form, 'D'),
      unbeatenStreak: countUnbeaten(form),
      // Premium (si fetchTeamForm a été appelé) :
      bttsStreak:   stat.trends?.bttsStreak || null,
      over25Streak: stat.trends?.over25Streak || null,
      csStreak:     stat.trends?.csStreak || null,
    });
  }
  return trends.filter(t => Math.max(t.winStreak, t.lossStreak, t.unbeatenStreak) >= 2);
}
```

---

## 3. Monétisation

### Plan Gratuit — Tendances Basiques
Calculées depuis `form` string existant, 0 coût API supplémentaire.

| Tendance | Source | Disponible |
|----------|--------|-----------|
| Série de Victoires | `form` string | ✅ Gratuit |
| Série sans Défaite | `form` string | ✅ Gratuit |
| Série de Défaites | `form` string | ✅ Gratuit |
| Série de Nuls | `form` string | ✅ Gratuit |

**Affichage :** Top 20 tendances triées par longueur. Pas de filtre premium.

### Plan Pro (€19/mois) — Super Tendances
Nécessitent `/fixtures?team={id}&last=5`.

| Tendance | Source | Valeur betting |
|----------|--------|---------------|
| BTTS Streak | Fixtures détaillés | ★★★★★ Très haute |
| Over 2.5 Streak | Fixtures détaillés | ★★★★☆ Haute |
| Clean Sheet Streak | Fixtures détaillés | ★★★★☆ Haute |
| Under 1.5 Streak | Fixtures détaillés | ★★★☆☆ Moyenne |
| Série sans Clean Sheet | Fixtures détaillés | ★★★☆☆ Moyenne |

**Gate Pro :** Les lignes Premium s'affichent grisées avec `🔒 Pro` pour les utilisateurs Free → conversion naturelle.

### Logique de valeur betting
Une équipe avec BTTS=7 consécutifs est un signal bien plus fort qu'un simple historique BTTS 65%. La **série** encode l'état de forme récent, pas juste la moyenne longue durée — c'est le différenciateur clé face à notre tableau Matchs.

---

## 4. Plan d'Action Technique

### Étape 1 — Route backend `/api/v1/trends` (server.js)

```javascript
// Dans server.js, après la route /api/v1/accuracy

if (pathname === '/api/v1/trends' && req.method === 'GET') {
  const minStreak = parseInt(new URLSearchParams(search).get('min') || '2', 10);
  const market    = new URLSearchParams(search).get('market') || 'all';

  const trends = generateTrends(); // calcul depuis db.teamStats

  const filtered = trends
    .filter(t => {
      const max = getMaxStreak(t, market);
      return max >= minStreak;
    })
    .sort((a, b) => getMaxStreak(b, market) - getMaxStreak(a, market))
    .slice(0, 50);

  return jsonResponse(res, 200, { trends: filtered, generatedAt: new Date().toISOString() });
}
```

**Fonctions helper à ajouter dans server.js :**

```javascript
function parseFormStreak(form, char) {
  let n = 0;
  for (const c of (form || '')) { if (c === char) n++; else break; }
  return n;
}

function countUnbeaten(form) {
  let n = 0;
  for (const c of (form || '')) { if (c !== 'L') n++; else break; }
  return n;
}

function generateTrends() {
  const trends = [];
  for (const [key, stat] of Object.entries(db.teamStats)) {
    if (!stat || !stat.home) continue;
    const form = stat.form || '';
    const entry = {
      team:           key,
      leagueId:       stat.leagueId,
      form:           form,
      winStreak:      parseFormStreak(form, 'W'),
      lossStreak:     parseFormStreak(form, 'L'),
      drawStreak:     parseFormStreak(form, 'D'),
      unbeatenStreak: countUnbeaten(form),
      // Premium (null si non chargé)
      bttsStreak:     stat.trends?.bttsStreak   ?? null,
      over25Streak:   stat.trends?.over25Streak ?? null,
      csStreak:       stat.trends?.csStreak     ?? null,
    };
    trends.push(entry);
  }
  return trends;
}

function getMaxStreak(t, market) {
  if (market === 'win')   return t.winStreak;
  if (market === 'loss')  return t.lossStreak;
  if (market === 'btts')  return t.bttsStreak ?? 0;
  if (market === 'over25') return t.over25Streak ?? 0;
  if (market === 'cs')    return t.csStreak ?? 0;
  return Math.max(t.winStreak, t.lossStreak, t.unbeatenStreak, t.drawStreak);
}
```

---

### Étape 2 — Frontend : onglet Tendances (pariscore.html)

**Relier le bouton de navigation existant à la fonction de chargement :**

```javascript
// Dans showPage() ou la fonction de navigation :
if (page === 'tendances' && !tendancesLoaded) {
  loadTendances();
  tendancesLoaded = true;
}
```

**Fonction `loadTendances()` :**

```javascript
let tendancesLoaded = false;

async function loadTendances() {
  const container = document.getElementById('tendances-content');
  container.innerHTML = '<div class="loading-state">Chargement des tendances…</div>';

  const res = await fetch('/api/v1/trends?min=2');
  if (!res.ok) { container.innerHTML = '<p style="color:var(--red)">Erreur chargement.</p>'; return; }

  const { trends } = await res.json();
  renderTrends(trends, 'all', 2);
}

function renderTrends(trends, market = 'all', min = 2) {
  const MARKET_LABELS = {
    win: { label: 'Série Victoires', icon: '🏆', color: 'var(--green)' },
    loss: { label: 'Série Défaites', icon: '📉', color: 'var(--red)' },
    unbeaten: { label: 'Sans Défaite', icon: '🛡️', color: '#29b6f6' },
    draw: { label: 'Série Nuls', icon: '🤝', color: 'var(--amber)' },
    btts: { label: 'BTTS', icon: '⚽', color: '#ab47bc', pro: true },
    over25: { label: 'Over 2.5', icon: '🔥', color: '#ffa726', pro: true },
    cs: { label: 'Clean Sheet', icon: '🧤', color: '#29b6f6', pro: true },
  };

  const rows = trends
    .map(t => {
      const results = [
        { market: 'win',      streak: t.winStreak },
        { market: 'unbeaten', streak: t.unbeatenStreak },
        { market: 'loss',     streak: t.lossStreak },
        { market: 'draw',     streak: t.drawStreak },
        { market: 'btts',     streak: t.bttsStreak },
        { market: 'over25',   streak: t.over25Streak },
        { market: 'cs',       streak: t.csStreak },
      ]
      .filter(r => r.streak !== null && r.streak >= min)
      .filter(r => market === 'all' || r.market === market)
      .sort((a, b) => b.streak - a.streak);

      return results.map(r => ({ ...r, team: t.team, form: t.form }));
    })
    .flat()
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 50);

  const html = rows.map(r => {
    const m    = MARKET_LABELS[r.market];
    const w    = Math.min(100, (r.streak / 10) * 100);
    const col  = r.streak >= 7 ? 'var(--green)' : r.streak >= 4 ? 'var(--amber)' : 'var(--text2)';
    const lock = m.pro ? '<span style="font-size:10px;opacity:.5;margin-left:4px">🔒 Pro</span>' : '';

    return `
      <div class="trend-card">
        <div class="trend-streak" style="color:${col}">${r.streak}</div>
        <div class="trend-bar-wrap">
          <div class="trend-team">${r.team.replace(/_/g,' ')} ${lock}</div>
          <div class="trend-bar-track">
            <div class="trend-bar-fill" style="width:${w}%;background:${col}"></div>
          </div>
          <div class="trend-form">${r.form}</div>
        </div>
        <div class="trend-market" style="color:${m.color}">${m.icon} ${m.label}</div>
      </div>
    `;
  }).join('');

  document.getElementById('tendances-content').innerHTML = html || '<p style="color:var(--text3)">Aucune tendance ≥ 2 matchs.</p>';
}
```

---

### Étape 3 — CSS à ajouter dans `<style>`

```css
/* ── Tendances ────────────────────────────────────────────────── */
.trend-card {
  display: flex; align-items: center; gap: 16px;
  padding: 10px 14px; border-radius: 8px;
  background: var(--bg2); margin-bottom: 4px;
  border: 1px solid rgba(255,255,255,0.04);
  transition: background .15s;
}
.trend-card:hover { background: var(--bg3); }
.trend-streak {
  font: 700 28px/1 var(--font-display); min-width: 36px; text-align: right;
}
.trend-bar-wrap { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.trend-team { font-size: 13px; font-weight: 600; text-transform: capitalize; }
.trend-bar-track {
  height: 4px; border-radius: 2px; background: rgba(255,255,255,0.07); overflow: hidden;
}
.trend-bar-fill { height: 100%; border-radius: 2px; transition: width .4s ease; }
.trend-form { font: 400 10px/1 var(--font-mono); color: var(--text3); letter-spacing: 2px; }
.trend-market { font-size: 12px; font-weight: 600; min-width: 100px; text-align: right; }
```

---

### Étape 4 — HTML statique à remplacer dans `#page-tendances`

Remplacer le contenu statique actuel de l'onglet Tendances par :

```html
<div id="page-tendances" class="page" style="display:none;">
  <div class="container" style="max-width:900px;padding:24px 16px;">
    <h2 style="font:700 28px/1 var(--font-display);margin-bottom:4px;">🔥 Tendances</h2>
    <p style="color:var(--text3);margin-bottom:24px;">Séries en cours · Calculées depuis les standings officiels</p>

    <!-- Filtres -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;">
      <button class="trend-filter active" data-market="all">Tout</button>
      <button class="trend-filter" data-market="win">🏆 Victoires</button>
      <button class="trend-filter" data-market="unbeaten">🛡️ Sans Défaite</button>
      <button class="trend-filter" data-market="loss">📉 Défaites</button>
      <button class="trend-filter" data-market="btts">⚽ BTTS <span class="pro-badge">Pro</span></button>
      <button class="trend-filter" data-market="over25">🔥 Over 2.5 <span class="pro-badge">Pro</span></button>
      <button class="trend-filter" data-market="cs">🧤 Clean Sheet <span class="pro-badge">Pro</span></button>
    </div>

    <!-- Filtre durée min -->
    <div style="display:flex;gap:6px;margin-bottom:20px;align-items:center;">
      <span style="color:var(--text3);font-size:12px;">Durée min :</span>
      <button class="trend-min active" data-min="2">2+</button>
      <button class="trend-min" data-min="3">3+</button>
      <button class="trend-min" data-min="5">5+</button>
      <button class="trend-min" data-min="7">7+</button>
    </div>

    <div id="tendances-content">
      <!-- Rempli par loadTendances() -->
    </div>
  </div>
</div>
```

---

### Étape 5 — Cron quotidien Premium (optionnel, phase ultérieure)

Si le plan Pro est activé, ajouter dans le cron de 06:00 :

```javascript
// Fetch form détaillée pour les 30 équipes les plus actives (1 req/équipe)
async function fetchPremiumTrends() {
  const topTeams = Object.entries(db.teamStats)
    .filter(([, s]) => s.teamId && (s.form || '').length >= 3)
    .slice(0, 30);

  for (const [key, stat] of topTeams) {
    const fixtures = await httpsGet(
      `https://v3.football.api-sports.io/fixtures?team=${stat.teamId}&last=5&status=FT`,
      { 'x-apisports-key': API_FOOTBALL_KEY }
    );
    if (!fixtures?.response) continue;

    let btts = 0, over25 = 0, cs = 0;
    for (const f of fixtures.response) {
      const gh = f.goals.home, ga = f.goals.away;
      if (gh > 0 && ga > 0) btts++; else break;
    }
    // (idem pour over25, cs)
    db.teamStats[key].trends = { bttsStreak: btts, over25Streak: over25, csStreak: cs };
  }
  saveDB();
}
```

---

## Récapitulatif — Priorisation

| Tâche | Complexité | API calls | Valeur |
|-------|-----------|-----------|--------|
| Route `/api/v1/trends` + `generateTrends()` | Faible (2h) | 0 | ★★★★★ |
| Frontend onglet Tendances (HTML+CSS+JS) | Faible (3h) | 0 | ★★★★★ |
| Filtres marché + durée min | Faible (1h) | 0 | ★★★★☆ |
| Cron Premium (BTTS/Over25/CS) | Moyenne (3h) | 30/jour | ★★★★☆ |
| Gate Pro (verrou 🔒) | Faible (1h) | 0 | ★★★☆☆ |

**Recommandation :** Implémenter les 3 premières tâches en priorité. Elles donnent un onglet Tendances fonctionnel et riche sans toucher aux quotas API, en exploitant les données déjà en cache.

---

*Audit produit par Claude — PariScore v5.x — 28 avril 2026*
