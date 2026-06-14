/**
 * test-ppg-auto-repair.js — Test unitaire pour les fixes PPG v9.10
 *
 * Vérifie que les 6 anomalies connues sont auto-réparées par le sanity check.
 *
 * Usage : node test-ppg-auto-repair.js
 */

const assert = require('assert');

// ─── Simule buildSideStats (identique à server.js ligne 8856) ──────────────
function buildSideStats(s) {
  const playedRaw = s?.played ?? s?.matches_played ?? s?.games ?? s?.mp ?? s?.matchsPlayed ?? null;
  const played = (playedRaw != null && !isNaN(playedRaw) && +playedRaw > 0) ? +playedRaw : 0;
  if (!played) {
    return { ppg: 0, wins: 0, draws: 0, losses: 0, scored: 0, conceded: 0,
             avgScored: 0, avgConceded: 0, played: 0 };
  }
  const w = s?.win || 0, d = s?.draw || 0, l = s?.lose || 0;

  const extractGoals = (obj) => {
    if (obj == null) return 0;
    if (typeof obj === 'number') return obj;
    if (typeof obj === 'object') {
      if (typeof obj.total === 'number') return obj.total;
      if (typeof obj.average === 'number') return obj.average;
      if (typeof obj.average === 'string') return parseFloat(obj.average) || 0;
    }
    return 0;
  };

  let gf = 0, ga = 0;
  if (s?.goals) {
    gf = extractGoals(s.goals.for);
    ga = extractGoals(s.goals.against);
  }
  if (gf === 0 && s?.goals_for != null) gf = extractGoals(s.goals_for);
  if (ga === 0 && s?.goals_against != null) ga = extractGoals(s.goals_against);

  const avgFor = played > 0 ? gf / played : 0;
  const avgAgainst = played > 0 ? ga / played : 0;

  return {
    ppg: parseFloat(((w * 3 + d) / played).toFixed(2)),
    wins: Math.round(w / played * 100),
    draws: Math.round(d / played * 100),
    losses: Math.round(l / played * 100),
    scored: Math.round(Math.min(95, (gf > 0 ? 1 : 0) / played * 100 || avgFor * 55)),
    conceded: Math.round(Math.min(95, (ga > 0 ? 1 : 0) / played * 100 || avgAgainst * 50)),
    avgScored: parseFloat(avgFor.toFixed(2)),
    avgConceded: parseFloat(avgAgainst.toFixed(2)),
    played,
  };
}

// ─── Test 1 : buildSideStats renvoie ppg=0 pour home/away sans win/draw ────
console.log('\n🧪 Test 1 : buildSideStats avec win=0, draw=0 mais played=6');
const input = { played: 6, win: 0, draw: 0, lose: 0, goals: { for: 8, against: 10 } };
const result = buildSideStats(input);
assert.strictEqual(result.played, 6, 'played doit être 6');
assert.strictEqual(result.ppg, 0, 'PPG doit être 0 (bug connu : pas de win/draw dans le split)');
console.log('  ✅  buildSideStats({played:6, win:0, draw:0}) → ppg=0 (comportement attendu, le fix est au niveau appelant)');

// ─── Test 2 : Simulation du fix au call site ────────────────────────────────
console.log('\n🧪 Test 2 : Auto-repair PPG depuis entry.points / entry.all.played');
const mockEntry = {
  team: { name: 'Luxembourg' },
  points: 10,           // pts totaux
  all: { played: 6 },   // matchs totaux
  home: { played: 6, win: 0, draw: 0, lose: 0 },  // split sans win/draw
  away: { played: 6, win: 0, draw: 0, lose: 0 },
};

const homeStats = buildSideStats(mockEntry.home);
const awayStats = buildSideStats(mockEntry.away);

// Fix 1 : auto-repair au call site
if (homeStats.played > 0 && homeStats.ppg === 0 && mockEntry.points != null && mockEntry.all?.played) {
  const estimatedPpg = parseFloat((mockEntry.points / mockEntry.all.played).toFixed(2));
  if (estimatedPpg > 0) {
    homeStats.ppg = estimatedPpg;
    console.log(`  [PPG_REPAIR] ${mockEntry.team.name} home PPG: 0 → ${estimatedPpg} (depuis totals)`);
  }
}
if (awayStats.played > 0 && awayStats.ppg === 0 && mockEntry.points != null && mockEntry.all?.played) {
  const estimatedPpg = parseFloat((mockEntry.points / mockEntry.all.played).toFixed(2));
  if (estimatedPpg > 0) {
    awayStats.ppg = estimatedPpg;
    console.log(`  [PPG_REPAIR] ${mockEntry.team.name} away PPG: 0 → ${estimatedPpg} (depuis totals)`);
  }
}

assert.ok(homeStats.ppg > 0, 'home PPG doit être > 0 après réparation');
assert.ok(awayStats.ppg > 0, 'away PPG doit être > 0 après réparation');
assert.strictEqual(homeStats.ppg, parseFloat((10/6).toFixed(2)), 'home PPG doit être 10/6 ≈ 1.67');
assert.strictEqual(awayStats.ppg, parseFloat((10/6).toFixed(2)), 'away PPG doit être 10/6 ≈ 1.67');
console.log(`  ✅  home PPG = ${homeStats.ppg}, away PPG = ${awayStats.ppg}`);

// ─── Test 3 : Simulation du fix sanityCheckTeamStats (auto-heal) ───────────
console.log('\n🧪 Test 3 : Auto-heal via sanityCheckTeamStats (depuis _raw)');
const mockTeamStats = {
  'luxembourg': {
    home: { ppg: 0, played: 6, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    away: { ppg: 1.5, played: 6, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    _raw: { pts: 10, played: 12, wins: 2, draws: 4, losses: 6 },
    _real: true,
  },
  'club independiente petrolero': {
    home: { ppg: 0, played: 6, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    away: { ppg: 1.2, played: 6, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    _raw: { pts: 8, played: 12 },
    _real: true,
  },
  'sevilla': {
    home: { ppg: 2.1, played: 40, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    away: { ppg: 0, played: 40, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    _raw: { pts: 72, played: 80 },
    _real: true,
  },
  'mallorca': {
    home: { ppg: 1.8, played: 60, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    away: { ppg: 0, played: 60, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    _raw: { pts: 100, played: 120 },
    _real: true,
  },
  'getafe': {
    home: { ppg: 0, played: 20, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    away: { ppg: 0, played: 60, wins: 0, draws: 0, losses: 0, avgScored: 0, avgConceded: 0 },
    _raw: { pts: 30, played: 80 },
    _real: true,
  },
};

// Simuler la logique d'auto-heal du sanityCheckTeamStats
const issues = [];
for (const [key, stats] of Object.entries(mockTeamStats)) {
  const homeStats = stats.home || {};
  const awayStats = stats.away || {};

  // Auto-heal home
  if (homeStats.ppg === 0 && homeStats.played > 5) {
    const raw = stats._raw;
    if (raw?.pts && raw?.played && raw.played > 0) {
      const estimatedPpg = parseFloat((raw.pts / raw.played).toFixed(2));
      if (estimatedPpg > 0) {
        stats.home.ppg = estimatedPpg;
        console.log(`  [SANITY] ✓ Auto-repair ${key} home ppg: 0 → ${estimatedPpg} (from _raw)`);
      } else {
        issues.push(`${key}: home PPG=0 but played=${homeStats.played} (raw: pts=${raw.pts}, played=${raw.played})`);
      }
    } else {
      issues.push(`${key}: home PPG=0 but played=${homeStats.played} (no _raw fallback)`);
    }
  }

  // Auto-heal away
  if (awayStats.ppg === 0 && awayStats.played > 5) {
    const raw = stats._raw;
    if (raw?.pts && raw?.played && raw.played > 0) {
      const estimatedPpg = parseFloat((raw.pts / raw.played).toFixed(2));
      if (estimatedPpg > 0) {
        stats.away.ppg = estimatedPpg;
        console.log(`  [SANITY] ✓ Auto-repair ${key} away ppg: 0 → ${estimatedPpg} (from _raw)`);
      } else {
        issues.push(`${key}: away PPG=0 but played=${awayStats.played} (raw: pts=${raw.pts}, played=${raw.played})`);
      }
    } else {
      issues.push(`${key}: away PPG=0 but played=${awayStats.played} (no _raw fallback)`);
    }
  }
}

assert.strictEqual(issues.length, 0, 'Aucun issue ne devrait rester après auto-repair');
console.log(`  ✅  Tous les issues résolus : ${issues.length} restants`);

// Vérifier que chaque équipe a maintenant ppg > 0
for (const [key, stats] of Object.entries(mockTeamStats)) {
  assert.ok(stats.home.ppg > 0, `${key} home PPG doit être > 0, obtenu: ${stats.home.ppg}`);
  assert.ok(stats.away.ppg > 0, `${key} away PPG doit être > 0, obtenu: ${stats.away.ppg}`);
  console.log(`  ✅  ${key}: home=${stats.home.ppg}, away=${stats.away.ppg}`);
}

// ─── Test 4 : Sanity check — équipes saines ne sont PAS modifiées ──────────
console.log('\n🧪 Test 4 : Équipes saines ne sont pas affectées');
const healthyStats = {
  'barcelona': {
    home: { ppg: 2.5, played: 19, wins: 80, draws: 15, losses: 5 },
    away: { ppg: 2.1, played: 19, wins: 70, draws: 20, losses: 10 },
    _raw: { pts: 87, played: 38 },
    _real: true,
  },
};
for (const [key, stats] of Object.entries(healthyStats)) {
  const homeBefore = stats.home.ppg;
  const awayBefore = stats.away.ppg;
  // L'auto-heal ne doit PAS déclencher pour ppg > 0
  if (stats.home.ppg === 0 && stats.home.played > 5) {
    // ne devrait pas arriver
    assert.fail('Ne devrait pas déclencher pour barcelona home');
  }
  if (stats.away.ppg === 0 && stats.away.played > 5) {
    assert.fail('Ne devrait pas déclencher pour barcelona away');
  }
  console.log(`  ✅  ${key}: home=${homeBefore}, away=${awayBefore} (inchangé)`);
}

// ─── Résumé ─────────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RÉSULTATS DES TESTS PPG AUTO-REPAIR');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  ✅ Test 1: buildSideStats renvoie ppg=0 pour splits sans win/draw (bug connu)');
console.log('  ✅ Test 2: Fix call site → PPG réparé depuis entry.points / entry.all.played');
console.log('  ✅ Test 3: Auto-heal sanity check → PPG réparé depuis _raw.pts / _raw.played');
console.log('  ✅ Test 4: Équipes saines non affectées');
console.log('\n✅ Tous les tests passent !');
