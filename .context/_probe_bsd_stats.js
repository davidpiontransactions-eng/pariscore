// Probe BSD REST — structure live_stats dans /events/ list + tennis serve stats
// Usage: node .context/_probe_bsd_stats.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const ENV = {};
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^=#]+)=(.*)$/);
  if (m) ENV[m[1].trim()] = m[2].trim();
});
const KEY = ENV.BSD_API_KEY;
const BASE = 'https://sports.bzzoiro.com/api';

function get(endpoint) {
  return new Promise((resolve, reject) => {
    https.get(`${BASE}${endpoint}`, {
      headers: { 'Authorization': `Token ${KEY}`, 'Accept': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data.slice(0, 300) }); }
      });
    }).on('error', reject);
  });
}

(async () => {
  // 1. Football events list — live_stats structure ?
  const ev = await get('/events/?league=1&status=finished&date_from=2026-05-20&date_to=2026-05-25');
  const results = ev.json?.data?.results ?? ev.json?.results ?? [];
  console.log('=== FOOT /events/ list ===');
  console.log('status:', ev.status, '| count:', results.length);
  if (results[0]) {
    const e0 = results[0];
    console.log('event keys:', Object.keys(e0).join(','));
    if (e0.live_stats) {
      console.log('live_stats keys:', Object.keys(e0.live_stats).join(','));
      if (e0.live_stats.home) console.log('live_stats.home keys:', Object.keys(e0.live_stats.home).join(','));
      console.log('home xg?', JSON.stringify(e0.live_stats.home?.expected_goals), '| xg obj?', JSON.stringify(e0.live_stats.home?.xg));
    } else {
      console.log('NO live_stats in list payload');
    }
  }

  // 2. Standings historique — season param respecté en REST ?
  const st = await get('/leagues/1/standings/?season=336');
  const stRows = st.json?.data?.standings ?? st.json?.standings ?? st.json?.data?.results ?? st.json?.results ?? [];
  console.log('\n=== FOOT /standings/?season=336 (24/25) ===');
  console.log('status:', st.status, '| rows:', Array.isArray(stRows) ? stRows.length : typeof stRows);
  const r0 = Array.isArray(stRows) ? stRows[0] : null;
  if (r0) console.log('row0:', JSON.stringify(r0).slice(0, 400));

  // 3. Tennis finished match — serve stats fields ?
  const tn = await get('/tennis/api/v2/matches/?status=finished&limit=3');
  let tnResults = tn.json?.data?.results ?? tn.json?.results ?? [];
  console.log('\n=== TENNIS /matches/?status=finished ===');
  console.log('status:', tn.status, '| count:', tnResults.length);
  if (tn.status !== 200 || !tnResults.length) {
    const tn2 = await get('/tennis/api/v2/matches/live/');
    console.log('fallback live status:', tn2.status);
    tnResults = tn2.json?.data?.results ?? tn2.json?.results ?? [];
  }
  if (tnResults[0]) {
    const tid = tnResults[0].id;
    console.log('tennis match id:', tid, '| keys:', Object.keys(tnResults[0]).join(','));
    const td = await get(`/tennis/api/v2/matches/${tid}/`);
    const d = td.json?.data ?? td.json ?? {};
    console.log('detail status:', td.status, '| detail keys:', Object.keys(d).join(','));
    for (const k of ['aces_per_set', 'double_faults_per_set', 'sets_detail', 'statistics', 'serve_stats', 'player1_stats']) {
      if (d[k] !== undefined) console.log(`  ${k}:`, JSON.stringify(d[k]).slice(0, 250));
    }
  }
})().catch(e => { console.error('PROBE FAIL:', e.message); process.exit(1); });
