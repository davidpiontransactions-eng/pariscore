const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function extractJsonVars(html) {
  const out = {};
  const re = /var\s+(\w+)\s*=\s*JSON\.parse\(\s*'((?:\\.|[^'\\])*)'\s*\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1];
    let raw = m[2];
    raw = raw.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    raw = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    try {
      out[name] = JSON.parse(raw);
    } catch (e) {
      out[name] = { _error: e.message.slice(0, 100) };
    }
  }
  return out;
}

(async () => {
  const tests = [
    'https://understat.com/match/29473',
    'https://understat.com/league/EPL/2025',
    'https://understat.com/team/Arsenal/2025',
    'https://understat.com/player/2371',
  ];
  for (const url of tests) {
    const r = await fetchHtml(url);
    console.log('\n=== ' + url + ' | HTTP ' + r.status + ' size:' + r.body.length + ' ===');
    const vars = extractJsonVars(r.body);
    for (const k of Object.keys(vars)) {
      const v = vars[k];
      if (Array.isArray(v)) console.log(' ', k, '→ array(' + v.length + ')', v.length ? 'sample keys: ' + Object.keys(v[0] || {}).slice(0, 8).join(',') : '');
      else if (v && typeof v === 'object') console.log(' ', k, '→ object, keys:', Object.keys(v).slice(0, 12).join(','));
      else console.log(' ', k, '→', typeof v);
    }
  }
})();
