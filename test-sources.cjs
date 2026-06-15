const https = require('https');
const http = require('http');
const dns = require('dns');

dns.setServers(['1.1.1.1', '8.8.8.8']);

const TIMEOUT = 10000;

function fetch(url, extraHeaders = {}, bodyMax = 1000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      ...extraHeaders,
    };
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
      rejectUnauthorized: false,
      timeout: TIMEOUT,
      lookup: (host, opts, cb) => dns.resolve4(host, (err, addresses) => {
        if (err) return cb(err);
        cb(null, addresses[0], 4);
      }),
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; if (data.length > bodyMax) { data = data.slice(0, bodyMax); req.destroy(); } });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, headers: {}, body: '', error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, headers: {}, body: '', error: 'TIMEOUT' }); });
    req.end();
  });
}

function log(url, r, note) {
  const cf = {};
  if (r.headers) for (const [k, v] of Object.entries(r.headers)) if (k.toLowerCase().startsWith('cf-') || k.toLowerCase().startsWith('x-')) cf[k] = v;
  const statusStr = r.status === 0 ? `ERR[${r.error}]` : String(r.status);
  const icon = r.status === 200 ? 'OK' : r.status === 0 ? 'ERR' : String(r.status);
  const b = (r.body || '').toLowerCase();
  let extra = note || '';
  if (b.includes('cloudflare')) extra += ' [body: cloudflare]';
  if (b.includes('just a moment')) extra += ' [body: "just a moment"]';
  if (b.includes('captcha')) extra += ' [body: captcha]';
  if (b.includes('challenge')) extra += ' [body: challenge]';
  if (b.includes('access denied')) extra += ' [body: access denied]';
  console.log(`  [${icon}] ${url}`);
  if (Object.keys(cf).length) console.log(`         Headers: ${JSON.stringify(cf)}`);
  if (extra) console.log(`         ${extra}`);
  if (r.status === 200) console.log(`         Body (${r.body.length} chars): ${r.body.slice(0, 300)}`);
}

async function main() {
  console.log('=== FOOTBALL STATS SOURCE VIABILITY TEST ===');
  console.log(`Using DNS: 1.1.1.1, 8.8.8.8\n`);

  // ========== 1XBET.COM ==========
  console.log('--- 1XBET.COM ---');
  let r = await fetch('https://1xbet.com/');
  log('https://1xbet.com/', r, 'Cloudflare expected');
  
  r = await fetch('https://1xbet.com/LiveFeed/Game/GetGame?lng=en&sports=1&count=1&mode=4');
  log('https://1xbet.com/LiveFeed/Game/GetGame(...)', r, 'API: GetGame');
  
  r = await fetch('https://1xbet.com/LiveFeed/Stats/GetStats?lng=en&sports=1&gameId=1');
  log('https://1xbet.com/LiveFeed/Stats/GetStats(...)', r, 'API: GetStats');

  // ========== ODDSALERT ==========
  console.log('\n--- ODDSALERT ---');
  r = await fetch('https://www.oddsalert.com/');
  log('https://www.oddsalert.com/', r, '');
  
  r = await fetch('https://www.oddsalert.com/api/v1/sports');
  log('https://www.oddsalert.com/api/v1/sports', r, 'API: v1/sports');
  
  r = await fetch('https://www.oddsalert.com/api/v1/odds?league=1');
  log('https://www.oddsalert.com/api/v1/odds?league=1', r, 'API: v1/odds');
  
  r = await fetch('https://www.oddsalert.com/lander');
  log('https://www.oddsalert.com/lander', r, '');

  // ========== FLASHSCORE ==========
  console.log('\n--- FLASHSCORE ---');
  r = await fetch('https://www.flashscore.com/');
  log('https://www.flashscore.com/', r, '');
  
  // Try an XHR API endpoint with proper headers
  r = await fetch('https://www.flashscore.com/x/feed/1_test', {
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://www.flashscore.com/',
  });
  log('https://www.flashscore.com/x/feed/...', r, 'XHR feed');
  
  r = await fetch('https://www.flashscore.com/api/', {
    'X-Requested-With': 'XMLHttpRequest',
  });
  log('https://www.flashscore.com/api/', r, 'API endpoint');

  // ========== FOOTYSTATS ==========
  console.log('\n--- FOOTYSTATS ---');
  r = await fetch('https://footystats.org/');
  log('https://footystats.org/', r, '');
  
  r = await fetch('https://footystats.org/matches/');
  log('https://footystats.org/matches/', r, '');
  
  r = await fetch('https://footystats.org/api/matches');
  log('https://footystats.org/api/matches', r, 'API');

  // ========== WHOSCORED ==========
  console.log('\n--- WHOSCORED ---');
  r = await fetch('https://www.whoscored.com/');
  log('https://www.whoscored.com/', r, '');
  
  r = await fetch('https://www.whoscored.com/Matches/');
  log('https://www.whoscored.com/Matches/', r, '');

  // ========== SUMMARY ==========
  console.log('\n==================================');
  console.log('SUMMARY');
  console.log('==================================');
  const ACC = r => r.status === 200;
  const BLK = r => r.status !== 200;
  console.log(`\nAccessible: ${[...arguments].length}`);
  console.log(`Blocked: ${[...arguments].length}`);
}

main().catch(e => console.error('Fatal:', e));
