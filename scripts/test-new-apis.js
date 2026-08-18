'use strict';
/**
 * scripts/test-new-apis.js — Smoke test des 7 nouvelles API intégrées (2026-08-18)
 *
 * Hit `/api/v1/integrations/status` puis test 1 endpoint représentatif par service
 * (pour ceux qui sont enabled). Sortie en tableau texte + exit code non-zéro si
 * un service critique est cassé (enabled mais KO).
 *
 * Usage :
 *   node scripts/test-new-apis.js [base_url]
 *   base_url défaut : http://localhost:3000
 *
 * Pré-requis : serveur PariScore démarré (bun run dev / node server.js).
 */

const http = require('http');

const BASE = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';

// Endpoints de smoke test par service (un appel représentatif + léger)
const SMOKE_TESTS = {
  'football-data': '/api/v1/football-data/status',
  sportscore:      '/api/v1/sportscore/feeds',
  'player-elo':    '/api/v1/player-elo/status',
  propline:        '/api/v1/propline/status',
  therundown:      '/api/v1/therundown/status',
  dino:            '/api/v1/dino/status',
  sportmonks:      '/api/v1/sportmonks/status',
};

// Couleurs ANSI (no-op si non-TTY)
const c = (color, s) => (process.stdout.isTTY ? `\x1b[${color}m${s}\x1b[0m` : s);
const GREEN = (s) => c('32', s);
const RED = (s) => c('31', s);
const YELLOW = (s) => c('33', s);
const DIM = (s) => c('90', s);
const BOLD = (s) => c('1', s);

function get(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + pathname);
    const t0 = Date.now();
    const req = http.get(url, { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const dt = Date.now() - t0;
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({ status: res.statusCode, latency: dt, json, raw: body.slice(0, 200) });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout 10s')));
    req.on('error', reject);
  });
}

function fmtRow(name, status, latency, note) {
  const statusIcon = status === 'enabled'  ? GREEN('✓ enabled ')
                    : status === '503'    ? YELLOW('! 503    ')
                    : status === '500'    ? RED('✗ 500    ')
                    : status === 'fail'   ? RED('✗ failed ')
                    :                       DIM('○ n/a    ');
  const lat = latency != null ? `${String(latency).padStart(5)}ms` : '    -ms';
  return `  ${name.padEnd(15)} ${statusIcon} ${lat}  ${note || ''}`;
}

async function main() {
  console.log(BOLD(`\n🔍 PariScore API Smoke Test`));
  console.log(DIM(`   Base URL: ${BASE}\n`));

  // 1. Hit /integrations/status pour la vue agrégée
  let overview;
  try {
    const r = await get('/api/v1/integrations/status');
    overview = r.json;
    if (r.status !== 200 || !overview || !overview.ok) {
      console.error(RED(`✗ /integrations/status → HTTP ${r.status}`));
      console.error(DIM(r.raw));
      process.exit(2);
    }
    console.log(GREEN(`✓ /integrations/status : HTTP ${r.status} (${r.latency}ms)`));
    console.log(DIM(`   ${overview.summary.enabled}/${overview.summary.total} services enabled, ${overview.summary.needs_env} clés .env manquantes`));
    if (overview.missing_env_keys && overview.missing_env_keys.length) {
      console.log(YELLOW(`\n   ⚠  Clés .env manquantes :`));
      for (const k of overview.missing_env_keys) console.log(YELLOW(`     - ${k}`));
    }
  } catch (e) {
    console.error(RED(`✗ Connexion à ${BASE} échouée : ${e.message}`));
    console.error(DIM(`  → Le serveur tourne-t-il ? (bun run dev ou node server.js)`));
    process.exit(1);
  }

  // 2. Test un endpoint par service
  console.log(BOLD(`\n📡 Smoke tests par service :\n`));
  let fails = 0;
  const lines = [];
  for (const [name, path] of Object.entries(SMOKE_TESTS)) {
    const info = overview.integrations && overview.integrations[name];
    let note = '';
    let rowStatus;
    let latency;
    try {
      const r = await get(path);
      latency = r.latency;
      if (r.status === 200) {
        rowStatus = 'enabled';
        note = (info && info.required_env) ? `${info.required_env} OK` : 'no-auth';
      } else if (r.status === 503) {
        rowStatus = '503';
        note = `${info && info.required_env || 'clé'} manquante`;
      } else if (r.status === 500) {
        rowStatus = '500';
        note = (r.json && r.json.error) ? r.json.error.slice(0, 40) : 'erreur serveur';
        fails++;
      } else {
        rowStatus = 'fail';
        note = `HTTP ${r.status}`;
        fails++;
      }
    } catch (e) {
      rowStatus = 'fail';
      note = e.message;
      fails++;
    }
    lines.push(fmtRow(name, rowStatus, latency, note));
  }
  console.log(lines.join('\n'));

  // 3. Test critique : api-football (existant) doit toujours fonctionner
  console.log(BOLD(`\n🔴 Régression check (services existants) :\n`));
  const critical = [
    { path: '/api/v1/status', name: 'core status', need: 200 },
    { path: '/api/v1/cs2/status', name: 'cs2', need: 200 },
  ];
  for (const t of critical) {
    try {
      const r = await get(t.path);
      if (r.status === t.need) {
        console.log(`  ${t.name.padEnd(15)} ${GREEN('✓ OK ')} ${r.latency}ms`);
      } else {
        console.log(`  ${t.name.padEnd(15)} ${RED(`✗ HTTP ${r.status}`)}`);
        fails++;
      }
    } catch (e) {
      console.log(`  ${t.name.padEnd(15)} ${RED(`✗ ${e.message}`)}`);
      fails++;
    }
  }

  console.log(BOLD(`\n${'─'.repeat(60)}`));
  if (fails === 0) {
    console.log(GREEN(`✅ Tous les smoke tests OK. ${overview.summary.enabled} service(s) actif(s).`));
    process.exit(0);
  } else {
    console.log(RED(`❌ ${fails} échec(s).`));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(RED(`Erreur fatale :`), e);
  process.exit(2);
});