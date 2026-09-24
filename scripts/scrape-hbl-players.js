#!/usr/bin/env node
'use strict';
/**
 * scrape-hbl-players.js
 * ---------------------
 * Routine : stats joueurs Handball-Bundesliga officielles (1.HBL + DHB-Pokal)
 * pour la popup prématch (meilleurs joueurs de 2 équipes opposées).
 *
 * Source : API Synergy/Sportradar derrière daikin-hbl.de
 * (daikin-hbl.de redirige aujourd'hui vers www.opel-hbl.de — changement de
 * sponsor titre ; robots.txt = 404, aucun WAF, le fetch https direct marche).
 *
 *   GET /api/synergy/seasons?competitionId=…              → liste des saisons
 *   GET /api/synergy/season-statistic/player-overview
 *         ?seasonId=…&statisticType=fieldplayer|goalkeeper
 *
 * Réponse JSON : { data:[{ entity:{id}, person:{id}, statistics:{…} }],
 *                  includes.resources.{ entities:{id→club}, persons:{id→joueur} } }
 * → jointure des ids : joueur = persons.nameFullLatin,
 *                      équipe = entities.nameFullLatin + codeLatin (code 3 lettres).
 *
 * Les 2 endpoints (fieldplayer + goalkeeper) retournent TOUS les joueurs :
 *   - un gardien dans fieldplayer a des stats de champ à 0 → exclu via la
 *     preuve gardien (saveAccuracy/shotsSaved/goalsAgainst > 0) du 2nd endpoint ;
 *   - un joueur de champ dans goalkeeper a saveAccuracy = null → exclu pareil.
 *
 * Sortie : data/hbl_players.json
 *   { scraped_at, competition, season, source, total, teams, players:[{
 *       name, team, teamCode, competition, position: "GK"|"Field",
 *       goals, assists, games, minutes, savePct, saves, goalsAgainst,
 *       sevenMGoals, avgGoals }] }
 *   Écriture all-or-nothing : toute échec (réseau / 0 joueur) → rien écrit,
 *   pour ne jamais écraser un fichier bon par un run partiel.
 *
 * Usage :
 *   node scripts/scrape-hbl-players.js                     # hbl + dhb-pokal
 *   node scripts/scrape-hbl-players.js --competition=hbl   # 1.HBL seule
 *   node scripts/scrape-hbl-players.js --competition=dhb-pokal
 *   node scripts/scrape-hbl-players.js --dry-run           # parse sans écrire
 *   node scripts/scrape-hbl-players.js --out=/tmp/x.json
 *
 * ⚠️ --competition=ciblé ÉCRASE le fichier (mode debug) ; le défaut "all"
 *    produit le fichier complet consommé par src/lib/handball-players.ts.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://www.opel-hbl.de';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const REFERER = 'https://www.opel-hbl.de/en/hbl/statistics/field-player/field-player';
const HTTP_TIMEOUT_MS = 30000;
const RETRIES = 2;
const DELAY_MS = 700;

// Compétitions HBL identifiées par probe Playwright 2026-09-24
// (competitionId extraits du payload Nuxt __NUXT_DATA__ des pages stats).
const COMPETITIONS = {
  hbl: {
    competitionId: '4c445e5c-3956-11ef-9d0e-b74f5c057367',
    label: '1.HBL',
    // Repli si /seasons est en panne : saison active du 24/09/2026.
    fallbackSeasonId: 'c4a3125f-79f2-11f1-9a19-5f7c8c2ed877',
  },
  'dhb-pokal': {
    competitionId: '4c63aab5-3956-11ef-b0a5-b74f5c057367',
    label: 'DHB-Pokal',
    fallbackSeasonId: 'aa6c3650-6bbf-11f1-8b84-dda140c9c284',
  },
};

const SCRIPT_DIR = path.dirname(__filename);
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_OUT = path.join(REPO_DIR, 'data', 'hbl_players.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Normalisation insensible accents/casse/ponctuation — miroir exact de
 * normHandballName (src/lib/handball-logos.ts). Dupliqué car le script est
 * zéro-dép en JS et ne peut pas importer du TS.
 */
function normHandballName(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Durée ISO 8601 ("PT122M50S") → minutes entières. */
function parseIsoMinutes(iso) {
  if (typeof iso !== 'string' || !iso.startsWith('PT')) return undefined;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return undefined;
  const total = Number(m[1] || 0) * 60 + Number(m[2] || 0) + Number(m[3] || 0) / 60;
  return Math.round(total);
}

const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;

// ─── HTTP fetch JSON (pattern scrape-flashscore-handball.js) ─────────────────
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

// ─── Saison ──────────────────────────────────────────────────────────────────
/** Libellé de saison sur l'année uniquement ("2026/27") — le nameLatin est
 *  porteur du nom de compétition, à éviter en champ `season` commun. */
function seasonLabel(season) {
  const y = Number(season && season.year) || new Date().getUTCFullYear();
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

/** Résout la saison ACTIVE d'une compétition (repli : année max, puis id figé). */
async function resolveSeason(comp) {
  try {
    const seasons = await fetchJson(
      `${API_BASE}/api/synergy/seasons?competitionId=${comp.competitionId}`
    );
    if (Array.isArray(seasons) && seasons.length) {
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
    console.error(
      `[hbl-players] seasons KO (${comp.label}) : ${err.message} → repli seasonId figé`
    );
    return { seasonId: comp.fallbackSeasonId, label: seasonLabel(null) };
  }
}

// ─── Parsing player-overview ─────────────────────────────────────────────────
/**
 * Ids de personnes pour lesquelles l'endpoint goalkeeper prouve un rôle de
 * gardien (accuracy renseignée, arrêts > 0 ou buts encaissés > 0).
 * Les joueurs de champ apparaissent dans le même endpoint avec des stats à
 * null/0 — ils sont donc absents de ce Set.
 */
function buildGkEvidenceSet(gkJson) {
  const set = new Set();
  for (const item of gkJson.data || []) {
    const st = item.statistics || {};
    const evidence =
      st.goalKeeperSaveAccuracy != null ||
      Number(st.goalKeeperShotsSaved || 0) > 0 ||
      Number(st.goalKeeperGoalsAgainst || 0) > 0;
    if (evidence && item.person && item.person.id) set.add(item.person.id);
  }
  return set;
}

/**
 * Transforme le JSON player-overview en joueurs normalisés.
 * @param {object} json        Réponse player-overview
 * @param {string} compKey     "hbl" | "dhb-pokal"
 * @param {"GK"|"Field"} position
 * @param {Set<string>} gkSet  Preuve gardien (voir buildGkEvidenceSet)
 */
function mapPlayers(json, compKey, position, gkSet) {
  const resources = (json.includes && json.includes.resources) || {};
  const persons = resources.persons || {};
  const entities = resources.entities || {};
  const out = [];

  for (const item of json.data || []) {
    const personId = item.person && item.person.id;
    const entity = entities[(item.entity && item.entity.id) || ''];
    const person = persons[personId || ''];
    const st = item.statistics || {};

    const name =
      person &&
      (person.nameFullLatin ||
        [person.nameGivenLatin, person.nameFamilyLatin].filter(Boolean).join(' '));
    const team = entity && entity.nameFullLatin;
    if (!name || !team) continue;

    const games = Number(st.games) || 0;
    if (games < 1) continue; // zéro match = moyennes inexploitables

    // Séparation GK / Field via la preuve gardien du endpoint goalkeeper
    const isGk = gkSet.has(personId);
    if (position === 'GK' && !isGk) continue;
    if (position === 'Field' && isGk) continue;

    const goals = Number(st.goalsScored) || 0;
    const player = {
      name,
      team,
      teamCode: (entity && entity.codeLatin) || undefined,
      competition: compKey,
      position,
      goals,
      assists: st.assists != null ? Number(st.assists) : undefined,
      games,
      minutes: parseIsoMinutes(st.timeOnPlayingField),
    };

    if (position === 'Field') {
      player.sevenMGoals = Number(st.sevenMetreGoalsScored) || 0;
      player.avgGoals = games > 0 ? round2(goals / games) : undefined;
    } else {
      player.saves = Number(st.goalKeeperShotsSaved) || 0;
      player.goalsAgainst = Number(st.goalKeeperGoalsAgainst) || 0;
      player.savePct =
        st.goalKeeperSaveAccuracy != null ? round1(Number(st.goalKeeperSaveAccuracy)) : undefined;
    }

    out.push(player);
  }
  return out;
}

// ─── Scraping d'une compétition ──────────────────────────────────────────────
async function scrapeCompetition(compKey) {
  const comp = COMPETITIONS[compKey];
  const { seasonId, label } = await resolveSeason(comp);
  console.log(`[hbl-players] ${comp.label} — saison ${label} (${seasonId})`);

  const fieldUrl =
    `${API_BASE}/api/synergy/season-statistic/player-overview` +
    `?seasonId=${seasonId}&statisticType=fieldplayer`;
  const gkUrl =
    `${API_BASE}/api/synergy/season-statistic/player-overview` +
    `?seasonId=${seasonId}&statisticType=goalkeeper`;

  const fieldJson = await fetchJson(fieldUrl);
  await sleep(DELAY_MS);
  const gkJson = await fetchJson(gkUrl);

  const gkSet = buildGkEvidenceSet(gkJson);
  const field = mapPlayers(fieldJson, compKey, 'Field', gkSet);
  const gk = mapPlayers(gkJson, compKey, 'GK', gkSet);
  const players = [...field, ...gk];

  console.log(
    `[hbl-players] ${comp.label} : ${field.length} joueurs de champ, ${gk.length} gardiens`
  );
  if (!players.length) {
    throw new Error(`${comp.label} : 0 joueur (saison non démarrée ?)`);
  }
  return { compKey, label, players };
}

// ─── Contrôle de couverture (Stuttgart & Erlangen exigés par l'UI) ──────────
function checkCoverage(players) {
  const teams = [...new Set(players.map((p) => p.team))];
  console.log(`[hbl-players] ${teams.length} équipes couvertes`);
  for (const needle of ['stuttgart', 'erlangen']) {
    const hit = teams.find((t) => normHandballName(t).includes(needle));
    console.log(`[hbl-players] couverture ${needle} : ${hit || 'ABSENTE ⚠️'}`);
  }
  return teams.length;
}

/** Tri : joueurs de champ par buts, puis gardiens par % d'arrêts. */
function sortPlayers(players) {
  players.sort((a, b) => {
    if (a.position !== b.position) return a.position === 'Field' ? -1 : 1;
    if (a.position === 'Field') {
      return b.goals - a.goals || (b.assists || 0) - (a.assists || 0) || a.name.localeCompare(b.name);
    }
    return (
      (b.savePct ?? -1) - (a.savePct ?? -1) ||
      (b.saves || 0) - (a.saves || 0) ||
      a.name.localeCompare(b.name)
    );
  });
  return players;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);

function argValue(name) {
  for (let i = 0; i < ARGS.length; i++) {
    if (ARGS[i] === name && i + 1 < ARGS.length) return ARGS[i + 1];
    if (ARGS[i].startsWith(name + '=')) return ARGS[i].slice(name.length + 1);
  }
  return undefined;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const dryRun = ARGS.includes('--dry-run');
  const compArg = (argValue('--competition') || 'all').toLowerCase();
  const outArg = argValue('--out');
  const outPath = outArg ? path.resolve(outArg) : DEFAULT_OUT;

  const keys = compArg === 'all' ? Object.keys(COMPETITIONS) : [compArg];
  for (const k of keys) {
    if (!COMPETITIONS[k]) {
      console.error(
        `[hbl-players] compétition inconnue "${k}" (attendu : hbl | dhb-pokal | all)`
      );
      process.exit(1);
    }
  }

  console.log(
    `[hbl-players] out=${outPath} competition=${compArg}${dryRun ? ' (dry-run)' : ''}`
  );

  // All-or-nothing : la moindre compétition en échec annule tout le run.
  const all = [];
  const labels = new Set();
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) await sleep(DELAY_MS);
    const res = await scrapeCompetition(keys[i]);
    all.push(...res.players);
    labels.add(res.label);
  }

  sortPlayers(all);
  const teams = checkCoverage(all);

  const output = {
    scraped_at: new Date().toISOString(),
    competition: compArg,
    season: [...labels].join(', '),
    source: 'daikin-hbl.de → opel-hbl.de (API Synergy/Sportradar)',
    total: all.length,
    teams,
    players: all,
  };

  if (dryRun) {
    console.log(
      JSON.stringify({ ...output, players: all.slice(0, 5) }, null, 2)
    );
    console.log(`[hbl-players] dry-run : ${all.length} joueurs, fichier NON écrit`);
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(
    `[hbl-players] ✅ ${output.total} joueurs (${output.teams} équipes) → ${outPath}`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[hbl-players] FATAL:', err.message);
    console.error('[hbl-players] rien écrit (all-or-nothing) — le fichier existant est conservé');
    process.exit(1);
  });
}

module.exports = {
  normHandballName,
  parseIsoMinutes,
  buildGkEvidenceSet,
  mapPlayers,
  sortPlayers,
  seasonLabel,
};
