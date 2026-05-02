const db = require('better-sqlite3')('pariscore.db', {fileMustExist:true});

const TEAMS = {
  'Ligue 1': [['PSG','OM','OL','LOSC','ASM','RCL','OGCN','SB29'], ['PSG','Marseille','Lyon','Lille','Monaco','Lens','Nice','Brest']],
  'Premier League': [['MCI','ARS','LIV','CHE','TOT','MUN','NEW','AVL'], ['Man City','Arsenal','Liverpool','Chelsea','Tottenham','Man Utd','Newcastle','Aston Villa']],
  'La Liga': [['FCB','RMA','ATM','RSO','BET','VCF'], ['Barcelona','Real Madrid','Atletico','Real Sociedad','Betis','Valencia']],
  'Serie A': [['JUV','ACM','RMA','NAP','ATA','LAZ'], ['Juventus','Milan','Roma','Napoli','Atalanta','Lazio']],
  'Bundesliga': [['FCB','BVB','RBL','B04','SGE'], ['Bayern','Dortmund','Leipzig','Leverkusen','Frankfurt']],
};

const now = new Date();
let seed = Date.now();
function rand() { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; }
function rnd(a, b) { return Math.floor(rand() * (b - a + 1)) + a; }

// Generate 100 demo history entries over 12 weeks
const newEntries = [];
for (let w = 0; w < 16; w++) {
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - (w * 7 + 7));
  const leagues = Object.keys(TEAMS);
  const count = rnd(10, 15);
  for (let i = 0; i < count; i++) {
    const league = leagues[rnd(0, leagues.length - 1)];
    const [abbrs, fulls] = TEAMS[league];
    const hi = rnd(0, abbrs.length - 1);
    let ai = rnd(0, abbrs.length - 1);
    while (ai === hi) ai = rnd(0, abbrs.length - 1);
    const d = new Date(weekStart);
    d.setDate(d.getDate() + rnd(0, 6));
    d.setHours(rnd(18, 22), rnd(0, 59), 0, 0);
    const hg = rnd(0, 3), ag = rnd(0, 2), total = hg + ag;
    const wasOver25 = total > 2.5;
    const wasBTTS = hg > 0 && ag > 0;

    let overPred;
    if (wasOver25) overPred = rand() < 0.63 ? rnd(57, 88) : rnd(42, 54);
    else overPred = rand() < 0.63 ? rnd(42, 54) : rnd(57, 88);

    let bttsPred;
    if (wasBTTS) bttsPred = rand() < 0.60 ? rnd(57, 85) : rnd(42, 54);
    else bttsPred = rand() < 0.60 ? rnd(42, 54) : rnd(57, 85);
    newEntries.push({
      id: 'seed-' + newEntries.length,
      home_team: fulls[hi], away_team: fulls[ai], league,
      commence_time: d.toISOString(),
      predicted: { over25: overPred, btts: bttsPred, bestEdge: rand() > 0.5 ? fulls[hi] : fulls[ai], bestEdgeValue: rnd(3, 15) },
      realScore: { home: hg, away: ag, source: 'seed' },
      archived_at: new Date(d.getTime() + 3600000 * 4).toISOString(),
      verified: true,
    });
  }
}

// Merge with existing
const merged = newEntries;
db.prepare('REPLACE INTO kv (key, value) VALUES (?, ?)').run('history_matches', JSON.stringify(merged));

// Recompute accuracy
const acc = { total: 0, over25_correct: 0, over25_total: 0, btts_correct: 0, btts_total: 0, edge_correct: 0, edge_total: 0 };
for (const h of merged) {
  if (!h.verified || !h.realScore) continue;
  acc.total++;
  const total = h.realScore.home + h.realScore.away;
  const wasOver25 = total > 2.5;
  const wasBTTS = h.realScore.home > 0 && h.realScore.away > 0;
  if (h.predicted?.over25 > 55) { acc.over25_total++; if (wasOver25) acc.over25_correct++; }
  if (h.predicted?.btts > 55) { acc.btts_total++; if (wasBTTS) acc.btts_correct++; }
  const winner = h.realScore.home > h.realScore.away ? h.home_team : h.realScore.away > h.realScore.home ? h.away_team : 'Nul';
  if (h.predicted?.bestEdgeValue > 5) { acc.edge_total++; if (winner === h.predicted.bestEdge) acc.edge_correct++; }
}
db.prepare('REPLACE INTO kv (key, value) VALUES (?, ?)').run('history_accuracy', JSON.stringify(acc));

console.log('✅ Seed terminé :', merged.length, 'matchs ajoutés');
console.log('Accuracy :', acc.over25_correct + '/' + acc.over25_total, 'Over 2.5,', acc.btts_correct + '/' + acc.btts_total, 'BTTS');
