// scripts/qa-ta-l10-final2.js - fetch WTA elo table with retry, save, compute L10 with real values
const fs = require('fs');
const WTA_URL = 'https://tennisabstract.com/reports/wta_elo_ratings.html';
const CUTOFF = new Date('2026-05-19T00:00:00Z');
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseDate(s) {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mo = MONTHS[m[2]];
  if (mo === undefined) return null;
  return new Date(Date.UTC(+m[3], mo, +m[1]));
}
async function fetchWithRetry(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (res.status === 200) {
        const txt = await res.text();
        if (txt.length > 50000) return txt;
      }
      console.log('retry', i + 1, 'status', res.status);
    } catch (e) { console.log('retry err', i + 1, e.message); }
    await new Promise((r2) => setTimeout(r2, 4000 * (i + 1)));
  }
  throw new Error('fetch failed: ' + url);
}
function parseEloTable(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  const out = {};
  for (const rm of [...tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]) {
    const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 17) continue;
    const link = cells[1].match(/href="([^"]+)"/);
    const nameA = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/);
    if (!link || !nameA) continue;
    const key = (link[1].match(/p=([^&]+)/) || [])[1] || '';
    const num = (s) => parseFloat(s.replace(/<[^>]+>/g, '').replace(/[^0-9.\-]/g, '')) || 0;
    out[key] = { name: nameA[1].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').trim(), elo: num(cells[3]), hElo: num(cells[6]), cElo: num(cells[8]), gElo: num(cells[10]) };
  }
  return out;
}
function extractAllRows(src) {
  const out = [];
  for (const tbM of src.matchAll(/<tbody>([\s\S]*?)<\/tbody>/gs)) {
    for (const rm of tbM[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gs)) {
      const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells || cells.length < 8) continue;
      const date = cells[0].replace(/<[^>]+>/g, '').trim();
      const d = parseDate(date);
      if (!d) continue;
      const surface = cells[2].replace(/<[^>]+>/g, '').trim();
      const rd = cells[3].replace(/<[^>]+>/g, '').trim();
      const html = cells[6];
      const score = cells[7] ? cells[7].replace(/<[^>]+>/g, '').trim() : '';
      const b = html.match(/<b>([\s\S]*?)<\/b>/);
      const bold = b ? b[1].replace(/<[^>]+>/g, '').trim() : null;
      const a = html.match(/<a[^>]*>([\s\S]*?)<\/a>/);
      const opp = a ? a[1].replace(/<[^>]+>/g, '').trim() : null;
      const oppKey = a ? ((a[0].match(/p=([^&"']+)/) || [])[1] || '') : '';
      const plain = html.replace(/<[^>]+>/g, ' ');
      const result = / vs /.test(plain) ? 'LIVE' : / d\. /.test(plain) ? 'WIN' : / lost to /.test(plain) ? 'LOSS' : '?';
      out.push({ date, dateObj: d, surface, rd, bold, opp, oppKey, result, score });
    }
  }
  const seen = new Set();
  return out.filter((r) => {
    const k = r.date + '|' + r.rd + '|' + r.opp + '|' + r.score;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const pointsFor = (d) => d <= 50 ? 1 : d <= 100 ? 3 : d <= 150 ? 5 : d <= 200 ? 7 : 10;

(async () => {
  const eloHtml = await fetchWithRetry(WTA_URL);
  const eloByKey = parseEloTable(eloHtml);
  fs.writeFileSync('scripts/tmp-wta-elo.json', JSON.stringify(eloByKey, null, 1));
  console.log('WTA elo map saved:', Object.keys(eloByKey).length, 'players');

  for (const [key, label] of [['ArynaSabalenka', 'Sabalenka'], ['SaraBejlek', 'Bejlek']]) {
    const src = fs.readFileSync(`scripts/tmp-${key}.js`, 'utf8');
    const rows = extractAllRows(src);
    const me = eloByKey[key];
    if (!me) { console.log('ME not in elo map!'); continue; }
    const oppKey = key === 'ArynaSabalenka' ? 'SaraBejlek' : 'ArynaSabalenka';
    const hard = rows
      .filter((r) => r.surface === 'Hard' && r.result !== 'LIVE' && r.result !== '?' && r.oppKey !== oppKey)
      .filter((r) => !/Walkover/i.test(r.score))
      .filter((r) => r.dateObj >= CUTOFF)
      .sort((a, b) => b.dateObj - a.dateObj)
      .slice(0, 10);
    console.log('\n########## ' + label + ' — L10 HARD ##########');
    console.log('Elo dur actuel: ' + me.hElo + ' | matchs hard dans fenêtre 3 mois: ' + hard.length + '/10');
    let pts = 0, wins = 0;
    for (const r of hard) {
      const opp = eloByKey[r.oppKey];
      const oppElo = opp ? opp.hElo : null;
      const diff = oppElo != null ? Math.round(oppElo - me.hElo) : null;
      const p = r.result === 'WIN' && diff != null ? pointsFor(diff) : 0;
      if (r.result === 'WIN') wins++;
      pts += p;
      console.log(`  ${r.date} ${r.rd.padEnd(4)} ${(r.result === 'WIN' ? 'W' : 'L')} vs ${(r.opp || '').padEnd(26)} oppElo=${String(oppElo ?? '?').padEnd(7)} diff=${String(diff ?? '?').padEnd(6)} pts=${p}  ${r.score}`);
    }
    console.log(`  ===> ${label} L10 HARD = ${pts} pts (${wins}/${hard.length} victoires)`);
  }
})();