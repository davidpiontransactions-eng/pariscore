/**
 * inject-test-history.js
 * Injecte 5 matchs fictifs dans history_matches pour tester le rendu du graphique P&L.
 * Usage : node scripts/inject-test-history.js
 * Relancez le serveur après pour voir les données.
 */

const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'pariscore.db');
const sqldb = new Database(DB_PATH);

function kvGet(key, fallback = null) {
  const row = sqldb.prepare('SELECT value FROM kv WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

function kvSet(key, value) {
  sqldb.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

// ─── Matchs fictifs ──────────────────────────────────────────────────────────
// Dates étalées sur 5 jours (J-5 à J-1) pour que le graphique ait de l'allure
function isoDate(daysAgo, hour = 20) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const TEST_MATCHES = [
  {
    id: 'test-hist-001',
    home_team: 'PSG', away_team: 'Olympique Lyonnais',
    league: 'Ligue 1', sport: 'soccer_france_ligue1',
    commence_time: isoDate(5, 21),
    predicted: { over25: 72, btts: 65, bestEdge: 'PSG', bestEdgeValue: 6.1 },
    realScore: { home: 3, away: 1 },   // Over ✓, BTTS ✓
    archived_at: isoDate(5, 23),
    verified: true,
  },
  {
    id: 'test-hist-002',
    home_team: 'Arsenal', away_team: 'Chelsea',
    league: 'Premier League', sport: 'soccer_epl',
    commence_time: isoDate(4, 20),
    predicted: { over25: 63, btts: 58, bestEdge: 'Arsenal', bestEdgeValue: 3.8 },
    realScore: { home: 1, away: 0 },   // Over ✗, BTTS ✗
    archived_at: isoDate(4, 22),
    verified: true,
  },
  {
    id: 'test-hist-003',
    home_team: 'Real Madrid', away_team: 'Atletico Madrid',
    league: 'La Liga', sport: 'soccer_spain_la_liga',
    commence_time: isoDate(3, 21),
    predicted: { over25: 78, btts: 70, bestEdge: 'Real Madrid', bestEdgeValue: 4.5 },
    realScore: { home: 2, away: 2 },   // Over ✓, BTTS ✓
    archived_at: isoDate(3, 23),
    verified: true,
  },
  {
    id: 'test-hist-004',
    home_team: 'Bayern Munich', away_team: 'Borussia Dortmund',
    league: 'Bundesliga', sport: 'soccer_germany_bundesliga',
    commence_time: isoDate(2, 18),
    predicted: { over25: 57, btts: 62, bestEdge: 'Bayern Munich', bestEdgeValue: 2.2 },
    realScore: { home: 0, away: 0 },   // Over ✗, BTTS ✗
    archived_at: isoDate(2, 20),
    verified: true,
  },
  {
    id: 'test-hist-005',
    home_team: 'Inter Milan', away_team: 'AC Milan',
    league: 'Serie A', sport: 'soccer_italy_serie_a',
    commence_time: isoDate(1, 20),
    predicted: { over25: 68, btts: 60, bestEdge: 'Inter Milan', bestEdgeValue: 5.7 },
    realScore: { home: 2, away: 1 },   // Over ✓, BTTS ✓
    archived_at: isoDate(1, 22),
    verified: true,
  },
];

// ─── Recalcul accuracy depuis les matchs injectés ────────────────────────────
const existingHistory  = kvGet('history_matches',  []);
const existingAccuracy = kvGet('history_accuracy', {
  total: 0, over25_correct: 0, over25_total: 0,
  btts_correct: 0, btts_total: 0, edge_correct: 0, edge_total: 0,
});

// Filtrer les doublons (si déjà injectés)
const existingIds = new Set(existingHistory.map(m => m.id));
const newMatches  = TEST_MATCHES.filter(m => !existingIds.has(m.id));

if (!newMatches.length) {
  console.log('  ℹ Tous les matchs de test sont déjà présents dans la DB. Rien à faire.');
  sqldb.close();
  process.exit(0);
}

const acc = { ...existingAccuracy };

for (const m of newMatches) {
  const { realScore, predicted } = m;
  const totalGoals = realScore.home + realScore.away;
  const wasBTTS    = realScore.home > 0 && realScore.away > 0;
  const wasOver25  = totalGoals > 2.5;

  if (predicted.over25 > 55) {
    acc.over25_total++;
    if (wasOver25) acc.over25_correct++;
  }
  if (predicted.btts > 55) {
    acc.btts_total++;
    if (wasBTTS) acc.btts_correct++;
  }
  if (predicted.bestEdgeValue > 5) {
    acc.edge_total++;
    const winner = realScore.home > realScore.away ? m.home_team : realScore.away > realScore.home ? m.away_team : 'Nul';
    if (winner === predicted.bestEdge) acc.edge_correct++;
  }
  acc.total++;
}

const mergedHistory = [...existingHistory, ...newMatches]
  .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));

sqldb.transaction(() => {
  kvSet('history_matches',  mergedHistory);
  kvSet('history_accuracy', acc);
})();

sqldb.close();

console.log(`  ✓ ${newMatches.length} matchs de test injectés dans history_matches`);
console.log(`  ✓ Accuracy recalculée :`, acc);
console.log('\n  → Relancez le serveur : node server.js');
console.log('  → Puis ouvrez l\'onglet "Historique" pour voir le graphique P&L.\n');
