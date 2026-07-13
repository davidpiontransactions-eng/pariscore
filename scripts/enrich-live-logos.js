#!/usr/bin/env node
/**
 * scripts/enrich-live-logos.js — Enrichissement live des logos équipes + championnats.
 *
 * CLI standalone qui peuple les tables team_logos + league_logos à partir des matchs
 * observés dans le flux SSE /api/v1/live. Utilisable en :
 *   - --once    : 1 snapshot (connexion SSE, 1 matches_update reçu, enrichit, exit)
 *   - --watch   : écoute SSE continue avec reconnexion backoff exponentiel
 *   - --audit   : liste les équipes/leagues manquantes sans rien écrire
 *   - --dry-run : simule la cascade sans écrire en DB
 *   - --from-db : bypass SSE, scanne directement match_stats_history (historique)
 *
 * Ce script peuple la DB SEULEMENT (team_logos / league_logos). Il ne peut PAS muter
 * db.matches du serveur (process séparé) — c'est le rôle du module services/liveLogoEnricher.js
 * (Livrable 2) branché dans server.js. Ce script sert de backfill / test / dev.
 *
 * Usage :
 *   node scripts/enrich-live-logos.js --once --url http://localhost:3000
 *   node scripts/enrich-live-logos.js --watch --url http://localhost:3000
 *   node scripts/enrich-live-logos.js --audit --url http://localhost:3000
 *   node scripts/enrich-live-logos.js --once --dry-run
 *   node scripts/enrich-live-logos.js --from-db                # backfill depuis historique
 *   node scripts/enrich-live-logos.js --from-db --sport soccer # filtrer par sport
 *
 * Options :
 *   --url <u>     URL base du serveur PariScore (défaut http://localhost:3000)
 *   --db <path>   Chemin pariscore.db (défaut ../pariscore.db)
 *   --sport <s>   Filtre sport (utile avec --from-db)
 *   --verbose     Logs détaillés
 *   --batch <n>   Max entités nouvelles à enrichir par run (défaut 20)
 */

'use strict';

const path = require('path');
const fs = require('fs');

const cascade = require('../lib/logo-cascade');
const {
  config, normalizeTeamName,
  openDb, findTeamInCache, findLeagueInCache,
  upsertTeamLogo, upsertLeagueLogo,
  resolveTeamLogo, resolveLeagueLogo,
} = cascade;

const DEFAULT_URL = 'http://localhost:3000';
const DEFAULT_DB = path.join(__dirname, '..', 'pariscore.db');

// ─── CLI parsing ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {
    mode: null,                // 'once' | 'watch' | 'audit'
    fromDb: false,
    url: DEFAULT_URL,
    dbPath: DEFAULT_DB,
    sport: null,
    verbose: false,
    dryRun: false,
    batch: 20,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--once') { out.mode = 'once'; continue; }
    if (a === '--watch') { out.mode = 'watch'; continue; }
    if (a === '--audit') { out.mode = 'audit'; continue; }
    if (a === '--from-db') { out.fromDb = true; continue; }
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--verbose' || a === '-v') { out.verbose = true; continue; }
    if (a === '--url') { out.url = argv[++i]; continue; }
    if (a === '--db') { out.dbPath = argv[++i]; continue; }
    if (a === '--sport') { out.sport = argv[++i]; continue; }
    if (a === '--batch') { out.batch = parseInt(argv[++i], 10) || 20; continue; }
    if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/enrich-live-logos.js --once|--watch|--audit|--from-db [options]');
      console.log('  --url <u>     serveur PariScore (défaut http://localhost:3000)');
      console.log('  --db <path>   pariscore.db (défaut ../pariscore.db)');
      console.log('  --dry-run     sans écriture DB');
      console.log('  --verbose     logs détaillés');
      console.log('  --batch <n>   max entités nouvelles/run (défaut 20)');
      process.exit(0);
    }
    console.warn(`Option inconnue: ${a}`);
  }
  if (!out.mode && !out.fromDb) out.mode = 'once';
  return out;
}

// ─── Dédup in-memory (persistante au sein du process) ─────────────────────────
const _attemptedTeams = new Set();
const _attemptedLeagues = new Set();

function collectEntitiesFromMatches(matches) {
  const teams = [];
  const leagues = [];
  for (const m of matches) {
    if (!m) continue;
    if (m.home_team) teams.push({ name: m.home_team, country: m.country, sport: m.sport });
    if (m.away_team) teams.push({ name: m.away_team, country: m.country, sport: m.sport });
    if (m.league) {
      leagues.push({
        name: m.league,
        country: m.country,
        sport: m.sport,
        bsdLeagueId: m._bsd_league_id || null,
        imagePath: m.league_logo_url || null,
      });
    }
  }
  return { teams, leagues };
}

// ─── Enrichissement d'une équipe (cache DB → cascade) ────────────────────────
async function enrichTeam(db, { name, country, sport }, { dryRun, verbose }) {
  const norm = normalizeTeamName(name);
  if (!norm || _attemptedTeams.has(norm)) return null;
  _attemptedTeams.add(norm);
  // Cache DB d'abord
  const cached = findTeamInCache(db, name);
  if (cached) return { status: 'cache', ...cached };
  // Cascade
  const row = await resolveTeamLogo(name, { verbose });
  if (row && row.logo_url) {
    if (!dryRun) {
      try {
        upsertTeamLogo(db, { ...row, name_norm: norm });
      } catch (e) {
        if (verbose) console.warn(`  [upsert team] ${name}: ${e.message}`);
      }
    }
    return { status: row.source, bsd_id: row.bsd_id, logo_url: row.logo_url };
  }
  return { status: 'failed', bsd_id: null, logo_url: null };
}

// ─── Enrichissement d'un championnat ──────────────────────────────────────────
async function enrichLeague(db, league, { dryRun, verbose }) {
  const key = league.name + '|' + (league.country || '') + '|' + (league.sport || '');
  if (_attemptedLeagues.has(key)) return null;
  _attemptedLeagues.add(key);
  // Cache DB d'abord
  const cached = findLeagueInCache(db, league);
  if (cached) return { status: 'cache', ...cached };
  // Cascade
  const row = await resolveLeagueLogo(league, { verbose });
  if (row && row.logo_url) {
    if (!dryRun) {
      try {
        upsertLeagueLogo(db, {
          bsd_league_id: row.bsd_league_id,
          name: row.name || league.name,
          name_norm: normalizeTeamName(league.name),
          country: row.country || league.country || '',
          sport: row.sport || league.sport || '',
          logo_url: row.logo_url,
          source: row.source || 'unknown',
        });
      } catch (e) {
        if (verbose) console.warn(`  [upsert league] ${league.name}: ${e.message}`);
      }
    }
    return { status: row.source, bsd_league_id: row.bsd_league_id, logo_url: row.logo_url };
  }
  return { status: 'failed', bsd_league_id: null, logo_url: null };
}

// ─── Mode audit : liste manquants sans rien écrire ────────────────────────────
async function runAudit(db, matches, opts) {
  const { teams, leagues } = collectEntitiesFromMatches(matches);
  const teamMissing = [];
  const leagueMissing = [];

  for (const t of teams) {
    const norm = normalizeTeamName(t.name);
    if (_attemptedTeams.has(norm)) continue;
    _attemptedTeams.add(norm);
    const cached = findTeamInCache(db, t.name);
    if (!cached) teamMissing.push(t);
  }
  for (const lg of leagues) {
    const key = lg.name + '|' + (lg.country || '') + '|' + (lg.sport || '');
    if (_attemptedLeagues.has(key)) continue;
    _attemptedLeagues.add(key);
    const cached = findLeagueInCache(db, lg);
    if (!cached) leagueMissing.push(lg);
  }

  console.log('\n' + '═'.repeat(78));
  console.log('  AUDIT LOGOS MANQUANTS');
  console.log('═'.repeat(78));
  console.log(`  Matchs analysés : ${matches.length}`);
  console.log(`  Équipes uniques manquantes : ${teamMissing.length}`);
  for (const t of teamMissing.slice(0, 50)) {
    console.log(`    • ${t.name.padEnd(30)} [${t.country || '?'}] ${t.sport || ''}`);
  }
  if (teamMissing.length > 50) console.log(`    ... et ${teamMissing.length - 50} autres`);
  console.log(`  Championnats uniques manquants : ${leagueMissing.length}`);
  for (const lg of leagueMissing.slice(0, 30)) {
    console.log(`    • ${lg.name.padEnd(30)} [${lg.country || '?'}] ${lg.sport || ''}`);
  }
  if (leagueMissing.length > 30) console.log(`    ... et ${leagueMissing.length - 30} autres`);
  console.log('═'.repeat(78) + '\n');
}

// ─── Mode enrichissement (once / watch tick) ──────────────────────────────────
async function enrichBatch(db, matches, opts) {
  const stats = { teams: { found: 0, failed: 0, cache: 0 }, leagues: { found: 0, failed: 0, cache: 0 } };
  const { teams, leagues } = collectEntitiesFromMatches(matches);

  let budget = opts.batch;
  const dryRun = opts.dryRun;
  const verbose = opts.verbose;

  // Équipes d'abord
  for (const t of teams) {
    if (budget <= 0) break;
    const r = await enrichTeam(db, t, { dryRun, verbose });
    if (!r) continue;
    if (r.status === 'cache') stats.teams.cache++;
    else if (r.status === 'failed') stats.teams.failed++;
    else { stats.teams.found++; budget--; }
  }
  // Championnats
  for (const lg of leagues) {
    if (budget <= 0) break;
    const r = await enrichLeague(db, lg, { dryRun, verbose });
    if (!r) continue;
    if (r.status === 'cache') stats.leagues.cache++;
    else if (r.status === 'failed') stats.leagues.failed++;
    else { stats.leagues.found++; budget--; }
  }

  return stats;
}

function printStats(stats, opts) {
  console.log(`\n  [${new Date().toISOString()}] ${opts.dryRun ? '[DRY-RUN]' : '[DB mis à jour]'}`);
  console.log(`    Équipes     : ${stats.teams.found} trouvés, ${stats.teams.cache} cache, ${stats.teams.failed} échecs`);
  console.log(`    Championnats: ${stats.leagues.found} trouvés, ${stats.leagues.cache} cache, ${stats.leagues.failed} échecs`);
}

// ─── SSE client (EventSource) avec reconnexion backoff ────────────────────────
// Node 24+ a EventSource en global. Fallback sur module si absent.
function getEventSource() {
  if (typeof globalThis.EventSource === 'function') return globalThis.EventSource;
  try { return require('undici').EventSource; } catch (_) {}
  try { return require('eventsource'); } catch (_) {}
  return null;
}

function connectSSE(url, onMatches, opts) {
  const ES = getEventSource();
  if (!ES) {
    console.error('[FATAL] EventSource indisponible. Node < 24 sans undici/eventsource installé.');
    process.exit(3);
  }
  let backoffMs = 1000;
  const MAX_BACKOFF = 30000;
  let es = null;

  function connect() {
    const sseUrl = url.replace(/\/$/, '') + '/api/v1/live';
    if (opts.verbose) console.log(`[SSE] connexion à ${sseUrl}`);
    es = new ES(sseUrl, { withCredentials: false });

    es.addEventListener('open', () => {
      backoffMs = 1000; // reset backoff
      if (opts.verbose) console.log('[SSE] connecté');
    });

    es.addEventListener('matches_update', (e) => {
      try {
        const payload = JSON.parse(e.data || '{}');
        const matches = Array.isArray(payload.matches) ? payload.matches : [];
        onMatches(matches);
      } catch (err) {
        if (opts.verbose) console.warn('[SSE] parse error:', err.message);
      }
    });

    es.addEventListener('error', (e) => {
      if (opts.verbose) console.warn(`[SSE] erreur — reconnexion dans ${Math.round(backoffMs / 1000)}s`);
      try { es.close(); } catch (_) {}
      if (opts.mode === 'watch') {
        setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF);
      }
    });
  }

  connect();
  return () => { try { es && es.close(); } catch (_) {} };
}

// ─── Source alternative : scan direct de match_stats_history ───────────────────
function collectFromDbHistory(db, sportFilter) {
  const matches = [];
  try {
    let rows;
    if (sportFilter) {
      rows = db.prepare("SELECT DISTINCT home_team, away_team, bsd_league_id, season FROM match_stats_history WHERE home_team != '' AND home_team IS NOT NULL LIMIT 2000").all();
    } else {
      rows = db.prepare("SELECT DISTINCT home_team, away_team, bsd_league_id, season FROM match_stats_history WHERE home_team != '' AND home_team IS NOT NULL LIMIT 2000").all();
    }
    // match_stats_history ne stocke pas le nom du league ni sport_key tel quel ; on synthétise
    // Pour le backfill DB, on se concentre sur les équipes (le league_id BSD n'a pas de nom ici).
    for (const r of rows) {
      matches.push({
        home_team: r.home_team,
        away_team: r.away_team,
        league: null, // pas résolvable depuis cette table sans mapping
        country: null,
        sport: sportFilter || 'soccer',
        _bsd_league_id: r.bsd_league_id || null,
        league_logo_url: null,
      });
    }
  } catch (e) {
    console.warn('[from-db] lecture match_stats_history échouée:', e.message);
  }
  return matches;
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log(`\n  enrich-live-logos — mode: ${opts.fromDb ? 'from-db' : opts.mode}${opts.dryRun ? ' [DRY-RUN]' : ''}`);
  console.log(`  Config: BSD_API_KEY=${config.BSD_API_KEY ? 'oui' : 'non'}, THE_SPORTSDB_KEY=${config.THE_SPORTSDB_KEY === '3' ? 'test(3)' : 'Pro'}, API_FOOTBALL_KEY=${config.API_FOOTBALL_KEY ? 'oui' : 'non'}\n`);

  if (opts.mode === 'audit' && opts.dryRun === false && opts.fromDb === false) {
    // audit peut tourner sans DB écrite, mais on a besoin de DB pour findTeamInCache
  }

  const db = opts.dryRun ? null : openDb(opts.dbPath);

  // ── --from-db : backfill depuis match_stats_history ──
  if (opts.fromDb) {
    const matches = collectFromDbHistory(db, opts.sport);
    console.log(`  [from-db] ${matches.length} matchs uniques lus depuis match_stats_history`);
    if (opts.mode === 'audit') {
      await runAudit(db, matches, opts);
    } else {
      const stats = await enrichBatch(db, matches, opts);
      printStats(stats, opts);
    }
    if (db) db.close();
    return;
  }

  // ── Modes SSE (once / watch / audit) ──
  let done = false;
  const closeSSE = connectSSE(opts.url, async (matches) => {
    if (done) return;
    if (opts.verbose) console.log(`[SSE] ${matches.length} matchs reçus`);

    if (opts.mode === 'audit') {
      await runAudit(db, matches, opts);
      done = true;
      closeSSE();
      if (db) db.close();
      process.exit(0);
    }

    // once ou watch tick
    try {
      const stats = await enrichBatch(db, matches, opts);
      printStats(stats, opts);
    } catch (e) {
      console.warn('[enrich] erreur:', e.message);
    }

    if (opts.mode === 'once') {
      done = true;
      closeSSE();
      if (db) db.close();
      process.exit(0);
    }
    // watch : continue, prochaine frames matches_update déclencheront enrichBatch
    // avec dédup in-memory (_attemptedTeams / _attemptedLeagues)
  }, opts);

  // En mode watch, on reste alive. Ctrl-C propre :
  process.on('SIGINT', () => {
    console.log('\n[interrupt] fermeture...');
    closeSSE();
    if (db) db.close();
    process.exit(0);
  });
}

main().catch(e => {
  console.error('[FATAL]', e.stack || e.message);
  process.exit(1);
});
