'use strict';
/**
 * refresh_hltv_team_mapstats.js — Fetch per-team map winrates from HLTV
 * via gigobyte/HLTV npm package. Run weekly (nightly cron).
 * Output: data/hltv_team_mapstats.json
 *
 * Install once:
 *   npm install hltv
 *
 * Run:
 *   node tools/refresh_hltv_team_mapstats.js
 *
 * Cron (weekly, Sunday 5am):
 *   0 5 * * 0 cd /home/ubuntu/pariscore && node tools/refresh_hltv_team_mapstats.js >> /tmp/hltv_mapstats.log 2>&1
 *
 * WARNING: HLTV has Cloudflare protection. This script:
 *   - Waits 30s between each team request (minRequestIntervalMs)
 *   - Caches results for 7 days
 *   - Runs at most once per week
 *   - Should NOT be called from the hot request path
 *
 * Map stat fields from gigobyte/HLTV getTeamStats():
 *   maps[].name, maps[].winRate (e.g. 0.72 = 72%)
 */

const fs   = require('fs');
const path = require('path');

const OUTPUT_FILE   = path.join(__dirname, '..', 'data', 'hltv_team_mapstats.json');
const RANKINGS_FILE = path.join(__dirname, '..', 'data', 'hltv_rankings.json');
const DELAY_MS      = 32000; // 32s between requests — conservative
const MAX_TEAMS     = 30;

const ACTIVE_MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Load team names from existing rankings file
function loadTeamNames() {
  try {
    const raw = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf8'));
    return (raw.teams || []).slice(0, MAX_TEAMS).map(t => t.name);
  } catch (e) {
    console.error('[MapStats] Cannot read rankings file:', e.message);
    process.exit(1);
  }
}

// HLTV team name → team ID lookup via search
async function getHltvTeamId(hltv, teamName) {
  try {
    const results = await hltv.searchTeamsByQuery({ query: teamName });
    if (results && results.length > 0) return results[0].id;
  } catch (e) {
    console.warn(`[MapStats] Search failed for "${teamName}":`, e.message);
  }
  return null;
}

// Fetch map stats for one team
async function fetchTeamMapStats(hltv, teamName) {
  const teamId = await getHltvTeamId(hltv, teamName);
  if (!teamId) return null;
  await sleep(DELAY_MS);

  try {
    const stats = await hltv.getTeamStats({ teamId });
    const maps = {};
    if (stats && Array.isArray(stats.mapStats)) {
      for (const ms of stats.mapStats) {
        const mapName = (ms.name || '').replace('de_', '');
        const mapLabel = mapName.charAt(0).toUpperCase() + mapName.slice(1);
        if (ACTIVE_MAPS.some(m => m.toLowerCase() === mapName.toLowerCase())) {
          // winRate is 0-1 float → convert to integer percentage
          maps[mapLabel] = ms.winRate != null ? Math.round(ms.winRate * 100) : null;
        }
      }
    }
    return { name: teamName, hltv_id: teamId, maps };
  } catch (e) {
    console.warn(`[MapStats] Stats failed for "${teamName}" (id=${teamId}):`, e.message);
    return { name: teamName, hltv_id: teamId, maps: {} };
  }
}

async function main() {
  let hltv;
  try {
    const hltvModule = require('hltv');
    hltv = hltvModule.HLTV || hltvModule.default || hltvModule;
    if (typeof hltv.createInstance === 'function') {
      hltv = hltv.createInstance({ minRequestIntervalMs: DELAY_MS });
    }
  } catch (e) {
    console.error('[MapStats] hltv package not found. Run: npm install hltv');
    process.exit(1);
  }

  const teamNames = loadTeamNames();
  console.log(`[MapStats] Fetching HLTV map stats for ${teamNames.length} teams...`);
  console.log(`[MapStats] Estimated time: ${Math.ceil(teamNames.length * DELAY_MS / 60000)} minutes`);

  const teams = [];
  for (let i = 0; i < teamNames.length; i++) {
    const name = teamNames[i];
    console.log(`[MapStats] [${i + 1}/${teamNames.length}] ${name}...`);
    const result = await fetchTeamMapStats(hltv, name);
    if (result) {
      teams.push(result);
      console.log(`  → ${JSON.stringify(result.maps)}`);
    }
    if (i < teamNames.length - 1) await sleep(DELAY_MS);
  }

  const output = {
    generated: new Date().toISOString().slice(0, 10),
    source   : 'HLTV.org via gigobyte/hltv npm — run weekly',
    n_teams  : teams.length,
    maps     : ACTIVE_MAPS,
    teams
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[MapStats] ✓ Written ${teams.length} teams to ${OUTPUT_FILE}`);
}

main().catch(e => { console.error('[MapStats] Fatal:', e.message); process.exit(1); });
