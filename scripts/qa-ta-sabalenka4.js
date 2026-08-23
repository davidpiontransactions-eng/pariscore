// scripts/qa-ta-sabalenka4.js - analyze win/loss patterns + compute L10 hard for Sabalenka & Bejlek
const fs = require('fs');

function extractRows(jsFile) {
  const src = fs.readFileSync(jsFile, 'utf8');
  const tbody = src.match(/<tbody>([\s\S]*?)<\/tbody>/);
  const rows = [...tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const out = [];
  for (const rm of rows) {
    const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 8) continue;
    const date = cells[0].replace(/<[^>]+>/g, '').trim();
    const tourn = cells[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    const surface = cells[2].replace(/<[^>]+>/g, '').trim();
    const rd = cells[3].replace(/<[^>]+>/g, '').trim();
    const matchCell = cells[6];
    const score = cells[7] ? cells[7].replace(/<[^>]+>/g, '').trim() : '';
    out.push({ date, tourn, surface, rd, matchCell, score });
  }
  return out;
}

function parseMatch(matchCell) {
  // patterns: "<b>Sabalenka</b> vs <a href>Opp</a> [CZE]" | "<b>Sabalenka</b> d. <a>Opp</a>" | "lost to" | "<a>Opp</a> d. <b>Sabalenka</b>"?
  const html = matchCell;
  const b = html.match(/<b>([\s\S]*?)<\/b>/);
  const bold = b ? b[1].replace(/<[^>]+>/g, '').trim() : null;
  const a = html.match(/<a[^>]*>([\s\S]*?)<\/a>/);
  const opp = a ? a[1].replace(/<[^>]+>/g, '').trim() : null;
  const oppHref = a ? (a[0].match(/href="([^"]+)"/) || [])[1] : null;
  let result = null;
  if (/ vs </.test(html) || /\bvs\b/.test(html.replace(/<[^>]+>/g, ' '))) result = 'LIVE';
  else if (/ d\. /.test(html.replace(/<[^>]+>/g, ' '))) result = 'WIN';
  else if (/ lost to /.test(html.replace(/<[^>]+>/g, ' '))) result = 'LOSS';
  else result = '?';
  return { bold, opp, oppHref, result };
}

const players = {
  Sabalenka: { file: 'scripts/tmp-ArynaSabalenka.js', hElo: 2179.4, elo: 2194.6 },
  Bejlek: { file: 'scripts/tmp-SaraBejlek.js', hElo: 1759.6, elo: 1782.4 },
};

const eloMap = {};

for (const [name, p] of Object.entries(players)) {
  const rows = extractRows(p.file);
  console.log('\n===== ' + name + ' (' + rows.length + ' rows total) =====');
  const hard = rows.filter((r) => r.surface === 'Hard');
  console.log('hard rows:', hard.length);
  // sample all result patterns in the file (first 25 rows) to confirm win/loss
  for (const r of rows.slice(0, 25)) {
    const m = parseMatch(r.matchCell);
    console.log('  [' + r.date + ' ' + r.surface + ' ' + r.rd + '] ' + r.score.padEnd(14) + ' ' + m.result.padEnd(5) + ' bold=' + m.bold + ' opp=' + m.opp);
  }
  break; // patterns enough from first player
}