const { chromium } = require('./.opencode/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  console.log('=== STEP 1: goto ===');
  await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
  console.log('OK: page loaded');
  
  console.log('=== STEP 2: proxy setup ===');
  const https = require('https');
  let proxyCalled = false;
  await page.route('**/generativelanguage.googleapis.com/**', async (route) => {
    proxyCalled = true;
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' } });
    }
    const urlObj = new URL(req.url().replace('//chat', '/chat'));
    const postBody = req.postData();
    console.error('  Proxy: relaying', urlObj.pathname, 'method:', req.method());
    console.error('  Proxy: auth:', req.headers()['authorization'] ? 'PRESENT' : 'MISSING');
    try {
      const response = await new Promise((resolve, reject) => {
        const opts = { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody || ''), ...(req.headers()['authorization'] ? { 'Authorization': req.headers()['authorization'] } : {}) } };
        const backend = https.request(opts, (res) => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
        backend.on('error', reject);
        if (postBody) backend.write(postBody);
        backend.end();
      });
      console.error('  Proxy: Gemini status', response.status);
      await route.fulfill({ status: response.status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: response.body });
    } catch(e) {
      console.error('  Proxy: error', e.message);
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({error: 'Proxy: '+e.message}) });
    }
  });
  console.log('OK: proxy registered');
  
  console.log('=== STEP 3: inject CDN ===');
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js?autoInit=false' });
  await page.waitForFunction(() => typeof window.PageAgent === 'function', { timeout: 15000 });
  console.log('OK: PageAgent constructor ready');
  
  console.log('=== STEP 4: waitForLoadState ===');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => console.log('  (networkidle timeout - continuing)'));
  console.log('OK: load state stable');
  
  console.log('=== STEP 5: create instance ===');
  const createResult = await page.evaluate((apiKey) => {
    try {
      const inst = new window.PageAgent({ baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', model: 'gemini-2.5-flash', apiKey: apiKey, language: 'en-US' });
      window.__pageAgent = inst;
      return { ok: true, hasExecute: typeof inst.execute === 'function' };
    } catch(e) { return { ok: false, error: e.message }; }
  }, process.env.GEMINI_API_KEY);
  console.log('Create:', JSON.stringify(createResult));
  
  console.log('=== STEP 6: execute command ===');
  try {
    const execResult = await page.evaluate(async (cmd) => {
      if (!window.__pageAgent) return { success: false, error: 'No instance' };
      try {
        window.__pageAgentResult = 'running...';
        const output = await window.__pageAgent.execute(cmd);
        window.__pageAgentResult = 'done';
        return { success: true, message: typeof output === 'string' ? output : JSON.stringify(output) };
      } catch(e) {
        window.__pageAgentResult = 'error: '+e.message;
        return { success: false, error: e.message || String(e) };
      }
    }, 'dis moi bonjour en 5 mots');
    console.log('Execute:', JSON.stringify(execResult));
  } catch(e) {
    console.log('Execute FAILED:', e.message);
    // Check if proxy was called
    console.log('Proxy was called:', proxyCalled);
  }
  
  await browser.close();
  console.log('=== DONE ===');
})().catch(e => { console.error('FATAL:', e.message, e.stack?.split('\n').slice(0,5).join('\n')); process.exit(1); });
