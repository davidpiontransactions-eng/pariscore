// bd 040 — Smoke test detectSteam multi-bookmaker (worktree copy)
const path = require('path');
const fs = require('fs');
const code = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const startMarker = '// bd 040 — Steam detector multi-bookmaker (BD-DATA-012)';
const endMarker = '// bd 6v0 — DR Spike SSE event broadcast tennis live';
const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker);
if (startIdx < 0 || endIdx < 0) {
  console.error('FAIL: markers not found'); process.exit(1);
}
const slice = code.slice(startIdx, endIdx);

const kvStore = new Map();
const kvGet = k => kvStore.get(k);
const kvSet = (k, v) => kvStore.set(k, v);
const _pulseShouldBroadcast = () => true;
const sseClients = new Set([{ id: 'mock' }]);
const broadcastSSEEvents = [];
const broadcastSSE = (event, payload) => broadcastSSEEvents.push({ event, payload });

const fn = new Function('kvGet', 'kvSet', '_pulseShouldBroadcast', 'sseClients', 'broadcastSSE',
  slice + '\nreturn { detectSteam, broadcastSteamDetected };');
const { detectSteam, broadcastSteamDetected } = fn(kvGet, kvSet, _pulseShouldBroadcast, sseClients, broadcastSSE);

// TEST 1 — Steam HIGH
const matchId = 'test_match_001';
const now = Date.now();
kvStore.set(`odds_snap_bk_${matchId}`, [
  { ts: now - 4*60_000, books: [
    { bk: 'pinnacle', home: 2.10, draw: 3.40, away: 3.80 },
    { bk: 'bet365',   home: 2.05, draw: 3.50, away: 3.75 },
    { bk: 'unibet',   home: 2.08, draw: 3.45, away: 3.70 },
    { bk: 'william',  home: 2.12, draw: 3.40, away: 3.85 },
  ]},
  { ts: now - 1_000, books: [
    { bk: 'pinnacle', home: 1.95, draw: 3.40, away: 4.10 },
    { bk: 'bet365',   home: 1.92, draw: 3.50, away: 4.05 },
    { bk: 'unibet',   home: 1.96, draw: 3.45, away: 4.00 },
    { bk: 'william',  home: 2.00, draw: 3.40, away: 4.15 },
  ]},
]);
const r1 = detectSteam(matchId);
console.log('TEST 1 — Steam HIGH:', JSON.stringify(r1));
const t1 = r1 && r1.direction === 'home' && r1.n_bookmakers === 4 && r1.severity === 'high';
console.log(t1 ? '  PASS' : '  FAIL');

// TEST 2 — broadcast SSE
broadcastSSEEvents.length = 0;
const bc = broadcastSteamDetected(matchId);
const t2 = bc === true && broadcastSSEEvents.length === 1 && broadcastSSEEvents[0].event === 'steam_detected';
console.log('TEST 2 — SSE broadcast:', bc, broadcastSSEEvents[0].event);
console.log(t2 ? '  PASS' : '  FAIL');

// TEST 3 — sous-seuil
const r3 = detectSteam('test_match_unknown');
const t3 = r3 === null;
console.log('TEST 3 — null si pas de snapshot:', r3);
console.log(t3 ? '  PASS' : '  FAIL');

console.log('\n' + ((t1 && t2 && t3) ? 'ALL PASS' : 'FAIL'));
process.exit((t1 && t2 && t3) ? 0 : 1);
