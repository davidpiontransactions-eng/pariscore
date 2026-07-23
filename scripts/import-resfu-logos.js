#!/usr/bin/env node
/**
 * scripts/import-resfu-logos.js — Import du mapping beSOCCER/resfu vers team_logos.
 *
 * Phase B3. Lit data/resfu-ids.json (peuplé par scripts/besoccer-backfill-ids.py via
 * Camoufox stealth) et insère les URLs logos cdn.resfu.com dans la table team_logos.
 *
 * Le mapping JSON a la forme :
 *   { "<name_norm>": {"name":"Real Madrid","resfu_id":2107,"url":"https://cdn.resfu.com/..."} }
 *
 * Filtres qualité :
 *   - Skip les noms commençant par une initiale + point ("D. Dumfries") — faux positifs
 *     joueurs collectés par le backfill à côté de shields d'équipe.
 *   - Skip les entrées déjà présentes en DB (cache-first, INSERT OR REPLACE safe).
 *
 * Usage :
 *   node scripts/import-resfu-logos.js                    # importe data/resfu-ids.json
 *   node scripts/import-resfu-logos.js --dry-run          # simule sans écrire
 *   node scripts/import-resfu-logos.js --file autre.json  # mapping personnalisé
 *   node scripts/import-resfu-logos.js --db ./pariscore.db
 *   node scripts/import-resfu-logos.js --force            # écrase même si URL existante
 */

'use strict';

const path = require('path');
const fs = require('fs');

const cascade = require('../lib/logo-cascade');
const { normalizeTeamName, openDb, findTeamInCache, upsertTeamLogo, externalId } = cascade;

const DEFAULT_MAPPING = path.join(__dirname, '..', 'data', 'resfu-ids.json');
const DEFAULT_DB = path.join(__dirname, '..', 'pariscore.db');
const PLAYER_NAME_RE = /^[A-Z]\.\s/; // "D. Dumfries" — faux positifs joueurs

function parseArgs(argv) {
  const out = { file: DEFAULT_MAPPING, dbPath: DEFAULT_DB, dryRun: false, force: false, verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') { out.file = argv[++i]; continue; }
    if (a === '--db') { out.dbPath = argv[++i]; continue; }
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--force') { out.force = true; continue; }
    if (a === '--verbose' || a === '-v') { out.verbose = true; continue; }
    if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/import-resfu-logos.js [--file <json>] [--db <path>] [--dry-run] [--force]');
      process.exit(0);
    }
    console.warn(`Option inconnue: ${a}`);
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`\n  import-resfu-logos — ${opts.dryRun ? '[DRY-RUN] ' : ''}${opts.force ? '[FORCE] ' : ''}${path.basename(opts.file)} → team_logos\n`);

  // Charge le mapping
  let mapping;
  try {
    mapping = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
  } catch (e) {
    console.error(`[FATAL] Impossible de lire ${opts.file}: ${e.message}`);
    console.error('        Lancez d\'abord: python scripts/besoccer-backfill-ids.py --team "..."');
    process.exit(1);
  }
  const entries = Object.entries(mapping).filter(([, v]) => v && v.resfu_id);
  console.log(`  Mapping chargé: ${entries.length} entrées (sur ${Object.keys(mapping).length} total)\n`);

  if (opts.dryRun) {
    console.log('  [DRY-RUN] pas d\'écriture DB. Aperçu des entrées qui seraient importées :\n');
  }

  const db = opts.dryRun ? null : openDb(opts.dbPath);
  const stats = { imported: 0, skippedExisting: 0, skippedPlayer: 0, errors: 0 };

  for (const [normKey, entry] of entries) {
    const name = entry.name || normKey;
    // Filtre faux positifs joueurs
    if (PLAYER_NAME_RE.test(name)) {
      stats.skippedPlayer++;
      if (opts.verbose) console.log(`  [skip-player] ${name}`);
      continue;
    }
    const logoUrl = `https://cdn.resfu.com/img_data/escudos/medium/${entry.resfu_id}.jpg?size=120x&lossy=1`;
    const nameNorm = normalizeTeamName(name);

    // Cache-first (sauf --force)
    if (!opts.force && db) {
      const cached = findTeamInCache(db, name);
      if (cached) {
        stats.skippedExisting++;
        if (opts.verbose) console.log(`  [cache] ${name} → déjà en DB`);
        continue;
      }
    }

    if (opts.dryRun) {
      console.log(`  [import] ${name.padEnd(25)} → id=${entry.resfu_id} | ${logoUrl.slice(0, 65)}...`);
      stats.imported++;
      continue;
    }

    try {
      upsertTeamLogo(db, {
        bsd_id: externalId(name),  // ID négatif (source externe non-BSD)
        name,
        short_name: '',
        country: '',
        name_norm: nameNorm,
        logo_url: logoUrl,
      });
      stats.imported++;
      if (opts.verbose) console.log(`  [ok] ${name} → ${logoUrl.slice(0, 60)}...`);
    } catch (e) {
      stats.errors++;
      if (opts.verbose) console.warn(`  [err] ${name}: ${e.message}`);
    }
  }

  if (db) db.close();

  console.log('\n' + '═'.repeat(60));
  console.log('  IMPORT RESFU → team_logos TERMINÉ');
  console.log('═'.repeat(60));
  console.log(`  Importés        : ${stats.imported}`);
  console.log(`  Déjà en DB      : ${stats.skippedExisting} (skip, utiliser --force pour écraser)`);
  console.log(`  Faux positifs   : ${stats.skippedPlayer} (joueurs filtrés)`);
  console.log(`  Erreurs         : ${stats.errors}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(e => {
  console.error('[FATAL]', e.stack || e.message);
  process.exit(1);
});
