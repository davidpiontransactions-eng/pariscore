// 1xbet_extract.cjs — Extraction compacte depuis payload.json (Nuxt 1xBet)
// Usage: node 1xbet_extract.cjs <payload.json> <league_id> <slug>

const fs = require('fs');
const path = require('path');

const payloadPath = process.argv[2];
const leagueId = parseInt(process.argv[3], 10);
const slug = process.argv[4];

if (!payloadPath || !leagueId || !slug) {
  console.error('Usage: node 1xbet_extract.cjs <payload.json> <league_id> <slug>');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));
} catch (e) {
  console.error('Failed to read payload:', e.message);
  process.exit(1);
}

// Structure attendue : data.state.lineData[leagueId].events[]
const state = data.state || data.data || {};
const lineData = state.lineData || state.sports || {};
const leagueEvents = lineData[leagueId] || lineData[slug] || {};

const events = (leagueEvents.events || leagueEvents.champs || []);
if (!Array.isArray(events) || events.length === 0) {
  console.error('No events found for league:', leagueId, slug);
  process.exit(1);
}

const fights = [];
for (const ev of events) {
  if (!ev || typeof ev !== 'object') continue;
  
  const gameId = ev.id || ev.game_id || ev.gameId;
  const fighter1 = ev.name1 || ev.team1 || ev.player1 || ev.fighter1;
  const fighter2 = ev.name2 || ev.team2 || ev.player2 || ev.fighter2;
  const oddsF1 = ev.coeff1 || ev.odds1 || ev.odd1 || ev.c1;
  const oddsF2 = ev.coeff2 || ev.odds2 || ev.odd2 || ev.c2;
  const startTime = ev.start_time || ev.startTime || ev.date || ev.ts;
  const eventName = ev.champ_name || ev.league_name || '';
  
  if (!gameId || !fighter1 || !fighter2 || !oddsF1 || !oddsF2 || !startTime) continue;
  
  fights.push({
    game_id: Number(gameId),
    event_name: String(eventName).trim() || `UFC Event — ${slug}`,
    league_id: leagueId,
    fighter1: String(fighter1).trim(),
    fighter2: String(fighter2).trim(),
    odds_f1: Number(oddsF1),
    odds_f2: Number(oddsF2),
    start_time: Number(startTime),
  });
}

if (fights.length === 0) {
  console.error('No valid fights extracted');
  process.exit(1);
}

console.log(JSON.stringify({ fights }));