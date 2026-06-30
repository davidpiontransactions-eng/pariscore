'use strict';
// ⚠️ AVERTISSEMENT LÉGAL — TNNS Live scraper
// TNNS (tnnslive.com) affiche des données ATP/WTA officiellement licenciées
// (Sportradar / TDI). Ce scraper est fourni DÉSACTIVÉ PAR DÉFAUT
// (TNNS_LIVE_ENABLED=false). L'activation se fait aux risques de l'utilisateur.
// PariScore décline toute responsabilité en cas d'usage non autorisé de données
// sous licence. Alternative légale : Sportradar Tennis API v3 ou
// api-tennis.com WebSocket.
//
// Architecture : ce module est un SCAFFOLD prêt à brancher. TNNS est une SPA
// (Nuxt/SPA) : le HTML servi ne contient généralement PAS de JSON inline
// exploitable (window.__NUXT__, __NEXT_DATA__). Les vraies données transitent
// via des appels XHR/WebSocket authentifiés (cookie de session + token).
// Tant que l'endpoint interne exact (path API + cookie/token) n'est pas connu,
// les fonctions ci-dessous essaient des chemins raisonnables et retournent
// gracieusement []/null quand rien n'est extractible. Le pipeline retombe
// alors sur aiscore. Des TODO marquent où brancher le vrai endpoint.
//
// Zero-dépendance : uniquement `https` natif. Parsing manuel regex/string,
// comme betexplorerService.js. Pas d'axios/cheerio/playwright.

const https = require('https');

// ── Config (lazy env — server.js parse .env avant le require) ─────────────────
const API_KEY    = () => process.env.TNNS_API_KEY || '';
const BASE_URL   = () => process.env.TNNS_BASE_URL || 'https://tnnslive.com';
const ENABLED    = () => process.env.TNNS_LIVE_ENABLED === 'true' && !!API_KEY();
const TIMEOUT_MS = 8000;

// ── Cache (matchId -> { data, ts }) ──────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_LIST = 10000; // 10s — liste live
const CACHE_TTL_PBP  = 15000; // 15s — PBP live

// ── Rotation User-Agent (furtivité basique) ──────────────────────────────────
const _UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
];
function _rotateUA() { return _UAS[Math.floor(Math.random() * _UAS.length)]; }

// Délai aléatoire anti-pattern (jitter)
function _jitter(base) {
  if (typeof base !== 'number') base = 800;
  return base + Math.floor(Math.random() * 600);
}

// ── HTTPS GET natif (miroir betexplorerService httpsGet) ──────────────────────
// Resout toujours (null si erreur/réseau) — JAMAIS throw (poll loop safe).
function _get(path) {
  return new Promise((resolve) => {
    let url;
    try { url = new URL(BASE_URL() + path); }
    catch (_) { return resolve(null); }
    const opts = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'GET',
      timeout:  TIMEOUT_MS,
      headers: {
        'Accept':        'application/json,text/html',
        'User-Agent':    _rotateUA(),
        'Authorization': API_KEY() ? ('Bearer ' + API_KEY()) : '',
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// ── Exponential backoff retry (miroir server.js:29928 _texFetchHtml) ──────────
async function _getWithRetry(path, maxRetries) {
  if (typeof maxRetries !== 'number' || maxRetries < 1) maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await _get(path);
    if (res && res.status >= 200 && res.status < 300) return res;
    if (res && res.status === 403) {
      // IP ban / blocked — back off plus fort
      console.warn('[TNNS] 403 bloqué, tentative', attempt);
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1) + _jitter(0)));
    }
  }
  return null;
}

// ── Helpers de parsing ───────────────────────────────────────────────────────

/**
 * Tente d'extraire un objet JSON embarqué dans le HTML de la SPA.
 * Cherche window.__NUXT__, __NEXT_DATA__, ou un bloc <script ...>JSON</script>.
 * Retourne l'objet parsé ou null. Best-effort, jamais throw.
 */
function _extractEmbeddedJson(html) {
  if (!html || typeof html !== 'string') return null;
  // __NEXT_DATA__ : <script id="__NEXT_DATA__" type="application/json"> {...} </script>
  let m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try { return JSON.parse(m[1].trim()); } catch (_) {}
  }
  // window.__NUXT__ = (fonction Nuxt) — difficile à parser (c'est du JS, pas du JSON pur).
  // On tente une extraction de JSON si la payload est un objet littéral simple.
  m = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*?\});<\/script>/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch (_) {}
  }
  // __INITIAL_STATE__ / __APOLLO_STATE__ (Vue/Apollo)
  m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/i);
  if (m) {
    try { return JSON.parse(m[1]); } catch (_) {}
  }
  return null;
}

/**
 * Tente de récupérer un nom de joueur lisible depuis une string HTML.
 */
function _cleanName(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Retourne true si le scraper est activé (flag + clé API présents). */
function enabled() { return ENABLED(); }

/**
 * Récupère la liste des matchs live TNNS.
 * TNNS est une SPA : le HTML de la home ne contient généralement pas de JSON
 * inline exploitable. On essaie quand même (window.__NUXT__/__NEXT_DATA__) +
 * quelques paths API internes plausibles.
 * @returns {Promise<Array>} [{id, p1, p2, tournament, status}] ou []. Cache 10s.
 */
async function fetchLiveMatches() {
  if (!ENABLED()) return [];
  // Cache
  const _c = _cache.get('__list__');
  if (_c && (Date.now() - _c.ts) < CACHE_TTL_LIST) return _c.data;

  let matches = [];
  try {
    // 1) Page d'accueil + extraction JSON inline
    const res = await _getWithRetry('/', 2);
    if (res && typeof res.data === 'string') {
      const json = _extractEmbeddedJson(res.data);
      if (json) {
        // TODO(legal/endpoint) : la structure exacte de la SPA TNNS est
        // inconnue. Quand on aura un dump __NUXT__/API, brancher ici la
        // projection vers [{id,p1,p2,tournament,status}].
        matches = _projectLiveList(json);
      }
    }
    // 2) TODO : paths API internes plausibles (à confirmer côté réseau).
    //    if (!matches.length) { const r2 = await _getWithRetry('/api/live', 1); ... }
  } catch (_) {
    // JAMAIS crasher le poll loop
    matches = [];
  }

  _cache.set('__list__', { data: matches, ts: Date.now() });
  return matches;
}

/**
 * Projection best-effort d'un objet JSON embarqué vers la liste live.
 * Retourne [] si rien n'est reconnaissable. À compléter quand on connaîtra
 * la structure réelle de TNNS.
 */
function _projectLiveList(json) {
  const out = [];
  try {
    // Heuristique très large : chercher un tableau d'objets avec des joueurs.
    const candidates = [];
    const _scan = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const it of node) _scan(it); return; }
      // Objet qui ressemble à un match : possède au moins 2 noms / joueurs
      const p1 = _cleanName(node.player1 || node.p1 || node.home || (node.players && node.players[0] && (node.players[0].name || node.players[0])));
      const p2 = _cleanName(node.player2 || node.p2 || node.away || (node.players && node.players[1] && (node.players[1].name || node.players[1])));
      if (p1 && p2) {
        candidates.push({
          id: String(node.id || node.matchId || node.uuid || (p1 + '-' + p2)),
          p1, p2,
          tournament: _cleanName(node.tournament || node.event || node.competition || ''),
          status: node.status || node.state || 'live',
        });
      }
      for (const k of Object.keys(node)) _scan(node[k]);
    };
    _scan(json);
    out.push(...candidates);
  } catch (_) {}
  return out;
}

/**
 * Récupère le point-by-point (PBP) d'un match TNNS. FONCTION CLÉ.
 *
 * Convention de sortie (attendue par le pipeline pollTennisLive) :
 *   server/winner en 1-indexé (1=p1, 2=p2), idx monotone croissant.
 *
 * TNNS étant une SPA authentifiée, on essaie :
 *   - le path API guess `/api/matches/{id}/points` (et variantes),
 *   - la page match + extraction JSON inline.
 * Retourne null si rien d'exploitable (le pipeline retombe sur aiscore).
 * Cache 15s.
 *
 * @returns {Promise<object|null>} forme PBP attendue par le pipeline.
 */
async function fetchPBP(matchId) {
  if (!matchId) return null;
  if (!ENABLED()) return null;
  const _cid = 'pbp:' + matchId;
  const _c = _cache.get(_cid);
  if (_c && (Date.now() - _c.ts) < CACHE_TTL_PBP) return _c.data;

  let result = null;
  try {
    // TODO(legal/endpoint) : chemin API TNNS exact inconnu. On tente des
    // guesses raisonnables. Quand l'endpoint + cookie/token seront confirmés,
    // remplacer ce bloc par l'appel réel.
    const paths = [
      '/api/matches/' + encodeURIComponent(matchId) + '/points',
      '/api/match/' + encodeURIComponent(matchId) + '/pbp',
      '/match/' + encodeURIComponent(matchId),
    ];
    for (const p of paths) {
      const res = await _getWithRetry(p, 2);
      if (!res || res.status < 200 || res.status >= 300) continue;
      const ctype = (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '';
      let parsed = null;
      if (ctype.indexOf('json') >= 0) {
        try { parsed = JSON.parse(res.data); } catch (_) {}
      } else {
        // HTML → JSON inline ?
        parsed = _extractEmbeddedJson(res.data);
      }
      if (parsed) {
        const projected = _projectPBP(matchId, parsed, BASE_URL() + p);
        if (projected) { result = projected; break; }
      }
    }
  } catch (_) {
    // JAMAIS crasher le poll loop
    result = null;
  }

  _cache.set(_cid, { data: result, ts: Date.now() });
  return result;
}

/**
 * Projection best-effort d'un objet TNNS vers la forme PBP attendue.
 * server/winner 1-indexés (1=p1, 2=p2). idx monotone.
 */
function _projectPBP(matchId, json, sourceUrl) {
  if (!json || typeof json !== 'object') return null;
  try {
    // Noms joueurs
    const p1Name = _cleanName(json.player1 || json.p1 || (json.match && (json.match.player1 || json.match.p1)) || (json.players && json.players[0] && json.players[0].name));
    const p2Name = _cleanName(json.player2 || json.p2 || (json.match && (json.match.player2 || json.match.p2)) || (json.players && json.players[1] && json.players[1].name));

    // Tableau de points : chercher un tableau avec des entrées qui ressemblent
    // à des points (set/game/score/server/winner). TODO : structure exacte TNNS.
    let rawPoints = null;
    const _find = (node) => {
      if (rawPoints) return;
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        if (node.length && node.some((it) => it && typeof it === 'object' && ('server' in it || 'winner' in it || 'score' in it || 'game' in it))) {
          rawPoints = node; return;
        }
        for (const it of node) _find(it);
        return;
      }
      for (const k of Object.keys(node)) _find(node[k]);
    };
    _find(json);

    if (!rawPoints || !rawPoints.length) {
      // Pas de points extractibles → on ne renvoie pas un PBP incomplet.
      return null;
    }

    const points = [];
    let idx = 0;
    for (const pt of rawPoints) {
      if (!pt || typeof pt !== 'object') continue;
      const server = pt.server == null ? null : (Number(pt.server) === 1 || Number(pt.server) === 2 ? Number(pt.server) : null);
      const winner = pt.winner == null ? null : (Number(pt.winner) === 1 || Number(pt.winner) === 2 ? Number(pt.winner) : null);
      if (server == null && winner == null) continue; // pas un vrai point
      idx += 1;
      points.push({
        idx,
        set:        pt.set != null ? Number(pt.set) : null,
        game:       pt.game != null ? Number(pt.game) : null,
        score:      pt.score || pt.pointScore || null,
        server,
        winner,
        shot_type:  pt.shot_type || pt.shotType || null,
        minute:     pt.minute != null ? Number(pt.minute) : null,
      });
    }

    if (!points.length) return null;

    // Compteurs best-effort (aces/double-fautes) si présents dans le JSON.
    const counters = {
      p1_aces: json.p1_aces || json.p1Aces || (json.counters && json.counters.p1_aces) || 0,
      p2_aces: json.p2_aces || json.p2Aces || (json.counters && json.counters.p2_aces) || 0,
      p1_df:   json.p1_df   || json.p1Df   || (json.counters && json.counters.p1_df)   || 0,
      p2_df:   json.p2_df   || json.p2Df   || (json.counters && json.counters.p2_df)   || 0,
    };

    return {
      match_id: matchId,
      source:   'tnns',
      source_url: sourceUrl || (BASE_URL() + '/match/' + encodeURIComponent(matchId)),
      player1:  { name: p1Name || '' },
      player2:  { name: p2Name || '' },
      points,
      last_point_idx: points.length ? points[points.length - 1].idx : 0,
      counters,
      updated_at: Date.now(),
    };
  } catch (_) {
    return null;
  }
}

/**
 * Stats live best-effort (forme compatible _bsd_stats).
 * @returns {Promise<object|null>} stats ou null si non extractible.
 */
async function fetchLiveStats(matchId) {
  if (!matchId) return null;
  if (!ENABLED()) return null;
  const _cid = 'stats:' + matchId;
  const _c = _cache.get(_cid);
  if (_c && (Date.now() - _c.ts) < CACHE_TTL_PBP) return _c.data;

  let result = null;
  try {
    // TODO(legal/endpoint) : endpoint stats TNNS inconnu. Guesses raisonnables.
    const paths = [
      '/api/matches/' + encodeURIComponent(matchId) + '/stats',
      '/api/match/' + encodeURIComponent(matchId) + '/statistics',
      '/match/' + encodeURIComponent(matchId) + '/stats',
    ];
    for (const p of paths) {
      const res = await _getWithRetry(p, 2);
      if (!res || res.status < 200 || res.status >= 300) continue;
      const ctype = (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '';
      let parsed = null;
      if (ctype.indexOf('json') >= 0) {
        try { parsed = JSON.parse(res.data); } catch (_) {}
      } else {
        parsed = _extractEmbeddedJson(res.data);
      }
      if (parsed) {
        const projected = _projectStats(parsed);
        if (projected) { result = projected; break; }
      }
    }
  } catch (_) {
    result = null;
  }

  _cache.set(_cid, { data: result, ts: Date.now() });
  return result;
}

/**
 * Projection best-effort vers la forme _bsd_stats.
 */
function _projectStats(json) {
  if (!json || typeof json !== 'object') return null;
  try {
    const _n = (v) => (v == null ? null : (typeof v === 'number' && !isNaN(v) ? v : (typeof v === 'string' && v !== '' && !isNaN(Number(v)) ? Number(v) : null)));
    const _pct = (a, b) => {
      const an = _n(a), bn = _n(b);
      if (an == null || bn == null || bn === 0) return null;
      return an / bn;
    };
    // Recherche large d'un sous-objet de stats
    let s = null;
    const _scan = (node) => {
      if (s) return;
      if (!node || typeof node !== 'object') return;
      if (!Array.isArray(node) && ('p1_first_won' in node || 'p1_aces' in node || 'p1_first_in' in node || 'first_won' in node)) {
        s = node; return;
      }
      if (Array.isArray(node)) { for (const it of node) _scan(it); return; }
      for (const k of Object.keys(node)) _scan(node[k]);
    };
    _scan(json);
    if (!s) return null;

    const out = {
      p1_first_pct:  s.p1_first_pct  != null ? _n(s.p1_first_pct)  : _pct(s.p1_first_in || s.p1_firstIn, s.p1_first_tot || s.p1_firstTotal),
      p2_first_pct:  s.p2_first_pct  != null ? _n(s.p2_first_pct)  : _pct(s.p2_first_in || s.p2_firstIn, s.p2_first_tot || s.p2_firstTotal),
      p1_first_won:  _n(s.p1_first_won),
      p2_first_won:  _n(s.p2_first_won),
      p1_aces:       _n(s.p1_aces),
      p2_aces:       _n(s.p2_aces),
      p1_df:         _n(s.p1_df),
      p2_df:         _n(s.p2_df),
      p1_bp_saved:   _n(s.p1_bp_saved),
      p2_bp_saved:   _n(s.p2_bp_saved),
      p1_ret_won:    _n(s.p1_ret_won),
      p2_ret_won:    _n(s.p2_ret_won),
    };
    // Au moins une valeur réelle ?
    let any = false;
    for (const k of Object.keys(out)) { if (out[k] != null) { any = true; break; } }
    return any ? out : null;
  } catch (_) {
    return null;
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────
module.exports = { enabled, fetchLiveMatches, fetchPBP, fetchLiveStats };
