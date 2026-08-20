// scripts/qa-live-api.js - check live matches via pariscore API
(async () => {
  try {
    const r = await fetch('https://pariscore.fr/api/v1/football/live', { headers: { accept: 'application/json' } });
    const j = await r.json();
    const ms = (Array.isArray(j) ? j : j.matches || j.data || []).slice(0, 6);
    console.log('status:', r.status, 'count:', Array.isArray(j) ? j.length : Object.keys(j).slice(0, 5));
    ms.forEach((m) => {
      console.log(m.home?.name + ' vs ' + m.away?.name, '| minute:', m.live?.minute, '| status:', m.live?.status, '| shots:', m.live?.homeShots, '-', m.live?.awayShots);
    });
  } catch (e) {
    console.log('ERR', e.message);
    try {
      const r2 = await fetch('https://pariscore.fr/api/v1/status');
      console.log('status endpoint:', r2.status, (await r2.text()).slice(0, 200));
    } catch (e2) { console.log('ERR2', e2.message); }
  }
})();