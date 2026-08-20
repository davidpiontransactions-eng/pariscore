(async () => {
  const r = await fetch('https://pariscore.fr/api/football/live');
  const j = await r.json();
  const ms = (j.matches || []).filter((m) => m.live && (m.live.homeShots > 0 || m.live.awayShots > 0 || m.live.homePossession));
  console.log('total:', j.matches.length, 'avec stats:', ms.length);
  ms.slice(0, 3).forEach((m) => {
    const l = m.live;
    console.log(m.home.name, 'vs', m.away.name, '| min', l.minute, '| poss', l.homePossession, '| shots', l.homeShots + '/' + l.awayShots, '| sot', l.homeShotsOnTarget + '/' + l.awayShotsOnTarget, '| cor', l.homeCorners + '/' + l.awayCorners, '| xg', m.prediction?.xGa?.total);
  });
})();