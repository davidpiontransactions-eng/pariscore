// Vérif tous les endpoints API Football en prod + BSD live/prematch.
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv(path.join(__dirname, '..', '.env'));
const KEY = env.BSD_API_KEY || '';
const BASE = 'https://sports.bzzoiro.com/api';

async function checkProd(path, label) {
  const t0 = Date.now();
  const res = await fetch(`https://pariscore.fr${path}`, { signal: AbortSignal.timeout(60000) });
  const ms = Date.now() - t0;
  const body = await res.text().catch(() => '');
  console.log(`PROD ${label}: HTTP ${res.status} (${ms}ms) | ${body.length} chars | ${body.slice(0, 100).replace(/\n/g, ' ')}`);
  return body;
}

async function bsd(path, label) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Token ${KEY}` },
    signal: AbortSignal.timeout(30000),
  });
  const body = await res.text().catch(() => '');
  console.log(`BSD  ${label}: HTTP ${res.status} | ${body.length} chars`);
  if (!res.ok) { console.log(`     ERR: ${body.slice(0, 150)}`); return null; }
  try {
    const j = JSON.parse(body);
    const arr = j.results || j.matches || [];
    console.log(`     count=${j.count ?? arr.length} résultats=${arr.length}`);
    return arr;
  } catch { console.log(`     body: ${body.slice(0, 150)}`); return null; }
}

(async () => {
  console.log('===== ENDPOINTS PROD =====');
  await checkProd('/api/football/live', '/api/football/live');
  await checkProd('/api/football/prematch', '/api/football/prematch');
  await checkProd('/api/football/rankings?leagueId=epl&side=home', '/api/football/rankings?leagueId=epl');
  await checkProd('/api/football/rankings?leagueId=laliga&side=home', '/api/football/rankings?leagueId=laliga');
  await checkProd('/api/football/matches/bsd-3/stats', '/api/football/matches/bsd-3/stats');

  console.log();
  console.log('===== BSD DIRECT (données brutes) =====');
  const live = await bsd('/live/?limit=10', '/live/');
  if (live) {
    const leagues = [...new Set(live.map(m => `${m.league?.id} ${m.league?.name}`))];
    console.log(`     ligues live: ${leagues.join(' | ')}`);
  }
  const prem = await bsd('/matches/?status=notstarted&limit=10&league_id=3', '/matches/ league_id=3');
  if (prem) {
    const leagues = [...new Set(prem.map(m => `${m.league?.id} ${m.league?.name}`))];
    console.log(`     ligues (param league_id=3): ${leagues.join(' | ')}`);
  }
})().catch(e => console.log('ERR', e.message));