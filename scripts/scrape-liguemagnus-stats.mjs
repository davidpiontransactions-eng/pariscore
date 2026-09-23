/**
 * scrape-liguemagnus-stats.mjs
 * Scrape les stats OFFICIELLES Synerglace Ligue Magnus (pages rendues serveur).
 *   - /classement/                  → standings (Pts MJ V VPrl DPrl D BP BC Pen)
 *   - /statistiques-individuelles/  → joueurs (MJ B A Pts +/- Pén BSup) + gardiens
 *   - /statistiques-collectives/    → PP/PK, séries, tirs, affluences
 * Sortie : data/liguemagnus_stats.json
 * Usage : node scripts/scrape-liguemagnus-stats.mjs [--season=2027]
 * Note : /calendrier/ = chargé en admin-ajax (non couvert ici, cf. TODO mémoire).
 */
import https from 'node:https';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'liguemagnus_stats.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'fr-FR,fr;q=0.9' },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://liguemagnus.com' + res.headers.location;
        return resolve(fetchPage(loc));
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode + ' ' + url)); return; }
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout ' + url)); });
    req.on('error', reject);
  });
}

// Lignes de tableau HTML → arrays de cellules texte
function tableRows(html) {
  const rows = [];
  for (const rm of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rm[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((c) => c.length > 0);
    if (cells.length >= 3) rows.push(cells);
  }
  return rows;
}

// Découpe le HTML par sections titrées (h2/h3/div.section) → { titre: rows }
function sections(html) {
  const out = {};
  const parts = html.split(/<h[23][^>]*>/i);
  for (const part of parts.slice(1)) {
    const title = part.split('<')[0].replace(/\s+/g, ' ').trim();
    if (!title) continue;
    out[title] = tableRows(part);
  }
  return out;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }));

  const output = {
    updatedAt: new Date().toISOString(),
    source: 'liguemagnus.com (officiel Synerglace)',
    season: args.season ?? '2027',
    standings: [],
    players: {},
    teams: {},
  };

  // 1. Classement
  try {
    const html = await fetchPage('https://liguemagnus.com/classement/');
    // Table principal : RG Équipe Pts MJ V VPrl DPrl D BP BC Pen
    const rows = tableRows(html).filter((r) => r.length >= 8 && /^\d+$/.test(r[0]));
    output.standings = rows.map((r) => ({
      rank: parseInt(r[0], 10),
      team: r[1],
      pts: parseInt(r[2], 10),
      gp: parseInt(r[3], 10),
      w: parseInt(r[4], 10),
      otw: parseInt(r[5], 10),
      otl: parseInt(r[6], 10),
      l: parseInt(r[7], 10),
      gf: parseInt(r[8] ?? '0', 10),
      ga: parseInt(r[9] ?? '0', 10),
      pen: parseInt(r[10] ?? '0', 10),
    }));
    console.log(`[liguemagnus] standings: ${output.standings.length} équipes`);
  } catch (e) {
    console.warn(`[liguemagnus] classement: ${e.message}`);
  }
  await sleep(3000);

  // 2. Stats individuelles (sections : Meilleurs pointeurs/buteurs/assistants + Gardiens)
  try {
    const html = await fetchPage('https://liguemagnus.com/statistiques-individuelles/');
    const secs = sections(html);
    for (const [title, rows] of Object.entries(secs)) {
      const players = rows
        .filter((r) => r.length >= 6 && (r.some((c) => /^[A-ZÉÈÊÀÔÛÇ' -]+$/.test(c)) || r.some((c) => /\d/.test(c))))
        .map((r) => ({ cells: r }));
      if (players.length > 0) output.players[title] = players;
    }
    console.log(`[liguemagnus] players: ${Object.keys(output.players).length} sections`);
  } catch (e) {
    console.warn(`[liguemagnus] individuelles: ${e.message}`);
  }
  await sleep(3000);

  // 3. Stats collectives (sections : Supériorité/Infériorité numérique, Séries, Tirs, Affluences)
  try {
    const html = await fetchPage('https://liguemagnus.com/statistiques-collectives/');
    const secs = sections(html);
    for (const [title, rows] of Object.entries(secs)) {
      const teams = rows
        .filter((r) => r.length >= 3)
        .map((r) => ({ cells: r }));
      if (teams.length > 0) output.teams[title] = teams;
    }
    console.log(`[liguemagnus] teams: ${Object.keys(output.teams).length} sections`);
  } catch (e) {
    console.warn(`[liguemagnus] collectives: ${e.message}`);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`[liguemagnus] Saved → ${OUT}`);
}

main().catch((e) => { console.error('[liguemagnus] Fatal:', e.message); process.exit(1); });
