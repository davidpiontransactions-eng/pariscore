#!/usr/bin/env node
'use strict';
/**
 * scrape-flashscore-handball.js
 * ------------------------------
 * Routine : programme handball Flashscore (feed interne J+0..J+7).
 *
 * Source : https://2.flashscore.ninja/2/x/feed/f_7_{day}_1_en_1
 * Sortie : data/flashscore_handball.json { updatedAt, source, matches[] }
 *
 * Feed codes handball (mapping VÉRIFIÉ empiriquement sur le feed brut
 * le 2026-09-24 — 248 matchs terminés J-7..J0 + cross-check betexplorer) :
 *   CX/AE = domicile, AF = extérieur, AD = timestamp kickoff,
 *   AG = score final LOCAUX, AH = score final VISITEURS,
 *   BA = buts LOCAUX à la MT, BB = buts VISITEURS à la MT,
 *   AT/AU = score à 60' (régulation) — identique à AG/AH sauf prolongation
 *           (5/248 OT : AT = AU = nul à 60', ex. Grindsted 29-29 → 30-38),
 *   BC/BD = 2e mi-temps, BE/BF/RPA/RPB = buts prolongation (non exposés),
 *   AS/AZ = statut (1=live, 2=finished)
 * Bug #10 (avant fix) : AG/AT écrits en mi-temps et AH/AU en final →
 *   score = "visiteur-visiteur" (A-A) et MT = "local-local".
 *
 * Usage :
 *   node scripts/scrape-flashscore-handball.js              # J-7..J+7
 *   node scripts/scrape-flashscore-handball.js --days=3     # J-7..J+3
 *   node scripts/scrape-flashscore-handball.js --dry-run    # parse sans écrire
 *
 * Cron VPS : pm2 `pariscore-cron-flashscore-handball`, toutes les 4 h.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FEED_BASE = 'https://2.flashscore.ninja/2/x/feed';
const SPORT_HANDBALL = 7;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const XSIGN = process.env.FLASH_XFSIGN || 'SW9D1eZo';
const HTTP_TIMEOUT_MS = 25000;
const DELAY_MS = 800;
const MAX_DAYS = 7;
/**
 * Profondeur d'historique récupérée EN PLUS de la fenêtre à venir.
 *
 * ⚠️ Fix 2026-10-04 — cause racine de l'onglet « Résultats » figé : le script ne
 * récupérait que J-1 et J+0..J+N, puis ÉCRASSAIT le fichier. Un match
 * « à venir » au run de J-2 était donc SUPPRIMÉ au run de J-1 avant d'avoir
 * jamais reçu son score final : le snapshot ne pouvait structurellement
 * contenir des scores que pour J-1 et J+0. La fenêtre glissante de 7 jours ne
 * pouvait donc jamais être remplie par ce fichier, et son unique source de
 * profondeur (handball_match_history, cron HEBDOMADAIRE) laissait un trou de
 * 6 jours. Deux changements : on remonte jusqu'à J-7, et on fusionne au lieu
 * d'écraser (voir mergeSnapshots).
 */
const HISTORY_DAYS = 7;
const RETRIES = 2;

const SCRIPT_DIR = path.dirname(__filename);

/**
 * Vrai si le match porte un SCORE FINAL exploitable.
 * Deux séparateurs coexistent et les deux doivent passer :
 *   - « 32 - 28 » : format RÉELLEMENT produit par flush() (`${homeFT} - ${awayFT}`,
 *     ligne ~146) — c'est celui du snapshot prod ;
 *   - « 32:28 » : format de l'historique BetExplorer et des tests.
 * Fix 2026-10-06 : la regex n'acceptait que « : » → freshFinished ≡ 0 à chaque
 * run → la garde de main() annulait l'écriture → snapshot figé au 2026-09-28
 * (calendrier + Top 10 vides en prod, bead ParisScorebis-1gge).
 * Un match « à venir » a `score` vide ou non numérique → false.
 */
function hasFinalScore(m) {
  return typeof m?.score === 'string' && /^\d{1,3}\s*[:\-]\s*\d{1,3}$/.test(m.score.trim());
}

/**
 * Clé d'identité d'un match du snapshot.
 *
 * La clé doit décrire le match ENTIÈREMENT : événement + équipes + coup d'envoi.
 * Deux clés plus laxes ont été essayées et rejetées sur données réelles (snapshot
 * VPS du 2026-10-08, 1408 matchs) :
 *  - `id` seul → 5 COLLISIONS : le feed réemploie le même id sur deux matchs
 *    différents (ex. `fs-AR0BBBdl` = Ramat Hasharon – MK Beer Sheva ET le
 *    match retour, quelques minutes plus tard). Fusionner par id aurait
 *    SUPPRIMÉ un vrai match du calendrier ;
 *  - `id|équipes` seul → 50 paires d'aller-retour légitimes (ex.
 *    `fs-xhNzXglB` = Dalmatinka W – Zrinski W les 30/09 ET le 14/10) : là
 *    encore, la fusion aurait effacé un rendez-vous réel.
 * Seule la clé complète est sans risque : deux lignes ne se fusionnent que si
 * elles décrivent littéralement le même match.
 */
function snapshotKey(m) {
  return `${m.id ?? ''}|${m.home}|${m.away}|${m.time}`;
}

/** Deux matchs sont le MÊME rendez-vous vu par deux fichiers-jour du feed. */
function sameFixtureKey(m) {
  return `${m.id ?? ''}|${m.home}|${m.away}`;
}

/**
 * Ajoute un match au lot du run s'il est nouveau (déduplication inter-jours :
 * le même rendez-vous est réinjecté par les boucles J-1, J+N et J-2..J-7).
 * @returns true si le match a été ajouté.
 */
function pushUnique(all, seen, m) {
  const k = snapshotKey(m);
  if (!seen.has(k)) {
    seen.set(k, all.length);
    all.push(m);
    return true;
  }
  return false;
}

/**
 * Complète le coup d'envoi manquant à partir d'un jumeau complet.
 *
 * Le feed omet la clé `AD` sur certaines lignes : l'entrée sort avec
 * `time: ""`, et `toHandballMatch` horodate alors le match à l'INSTANT DU SCRAPE
 * (`new Date().toISOString()`) → mauvais jour de calendrier, heure fantaisiste
 * (le symptôme « Magdeburg – Kiel à 00:15 » au lieu de 19:00). On rattache donc
 * l'heure du jumeau — même événement, mêmes équipes, une seule heure candidate.
 *
 * Garde-fou quand plusieurs heures sont candidates (aller-retour) : on n'adopte
 * que celle qui n'est DÉJÀ portée par aucune autre ligne du même couple, sinon
 * on laisse la ligne sans heure plutôt que de lui donner une heure qui appartient
 * à un autre match.
 *
 * @returns le nombre de lignes réparées.
 */
function repairMissingTimes(matches) {
  const timed = new Map();
  for (const m of matches) {
    if (!m.time) continue;
    const k = sameFixtureKey(m);
    if (!timed.has(k)) timed.set(k, new Set());
    timed.get(k).add(m.time);
  }
  let fixed = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (m.time) continue;
    const set = timed.get(sameFixtureKey(m));
    if (!set || set.size !== 1) continue;
    const [only] = [...set];
    matches[i] = { ...m, time: only };
    set.delete(only); // une heure ne répare qu'une seule ligne
    fixed++;
  }
  return fixed;
}

/**
 * Retire les lignes « fantômes » : sans heure ET sans score final, on ne peut ni
 * les placer sur un jour de calendrier ni les compter comme résultat — les
 * laisser produirait un match « à venir » horodaté à l'heure du scrape.
 * Une ligne SANS heure mais AVEC score est conservée : elle reste dans
 * l'historique des résultats, et son statut `finished` l'exclut déjà du
 * calendrier des matchs à venir.
 */
function dropUnplaceable(matches) {
  return matches.filter((m) => m.time || hasFinalScore(m));
}

/**
 * Fusionne un snapshot précédent avec le snapshot frais.
 *
 * Règles à la clé d'identité (`snapshotKey`) :
 *  - le frais est plus à jour → il gagne sur tout SAUF deux choses immuables ;
 *  - `time` : on ne dégrade JAMAIS un kickoff connu en « inconnu » (le snapshot
 *    est accumulatif, donc une heure vue une fois est conservée pour toujours) ;
 *  - `score` : un score final est immuable → s'il est déjà connu on le garde,
 *    même si le feed rejoue le match en cours avec un score provisoire.
 *
 * Les doublons INTERNES à `previous` sont fusionnés eux aussi : sans cela un
 * fichier déjà pollué (deux lignes pour le même match, l'une sans heure) ne
 * se résorbait jamais, car la clé de la 2ᵉ ligne n'était jamais visitée.
 *
 * L'ordre de sortie est : entrées fraîches (dans leur ordre), puis entrées
 * previous orphelines (absentes du frais). Stable et déterministe.
 */
function mergeSnapshots(previous, fresh) {
  const out = [];
  const index = new Map();
  const absorb = (m) => {
    const k = snapshotKey(m);
    const at = index.get(k);
    if (at === undefined) {
      index.set(k, out.length);
      out.push(m);
      return;
    }
    const old = out[at];
    const merged = { ...m };
    if (!m.time && old.time) merged.time = old.time;
    if (hasFinalScore(old)) merged.score = old.score;
    out[at] = merged;
  };
  for (const m of previous || []) absorb(m);
  for (const m of fresh || []) absorb(m);
  return out;
}

/** Lit le snapshot précédent sans le faire tomber (fichier absent/corrompu → []). */
function readPrevious(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(raw?.matches) ? raw.matches : [];
  } catch {
    return [];
  }
}
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DEFAULT_OUT = path.join(REPO_DIR, 'data', 'flashscore_handball.json');

// ─── Status mapping ──────────────────────────────────────────────────────────
function mapStatus(raw) {
  const s = (raw || '').toString().trim();
  if (s === '1') return 'live';
  if (s === '2') return 'finished';
  if (s === '3') return 'cancelled';
  if (s === '4') return 'postponed';
  return 'scheduled';
}

function parseTimestamp(ts) {
  const n = parseInt(ts, 10);
  if (Number.isInteger(n) && n > 1000000000) return new Date(n * 1000).toISOString();
  return null;
}

// ─── Parser le feed Flashscore handball ───────────────────────────────────────
function parseDay(body) {
  const matches = [];
  const tokens = body.split('\u00AC').filter(Boolean);

  let curLeague = '';
  let curCountry = '';
  let cur = null;

  const flush = () => {
    if (cur && cur.id && cur.home && cur.away) {
      // Construire le score
      let score = null;
      if (cur.homeFT != null && cur.awayFT != null) {
        score = `${cur.homeFT} - ${cur.awayFT}`;
      }

      matches.push({
        id: `fs-${cur.id}`,
        time: cur.kickoff || '',
        home: cur.home,
        away: cur.away,
        score,
        isLive: cur.status === 'live',
        isFinished: cur.status === 'finished',
        league: curLeague,
        country: curCountry,
        odds: cur.odds || [],
        minute: cur.minute,
        homeHalf: cur.homeHT,
        awayHalf: cur.awayHT,
      });
    }
    cur = null;
  };

  for (const tok of tokens) {
    const t = tok.trim();
    if (!t) continue;

    // En-tête de compétition
    if (t.startsWith('~ZA\u00F7')) {
      flush();
      const raw = t.slice(4).trim();
      const parts = raw.split(':');
      if (parts.length >= 2) {
        curCountry = parts[0].trim();
        curLeague = parts.slice(1).join(':').trim();
      } else {
        curCountry = '';
        curLeague = raw;
      }
      continue;
    }

    // Ligne de match
    if (t.startsWith('~AA\u00F7')) {
      flush();
      // On ne garde que le TIRET alphanumérique : le feed colle parfois la clé
      // de kickoff sur la même ligne (`<id><2 octets>AD÷<epoch>`), et le suffixe
      // entrait dans l'id — donc dans la clé de fusion. Conséquence mesurée :
      // 2 matchs/jour avec un id différent de leur jumeau, jamais fusionnés.
      cur = { id: (t.slice(4).trim().match(/^[A-Za-z0-9]+/) || [''])[0] };
      continue;
    }

    // Ignorer les séparateurs
    if (t === '~' || t.startsWith('~~') || t.startsWith('~QA') ||
        t.startsWith('~FG') || t.startsWith('~SG') || t.startsWith('~OAJ')) {
      continue;
    }

    // Clé-valeur
    const sep = t.indexOf('\u00F7');
    if (sep < 0 || !cur) continue;
    const k = t.slice(0, sep).trim().toUpperCase();
    const v = t.slice(sep + 1).trim();

    switch (k) {
      case 'AD': {
        if (!cur.ts) {
          cur.ts = parseInt(v, 10);
          const iso = parseTimestamp(v);
          if (iso) cur.kickoff = iso;
        }
        break;
      }
      case 'CX': // Home team (short)
      case 'AE': // Home team (full)
        if (!cur.home || k === 'AE') cur.home = v;
        break;
      case 'AF': // Away team (full)
        cur.away = v;
        break;
      // Clés de score — mapping vérifié empiriquement sur le feed brut
      // (2026-09-24, 248 matchs terminés, invariants BA+BC(+BE) = AG et
      // BB+BD(+BF) = AH, cross-check betexplorer) :
      //   AG/AH = final local/visiteur · BA/BB = MT local/visiteur
      //   AT/AU = score à 60' (régulation, ignoré : ≠ final si prolongation)
      //   BC/BD = 2e MT · BE/BF/RPA/RPB = prolongation (ignorés)
      case 'AG': // Score final LOCAUX
        cur.homeFT = parseInt(v, 10);
        break;
      case 'AH': // Score final VISITEURS
        cur.awayFT = parseInt(v, 10);
        break;
      case 'BA': // Buts LOCAUX à la mi-temps
        cur.homeHT = parseInt(v, 10);
        break;
      case 'BB': // Buts VISITEURS à la mi-temps
        cur.awayHT = parseInt(v, 10);
        break;
      case 'AS': // Statut principal
      case 'AZ': // Statut alternatif
        if (!cur.status || cur.status === 'scheduled') {
          cur.status = mapStatus(v);
        }
        break;
      case 'AO': // Elapsed / last update
        if (cur.status === 'live') {
          const elapsed = parseInt(v, 10);
          if (!isNaN(elapsed) && elapsed > 1000000000) {
            // C'est un timestamp, pas des minutes
            cur.minute = Math.floor((Date.now() / 1000 - elapsed) / 60);
          }
        }
        break;
      // Cotes 1X2
      case 'OD': {
        if (!cur.odds) cur.odds = [];
        const o = parseFloat(v);
        if (o > 1 && o < 100) cur.odds[0] = o;
        break;
      }
      case 'OE': {
        if (!cur.odds) cur.odds = [];
        const o = parseFloat(v);
        if (o > 1 && o < 100) cur.odds[1] = o;
        break;
      }
      case 'OF': {
        if (!cur.odds) cur.odds = [];
        const o = parseFloat(v);
        if (o > 1 && o < 100) cur.odds[2] = o;
        break;
      }
    }
  }

  flush();
  return matches;
}

// ─── HTTP fetch ──────────────────────────────────────────────────────────────
async function fetchFeed(url) {
  return new Promise((resolve, reject) => {
    const attempt = (left) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: 'https://www.flashscore.com/',
          'x-fsign': XSIGN,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: '*/*',
        },
      }, (res) => {
        let s = '';
        res.on('data', (d) => { s += d; });
        res.on('end', () => {
          if (res.statusCode === 200) return resolve(s);
          if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
          reject(new Error(`HTTP ${res.statusCode}`));
        });
      });
      req.on('error', (e) => {
        if (left > 0) return setTimeout(() => attempt(left - 1), 2000);
        reject(e);
      });
      req.setTimeout(HTTP_TIMEOUT_MS, () => { req.destroy(new Error('timeout')); });
    };
    attempt(RETRIES);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const daysRaw = argValue('--days');
  const days = Math.min(MAX_DAYS, Math.max(0, parseInt(daysRaw ?? '7', 10) || 0));
  const dryRun = ARGS.includes('--dry-run');
  const outArg = argValue('--out');
  const outPath = outArg ? path.resolve(outArg) : DEFAULT_OUT;
  console.log(`[flashscore-handball] out=${outPath} days=0..${days}${dryRun ? ' (dry-run)' : ''}`);

  // Inclure hier (J-1) pour les matchs terminés + aujourd'hui..J+N pour les à venir
  const all = [];
  const seen = new Map();
  let emptyStreak = 0;

  // J-1 (matchs terminés pour le form store)
  try {
    const body = await fetchFeed(`${FEED_BASE}/f_${SPORT_HANDBALL}_-1_1_en_1`);
    const parsed = parseDay(body);
    for (const m of parsed) pushUnique(all, seen, m);
    console.log(`[flashscore-handball] J-1: ${parsed.length} matchs`);
  } catch (err) {
    console.error(`[flashscore-handball] J-1 KO: ${err.message}`);
  }
  await sleep(DELAY_MS);

  for (let day = 0; day <= days; day++) {
    if (day > 0) await sleep(DELAY_MS);
    let body = '';
    try {
      const url = `${FEED_BASE}/f_${SPORT_HANDBALL}_${day}_1_en_1`;
      body = await fetchFeed(url);
    } catch (err) {
      console.error(`[flashscore-handball] J+${day} KO: ${err.message}`);
      continue;
    }
    const parsed = parseDay(body);
    let added = 0;
    for (const m of parsed) {
      if (pushUnique(all, seen, m)) added += 1;
    }
    console.log(`[flashscore-handball] J+${day}: ${parsed.length} matchs (${added} nouveaux)`);
    emptyStreak = parsed.length === 0 ? emptyStreak + 1 : 0;
    if (emptyStreak >= 2) {
      console.log('[flashscore-handball] 2 jours vides consecutifs -> stop');
      break;
    }
  }

  // Historique J-7..J-2 : ALORS SEULEMENT les matchs qui ont un score final.
  // Filtre sur le score, sinon on réintroduirait des « à venir » déjà couverts
  // par la boucle J+0..J+N et on gonflerait le fichier sans gain.
  for (let back = 2; back <= HISTORY_DAYS; back++) {
    await sleep(DELAY_MS);
    let body = '';
    try {
      body = await fetchFeed(`${FEED_BASE}/f_${SPORT_HANDBALL}_-${back}_1_en_1`);
    } catch (err) {
      console.error(`[flashscore-handball] J-${back} KO: ${err.message}`);
      continue;
    }
    const parsed = parseDay(body);
    let added = 0;
    for (const m of parsed) {
      if (!hasFinalScore(m)) continue;
      if (pushUnique(all, seen, m)) added += 1;
    }
    console.log(`[flashscore-handball] J-${back}: ${parsed.length} matchs (${added} termines ajoutes)`);
  }

  console.log(`[flashscore-handball] total: ${all.length} matchs`);

  if (dryRun) {
    console.log(JSON.stringify(all.slice(0, 5), null, 2));
    return;
  }

  // ── Fusion avec l'existant (ne JAMAIS ecraser un historique valide) ──
  const previous = readPrevious(outPath);
  let merged = mergeSnapshots(previous, all);
  console.log(
    `[flashscore-handball] fusion: ${previous.length} precedent(s) + ${all.length} frais -> ${merged.length}`,
  );

  // ── Gauges ───────────────────────────────────────────────────────────────
  // Le feed omet `AD` sur certaines lignes. Tant que l'heure manque, la ligne
  // reste une SECONDE copie du meme match (cle differente) : on la rattache
  // d'abord, puis on relit le fichier pour fusionner les copies redevenues
  // identiques. Ordre IMPORTANT : reparer avant re-fusionner, sinon la cle de
  // la copie sans heure ne rejoint plus jamais celle de son jumeau.
  const repaired = repairMissingTimes(merged);
  if (repaired > 0) console.log(`[flashscore-handball] kickoff manquant: ${repaired} ligne(s) rattachee(s)`);
  if (repaired > 0) merged = mergeSnapshots(merged, []);
  const beforeDrop = merged.length;
  merged = dropUnplaceable(merged);
  if (beforeDrop !== merged.length) {
    console.log(
      `[flashscore-handball] ${beforeDrop - merged.length} ligne(s) fantome(s) retirees (ni heure ni score)`,
    );
  }
  if (merged.length !== mergeSnapshots(previous, all).length) {
    console.log(`[flashscore-handball] fusion finale: ${merged.length} matchs`);
  }

  const freshFinished = all.filter(hasFinalScore).length;
  const mergedFinished = merged.filter(hasFinalScore).length;
  // Garde-fou : si le run frais n'a rapporte AUCUN score final (WAF, 403,
  // coupure reseau) alors que le fichier precedent en contenait, on ne remplace
  // pas un historique valide par un quasi-vide. Sans ce garde, un run en echec
  // effacait 6 jours de resultats — le mode de panne observe le 28/09.
  if (previous.length > 0 && freshFinished === 0 && previous.some(hasFinalScore)) {
    console.error(
      `[flashscore-handball] ARRET : run sans aucun score final (0/${all.length}) alors que le ` +
        `fichier precedent en contient — ecriture ANNULEE, historique conserve`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `[flashscore-handball] scores finaux : ${freshFinished} frais, ${mergedFinished} apres fusion`,
  );

  const output = {
    scraped_at: new Date().toISOString(),
    source: 'flashscore',
    sport: 'handball',
    live_only: false,
    total: merged.length,
    matches: merged,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[flashscore-handball] ✅ ${output.total} matchs -> ${outPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[flashscore-handball] FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = {
  parseDay,
  fetchFeed,
  hasFinalScore,
  mergeSnapshots,
  readPrevious,
  snapshotKey,
  pushUnique,
  repairMissingTimes,
  dropUnplaceable,
  sameFixtureKey,
};
