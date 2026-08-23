// scripts/qa-ta-sabalenka5.js - fetch full history + compute L10 hard for Sabalenka & Bejlek
const fs = require('fs');
const WTA_URL = 'https://tennisabstract.com/reports/wta_elo_ratings.html';
const THREE_MONTHS = 93 * 86400e3;
const now = new Date('2026-08-20T12:00:00Z');

const parseEloTable = (html) => {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  const out = {};
  for (const rm of [...tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]) {
    const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 17) continue;
    const nameA = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/);
    const link = cells[1].match(/href="([^"]+)"/);
    if (!nameA || !link) continue;
    const name = nameA[1].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const num = (s) => parseFloat(s.replace(/<[^>]+>/g, '').replace(/[^0-9.\-]/g, '')) || 0;
    const key = (link[1].match(/p=([^&]+)/) || [])[1] || '';
    out[key] = { name, elo: num(cells[3]), hElo: num(cells[6]), cElo: num(cells[8]), gElo: num(cells[10]) };
  }
  return out;
};

const parseRows = (html) => {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbody) return [];
  const out = [];
  for (const rm of [...tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)]) {
    const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 8) continue;
    const date = cells[0].replace(/<[^>]+>/g, '').trim();
    const tourn = cells[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const surface = cells[2].replace(/<[^>]+>/g, '').trim();
    const rd = cells[3].replace(/<[^>]+>/g, '').trim();
    const html = cells[6];
    const score = cells[7] ? cells[7].replace(/<[^>]+>/g, '').trim() : '';
    const b = html.match(/<b>([\s\S]*?)<\/b>/);
    const bold = b ? b[1].replace(/<[^>]+>/g, '').trim() : null;
    const a = html.match(/<a[^>]*>([\s\S]*?)<\/a>/);
    const opp = a ? a[1].replace(/<[^>]+>/g, '').trim() : null;
    const oppKey = a ? ((a[0].match(/p=([^&"]+)/) || [])[1] || '') : '';
    const plain = html.replace(/<[^>]+>/g, ' ');
    let result = / vs /.test(plain) ? 'LIVE' : / d\. /.test(plain) ? 'WIN' : / lost to /.test(plain) ? 'LOSS' : '?';
    out.push({ date, tourn, surface, rd, bold, opp, oppKey, result, score });
  }
  return out;
};

async function fetchHistory(key) {
  const url = `https://www.tennisabstract.com/cgi-bin/wplayer-classic.cgi?p=${key}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  fs.writeFileSync(`scripts/tmp-classic-${key}.html`, html);
  return html;
}

const points = (d) => d <= 50 ? 1 : d <= 100 ? 3 : d <= 150 ? 5 : d <= 200 ? 7 : 10;

(async () => {
  const eloHtml = await (await fetch(WTA_URL, { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
  const eloMap = parseEloTable(eloHtml);

  for (const [key, label] of [['ArynaSabalenka', 'Sabalenka'], ['SaraBejlek', 'Bejlek']]) {
    const hist = parseRows(await fetchHistory(key));
    const me = eloMap[key];
    console.log('\n===== ' + label + ' (elo ' + me.elo + ', hElo ' + me.hElo + ') — history rows: ' + hist.length + ' =====');
    const cutoff = new Date(now.getTime() - THREE_MONTHS);
    const hard = hist
      .filter((r) => r.surface === 'Hard' && !r.score.includes('Walkover') && r.result !== '?')
      .filter((r) => new Date(r.date) >= cutoff)
      .filter((r) => r.result !== 'LIVE' || !r.opp) // exclude the live match vs opponent (no result yet)
      .slice(0, 10);
    // sort by date desc, take first 10 non-live
    const sorted = hist
      .filter((r) => r.surface === 'Hard' && r.result !== 'LIVE' && r.result !== '?')
      .filter((r) => new Date(r.date) >= cutoff)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
    console.log('10 derniers matchs HARD (3 mois):');
    let total = 0, wins = 0;
    for (const r of sorted) {
      const opp = eloMap[r.oppKey];
      const oppElo = opp ? opp.hElo : null;
      const myElo = me.hElo;
      const diff = oppElo !== null ? oppElo - myElo : null;
      const pts = r.result === 'WIN' && diff !== null ? points(diff) : 0;
      if (r.result === 'WIN') wins++;
      total += pts;
      console.log(`  ${r.date} ${r.rd.padEnd(4)} ${(r.result === 'WIN' ? 'W' : 'L').padEnd(2)} vs ${(r.opp || '').padEnd(22)} [${r.surface}] oppElo=${oppElo ?? '?'} diff=${diff ?? '?'} pts=${pts} score=${r.score}`);
    }
    console.log(`  => L10 HARD = ${total} pts, ${wins}/${sorted.length} victoires`);
  }
})();