(async () => {
  for (const p of ['/api/football/live', '/api/football/matches']) {
    try {
      const r = await fetch('https://pariscore.fr' + p);
      const t = await r.text();
      console.log(p, r.status, t.slice(0, 300));
      console.log('---');
    } catch (e) { console.log(p, 'ERR', e.message); }
  }
})();