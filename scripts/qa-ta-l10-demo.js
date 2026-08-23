// scripts/qa-ta-l10-demo.js - FULL L10 HARD for Sabalenka vs Bejlek (Cincinnati R16, live 2026-08-13)
const fs = require('fs');
const WTA_URL = 'https://tennisabstract.com/reports/wta_elo_ratings.html';
const now = new Date('2026-08-20T12:00:00Z');
const CUTOFF = new Date(now.getTime() - 93 * 86400e3); // 3 derniers mois

async function fetchJsfrag(name) {
  const url = `https://www.tennisabstract.com/jsfrags/${name}.js`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  return res.text();
}

function extractAllRows(src) {
  const out = [];
  for (const tb of src.match(/<tbody>([\s\S]*?)<\/tbody>/gs) || []) {
    for (const rm of tb.match(/<tr>([\s\S]*?)<\/tr>/gs) || []) {
      const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
      if (!cells || cells.length < 8) continue;
      const date = cells[0].replace(/<[^>]+>/g, '').trim();
      if (!/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(date)) continue;
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
      out.push({ date, surface, rd, bold, opp, oppKey, result, score });
    }
  }
  return out;
}

const pointsFor = (d) => d <= 50 ? 1 : d <= 100 ? 3 : d <= 150 ? 5 : d <= 200 ? 7 : 10;

function computeL10(rows, meKey, meElo, surface, oppKeyToExclude) {
  const cands = rows
    .filter((r) => r.surface === surface && r.result !== '?' && r.result !== 'LIVE')
    .filter((r) => !r.score.includes('Walkover') && !r.score.includes('Walkover'))
    .filter((r) => new Date(r.date) >= CUTOFF)
    .filter((r) => r.oppKey !== oppKeyToExclude)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
  let pts = 0, wins = 0;
  const details = cands.map((r) => {
    const oppElo = eloByKey[r.oppKey]?.hElo ?? null;
    const diff = oppElo != null ? oppElo - meElo : null;
    const p = r.result === 'WIN' && diff != null ? pointsFor(diff) : 0;
    if (r.result === 'WIN') wins++;
    pts += p;
    return { ...r, oppElo, diff, p };
  });
  return { cands, details, pts, wins };
}

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
    const res = computeL10(rows, key, me.hElo, 'Hard', key === 'ArynaSabalenka' ? 'SaraBejlek' : 'ArynaSabalenka');
    console.log('\n########## ' + label + ' — L10 HARD ##########');
    console.log('Elo dur actuel:', me.hElo, '| matches hard in window (3mo):', res.cands.length);
    for (const d of res.details) {
      console.log(`  ${d.date} ${d.rd.padEnd(4)} ${(d.result === 'WIN' ? 'W' : 'L')} vs ${(d.opp || '').padEnd(24)} oppElo=${String(d.oppElo ?? '?').padEnd(7)} diff=${String(d.diff ?? '?').padEnd(7)} pts=${d.p} score=${d.score}`);
    }
    console.log(`  ===> ${label} L10 HARD = ${res.pts} pts (${res.wins}/${res.details.length} victoires)`);
  }
})();