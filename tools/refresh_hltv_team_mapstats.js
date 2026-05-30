'use strict';
/**
 * refresh_hltv_team_mapstats.js — Map winrates from HLTV via gigobyte/HLTV npm
 * Output : data/hltv_team_mapstats.json
 *
 * Install : npm install hltv
 * Run     : node tools/refresh_hltv_team_mapstats.js
 * Cron    : 0 5 * * 0 cd /home/ubuntu/pariscore && node tools/refresh_hltv_team_mapstats.js
 *
 * HLTV API (gigobyte/HLTV) correct usage:
 *   const { HLTV } = require('hltv');
 *   HLTV.getTeamByName({ name }) → { id, name, ... }
 *   HLTV.getTeamStats({ teamId }) → { mapStats: [{ name, winRate, ... }] }
 *
 * Cloudflare note: HLTV blocks datacenter IPs. If all teams return CF errors,
 * use a residential proxy (BrightData/SmartProxy) or run from home machine.
 */

const fs   = require('fs');
const path = require('path');

const OUTPUT_FILE   = path.join(__dirname, '..', 'data', 'hltv_team_mapstats.json');
const RANKINGS_FILE = path.join(__dirname, '..', 'data', 'hltv_rankings.json');
const DELAY_MS      = 8000;   // 8s between requests — Cloudflare mitigation
const MAX_TEAMS     = 30;

const ACTIVE_MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadTeamNames() {
  try {
    const raw = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf8'));
    return (raw.teams || []).slice(0, MAX_TEAMS).map(t => t.name);
  } catch (e) {
    console.error('[MapStats] Cannot read rankings file:', e.message);
    process.exit(1);
  }
}

async function fetchTeamMapStats(HLTV, teamName) {
  // Step 1: resolve team ID by name (2 HTTP requests internally)
  let team;
  try {
    team = await HLTV.getTeamByName({ name: teamName });
  } catch (e) {
    console.warn(`  [${teamName}] getTeamByName failed: ${e.message}`);
    return null;
  }
  if (!team || !team.id) return null;
  console.log(`  [${teamName}] id=${team.id}, fetching stats...`);
  await sleep(DELAY_MS);

  // Step 2: fetch team stats (map winrates)
  let stats;
  try {
    stats = await HLTV.getTeamStats({ teamId: team.id });
  } catch (e) {
    console.warn(`  [${teamName}] getTeamStats failed: ${e.message}`);
    return { name: teamName, hltv_id: team.id, maps: {} };
  }

  // Step 3: extract per-map winrates
  const maps = {};
  const rawMaps = stats.mapStats || stats.maps || [];
  for (const ms of rawMaps) {
    // name is 'de_mirage', 'de_inferno', etc.
    const raw = (ms.name || ms.mapName || '').replace('de_', '');
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (!ACTIVE_MAPS.some(m => m.toLowerCase() === raw.toLowerCase())) continue;
    // winRate is 0-1 float or already a percentage
    const wr = ms.winRate != null ? ms.winRate : (ms.wins != null && ms.played != null ? ms.wins / ms.played : null);
    if (wr == null) continue;
    maps[label] = wr <= 1 ? Math.round(wr * 100) : Math.round(wr);
  }
  return { name: teamName, hltv_id: team.id, maps };
}

async function main() {
  let HLTV;
  try {
    const mod = require('hltv');
    HLTV = mod.HLTV || mod.default || mod;
    if (typeof HLTV.getTeamByName !== 'function') {
      // Try named export pattern
      if (mod.HLTV && typeof mod.HLTV.getTeamByName === 'function') HLTV = mod.HLTV;
      else throw new Error('HLTV.getTeamByName not found — check package version');
    }
  } catch (e) {
    console.error('[MapStats] hltv package error:', e.message);
    console.error('Run: npm install hltv');
    process.exit(1);
  }

  const teamNames = loadTeamNames();
  console.log(`[MapStats] Fetching HLTV map stats for ${teamNames.length} teams (${DELAY_MS/1000}s delay each)`);
  console.log(`[MapStats] Estimated: ${Math.ceil(teamNames.length * DELAY_MS * 2 / 60000)} min`);
  console.log('[MapStats] Note: HLTV may block VPS datacenter IPs (Cloudflare)');

  const teams = [];
  let cfBlocked = 0;

  for (let i = 0; i < teamNames.length; i++) {
    const name = teamNames[i];
    process.stdout.write(`[${i + 1}/${teamNames.length}] ${name}... `);
    const result = await fetchTeamMapStats(HLTV, name);
    if (result) {
      teams.push(result);
      const mapCount = Object.keys(result.maps).length;
      console.log(`✓ ${mapCount} maps: ${JSON.stringify(result.maps)}`);
    } else {
      cfBlocked++;
      console.log('✗ skipped');
    }
    if (i < teamNames.length - 1) await sleep(DELAY_MS);
  }

  if (cfBlocked === teamNames.length) {
    console.error('\n[MapStats] All requests failed — Cloudflare blocking VPS IP.');
    console.error('Solution: run this script from a residential IP (home machine or proxy).');
    console.error('The existing data/hltv_rankings.json static file is still used as fallback.');
    process.exit(1);
  }

  const output = {
    generated : new Date().toISOString().slice(0, 10),
    source    : 'HLTV.org via gigobyte/hltv — run weekly',
    n_teams   : teams.length,
    maps      : ACTIVE_MAPS,
    teams
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\n[MapStats] ✓ ${teams.length} teams written to ${OUTPUT_FILE}`);
}

main().catch(e => { console.error('[MapStats] Fatal:', e.message); process.exit(1); });
