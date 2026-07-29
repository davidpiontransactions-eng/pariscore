'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//  T4.1 — Tennis-API.com integration scaffold (P4 make/buy)
//
//  STATUT : SCAFFOLD PRÊT À BRANCHER — DÉSACTIVÉ PAR DÉFAUT.
//  Rôle : complément PAYANT (RapidAPI, 29-99 $/mois) au momentum tennis maison
//  (aiscore primaire, gratuit). NE REMPLACE PAS aiscore — alimente les GAPS :
//    1. RPW (Return Points Won) réel par adversaire/surface → remplace le
//       hardcoded 0.36 (src/lib/tennis-dr/lookup.ts:203) → améliore Barnett-Clarke.
//    2. PBP fallback (3e source après aiscore + TNNS) si les deux absents.
//    3. Odds pré/live → calibration ROI (impossible avec Sackmann seul).
//
//  ⚠️ Tennis-API.com NE FOURNIT PAS momentum/WP live — uniquement le PBP brut
//     (déjà obtenu via aiscore). La valeur résiduelle = RPW + odds + coverage ITF.
//     Voir .context/P4-TENNIS-MAKE-BUY.md §2.5 (verdict) + §5.2 (BUY conditionnel).
//
//  DÉCISION P4 : GO MAKE prioritaire. Ce scaffold est branchable SI le trial
//  Tennis-API.com valide (schéma JSON réel, latence, fiabilité ATP). Aucune
//  activation sans TENNIS_API_KEY + TENNIS_API_ENABLED=true.
//
//  Pattern : clone de services/tnnsLiveScraper.js (ENABLED gate, cache Map+TTL,
//  _getWithRetry backoff, rotation UA, projection best-effort, jamais throw).
//
//  Auth RapidAPI : headers X-RapidAPI-Key + X-RapidAPI-Host.
//  Host cible : tennis-api-atp-wta-itf.p.rapidapi.com (produit ATP/WTA/ITF).
// ═══════════════════════════════════════════════════════════════════════════════

const https = require('https');

// ── Config (lazy env — server.js parse .env avant le require) ─────────────────
const API_KEY    = () => process.env.TENNIS_API_KEY || '';
const RAPID_HOST = () => process.env.TENNIS_API_HOST || 'tennis-api-atp-wta-itf.p.rapidapi.com';
const ENABLED    = () => process.env.TENNIS_API_ENABLED === 'true' && !!API_KEY();
const TIMEOUT_MS = 8000;
const DEBUG      = String(process.env.TENNIS_API_DEBUG || 'false').toLowerCase() === 'true';
const _dbg = (...a) => { if (DEBUG) console.log('[TennisAPI]', ...a); };

// ── Cache (clé → { data, ts }) ────────────────────────────────────────────────
const _cache = new Map();
const CACHE_TTL_STATS = 6 * 3600 * 1000;   // 6h — stats serve/return changent lentement
const CACHE_TTL_PBP   = 15000;             // 15s — PBP live
const CACHE_TTL_LIST  = 10000;             // 10s — liste live

// ── Rotation User-Agent (furtivité basique, pattern TNNS) ─────────────────────
const _UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];
const _rotateUA = () => _UAS[Math.floor(Math.random() * _UAS.length)];

// ── HTTP GET avec retry (pattern tnnsLiveScraper _getWithRetry) ───────────────
function _get(path, retries = 2) {
  return new Promise((resolve) => {
    if (!ENABLED()) return resolve(null);
    const host = RAPID_HOST();
    const opts = {
      hostname: host,
      path: path.startsWith('/') ? path : '/' + path,
      method: 'GET',
      timeout: TIMEOUT_MS,
      headers: {
        'X-RapidAPI-Key': API_KEY(),
        'X-RapidAPI-Host': host,
        'User-Agent': _rotateUA(),
        'Accept': 'application/json',
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers }); }
          catch (_) { _dbg('JSON parse fail', path); resolve(null); }
        } else {
          _dbg(`HTTP ${res.statusCode}`, path);
          resolve(null);
        }
      });
    });
    req.on('error', (e) => {
      _dbg('req error', path, e.message);
      if (retries > 0) setTimeout(() => _get(path, retries - 1).then(resolve), 1000);
      else resolve(null);
    });
    req.on('timeout', () => { req.destroy(); if (retries > 0) setTimeout(() => _get(path, retries - 1).then(resolve), 1000); else resolve(null); });
    req.end();
  });
}

const _cacheGet = (k, ttl) => { const c = _cache.get(k); return c && (Date.now() - c.ts) < ttl ? c.data : null; };
const _cacheSet = (k, d) => { _cache.set(k, { data: d, ts: Date.now() }); };

// ═══════════════════════════════════════════════════════════════════════════════
//  API publique — signatures alignées sur tnnsLiveScraper (drop-in)
// ═══════════════════════════════════════════════════════════════════════════════

// GAP #1 — RPW (Return Points Won) réel par joueur/surface. Remplace 0.36 dur.
// Schéma attendu Tennis-API.com (à confirmer en trial) :
//   GET /tennis/v2/player-stats?playerId=...&surface=clay
//   → { serve_pts_won_pct, return_pts_won_pct, first_in_pct, ... }
async function fetchPlayerServeReturnStats(playerName, surface) {
  if (!ENABLED() || !playerName) return null;
  const cacheKey = `sr_${playerName}_${surface || 'any'}`;
  const cached = _cacheGet(cacheKey, CACHE_TTL_STATS);
  if (cached) return cached;
  // TODO(trial) : endpoint exact + paramètre de recherche par nom à confirmer.
  // Ci-dessous un guess raisonnable à valider pendant le trial Tennis-API.com.
  const q = encodeURIComponent(playerName);
  const path = `/tennis/v2/player-stats?name=${q}${surface ? `&surface=${surface}` : ''}`;
  const res = await _get(path);
  if (!res || !res.data) return null;
  const projected = _projectServeReturn(res.data);
  if (projected) _cacheSet(cacheKey, projected);
  return projected;
}

function _projectServeReturn(raw) {
  // Projection défensive — le schéma exact sera confirmé en trial.
  // On cherche les champs les plus probables (variantes de nommage RapidAPI).
  const s = raw?.stats || raw?.player_stats || raw || {};
  const _n = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const out = {
    serve_pts_won_pct: _n(s.serve_pts_won_pct ?? s.serve_points_won ?? s.svw_pct),
    return_pts_won_pct: _n(s.return_pts_won_pct ?? s.return_points_won ?? s.rpw_pct),
    first_in_pct: _n(s.first_in_pct ?? s.first_serve_in ?? s.fs_pct),
    first_won_pct: _n(s.first_won_pct ?? s.first_serve_won ?? s.fsw_pct),
    second_won_pct: _n(s.second_won_pct ?? s.second_serve_won ?? s.ssw_pct),
    bp_saved_pct: _n(s.bp_saved_pct ?? s.break_point_saved ?? s.bps_pct),
    aces_per_match: _n(s.aces_per_match ?? s.aces_avg),
    source: 'tennis-api.com',
  };
  // Ne retourne que si au moins serve ou return est présent (sinon pas utile)
  if (out.serve_pts_won_pct == null && out.return_pts_won_pct == null) return null;
  return out;
}

// GAP #2 — PBP fallback (3e source après aiscore + TNNS). Même shape que aiscore
// pour alimenter tennisMomentumTracker.addPoint sans adaptation.
async function fetchPBP(matchId) {
  if (!ENABLED() || !matchId) return null;
  const cacheKey = 'pbp:' + matchId;
  const cached = _cacheGet(cacheKey, CACHE_TTL_PBP);
  if (cached) return cached;
  // TODO(trial) : endpoint live-events PBP exact à confirmer.
  const path = `/tennis/v2/live-events?matchId=${encodeURIComponent(matchId)}`;
  const res = await _get(path);
  if (!res || !res.data) return null;
  const projected = _projectPBP(matchId, res.data);
  if (projected) _cacheSet(cacheKey, projected);
  return projected;
}

function _projectPBP(matchId, raw) {
  // Projection vers la shape aiscore : { points: [{idx,set,game,score,server,winner,shot_type,minute}], counters }
  const events = raw?.events || raw?.points || (Array.isArray(raw) ? raw : []);
  if (!Array.isArray(events) || !events.length) return null;
  const points = events.map((e, i) => ({
    idx: e.point_number ?? e.idx ?? i,
    set: e.set ?? null,
    game: e.game ?? null,
    score: e.score_after_point ?? e.score ?? null,
    server: e.server ?? null,
    winner: e.event?.winner ?? e.winner ?? null,
    shot_type: e.event?.type ?? e.shot_type ?? null,
    minute: null,
  }));
  return { match_id: matchId, source: 'tennis-api.com', points, updated_at: Date.now() };
}

// GAP #3 — Odds pré/live (calibration ROI). Pas implémenté tant que le besoin
// ROI n'est pas validé (Sackmann sans odds = bloqueur identifié server.js:29693).
// async function fetchMatchOdds(matchId) { ... }  // TODO si BUY validé

async function fetchLiveMatches() {
  if (!ENABLED()) return [];
  const cached = _cacheGet('live_list', CACHE_TTL_LIST);
  if (cached) return cached;
  const res = await _get('/tennis/v2/match/live');
  if (!res || !res.data) return [];
  const list = Array.isArray(res.data) ? res.data : (res.data?.matches || res.data?.results || []);
  _cacheSet('live_list', list);
  return list;
}

// ── Exports (signature alignée sur tnnsLiveScraper pour drop-in) ──────────────
module.exports = {
  enabled: ENABLED,
  fetchLiveMatches,
  fetchPBP,
  fetchPlayerServeReturnStats,   // GAP #1 RPW (point d'extension lookup.ts:203)
  // fetchMatchOdds,              // GAP #3 (TODO si BUY validé)
};
