/**
 * basketballH2HService.js — Stats H2H (Head-to-Head) + répartitions Over/Under
 * pour NBA & WNBA, recalculées depuis les données ESPN (gratuit, pas de clé).
 *
 * Référence produit : .context/report-h2h-basketballstats.md (snapshot basketballstats.net)
 * Prompt : .context/prompt-h2h-basketballstats.md
 *
 * Décisions verrouillées (2026-08-14, rapport §9) :
 *   - netRating = marge moyenne (PAS la valeur "spread" du site source)
 *   - Offensive Rating (tableau H2H) supprimée
 *   - Assists/Rebounds Per Game recalculés sur l'échantillon H2H (summaries ESPN)
 *   - Rating joueur non implémenté (Plus/Minus seul)
 *
 * Hosts ESPN : site.web.api.espn.com en primaire (site.api bloqué 403 par Akamai
 * depuis certaines IPs — constaté 2026-08-14), fallback site.api.espn.com.
 *
 * Caches :
 *   - disque data/basketball_h2h/{league}_season.json     TTL 6h  (saison courante)
 *   - disque data/basketball_h2h/{league}_hist_{season}.json TTL 7j (historique 2009+)
 *   - disque data/basketball_h2h/{league}_ev_{id}.json    TTL 30j (summary par match)
 *   - disque data/basketball_h2h/{league}_roster_{tid}.json TTL 12h
 *   - disque data/basketball_h2h/{league}_ath_{aid}.json  TTL 12h (stats joueur)
 *   - mémoire (Map) en front des caches disque
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Configuration ligues ────────────────────────────────────────────────────

const ESPN_HOSTS = ['site.web.api.espn.com', 'site.api.espn.com'];
const WEB_HOST = 'site.web.api.espn.com'; // common/v3 (roster/athletes) — host canonique

const LEAGUES = {
  wnba: {
    sportPath: 'basketball/wnba',
    // Saison civile : mai → octobre (playoffs incluses)
    range: (y) => ({ start: `${y}0501`, end: `${y}1031`, label: String(y) }),
    currentSeason: () => new Date().getFullYear(),
  },
  nba: {
    sportPath: 'basketball/nba',
    // Saison oct→juin : saison "2025" = oct 2025 → juin 2026
    range: (y) => ({ start: `${y}1001`, end: `${y + 1}0630`, label: String(y) }),
    currentSeason: () => {
      const d = new Date();
      return d.getMonth() + 1 >= 10 ? d.getFullYear() : d.getFullYear() - 1;
    },
  },
};

const HISTORY_FIRST_SEASON = 2009; // périmètre H2H : 2009 → saison courante (rapport : 68 matchs CT/ATL)

const TTL = {
  season: 6 * 3600 * 1000,
  history: 7 * 24 * 3600 * 1000,
  event: 30 * 24 * 3600 * 1000,
  roster: 12 * 3600 * 1000,
  athlete: 12 * 3600 * 1000,
  standings: 6 * 3600 * 1000,
};

const DATA_DIR = path.join(__dirname, '..', 'data', 'basketball_h2h');

// ── HTTP helpers (pattern des services existants) ──────────────────────────

function _httpsGet(host, urlPath, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const opts = {
      host,
      path: urlPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 PariScore',
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };
    const req = https.request(opts, (r) => {
      let buf = '';
      r.on('data', (c) => { buf += c; });
      r.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error(`HTTP ${r.statusCode} — réponse non JSON (${host}${urlPath.slice(0, 60)})`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

/** GET JSON avec bascule de host (site.web.api primaire, site.api fallback). */
async function _espnGet(urlPath, timeoutMs) {
  let lastErr = null;
  for (const host of ESPN_HOSTS) {
    try { return await _httpsGet(host, urlPath, timeoutMs); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('ESPN injoignable');
}

// ── Cache disque + mémoire ──────────────────────────────────────────────────

const _mem = new Map(); // file -> { ts, data }

function _loadJson(file, ttlMs) {
  const m = _mem.get(file);
  if (m && Date.now() - m.ts < ttlMs) return m.data;
  try {
    const full = path.join(DATA_DIR, file);
    const st = fs.statSync(full);
    if (Date.now() - st.mtimeMs < ttlMs) {
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      _mem.set(file, { ts: Date.now(), data });
      return data;
    }
  } catch (_) { /* absent ou expiré */ }
  return null;
}

function _saveJson(file, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data));
    _mem.set(file, { ts: Date.now(), data });
  } catch (e) { console.warn('[H2H] cache disque:', e.message); }
}

function _round1(v) { return v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10; }
function _round2(v) { return v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100; }
function _roundPct(v) { return v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10; }

// ── Normalisation scoreboard → matchs ───────────────────────────────────────

function _teamLogo(team) {
  if (team && team.logos && team.logos[0] && team.logos[0].href) return team.logos[0].href;
  if (team && team.logo) return team.logo;
  return null;
}

/** Normalise un event ESPN scoreboard en match exploitable (scores + quartiers). */
function _normEvent(ev, league) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp || !Array.isArray(comp.competitors)) return null;
  const status = (ev.status && ev.status.type) || {};
  let home = null, away = null;
  for (const c of comp.competitors) {
    const t = {
      id: String(c.team && c.team.id),
      name: (c.team && (c.team.displayName || c.team.name)) || '?',
      abbr: (c.team && c.team.abbreviation) || '',
      logo: _teamLogo(c.team),
    };
    const ls = Array.isArray(c.linescores) ? c.linescores.map((l) => (l.value != null ? Number(l.value) : null)) : [];
    const entry = { ...t, score: Number(c.score) || 0, q: ls };
    if (c.homeAway === 'home') home = entry; else if (c.homeAway === 'away') away = entry;
  }
  if (!home || !away || !home.id || !away.id) return null;
  return {
    id: String(ev.id),
    league,
    date: ev.date || '',
    completed: !!status.completed,
    home, away,
    homeScore: home.score,
    awayScore: away.score,
  };
}

function _quarter(t, i) { return (t.q && Number.isFinite(t.q[i])) ? t.q[i] : null; }

/** Points par quartier et par moitié. Retour [q1,q2,q3,q4] (OT fusionnées au Q4 si besoin) et [h1,h2]. */
function _periods(m, side) {
  const t = m[side];
  const q = [];
  for (let i = 0; i < 4; i++) {
    let v = _quarter(t, i);
    if (v == null) return { ok: false, q: null, h: null };
    q.push(v);
  }
  // Prolongations : additionnées à la 2e mi-temps (les seuils du site restent réglementaires)
  let ot = 0;
  if (t.q) for (let i = 4; i < t.q.length; i++) if (Number.isFinite(t.q[i])) ot += t.q[i];
  return { ok: true, q, h: [q[0] + q[1], q[2] + q[3] + ot] };
}

// ── Fetchers saisons ────────────────────────────────────────────────────────

async function _fetchScoreboardRange(league, start, end) {
  const cfg = LEAGUES[league];
  const d = await _espnGet(`/apis/site/v2/sports/${cfg.sportPath}/scoreboard?dates=${start}-${end}&limit=500`);
  const evs = (d && Array.isArray(d.events)) ? d.events : [];
  return evs.map((e) => _normEvent(e, league)).filter(Boolean);
}

/** Saison courante (cache disque 6h). Matchs complétés uniquement. */
async function getSeasonMatches(league) {
  _assertLeague(league);
  const file = `${league}_season.json`;
  const cached = _loadJson(file, TTL.season);
  if (cached) return cached;
  const season = LEAGUES[league].currentSeason();
  const { start, end } = LEAGUES[league].range(season);
  const all = await _fetchScoreboardRange(league, start, end);
  const matches = all.filter((m) => m.completed && m.homeScore + m.awayScore > 0);
  const payload = { season, fetchedAt: new Date().toISOString(), count: matches.length, matches };
  _saveJson(file, payload);
  return payload;
}

/** Historique multi-saisons (cache par saison 7j). Saison courante réutilisée. */
async function getHistoryMatches(league) {
  _assertLeague(league);
  const cur = LEAGUES[league].currentSeason();
  const out = [];
  const pending = [];
  for (let y = HISTORY_FIRST_SEASON; y <= cur; y++) {
    if (y === cur) { pending.push(getSeasonMatches(league).then((p) => p.matches)); continue; }
    const file = `${league}_hist_${y}.json`;
    const cached = _loadJson(file, TTL.history);
    if (cached) { out.push(...cached.matches); continue; }
    pending.push((async () => {
      const { start, end } = LEAGUES[league].range(y);
      const ms = (await _fetchScoreboardRange(league, start, end)).filter((m) => m.completed && m.homeScore + m.awayScore > 0);
      _saveJson(file, { season: y, count: ms.length, matches: ms });
      return ms;
    })());
  }
  const chunks = await Promise.all(pending); // fetchs parallèles par saison
  for (const c of chunks) out.push(...c);
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

/**
 * Historique H2H d'une PAIRE via l'endpoint schedule par équipe (le scoreboard
 * ESPN ne couvre pas toutes les saisons passées — saisons trous constatées 2026-08-14,
 * ex. 2012-2015 vides ; teams/{id}/schedule?season=Y retourne tout l'historique).
 * Les linescores ne sont pas fournies sur le vieil historique (scores seuls — suffisant
 * pour split/PPG/liste ; les tableaux Over portent sur la saison courante).
 */
function _scoreVal(c) {
  if (c.score == null) return 0;
  if (typeof c.score === 'number') return c.score;
  const v = parseFloat(c.score.value != null ? c.score.value : c.score.displayValue);
  return Number.isFinite(v) ? v : 0;
}

function _normScheduleEvent(ev, league) {
  const comp = ev.competitions && ev.competitions[0];
  if (!comp || !Array.isArray(comp.competitors)) return null;
  // Exclut la préseason — périmètre du site source : regular + playoffs.
  // NB : type.id n'est PAS le seasonType (exhibition a id "18", standard id "1") → filtrer sur type.type/slugs
  const ctype = comp.type && (comp.type.type || comp.type.slug);
  if (ctype === 'exhibition') return null;
  const status = (comp.status && comp.status.type) || (ev.status && ev.status.type) || {};
  let home = null, away = null;
  for (const c of comp.competitors) {
    const t = {
      id: String(c.team && c.team.id),
      name: (c.team && (c.team.displayName || c.team.name)) || '?',
      abbr: (c.team && c.team.abbreviation) || '',
      logo: _teamLogo(c.team),
    };
    const entry = { ...t, score: _scoreVal(c), q: [] };
    if (c.homeAway === 'home') home = entry; else if (c.homeAway === 'away') away = entry;
  }
  if (!home || !away || !home.id || !away.id) return null;
  const scoreOk = home.score + away.score > 0;
  return {
    id: String(ev.id),
    league,
    date: ev.date || (comp.date) || '',
    completed: !!status.completed || scoreOk,
    home, away,
    homeScore: home.score,
    awayScore: away.score,
  };
}

async function _fetchTeamSchedule(league, teamId, season) {
  const file = `${league}_sched_${teamId}_${season}.json`;
  const cached = _loadJson(file, TTL.history);
  if (cached) return cached;
  const cfg = LEAGUES[league];
  // seasontype 2 (regular) + 3 (postseason) — le sans-filtre inclut des exhibitions
  // étiquetées "standard" dans les archives (constaté 2018/2022/2023, matchs de mai
  // antérieurs au début de saison, exclus par le site source).
  const base = `/apis/site/v2/sports/${cfg.sportPath}/teams/${teamId}/schedule?season=${season}`;
  const [reg, post] = await Promise.all([
    _espnGet(`${base}&seasontype=2`).catch(() => null),
    _espnGet(`${base}&seasontype=3`).catch(() => null),
  ]);
  if (!reg && !post) return []; // échec réseau → PAS de cache (anti poison-cache)
  const evs = [...((reg && reg.events) || []), ...((post && post.events) || [])];
  const seen = new Map();
  const ms = [];
  for (const e of evs) {
    const m = _normScheduleEvent(e, league);
    if (m && !seen.has(m.id)) { seen.set(m.id, 1); ms.push(m); }
  }
  const played = ms.filter((m) => m.completed && m.homeScore + m.awayScore > 0);
  if (played.length) _saveJson(file, played);
  return played;
}

/** Map avec concurrence limitée (rate-limit ESPN — max `concurrency` promises actives). */
async function _mapLimit(items, concurrency, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

/** H2H d'une paire : saisons 2009→courante, via schedules des 2 équipes (cache paire 7j). */
async function getPairHistory(league, teamAId, teamBId) {
  _assertLeague(league);
  const file = `${league}_h2hpair_${teamAId}_${teamBId}.json`;
  const cached = _loadJson(file, TTL.history);
  if (cached) return cached;
  const cur = LEAGUES[league].currentSeason();
  const seasons = [];
  for (let y = HISTORY_FIRST_SEASON; y <= cur; y++) seasons.push(y);
  // concurrence limitée : 4 saisons en parallèle (2 fetchs/saison) — anti rate-limit ESPN
  const chunks = await _mapLimit(seasons, 4, async (y) => {
    const [schedA, schedB] = await Promise.all([
      _fetchTeamSchedule(league, teamAId, y),
      y === cur ? getSeasonMatches(league).then((p) => p.matches) : _fetchTeamSchedule(league, teamBId, y),
    ]);
    const pool = [...schedA, ...schedB];
    const seen = new Map();
    for (const m of pool) {
      const both = (m.home.id === teamAId && m.away.id === teamBId) || (m.home.id === teamBId && m.away.id === teamAId);
      if (both && !seen.has(m.id)) seen.set(m.id, m);
    }
    return [...seen.values()];
  });
  const all = chunks.flat().sort((a, b) => (a.date < b.date ? 1 : -1));
  if (all.length >= 8) _saveJson(file, all); // n'archive que si l'historique est substantiel
  return all;
}

// ── Enrichissement summaries (FG%, 3P%, AST, REB par match) — lazy ─────────

const SUMMARY_STATS = ['fieldGoalPct', 'threePointPct', 'assists', 'rebounds', 'fieldGoalsMade', 'fieldGoalsAttempted'];

/** Summary d'un match → { [teamId]: {fgPct, threePct, ast, reb} } (cache disque 30j). */
async function _getEventSummary(league, eventId) {
  const file = `${league}_ev_${eventId}.json`;
  const cached = _loadJson(file, TTL.event);
  if (cached) return cached;
  const cfg = LEAGUES[league];
  const d = await _httpsGet(WEB_HOST, `/apis/site/v2/sports/${cfg.sportPath}/summary?event=${eventId}`).catch(() => null);
  if (!d) return null;
  const box = d.boxscore && d.boxscore.teams;
  const res = {};
  if (Array.isArray(box)) {
    for (const bt of box) {
      const tid = bt.team && String(bt.team.id);
      if (!tid) continue;
      const stats = {};
      const list = (bt.statistics && bt.statistics[0] && bt.statistics[0].stats) || [];
      for (const s of list) {
        if (SUMMARY_STATS.includes(s.name) || SUMMARY_STATS.includes(s.key)) {
          stats[s.name || s.key] = parseFloat(s.displayValue);
        }
      }
      res[tid] = {
        fgPct: Number.isFinite(stats.fieldGoalPct) ? stats.fieldGoalPct : null,
        threePct: Number.isFinite(stats.threePointPct) ? stats.threePointPct : null,
        ast: Number.isFinite(stats.assists) ? stats.assists : null,
        reb: Number.isFinite(stats.rebounds) ? stats.rebounds : null,
      };
    }
  }
  if (Object.keys(res).length) _saveJson(file, res);
  return Object.keys(res).length ? res : null;
}

/** Enrichit en tâche de fond (fire-and-forget) une liste de matchs, par batchs. */
function _enrichInBackground(league, matches, batchSize = 8) {
  const ids = matches.map((m) => m.id);
  let i = 0;
  const next = () => {
    const batch = ids.slice(i, i + batchSize);
    i += batchSize;
    if (!batch.length) return;
    Promise.all(batch.map((id) => _getEventSummary(league, id).catch(() => null))).then(next);
  };
  next();
}

// ── Calculs purs (exportés pour les tests) ──────────────────────────────────

function _rangeThresholds(from, to) {
  const out = [];
  for (let v = from; v <= to + 0.001; v += 1) out.push(Math.round(v * 10) / 10);
  return out;
}

/** Distribution Over : % de valeurs strictement supérieures au seuil. */
function computeOverDistribution(values, thresholds) {
  const n = values.length;
  return thresholds.map((t) => ({
    threshold: Math.round(t * 10) / 10,
    pct: n ? _roundPct((100 * values.filter((v) => v > t).length) / n) : 0,
  }));
}

const THRESHOLDS = {
  team: _rangeThresholds(70.5, 130.5),
  quarter: _rangeThresholds(19.5, 35.5),
  half: _rangeThresholds(40.5, 78.5),
  spreadPos: _rangeThresholds(0.5, 19.5),
  match: _rangeThresholds(171.5, 250.5),
  bttsFT: _rangeThresholds(59.5, 129.5),
  bttsHalf: _rangeThresholds(29.5, 90.5),
  bttsQuarter: _rangeThresholds(17.5, 60.5),
};

/** Split de victoires H2H. */
function computeSplit(matches, teamAId, teamBId) {
  let aWins = 0, bWins = 0;
  for (const m of matches) {
    const aHome = m.home.id === teamAId;
    const aScore = aHome ? m.homeScore : m.awayScore;
    const bScore = aHome ? m.awayScore : m.homeScore;
    if (aScore > bScore) aWins++; else bWins++;
  }
  const total = aWins + bWins;
  return {
    aWins, bWins, total,
    aPct: total ? _roundPct((100 * aWins) / total) : null,
    bPct: total ? _roundPct((100 * bWins) / total) : null,
  };
}

/** Data points H2H (décisions §9 : pas d'OffRating ; AST/REB recalculés ; 3P%/FG% via summaries si dispo). */
function computeDataPoints(matches, teamAId, teamBId, summaries) {
  let aPts = 0, bPts = 0;
  let aFg = [], a3 = [], aAst = [], aReb = [], bFg = [], b3 = [], bAst = [], bReb = [];
  for (const m of matches) {
    const aHome = m.home.id === teamAId;
    aPts += aHome ? m.homeScore : m.awayScore;
    bPts += aHome ? m.awayScore : m.homeScore;
    const s = summaries && summaries[m.id];
    if (s) {
      const A = s[teamAId], B = s[teamBId];
      if (A) { if (A.fgPct != null) aFg.push(A.fgPct); if (A.threePct != null) a3.push(A.threePct); if (A.ast != null) aAst.push(A.ast); if (A.reb != null) aReb.push(A.reb); }
      if (B) { if (B.fgPct != null) bFg.push(B.fgPct); if (B.threePct != null) b3.push(B.threePct); if (B.ast != null) bAst.push(B.ast); if (B.reb != null) bReb.push(B.reb); }
    }
  }
  const n = matches.length;
  const mean = (arr) => (arr.length ? _round1(arr.reduce((x, y) => x + y, 0) / arr.length) : null);
  const ppgA = n ? _round2(aPts / n) : null;
  const ppgB = n ? _round2(bPts / n) : null;
  return {
    wins: { a: null, b: null }, // rempli par l'appelant (computeSplit)
    ppg: { a: ppgA, b: ppgB },
    pointSpread: { a: ppgA != null && ppgB != null ? _round1(ppgA - ppgB) : null, b: ppgA != null && ppgB != null ? _round1(ppgB - ppgA) : null },
    fgPct: { a: mean(aFg), b: mean(bFg) },
    threePct: { a: mean(a3), b: mean(b3) },
    assistsPerGame: { a: mean(aAst), b: mean(bAst) },
    reboundsPerGame: { a: mean(aReb), b: mean(bReb) },
  };
}

/**
 * Stats saison par venue (overall/home/away). netRating = marge moyenne (décision §9).
 * form6/results5 sont calculés sur `formMatches` (saison complète) quand fourni :
 * le site basketballstats.net affiche le form temps réel (inclut le match analysé)
 * alors que les stats saison l'excluent (troncature `before`).
 */
function computeTeamSeasonStats(matches, teamId, formMatches) {
  const build = (list) => {
    const n = list.length;
    if (!n) return null;
    let w = 0, pts = 0, pa = 0, lead1h = 0, leadOk = 0;
    for (const m of list) {
      const home = m.home.id === teamId;
      const sc = home ? m.homeScore : m.awayScore;
      const op = home ? m.awayScore : m.homeScore;
      if (sc > op) w++;
      pts += sc; pa += op;
      const p = _periods(m, home ? 'home' : 'away');
      if (p.ok) {
        leadOk++;
        if (p.h[0] > p.h[1]) lead1h++;
      }
    }
    return {
      games: n,
      winPct: _roundPct((100 * w) / n),
      ppg: _round1(pts / n),
      papg: _round1(pa / n),
      avgMargin: _round1((pts - pa) / n), // = netRating (décision §9)
      leadAtHalfPct: leadOk ? _roundPct((100 * lead1h) / leadOk) : null,
    };
  };
  const formSource = formMatches || matches;
  const sorted = [...formSource].sort((a, b) => (a.date < b.date ? -1 : 1));
  const form6 = sorted.slice(-6).map((m) => {
    const home = m.home.id === teamId;
    const sc = home ? m.homeScore : m.awayScore;
    return sc > (home ? m.awayScore : m.homeScore) ? 'W' : 'L';
  });
  const results5 = sorted.slice(-5).map((m) => {
    const home = m.home.id === teamId;
    const sc = home ? m.homeScore : m.awayScore;
    return sc > (home ? m.awayScore : m.homeScore) ? 'W' : 'L';
  });
  return {
    overall: build(matches),
    home: build(matches.filter((m) => m.home.id === teamId)),
    away: build(matches.filter((m) => m.away.id === teamId)),
    form6: form6.reverse(), // du plus récent au plus ancien
    results5: results5.reverse(),
  };
}

/** Répartitions Over d'une équipe : points match, par quartier, par mi-temps. */
function computeTeamOverStats(matches, teamId) {
  const gamePts = [], qPts = [[], [], [], []], hPts = [[], []];
  for (const m of matches) {
    const side = m.home.id === teamId ? 'home' : 'away';
    const t = m[side];
    gamePts.push(t.score);
    const p = _periods(m, side);
    if (p.ok) {
      for (let i = 0; i < 4; i++) qPts[i].push(p.q[i]);
      hPts[0].push(p.h[0]); hPts[1].push(p.h[1]);
    }
  }
  const avg = (a) => (a.length ? _round1(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return {
    avg: avg(gamePts),
    points: { avg: avg(gamePts), thresholds: computeOverDistribution(gamePts, THRESHOLDS.team) },
    quarters: [0, 1, 2, 3].map((i) => ({ q: `Q${i + 1}`, avg: avg(qPts[i]), thresholds: computeOverDistribution(qPts[i], THRESHOLDS.quarter) })),
    halves: [{ h: '1H', avg: avg(hPts[0]), thresholds: computeOverDistribution(hPts[0], THRESHOLDS.half) },
             { h: '2H', avg: avg(hPts[1]), thresholds: computeOverDistribution(hPts[1], THRESHOLDS.half) }],
  };
}

/** Distribution de la marge (positive/négative) + marge moyenne (décision §9). */
function computeTeamSpreadStats(matches, teamId) {
  const margins = [];
  for (const m of matches) {
    const home = m.home.id === teamId;
    margins.push((home ? m.homeScore - m.awayScore : m.awayScore - m.homeScore));
  }
  const avg = (a) => (a.length ? _round2(a.reduce((x, y) => x + y, 0) / a.length) : null);
  const neg = _rangeThresholds(0.5, 19.5).map((t) => t);
  return {
    avgMargin: avg(margins),
    positive: computeOverDistribution(margins, THRESHOLDS.spreadPos),
    negative: neg.map((t) => ({
      threshold: -t,
      // Over -X.5 = l'équipe n'a pas perdu de plus de X points (marge > -X.5)
      pct: margins.length ? _roundPct((100 * margins.filter((v) => v > -t).length) / margins.length) : 0,
    })),
  };
}

/** Over du total match (équipe + adversaire) : 3 colonnes A / B / moyenne. */
function computeMatchOverStats(matchesA, matchesB) {
  const totals = (list, teamId) => list.map((m) => m.homeScore + m.awayScore).filter((v) => v > 0);
  const ta = totals(matchesA), tb = totals(matchesB);
  const dist = computeOverDistribution(ta, THRESHOLDS.match);
  const distB = computeOverDistribution(tb, THRESHOLDS.match);
  const avg = (a) => (a.length ? _round2(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return {
    avgA: avg(ta), avgB: avg(tb), avgMatch: avg([...ta, ...tb]),
    thresholds: dist.map((d, i) => ({ threshold: d.threshold, a: d.pct, b: distB[i].pct, avg: _roundPct((d.pct + distB[i].pct) / 2) })),
  };
}

/**
 * BTTS par scope (décision produit : distribution des points de l'équipe pour le scope,
 * 3 colonnes A / B / moyenne — cf. analyse rapport §4.9 : "Points Scored Average" par équipe).
 */
function computeBTTSStats(matchesA, matchesB, scope, teamAId, teamBId) {
  const collect = (list, teamId) => {
    const vals = [];
    for (const m of list) {
      const side = m.home.id === teamId ? 'home' : 'away';
      if (scope === 'ft') { vals.push(m[side].score); continue; }
      const p = _periods(m, side);
      if (!p.ok) continue;
      if (scope === '1h') vals.push(p.h[0]);
      else if (scope === '2h') vals.push(p.h[1]);
      else if (scope === '1q') vals.push(p.q[0]);
      else if (scope === '2q') vals.push(p.q[1]);
      else if (scope === '3q') vals.push(p.q[2]);
      else if (scope === '4q') vals.push(p.q[3]);
    }
    return vals;
  };
  const cfg = {
    ft: THRESHOLDS.bttsFT, '1h': THRESHOLDS.bttsHalf, '2h': THRESHOLDS.bttsHalf,
    '1q': THRESHOLDS.bttsQuarter, '2q': THRESHOLDS.bttsQuarter, '3q': THRESHOLDS.bttsQuarter, '4q': THRESHOLDS.bttsQuarter,
  }[scope];
  if (!cfg) throw new Error(`scope BTTS invalide: ${scope}`);
  const va = collect(matchesA, teamAId);
  const vb = collect(matchesB, teamBId);
  const da = computeOverDistribution(va, cfg);
  const db = computeOverDistribution(vb, cfg);
  const avg = (a) => (a.length ? _round2(a.reduce((x, y) => x + y, 0) / a.length) : null);
  return {
    avgA: avg(va), avgB: avg(vb), avgAvg: avg([...va, ...vb]),
    thresholds: da.map((d, i) => ({ threshold: d.threshold, a: d.pct, b: db[i].pct, avg: _roundPct((d.pct + db[i].pct) / 2) })),
  };
}

// ── Équipes, standings, joueurs ─────────────────────────────────────────────

function _assertLeague(league) {
  if (!LEAGUES[league]) throw new Error(`ligue invalide: ${league} (nba|wnba)`);
}

/** Liste des équipes (id, nom, abbr, logo) — depuis le scoreboard saison. */
async function getTeams(league) {
  _assertLeague(league);
  const file = `${league}_teams.json`;
  const cached = _loadJson(file, TTL.standings);
  if (cached) return cached;
  const season = await getSeasonMatches(league);
  const map = new Map();
  for (const m of [...season.matches].slice(0, 120)) {
    for (const side of ['home', 'away']) {
      const t = m[side];
      if (t && t.id && !map.has(t.id)) map.set(t.id, { id: t.id, name: t.name, abbr: t.abbr, logo: t.logo });
    }
  }
  // Fallback logo ESPN CDN si absent
  const teams = [...map.values()].map((t) => ({
    ...t,
    logo: t.logo || `https://a.espncdn.com/i/teamlogos/basketball/${league}/500/${t.id}.png`,
  }));
  if (teams.length) _saveJson(file, teams);
  return teams;
}

/** Classement { rank, team, wins, losses, winPct, logo }. */
async function getStandings(league) {
  _assertLeague(league);
  const file = `${league}_standings.json`;
  const cached = _loadJson(file, TTL.standings);
  if (cached) return cached;
  const cfg = LEAGUES[league];
  const d = await _espnGet(`/apis/v2/sports/${cfg.sportPath}/standings`).catch(() => null);
  const rows = [];
  if (d && Array.isArray(d.children)) {
    for (const ch of d.children) {
      const entries = (ch.standings && ch.standings.entries) || [];
      for (const e of entries) {
        const stat = (name) => {
          const s = (e.stats || []).find((x) => x.name === name);
          return s ? s.value : null;
        };
        if (!e.team || !e.team.id) continue;
        rows.push({
          rank: stat('playoffSeed') || stat('rank') || rows.length + 1,
          team: { id: String(e.team.id), name: e.team.displayName || '?', abbr: e.team.abbreviation || '', logo: _teamLogo(e.team) },
          wins: stat('wins') || 0,
          losses: stat('losses') || 0,
          winPct: _roundPct(100 * (stat('winPercent') || 0)),
        });
      }
    }
  }
  rows.sort((a, b) => (b.winPct || 0) - (a.winPct || 0));
  if (rows.length) _saveJson(file, rows);
  return rows;
}

/** Roster d'une équipe (cache 12h) — path site/v2 (format `athletes`, grouped par poste possible). */
async function _getRoster(league, teamId) {
  const file = `${league}_roster_${teamId}.json`;
  const cached = _loadJson(file, TTL.roster);
  if (cached) return cached;
  const cfg = LEAGUES[league];
  const d = await _espnGet(`/apis/site/v2/sports/${cfg.sportPath}/teams/${teamId}/roster`).catch(() => null);
  let ath = (d && Array.isArray(d.athletes)) ? d.athletes : [];
  if (ath.length && ath[0] && Array.isArray(ath[0].items)) ath = ath.flatMap((g) => g.items || []);
  const players = ath.map((a) => ({
    id: String(a.id),
    name: a.displayName || a.fullName || '?',
    pos: (a.position && a.position.abbreviation) || '',
    jersey: a.jersey || '',
    photo: (a.headshot && a.headshot.href) || null,
    slug: a.slug || (a.displayName || '').toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '-'),
  })).filter((p) => p.id);
  if (players.length) _saveJson(file, players);
  return players;
}

/**
 * Stats saison d'un joueur depuis le gamelog ESPN (source validée exacte vs rapport :
 * Gray PPG 19.24 ✓, FGM 6.50 ✓ — la page athletes/stats retourne des moyennes carrière).
 * Limites gamelog : pas d'off/def rebounds ni de plusMinus (non fournis par ESPN) → null.
 */
async function _getAthleteSeasonStats(league, athleteId) {
  const file = `${league}_gamelog_${athleteId}.json`;
  const cached = _loadJson(file, TTL.athlete);
  if (cached) return cached;
  const cfg = LEAGUES[league];
  const d = await _httpsGet(WEB_HOST, `/apis/common/v3/sports/${cfg.sportPath}/athletes/${athleteId}/gamelog`).catch(() => null);
  if (!d || !Array.isArray(d.names) || !Array.isArray(d.seasonTypes)) return null;
  const names = d.names;
  const idx = (k) => names.indexOf(k);
  // stats combinées "X-Y" (ex. fieldGoalsMade-fieldGoalsAttempted = "7-15")
  const splitVal = (raw) => {
    const m = String(raw || '').split('-');
    return [parseFloat(m[0]) || 0, parseFloat(m[1]) || 0];
  };
  const games = [];
  for (const st of d.seasonTypes) {
    if (!/Regular/i.test(st.displayName || st.name || '')) continue; // exclut preseason
    for (const cat of st.categories || []) {
      for (const ev of cat.events || []) games.push(ev.stats || []);
    }
  }
  if (!games.length) return null;
  const n = games.length;
  const sumFloat = (i) => games.reduce((a, s) => a + (parseFloat(s[i]) || 0), 0);
  const iPts = idx('points'), iReb = idx('totalRebounds'), iAst = idx('assists'),
        iStl = idx('steals'), iBlk = idx('blocks'), iMin = idx('minutes'),
        iFg = idx('fieldGoalsMade-fieldGoalsAttempted'),
        iFg3 = idx('threePointFieldGoalsMade-threePointFieldGoalsAttempted'),
        iFgPct = idx('fieldGoalPct');
  let fgM = 0, fgA = 0, tpm = 0, tpa = 0;
  for (const s of games) {
    const [m1, a1] = splitVal(s[iFg]); fgM += m1; fgA += a1;
    const [m2, a2] = splitVal(s[iFg3]); tpm += m2; tpa += a2;
  }
  const res = {
    gp: n,
    min: _round1(sumFloat(iMin) / n),
    ppg: _round2(sumFloat(iPts) / n),
    rebounds: _round1(sumFloat(iReb) / n),
    offReb: null, defReb: null, plusMinus: null, // non fournis par le gamelog ESPN
    assists: _round2(sumFloat(iAst) / n),
    steals: _round1(sumFloat(iStl) / n),
    blocks: _round1(sumFloat(iBlk) / n),
    threesMade: _round2(tpm / n),
    fgm: _round1(fgM / n),
    fgmTotal: fgM,
    fgPct: fgA ? _roundPct((100 * fgM) / fgA) : null,
  };
  _saveJson(file, res);
  return res;
}

/** Stats joueurs d'une équipe (roster + gamelogs, avec enrichissement progressif).
 * Le gamelog par joueur peut être lent (rate-limit ESPN) → réponse immédiate avec les
 * stats déjà en cache, les manquantes se complètent en tâche de fond (appels suivants). */
async function getPlayerSeasonStats(league, teamId) {
  _assertLeague(league);
  const roster = await _getRoster(league, teamId);
  const fromCache = (p) => _loadJson(`${league}_gamelog_${p.id}.json`, TTL.athlete);
  const players = roster.map((p) => _buildPlayerRow(p, fromCache(p)));
  // enrichissement en fond des joueurs sans stats en cache (batch de 4)
  const missing = roster.filter((p) => !fromCache(p)).map((p) => p.id);
  if (missing.length) {
    _mapLimit(missing, 4, (id) => _getAthleteSeasonStats(league, id).catch(() => null)).catch(() => {});
  }
  players.sort((x, y) => (y.ppg || 0) - (x.ppg || 0));
  return players;
}

function _buildPlayerRow(p, s) {
  return {
    id: p.id, name: p.name, pos: p.pos, jersey: p.jersey, photo: p.photo, slug: p.slug,
    gp: s ? s.gp : null,
    ppg: s ? s.ppg : null,
    threesMade: s ? s.threesMade : null,
    rebounds: s ? s.rebounds : null, offReb: s ? s.offReb : null, defReb: s ? s.defReb : null,
    fgm: s ? s.fgm : null,
    gpFgm: s && s.fgm != null && s.gp ? `${s.fgm} (${s.gp})` : null, // format rapport "x.x (total/matchs)"
    fgPct: s ? s.fgPct : null,
    assists: s ? s.assists : null,
    blocks: s ? s.blocks : null,
    steals: s ? s.steals : null,
    plusMinus: s ? s.plusMinus : null,
    minutes: s ? s.min : null,
  };
}

// ── Assemblage H2H complet ──────────────────────────────────────────────────

async function getH2H(league, teamAId, teamBId, opts) {
  _assertLeague(league);
  if (!teamAId || !teamBId || teamAId === teamBId) throw new Error('teamA et teamB requis et distincts');
  const before = opts && opts.before; // date ISO : tronque historique + saison (reproductibilité snapshots)
  const beforeMs = before ? Date.parse(before) : null;
  const [history, season] = await Promise.all([getPairHistory(league, teamAId, teamBId), getSeasonMatches(league)]);
  const cut = (list) => (beforeMs != null && Number.isFinite(beforeMs)
    ? list.filter((m) => { const t = Date.parse(m.date); return Number.isFinite(t) ? t < beforeMs : true; })
    : list);
  const h2h = cut(history);
  const seasonMatches = cut(season.matches);

  // Summaries H2H (FG%/3P%/AST/REB) — lazy, 1er appel → pending, enrichment en fond
  const summaries = {};
  let enriched = 0;
  for (const m of h2h) {
    const s = _loadJson(`${league}_ev_${m.id}.json`, TTL.event);
    if (s) { summaries[m.id] = s; enriched++; }
  }
  const enrichment = enriched >= h2h.length ? 'ok' : (enriched > 0 ? 'partial' : 'pending');
  if (enrichment !== 'ok') _enrichInBackground(league, h2h);

  const split = computeSplit(h2h, teamAId, teamBId);
  const dataPoints = computeDataPoints(h2h, teamAId, teamBId, summaries);
  dataPoints.wins = { a: split.aWins, b: split.bWins };

  const seasonOf = (tid) => seasonMatches.filter((m) => m.home.id === tid || m.away.id === tid);
  // form6/results5 temps réel = saison complète (le site inclut le match analysé)
  const seasonOfFull = (tid) => season.matches.filter((m) => m.home.id === tid || m.away.id === tid);
  const sa = seasonOf(teamAId), sb = seasonOf(teamBId);
  // marque les listes pour computeBTTSStats
  sa._teamId = teamAId; sb._teamId = teamBId;

  const teams = await getTeams(league);
  const infoA = teams.find((t) => t.id === teamAId) || { id: teamAId, name: teamAId };
  const infoB = teams.find((t) => t.id === teamBId) || { id: teamBId, name: teamBId };

  const bttsScope = (sc) => computeBTTSStats(sa, sb, sc, teamAId, teamBId);

  return {
    league,
    scope: `H2H ${HISTORY_FIRST_SEASON}→${season.season} · stats saison ${season.season}`,
    teamA: {
      info: infoA,
      seasonStats: computeTeamSeasonStats(sa, teamAId, seasonOfFull(teamAId)),
      overStats: computeTeamOverStats(sa, teamAId),
      spreadStats: computeTeamSpreadStats(sa, teamAId),
    },
    teamB: {
      info: infoB,
      seasonStats: computeTeamSeasonStats(sb, teamBId, seasonOfFull(teamBId)),
      overStats: computeTeamOverStats(sb, teamBId),
      spreadStats: computeTeamSpreadStats(sb, teamBId),
    },
    split,
    dataPoints,
    enrichment, // ok | partial | pending (FG%/3P%/AST/REB H2H via summaries ESPN)
    matches: h2h.map((m) => ({
      id: m.id, date: m.date,
      season: m.date.slice(0, 4), // affiné côté UI par séparateur
      league: league.toUpperCase(),
      home: { id: m.home.id, name: m.home.name, abbr: m.home.abbr, logo: m.home.logo },
      away: { id: m.away.id, name: m.away.name, abbr: m.away.abbr, logo: m.away.logo },
      homeScore: m.homeScore, awayScore: m.awayScore,
      winnerId: m.homeScore > m.awayScore ? m.home.id : m.away.id,
    })),
    matchOver: computeMatchOverStats(sa, sb),
    btts: {
      ft: bttsScope('ft'), h1: bttsScope('1h'), h2: bttsScope('2h'),
      q1: bttsScope('1q'), q2: bttsScope('2q'), q3: bttsScope('3q'), q4: bttsScope('4q'),
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // API publiques
  getH2H, getTeams, getStandings, getPlayerSeasonStats,
  getSeasonMatches, getHistoryMatches, getPairHistory,
  // calculs purs (tests / validation)
  computeSplit, computeDataPoints, computeTeamSeasonStats,
  computeTeamOverStats, computeTeamSpreadStats, computeMatchOverStats,
  computeBTTSStats, computeOverDistribution, THRESHOLDS,
  _fetchTeamSchedule, _espnGet,
  currentSeason: (l) => LEAGUES[l].currentSeason(),
  invalidateCache() { _mem.clear(); },
};
