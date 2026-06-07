'use strict';
// Résout photos pilotes (Wikipedia REST thumbnail) + logos écuries (Wikidata P154)
// via les URLs Wikipedia fournies par Jolpica/Ergast. Zero-dep. Écrit data/f1_assets.json.
const https = require('https'), fs = require('fs'), path = require('path');
function get(host, p) {
  return new Promise(r => {
    const q = https.request({ host, path: p, headers: { 'User-Agent': 'PariScore/1.0 (contact: dev@pariscore.fr)', 'Accept': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { r({ s: res.statusCode, j: JSON.parse(d) }); } catch (e) { r({ s: res.statusCode, j: null }); } });
    });
    q.on('error', () => r({ s: 0 })); q.setTimeout(15000, () => { q.destroy(); r({ s: 0 }); }); q.end();
  });
}
function title(u, name) { if (u) { const m = /\/wiki\/(.+)$/.exec(u); if (m) return decodeURIComponent(m[1]); } return name; }
function enc(t) { return encodeURIComponent(t.replace(/ /g, '_')); }
(async () => {
  const st = await get('api.jolpi.ca', '/ergast/f1/current/driverStandings.json');
  const list = st.j.MRData.StandingsTable.StandingsLists[0].DriverStandings;
  const out = { _src: 'wikipedia-rest + wikidata-P154', _generated: new Date().toISOString(), drivers: {}, teams: {} };
  for (const d of list) {
    const code = d.Driver.code || d.Driver.driverId;
    const name = (d.Driver.givenName + ' ' + d.Driver.familyName).trim();
    const t = title(d.Driver.url, name);
    const sum = await get('en.wikipedia.org', '/api/rest_v1/page/summary/' + enc(t));
    const photo = (sum.j && sum.j.thumbnail && sum.j.thumbnail.source) || null;
    out.drivers[code] = { name: name, photo: photo };
    console.log('DRV', code, name, photo ? 'OK' : '--');
  }
  const teams = {};
  for (const d of list) { const c = d.Constructors && d.Constructors[0]; if (c && !teams[c.constructorId]) teams[c.constructorId] = { name: c.name, url: c.url }; }
  for (const id in teams) {
    const t = teams[id];
    const sum = await get('en.wikipedia.org', '/api/rest_v1/page/summary/' + enc(title(t.url, t.name)));
    const qid = sum.j && sum.j.wikibase_item;
    let logo = null;
    if (qid) {
      const cl = await get('www.wikidata.org', '/w/api.php?action=wbgetclaims&entity=' + qid + '&property=P154&format=json');
      const claims = cl.j && cl.j.claims && cl.j.claims.P154;
      const fn = claims && claims[0] && claims[0].mainsnak && claims[0].mainsnak.datavalue && claims[0].mainsnak.datavalue.value;
      if (fn) logo = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(fn) + '?width=200';
    }
    out.teams[id] = { name: t.name, qid: qid || null, logo: logo };
    console.log('TEAM', id, t.name, logo ? 'OK' : ('-- (qid ' + (qid || '?') + ')'));
  }
  // Logos confirmés sur Commons pour les écuries dont l'entité Wikidata n'a pas de claim P154.
  const COMMONS = { mercedes: 'Mercedes-AMG Petronas F1 Team logo (2026).svg', red_bull: 'RED BULL LOGO 2026.svg' };
  for (const id in COMMONS) if (out.teams[id] && !out.teams[id].logo) out.teams[id].logo = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(COMMONS[id]) + '?width=200';
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'f1_assets.json'), JSON.stringify(out, null, 1));
  console.log('\nWROTE data/f1_assets.json — drivers', Object.keys(out.drivers).length, 'teams', Object.keys(out.teams).length);
})();
