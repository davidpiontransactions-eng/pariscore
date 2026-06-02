'use strict';
/**
 * refresh_hltv_mapstats_multiwindow.js
 * ─────────────────────────────────────
 * Fetches HLTV map winrates for top-30 teams across 3 time windows:
 *   3m  → data/hltv_mapstats_3m.json
 *   6m  → data/hltv_mapstats_6m.json
 *   1y  → data/hltv_mapstats_1y.json
 *
 * Each file includes per-map rankings (top-30 sorted by winrate).
 * One HLTV ID lookup per team (shared), 3 getTeamStats calls per team.
 *
 * Install : npm install hltv
 * Run     : node tools/refresh_hltv_mapstats_multiwindow.js
 * Cron    : 0 4 * * 0  (weekly, from residential IP — HLTV blocks VPS)
 * Runtime : ~15 min for top-30 with 5s/8s delays
 *
 * Cloudflare note: Run from residential IP. If all fail → CF blocking.
 *   BrightData proxy: set env HLTV_PROXY=http://user:pass@host:port
 */

const fs   = require('fs');
const path = require('path');

const RANKINGS_FILE = path.join(__dirname, '..', 'data', 'hltv_rankings.json');
const OUT_3M  = path.join(__dirname, '..', 'data', 'hltv_mapstats_3m.json');
const OUT_6M  = path.join(__dirname, '..', 'data', 'hltv_mapstats_6m.json');
const OUT_1Y  = path.join(__dirname, '..', 'data', 'hltv_mapstats_1y.json');

const DELAY_ID_MS   = 8000;  // between team ID lookups
const DELAY_STAT_MS = 5000;  // between getTeamStats calls (same session, lower risk)
const MAX_TEAMS     = 30;

const ACTIVE_MAPS   = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2'];

const WINDOWS = [
  { key: '3m',  days: 90,  outFile: OUT_3M  },
  { key: '6m',  days: 180, outFile: OUT_6M  },
  { key: '1y',  days: 365, outFile: OUT_1Y  },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function loadTeamNames() {
  try {
    const raw = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf8'));
    return (raw.teams || []).slice(0, MAX_TEAMS).map(t => t.name);
  } catch (e) {
    console.error('[MultiWindow] Cannot read rankings file:', e.message);
    process.exit(1);
  }
}

function extractMapStats(stats) {
  const maps = {};
  const rawMaps = stats.mapStats || stats.maps || [];
  for (const ms of rawMaps) {
    const rawName = (ms.name || ms.mapName || '').replace('de_', '');
    const label   = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    if (!ACTIVE_MAPS.some(m => m.toLowerCase() === rawName.toLowerCase())) continue;
    const wr = ms.winRate != null ? ms.winRate
             : (ms.wins != null && ms.played != null ? ms.wins / ms.played : null);
    if (wr == null) continue;
    maps[label] = wr <= 1 ? Math.round(wr * 100) : Math.round(wr);
  }
  return maps;
}

function buildMapRankings(teams) {
  const rankings = {};
  for (const map of ACTIVE_MAPS) {
    const entries = teams
      .filter(t => t.maps[map] != null)
      .map(t => ({ name: t.name, hltv_id: t.hltv_id, wr: t.maps[map] }))
      .sort((a, b) => b.wr - a.wr)
      .map((t, i) => ({ ...t, rank: i + 1 }));
    rankings[map] = entries;
  }
  return rankings;
}

function writeOutput(teams, window, mapRankings) {
  const payload = {
    generated    : new Date().toISOString().slice(0, 10),
    window       : window.key,
    window_days  : window.days,
    source       : 'HLTV.org via gigobyte/hltv — run weekly from residential IP',
    n_teams      : teams.length,
    maps         : ACTIVE_MAPS,
    teams,
    map_rankings : mapRankings,
  };
  fs.mkdirSync(path.dirname(window.outFile), { recursive: true });
  fs.writeFileSync(window.outFile, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`  [${window.key}] Written ${teams.length} teams → ${path.basename(window.outFile)}`);
}

async function main() {
  let HLTV;
  try {
    const mod = require('hltv');
    HLTV = mod.HLTV || mod.default || mod;
    if (typeof HLTV.getTeamByName !== 'function') {
      if (mod.HLTV && typeof mod.HLTV.getTeamByName === 'function') HLTV = mod.HLTV;
      else throw new Error('HLTV.getTeamByName not found — check package version');
    }
  } catch (e) {
    console.error('[MultiWindow] hltv package error:', e.message);
    console.error('Run: npm install hltv');
    process.exit(1);
  }

  const teamNames = loadTeamNames();
  console.log(`\n[MultiWindow] ${teamNames.length} teams × ${WINDOWS.length} windows`);
  console.log(`[MultiWindow] Estimated: ~${Math.ceil((teamNames.length * DELAY_ID_MS + teamNames.length * WINDOWS.length * DELAY_STAT_MS) / 60000)} min`);
  console.log('[MultiWindow] CF note: Run from residential IP (HLTV blocks VPS datacenter IPs)\n');

  // data[windowKey] = array of { name, hltv_id, maps: {} }
  const data = {};
  for (const w of WINDOWS) data[w.key] = [];

  let cfBlocked = 0;

  for (let i = 0; i < teamNames.length; i++) {
    const name = teamNames[i];
    process.stdout.write(`[${i + 1}/${teamNames.length}] ${name} — resolving ID...`);

    // Step 1: resolve team ID (once per team)
    let team;
    try {
      team = await HLTV.getTeamByName({ name });
    } catch (e) {
      console.log(` ID failed: ${e.message}`);
      cfBlocked++;
      if (i < teamNames.length - 1) await sleep(DELAY_ID_MS);
      continue;
    }
    if (!team?.id) {
      console.log(' ID not found, skipped');
      if (i < teamNames.length - 1) await sleep(DELAY_ID_MS);
      continue;
    }
    process.stdout.write(` id=${team.id}\n`);
    await sleep(DELAY_STAT_MS);

    // Step 2: fetch stats for each time window
    for (let wi = 0; wi < WINDOWS.length; wi++) {
      const w = WINDOWS[wi];
      process.stdout.write(`  [${w.key}] fetching...`);
      try {
        const stats = await HLTV.getTeamStats({
          teamId   : team.id,
          startDate: daysAgo(w.days),
          endDate  : new Date(),
        });
        const maps = extractMapStats(stats);
        const mapCount = Object.keys(maps).length;
        data[w.key].push({ name, hltv_id: team.id, maps });
        process.stdout.write(` ${mapCount} maps: ${JSON.stringify(maps)}\n`);
      } catch (e) {
        process.stdout.write(` FAILED: ${e.message}\n`);
        data[w.key].push({ name, hltv_id: team.id, maps: {} });
      }
      if (wi < WINDOWS.length - 1) await sleep(DELAY_STAT_MS);
    }

    if (i < teamNames.length - 1) await sleep(DELAY_ID_MS);
  }

  if (cfBlocked === teamNames.length) {
    console.error('\n[MultiWindow] All ID lookups failed — Cloudflare blocking VPS IP.');
    console.error('Solution: run from residential IP or add HLTV_PROXY env var.');
    process.exit(1);
  }

  // Write outputs + per-map rankings
  console.log('\n[MultiWindow] Writing output files...');
  for (const w of WINDOWS) {
    const teams = data[w.key].filter(t => Object.keys(t.maps).length > 0);
    const rankings = buildMapRankings(teams);
    writeOutput(teams, w, rankings);
  }

  console.log('\n[MultiWindow] Done. Deploy data/ to VPS and restart server.');
  console.log('  scp data/hltv_mapstats_*.json ubuntu@vps:/home/ubuntu/pariscore/data/');
}

main().catch(e => { console.error('[MultiWindow] Fatal:', e.message); process.exit(1); });
