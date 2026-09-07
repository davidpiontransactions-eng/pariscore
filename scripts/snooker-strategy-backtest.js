// Backtest des stratégies snooker sur l'historique SnookerMatch (SQLite pariscore.db)
// Objectif : identifier les stratégies avec taux de réussite prévisionnel >= 65%
// Usage : node scripts/snooker-strategy-backtest.js
const Database = require('better-sqlite3');

// 1. Inventaire des tables snooker (teste plusieurs chemins de DB)
const CANDIDATE_DBS = ['pariscore.db', 'prisma/dev.db', 'prisma.db'];
let db = null;
let dbPath = null;
for (const f of CANDIDATE_DBS) {
  try {
    const d = new Database(f, { readonly: true });
    const t = d
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%nooker%'"
      )
      .all();
    console.log('DB', f, '-> tables snooker:', JSON.stringify(t));
    if (t.length > 0 && !db) {
      db = d;
      dbPath = f;
    } else if (!db) {
      d.close();
    }
  } catch (e) {
    console.log('DB', f, 'ERREUR', e.message.slice(0, 80));
  }
}
if (!db) {
  console.error('Aucune DB avec tables snooker trouvée');
  process.exit(1);
}
console.log('DB retenue:', dbPath);

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%nooker%')"
  )
  .all();
console.log('=== Tables snooker ===');
for (const t of tables) {
  const c = db.prepare('SELECT COUNT(*) AS n FROM "' + t.name + '"').get();
  console.log(t.name, '=', c.n);
}

// 2. Historique de matchs finis
let matches = [];
try {
  matches = db
    .prepare(
      "SELECT id, playerAId, playerBId, bestOf, scoreA, scoreB, winnerId, scheduledAt, tournament, round, status FROM SnookerMatch WHERE status='finished' ORDER BY scheduledAt"
    )
    .all();
} catch (e) {
  console.log('Erreur SnookerMatch:', e.message);
}
console.log('\n=== Matchs finis ===', matches.length);

if (matches.length > 0) {
  const players = {};
  for (const p of db.prepare('SELECT id, name, ranking, winPct, eloRating FROM SnookerPlayer').all()) {
    players[p.id] = p;
  }

  // Stratégie S1: favori Elo (eloRating supérieur) gagne
  // Stratégie S2: favori classement officiel (ranking inférieur = meilleur)
  // Stratégie S3: over frames (total frames >= bestOf - 1) vs under
  let s1ok = 0, s1n = 0, s2ok = 0, s2n = 0, s3over = 0, s3n = 0, s3dec = 0;
  for (const m of matches) {
    if (!m.winnerId) continue;
    const a = players[m.playerAId];
    const b = players[m.playerBId];
    if (!a || !b) continue;

    // S1 : favori Elo
    const fav = a.eloRating >= b.eloRating ? a : b;
    const favWon = m.winnerId === fav.id;
    if (a.eloRating !== b.eloRating) { s1n++; if (favWon) s1ok++; }

    // S2 : favori ranking officiel (1 = meilleur)
    if (a.ranking && b.ranking && a.ranking !== b.ranking) {
      const favR = a.ranking < b.ranking ? a : b;
      if (m.winnerId === favR.id) s2ok++;
      s2n++;
    }

    // S3 : total frames vs bestOf
    const total = m.scoreA + m.scoreB;
    const maxFrames = Math.floor(m.bestOf / 2) + 1 + Math.min(m.scoreA, m.scoreB);
    if (total >= m.bestOf - 1) s3dec++; // match décisionnel (écart 1 frame ou décisif)
    s3n++;
    void maxFrames;
  }
  console.log('\nS1 favori Elo      :', s1ok + '/' + s1n, s1n ? ((100 * s1ok) / s1n).toFixed(1) + '%' : 'n/a');
  console.log('S2 favori ranking  :', s2ok + '/' + s2n, s2n ? ((100 * s2ok) / s2n).toFixed(1) + '%' : 'n/a');
  console.log('Matchs décisionnels:', s3dec + '/' + s3n, s3n ? ((100 * s3dec) / s3n).toFixed(1) + '%' : 'n/a');
}

// 3. Analyse Bradley-Terry : proba du favori par écart de classement
// Conversion : win% carrière (rétréci) -> force via odds-ratio
// P(A bat B) = fA(1-fB) / (fA(1-fB) + fB(1-fA))
const RAW = require('../data/cuetracker_matches.json');
const players = RAW.players;
const SHRINK_N = 20;
const baseRate = 0.5;

function strength(p) {
  const n = p.matches_played || 0;
  const w = p.wins || 0;
  const shrunk = (w + SHRINK_N * baseRate) / (n + SHRINK_N);
  const odds = shrunk / (1 - shrunk); // cote de force
  return Math.log(odds); // échelle logit
}

function probA(sA, sB) {
  // Bradley-Terry sur échelle logit : P = 1/(1+e^(sB-sA))
  return 1 / (1 + Math.exp(sB - sA));
}

const BUCKETS = [
  { label: 'Top 4  vs 65+', test: (a, b) => (a.ranking <= 4 && b.ranking >= 65) || (b.ranking <= 4 && a.ranking >= 65) },
  { label: 'Top 8  vs 33-64', test: (a, b) => (a.ranking <= 8 && b.ranking >= 33 && b.ranking <= 64) || (b.ranking <= 8 && a.ranking >= 33 && a.ranking <= 64) },
  { label: 'Top 16 vs 33-64', test: (a, b) => (a.ranking <= 16 && b.ranking >= 33 && b.ranking <= 64) || (b.ranking <= 16 && a.ranking >= 33 && a.ranking <= 64) },
  { label: 'Top 16 vs 17-32', test: (a, b) => (a.ranking <= 16 && b.ranking >= 17 && b.ranking <= 32) || (b.ranking <= 16 && a.ranking >= 17 && a.ranking <= 32) },
  { label: 'Top 16 vs Top 16', test: (a, b) => a.ranking <= 16 && b.ranking <= 16 },
  { label: 'Top 8  vs Top 8', test: (a, b) => a.ranking <= 8 && b.ranking <= 8 },
];

console.log('\n=== Proba favori par bucket (Bradley-Terry sur win% carrière, n=4100) ===');
const rows = [];
for (const bk of BUCKETS) {
  const probs = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      if (!a.ranking || !b.ranking || !bk.test(a, b)) continue;
      const pA = probA(strength(a), strength(b));
      probs.push(Math.max(pA, 1 - pA)); // favori
    }
  }
  if (probs.length === 0) continue;
  const mean = probs.reduce((s, x) => s + x, 0) / probs.length;
  const ge65 = probs.filter((x) => x >= 0.65).length / probs.length;
  const ge70 = probs.filter((x) => x >= 0.7).length / probs.length;
  rows.push({ label: bk.label, n: probs.length, mean, ge65, ge70 });
  console.log(
    bk.label.padEnd(20),
    'n=' + String(probs.length).padStart(6),
    'moy=' + (100 * mean).toFixed(1) + '%',
    '>=65%: ' + (100 * ge65).toFixed(0) + '%',
    '>=70%: ' + (100 * ge70).toFixed(0) + '%'
  );
}

// 4. Math binomiale frames : taux des marchés dérivés selon la force du favori
// Bo9 : le favori gagne chaque frame avec p_frame
console.log('\n=== Marchés dérivés (binomiale frames) ===');
function boN(p, N) {
  // N = nombre de frames gagnantes (bestOf = 2N-1)
  // retourne { pMatch, pHandicapMoins15 (gagne par >=2 d'écart), pUnder75 (décidé en <= N+1 frames), pOver }
  let pMatch = 0, pMargin2 = 0, pDecided7 = 0;
  // somme sur tous les scores finaux
  for (let myW = 0; myW <= N; myW++) {
    for (let opW = 0; opW <= N; opW++) {
      if (myW === N && opW === N) continue;
      if (myW < N && opW < N) continue; // pas un score final
      // proba exacte : le dernier frame est gagné par le vainqueur
      const w = Math.max(myW, opW);
      const l = Math.min(myW, opW);
      const pW = myW > opW ? p : 1 - p;
      // C(w+l-1, l) * pW^w * (1-pW)^l
      let comb = 1;
      for (let k = 0; k < l; k++) comb = (comb * (w + l - 1 - k)) / (k + 1);
      const prob = comb * Math.pow(pW, w) * Math.pow(1 - pW, l);
      pMatch += myW > opW ? prob : 0;
      if (Math.abs(myW - opW) >= 2) pMargin2 += prob;
      if (w + l <= N + 1) pDecided7 += prob;
    }
  }
  return { pMatch, pMargin2, pDecided7 };
}

console.log('p_frame | Bo9: match | hcp -1.5 | under 7.5 |  Bo19: match | hcp -2.5 | under 14.5');
for (const p of [0.5, 0.53, 0.55, 0.58, 0.6, 0.62, 0.65]) {
  const b9 = boN(p, 5);   // best of 9
  const b19 = boN(p, 10); // best of 19
  const b19m2 = { pMargin2: b19.pMatch - boN(p, 10).pDecided7 }; // approximation non utilisée
  console.log(
    p.toFixed(2) + '    | ' +
    (100 * b9.pMatch).toFixed(1) + '%     | ' +
    (100 * b9.pMargin2).toFixed(1) + '%    | ' +
    (100 * b9.pDecided7).toFixed(1) + '%      | ' +
    (100 * b19.pMatch).toFixed(1) + '%        | ' +
    '—        | ' +
    (100 * b19.pDecided7).toFixed(1) + '%'
  );
  void b19m2;
}

