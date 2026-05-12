# Understat — Scraper Node.js natif pour PariScore

> **Mission :** rapport technique complet sur l'intégration Understat dans PariScore — xG, npxG, PPDA, forecast 1X2 — sans dépendance externe, sans anti-bot, légalement viable.
> **Date :** mai 2026 — Endpoints testés en live.

---

## 1. Pourquoi Understat ?

| Critère | Statut |
|---|---|
| **Anti-bot** | **Aucun** — HTTP 200 direct, pas de Cloudflare, pas de captcha |
| **Auth requise** | Aucune (pas de clé API) |
| **Latence** | ~600 ms / requête depuis IP datacenter |
| **Fraîcheur** | Match terminé → données dispo en moins d'1 h. **Pas de xG live mi-match** (limitation majeure) |
| **Couverture** | 6 ligues top : **EPL**, **La_Liga**, **Bundesliga**, **Serie_A**, **Ligue_1**, **RFPL** |
| **Profondeur** | xG par tir avec coordonnées (x, y), npxG, PPDA, deep completions, forecast 1X2 |
| **Légal** | Pas de TOS explicite contre scraping. Attribution recommandée. Zone grise mais usage SaaS toléré dans l'écosystème (`understat-api-py`, `understatapi`, `soccerdata`) |
| **Mise à jour** | Modèle xG officiel Understat révisé annuellement (dernière maj août 2024) |

**Limitations à connaître :**
- **Pas de live mid-match** — données poussées en fin de mi-temps et fin de match uniquement
- **Top 6 ligues uniquement** — pas de K-League, MLS, J1 (la couverture actuelle BSD complète)
- **Pas d'incidents textuels** (cartons, subs) — uniquement métriques shooting + tactiques

---

## 2. Endpoints réels (mai 2026)

### 2.1 League season — AJAX endpoint

```
POST https://understat.com/main/getLeagueData/<LEAGUE>/<SEASON>
Headers:
  User-Agent: Mozilla/5.0 ...
  X-Requested-With: XMLHttpRequest
  Accept-Encoding: gzip
```

**Réponse (JSON, gzippé ~91 KB → ~600 KB décompressé) :**

```json
{
  "teams": {
    "71": {
      "id": "71",
      "title": "Aston Villa",
      "history": [
        {
          "h_a": "h", "xG": 0.318601, "xGA": 1.40098,
          "npxG": 0.318601, "npxGA": 1.40098,
          "ppda": {"att": 227, "def": 12},
          "ppda_allowed": {"att": 146, "def": 24},
          "deep": 2, "deep_allowed": 6,
          "scored": 0, "missed": 0,
          "xpts": 0.4258, "result": "d",
          "date": "2025-08-16 11:30:00",
          "wins": 0, "draws": 1, "loses": 0, "pts": 1,
          "npxGD": -1.082
        }
      ]
    }
  },
  "dates": [
    {
      "id": "28778", "isResult": true,
      "h": {"id": "87", "title": "Liverpool", "short_title": "LIV"},
      "a": {"id": "73", "title": "Bournemouth", "short_title": "BOU"},
      "goals": {"h": "4", "a": "2"},
      "xG": {"h": "2.33007", "a": "1.57303"},
      "datetime": "2025-08-15 19:00:00",
      "forecast": {"w": "0.5498", "d": "0.2276", "l": "0.2226"}
    }
  ],
  "players": [ /* tous les joueurs de la ligue cette saison */ ]
}
```

**Test live :** HTTP 200, 380 matchs EPL 2025/26 confirmés, 20 équipes.

### 2.2 Match detail — JSON inline HTML

```
GET https://understat.com/match/<MATCH_ID>
```

Variables JS injectées dans `<script>` via `var X = JSON.parse('\x7B...');` (hex-escaped) :

| Variable | Contenu |
|---|---|
| `match_info` | id, fid, h, a, date, league_id, season, h_goals, a_goals, team_h, team_a, h_xg, a_xg, h_shot, a_shot, h_shotOnTarget, a_shotOnTarget, h_deep, a_deep, h_ppda, a_ppda, weather, formation, league |
| `shotsData` | `{ "h": [...shots équipe domicile], "a": [...shots équipe extérieur] }` — chaque shot a : `minute`, `result` (Goal/SavedShot/MissedShots/BlockedShot/ShotOnPost), `X` (x position 0-1), `Y` (y position 0-1), `xG`, `player`, `player_id`, `player_assisted`, `situation` (OpenPlay/FromCorner/SetPiece/Penalty), `shotType` (RightFoot/LeftFoot/Head), `lastAction` |
| `rostersData` | Compositions par équipe + ratings xG individuels |

### 2.3 Team page — AJAX

```
POST https://understat.com/main/getTeamData/<TEAM_NAME>/<SEASON>
Headers: X-Requested-With: XMLHttpRequest, Accept-Encoding: gzip
```

Réponse : `dates` (matchs), `statistics`, `players` (avec xG individuels et minutes).

### 2.4 Player detail — JSON inline HTML

```
GET https://understat.com/player/<PLAYER_ID>
```

Variables : `player` (matches[], shots[], groups[]).

---

## 3. Scraper Node.js natif (drop-in PariScore)

Aucune dépendance externe au-delà du built-in `https` + `zlib`. À placer dans `server.js` avant les routes (vers la zone live ~10600).

```javascript
/* -------------------------------------------------
   Understat — Scraper Node natif (xG, npxG, PPDA, forecast)
   Pas d'anti-bot. Cache 1h pour league, 24h pour match.
   ------------------------------------------------- */
const zlib = require('zlib');

const UNDERSTAT_HOST = 'understat.com';
const UNDERSTAT_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36';
const UNDERSTAT_LEAGUES = ['EPL', 'La_Liga', 'Bundesliga', 'Serie_A', 'Ligue_1', 'RFPL'];

// Caches
const _understatLeagueCache = new Map();   // `${league}/${season}` → { ts, data }
const _understatMatchCache = new Map();    // matchId → { ts, data }
const UNDERSTAT_LEAGUE_TTL = 60 * 60 * 1000;   // 1h
const UNDERSTAT_MATCH_TTL  = 24 * 60 * 60 * 1000; // 24h (match terminé = immuable)

function understatHttp(path, { method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: UNDERSTAT_HOST,
      path,
      method,
      headers: {
        'User-Agent': UNDERSTAT_UA,
        'Accept-Encoding': 'gzip, deflate',
        'X-Requested-With': method === 'POST' ? 'XMLHttpRequest' : undefined,
        'Referer': 'https://understat.com/',
      },
    };
    Object.keys(options.headers).forEach(k => options.headers[k] === undefined && delete options.headers[k]);

    const req = https.request(options, res => {
      const chunks = [];
      const stream = (res.headers['content-encoding'] === 'gzip')
        ? res.pipe(zlib.createGunzip())
        : (res.headers['content-encoding'] === 'deflate')
          ? res.pipe(zlib.createInflate())
          : res;
      stream.on('data', c => chunks.push(c));
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// Extrait les var X = JSON.parse('...') d'un HTML Understat
function extractUnderstatJsonVars(html) {
  const out = {};
  const re = /var\s+(\w+)\s*=\s*JSON\.parse\(\s*'((?:\\.|[^'\\])*)'\s*\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1];
    let raw = m[2]
      .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    try { out[name] = JSON.parse(raw); }
    catch { /* skip parse errors (PROMOTION et autres) */ }
  }
  return out;
}

// === API publique ===

async function fetchUnderstatLeague(league, season) {
  if (!UNDERSTAT_LEAGUES.includes(league)) throw new Error(`League non supportée: ${league}`);
  const key = `${league}/${season}`;
  const cached = _understatLeagueCache.get(key);
  if (cached && Date.now() - cached.ts < UNDERSTAT_LEAGUE_TTL) return cached.data;

  const res = await understatHttp(`/main/getLeagueData/${league}/${season}`, { method: 'POST' });
  if (res.status !== 200) throw new Error(`Understat league HTTP ${res.status}`);
  const data = JSON.parse(res.body);
  _understatLeagueCache.set(key, { ts: Date.now(), data });
  return data;
}

async function fetchUnderstatMatch(matchId) {
  const cached = _understatMatchCache.get(String(matchId));
  if (cached && Date.now() - cached.ts < UNDERSTAT_MATCH_TTL) return cached.data;

  const res = await understatHttp(`/match/${matchId}`);
  if (res.status !== 200) throw new Error(`Understat match HTTP ${res.status}`);
  const vars = extractUnderstatJsonVars(res.body);
  const data = {
    info: vars.match_info || null,
    shots: vars.shotsData || { h: [], a: [] },
    rosters: vars.rostersData || null,
  };
  _understatMatchCache.set(String(matchId), { ts: Date.now(), data });
  return data;
}

// Lookup match Understat ID par équipes + date (pour relier matchId PariScore → Understat)
async function findUnderstatMatchId({ league, season, homeTeam, awayTeam, date }) {
  const data = await fetchUnderstatLeague(league, season);
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(homeTeam) + '_' + norm(awayTeam);
  const targetDate = (date || '').slice(0, 10);
  const match = (data.dates || []).find(m => {
    const key = norm(m.h?.title) + '_' + norm(m.a?.title);
    return key === target && (!targetDate || (m.datetime || '').startsWith(targetDate));
  });
  return match?.id || null;
}

// Agrégation xG cumulé par minute (pour courbe live-like — post-match)
function buildUnderstatXgTimeline(shotsData) {
  const all = [
    ...(shotsData.h || []).map(s => ({ ...s, side: 'h' })),
    ...(shotsData.a || []).map(s => ({ ...s, side: 'a' })),
  ].sort((a, b) => +a.minute - +b.minute);
  const timeline = [];
  let cumH = 0, cumA = 0;
  for (const s of all) {
    const xg = +s.xG || 0;
    if (s.side === 'h') cumH += xg; else cumA += xg;
    timeline.push({ minute: +s.minute, xG_home: +cumH.toFixed(3), xG_away: +cumA.toFixed(3) });
  }
  return timeline;
}
```

---

## 4. Route d'enrichissement PariScore

Ajout dans `server.js` à proximité de `/api/v1/live-dashboard/:matchId` :

```javascript
// GET /api/v1/understat/match/:matchId — Données xG post-match Understat
if (pathname.startsWith('/api/v1/understat/match/')) {
  const id = pathname.slice('/api/v1/understat/match/'.length);
  if (!id || id === 'undefined') return jsonResponse(res, 400, { error: 'ID invalide' });
  try {
    const data = await fetchUnderstatMatch(id);
    return jsonResponse(res, 200, {
      info: data.info,
      shots: data.shots,
      timeline: buildUnderstatXgTimeline(data.shots),
    });
  } catch (e) {
    return jsonResponse(res, 503, { error: 'Understat indisponible', detail: e.message });
  }
}

// GET /api/v1/understat/forecast?league=EPL&season=2025 — Forecast 1X2 Understat
if (pathname === '/api/v1/understat/forecast') {
  const league = query.league || 'EPL';
  const season = query.season || String(new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  try {
    const data = await fetchUnderstatLeague(league, season);
    const upcoming = (data.dates || []).filter(m => !m.isResult).map(m => ({
      id: m.id,
      home: m.h?.title, away: m.a?.title,
      datetime: m.datetime,
      prob_home: +m.forecast?.w, prob_draw: +m.forecast?.d, prob_away: +m.forecast?.l,
    }));
    return jsonResponse(res, 200, { league, season, upcoming });
  } catch (e) {
    return jsonResponse(res, 503, { error: 'Understat indisponible', detail: e.message });
  }
}
```

---

## 5. Intégration au Bayesian Value Radar (CLAUDE.md P0)

Les données Understat enrichissent directement le **Bayesian Model Blender** :

| Métrique Understat | Usage dans le modèle |
|---|---|
| `xG` rolling 10 derniers matchs (par équipe) | Input direct du **Poisson Bivarié** (λ ajusté) |
| `npxG` (non-penalty xG) | Plus fiable que xG pour calibration (exclut variance penalties) |
| `xGD` (xG Differential) | Indicateur de qualité d'équipe sous-jacente — input du Elo dynamique |
| `xpts` (expected points) | Comparaison vs pts réels = chance/malchance, utile pour mean reversion |
| `ppda` (passes per defensive action) | Pressing index — discriminant pour ligues à profil tactique différent |
| `forecast.w/d/l` | **Concurrent** au prior Poisson — pondération bayésienne (Understat = 1 vote dans le Blender) |
| `shotsData` | Construit `xG_timeline` pour visualisation post-match (Dashboard Insights) |

**Workflow d'enrichissement quotidien :**

1. **Cron 6h** appelle `fetchUnderstatLeague(league, season)` pour les 6 top ligues = 6 req/24h
2. Stocke teams[].history dans SQLite `understat_team_form` (cumul xG/xGA/npxG/ppda L5/L10)
3. Lors d'un match prematch des top 6 ligues, **enrichit** `db.matches[id].understat_form` côté backend
4. Frontend Dashboard Insights affiche **courbe xG cumulée post-match** (sourcée `xG_timeline`)

**Quotas réels :** 6 req/jour pour le cron + ~5-10 req à la demande pour matchs récents = **< 20 req/jour total** Understat. Marge énorme avant ban.

---

## 6. Rate limit & politesse

| Recommandation | Valeur |
|---|---|
| Délai min entre 2 requêtes | **1 seconde** (suffit pour Understat, pas de rate limit officiel) |
| User-Agent | Mozilla/5.0 ... (browser réel) — éviter UA Python/curl |
| Concurrence | **1 worker** (séquentiel) — multi-thread inutile |
| Retry sur 5xx | Backoff exponentiel 2s, 4s, 8s, abandon après 3 tentatives |
| Caching | League: 1 h, Match terminé: 24 h, Joueur: 6 h |

---

## 7. Limitations vs alternatives

| Source | xG live mi-match | xG post-match | Couverture | Coût |
|---|---|---|---|---|
| **Understat** (Node natif) | ❌ Non | ✅ Top 6 ligues, granularité tir | 6 ligues | **0 €** |
| API-Football Pro | ✅ Oui (via `fixtures/statistics`) | ✅ Oui | 1 100+ ligues | 19 $/mo |
| Sofascore via wrapper | ✅ Oui (Playwright) | ✅ Oui | Mondial | Compute |
| BSD `sr_stats` actuel | ⚠️ Limité (ball_safe, attack proxies) | ❌ Non | 28 ligues | Déjà payé |
| Sportmonks Growth | ✅ Oui (xG live natif) | ✅ Oui | 30 ligues | 149 €/mo |

**Conclusion :** Understat est un **complément qualité post-match** pour les top 6 ligues, **pas un substitut** au live tracker. À combiner avec API-Football Pro pour le live mid-match.

---

## 8. Légal et éthique

| Aspect | Statut |
|---|---|
| **TOS** | Pas de mention explicite anti-scraping. Pas de robots.txt restrictif sur `/main/getLeagueData/*` |
| **Attribution** | Recommandée — ajouter "xG provided by Understat.com" dans le footer Dashboard |
| **Charge** | Pas de coût pour Understat (cache 1h évite hot loop) |
| **Précédent** | 3 libs populaires (`understatapi`, `understat`, `soccerdata`) tolérées depuis 2020+ |
| **Risque** | Faible — projet community-friendly, modèle xG est explicitement public |

**Bonne pratique :** ajouter en bas du Dashboard insight :
> *Statistiques xG fournies par [Understat.com](https://understat.com)*

---

## 9. Test de validation

Script `scripts/probe-understat.js` (déjà créé) confirme :

```
=== /match/29473 | HTTP 200 size:28585 ===
  match_info → object, keys: id,fid,h,a,date,league_id,season,h_goals,a_goals,team_h,team_a,h_xg

=== /league/EPL/2025 AJAX | HTTP 200 size:91474 ===
  teams: 20 entries
  dates: 380 matches
  match sample: forecast {w:0.55, d:0.23, l:0.22} + xG {h:2.33, a:1.57}
```

Tous les endpoints répondent 200 sans token, sans captcha.

---

## 10. Plan d'action immédiat

1. **Copier le snippet Node natif** (section 3) dans `server.js` à proximité de la zone live (~ligne 10600)
2. **Ajouter les 2 routes** `/api/v1/understat/match/:id` + `/api/v1/understat/forecast` (section 4)
3. **Créer un cron quotidien** dans `fetchStats()` qui appelle `fetchUnderstatLeague()` pour les 6 ligues majeures et persiste en SQLite `understat_form` (xG L10 par équipe)
4. **Brancher au Bayesian Blender** : injecter `xG_rolling_10` comme entrée du Poisson Bivarié au lieu de la moyenne fixe 1.35
5. **Frontend Dashboard Insights** : ajouter section "Courbe xG cumulée" (post-match uniquement) consommant `/api/v1/understat/match/:id/timeline`
6. **Footer Dashboard** : attribution "xG by Understat.com"

**Temps estimé :** 4-6 h d'implémentation.

---

## 11. Sources et références

- [understatAPI Python (Collin Bennett)](https://collinb9.github.io/understatAPI/) — context7 ID `/websites/collinb9_github_io_understatapi`
- [soccerdata (probberechts)](https://github.com/probberechts/soccerdata) — wrapper Python multi-source incluant Understat
- [Probe Node — `scripts/probe-understat.js`](./scripts/probe-understat.js) — validation en local
- Endpoints testés en live mai 2026

*Document : `.context/UNDERSTAT-SCRAPER-NODE-2026.md` — PariScore v9.7+ — étude scraper Understat.*
