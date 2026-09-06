const https = require('https');
// Test the lookup directly via the API with debug info
https.get('https://pariscore.fr/api/tennis/top10?metric=surfaceElo&surface=all&period=52w', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    const e = d.entries || [];
    console.log('Source matches:', d.meta?.source);
    for (const r of e) {
      const p = r.player;
      const nm = p.nextMatch;
      console.log(`#${r.rank} ${p.name}: elo=${p.elo} se=${p.surfaceElo} form=${p.form?.join('') || 'none'} serve=${p.serveWonPct || '-'} opp=${nm?.opponent || '-'}`);
    }
  });
});
