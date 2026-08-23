// scripts/qa-ta-sabalenka2.js - find match-log endpoints + Bejlek entry
const fs = require('fs');
const WTA_URL = 'https://tennisabstract.com/reports/wta_elo_ratings.html';
const parseTable = (html) => {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbody) throw new Error('no tbody');
  const rows = [...tbody[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
  const out = [];
  for (const rm of rows) {
    const cells = rm[1].match(/<td[^>]*>[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 17) continue;
    const nameA = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/);
    const link = cells[1].match(/href="([^"]+)"/);
    if (!nameA || !link) continue;
    const name = nameA[1].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const num = (s) => parseFloat(s.replace(/<[^>]+>/g, '').replace(/[^0-9.\-]/g, '')) || 0;
    out.push({ name, href: link[1], elo: num(cells[3]), hElo: num(cells[6]), cElo: num(cells[8]), gElo: num(cells[10]) });
  }
  return out;
};
(async () => {
  const res = await fetch(WTA_URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const players = parseTable(await res.text());
  const bejlek = players.filter((p) => /bejlek/i.test(p.name));
  console.log('BEJLEK:', JSON.stringify(bejlek));

  // Sabalenka profile page: find data endpoints
  const pr = await fetch('https://www.tennisabstract.com/cgi-bin/wplayer.cgi?p=ArynaSabalenka', { headers: { 'user-agent': 'Mozilla/5.0' } });
  const phtml = await pr.text();
  const urls = [...new Set([...phtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => /cgi|json|matches|matchlog|\.js/.test(u)))];
  console.log('DATA URLs:', urls.slice(0, 20));
  // look for player variable / JSON blobs
  const jsonBlobs = phtml.match(/var\s+\w+\s*=\s*\{[^;]{0,120}/g) || [];
  console.log('var blobs:', jsonBlobs.slice(0, 4).map((s) => s.slice(0, 120)));
  fs.writeFileSync('scripts/tmp-sabalenka.html', phtml);
  console.log('saved profile html len', phtml.length);
})();