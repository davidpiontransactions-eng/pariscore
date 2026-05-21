#!/usr/bin/env node
// POC probe OddsPapi.io free tier — vérifier Pinnacle coverage + endpoint shape
// bd bjv Option C — research-pinnacle-api-2026.md recommande tester free tier avant pivot $99/mo
//
// PREREQUIS:
//   1. Créer compte gratuit https://oddspapi.io/ (250 req/mo free)
//   2. Récupérer API key depuis dashboard
//   3. Ajouter dans .env: ODDSPAPI_KEY=...
//
// USAGE: node .context/_probe_oddspapi_pinnacle.js
//
// CHECKS:
//   1. /sports → liste sports disponibles (foot + tennis présents ?)
//   2. /bookmakers → liste books (Pinnacle inclus ?)
//   3. /odds?sport=soccer&bookmaker=pinnacle → sample odds Pinnacle football
//   4. Latence réelle + shape JSON pour mapper computeEdge-compat
//
// NB: endpoints inférés depuis docs publiques 2026, à ajuster selon dashboard OddsPapi.

const fs = require('fs');
const https = require('https');

// Parse .env (zero-dep, cohérent CLAUDE.md règle 2)
const env = fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#') && l.includes('='));
for (const line of env) {
  const [k, ...v] = line.split('=');
  process.env[k.trim()] = v.join('=').trim();
}

const KEY = process.env.ODDSPAPI_KEY || process.env.ODDS_PAPI_KEY;
if (!KEY) {
  console.error('ERR: ODDSPAPI_KEY manquant dans .env');
  console.error('Signup: https://oddspapi.io/ — free tier 250 req/mo');
  process.exit(1);
}

const HOST = 'api.oddspapi.io'; // à ajuster si dashboard diffère
const HEADERS = { 'x-api-key': KEY, 'accept': 'application/json' };

function probe(path) {
  return new Promise(resolve => {
    const start = Date.now();
    const req = https.request({ hostname: HOST, path, method: 'GET', headers: HEADERS }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => {
        const latency = Date.now() - start;
        console.log(`\n[${r.statusCode}] ${path} (${latency}ms)`);
        try {
          const j = JSON.parse(body);
          console.log(JSON.stringify(j).slice(0, 400));
        } catch (_) {
          console.log(body.slice(0, 400));
        }
        resolve();
      });
    });
    req.on('error', e => { console.log(`ERR ${path}: ${e.message}`); resolve(); });
    req.end();
  });
}

(async () => {
  const paths = [
    '/v1/sports',
    '/v1/bookmakers',
    '/v1/odds?sport=soccer&bookmaker=pinnacle&limit=5',
    '/v1/odds?sport=tennis&bookmaker=pinnacle&limit=5',
    '/v1/markets',
  ];
  for (const p of paths) await probe(p);
  console.log('\n--- DONE — analyser shape pour mapping computeEdge-compat ---');
})();
