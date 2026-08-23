// scripts/qa-ta-l10-final.js - L10 HARD final sur fichiers sauvegardés (Sabalenka vs Bejlek)
const fs = require('fs');
const CUTOFF = new Date('2026-05-19T00:00:00Z');
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseDate(s) {
  const m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const mo = MONTHS[m[2]];
  if (mo === undefined) return null;
  return new Date(Date.UTC(+m[3], mo, +m[1]));
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

const ELO = {
  ArynaSabalenka: { name: 'Aryna Sabalenka', hElo: 2179.4, elo: 2194.6 },
  SaraBejlek: { name: 'Sara Bejlek', hElo: 1759.6, elo: 1782.4 },
  XinYuWang: { name: 'Xin Yu Wang', hElo: 1787.2, elo: 1812.6 },
  TaliaGibson: { name: 'Talia Gibson', hElo: 1612.3, elo: 1648.9 },
  EkaterinaAlexandrova: { name: 'Ekaterina Alexandrova', hElo: 1817.5, elo: 1851.2 },
  ShuaiZhang: { name: 'Shuai Zhang', hElo: 1718.9, elo: 1745.6 },
  MoyukaUchijima: { name: 'Moyuka Uchijima', hElo: 1702.4, elo: 1731.8 },
  AmandaAnisimova: { name: 'Amanda Anisimova', hElo: 1763.1, elo: 1802.4 },
  AnnaBlinkova: { name: 'Anna Blinkova', hElo: 1708.7, elo: 1739.2 },
  VarvaraLepchenko: { name: 'Varvara Lepchenko', hElo: 1604.5, elo: 1622.1 },
  MirraAndreeva: { name: 'Mirra Andreeva', hElo: 1895.2, elo: 1921.8 },
  JasminePaolini: { name: 'Jasmine Paolini', hElo: 1832.8, elo: 1865.4 },
  BarboraKrejcikova: { name: 'Barbora Krejcikova', hElo: 1785.3, elo: 1812.9 },
  NadiaPodoroska: { name: 'Nadia Podoroska', hElo: 1652.8, elo: 1678.3 },
  GreetMinnen: { name: 'Greet Minnen', hElo: 1640.1, elo: 1665.7 },
  JuleNiemeier: { name: 'Jule Niemeier', hElo: 1661.4, elo: 1690.2 },
  OliviaGadecki: { name: 'Olivia Gadecki', hElo: 1598.3, elo: 1627.5 },
  CamilaOsorio: { name: 'Camila Osorio', hElo: 1621.9, elo: 1651.2 },
  JaquelineCristian: { name: 'Jaqueline Cristian', hElo: 1668.4, elo: 1695.8 },
  DariaSaville: { name: 'Daria Saville', hElo: 1635.7, elo: 1661.2 },
  YuliaPutintseva: { name: 'Yulia Putintseva', hElo: 1725.6, elo: 1758.3 },
};

(async () => {
  for (const [key, label] of [['ArynaSabalenka', 'Sabalenka'], ['SaraBejlek', 'Bejlek']]) {
    const src = fs.readFileSync(`scripts/tmp-${key}.js`, 'utf8');
    const rows = extractAllRows(src);
    const me = ELO[key];
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
      const oppElo = ELO[r.oppKey]?.hElo ?? (r.opp ? '?' : '?');
      const diff = typeof oppElo === 'number' ? Math.round(oppElo - me.hElo) : null;
      const p = r.result === 'WIN' && diff != null ? pointsFor(diff) : 0;
      if (r.result === 'WIN') wins++;
      pts += p;
      console.log(`  ${r.date} ${r.rd.padEnd(4)} ${(r.result === 'WIN' ? 'W' : 'L')} vs ${(r.opp || '').padEnd(26)} oppElo=${String(oppElo).padEnd(7)} diff=${String(diff ?? '?').padEnd(6)} pts=${p}  ${r.score}`);
    }
    console.log(`  ===> ${label} L10 HARD = ${pts} pts (${wins}/${hard.length} victoires)`);
  }
})();