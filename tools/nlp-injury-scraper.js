// ─────────────────────────────────────────────────────────────
// NLP Injury Scraper — Alertes blessures tennis non déclarées
// DATA_PIPELINE_V3 — Sprint 2
// Scanne les flux RSS médias locaux + Twitter keywords
// ─────────────────────────────────────────────────────────────

const https = require('https');
const http = require('http');

const TWITTER_KEYWORDS = ['blessure', 'forfait', 'blessé', 'injury', 'doubt', 'withdrawal', 'injured', 'out'];
const RSS_FEEDS = [
  { url: 'https://www.lequipe.fr/actualites/actus-tennis/rss.xml', lang: 'fr', country: 'FR' },
  { url: 'https://www.tennis.com/feed/', lang: 'en', country: 'US' },
  { url: 'https://www.eurosport.fr/tennis/rss.xml', lang: 'fr', country: 'FR' },
  { url: 'https://www.tennisworldusa.org/feed/', lang: 'en', country: 'US' },
];

// Cache des alertes déjà vues (évite les doublons)
const _alertCache = new Map();
const ALERT_TTL = 12 * 3600 * 1000; // 12h

// ─── Fetch RSS Feed ───
function fetchRSS(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 10000, headers: { 'User-Agent': 'ParisScore/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(null));
  });
}

// ─── Détection de mots-clés blessure ───
function detectInjury(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const kw of TWITTER_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

// ─── Parse RSS XML basique ───
function parseRSSItems(xml) {
  if (!xml) return [];
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const title = (match[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || match[1].match(/<title>(.*?)<\/title>/))?.[1] || '';
    const desc = (match[1].match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || match[1].match(/<description>(.*?)<\/description>/))?.[1] || '';
    const link = match[1].match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = match[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    items.push({ title: title.trim(), description: desc.trim(), link: link.trim(), date: pubDate.trim() });
  }
  return items;
}

// ─── Scanne un joueur spécifique ───
async function scanPlayerInjury(playerName, tournament) {
  const alerts = [];
  const searchName = playerName.toLowerCase().split(' ').slice(-1)[0]; // nom de famille
  
  for (const feed of RSS_FEEDS) {
    try {
      const xml = await fetchRSS(feed.url);
      const items = parseRSSItems(xml);
      
      for (const item of items) {
        const text = `${item.title} ${item.description}`;
        if (!text.toLowerCase().includes(searchName)) continue;
        
        const kw = detectInjury(text);
        if (!kw) continue;
        
        const alertKey = `${playerName}_${kw}_${item.date}`;
        if (_alertCache.has(alertKey)) continue;
        _alertCache.set(alertKey, Date.now());
        
        alerts.push({
          player: playerName,
          keyword: kw,
          confidence: kw === 'forfait' || kw === 'withdrawal' ? 'high' : 'medium',
          source: feed.url,
          title: item.title,
          link: item.link,
          date: item.date,
          tournament: tournament || null,
          timestamp: Date.now(),
        });
      }
    } catch (e) { /* swallow per-feed errors */ }
  }
  
  // Clean old cache entries
  for (const [key, ts] of _alertCache) {
    if (Date.now() - ts > ALERT_TTL) _alertCache.delete(key);
  }
  
  return alerts;
}

// ─── Scan tous les joueurs actifs d'un tournoi ───
async function scanTournamentPlayers(players, tournament) {
  const allAlerts = [];
  const batchSize = 5; // limite de concurrence
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(p => scanPlayerInjury(p.name, tournament)));
    for (const r of results) allAlerts.push(...r);
  }
  return allAlerts;
}

// ─── Nettoyage périodique du cache ───
setInterval(() => {
  for (const [key, ts] of _alertCache) {
    if (Date.now() - ts > ALERT_TTL) _alertCache.delete(key);
  }
}, 3600000); // 1h

module.exports = { scanPlayerInjury, scanTournamentPlayers, detectInjury, _alertCache };
