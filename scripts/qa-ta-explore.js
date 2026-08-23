// scripts/qa-ta-explore.js - explore tennisabstract structure: profile links + match log page shape
(async () => {
  const ATP_URL = 'https://tennisabstract.com/reports/atp_elo_ratings.html';
  const res = await fetch(ATP_URL);
  const html = await res.text();
  console.log('ATP status', res.status, 'len', html.length);

  // 1. Extract profile links from the Elo table
  const links = [...html.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map((m) => ({ href: m[1], name: m[2].trim() }))
    .filter((l) => /player|atp_elo|match/i.test(l.href));
  console.log('player-ish links:', links.length, 'unique hrefs:', new Set(links.map((l) => l.href)).size);
  console.log('first 5:', JSON.stringify(links.slice(0, 5)));
  // distinct href patterns
  const pats = [...new Set(links.map((l) => l.href.replace(/[0-9]/g, '#').split('/').pop()))];
  console.log('href patterns:', pats.slice(0, 10));

  // 2. Try the first profile page
  if (links.length) {
    const href = links[0].href;
    const url = href.startsWith('http') ? href : 'https://tennisabstract.com' + (href.startsWith('/') ? href : '/reports/' + href);
    console.log('probe profile:', url);
    const pr = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const phtml = await pr.text();
    console.log('profile status', pr.status, 'len', phtml.length);
    // look for match log markers
    for (const pat of ['match', 'Match', 'Win', 'Loss', 'Surface', 'Hard', 'Clay', 'Grass', 'opponent', 'Opponent', 'W-L', 'results', 'Results']) {
      const count = (phtml.match(new RegExp(pat, 'g')) || []).length;
      if (count > 0) console.log('  marker "' + pat + '":', count);
    }
    // find tables
    const tables = phtml.match(/<table[\s\S]*?<\/table>/g) || [];
    console.log('  tables:', tables.length);
    if (tables.length) {
      const head = tables[0].replace(/<[^>]+>/g, '|').replace(/\s*\|\s*/g, ' | ').replace(/\s+/g, ' ').trim().slice(0, 300);
      console.log('  table[0] head:', head);
    }
  }
})();