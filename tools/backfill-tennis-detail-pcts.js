#!/usr/bin/env node
/**
 * Backfill pourcentages de détail BSD → tennis_matches_internal (Top5 tennis).
 *
 * Le payload liste BSD ne porte pas les stats service/retour ; le détail
 * /matches/{id}/ fournit les POURCENTAGES (pas les dénominateurs absolus).
 * On stocke donc des colonnes pct dédiées (idempotent) que le module
 * src/lib/tennis-top5-stats.ts agrège en moyennes pondérées par match :
 *   w/l_1st_in_pct, w/l_1st_won_pct, w/l_2nd_won_pct,
 *   w/l_ret_pts_won_pct, w/l_bp_saved_pct, w/l_tb_won
 *
 * USAGE:
 *   node tools/backfill-tennis-detail-pcts.js [--limit=N] [--pause-ms=X]
 * Clé: BSD_API_KEY depuis .env (chargé ici manuellement).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname.replace(/[/\\]tools$/, '');
const DB_PATH = process.env.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
const LIMIT = parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
const PAUSE = parseInt(process.argv.find((a) => a.startsWith('--pause-ms='))?.split('=')[1] || '250', 10);

// Charge .env silencieusement (ne jamais afficher la clé)
const envKey = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').match(/^BSD_API_KEY=(.*)$/m);
if (!envKey) { console.error('[detail-backfill] BSD_API_KEY manquante dans .env'); process.exit(1); }
const BSD_KEY = envKey[1].trim();
const BSD_BASE = 'https://sports.bzzoiro.com/tennis';

const Database = require(path.join(ROOT, 'node_modules', 'better-sqlite3'));
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Colonnes pct dédiées (idempotent)
for (const c of [
  'w_1st_in_pct', 'w_1st_won_pct', 'w_2nd_won_pct', 'w_ret_pts_won_pct', 'w_bp_saved_pct', 'w_tb_won',
  'l_1st_in_pct', 'l_1st_won_pct', 'l_2nd_won_pct', 'l_ret_pts_won_pct', 'l_bp_saved_pct', 'l_tb_won',
]) {
  const has = db.prepare('PRAGMA table_info(tennis_matches_internal)').all().some((x) => x.name === c);
  if (!has) {
    db.exec(`ALTER TABLE tennis_matches_internal ADD COLUMN ${c} REAL`);
    console.log(`[detail-backfill] colonne ajoutée: ${c}`);
  }
}

function fetchDetail(id) {
  return new Promise((resolve, reject) => {
    https_get(`${BSD_BASE}/api/v2/matches/${id}/`, resolve, reject);
  });
}
const https = require('https');
function https_get(url, resolve, reject, retry = 1) {
  https.get(url, { headers: { Authorization: `Token ${BSD_KEY}` }, timeout: 12000 }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => {
      if (res.statusCode === 200) {
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('JSON ' + e.message)); }
      } else if ((res.statusCode === 429 || res.statusCode >= 500) && retry > 0) {
        setTimeout(() => https_get(url, resolve, reject, retry - 1), 1500);
      } else reject(new Error('HTTP ' + res.statusCode));
    });
  }).on('error', reject);
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

async function main() {
  const rows = db.prepare(`
    SELECT source_id FROM tennis_matches_internal
    WHERE source='bsd' AND w_1st_in_pct IS NULL
    ORDER BY match_date DESC
    ${LIMIT > 0 ? "LIMIT ?" : ""}
  `).all(...(LIMIT > 0 ? [LIMIT] : []));
  console.log(`[detail-backfill] à traiter: ${rows.length} (limite ${LIMIT}, pause ${PAUSE}ms)`);

  const upd = db.prepare(`UPDATE tennis_matches_internal SET
    w_1st_in_pct=?, w_1st_won_pct=?, w_2nd_won_pct=?, w_ret_pts_won_pct=?, w_bp_saved_pct=?, w_tb_won=?,
    l_1st_in_pct=?, l_1st_won_pct=?, l_2nd_won_pct=?, l_ret_pts_won_pct=?, l_bp_saved_pct=?, l_tb_won=?
    WHERE source='bsd' AND source_id=?`);

  let ok = 0, skip = 0, err = 0;
  for (let i = 0; i < rows.length; i++) {
    const id = rows[i].source_id;
    try {
      const res = await fetchDetail(id);
      const x = res?.data || res || {};
      // Champs à plat préfixés dans le détail BSD : p1_first_serve_pct, etc.
      const side = (pre) => ({
        fi: num(x[`${pre}_first_serve_pct`]),
        fw: num(x[`${pre}_first_serve_won_pct`]),
        sw: num(x[`${pre}_second_serve_won_pct`]),
        rp: num(x[`${pre}_return_points_won_pct`]),
        bp: num(x[`${pre}_break_points_saved_pct`]),
        tb: num(x[`${pre}_tiebreaks_won`]),
      });
      const A = side('p1');
      const B = side('p2');
      // winner côté w_* : ordre player1/player2 BSD ≠ gagnant/perdant —
      // mapping via winner_id (fallback p1 si absent, payload finished).
      const wIsP1 =
        x.winner_id == null ? true : String(x.winner_id) === String((x.player1 || {}).id);
      const W = wIsP1 ? A : B;
      const L = wIsP1 ? B : A;
      upd.run(
        W.fi, W.fw, W.sw, W.rp, W.bp, W.tb,
        L.fi, L.fw, L.sw, L.rp, L.bp, L.tb,
        id
      );
      ok++;
    } catch (e) {
      err++;
      if (i < 3 || err <= 3) console.warn(`  ! ${id}: ${e.message}`);
    }
    if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${rows.length} ok=${ok} err=${err}\r\n`);
    await new Promise((r) => setTimeout(r, PAUSE));
  }
  console.log(`\n[detail-backfill] TERMINÉ — ok=${ok} err=${err}`);
  // CRITIQUE sous WAL : sans close explicite, les commits du process peuvent
  // être perdus si la connexion est finalisée sans checkpoint (constaté).
  db.close();
}

main().catch((e) => { console.error('[detail-backfill] FAIL:', e.message); process.exit(1); });
