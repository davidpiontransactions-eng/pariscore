const https = require('https');
https.get('https://pariscore.fr/api/tennis/top10?metric=surfaceElo&surface=all&period=52w', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    const e = d.entries || [];
    for (const r of e.slice(0, 5)) {
      const p = r.player;
      console.log(`#${r.rank} ${p.name}: elo=${p.elo} surfaceElo=${p.surfaceElo} serve=${p.serveWonPct} return=${p.returnWonPct} tiebreak=${p.tiebreaksWonPct} momentum=${p.momentumScore} form=${p.form?.join('')} nextMatch=${p.nextMatch?.opponent || 'none'}`);
    }
  });
});
