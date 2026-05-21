/**
 * seed_historique_wikidata.js — ETL Wikidata SPARQL (CC0 commercial-safe)
 * ──────────────────────────────────────────────────────────────────────
 * Mission: bd ParisScorebis-6du6 — Phase 1 alternative legal commercial-safe.
 *   Sackmann ATP/WTA bloque (CC BY-NC-SA, bd bbul). Wikidata = CC0 public domain.
 *
 * SCOPE v1 (focused, expandable):
 *   - Tennis: Grand Slam men's + women's singles winners 2020-2026 (4 majors x 7 ans x 2 = ~56)
 *   - Foot: UCL final + WC final + EURO final 2020-2026 (~9 evts)
 *
 *   Backbone metadata reliable (date, winner, runner-up) pour calibration
 *   Power Score + UI Historique badge "CC0 verified".
 *
 * USAGE:
 *   node seed_historique_wikidata.js                # tennis + foot finals
 *   node seed_historique_wikidata.js --tennis-only
 *   node seed_historique_wikidata.js --foot-only
 *
 * OUTPUT: historique_wikidata.json compatible loadHistory v12.26
 *
 * LICENSE: Wikidata CC0 1.0 Universal (Public Domain Dedication).
 *   Attribution Wikidata contributors recommandee dans UI Historique tab.
 *
 * ENDPOINT: https://query.wikidata.org/sparql
 *   Rate limit: 60 req/min/IP. User-Agent obligatoire (policy WMF).
 *
 * QID REFERENCE:
 *   Q60874  Australian Open       Q43605  French Open
 *   Q41520  Wimbledon             Q123577 US Open
 *   Q47345468 tennis tournament edition (P31 marker)
 *   Q46190676 tennis event (discipline)
 *   Q16893072 men's singles        Q16893403 women's singles
 *   Q80716240 UCL final            Q12708896 WC final         Q59658968 EURO final
 *   P31 instance-of  P361 part-of  P585 date  P1346 winner  P2094 class  P765 surface
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_FILE = path.join(__dirname, 'historique_wikidata.json');
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'PariScore-ETL/1.0 (+https://pariscore.fr; contact: david@pariscore.fr) Node.js/https';
const THROTTLE_MS = 1500;

// ── SPARQL queries (validated 2026-05-21) ───────────────────────────────────

const QUERY_TENNIS_GS_WINNERS = `
SELECT ?edition ?editionLabel ?series ?seriesLabel ?class ?classLabel ?date ?winner ?winnerLabel ?surface ?surfaceLabel WHERE {
  VALUES ?series { wd:Q60874 wd:Q43605 wd:Q41520 wd:Q123577 }
  VALUES ?class { wd:Q16893072 wd:Q16893403 }
  ?event wdt:P31 wd:Q46190676 ;
         wdt:P2094 ?class ;
         wdt:P361 ?edition ;
         wdt:P1346 ?winner .
  OPTIONAL { ?event wdt:P765 ?surface . }
  ?edition wdt:P31 ?series ;
           wdt:P31 wd:Q47345468 .
  OPTIONAL { ?edition wdt:P580 ?d1 . }
  OPTIONAL { ?edition wdt:P585 ?d2 . }
  BIND(COALESCE(?d1, ?d2) AS ?date)
  FILTER(BOUND(?date) && YEAR(?date) >= 2020 && YEAR(?date) <= 2026)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?date) ?seriesLabel ?classLabel
`;

const QUERY_FOOT_FINALS = `
SELECT ?event ?eventLabel ?type ?typeLabel ?date ?winner ?winnerLabel WHERE {
  VALUES ?type { wd:Q80716240 wd:Q12708896 wd:Q59658968 }
  ?event wdt:P31 ?type ;
         wdt:P585 ?date .
  OPTIONAL { ?event wdt:P1346 ?winner . }
  FILTER(YEAR(?date) >= 2020 && YEAR(?date) <= 2026)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY DESC(?date)
`;

// ── HTTP helper ─────────────────────────────────────────────────────────────
function sparqlGet(query) {
  return new Promise((resolve, reject) => {
    const u = new URL(SPARQL_ENDPOINT);
    u.searchParams.set('query', query);
    u.searchParams.set('format', 'json');
    https.get(u.toString(), {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/sparql-results+json' }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`SPARQL HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`SPARQL parse error: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Result → unified record ─────────────────────────────────────────────────
function bind(row, k) {
  const v = row[k];
  return v && typeof v.value === 'string' ? v.value : null;
}
function qid(uri) {
  return uri ? uri.split('/').pop() : null;
}

function transformTennisWinner(row) {
  const editionUri = bind(row, 'edition');
  const date = bind(row, 'date');
  if (!editionUri || !date) return null;
  const cls = bind(row, 'classLabel') || '';
  const isMens = cls.toLowerCase().includes("men's singles") && !cls.toLowerCase().includes("women");
  return {
    id: `wd_tennis_${qid(editionUri)}_${isMens ? 'MS' : 'WS'}`,
    source: 'wikidata',
    sport: 'tennis',
    series_qid: qid(bind(row, 'series')),
    series: bind(row, 'seriesLabel'),
    edition_qid: qid(editionUri),
    edition: bind(row, 'editionLabel'),
    class: cls,
    date: date.slice(0, 10),
    winner_qid: qid(bind(row, 'winner')),
    winner: bind(row, 'winnerLabel'),
    surface: bind(row, 'surfaceLabel'),
    round: 'F',
    _attribution: 'Wikidata (CC0 1.0)',
  };
}

function transformFootFinal(row) {
  const eventUri = bind(row, 'event');
  const date = bind(row, 'date');
  if (!eventUri || !date) return null;
  return {
    id: `wd_foot_${qid(eventUri)}`,
    source: 'wikidata',
    sport: 'football',
    type_qid: qid(bind(row, 'type')),
    type: bind(row, 'typeLabel'),
    event_qid: qid(eventUri),
    event_label: bind(row, 'eventLabel'),
    date: date.slice(0, 10),
    winner_qid: qid(bind(row, 'winner')),
    winner: bind(row, 'winnerLabel'),
    round: 'F',
    _attribution: 'Wikidata (CC0 1.0)',
  };
}

// ── Main ETL ────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const tennisOnly = args.includes('--tennis-only');
  const footOnly = args.includes('--foot-only');

  console.log('[ETL wikidata] Demarrage — endpoint Wikidata SPARQL (CC0)');
  console.log(`[ETL wikidata] Output: ${OUTPUT_FILE}`);

  const out = {
    schema_version: 1,
    generated_at: null,
    source: 'wikidata.org/sparql',
    license: 'CC0 1.0 Universal (Public Domain)',
    attribution: 'Wikidata contributors',
    tennis: { grand_slam_singles_winners: [] },
    football: { major_finals: [] },
  };

  if (!footOnly) {
    try {
      console.log('[ETL wikidata]   tennis Grand Slam singles winners 2020-2026...');
      const res = await sparqlGet(QUERY_TENNIS_GS_WINNERS);
      const rows = (res.results && res.results.bindings) || [];
      out.tennis.grand_slam_singles_winners = rows.map(transformTennisWinner).filter(Boolean);
      console.log(`[ETL wikidata]   tennis → ${out.tennis.grand_slam_singles_winners.length} winners`);
    } catch (e) {
      console.warn(`[ETL wikidata]   tennis SPARQL erreur: ${e.message}`);
    }
    await sleep(THROTTLE_MS);
  }

  if (!tennisOnly) {
    try {
      console.log('[ETL wikidata]   foot finals UCL/WC/EURO 2020-2026...');
      const res = await sparqlGet(QUERY_FOOT_FINALS);
      const rows = (res.results && res.results.bindings) || [];
      out.football.major_finals = rows.map(transformFootFinal).filter(Boolean);
      console.log(`[ETL wikidata]   foot → ${out.football.major_finals.length} finals`);
    } catch (e) {
      console.warn(`[ETL wikidata]   foot SPARQL erreur: ${e.message}`);
    }
  }

  out.generated_at = new Date().toISOString();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(out, null, 2));
  const total = out.tennis.grand_slam_singles_winners.length + out.football.major_finals.length;
  console.log(`[ETL wikidata] OK — ${total} records ingere — sauvegarde ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main().catch(e => {
    console.error('[ETL wikidata] ERREUR:', e.message);
    process.exit(1);
  });
}

module.exports = { main, sparqlGet, transformTennisWinner, transformFootFinal, QUERY_TENNIS_GS_WINNERS, QUERY_FOOT_FINALS };
