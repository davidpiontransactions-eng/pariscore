'use strict';
// Probe F1 data sources (zero-dep) — ESPN racing/f1 + Jolpica-Ergast. Free, no quota.
const https = require('https');
function get(host, path) {
  return new Promise((res) => {
    const req = https.request({ host, path, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) {} res({ status: r.statusCode, len: d.length, json: j, raw: d.slice(0, 240) }); });
    });
    req.on('error', e => res({ status: 0, err: e.message }));
    req.setTimeout(12000, () => { req.destroy(); res({ status: 0, err: 'timeout' }); });
    req.end();
  });
}
(async () => {
  const sb = await get('site.api.espn.com', '/apis/site/v2/sports/racing/f1/scoreboard');
  console.log('ESPN scoreboard:', sb.status, 'keys:', sb.json ? Object.keys(sb.json).join(',') : sb.raw);
  if (sb.json) { const ev = (sb.json.events || [])[0]; console.log('  event0:', ev ? JSON.stringify({ name: ev.name, date: ev.date, status: ev.status && ev.status.type && ev.status.type.state, comps: (ev.competitions || []).length }) : null); if (ev && ev.competitions && ev.competitions[0]) { const c = ev.competitions[0]; console.log('  comp0 keys:', Object.keys(c).join(','), '| competitors:', (c.competitors || []).length); const cp = (c.competitors || [])[0]; if (cp) console.log('  competitor0:', JSON.stringify({ order: cp.order, athlete: cp.athlete && cp.athlete.displayName, team: cp.team && cp.team.name })); } }

  const st = await get('site.api.espn.com', '/apis/v2/sports/racing/f1/standings');
  console.log('ESPN standings:', st.status, 'keys:', st.json ? Object.keys(st.json).join(',') : st.raw);

  const drv = await get('api.jolpi.ca', '/ergast/f1/current/driverStandings.json');
  console.log('Jolpica driverStandings:', drv.status);
  if (drv.json) { const t = drv.json.MRData.StandingsTable.StandingsLists[0]; console.log('  season:', t && t.season, 'round:', t && t.round, 'drivers:', t && t.DriverStandings && t.DriverStandings.length); const d0 = t && t.DriverStandings && t.DriverStandings[0]; console.log('  drv0:', d0 ? JSON.stringify({ pos: d0.position, pts: d0.points, wins: d0.wins, code: d0.Driver.code, name: d0.Driver.familyName, team: d0.Constructors && d0.Constructors[0] && d0.Constructors[0].name }) : null); }

  const q = await get('api.jolpi.ca', '/ergast/f1/current/last/qualifying.json');
  if (q.json) { const r = q.json.MRData.RaceTable.Races[0]; console.log('Jolpica last quali:', q.status, 'race:', r && r.raceName, 'circuit:', r && r.Circuit && r.Circuit.circuitId, 'round:', r && r.round, 'q:', r && r.QualifyingResults && r.QualifyingResults.length); const q0 = r && r.QualifyingResults && r.QualifyingResults[0]; console.log('  q0:', q0 ? JSON.stringify({ pos: q0.position, drv: q0.Driver.code, Q1: q0.Q1, Q2: q0.Q2, Q3: q0.Q3 }) : null); }

  const rs = await get('api.jolpi.ca', '/ergast/f1/current/last/results.json');
  if (rs.json) { const r = rs.json.MRData.RaceTable.Races[0]; console.log('Jolpica last results:', rs.status, 'race:', r && r.raceName, 'res:', r && r.Results && r.Results.length); const x = r && r.Results && r.Results[0]; console.log('  res0:', x ? JSON.stringify({ pos: x.position, drv: x.Driver.code, grid: x.grid, status: x.status, pts: x.points }) : null); const dnf = (r && r.Results || []).filter(z => z.status && !/Finished|\+\d+ Lap/.test(z.status)).map(z => z.Driver.code + ':' + z.status); console.log('  DNF-ish:', dnf.join(' | ')); }

  const sched = await get('api.jolpi.ca', '/ergast/f1/current.json');
  if (sched.json) { const races = sched.json.MRData.RaceTable.Races || []; const now = '2026-06-07'; const next = races.find(r => r.date >= now); console.log('Jolpica schedule:', sched.status, 'races:', races.length, 'next:', next ? JSON.stringify({ round: next.round, name: next.raceName, date: next.date, circuit: next.Circuit.circuitId }) : 'season-end'); }
})();
