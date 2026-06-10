// Probe BSD — root cause corners England vides (England vs Costa Rica)
// Réplique exactement les appels de fetchBSDTeamCornerHistory (server.js:14980)
// Usage: node .context/_probe_corners_england.js
const fs = require('fs');
const path = require('path');

// Load .env (BSD_API_KEY)
const envPath = path.join(__dirname, '..', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = env.BSD_API_KEY || process.env.BSD_API_KEY;
const BASE = (env.BSD_BASE_URL || 'https://sports.bzzoiro.com/api').replace(/\/$/, '');
if (!KEY) { console.error('NO BSD_API_KEY in .env'); process.exit(1); }

async function bsd(endpoint) {
  const url = `${BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}tz=Europe/Paris`;
  const res = await fetch(url, { headers: { Authorization: `Token ${KEY}` } });
  const status = res.status;
  let data = null;
  try { data = await res.json(); } catch (e) { /* ignore */ }
  return { status, data };
}

const FROM = '2026-05-12', TO = '2026-06-11';

(async () => {
  // ── 1. Trouver la fixture England vs Costa Rica (WC 27 + friendlies 31)
  for (const L of [27, 31]) {
    const r = await bsd(`/events/?date_from=2026-06-10&date_to=2026-06-25&league=${L}&page_size=100`);
    const results = r.data?.results || [];
    console.log(`\n[FIXTURE] league=${L} status=${r.status} count=${r.data?.count} page_len=${results.length}`);
    for (const e of results) {
      const s = `${e.home_team} vs ${e.away_team}`;
      if (/england|costa rica/i.test(s)) console.log(`  ${e.id} ${String(e.event_date || e.date).slice(0, 16)} ${s} [${e.status}]`);
    }
  }

  // ── 2. Réplique EXACTE de l'appel server (pas de page_size, pas de pagination)
  for (const L of [27, 31]) {
    const r = await bsd(`/events/?date_from=${FROM}&date_to=${TO}&league=${L}&status=finished`);
    const results = r.data?.results || [];
    const hits = results.filter(e =>
      (e.home_team || '').toLowerCase().includes('england') || (e.away_team || '').toLowerCase().includes('england') ||
      (e.home_team || '').toLowerCase().includes('costa rica') || (e.away_team || '').toLowerCase().includes('costa rica'));
    const withStats = results.filter(e => e.live_stats).length;
    console.log(`\n[SERVER-CALL] league=${L} finished 30j: status=${r.status} count=${r.data?.count} page_len=${results.length} with_live_stats=${withStats}`);
    console.log(`  dates page1: ${results.length ? String(results[0].event_date || results[0].date).slice(0, 10) + ' .. ' + String(results[results.length - 1].event_date || results[results.length - 1].date).slice(0, 10) : '—'}`);
    for (const e of hits) console.log(`  HIT page1: ${e.id} ${e.home_team} vs ${e.away_team}`);
  }

  // ── 3. Pagination complète league 31 — où sont England + Costa Rica ?
  const found = [];
  for (let page = 1; page <= 10; page++) {
    const r = await bsd(`/events/?date_from=${FROM}&date_to=${TO}&league=31&status=finished&page_size=50&page=${page}`);
    if (r.status !== 200 || !r.data?.results?.length) break;
    for (const e of r.data.results) {
      const ht = (e.home_team || '').toLowerCase(), at = (e.away_team || '').toLowerCase();
      if (ht.includes('england') || at.includes('england') || ht.includes('costa rica') || at.includes('costa rica')) {
        const hc = e.live_stats?.home?.corner_kicks, ac = e.live_stats?.away?.corner_kicks;
        found.push(`page${page}: ${e.id} ${String(e.event_date || e.date).slice(0, 10)} ${e.home_team} vs ${e.away_team} corners=${hc}-${ac} live_stats=${!!e.live_stats}`);
      }
    }
    if (!r.data.next) { console.log(`\n[PAGINATION L31] dernière page=${page}`); break; }
  }
  console.log(`\n[PAGINATION L31] matchs England/Costa Rica trouvés (fenêtre 30j):`);
  console.log(found.length ? found.join('\n') : '  AUCUN');

  // ── 4. live_stats dispo sur un event detail ? (échantillon friendly récent)
  const sample = await bsd(`/events/?date_from=${FROM}&date_to=${TO}&league=31&status=finished&page_size=3`);
  const first = sample.data?.results?.[0];
  if (first) {
    console.log(`\n[LIST-SHAPE] sample event ${first.id} keys: ${Object.keys(first).join(',').slice(0, 300)}`);
    const det = await bsd(`/events/${first.id}/`);
    const ls = det.data?.live_stats;
    console.log(`[DETAIL-SHAPE] /events/${first.id}/ status=${det.status} live_stats=${!!ls} corner_kicks home=${ls?.home?.corner_kicks} away=${ls?.away?.corner_kicks}`);
  }
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });
