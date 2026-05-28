#!/usr/bin/env node
/**
 * test-bsd-standings-shapes.js
 * Valide que fetchBSDStandings parse correctement les 4 shapes BSD connues.
 * Usage : node tools/test-bsd-standings-shapes.js
 */

'use strict';

// ── Mock minimal des dépendances server.js ──────────────────────────────────
const LEAGUE_TEAM_DENYLIST = {};
function normName(s) {
  if (!s) return '';
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
function buildSideStats(s) {
  const played = +s?.played || 0;
  if (!played) return { ppg: 0, wins: 0, draws: 0, losses: 0, scored: 0, conceded: 0, avgScored: 0, avgConceded: 0, played: 0 };
  const w = s?.win || 0, d = s?.draw || 0, l = s?.lose || 0;
  const gf = s?.goals_for || 0, ga = s?.goals_against || 0;
  return { ppg: played ? (w * 3 + d) / played : 0, wins: w / played * 100, draws: d / played * 100, losses: l / played * 100,
           scored: gf, conceded: ga, avgScored: gf / played, avgConceded: ga / played, played };
}

// ── Mock bsdFetch — remplace la vraie fonction réseau ───────────────────────
let _mockShape = null;
async function bsdFetch(endpoint) {
  if (endpoint.includes('/seasons/')) return { status: 200, data: { results: [{ id: 999 }] } };
  if (endpoint.includes('/standings/')) return { status: 200, data: _mockShape };
  return { status: 404, data: null };
}

// ── Copie allégée de fetchBSDStandings (logique identique à server.js) ──────
async function fetchBSDStandings(bsdLeagueId, configLeagueId) {
  const standingsUrl = `/leagues/${bsdLeagueId}/standings/?season=999`;
  const standingsRes = await bsdFetch(standingsUrl);
  let rows = [];
  if (standingsRes?.status === 200 && standingsRes?.data) {
    if (Array.isArray(standingsRes.data.standings) && standingsRes.data.standings.length) {
      rows = standingsRes.data.standings;
    } else if (Array.isArray(standingsRes.data.results) && standingsRes.data.results.length) {
      rows = standingsRes.data.results;
    } else if (Array.isArray(standingsRes.data) && standingsRes.data.length) {
      rows = standingsRes.data;
    }
    // groups shape (Fix 1)
    if (!rows.length) {
      const grps = standingsRes.data?.groups;
      if (Array.isArray(grps) && grps.length) {
        for (const grp of grps) {
          const gName = grp.group_name || grp.name || null;
          const tag = (entry) => gName ? Object.assign({}, entry, { _group_name: gName }) : entry;
          if (Array.isArray(grp.standings) && grp.standings.length) rows.push(...grp.standings.map(tag));
          else if (Array.isArray(grp.results) && grp.results.length) rows.push(...grp.results.map(tag));
          else if (Array.isArray(grp) && grp.length) rows.push(...grp);
        }
      } else if (grps && typeof grps === 'object') {
        for (const [gName, grpRows] of Object.entries(grps)) {
          if (Array.isArray(grpRows)) rows.push(...grpRows.map(e => Object.assign({}, e, { _group_name: gName })));
        }
      }
    }
  }
  if (!rows.length) return null;

  const teams = {};
  const denylist = LEAGUE_TEAM_DENYLIST[configLeagueId] || null;
  const teamLabel = (e) => e.team_name || e.team?.name || e.team || e.name || '';
  rows.forEach(entry => {
    const teamName = teamLabel(entry);
    const key = normName(teamName);
    if (!key) return;
    if (denylist && denylist.has(key)) return;
    const played = entry.played || 0;
    const homeStats = buildSideStats({ played: Math.ceil(played / 2), win: Math.round((entry.won||0)/2), draw: Math.round((entry.drawn||0)/2), lose: Math.round((entry.lost||0)/2), goals_for: Math.round((entry.gf||0)/2), goals_against: Math.round((entry.ga||0)/2) });
    const awayStats = buildSideStats({ played: Math.floor(played / 2), win: Math.floor((entry.won||0)/2), draw: Math.floor((entry.drawn||0)/2), lose: Math.floor((entry.lost||0)/2), goals_for: Math.floor((entry.gf||0)/2), goals_against: Math.floor((entry.ga||0)/2) });
    teams[key] = {
      home: homeStats, away: awayStats,
      rank: entry.position || entry.rank || null,
      form: entry.form || '',
      _raw: { played, wins: entry.won||0, draws: entry.drawn||0, losses: entry.lost||0, gf: entry.gf||0, ga: entry.ga||0, pts: (entry.won||0)*3+(entry.drawn||0) },
      _real: true, _source: 'bsd',
      _group_name: entry._group_name || null,
    };
  });
  return Object.keys(teams).length ? teams : null;
}

// Validateur identique à server.js Fix 3
function validator(data) {
  return data && typeof data === 'object' && Object.keys(data).length > 0 &&
    Object.values(data).some(t => t && (t.home?.wins != null || t._raw?.wins != null));
}

// ── Fixtures de test ─────────────────────────────────────────────────────────
const TEAM_A = { team_name: 'Arsenal', played: 6, won: 4, drawn: 1, lost: 1, gf: 12, ga: 5, position: 1, form: 'WWWDW' };
const TEAM_B = { team_name: 'Real Madrid', played: 6, won: 3, drawn: 2, lost: 1, gf: 9, ga: 6, position: 2, form: 'WDWDW' };
const TEAM_C = { team_name: 'Bayern', played: 6, won: 5, drawn: 0, lost: 1, gf: 15, ga: 4, position: 1, form: 'WWWWW' };
const TEAM_D = { team_name: 'PSG', played: 6, won: 2, drawn: 1, lost: 3, gf: 7, ga: 10, position: 4, form: 'WLLLD' };

const SHAPES = [
  {
    name: 'Shape 1 — flat .standings[]',
    mock: { standings: [TEAM_A, TEAM_B] },
    expectedTeams: 2, expectedGroupNames: [null, null],
  },
  {
    name: 'Shape 2 — flat .results[]',
    mock: { results: [TEAM_A, TEAM_B] },
    expectedTeams: 2, expectedGroupNames: [null, null],
  },
  {
    name: 'Shape 3 — groups[] (UCL/Copa style)',
    mock: { groups: [
      { group_name: 'Group A', standings: [TEAM_A, TEAM_B] },
      { group_name: 'Group B', standings: [TEAM_C, TEAM_D] },
    ]},
    expectedTeams: 4,
    expectedGroupNames: ['Group A', 'Group A', 'Group B', 'Group B'],
  },
  {
    name: 'Shape 4 — groups{} (object map)',
    mock: { groups: { 'Group C': [TEAM_A, TEAM_B], 'Group D': [TEAM_C, TEAM_D] } },
    expectedTeams: 4,
    expectedGroupNames: ['Group C', 'Group C', 'Group D', 'Group D'],
  },
  {
    name: 'Shape 5 — empty response → null',
    mock: {},
    expectedTeams: 0,
  },
];

// ── Runner ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

async function run() {
  console.log('\n=== BSD Standings Shape Tests ===\n');
  for (const shape of SHAPES) {
    _mockShape = shape.mock;
    const result = await fetchBSDStandings(7, 2);
    const teamCount = result ? Object.keys(result).length : 0;

    if (shape.expectedTeams === 0) {
      if (result === null) {
        console.log(`  ✅ PASS  ${shape.name} → null (correct)`);
        passed++;
      } else {
        console.log(`  ❌ FAIL  ${shape.name} → expected null, got ${teamCount} teams`);
        failed++;
      }
      continue;
    }

    if (!result) {
      console.log(`  ❌ FAIL  ${shape.name} → null (expected ${shape.expectedTeams} teams)`);
      failed++;
      continue;
    }

    const validatorOk = validator(result);
    if (teamCount !== shape.expectedTeams) {
      console.log(`  ❌ FAIL  ${shape.name} → ${teamCount} teams (expected ${shape.expectedTeams})`);
      failed++;
      continue;
    }

    // Check group names preserved
    if (shape.expectedGroupNames) {
      const actualGroups = Object.values(result).map(t => t._group_name);
      const groupOk = shape.expectedGroupNames.every(g => actualGroups.includes(g));
      if (!groupOk) {
        console.log(`  ❌ FAIL  ${shape.name} → _group_name mismatch. got: ${[...new Set(actualGroups)].join(', ')}`);
        failed++;
        continue;
      }
    }

    if (!validatorOk) {
      console.log(`  ❌ FAIL  ${shape.name} → ${teamCount} teams OK but validator fails (home.wins/t._raw.wins absent)`);
      failed++;
      continue;
    }

    console.log(`  ✅ PASS  ${shape.name} → ${teamCount} teams, validator OK, groups: ${[...new Set(Object.values(result).map(t => t._group_name))].filter(Boolean).join('/') || 'n/a'}`);
    passed++;
  }

  console.log(`\n=== ${passed}/${passed + failed} tests passed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
