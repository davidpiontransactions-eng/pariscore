#!/usr/bin/env node
'use strict';
/**
 * scrape-hltv-stats.js — Scraper stats HLTV maps & équipes (CS2)
 * ----------------------------------------------------------------
 * Source : hltv.org/stats/teams/* (HTML scrapé via gigobyte/hltv npm)
 *
 * Données extraites par équipe :
 *   - Overview   : maps jouées, K/D ratio, wins/draws/losses, rounds joués
 *   - Map stats  : winrate, wins/draws/losses, total rounds, first kill/death %
 *   - Roster     : lineup actuelle, joueurs historiques
 *
 * Sortie :
 *   data/hltv_team_stats.json   — stats détaillées par équipe (top-30)
 *   data/hltv_map_pool.json     — stats globales par carte (pick/ban/winrate)
 *
 * Usage :
 *   node tools/scrape-hltv-stats.js                    # top-30, FlareSolverr auto
 *   node tools/scrape-hltv-stats.js --limit=5          # smoke test
 *   node tools/scrape-hltv-stats.js --dry-run          # parse sans écrire
 *   node tools/scrape-hltv-stats.js --team=Vitality    # une équipe
 *   node tools/scrape-hltv-stats.js --direct           # forcer HTTPS direct
 *
 * Cron VPS : 0 3 * * 0 cd /home/ubuntu/pariscore && node tools/scrape-hltv-stats.js
 * (weekly, dimanche 03:00 UTC — nécessite IP résidentielle ou FlareSolverr)
 *
 * Cloudflare : HLTV bloque les IPs datacenter. Le script tente le direct
 * d'abord, puis bascule sur FlareSolverr (sessions réutilisées) si 403.
 * Sur VPS, TOUTES les requêtes passent par FlareSolverr.
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── Constantes ───────────────────────────────────────────────────────────────

const RANKINGS_FILE = path.join(__dirname, '..', 'data', 'hltv_rankings.json');
const OUT_TEAMStats = path.join(__dirname, '..', 'data', 'hltv_team_stats.json');
const OUT_MAP_POOL  = path.join(__dirname, '..', 'data', 'hltv_map_pool.json');

const MAX_TEAMS    = 30;
const DELAY_MS     = 8000;   // entre chaque équipe (Cloudflare mitigation)
const HTTP_TIMEOUT = 30000;
const USER_AGENT   = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ACTIVE_MAPS = ['Mirage', 'Inferno', 'Nuke', 'Ancient', 'Anubis', 'Vertigo', 'Dust2'];

// ─── FlareSolverr ─────────────────────────────────────────────────────────────

const FLARE_URL     = process.env.FLARESOLVERR_URL || 'http://127.0.0.1:8191/v1';
const FLARE_ENABLED = process.env.FLARESOLVERR_ENABLED !== '0';
const FLARE_SESSION_COUNT = parseInt(process.env.FLARE_SESSIONS || '2', 10);

let flareSessionId = null;
let flareUserAgent = USER_AGENT;
let useFlareSessions = false;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Crée une session FlareSolverr navigateur réutilisée. */
async function createFlareSession() {
  const res = await fetch(FLARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'sessions.create' }),
  });
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(`FlareSolverr session.create: ${json.message}`);
  const id = json.session;
  console.log(`  [flare] Session créée: ${id}`);
  return id;
}

/** Résout le challenge Cloudflare via FlareSolverr et retourne le HTML. */
async function flareFetch(url) {
  const body = {
    cmd: 'request.get',
    url,
    maxTimeout: HTTP_TIMEOUT,
  };
  if (flareSessionId) body.session = flareSessionId;

  const res = await fetch(FLARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.status !== 'ok') throw new Error(`FlareSolverr: ${json.message || json.status}`);
  if (json.solution?.userAgent) flareUserAgent = json.solution.userAgent;
  return json.solution?.response || '';
}

// ─── HTTP direct (avec fallback FlareSolverr) ─────────────────────────────────

async function fetchPage(url) {
  // Mode sessions FlareSolverr actif (VPS) → pas de tentative directe
  if (FLARE_ENABLED && useFlareSessions) {
    return flareFetch(url);
  }

  // Tentative directe
  try {
    const html = await new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: HTTP_TIMEOUT,
      }, (res) => {
        if (res.statusCode === 403 || res.statusCode === 503) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Redirect
          fetchPage(res.headers.location).then(resolve).catch(reject);
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
    return html;
  } catch (err) {
    // Fallback FlareSolverr
    if (FLARE_ENABLED) {
      console.log(`  [flare] Direct échoué (${err.message}), bascule FlareSolverr...`);
      try {
        const html = await flareFetch(url);
        // Si FlareSolverr réussit, activer les sessions pour la suite
        if (!flareSessionId && FLARE_SESSION_COUNT > 0) {
          flareSessionId = await createFlareSession();
          useFlareSessions = true;
        }
        return html;
      } catch (flareErr) {
        throw new Error(`Direct (${err.message}) + FlareSolverr (${flareErr.message})`);
      }
    }
    throw err;
  }
}

// ─── Parsing HTML → structuré ─────────────────────────────────────────────────

function parseTeamStats(html) {
  // Extraction basique via regex (pas de cheerio pour zéro-dép)
  const result = {
    overview: null,
    mapStats: {},
  };

  // Overview : maps played, K/D, W/D/L
  const overviewMatch = html.match(/class="large-strong"[^>]*>([\d,\.]+)/g);
  if (overviewMatch && overviewMatch.length >= 5) {
    const nums = overviewMatch.map(m => {
      const v = m.match(/>([\d,\.]+)/);
      return v ? parseFloat(v[1].replace(/,/g, '')) : null;
    });
    result.overview = {
      mapsPlayed: nums[0],
      totalKills: nums[2],
      totalDeaths: nums[3],
      roundsPlayed: nums[4],
      kdRatio: nums[5],
    };
  }

  // Per-map stats : pattern "de_X" suivi de stats
  for (const map of ACTIVE_MAPS) {
    const mapLower = map.toLowerCase();
    const deMap = `de_${mapLower}`;
    // Chercher la section de cette carte
    const mapRegex = new RegExp(
      `${deMap}[\\s\\S]*?class="stats-row"[\\s\\S]*?<span>(\\d+)\\s*/\\s*(\\d+)\\s*/\\s*(\\d+)</span>[\\s\\S]*?<span>([\\d.]+)%</span>[\\s\\S]*?<span>([\\d,]+)</span>`,
      'i'
    );
    const m = html.match(mapRegex);
    if (m) {
      result.mapStats[map] = {
        wins: parseInt(m[1]),
        draws: parseInt(m[2]),
        losses: parseInt(m[3]),
        winRate: parseFloat(m[4]),
        totalRounds: parseInt(m[5].replace(/,/g, '')),
      };
    }
  }

  return result;
}

// ─── Chargement des équipes ───────────────────────────────────────────────────

function loadTeamNames() {
  try {
    const raw = JSON.parse(fs.readFileSync(RANKINGS_FILE, 'utf8'));
    return (raw.teams || []).slice(0, MAX_TEAMS).map(t => ({
      name: t.name,
      rank: t.rank,
      points: t.points,
    }));
  } catch (e) {
    console.error('[HLTV] Impossible de lire rankings:', e.message);
    process.exit(1);
  }
}

// ─── Scraping principal ───────────────────────────────────────────────────────

async function scrapeTeamStats(HLTV, teamName, teamId) {
  try {
    const stats = await HLTV.getTeamStats({ teamId });
    return {
      name: teamName,
      hltv_id: teamId,
      overview: stats.overview || null,
      mapStats: stats.mapStats || {},
      currentLineup: (stats.currentLineup || []).map(p => ({
        id: p.id,
        name: p.name,
      })),
    };
  } catch (e) {
    console.warn(`  [${teamName}] getTeamStats échoué: ${e.message}`);
    return null;
  }
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

    // Stats globales de la carte
    const avgWr = entries.length
      ? Math.round(entries.reduce((s, e) => s + e.winRate, 0) / entries.length)
      : null;
    const totalMatches = entries.reduce((s, e) => s + e.wins + e.losses, 0);

    pool[map] = {
      avgWinrate: avgWr,
      totalMatches,
      teams: entries,
    };
  }
  return pool;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2).reduce((acc, a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    acc[k] = v ?? true;
    return acc;
  }, {});

  const limit = args.limit ? parseInt(args.limit, 10) : MAX_TEAMS;
  const dryRun = !!args['dry-run'];
  const directOnly = !!args.direct;
  const singleTeam = args.team || null;

  if (directOnly) {
    console.log('[HLTV] Mode HTTPS direct forcé (pas de FlareSolverr)');
  }

  // Charger le package hltv
  let HLTV;
  try {
    const mod = require('hltv');
    HLTV = mod.HLTV || mod.default || mod;
    if (typeof HLTV.getTeamByName !== 'function') {
      if (mod.HLTV && typeof mod.HLTV.getTeamByName === 'function') HLTV = mod.HLTV;
      else throw new Error('HLTV.getTeamByName introuvable');
    }
  } catch (e) {
    console.error('[HLTV] Erreur package hltv:', e.message);
    console.error('Run: bun add hltv --dev');
    process.exit(1);
  }

  // Charger les équipes
  let teams;
  if (singleTeam) {
    teams = [{ name: singleTeam, rank: 0, points: 0 }];
  } else {
    teams = loadTeamNames();
  }

  const teamCount = Math.min(teams.length, limit);
  console.log(`\n[HLTV] Scraping stats ${teamCount} équipes (delay ${DELAY_MS / 1000}s)`);
  console.log(`[HLTV] Estimé: ~${Math.ceil(teamCount * DELAY_MS / 60000)} min`);
  console.log(`[HLTV] FlareSolverr: ${FLARE_ENABLED ? 'activé' : 'désactivé'}\n`);

  const results = [];
  let cfBlocked = 0;

  for (let i = 0; i < teamCount; i++) {
    const { name, rank } = teams[i];
    process.stdout.write(`[${i + 1}/${teamCount}] ${name} (#${rank}) — résolution ID...`);

    // Résoudre l'ID HLTV
    let team;
    try {
      team = await HLTV.getTeamByName({ name });
    } catch (e) {
      console.log(` ID échoué: ${e.message}`);
      cfBlocked++;
      if (i < teamCount - 1) await sleep(DELAY_MS);
      continue;
    }
    if (!team?.id) {
      console.log(' ID introuvable, skip');
      if (i < teamCount - 1) await sleep(DELAY_MS);
      continue;
    }
    process.stdout.write(` id=${team.id}\n`);
    await sleep(DELAY_MS);

    // Scraper les stats
    const stats = await scrapeTeamStats(HLTV, name, team.id);
    if (stats) {
      results.push({ ...stats, rank, points: teams[i].points });
      const mapCount = Object.keys(stats.mapStats).length;
      console.log(`  ✓ ${mapCount} cartes, overview: ${stats.overview ? 'OK' : 'N/A'}`);
    } else {
      cfBlocked++;
    }

    if (i < teamCount - 1) await sleep(DELAY_MS);
  }

  if (cfBlocked === teamCount) {
    console.error('\n[HLTV] Toutes les requêtes ont échoué — Cloudflare bloque l\'IP.');
    console.error('Solution: exécuter depuis une IP résidentielle ou activer FlareSolverr.');
    process.exit(1);
  }

  if (dryRun) {
    console.log(`\n[HLTV] Dry run — ${results.length} équipes parseées, pas d'écriture.`);
    console.log(JSON.stringify(results[0], null, 2));
    return;
  }

  // Écrire les sorties
  const teamPayload = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'HLTV.org via gigobyte/hltv — weekly refresh',
    n_teams: results.length,
    maps: ACTIVE_MAPS,
    teams: results,
  };

  fs.mkdirSync(path.dirname(OUT_TEAMStats), { recursive: true });
  fs.writeFileSync(OUT_TEAMStats, JSON.stringify(teamPayload, null, 2), 'utf8');
  console.log(`\n[HLTV] ✓ ${results.length} équipes → ${path.basename(OUT_TEAMStats)}`);

  // Map pool
  const mapPool = buildMapPool(results);
  const mapPoolPayload = {
    generated: new Date().toISOString().slice(0, 10),
    source: 'HLTV.org — agrégé depuis team stats',
    n_teams: results.length,
    maps: ACTIVE_MAPS,
    mapPool,
  };
  fs.writeFileSync(OUT_MAP_POOL, JSON.stringify(mapPoolPayload, null, 2), 'utf8');
  console.log(`[HLTV] ✓ Map pool → ${path.basename(OUT_MAP_POOL)}`);
  console.log('[HLTV] Done. Deploy data/ to VPS.');
}

main().catch(e => { console.error('[HLTV] Fatal:', e.message); process.exit(1); });
