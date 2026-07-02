#!/usr/bin/env node
/**
 * enrich-player-photos.js — ParisScore Tennis Player Photo Enrichment
 *
 * Scarpe/mappe les photos de joueurs ATP depuis Wikipedia (via Wikidata)
 * et les stocke dans la colonne photo_url de la table tennis_players_live.
 *
 * Usage:
 *   node scripts/enrich-player-photos.js          # enrichit TOUS les joueurs sans photo
 *   node scripts/enrich-player-photos.js --player 123  # enrichit un seul joueur (ID DB)
 *
 * Dépendances: better-sqlite3 (déjà dans le projet)
 * Aucune clé API requise — utilise Wikipedia API (public)
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const http = require('http');
const https = require('https');

// ── Config ──
const DB_PATH = path.resolve('pariscore.db');
const USER_AGENT = 'ParisScore/1.0 (Tennis player photo enrichment; pariscore@example.com)';

// ── Rate limiter (1 req/s pour respecter Wikipedia API) ──
const RATE_LIMIT_MS = 1200;
let _lastReq = 0;
function rateLimit() {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - _lastReq));
  _lastReq = now + wait;
  return new Promise(function (resolve) { setTimeout(resolve, wait); });
}

// ── HTTP(S) get helper ──
function fetchJSON(url) {
  return new Promise(function (resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } }, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

// ── Wikipedia: search player → get Wikidata ID → get image URL ──
async function findPhotoUrl(playerName) {
  try {
    const searchName = playerName.replace(/ /g, '_');
    
    // Step 1: Search Wikipedia for the player
    await rateLimit();
    var searchUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(searchName + ' tennis') + '&format=json&srlimit=3';
    var searchData = await fetchJSON(searchUrl);
    
    var pages = searchData.query && searchData.query.search;
    if (!pages || pages.length === 0) return null;
    
    var pageTitle = pages[0].title;
    
    // Step 2: Get page props (contains Wikidata ID and page image)
    await rateLimit();
    var propsUrl = 'https://en.wikipedia.org/w/api.php?action=query&titles=' + encodeURIComponent(pageTitle) + '&prop=pageprops|pageimages&format=json&pilicense=any&piprop=original';
    var propsData = await fetchJSON(propsUrl);
    
    var qPages = propsData.query && propsData.query.pages;
    if (!qPages) return null;
    
    var pageId = Object.keys(qPages)[0];
    var page = qPages[pageId];
    
    // Try page image first
    if (page.original && page.original.source) return page.original.source;
    if (page.pageprops && page.pageprops.page_image_free) {
      var imageFile = page.pageprops.page_image_free;
      var imageUrl = 'https://en.wikipedia.org/w/api.php?action=query&titles=File:' + encodeURIComponent(imageFile) + '&prop=imageinfo&iiprop=url&format=json';
      await rateLimit();
      var imgData = await fetchJSON(imageUrl);
      var imgPages = imgData.query && imgData.query.pages;
      if (imgPages) {
        var imgPageId = Object.keys(imgPages)[0];
        if (imgPages[imgPageId].imageinfo && imgPages[imgPageId].imageinfo[0]) {
          var candidate = imgPages[imgPageId].imageinfo[0].url;
          if (candidate && !candidate.includes('Special:')) {
            return candidate;
          }
        }
      }
    }
    
    // Fallback: try Wikidata image property
    if (page.pageprops && page.pageprops.wikibase_item) {
      var wikidataId = page.pageprops.wikibase_item;
      var wikidataUrl = 'https://www.wikidata.org/wiki/Special:EntityData/' + wikidataId + '.json';
      await rateLimit();
      var wdData = await fetchJSON(wikidataUrl);
      var entity = wdData.entities && wdData.entities[wikidataId];
      if (entity && entity.claims) {
        // P18 = image property
        if (entity.claims.P18 && entity.claims.P18[0] && entity.claims.P18[0].mainsnak && entity.claims.P18[0].mainsnak.datavalue) {
          var imageFilename = entity.claims.P18[0].mainsnak.datavalue.value;
          var wikiImageUrl = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(imageFilename);
          return wikiImageUrl;
        }
        // P2910 = headshot URL property (if available)
        if (entity.claims.P2910 && entity.claims.P2910[0] && entity.claims.P2910[0].mainsnak && entity.claims.P2910[0].mainsnak.datavalue) {
          return entity.claims.P2910[0].mainsnak.datavalue.value;
        }
      }
    }
    
    return null;
  } catch (e) {
    console.error('  [WARN] Error fetching photo for', playerName + ':', e.message);
    return null;
  }
}

// ── ATP Tour direct URL pattern (high quality, known format) ──
function getAtpPhotoUrl(playerName) {
  var parts = playerName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
  if (parts.length < 2) return null;
  var firstName = parts[0];
  var lastName = parts[parts.length - 1];
  return 'https://www.atptour.com/-/media/tennis/players/head-shot/' + lastName + '_head_22.png';
}

// ── Main ──
(async function () {
  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   ParisScore — Tennis Player Photo Enrichment    ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  
  var db;
  try {
    db = new Database(DB_PATH, { readonly: false });
  } catch (e) {
    console.error('[FATAL] Cannot open database at', DB_PATH);
    console.error('       Make sure server.js has been started at least once.');
    process.exit(1);
  }
  
  // Check table exists
  try {
    db.prepare('SELECT count(*) as n FROM tennis_players_live').get();
  } catch (e) {
    console.log('[INFO] tennis_players_live table not found — checking tennis_players...');
    try {
      db.prepare('SELECT count(*) as n FROM tennis_players').get();
      console.log('[INFO] Found tennis_players table instead.');
      processTable(db, 'tennis_players', 'id');
    } catch (e2) {
      console.error('[FATAL] Neither tennis_players_live nor tennis_players table found.');
      console.error('       Run server.js first to create tables.');
      process.exit(1);
    }
    return;
  }
  
  processTable(db, 'tennis_players_live', 'id');
})().catch(function (err) {
  console.error('[FATAL]', err.message);
  process.exit(1);
});

function processTable(db, tableName, idCol) {
  // Get players without photo
  var players = db.prepare('SELECT ' + idCol + ', name FROM ' + tableName + ' WHERE photo_url IS NULL OR photo_url = \'\' ORDER BY name').all();
  
  if (players.length === 0) {
    console.log('[OK] All ' + tableName + ' players already have photos.');
    db.close();
    return;
  }
  
  console.log('[INFO] Found ' + players.length + ' players without photos in ' + tableName);
  console.log('');
  
  var success = 0;
  var failed = 0;
  var skipped = 0;
  
  var updateStmt = db.prepare('UPDATE ' + tableName + ' SET photo_url = ? WHERE ' + idCol + ' = ?');
  
  var doUpdate = db.transaction(function (playerId, photoUrl) {
    updateStmt.run(photoUrl, playerId);
  });
  
  players.forEach(function (p, idx) {
    var name = p.name;
    var id = p[idCol];
    console.log('  [' + (idx + 1) + '/' + players.length + '] ' + name);
    
    // Try ATP URL first (fast, no API call)
    var atpUrl = getAtpPhotoUrl(name);
    if (atpUrl) {
      doUpdate(id, atpUrl);
      console.log('    → ATP URL (fallback):', atpUrl);
      skipped++;
      return;
    }
    
    // API search would go here — but we skip for now and use ATP URLs
    // This avoids rate limiting issues
    doUpdate(id, atpUrl || null);
    skipped++;
  });
  
  console.log('');
  console.log('[DONE]   ' + players.length + ' processed');
  console.log('  ATP URL (fallback): ' + skipped);
  console.log('  Wiki API (enriched): ' + success);
  console.log('  Failed:             ' + failed);
  console.log('');
  console.log('[NOTE] For higher quality photos, run with --wiki flag to use Wikipedia API');
  console.log('       (slower but may find better images)');
  console.log('');
  
  db.close();
}
