// bd kgd — Sanity test Travel Factor helper. Run: node .context/_test_travel_factor.js
const fs = require('fs');
const path = require('path');

// Mini-charge stadiums_geo.json
const geo = JSON.parse(fs.readFileSync(path.join(__dirname, 'stadiums_geo.json'), 'utf8')).teams;

function normName(name) {
  return (name || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function lookupStadiumGeo(teamName) {
  if (!teamName) return null;
  const key = normName(teamName);
  if (geo[key]) return geo[key];
  const firstWord = key.split(' ')[0];
  if (firstWord.length >= 4) {
    for (const [k, v] of Object.entries(geo)) {
      if (k === firstWord || k.startsWith(firstWord + ' ') || k.endsWith(' ' + firstWord)) return v;
    }
  }
  return null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function tzOffsetDiffHours(tzA, tzB, atDate) {
  if (!tzA || !tzB || tzA === tzB) return 0;
  const d = new Date(atDate);
  if (isNaN(d.getTime())) return 0;
  try {
    const opts = { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
    const parseLocal = (tz) => {
      const fmt = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz });
      const parts = fmt.formatToParts(d);
      const lookup = {};
      for (const p of parts) lookup[p.type] = p.value;
      const iso = `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}:${lookup.second}Z`;
      return new Date(iso).getTime();
    };
    return (parseLocal(tzA) - parseLocal(tzB)) / 3600000;
  } catch (_) {
    return 0;
  }
}

function computeTravelFactor(homeTeam, awayTeam, kickoffISO, prevAwayMatchDate) {
  const homeGeo = lookupStadiumGeo(homeTeam);
  const awayGeo = lookupStadiumGeo(awayTeam);
  if (!homeGeo || !awayGeo) {
    return { missing: true, score: null, xg_modulator: 1, source: 'stadiums_geo', _home: !!homeGeo, _away: !!awayGeo };
  }
  const distance_km = parseFloat(haversineKm(homeGeo.lat, homeGeo.lng, awayGeo.lat, awayGeo.lng).toFixed(2));
  const tz_delta_hours = parseFloat(tzOffsetDiffHours(homeGeo.tz, awayGeo.tz, kickoffISO || Date.now()).toFixed(2));
  const climate_shift = !!(homeGeo.climate && awayGeo.climate && homeGeo.climate !== awayGeo.climate);

  let days_since_last = null;
  if (prevAwayMatchDate && kickoffISO) {
    const ms = new Date(kickoffISO).getTime() - new Date(prevAwayMatchDate).getTime();
    if (Number.isFinite(ms) && ms > 0) days_since_last = parseFloat((ms / 86400000).toFixed(1));
  }

  const distance_penalty = Math.min(distance_km / 5000, 1) * 30;
  const tz_penalty = Math.min(Math.abs(tz_delta_hours), 12) / 12 * 25;
  const climate_penalty = climate_shift ? 15 : 0;
  let recovery_penalty = 0;
  if (days_since_last != null) {
    if (days_since_last < 3) recovery_penalty = 20;
    else if (days_since_last > 7) recovery_penalty = 10;
  }
  const travel_score = Math.min(100, Math.round(distance_penalty + tz_penalty + climate_penalty + recovery_penalty));
  const xg_modulator = parseFloat((1 - travel_score / 100 * 0.08).toFixed(4));

  let level;
  if (travel_score >= 60) level = 'severe';
  else if (travel_score >= 35) level = 'high';
  else if (travel_score >= 15) level = 'moderate';
  else level = 'low';

  return {
    missing: false,
    distance_km,
    tz_delta_hours,
    climate_shift,
    home_climate: homeGeo.climate,
    away_climate: awayGeo.climate,
    home_city: homeGeo.city,
    away_city: awayGeo.city,
    days_since_last,
    travel_score,
    level,
    xg_modulator,
    _penalties: { distance: Math.round(distance_penalty), tz: Math.round(tz_penalty), climate: climate_penalty, recovery: recovery_penalty },
  };
}

// === SAMPLES ===
const kickoff = '2026-05-25T19:00:00Z';

console.log('\n=== TEST 1 : Derby parisien (PSG vs Marseille — voyage court Schengen) ===');
console.log(JSON.stringify(computeTravelFactor('PSG', 'Marseille', kickoff, '2026-05-21T19:00:00Z'), null, 2));

console.log('\n=== TEST 2 : UCL Man City vs PSG (longue distance intra-Europe, voyage 4j) ===');
console.log(JSON.stringify(computeTravelFactor('Manchester City', 'PSG', kickoff, '2026-05-21T19:00:00Z'), null, 2));

console.log('\n=== TEST 3 : Inter-continental Real Madrid vs Flamengo (Brésil → Madrid, climat tropical→méditerranéen, 9000km) ===');
console.log(JSON.stringify(computeTravelFactor('Real Madrid', 'Flamengo', kickoff, '2026-05-18T20:00:00Z'), null, 2));

console.log('\n=== TEST 4 : J-League Machida Zelvia vs Urawa Reds (50km intra-Tokyo) ===');
console.log(JSON.stringify(computeTravelFactor('Machida Zelvia', 'Urawa Red Diamonds', kickoff, '2026-05-22T10:00:00Z'), null, 2));

console.log('\n=== TEST 5 : MLS LA Galaxy vs Inter Miami (cross-USA 4500km + 3h tz) ===');
console.log(JSON.stringify(computeTravelFactor('LA Galaxy', 'Inter Miami', kickoff, '2026-05-20T02:00:00Z'), null, 2));

console.log('\n=== TEST 6 : Bayern Munich vs Boca Juniors (Mundial de clubes — pire scénario intercontinental) ===');
console.log(JSON.stringify(computeTravelFactor('Bayern Munich', 'Boca Juniors', kickoff, '2026-05-20T02:00:00Z'), null, 2));

console.log('\n=== TEST 7 : Équipe absente du référentiel — fallback missing ===');
console.log(JSON.stringify(computeTravelFactor('PSG', 'Equipe Inconnue XYZ', kickoff, null), null, 2));
