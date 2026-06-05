'use strict';
/**
 * refresh_bo3_map_rounds.js — Avg TOTAL rounds per map per team (over/under edge)
 * Source : bo3.gg public JSON API (api.bo3.gg/api/v1) — NOT Cloudflare-blocked (VPS-direct).
 * Output : data/bo3_map_rounds.json
 *
 * Marché ciblé : Over/Under rounds CS2 par map. avg_rounds = winner_clan_score + loser_clan_score
 * (champ `rounds_count`), agrégé sur fenêtres 3/6/12 mois, par équipe et par carte.
 *
 * Pipeline validé (eval 2026-06-05) :
 *   1. /teams/{slug}                         → bo3 team id
 *   2. /matches filter[matches.team1_id|team2_id][eq] + start_date[gt] status=finished → match ids
 *   3. /games   filter[games.match_id][eq]   state=done → rounds_count par map (begin_at pour bucket)
 *
 * Quirks API bo3 (NE PAS régresser) :
 *   - préfixe filtre = table plurielle : filter[matches.*] / filter[games.*]
 *   - opérateur date = [gt] uniquement ([gte]/[gteq] silencieusement ignorés)
 *   - team = 2 requêtes (team1_id + team2_id), pas d'OR natif
 *
 * Run  : node tools/refresh_bo3_map_rounds.js
 * Cron : 0 6 * * 0  (weekly, VPS direct — pas besoin d'IP résidentielle)
 * Env  : BO3_MAX_TEAMS (default 30), BO3_MAX_MATCHES (default 80 récents/équipe sur 365j)
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_HOST     = 'api.bo3.gg';
const API_BASE     = '/api/v1';
const RANKINGS_FILE = path.join(__dirname, '..', 'data', 'hltv_rankings.json');
const OUTPUT_FILE   = path.join(__dirname, '..', 'data', 'bo3_map_rounds.json');
const MAX_TEAMS    = parseInt(process.env.BO3_MAX_TEAMS   || '30', 10);
const MAX_MATCHES  = parseInt(process.env.BO3_MAX_MATCHES || '80', 10);
const DELAY_MS     = 150;                 // politesse inter-requête
const WINDOWS      = [90, 180, 365];      // 3 / 6 / 12 mois
const ACTIVE_MAPS  = ['de_mirage','de_inferno','de_nuke','de_ancient','de_anubis','de_dust2','de_overpass','de_train','de_vertigo'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// GET JSON depuis bo3 API. params = objet {key: value} (keys déjà au format filter[...]).
function apiGet(endpoint, params = {}) {
  const qs = Object.keys(params)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  const reqPath = `${API_BASE}/${endpoint}${qs ? '?' + qs : ''}`;
  return new Promise((resolve) => {
    const opts = {
      host: API_HOST, path: reqPath, method: 'GET',
      headers: {
        'User-Agent': UA, 'Accept': 'application/json',
        'Origin': 'https://bo3.gg', 'Referer': 'https://bo3.gg/',
      },
    };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode !== 200) { resolve(null); return; }
        try { resolve(JSON.parse(buf)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function slugify(name) {
  return String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function loadTeams() {
  try {
    const raw = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf8'));
    return (raw.teams || []).slice(0, MAX_TEAMS);
  } catch (e) {
    console.error('[bo3] Cannot read rankings file:', e.message);
    process.exit(1);
  }
}

async function resolveTeamId(name) {
  const d = await apiGet(`teams/${slugify(name)}`);
  return (d && d.id) ? { id: d.id, name: d.name, rank: d.rank } : null;
}

// Récupère les match_ids finished d'une équipe sur 365j (les 2 côtés), avec start_date.
async function fetchTeamMatchIds(teamId, sinceISO) {
  const ids = new Map(); // id -> start_date
  for (const side of ['team1_id', 'team2_id']) {
    let offset = 0;
    while (ids.size < MAX_MATCHES) {
      const d = await apiGet('matches', {
        [`filter[matches.${side}][eq]`]: teamId,
        'filter[matches.start_date][gt]': sinceISO,
        'filter[matches.status][eq]': 'finished',
        'sort': '-start_date',
        'page[limit]': 50,
        'page[offset]': offset,
      });
      await sleep(DELAY_MS);
      const rows = (d && Array.isArray(d.results)) ? d.results : [];
      for (const m of rows) ids.set(m.id, m.start_date);
      if (rows.length < 50) break;
      offset += 50;
    }
  }
  return ids;
}

// Récupère les games (maps) done d'un match → [{ map_name, rounds_count, begin_at }]
async function fetchMatchGames(matchId) {
  const d = await apiGet('games', {
    'filter[games.match_id][eq]': matchId,
    'filter[games.state][eq]': 'done',
  });
  await sleep(DELAY_MS);
  const rows = (d && Array.isArray(d.results)) ? d.results : [];
  return rows.map(g => ({
    map_name: g.map_name,
    rounds_count: (g.rounds_count != null) ? g.rounds_count
      : ((g.winner_clan_score != null && g.loser_clan_score != null) ? g.winner_clan_score + g.loser_clan_score : null),
    begin_at: g.begin_at,
  })).filter(g => g.rounds_count != null && g.map_name);
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function round2(x) { return x == null ? null : Math.round(x * 100) / 100; }

async function processTeam(team, nowMs, cutoffMs) {
  const resolved = await resolveTeamId(team.name);
  if (!resolved) { console.warn(`  [${team.name}] bo3 id introuvable — skip`); return null; }
  const sinceISO = new Date(cutoffMs).toISOString().slice(0, 10);
  console.log(`  [${team.name}] bo3 id=${resolved.id} — fetch matches…`);

  const matchIds = await fetchTeamMatchIds(resolved.id, sinceISO);
  // games : map_name → [{rounds, ageMs}]
  const byMap = {};
  let gamesTotal = 0;
  for (const [mid] of matchIds) {
    const games = await fetchMatchGames(mid);
    for (const g of games) {
      const ageMs = nowMs - new Date(g.begin_at).getTime();
      (byMap[g.map_name] = byMap[g.map_name] || []).push({ r: g.rounds_count, ageMs });
      gamesTotal++;
    }
  }

  // Agrégation par carte × fenêtre
  const maps = {};
  for (const mapName of Object.keys(byMap)) {
    const rec = {};
    for (const w of WINDOWS) {
      const cut = w * 86400000;
      const vals = byMap[mapName].filter(x => x.ageMs <= cut).map(x => x.r);
      rec[`w${w}`] = { avg: round2(avg(vals)), n: vals.length };
    }
    maps[mapName] = rec;
  }
  // Overall (toutes maps confondues) par fenêtre
  const overall = {};
  for (const w of WINDOWS) {
    const cut = w * 86400000;
    const vals = Object.values(byMap).flat().filter(x => x.ageMs <= cut).map(x => x.r);
    overall[`w${w}`] = { avg: round2(avg(vals)), n: vals.length };
  }

  console.log(`  [${team.name}] ${matchIds.size} matchs · ${gamesTotal} maps · overall365 avg=${overall.w365.avg} (n=${overall.w365.n})`);
  return { name: team.name, hltv_rank: team.rank ?? null, bo3_id: resolved.id, maps, overall };
}

async function main() {
  const teams = loadTeams();
  const nowMs = Date.now();
  const cutoffMs = nowMs - Math.max(...WINDOWS) * 86400000;
  console.log(`[bo3] Refresh map rounds — ${teams.length} teams, windows ${WINDOWS.join('/')}d`);

  const out = [];
  for (const t of teams) {
    try {
      const rec = await processTeam(t, nowMs, cutoffMs);
      if (rec) out.push(rec);
    } catch (e) {
      console.warn(`  [${t.name}] erreur: ${e.message}`);
    }
  }

  const payload = {
    generated: new Date().toISOString(),
    source: 'bo3.gg/api/v1',
    metric: 'avg_total_rounds_per_map',
    windows_days: WINDOWS,
    note: 'rounds_count = winner_clan_score + loser_clan_score. Over/Under rounds market. NON calibré — backtest Brier requis avant signal BET.',
    teams: out,
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`[bo3] OK — ${out.length}/${teams.length} teams → ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main().catch(e => { console.error('[bo3] FATAL', e); process.exit(1); });
}

module.exports = { slugify, _apiGet: apiGet };
