/**
 * scripts/bench-top10.js — Benchmark performance TOP 10 Tennis + H2H Surface
 * 
 * Mesure les temps de réponse de la route /api/v1/tennis/top10,
 * vérifie l'intégrité du payload, et teste les performances du module H2H.
 * 
 * Usage :
 *   node scripts/bench-top10.js              # Bench complet
 *   node scripts/bench-top10.js --quick      # Bench rapide (5 itérations)
 *   node scripts/bench-top10.js --h2h        # Bench H2H uniquement
 *   node scripts/bench-top10.js --json       # Output JSON structuré
 * 
 * Prérequis : serveur PariScore en cours d'exécution (node server.js)
 *             URL par défaut : http://localhost:3000
 *             Surchargeable via env PARISCORE_URL
 */

const BASE_URL = process.env.PARISCORE_URL || 'http://localhost:3000';
const DEFAULT_ITERATIONS = 20;
const QUICK_ITERATIONS = 5;

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const start = Date.now();
  const res = await fetch(url);
  const ms = Date.now() - start;
  const body = await res.json();
  return { status: res.status, ms, body, ok: res.ok };
}

function elapsed(start) { return Date.now() - start; }

function fmtMs(ms) {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s.length % 2 === 0 ? (s[s.length/2 - 1] + s[s.length/2]) / 2 : s[Math.floor(s.length/2)];
}
function min(arr) { return Math.min(...arr); }
function max(arr) { return Math.max(...arr); }
function pctl(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * s.length) - 1;
  return s[Math.max(0, Math.min(idx, s.length - 1))];
}

// ── Tests ──────────────────────────────────────────────────────────────────

async function benchTop10(mode, iterations) {
  console.log(`\n📊 Bench TOP 10 — mode=${mode} (${iterations} itérations)`);
  const times = [];
  let errors = 0;
  let emptyPayloads = 0;

  for (let i = 0; i < iterations; i++) {
    const result = await fetchJson(`${BASE_URL}/api/v1/tennis/top10?mode=${mode}`);
    if (!result.ok) { errors++; continue; }
    times.push(result.ms);
    if (!result.body.top10 || result.body.top10.length === 0) emptyPayloads++;
  }

  if (times.length === 0) {
    console.log(`  ❌ ERREUR : ${errors}/${iterations} échecs — serveur indisponible ?`);
    return { mode, ok: false, errors, iterations };
  }

  console.log(`  ✅ Succès : ${times.length}/${iterations}  |  Échecs : ${errors}`);
  console.log(`  📉 Min  : ${fmtMs(min(times))}`);
  console.log(`  📊 P50  : ${fmtMs(median(times))}`);
  console.log(`  📈 P95  : ${fmtMs(pctl(times, 95))}`);
  console.log(`  📈 P99  : ${fmtMs(pctl(times, 99))}`);
  console.log(`  📈 Max  : ${fmtMs(max(times))}`);
  console.log(`  📊 Moy  : ${fmtMs(mean(times))}`);
  console.log(`  📦 Payloads vides : ${emptyPayloads}`);

  return {
    mode,
    ok: true,
    iterations: times.length,
    errors,
    emptyPayloads,
    min_ms: min(times),
    p50_ms: median(times),
    p95_ms: pctl(times, 95),
    p99_ms: pctl(times, 99),
    max_ms: max(times),
    avg_ms: mean(times),
  };
}

async function checkTop10Integrity(mode) {
  console.log(`\n🔍 Vérification intégrité TOP 10 — mode=${mode}`);
  const result = await fetchJson(`${BASE_URL}/api/v1/tennis/top10?mode=${mode}`);
  
  if (!result.ok) {
    console.log(`  ❌ Route inaccessible (HTTP ${result.status})`);
    return { ok: false };
  }

  const b = result.body;
  const checks = [];

  // 1. Structure de base
  checks.push({ name: 'top10 présent', pass: Array.isArray(b.top10) });
  checks.push({ name: 'mode présent', pass: b.mode === mode });
  checks.push({ name: 'computed_at timestamp', pass: typeof b.computed_at === 'number' });
  checks.push({ name: 'total_active > 0', pass: (b.total_active || 0) > 0 });

  // 2. Champs requis par carte
  if (Array.isArray(b.top10) && b.top10.length > 0) {
    const card = b.top10[0];
    checks.push({ name: 'matchId présent', pass: !!card.matchId });
    checks.push({ name: 'player1/2 présents', pass: !!card.player1 && !!card.player2 });
    checks.push({ name: 'score_top10 0-100', pass: card.score_top10 >= 0 && card.score_top10 <= 100 });
    checks.push({ name: 'reason tag présent', pass: !!card.reason });
    checks.push({ name: 'data_completeness', pass: card.data_completeness >= 0 && card.data_completeness <= 1 });
    checks.push({ name: 'dims (6 dimensions)', pass: card.dims && typeof card.dims === 'object' });
    checks.push({ name: 'is_live booléen', pass: typeof card.is_live === 'boolean' });
    checks.push({ name: 'rlm booléen', pass: typeof card.rlm === 'boolean' });
    checks.push({ name: 'surface présente', pass: !!card.surface });
    checks.push({ name: 'tournament présent', pass: !!card.tournament });
  } else {
    console.log('  ⚠️ Aucune carte Top10 — pas de matchs actifs');
  }

  // 3. Diversité : max 3 matchs par tournoi
  if (Array.isArray(b.top10) && b.top10.length > 1) {
    const tourns = {};
    b.top10.forEach(c => { tourns[c.tournament] = (tourns[c.tournament] || 0) + 1; });
    const maxPerTourn = Math.max(...Object.values(tourns));
    checks.push({ name: 'Diversité (max 3/tournoi)', pass: maxPerTourn <= 3 });
    if (maxPerTourn > 3) {
      console.log(`  ⚠️  Violation diversité : tournoi avec ${maxPerTourn} matchs`);
    }
  }

  // Résultat
  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  console.log(`  ${passed}/${total} checks OK`);
  for (const c of checks) {
    if (!c.pass) console.log(`  ❌ ${c.name}`);
  }

  return {
    ok: passed === total,
    checks: { passed, total },
    details: checks,
    payload: b,
  };
}

async function benchH2H() {
  console.log(`\n📊 Bench H2H Surface — récupération payload détail (top match)`);
  
  // 1. Récupérer d'abord le TOP 10 pour avoir un matchId
  const top10res = await fetchJson(`${BASE_URL}/api/v1/tennis/top10?mode=viewer`);
  if (!top10res.ok || !Array.isArray(top10res.body.top10) || top10res.body.top10.length === 0) {
    console.log('  ❌ Impossible de récupérer le TOP 10 pour tester H2H');
    return { ok: false, error: 'top10_empty' };
  }

  const matchIds = top10res.body.top10.map(c => c.matchId).filter(Boolean);
  if (matchIds.length === 0) {
    console.log('  ❌ Aucun matchId disponible');
    return { ok: false, error: 'no_match_id' };
  }

  console.log(`  🎾 ${matchIds.length} matchIds disponibles pour test H2H`);

  const times = [];
  let errors = 0;
  let h2hPresent = 0;
  let h2hMissing = 0;

  for (const matchId of matchIds.slice(0, 5)) {  // max 5 pour éviter de spam
    const result = await fetchJson(`${BASE_URL}/api/v1/tennis/detail/${encodeURIComponent(matchId)}`);
    if (!result.ok) { errors++; continue; }
    times.push(result.ms);
    
    // Vérifier la présence de données H2H surface
    const hasElo = result.body.elo_p1 != null || result.body.elo_p2 != null;
    const hasPowerScore = result.body.powerscore_p1 != null || result.body.ps_rank != null;
    const hasL10 = result.body.l10_pts != null;
    const hasH2h = result.body.tournament_history != null || (result.body.h2h && result.body.h2h.length > 0);
    
    if (hasElo && hasPowerScore) h2hPresent++;
    else h2hMissing++;
  }

  if (times.length === 0) {
    console.log(`  ❌ Échec : ${errors} erreurs`);
    return { ok: false, errors };
  }

  console.log(`  ✅ Succès : ${times.length}  |  Échecs : ${errors}`);
  console.log(`  📉 Min  : ${fmtMs(min(times))}`);
  console.log(`  📊 P50  : ${fmtMs(median(times))}`);
  console.log(`  📈 Max  : ${fmtMs(max(times))}`);
  console.log(`  📊 Moy  : ${fmtMs(mean(times))}`);
  console.log(`  🏓 H2H surface présent : ${h2hPresent}/${times.length}`);

  return {
    ok: true,
    iterations: times.length,
    errors,
    h2hPresent,
    h2hMissing,
    min_ms: min(times),
    p50_ms: median(times),
    max_ms: max(times),
    avg_ms: mean(times),
  };
}

async function checkH2HIntegrity() {
  console.log(`\n🔍 Vérification intégrité H2H Surface`);

  const top10res = await fetchJson(`${BASE_URL}/api/v1/tennis/top10?mode=viewer`);
  if (!top10res.ok || !Array.isArray(top10res.body.top10) || top10res.body.top10.length === 0) {
    console.log('  ⚠️ TOP 10 vide — vérification H2H impossible');
    return { ok: false };
  }

  const matchId = top10res.body.top10[0].matchId;
  if (!matchId) {
    console.log('  ⚠️ Pas de matchId');
    return { ok: false };
  }

  const result = await fetchJson(`${BASE_URL}/api/v1/tennis/detail/${encodeURIComponent(matchId)}`);
  if (!result.ok) {
    console.log(`  ❌ Route /tennis/detail inaccessible (HTTP ${result.status})`);
    return { ok: false };
  }

  const b = result.body;
  const checks = [];

  // Vérifier les champs H2H
  checks.push({ name: 'elo_p1 présent', pass: b.elo_p1 != null });
  checks.push({ name: 'elo_p2 présent', pass: b.elo_p2 != null });
  checks.push({ name: 'l5_pts présent', pass: b.l5_pts != null });
  checks.push({ name: 'l10_pts présent', pass: b.l10_pts != null });
  checks.push({ name: 'ps_rank présent', pass: b.ps_rank != null });
  checks.push({ name: 'ps_total présent', pass: b.ps_total != null });
  checks.push({ name: 'player1/2 name', pass: !!b.player1 && !!b.player2 });
  checks.push({ name: 'surface présente', pass: !!b.surface });
  checks.push({ name: 'tournament_history', pass: b.tournament_history != null });

  const passed = checks.filter(c => c.pass).length;
  const total = checks.length;
  console.log(`  ${passed}/${total} checks H2H OK`);
  for (const c of checks) {
    if (!c.pass) console.log(`  ⚠️  ${c.name} — manquant ou null`);
  }

  return { ok: passed === total, checks: { passed, total } };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  PariScore — Benchmark Performance TOP 10 Tennis');
  console.log(`  Serveur : ${BASE_URL}`);
  console.log(`  Date    : ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════');

  const args = process.argv.slice(2);
  const isQuick = args.includes('--quick');
  const onlyH2H = args.includes('--h2h');
  const asJson = args.includes('--json');
  const iterations = isQuick ? QUICK_ITERATIONS : DEFAULT_ITERATIONS;

  // 1. Health check
  console.log(`\n🏥 Health check...`);
  try {
    const hc = await fetchJson(`${BASE_URL}/api/v1/status`);
    if (hc.ok) {
      console.log(`  ✅ Serveur OK (${fmtMs(hc.ms)})`);
    } else {
      console.log(`  ❌ Serveur répond mais HTTP ${hc.status}`);
    }
  } catch (e) {
    console.log(`  ❌ Serveur injoignable : ${e.message}`);
    console.log(`  ▶  Lance d'abord : node server.js`);
    process.exit(1);
  }

  const results = { date: new Date().toISOString(), base_url: BASE_URL };

  // 2. Bench TOP 10
  if (!onlyH2H) {
    results.viewer = await benchTop10('viewer', iterations);
    results.bettor = await benchTop10('bettor', iterations);
    results.integrity_viewer = await checkTop10Integrity('viewer');
    results.integrity_bettor = await checkTop10Integrity('bettor');
  }

  // 3. Bench H2H Surface (H10)
  results.h2h_bench = await benchH2H();
  results.h2h_integrity = await checkH2HIntegrity();

  // 4. Summary
  const viewerOk = results.viewer && results.viewer.ok;
  const bettorOk = results.bettor && results.bettor.ok;
  const h2hOk = results.h2h_bench && results.h2h_bench.ok;
  const integrityOk = results.integrity_viewer && results.integrity_viewer.ok
    && results.integrity_bettor && results.integrity_bettor.ok;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════');
  if (viewerOk) {
    const v = results.viewer;
    console.log(`  ✅ TOP 10 viewer  : P50=${fmtMs(v.p50_ms)}  P95=${fmtMs(v.p95_ms)}  Max=${fmtMs(v.max_ms)}`);
  }
  if (bettorOk) {
    const b = results.bettor;
    console.log(`  ✅ TOP 10 bettor  : P50=${fmtMs(b.p50_ms)}  P95=${fmtMs(b.p95_ms)}  Max=${fmtMs(b.max_ms)}`);
  }
  if (h2hOk) {
    const h = results.h2h_bench;
    console.log(`  ✅ H2H Surface    : P50=${fmtMs(h.p50_ms)}  Présent=${h.h2hPresent}/${h.iterations}`);
  }
  console.log(`  ✅ Intégrité      : ${integrityOk ? 'OK' : 'ÉCHEC'}`);

  // 5. Critères validation backlog
  console.log('\n📋 Critères de validation (backlog.md):');
  if (viewerOk) {
    const v = results.viewer;
    console.log(`  [${v.min_ms <= 100 ? '✅' : '❌'}] TOP 10 cache hit < 100ms (min=${fmtMs(v.min_ms)})`);
    console.log(`  [${v.p95_ms < 5000 ? '✅' : '❌'}] TOP 10 cache miss < 5s (p95=${fmtMs(v.p95_ms)})`);
  } else {
    console.log('  ❌ Bench viewer non disponible');
  }
  console.log(`  [${integrityOk ? '✅' : '❌'}] Zéro "Données indisponibles"`);

  if (asJson) {
    console.log('\n--- JSON OUTPUT ---');
    console.log(JSON.stringify(results, null, 2));
  }

  const allOk = viewerOk && bettorOk && h2hOk && integrityOk;
  process.exit(allOk ? 0 : 1);
}

main().catch(err => {
  console.error('Bench fatal:', err);
  process.exit(1);
});
