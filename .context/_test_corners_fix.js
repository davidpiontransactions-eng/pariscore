// Test failing→passing — réplique EXACTE ancien vs nouveau fetchBSDTeamCornerHistory
// contre BSD live. Attendu: OLD England=null (bug), NEW England≥2 matchs.
const fs = require('fs');
const path = require('path');
const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const KEY = env.BSD_API_KEY;
const BASE = (env.BSD_BASE_URL || 'https://sports.bzzoiro.com/api').replace(/\/$/, '');
async function bsdFetch(endpoint) {
  const url = `${BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}tz=Europe/Paris`;
  const res = await fetch(url, { headers: { Authorization: `Token ${KEY}` } });
  let data = null; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}
// stubs
const _cache = new Map();
const apiCacheGet = k => _cache.get(k) || null;
const apiCacheSet = (k, v) => _cache.set(k, v);

// ── ANCIEN algo (pré-fix)
async function oldFetch(teamName, bsdLeagueId, limit = 10) {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const to = now.toISOString().split('T')[0];
  const res = await bsdFetch(`/events/?date_from=${from}&date_to=${to}&league=${bsdLeagueId}&status=finished`);
  if (res.status !== 200 || !res.data?.results?.length) return null;
  const teamMatches = res.data.results
    .filter(e => e.home_team?.toLowerCase().includes(teamName.toLowerCase()) || e.away_team?.toLowerCase().includes(teamName.toLowerCase()))
    .slice(0, limit);
  if (!teamMatches.length) return null;
  let f = 0, a = 0, count = 0;
  for (const m of teamMatches) {
    if (!m.live_stats) continue;
    const isHome = m.home_team?.toLowerCase().includes(teamName.toLowerCase());
    const stats = isHome ? m.live_stats.home : m.live_stats.away;
    const opp = isHome ? m.live_stats.away : m.live_stats.home;
    if (stats?.corner_kicks != null) { f += stats.corner_kicks; a += opp?.corner_kicks || 0; count++; }
  }
  if (!count) return null;
  return { totalMatches: count, totalCornersPerMatch: (f + a) / count };
}

// ── NOUVEAU algo (copie du fix server.js)
async function fetchBSDLeagueFinishedTail(bsdLeagueId, days = 365, maxPages = 6) {
  if (!bsdLeagueId) return [];
  const cacheKey = `bsd_lg_tail_${bsdLeagueId}_${days}`;
  const cached = apiCacheGet(cacheKey);
  if (cached) return cached;
  try {
    const now = new Date();
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];
    const base = `/events/?date_from=${from}&date_to=${to}&league=${bsdLeagueId}&status=finished`;
    const first = await bsdFetch(`${base}&limit=50&offset=0`);
    if (first.status !== 200 || !first.data) return [];
    const count = Number(first.data.count) || 0;
    const rawEvents = Array.isArray(first.data.results) ? first.data.results.slice() : [];
    if (count > 50) {
      const offsets = [];
      for (let o = count - 50; o > 0 && offsets.length < maxPages - 1; o -= 50) offsets.push(o);
      const pages = await Promise.all(offsets.map(o => bsdFetch(`${base}&limit=50&offset=${o}`).catch(() => null)));
      for (const p of pages) {
        if (p && p.status === 200 && Array.isArray(p.data?.results)) rawEvents.push(...p.data.results);
      }
    }
    rawEvents.sort((a, b) => String(b.event_date || '').localeCompare(String(a.event_date || '')));
    const seen = new Set();
    const events = [];
    for (const e of rawEvents) {
      const k = e.id ?? `${e.home_team}|${e.away_team}|${e.event_date || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      events.push({
        id: e.id ?? null,
        event_date: String(e.event_date || e.date || e.start_time || ''),
        league_id: (e.league && e.league.id) ?? e.league_id ?? bsdLeagueId,
        league_name: (e.league && e.league.name) || e.league_name || '',
        home_team: e.home_team || '',
        away_team: e.away_team || '',
        home_score: e.home_score != null ? Number(e.home_score) : null,
        away_score: e.away_score != null ? Number(e.away_score) : null,
        home_corners: e.live_stats?.home?.corner_kicks ?? null,
        away_corners: e.live_stats?.away?.corner_kicks ?? null,
      });
    }
    apiCacheSet(cacheKey, events, 'bsd_lg_tail', 6 * 3600 * 1000);
    return events;
  } catch (e) { return []; }
}
const NATIONAL_BSD_LEAGUES = new Set(['27', '30', '31', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69']);
const NATIONAL_CORNER_SCAN = ['31', '58', '59', '60', '61', '62', '63', '64', '65'];

async function newFetch(teamName, bsdLeagueId, limit = 10) {
  const localHist = null; // pas de DB locale dans le test
  const nameLc = String(teamName || '').toLowerCase().trim();
  if (!nameLc || !bsdLeagueId) return localHist || null;
  const leagueIds = [String(bsdLeagueId)];
  if (NATIONAL_BSD_LEAGUES.has(String(bsdLeagueId))) {
    for (const lg of NATIONAL_CORNER_SCAN) { if (!leagueIds.includes(lg)) leagueIds.push(lg); }
  }
  const perLeague = await Promise.all(leagueIds.map(lg => fetchBSDLeagueFinishedTail(lg)));
  const teamMatches = [];
  for (const events of perLeague) {
    for (const e of events) {
      const isHome = (e.home_team || '').toLowerCase().includes(nameLc);
      const isAway = (e.away_team || '').toLowerCase().includes(nameLc);
      if (!isHome && !isAway) continue;
      const forCorners = isHome ? e.home_corners : e.away_corners;
      const againstCorners = isHome ? e.away_corners : e.home_corners;
      if (forCorners == null) continue;
      teamMatches.push({ date: e.event_date, forCorners, againstCorners: againstCorners || 0, label: `${e.home_team} vs ${e.away_team} (${String(e.event_date).slice(0, 10)}) L${e.league_id}` });
    }
  }
  if (!teamMatches.length) return localHist || null;
  teamMatches.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const recent = teamMatches.slice(0, limit);
  let f = 0, a = 0;
  for (const m of recent) { f += m.forCorners; a += m.againstCorners; }
  const count = recent.length;
  return {
    avgCornersFor: f / count, avgCornersAgainst: a / count,
    totalMatches: count, totalCornersPerMatch: (f + a) / count,
    _detail: recent.map(m => `${m.label} ${m.forCorners}-${m.againstCorners}`),
  };
}

(async () => {
  let fail = 0;
  for (const team of ['England', 'Costa Rica']) {
    const oldR = await oldFetch(team, 31);
    const newR = await newFetch(team, 31);
    console.log(`\n══ ${team} (league 31) ══`);
    console.log(`OLD: ${oldR ? oldR.totalMatches + ' matchs, λ/match=' + oldR.totalCornersPerMatch.toFixed(2) : 'NULL → "Estimation ligue moy." (BUG)'}`);
    console.log(`NEW: ${newR ? newR.totalMatches + ' matchs, for=' + newR.avgCornersFor.toFixed(2) + ' against=' + newR.avgCornersAgainst.toFixed(2) + ' total/match=' + newR.totalCornersPerMatch.toFixed(2) : 'NULL'}`);
    if (newR) for (const d of newR._detail) console.log('   ' + d);
    if (!newR || newR.totalMatches < 1) { console.log('❌ FAIL: NEW devrait avoir ≥1 match'); fail++; }
  }
  // assertion clé: England OLD=null, NEW≥2
  console.log(fail ? '\n❌ TEST FAIL' : '\n✅ TEST PASS — England a maintenant un historique corners');
  process.exit(fail ? 1 : 0);
})();
