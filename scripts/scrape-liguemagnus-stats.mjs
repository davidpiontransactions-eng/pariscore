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

// Lignes de tableau HTML → arrays de cellules texte (alignées ou filtrées)
function tableRows(html, keepEmpty = false) {
  const rows = [];
  for (const rm of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    let cells = [...rm[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
      .map((c) => c[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
    if (!keepEmpty) cells = cells.filter((c) => c.length > 0);
    if (cells.length >= 3) rows.push(cells);
  }
  return rows;
}

// Toutes les tables du document avec leur en-tête + titre de section voisin
// (les titres de section ne sont PAS dans h2/h3 — texte brut avant la table)
function parseTables(html) {
  const tables = [];
  for (const tm of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
    const rows = tableRows(tm[1], true);
    if (rows.length < 2) continue;
    const header = rows[0].map((c) => c.trim());
    const before = html
      .slice(Math.max(0, tm.index - 1000), tm.index)
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const title = before.split(/[|.]/).pop()?.trim().slice(-60) ?? '';
    tables.push({ title, header, rows: rows.slice(1) });
  }
  return tables;
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

  // 2. Stats individuelles (tables : RG Nom Pos Équipe MJ B A Pts… + gardiens)
  try {
    const html = await fetchPage('https://liguemagnus.com/statistiques-individuelles/');
    for (const t of parseTables(html)) {
      const sig = t.header.join('|');
      const isSkater = /Pos/i.test(sig) && /Pts/i.test(sig);
      const isGoalie = /D[iî]f|BL|Arr|%|GAA|Moy/i.test(sig) && /MJ|Min/i.test(sig);
      if (!isSkater && !isGoalie) continue;
      const key = (t.title || (isGoalie ? 'Gardiens' : 'Joueurs')).slice(0, 60);
      output.players[key] = { header: t.header, rows: t.rows.filter((r) => /^\d+$/.test(r[0]?.trim())) };
    }
    console.log(`[liguemagnus] players: ${Object.keys(output.players).length} tables`);
  } catch (e) {
    console.warn(`[liguemagnus] individuelles: ${e.message}`);
  }
  await sleep(3000);

  // 3. Stats collectives (tables : Equipe MJ … — PP/PK, séries, tirs, affluences)
  try {
    const html = await fetchPage('https://liguemagnus.com/statistiques-collectives/');
    for (const t of parseTables(html)) {
      const sig = t.header.join('|');
      if (!/Equipe|MJ|Affl|Tirs|Nbre|%/i.test(sig)) continue;
      const key = (t.title || t.header.join(' ')).slice(0, 60);
      output.teams[key] = { header: t.header, rows: t.rows.filter((r) => r.some((c) => /[A-ZÉÈ]/.test(c))) };
    }
    console.log(`[liguemagnus] teams: ${Object.keys(output.teams).length} tables`);
  } catch (e) {
    console.warn(`[liguemagnus] collectives: ${e.message}`);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`[liguemagnus] Saved → ${OUT}`);
}

main().catch((e) => { console.error('[liguemagnus] Fatal:', e.message); process.exit(1); });
