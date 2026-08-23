// scripts/qa-ta-l10-demo2.js - FIXED date parse + full L10 HARD for Sabalenka vs Bejlek
const fs = require('fs');
const WTA_URL = 'https://tennisabstract.com/reports/wta_elo_ratings.html';
const NOW = new Date('2026-08-20T12:00:00Z');
const CUTOFF = new Date(NOW.getTime() - 93 * 86400e3);

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseDate(s) {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mo = MONTHS[m[2]];
  if (mo === undefined) return null;
  return new Date(Date.UTC(+m[3], mo, +m[1]));
}

async function fetchJsfrag(name) {
  const res = await fetch(`https://www.tennisabstract.com/jsfrags/${name}.js`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  return res.text();
}

function extractAllRows(src) {
  const out = [];
  for (const tb of src.match(/<tbody>([\s\S]*?)<\/tbody>/gs) || []) {
    for (const rm of tb.match(/<tr>([\s\S]*?)<\/tr>/gs) || []) {
      const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells || cells.length < 8) continue;
      const date = cells[0].replace(/<[^>]+>/g, '').trim();
      if (!parseDate(date)) continue;
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
      out.push({ date, dateObj: parseDate(date), surface, rd, bold, opp, oppKey, result, score });
    }
  }
  // dedupe (recent-finals overlaps recent-results)
  const seen = new Set();
  return out.filter((r) => {
    const k = r.date + '|' + r.rd + '|' + r.opp + '|' + r.score;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const pointsFor = (d) => d <= 50 ? 1 : d <= 100 ? 3 : d <= 150 ? 5 : d <= 200 ? 7 : 10;

let eloByKey = {};
(async () => {
  const eloHtml = await (await fetch(WTA_URL, { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
  const tbody = eloHtml.match(/<tbody>([\s\S]*?)<\/tbody>/);
  for (const rm of [...tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]) {
    const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 17) continue;
    const link = cells[1].match(/href="([^"]+)"/);
    const nameA = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/);
    if (!link || !nameA) continue;
    const key = (link[1].match(/p=([^&]+)/) || [])[1] || '';
    const num = (s) => parseFloat(s.replace(/<[^>]+>/g, '').replace(/[^0-9.\-]/g, '')) || 0;
    eloByKey[key] = { name: nameA[1].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').trim(), elo: num(cells[3]), hElo: num(cells[6]), cElo: num(cells[8]), gElo: num(cells[10]) };
  }
  console.log('WTA elo map:', Object.keys(eloByKey).length, 'players');

  for (const [key, label] of [['ArynaSabalenka', 'Sabalenka'], ['SaraBejlek', 'Bejlek']]) {
    const src = await fetchJsfrag(key);
    const rows = extractAllRows(src);
    const me = eloByKey[key];
    const oppKey = key === 'ArynaSabalenka' ? 'SaraBejlek' : 'ArynaSabalenka';
    const hard = rows
      .filter((r) => r.surface === 'Hard' && r.result !== 'LIVE' && r.result !== '?' && r.oppKey !== oppKey)
      .filter((r) => !/Walkover/i.test(r.score))
      .filter((r) => r.dateObj >= CUTOFF)
      .sort((a, b) => b.dateObj - a.dateObj)
      .slice(0, 10);
    console.log('\n########## ' + label + ' — L10 HARD (fenêtre: depuis ' + CUTOFF.toISOString().slice(0, 10) + ') ##########');
    console.log('Elo dur actuel:', me.hElo, '| matchs hard dans fenêtre:', hard.length, '/ 10');
    let pts = 0, wins = 0;
    for (const r of hard) {
      const oppElo = eloByKey[r.oppKey]?.hElo ?? null;
      const diff = oppElo != null ? oppElo - me.hElo : null;
      const p = r.result === 'WIN' && diff != null ? pointsFor(diff) : 0;
      if (r.result === 'WIN') wins++;
      pts += p;
      console.log(`  ${r.date} ${r.rd.padEnd(4)} ${(r.result === 'WIN' ? 'W' : 'L').padEnd(2)} vs ${(r.opp || '').padEnd(24)} oppElo=${String(oppElo ?? '?').padEnd(7)} diff=${String(diff ?? '?').padEnd(7)} pts=${p} score=${r.score}`);
    }
    console.log(`  ===> ${label} L10 HARD = ${pts} pts (${wins}/${hard.length} victoires)`);
  }
})();