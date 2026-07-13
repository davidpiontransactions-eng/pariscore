#!/usr/bin/env node
/**
 * scripts/scrape-logos.js — Scraping logos ÉQUIPES football pour PariScore.
 *
 * CLI wrapper fin autour de lib/logo-cascade.js (le module partagé).
 * Cascade documentée dans .agents/skills/ps-scrape-logos/SKILL.md :
 *   1. BSD API   (/teams/?search=  + /img/team/{id}/?bg=transparent)   — clé BSD_API_KEY
 *   2. TheSportsDB (searchteams.php → strLogo [clé test "3"] ou strTeamBadge [Pro])
 *   3. API-Football (v3/teams?search= → team.logo)                      — clé API_FOOTBALL_KEY
 *   4. Scraping HTML BSD (page /matches/{id} → img /img/team/{id}/")    — public, --match-id
 *   5. Fallback initiales (rien à scraper)
 *
 * NOTE: ce script ne traite que les ÉQUIPES (table team_logos).
 * Pour les logos de CHAMPIONNATS (table league_logos) et l'enrichissement live,
 * utiliser scripts/enrich-live-logos.js ou le module services/liveLogoEnricher.js.
 *
 * Usage :
 *   node scripts/scrape-logos.js "Arsenal,Chelsea,Real Madrid"
 *   node scripts/scrape-logos.js --from-file teams.txt
 *   node scripts/scrape-logos.js "Arsenal" --dry-run            # sans écrire en DB
 *   node scripts/scrape-logos.js "Team X" --match-id "Team X=12345"  # active source 4
 *   node scripts/scrape-logos.js "Arsenal" --db ./pariscore.db  # DB personnalisée
 *   node scripts/scrape-logos.js                                 # statut des sources
 *
 * Env (.env chargé si présent) :
 *   BSD_API_KEY, BSD_BASE_URL, BSD_ROOT_URL, THE_SPORTSDB_KEY (défaut "3"), API_FOOTBALL_KEY
 */

'use strict';

const path = require('path');
const fs = require('fs');

const cascade = require('../lib/logo-cascade');
const {
  config, normalizeTeamName,
  openDb, findTeamInCache, upsertTeamLogo,
  resolveTeamLogo,
} = cascade;

const DB_PATH = path.join(__dirname, '..', 'pariscore.db');

// ─── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { names: [], fromFile: null, dryRun: false, dbPath: DB_PATH, matchIds: {}, verbose: false, listSources: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from-file') { out.fromFile = argv[++i]; continue; }
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--db') { out.dbPath = argv[++i]; continue; }
    if (a === '--verbose' || a === '-v') { out.verbose = true; continue; }
    if (a === '--list-sources') { out.listSources = true; continue; }
    if (a === '--match-id') {
      const v = argv[++i];
      const eq = v.indexOf('=');
      if (eq > 0) out.matchIds[v.slice(0, eq).trim()] = v.slice(eq + 1).trim();
      else if (out.names.length) out.matchIds[out.names[out.names.length - 1]] = v;
      continue;
    }
    if (a.startsWith('--')) { console.warn(`Option inconnue : ${a}`); continue; }
    for (const n of String(a).split(',').map(s => s.trim()).filter(Boolean)) out.names.push(n);
  }
  if (out.fromFile) {
    try {
      const lines = fs.readFileSync(out.fromFile, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      out.names.push(...lines);
    } catch (e) {
      console.error(`[FATAL] Lecture ${out.fromFile} impossible : ${e.message}`);
      process.exit(2);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.listSources || !opts.names.length) {
    console.log('ps-scrape-logos — cascade de sources logos équipes PariScore');
    console.log('');
    console.log('Sources activées dans cette exécution :');
    console.log(`  1. BSD API          : ${config.BSD_API_KEY ? 'ACTIVE (BSD_API_KEY présente)' : 'SKIP (pas de BSD_API_KEY)'}`);
    console.log(`  2. TheSportsDB      : ${config.THE_SPORTSDB_KEY === '3' ? 'clé test "3" (strLogo gratuit, strTeamBadge = Pro)' : `clé ${config.THE_SPORTSDB_KEY} (Pro ?)`}`);
    console.log(`  3. API-Football     : ${config.API_FOOTBALL_KEY ? 'ACTIVE (API_FOOTBALL_KEY présente)' : 'SKIP (pas de API_FOOTBALL_KEY)'}`);
    console.log(`  4. Scraping BSD HTML: ${Object.keys(opts.matchIds).length ? 'ACTIVE (--match-id fourni)' : 'SKIP (utilisez --match-id "Team=12345")'}`);
    console.log(`  5. Fallback initiales : toujours (marque comme non-résolu)`);
    console.log('');
    if (!opts.names.length) {
      console.log('Usage :');
      console.log('  node scripts/scrape-logos.js "Arsenal,Chelsea,Real Madrid"');
      console.log('  node scripts/scrape-logos.js --from-file teams.txt');
      console.log('  node scripts/scrape-logos.js "Arsenal" --dry-run');
      console.log('  node scripts/scrape-logos.js "Team X" --match-id "Team X=12345"');
      process.exit(0);
    }
  }

  const db = opts.dryRun ? null : openDb(opts.dbPath);

  const stats = { found: 0, failed: 0, sources: { 'bsd-api': 0, 'thesportsdb': 0, 'api-football': 0, 'bsd-scrape': 0, 'cache': 0 }, results: [] };

  console.log(`\n[${new Date().toISOString()}] Début scraping — ${opts.names.length} équipe(s). ${opts.dryRun ? '[DRY-RUN : pas d écriture DB]' : `[DB: ${path.relative(process.cwd(), opts.dbPath)}]`}\n`);

  for (const name of opts.names) {
    process.stdout.write(`• ${name.padEnd(28)} `);

    // Cache d'abord (sauf dry-run sans DB)
    if (db) {
      const cached = findTeamInCache(db, name);
      if (cached) {
        console.log(`CACHE  → bsd_id=${cached.bsd_id}  ${cached.logo_url}`);
        stats.found++; stats.sources.cache++;
        stats.results.push({ name, status: 'cache', ...cached });
        continue;
      }
    }

    const r = await resolveTeamLogo(name, { verbose: opts.verbose, matchId: opts.matchIds[name] });
    if (r) {
      console.log(`OK[${r.source.padEnd(12)}] → ${r.logo_url}`);
      stats.found++; stats.sources[r.source] = (stats.sources[r.source] || 0) + 1;
      if (db) {
        try {
          upsertTeamLogo(db, { ...r, name_norm: normalizeTeamName(name) });
        } catch (e) {
          console.warn(`        (écriture DB échouée : ${e.message})`);
        }
      }
      stats.results.push({ name, status: r.source, bsd_id: r.bsd_id, logo_url: r.logo_url });
    } else {
      console.log('FAIL  → cascade épuisée, fallback initiales');
      stats.failed++;
      stats.results.push({ name, status: 'failed', bsd_id: null, logo_url: null });
    }
  }

  if (db) db.close();

  // ─── Rapport ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(78));
  console.log('  RAPPORT SCRAPE-LOGOS');
  console.log('═'.repeat(78));
  console.log(`  Total équipes   : ${opts.names.length}`);
  console.log(`  Logos trouvés   : ${stats.found}`);
  console.log(`  Échecs          : ${stats.failed}`);
  console.log('  Par source      :');
  console.log(`    cache (DB)    : ${stats.sources.cache}`);
  console.log(`    BSD API       : ${stats.sources['bsd-api']}`);
  console.log(`    TheSportsDB   : ${stats.sources.thesportsdb}     (note : strLogo gratuit, strTeamBadge = Pro)`);
  console.log(`    API-Football  : ${stats.sources['api-football']}`);
  console.log(`    Scraping BSD  : ${stats.sources['bsd-scrape']}`);
  console.log('─'.repeat(78));
  const cfg = [
    config.BSD_API_KEY ? 'BSD_API_KEY' : null,
    config.THE_SPORTSDB_KEY === '3' ? 'THE_SPORTSDB_KEY=test(3)' : 'THE_SPORTSDB_KEY=Pro',
    config.API_FOOTBALL_KEY ? 'API_FOOTBALL_KEY' : 'API_FOOTBALL_KEY(absente)',
  ].filter(Boolean).join(', ');
  console.log(`  Config clés     : ${cfg}`);
  console.log(`  Mode            : ${opts.dryRun ? 'DRY-RUN (rien écrit)' : 'DB mise à jour'}`);
  console.log('═'.repeat(78) + '\n');
}

main().catch(e => {
  console.error('[FATAL]', e.stack || e.message);
  process.exit(1);
});
