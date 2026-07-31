'use strict';
// ─── Smarkets Exchange WOM scraper → data/smarkets_tennis_wom.json ──────────
// Alternative gratuite à betwatch.fr pour le tennis. Smarkets = exchange
// Betfair-like, API JSON publique, pas géobloqué en France, pas de login.
//
// Smarkets vs Betfair :
//   bids  = back offers (argent voulant BACKER le joueur)
//   offers = lay offers (argent voulant LAYER le joueur)
//   WOM_back% = sum(bids top3) / (sum(bids top3) + sum(offers top3))
//
// Usage:
//   node tools/scrape-smarkets-tennis-wom.js
//
// Output: data/smarkets_tennis_wom.json (même format que betwatch_wom.json)

const https = require('https');
const fs = require('fs');
const path = require('path');

const API = 'api.smarkets.com';
const OUT = process.env.SMARKETS_CACHE || path.join(__dirname, '..', 'data', 'smarkets_tennis_wom.json');
const TOP_N = 10; // nombre de matchs populaires à récupérer

function smGet(p) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: API, path: '/v3' + p, method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
    }, res => {
      let b = '';
      res.on('data', c => (b += c));
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// Prix Smarkets en format entier (7143 = 1.7143 décimal)
function dec(p) { return p ? (p / 10000).toFixed(4) : null; }
function sum3(arr) { return arr.slice(0, 3).reduce((s, x) => s + (x.quantity || 0), 0); }

async function scrapeMatch(eventId) {
  try {
    // 1. Event details
    const ev = await smGet('/events/' + eventId + '/');
    const match = (ev.events || [])[0];
    if (!match || match.type !== 'tennis_match') return null;

    // 2. Markets → find "Match winner"
    const mk = await smGet('/events/' + eventId + '/markets/');
    const winnerMarket = (mk.markets || []).find(m => m.market_type && m.market_type.name === 'WINNER_2_WAY');
    if (!winnerMarket) return null;

    // 3. Quotes → back/lay volumes
    const qt = await smGet('/markets/' + winnerMarket.id + '/quotes/');
    
    const contracts = [];
    for (const [cid, q] of Object.entries(qt)) {
      const bids = Array.isArray(q.bids) ? q.bids : [];
      const offers = Array.isArray(q.offers) ? q.offers : [];
      const bidVol = sum3(bids);
      const offerVol = sum3(offers);
      const total = bidVol + offerVol;
      contracts.push({
        id: cid,
        back_volume: bidVol,
        lay_volume: offerVol,
        wom_pct: total > 0 ? parseFloat(((bidVol / total) * 100).toFixed(1)) : null,
        best_back: bids[0] ? dec(bids[0].price) : null,
        best_lay: offers[0] ? dec(offers[0].price) : null,
      });
    }

    // 4. Get contract names
    const ct = await smGet('/markets/' + winnerMarket.id + '/contracts/');
    for (const c of (ct.contracts || [])) {
      const found = contracts.find(x => x.id === c.id);
      if (found) {
        found.name = c.name;
        found.type = (c.contract_type || {}).name;
      }
    }

    const p1 = contracts.find(c => c.type === 'PLAYER_A');
    const p2 = contracts.find(c => c.type === 'PLAYER_B');

    // WOM cross-player : "quel % de l'argent total backe ce joueur ?"
    const totalBids = (p1 ? p1.back_volume : 0) + (p2 ? p2.back_volume : 0);
    const womHome = p1 && totalBids > 0 ? parseFloat(((p1.back_volume / totalBids) * 100).toFixed(1)) : null;
    const womAway = p2 && totalBids > 0 ? parseFloat(((p2.back_volume / totalBids) * 100).toFixed(1)) : null;

    return {
      eventId: match.id,
      home_team: p1 ? p1.name : (match.name || '').split(' vs ')[0]?.trim(),
      away_team: p2 ? p2.name : (match.name || '').split(' vs ')[1]?.trim(),
      sport: 'tennis',
      start_time: match.start_datetime,
      state: match.state,
      tournament: match.parent_id || null,
      totalMatched: null,
      wom: (womHome != null && womAway != null) ? {
        home: womHome,
        away: womAway,
      } : null,
      money: p1 && p2 ? {
        home: p1.back_volume,
        away: p2.back_volume,
      } : null,
      odds: p1 && p2 ? {
        home: p1.best_back ? parseFloat(p1.best_back) : null,
        away: p2.best_back ? parseFloat(p2.best_back) : null,
      } : null,
      contracts,
    };
  } catch (e) {
    console.warn('[smarkets] Event', eventId, '—', e.message);
    return null;
  }
}

(async function main() {
  console.log('[smarkets] Fetching popular tennis events...');
  
  // Get popular event IDs
  let popular;
  try {
    popular = await smGet('/popular/event_ids/sport/tennis/');
  } catch (e) {
    console.error('[smarkets] Failed to get events:', e.message);
    process.exit(1);
  }

  const ids = (popular.popular_event_ids || []).slice(0, TOP_N);
  console.log('[smarkets] Found', ids.length, 'popular tennis events');

  const matches = [];
  for (const id of ids) {
    const m = await scrapeMatch(id);
    if (m) {
      matches.push(m);
      console.log('[smarkets]', m.home_team, 'vs', m.away_team,
        m.wom ? `WOM: ${m.wom.home}%/${m.wom.away}%` : '(no WOM)');
    }
    // Rate limit: 500ms entre chaque appel
    await new Promise(r => setTimeout(r, 500));
  }

  const payload = {
    ts: Date.now(),
    date: new Date().toISOString().slice(0, 10),
    source: 'smarkets.com API v3',
    count: matches.length,
    with_wom: matches.filter(m => m.wom).length,
    matches,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log('[smarkets] Wrote', OUT, '—', matches.length, 'matches,', payload.with_wom, 'with WOM');
})().catch(e => { console.error('[smarkets] FATAL', e.message); process.exit(1); });
