#!/usr/bin/env node
'use strict';
/**
 * scrape-hltv-flare.js — Scraper HLTV via FlareSolverr (VPS-friendly)
 * -------------------------------------------------------------------
 * Bypass Cloudflare via FlareSolverr (Docker, http://127.0.0.1:8191).
 * Parse directement le HTML HLTV — zéro dépendance npm.
 *
 * Source : hltv.org/stats/teams/{id}
 * Données : overview (maps, K/D, W/D/L) + per-map winrate (7 cartes)
 *
 * Sortie :
 *   data/hltv_team_stats.json   — stats détaillées par équipe
 *   data/hltv_map_pool.json     — winrate moyen par carte (top-30)
 *
 * Usage (VPS) :
 *   node tools/scrape-hltv-flare.js                  # top-30
 *   node tools/scrape-hltv-flare.js --limit=3        # smoke test
 *   node tools/scrape-hltv-flare.js --team=Vitality  # une équipe
 */

const fs   = require('fs');
const path = require('path');

const RANKINGS_FILE = path.join(__dirname, '..', 'data', 'hltv_rankings.json');
const OUT_TEAM_STATS = path.join(__dirname, '..', 'data', 'hltv_team_stats.json');
const OUT_MAP_POOL   = path.join(__dirname, '..', 'data', 'hltv_map_pool.json');

const FLARE_URL = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';
const MAX_TEAMS = 30;
const DELAY_MS  = 3000;
const HTTP_TIMEOUT = 45000;

const ACTIVE_MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── FlareSolverr fetch ───────────────────────────────────────────────────────

async function flareGet(url) {
  const res = await fetch(FLARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: HTTP_TIMEOUT }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT + 10000),
  });
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(`FlareSolverr: ${json.message || json.status}`);
  return json.solution?.response || '';
}

// ─── Parse HTML HLTV → structuré ──────────────────────────────────────────────

function parseTeamPage(html, teamName) {
  const result = { overview: null, mapStats: {} };

  // ── Overview stats ──
  // Pattern: <div class="large-strong">VALUE</div> dans le stats overview
  const overviewRegex = /class="large-strong"[^>]*>([\d,\.]+)/g;
  const nums = [];
  let m;
  while ((m = overviewRegex.exec(html)) !== null) {
    nums.push(parseFloat(m[1].replace(/,/g, '')));
  }
  // order: mapsPlayed, [W/D/L], totalKills, totalDeaths, roundsPlayed, kdRatio
  if (nums.length >= 6) {
    const wdlStr = html.match(/class="large-strong"[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
    result.overview = {
      mapsPlayed: nums[0],
      wins: wdlStr ? parseInt(wdlStr[1]) : null,
      draws: wdlStr ? parseInt(wdlStr[2]) : null,
      losses: wdlStr ? parseInt(wdlStr[3]) : null,
      totalKills: nums[2],
      totalDeaths: nums[3],
      roundsPlayed: nums[4],
      kdRatio: nums[5],
    };
  }

  // ── Per-map stats ──
  // Each map section: <div class="map-pool-map-name">de_X</div> followed by stats rows
  for (const map of ACTIVE_MAPS) {
    const deMap = `de_${map.toLowerCase()}`;
    // Find the map section
    const mapIdx = html.indexOf(deMap);
    if (mapIdx === -1) continue;

    // Extract stats rows after this map name
    const section = html.substring(mapIdx, mapIdx + 2000);

    // Pattern: wins / draws / losses
    const wdMatch = section.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
    // Pattern: XX.X% (winrate)
    const wrMatch = section.match(/([\d.]+)%/);
    // Pattern: total rounds (number with commas)
    const roundsMatch = section.match(/class="statsVal"[^>]*>([\d,]+)/);

    if (wdMatch && wrMatch) {
      result.mapStats[map] = {
        wins: parseInt(wdMatch[1]),
        draws: parseInt(wdMatch[2]),
        losses: parseInt(wdMatch[3]),
        winRate: parseFloat(wrMatch[1]),
        totalRounds: roundsMatch ? parseInt(roundsMatch[1].replace(/,/g, '')) : 0,
      };
    }
  }

  return result;
}

function parseTeamId(html) {
  // The team page URL contains the ID: /stats/teams/9565/vitality
  // Or extract from the page itself
  const idMatch = html.match(/\/stats\/teams\/(\d+)\//);
  return idMatch ? parseInt(idMatch[1]) : null;
}

function parseTeamSearch(html) {
  // Search results: <a href="/stats/teams/9565/vitality" class="results-sublist">
  const match = html.match(/\/stats\/teams\/(\d+)\/[^"]*"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/);
  if (match) return { id: parseInt(match[1]), name: match[2].trim() };
  // Fallback: just find the first team link
  const fallback = html.match(/\/stats\/teams\/(\d+)\/([^"]+)/);
  if (fallback) return { id: parseInt(fallback[1]), name: fallback[2].replace(/-/g, ' ') };
  return null;
}

// ─── Main scraping ────────────────────────────────────────────────────────────

function loadTeams() {
  try {
    const raw = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf8'));
    return (raw.teams || []).slice(0, MAX_TEAMS).map(t => ({
      name: t.name,
      rank: t.rank,
      points: t.points,
    }));
  } catch (e) {
    console.error('[HLTV] Cannot read rankings:', e.message);
    process.exit(1);
  }
}

async function resolveTeamId(teamName) {
  const slug = teamName.toLowerCase().replace(/\s+/g, '-');
  // Essayer l'URL directe d'abord (plus fiable)
  const directUrl = `https://www.hltv.org/stats/teams?team=&name=${encodeURIComponent(teamName)}`;
  console.log(`  Recherche ID pour "${teamName}"...`);
  const html = await flareGet(directUrl);

  // Chercher le lien vers la page de l'équipe avec le bon nom
  const nameLC = teamName.toLowerCase();
  // Pattern: <a href="/stats/teams/ID/slug" ...>TeamName</a>
  const teamLinkRegex = /\/stats\/teams\/(\d+)\/[^"]+"[^>]*>([^<]+)<\/a>/g;
  let match;
  while ((match = teamLinkRegex.exec(html)) !== null) {
    const linkText = match[2].trim().toLowerCase();
    if (linkText === nameLC || linkText.includes(nameLC)) {
      const id = parseInt(match[1]);
      console.log(`  → id=${id} (${match[2].trim()})`);
      return id;
    }
  }

  // Fallback: première équipe trouvée dans les résultats
  const fallback = html.match(/\/stats\/teams\/(\d+)\/[^"]+"[^>]*>([^<]+)/);
  if (fallback) {
    const id = parseInt(fallback[1]);
    console.log(`  → id=${id} (fallback: ${fallback[2].trim()})`);
    return id;
  }
  return null;
}

async function scrapeTeamStats(teamId, teamName) {
  const slug = teamName.toLowerCase().replace(/\s+/g, '-');
  // URL maps : page dédiée avec winrate par carte
  const url = `https://www.hltv.org/stats/teams/maps/${teamId}/${slug}`;
  console.log(`  Fetching maps: ${url}`);
  const html = await flareGet(url);

  const mapStats = {};
  // Pattern: <div class="map-pool-map-name">MapName - XX.X%</div>
  const mapRegex = /class="map-pool-map-name">(\w[\w\s]*)\s*-\s*([\d.]+)%<\/div>/g;
  let match;
  while ((match = mapRegex.exec(html)) !== null) {
    const rawName = match[1].trim();
    const wr = parseFloat(match[2]);
    // Normaliser le nom (Cobblestone n'est plus actif, skip)
    const canon = ACTIVE_MAPS.find(m => m.toLowerCase() === rawName.toLowerCase());
    if (canon) {
      mapStats[canon] = {
        wins: 0,  // non disponible sur cette page
        draws: 0,
        losses: 0,
        winRate: wr,
        totalRounds: 0,
      };
    }
  }

  // Overview sur la page principale
  const mainUrl = `https://www.hltv.org/stats/teams/${teamId}/${slug}`;
  console.log(`  Fetching overview: ${mainUrl}`);
  const mainHtml = await flareGet(mainUrl);

  const overviewRegex = /class="large-strong"[^>]*>([\d,\.]+)/g;
  const nums = [];
  let m;
  while ((m = overviewRegex.exec(mainHtml)) !== null) {
    nums.push(parseFloat(m[1].replace(/,/g, '')));
  }
  const wdlStr = mainHtml.match(/class="large-strong"[^>]*>\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
  const overview = nums.length >= 6 ? {
    mapsPlayed: nums[0],
    wins: wdlStr ? parseInt(wdlStr[1]) : null,
    draws: wdlStr ? parseInt(wdlStr[2]) : null,
    losses: wdlStr ? parseInt(wdlStr[3]) : null,
    totalKills: nums[2],
    totalDeaths: nums[3],
    roundsPlayed: nums[4],
    kdRatio: nums[5],
  } : null;

  console.log(`  → overview: ${overview ? 'OK' : 'N/A'}, maps: ${Object.keys(mapStats).length}`);
  return { overview, mapStats };
}

function buildMapPool(teams) {
  const pool = {};
  for (const map of ACTIVE_MAPS) {
    const entries = teams
      .filter(t => t.mapStats[map])
      .map(t => ({
        name: t.name,
        hltv_id: t.hltv_id,
        winRate: t.mapStats[map].winRate,
        wins: t.mapStats[map].wins,
        losses: t.mapStats[map].losses,
        totalRounds: t.mapStats[map].totalRounds,
      }))
      .sort((a, b) => b.winRate - a.winRate)
      .map((t, i) => ({ ...t, rank: i + 1 }));

    const avgWr = entries.length
      ? Math.round(entries.reduce((s, e) => s + e.winRate, 0) / entries.length)
      : null;
    const totalMatches = entries.reduce((s, e) => s + e.wins + e.losses, 0);

    pool[map] = { avgWinrate: avgWr, totalMatches, teams: entries };
  }
  return pool;
}

async function main() {
  const args = process.argv.slice(2).reduce((acc, a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    acc[k] = v ?? true;
    return acc;
  }, {});

  const limit = args.limit ? parseInt(args.limit, 10) : MAX_TEAMS;
  const singleTeam = args.team || null;

  let teams;
  if (singleTeam) {
    teams = [{ name: singleTeam, rank: 0, points: 0 }];
  } else {
    teams = loadTeams();
  }

  const teamCount = Math.min(teams.length, limit);
  console.log(`\n[HLTV-Flare] Scraping ${teamCount} équipes via FlareSolverr`);
  console.log(`[HLTV-Flare] Delay: ${DELAY_MS / 1000}s, estimated: ~${Math.ceil(teamCount * DELAY_MS * 2 / 60000)} min\n`);

  const results = [];
  let errors = 0;

  for (let i = 0; i < teamCount; i++) {
    const { name, rank, points } = teams[i];
    console.log(`[${i + 1}/${teamCount}] ${name} (#${rank})`);

    try {
      // Resolve team ID
      const teamId = await resolveTeamId(name);
      if (!teamId) {
        console.log(`  ✗ ID introuvable`);
        errors++;
        if (i < teamCount - 1) await sleep(DELAY_MS);
        continue;
      }
      await sleep(DELAY_MS);

      // Fetch team stats
      const stats = await scrapeTeamStats(teamId, name);
      results.push({
        name,
        hltv_id: teamId,
        rank,
        points,
        overview: stats.overview,
        mapStats: stats.mapStats,
        currentLineup: [],
      });
    } catch (e) {
      console.log(`  ✗ Erreur: ${e.message}`);
      errors++;
    }

    if (i < teamCount - 1) await sleep(DELAY_MS);
  }

  if (results.length === 0) {
    console.error('\n[HLTV-Flare] Aucune donnée récupérée.');
    process.exit(1);
  }

  // Write team stats
  const teamPayload = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'HLTV.org via FlareSolverr — weekly refresh',
    n_teams: results.length,
    maps: ACTIVE_MAPS,
    teams: results,
  };
  fs.mkdirSync(path.dirname(OUT_TEAM_STATS), { recursive: true });
  fs.writeFileSync(OUT_TEAM_STATS, JSON.stringify(teamPayload, null, 2), 'utf8');
  console.log(`\n[HLTV-Flare] ✓ ${results.length} équipes → ${path.basename(OUT_TEAM_STATS)}`);

  // Write map pool
  const mapPool = buildMapPool(results);
  const mapPoolPayload = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'HLTV.org — agrégé depuis team stats',
    n_teams: results.length,
    maps: ACTIVE_MAPS,
    mapPool,
  };
  fs.writeFileSync(OUT_MAP_POOL, JSON.stringify(mapPoolPayload, null, 2), 'utf8');
  console.log(`[HLTV-Flare] ✓ Map pool → ${path.basename(OUT_MAP_POOL)}`);
  console.log(`[HLTV-Flare] Done. ${errors} erreurs.`);
}

main().catch(e => { console.error('[HLTV-Flare] Fatal:', e.message); process.exit(1); });
