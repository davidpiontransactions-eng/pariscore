'use strict';
/**
 * rotowireService.js — Scaffold Rotowire (SOURCE PAYANTE — clé DG requise)
 *
 * Rotowire API : https://api.rotowire.com/{sport}/{endpoint}.php?key=ROTOWIRE_KEY (query param, pas d'OAuth).
 * Endpoints NBA : Injuries, ExpectedLineups, DailyProjections, NewsInjuries.
 *
 * INERTE si ROTOWIRE_KEY absent du .env (retourne { enabled:false }). Aucun appel, aucun coût.
 * Dès qu'une clé est fournie (décision DG) → injuries confirmées + lineups projetés + projections DFS
 * (→ player props, lineup-aware win prob). Plug direct dans basketballService / route /api/v1/nba/rotowire/*.
 *
 * Cache 5 min (injuries volatiles game-day). Zéro dépendance (https natif).
 */

const https = require('https');

const HOST = 'api.rotowire.com';
const KEY  = process.env.ROTOWIRE_KEY || '';
const TTL_MS = 5 * 60 * 1000;
const _cache = {}; // endpoint -> { ts, data }

function _get(path) {
  return new Promise((resolve) => {
    const req = https.request({ host: HOST, path, method: 'GET', headers: { 'User-Agent': 'PariScore', 'Accept': 'application/json' } }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode !== 200) { resolve(null); return; }
        try { resolve(JSON.parse(buf)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function isEnabled() { return !!KEY; }

// endpoint = 'Injuries' | 'ExpectedLineups' | 'DailyProjections' | 'NewsInjuries'
async function fetchNba(endpoint, extraParams = '') {
  if (!KEY) return { enabled: false, note: 'ROTOWIRE_KEY absent — source payante, décision DG' };
  const ck = endpoint + extraParams;
  if (_cache[ck] && Date.now() - _cache[ck].ts < TTL_MS) return { enabled: true, cached: true, data: _cache[ck].data };
  const path = `/Basketball/NBA/${endpoint}.php?key=${encodeURIComponent(KEY)}&format=json${extraParams}`;
  const data = await _get(path);
  if (data == null) return { enabled: true, error: 'rotowire fetch KO (clé invalide / quota / endpoint)' };
  _cache[ck] = { ts: Date.now(), data };
  return { enabled: true, cached: false, data };
}

module.exports = {
  isEnabled,
  getInjuries:    () => fetchNba('Injuries'),
  getLineups:     () => fetchNba('ExpectedLineups'),
  getProjections: () => fetchNba('DailyProjections'),
  getNewsInjuries: (hours = 24) => fetchNba('NewsInjuries', `&hours=${hours}`),
  _fetchNba: fetchNba,
};
