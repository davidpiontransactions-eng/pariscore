#!/usr/bin/env node
// Test E2E v12.67 (bd c0qo) — Gemini Function Calling + BSD MCP enrichment
// Signe JWT admin local, fetch /api/v1/matches, prend match avec _bsd_event_id,
// puis appelle /api/v1/deep-analysis-stream/:id et verifie presence du bloc
// [CONTEXTE BSD DEEP-DIVE]. Necessite AI_AL_FUNCTION_CALLING=1 dans .env.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

const SECRET = fs.readFileSync('.jwt_secret', 'utf8').trim();
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: 'HS256', typ: 'JWT' });
const body = b64({ userId: 1, username: 'admin', email: 'admin@test.local', role: 'admin', iat: now, exp: now + 600 });
const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
const token = `${header}.${body}.${sig}`;

const get = (path) => new Promise((resolve, reject) => {
  const req = http.request({ host: 'localhost', port: 3000, path, headers: { Authorization: `Bearer ${token}` } }, res => {
    let buf = '';
    res.on('data', c => buf += c.toString());
    res.on('end', () => resolve({ status: res.statusCode, body: buf }));
  });
  req.on('error', reject);
  req.end();
});

const stream = (path) => new Promise((resolve, reject) => {
  const chunks = [];
  const req = http.request({ host: 'localhost', port: 3000, path, headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } }, res => {
    let timer = setTimeout(() => { try { req.destroy(); } catch (_) {} resolve({ status: res.statusCode, chunks, full: chunks.join('') }); }, 60000);
    res.on('data', c => {
      chunks.push(c.toString());
      if (c.toString().includes('event: done')) {
        clearTimeout(timer);
        setTimeout(() => { try { req.destroy(); } catch (_) {} resolve({ status: res.statusCode, chunks, full: chunks.join('') }); }, 200);
      }
    });
    res.on('error', e => { clearTimeout(timer); reject(e); });
    res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, chunks, full: chunks.join('') }); });
  });
  req.on('error', reject);
  req.end();
});

(async () => {
  console.log('== bd c0qo Function Calling E2E ==');
  console.log('NOTE: Necessite AI_AL_FUNCTION_CALLING=1 dans .env, GEMINI_API_KEY actif, et BSD_API_KEY actif');
  console.log();
  const r1 = await get('/api/v1/matches');
  if (r1.status !== 200) { console.error('list matches KO', r1.status); process.exit(1); }
  let matches = [];
  try {
    const data = JSON.parse(r1.body);
    matches = Array.isArray(data) ? data : (data.matches || data.list || []);
  } catch (e) { console.error('parse JSON KO:', e.message); process.exit(1); }
  const withBsd = matches.filter(m => m._bsd_event_id);
  if (withBsd.length === 0) { console.error('aucun match avec _bsd_event_id'); process.exit(1); }
  const target = withBsd[0];
  console.log('target match:', { id: target.id, bsd: target._bsd_event_id, home: target.home_team, away: target.away_team });

  console.log('\n== Stream AI-AL (force=1) ==');
  const r2 = await stream(`/api/v1/deep-analysis-stream/${encodeURIComponent(target.id)}?force=1`);
  console.log('status:', r2.status, '| chunks:', r2.chunks.length);

  // Marqueurs : on cherche les logs cote serveur (visibles dans pm2/console)
  // mais aussi tracer si le LLM cite des chiffres "deep-dive" specifiques
  const hasFcMarker = /DEEP-DIVE|Function Calling/i.test(r2.full);
  const sampleOut = r2.full.slice(0, 800);
  console.log('\n== Verification ==');
  console.log('hasFcMarker (litteral dans la sortie LLM):', hasFcMarker);
  console.log('NOTE: marqueur principal = logs serveur "[AI-AL FC] match=... loops=N calls=M"');
  console.log('Sample 800 chars:', sampleOut);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
