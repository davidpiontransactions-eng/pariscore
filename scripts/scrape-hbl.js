#!/usr/bin/env node
'use strict';
/**
 * scrape-hbl.js
 * -------------
 * Routine : CLASSEMENT + STATS ÉQUIPES des championnats allemands de handball
 * (1. HBL « Opel HBL » + 2. Handball-Bundesliga) pour l'onglet « Stats équipes »
 * du popup handball (bead ParisScorebis-wvwv — la source LNH ne couvre que la
 * StarLigue, la Bundesliga n'avait AUCUNE source).
 *
 * Source : API Synergy/Sportradar derrière www.opel-hbl.de
 * (robots.txt = 404, aucun WAF, aucun quota, GET sans token — sondage 2026-09-27).
 *
 *   GET /api/synergy/seasons?competitionId=…                  → saisons
 *   GET /api/synergy/season-statistic/team-overview?seasonId=… → 43 stats/club
 *   GET /api/synergy/standings?seasonId=…                     → classement
 *
 * Réponse JSON : { data:[{ entity:{id}, statistics:{…}, position, points, calculated:{…} }],
 *                  includes.resources.entities.{id→club} }
 * → jointure des ids : club = entities.nameFullLatin.
 *
 * Sortie (2 fichiers, écriture all-or-nothing) :
 *   data/hbl_teamstats.json  { scraped_at, season, source, total, metrics[], teams[] }
 *     miroir du schéma lnh_teamstats.json (lnh-stats.ts) pour que l'UI partage
 *     le même rendu : teams[i] = { team, played, metrics: { key: {total, avg, label} } }
 *   data/hbl_standing.json   { scraped_at, season, source, total, standing[] }
 *     miroir lnh_standing.json : standing[i] = { rank, team, points, played,
 *     wins, draws, losses, goals_for, goals_against, goal_diff }
 *
 * Consommé par src/lib/hbl-stats.ts → GET /api/handball/analysis (repli si les
 * 2 équipes sont hors snapshots LNH).
 *
 * Usage :
 *   node scripts/scrape-hbl.js                     # 1.HBL + 2.HBL
 *   node scripts/scrape-hbl.js --competition=hbl   # ciblé (écriture des 2 fichiers)
 *   node scripts/scrape-hbl.js --dry-run           # parse sans écrire
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://www.opel-hbl.de';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const REFERER = 'https://www.opel-hbl.de/en/hbl/statistics/club-statistics';
const HTTP_TIMEOUT_MS = 30000;
const RETRIES = 2;
const DELAY_MS = 700;
const SOURCE = 'opel-hbl.de (API Synergy/Sportradar)';

// Compétitions identifiées par sondage 2026-09-27 (payload Nuxt des pages stats).
const COMPETITIONS = {
  hbl: {
    competitionId: '4c445e5c-3956-11ef-9d0e-b74f5c057367',
    label: '1.HBL',
    fallbackSeasonId: 'c4a3125f-79f2-11f1-9a19-5f7c8c2ed877', // Opel HBL 2026/27
  },
  hbl2: {
    competitionId: '4c5a3af0-3956-11ef-9b6c-b74f5c057367',
    label: '2.HBL',
    fallbackSeasonId: 'c4a17ef0-79f2-11f1-a11a-bd92ba3d42e7', // 2. HBL 2026/27
  },
};

/** Métriques exposées à l'UI (mêmes clés que LNH pour mutualiser le rendu).
 *  « assists » volontairement absent : champ absent du team-overview HBL
 *  (sondage 2026-09-27 : 0/35 clubs renvoient la clé). */
const METRICS = [
  { order: '01', key: 'goals_for', label: 'Buts marqués', stat: 'goalsScored' },
  { order: '02', key: 'goals_against', label: 'Buts encaissés', stat: 'goalKeeperGoalsAgainst' },
  { order: '03', key: 'saves', label: 'Arrêts gardiens', stat: 'goalKeeperShotsSaved' },
  { order: '04', key: 'shots', label: 'Tirs', stat: 'shots' },
];

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const OUT_TEAM = path.join(REPO_DIR, 'data', 'hbl_teamstats.json');
const OUT_STANDING = path.join(REPO_DIR, 'data', 'hbl_standing.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const r1 = (x) => Math.round(x * 10) / 10;

// ─── HTTP fetch JSON (miroir scrape-hbl-players.js) ─────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'application/json,text/plain,*/*',
            Referer: REFERER,
          },
        },
        (res) => {
          let s = '';
          res.on('data', (d) => {
            s += d;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                resolve(JSON.parse(s));
              } catch (e) {
                reject(new Error('JSON invalide : ' + e.message));
              }
              return;
            }
            if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
            reject(new Error('HTTP ' + res.statusCode));
          });
        }
      );
      req.on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
        reject(e);
      });
      req.setTimeout(HTTP_TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    };
    attempt(RETRIES);
  });
}

// ─── Saison (miroir scrape-hbl-players.js, tolère tableau ou enveloppe) ─────
function seasonLabel(season) {
  const y = Number(season && season.year) || new Date().getUTCFullYear();
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

async function resolveSeason(comp) {
  try {
    const raw = await fetchJson(
      `${API_BASE}/api/synergy/seasons?competitionId=${comp.competitionId}`
    );
    const seasons = Array.isArray(raw) ? raw : (raw && (raw.seasons || raw.data)) || [];
    if (seasons.length) {
      const usable = seasons.filter(
        (s) => s && s.seasonId && s.status !== 'DRAFT' && s.status !== 'PENDING'
      );
      const active = usable.find((s) => s.status === 'ACTIVE');
      const best =
        active || usable.slice().sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0))[0];
      if (best) return { seasonId: best.seasonId, label: seasonLabel(best) };
    }
    throw new Error('aucune saison exploitable');
  } catch (err) {
    console.error(`[hbl-stats] seasons KO (${comp.label}) : ${err.message} → repli seasonId figé`);
    return { seasonId: comp.fallbackSeasonId, label: seasonLabel(null) };
  }
}

// ─── Parsing ────────────────────────────────────────────────────────────────
/** entities id → club (includes.resources.entities). */
function entityIndex(json) {
  const res = (json.includes && json.includes.resources) || {};
  return res.entities || {};
}

/** Stats équipes d'une compétition → lignes normalisées. */
function mapTeamStats(json, compKey) {
  const entities = entityIndex(json);
  const out = [];
  for (const item of json.data || []) {
    const ent = entities[(item.entity && item.entity.id) || ''] || {};
    const name = ent.nameFullLatin;
    if (!name) continue;
    const st = item.statistics || item.stats || {};
    const games = Number(st.games) || 0;
    const metrics = {};
    for (const m of METRICS) {
      const raw = st[m.stat];
      if (raw == null || raw === '') continue;
      const total = Number(raw);
      if (!Number.isFinite(total)) continue;
      metrics[m.key] = {
        total,
        avg: games > 0 ? r1(total / games) : undefined,
        label: m.label,
      };
    }
    out.push({
      team: name,
      competition: compKey,
      played: games,
      metrics,
    });
  }
  return out;
}

/** Classement d'une compétition → lignes normalisées (shape lnh_standing). */
function mapStanding(json, compKey) {
  const entities = entityIndex(json);
  const out = [];
  for (const row of json.data || []) {
    const ent = entities[(row.entity && row.entity.id) || row.entityId] || {};
    const name = ent.nameFullLatin;
    if (!name) continue;
    // Ligne « globale » uniquement (roundNumber null = cumul de saison).
    if (row.roundNumber != null) continue;

    const blocks = (row.calculated && typeof row.calculated === 'object') ? row.calculated : {};
    const block =
      blocks.OVERALL ||
      Object.values(blocks).find((b) => b && Number.isFinite(Number(b.played))) ||
      {};
    const pts =
      (row.points && (row.points.OVERALL || row.points.IN_CONFERENCE)) ||
      (typeof row.points === 'object' && Object.values(row.points || {}).find(
        (p) => p && p.standingPoints != null
      )) ||
      {};
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const gf = num(block.scoredFor);
    const ga = num(block.scoredAgainst);
    out.push({
      rank: num(row.position),
      team: name,
      competition: compKey,
      points: num(pts.standingPoints ?? block.standingPoints),
      played: num(block.played),
      wins: num(block.wins),
      draws: num(block.draws),
      losses: num(block.losses),
      goals_for: gf,
      goals_against: ga,
      goal_diff: gf - ga,
    });
  }
  // Tri défensif par rang (l'API les renvoie déjà ordonnés).
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

// ─── Scraping d'une compétition ─────────────────────────────────────────────
async function scrapeCompetition(compKey) {
  const comp = COMPETITIONS[compKey];
  const { seasonId, label } = await resolveSeason(comp);
  console.log(`[hbl-stats] ${comp.label} — saison ${label} (${seasonId})`);

  const teamJson = await fetchJson(
    `${API_BASE}/api/synergy/season-statistic/team-overview?seasonId=${seasonId}`
  );
  await sleep(DELAY_MS);
  const standJson = await fetchJson(`${API_BASE}/api/synergy/standings?seasonId=${seasonId}`);

  const teams = mapTeamStats(teamJson, compKey);
  const standing = mapStanding(standJson, compKey);
  console.log(
    `[hbl-stats] ${comp.label} : ${teams.length} clubs (stats), ${standing.length} lignes de classement`
  );
  if (!teams.length) throw new Error(`${comp.label} : 0 club (saison non démarrée ?)`);
  return { compKey, label, teams, standing };
}

// ─── CLI ────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);

function argValue(name) {
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === name && i + 1 < ARGS.length) return ARGS[i + 1];
    if (ARGS[i].startsWith(name + '=')) return ARGS[i].slice(name.length + 1);
  }
  return undefined;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = ARGS.includes('--dry-run');
  const compArg = (argValue('--competition') || 'all').toLowerCase();
  const teamOut = argValue('--out-teamstats');
  const standOut = argValue('--out-standing');
  const teamPath = teamOut ? path.resolve(teamOut) : OUT_TEAM;
  const standPath = standOut ? path.resolve(standOut) : OUT_STANDING;

  const keys = compArg === 'all' ? Object.keys(COMPETITIONS) : [compArg];
  for (const k of keys) {
    if (!COMPETITIONS[k]) {
      console.error(`[hbl-stats] compétition inconnue "${k}" (attendu : hbl | hbl2 | all)`);
      process.exit(1);
    }
  }
  console.log(`[hbl-stats] out=${teamPath} competition=${compArg}${dryRun ? ' (dry-run)' : ''}`);

  // All-or-nothing : la moindre compétition en échec annule tout le run.
  const teams = [];
  const standing = [];
  const labels = new Set();
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) await sleep(DELAY_MS);
    const res = await scrapeCompetition(keys[i]);
    teams.push(...res.teams);
    standing.push(...res.standing);
    labels.add(res.label);
  }

  const season = [...labels].join(', ');
  const teamSnap = {
    scraped_at: new Date().toISOString(),
    season,
    source: SOURCE,
    total: teams.length,
    metrics: METRICS.map(({ order, key, label }) => ({ order, key, label })),
    teams,
  };
  const standSnap = {
    scraped_at: new Date().toISOString(),
    season,
    source: SOURCE,
    total: standing.length,
    standing,
  };

  if (dryRun) {
    console.log(JSON.stringify({ ...teamSnap, teams: teams.slice(0, 3) }, null, 2));
    console.log(JSON.stringify({ ...standSnap, standing: standing.slice(0, 3) }, null, 2));
    console.log('[hbl-stats] dry-run : fichiers NON écrits');
    return;
  }

  fs.mkdirSync(path.dirname(teamPath), { recursive: true });
  fs.mkdirSync(path.dirname(standPath), { recursive: true });
  fs.writeFileSync(teamPath, JSON.stringify(teamSnap, null, 2), 'utf-8');
  fs.writeFileSync(standPath, JSON.stringify(standSnap, null, 2), 'utf-8');
  console.log(
    `[hbl-stats] ✅ ${teams.length} clubs (stats) + ${standing.length} lignes (${season}) → ${teamPath}`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[hbl-stats] FATAL:', err.message);
    console.error('[hbl-stats] rien écrit (all-or-nothing) — les fichiers existants sont conservés');
    process.exit(1);
  });
}

module.exports = { mapTeamStats, mapStanding, seasonLabel, METRICS, COMPETITIONS };
