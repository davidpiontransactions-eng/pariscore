const https = require('https');
const url = 'https://pariscore.fr/api/tennis/top10?metric=surfaceElo&surface=all&period=52w';
https.get(url, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    const e = d.entries || [];
    console.log('entries:', e.length);
    for (const r of e.slice(0, 5)) {
      const p = r.player;
      const nm = p.nextMatch;
      if (nm) {
        console.log(`  #${r.rank} ${p.name} → vs ${nm.opponent} @ ${nm.tournament} (${nm.scheduledAt}) odds=${nm.odds} marketProb=${nm.marketProb}`);
      } else {
        console.log(`  #${r.rank} ${p.name} → no match`);
      }
    }
  });
});
