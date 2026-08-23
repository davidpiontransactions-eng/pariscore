// scripts/qa-ta-sabalenka.js - demo L10 Surface for Sabalenka vs Bejlek (Cincinnati, hard)
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
    out.push({
      name, href: link[1],
      elo: num(cells[3]), hElo: num(cells[6]), cElo: num(cells[8]), gElo: num(cells[10]),
    });
  }
  return out;
};

(async () => {
  const res = await fetch(WTA_URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const players = parseTable(html);
  console.log('WTA players:', players.length);

  for (const target of ['Sabalenka', 'Bejlek']) {
    const p = players.find((x) => x.name.toLowerCase().includes(target.toLowerCase()));
    if (!p) { console.log('NOT FOUND:', target); continue; }
    console.log('\n=== ' + p.name + ' ===');
    console.log('elo=' + p.elo, 'hElo=' + p.hElo, 'cElo=' + p.cElo, 'gElo=' + p.gElo, 'href=' + p.href);
    // fetch profile page
    const url = p.href.startsWith('http') ? p.href : 'https://tennisabstract.com' + p.href;
    const pr = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const phtml = await pr.text();
    console.log('profile status', pr.status, 'len', phtml.length);
    // find match-log tables
    const tables = phtml.match(/<table[\s\S]*?<\/table>/gs) || [];
    console.log('tables:', tables.length);
    // inspect each table header to find match log with surfaces
    tables.forEach((t, i) => {
      const txt = t.replace(/<[^>]+>/g, '|').replace(/&nbsp;/g, ' ').replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim();
      const head = txt.slice(0, 140);
      console.log('  table[' + i + '] head: ' + head);
    });
    fs.writeFileSync('scripts/tmp-' + target.toLowerCase() + '.html', phtml);
  }
})();