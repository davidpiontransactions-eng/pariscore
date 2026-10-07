/**
 * scrape-eliteprospects-hockey.mjs
 * Scraper KHL + Ligue Magnus standings depuis eliteprospects.com (HTML statique, zero-dep).
 * Cibles :
 *   - https://www.eliteprospects.com/league/khl/standings/2026-2027
 *   - https://www.eliteprospects.com/league/ligue-magnus/standings/2026-2027
 * Sortie : data/eliteprospects_hockey_standings.json
 * Usage : node scripts/scrape-eliteprospects-hockey.mjs [--season=2026-2027]
 */
import https from 'node:https';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'eliteprospects_hockey_standings.json');

// ⚠️ UA — mesuré le 2026-10-05, ce n'est pas cosmétique.
// L'UA Chrome desktop (`Chrome/126`) reçoit désormais **HTTP 403 + challenge
// Cloudflare** sur `/league/*/standings/*` pour TOUTES les ligues (khl,
// ligue-magnus, nhl) depuis cette machine. L'UA iOS Safari passe (HTTP 200,
// 151-198 Ko, tableau présent). Le guard anti-écrasement en bas de fichier
// masquait l'échec : 0 équipes => on conservait le fichier périmé, donc un
// scraper cassé se_heap克利ait comme un scraper qui n'a rien à dire.
// On garde donc les DEUX UA et on bascule sur le premier qui répond 200.
const UAS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];

/**
 * Colonnes attendues, en ordre, après `#` et `Team`.
 *
 * Le parseur est POSITIONNEL : `cells.slice(2)` puis index fixes. C'est un
 * contrat, pas une commodité — et il n'est valable QUE pour le layout européen
 * (`GP W T L OTW OTL GF GA ...`), qui COMPREND une colonne `T` (nuls).
 *
 * La NHL n'a PAS de colonne `T` : y appliquer ce mapping décalerait
 * `L` dans `T`, `OTL` dans `L`, `PTS` dans `OTW`… et `GF`/`GA` atterriraient
 * n'importe où. Un `slice(2)` non vérifié ne donne pas 0 : il donne des
 * chiffres décalés qui PASSENT pour des mesures. D'où `assertLayout()` plus
 * bas, qui refuse d'écrire plutôt que d'écrire du décalé.
 */
const EXPECTED_COLUMNS = ['GP', 'W', 'T', 'L', 'OTW', 'OTL', 'GF', 'GA'];

const LEAGUES = [
  { id: 'khl', name: 'KHL', slug: 'khl', country: 'Russia', confLabels: ['Eastern Conference', 'Western Conference'] },
  { id: 'ligue-magnus', name: 'Ligue Magnus', slug: 'ligue-magnus', country: 'France', confLabels: [] },
  // NHL — ajoutée le 2026-10-05 pour des predictions NHL sur gf/ga réels
  // (elles dépendaient de gf/ga FABRIQUÉS, cf. lib/hockey/team-stats.ts).
  //
  // ⚠️ La NHL n'a PAS de colonne `T` (nuls) : son en-tête est
  // `GP W L OTL PTS P% GF GA ...`, donc le mapping positionnel européen ne
  // s'y applique PAS et l'appliquer décalerait L dans T et PTS dans OTW.
  // Le layout n'a PAS pu être mesuré (403 Cloudflare intermittent sur cette
  // machine). C'est exactement ce que `assertLayout()` refuse : la ligue est
  // déclarée, la tentative est faite, et si le layout ne colle pas elle sort à
  // 0 equipe AVEC le motif — au lieu d'écrire un classement décalé qui
  // ressemblerait à une mesure. Il faut mesurer l'en-tête NHL (via une IP
  // résidentielle ou FlareSolverr) et donner son propre mapping.
  { id: 'nhl', name: 'NHL', slug: 'nhl', country: 'USA', confLabels: ['Eastern Conference', 'Western Conference'] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchPageOnce(url, ua) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: 25000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const loc = res.headers.location.startsWith('http') ? res.headers.location : 'https://www.eliteprospects.com' + res.headers.location;
        return resolve(fetchPageOnce(loc, ua));
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

/** Essaie chaque UA jusqu'à obtenir un 200. Le 403 Cloudflare est un rejet net. */
async function fetchPage(url) {
  let lastErr;
  for (const ua of UAS) {
    try {
      return await fetchPageOnce(url, ua);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('aucun UA n a repondu ' + url);
}

/**
 * Vérifie que l'en-tête du tableau contient bien les colonnes qu'on lit par
 * position. Renvoie la liste des en-têtes, ou `null` si la structure ne matche
 * pas (le caller traite alors la ligue comme NON récupérée).
 *
 * C'est la seule défense contre un layout différent : la NHL, par exemple, n'a
 * pas de colonne `T`, donc `slice(2)` y produirait `L` dans `T` et `PTS` dans
 * `OTW` — des valeurs plausibles et fausses. Refuser vaut mieux qu'écrire.
 */
function readHeader(html) {
  const table = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!table) return null;
  const firstRow = table[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/);
  if (!firstRow) return null;
  const cells = (firstRow[1].match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g) || []).map((c) =>
    c.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  );
  return cells;
}

function assertLayout(cells) {
  if (!cells) return 'aucun tableau / aucune ligne d en-tete';
  const after = cells.slice(2, 2 + EXPECTED_COLUMNS.length).map((c) => c.toLowerCase());
  const idx = EXPECTED_COLUMNS.map((c) => after.indexOf(c.toLowerCase()));
  const missing = EXPECTED_COLUMNS.filter((_, i) => idx[i] === -1);
  if (missing.length) return 'colonnes attendues absentes: ' + missing.join(', ');
  if (!idx.every((v, i) => v === i)) {
    return 'ordre des colonnes inattendu -> ' + cells.slice(2).join(' ');
  }
  return null;
}

/**
 * Parse le HTML eliteprospects pour extraire les standings.
 * Structure: <table> avec lignes <tr> contenant <td> pour chaque colonne.
 * Les en-tetes de conference sont des lignes avec colspan.
 */
function parseStandings(html, league) {
  const teams = [];
  let currentConf = '';

  // Trouver le tableau principal (celui avec les standings)
  // Pattern: <table class="table ..."> ... </table>
  const tableMatch = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return teams;

  const tableHtml = tableMatch[1];

  // Extraire toutes les lignes <tr>
  const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g) || [];

  for (const row of rows) {
    // Ligne de conference (colspan)
    const confMatch = row.match(/colspan[^>]*>([^<]*(?:Conference)[^<]*)</i);
    if (confMatch) {
      currentConf = confMatch[1].trim();
      continue;
    }

    // Ligne d'equipe: extraire les <td>
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 10) continue;

    // Nettoyer le HTML de chaque cellule
    const cleanCells = cells.map((c) => {
      const text = c.replace(/<[^>]+>/g, '').trim();
      return text;
    });

    // Colonne # = rank, Team = nom avec lien, puis stats
    const rank = parseInt(cleanCells[0]);
    if (isNaN(rank)) continue;

    // Extraire le nom de l'equipe depuis la cellule Team (cellule 1)
    const teamCell = cells[1];
    const teamNameMatch = teamCell.match(/>([^<]+)<\/a>/);
    const teamName = teamNameMatch ? teamNameMatch[1].trim() : cleanCells[1];

    // Extraire le slug/ID de l'equipe depuis le lien
    const teamLinkMatch = teamCell.match(/href="[^"]*\/team\/(\d+)\/([^"]+)"/);
    const teamId = teamLinkMatch ? teamLinkMatch[1] : null;
    const teamSlug = teamLinkMatch ? teamLinkMatch[2] : null;

    // Parser les stats (GP, W, T, L, OTW, OTL, GF, GA, +/-, TP, PPG)
    const stats = cleanCells.slice(2).map((s) => {
      if (s === '-' || s === '' || s === '\\-') return null;
      return s;
    });

    teams.push({
      rank,
      name: teamName,
      teamId,
      teamSlug,
      conf: currentConf,
      gp: parseInt(stats[0]) || 0,
      w: parseInt(stats[1]) || 0,
      t: parseInt(stats[2]) || 0,
      l: parseInt(stats[3]) || 0,
      otw: parseInt(stats[4]) || 0,
      otl: parseInt(stats[5]) || 0,
      gf: parseInt(stats[6]) || 0,
      ga: parseInt(stats[7]) || 0,
      plusMinus: parseInt(stats[8]) || 0,
      tp: parseInt(stats[9]) || 0,
      ppg: parseFloat(stats[10]) || 0,
    });
  }

  return teams;
}

async function scrapeLeague(league, season) {
  const url = `https://www.eliteprospects.com/league/${league.slug}/standings/${season}`;
  console.log(`[ep] Fetching ${league.name} from ${url}`);

  try {
    const html = await fetchPage(url);
    console.log(`[ep] ${league.name}: ${html.length} bytes`);

    // Garde-fou de layout AVANT de parser quoi que ce soit.
    const layoutError = assertLayout(readHeader(html));
    if (layoutError) {
      console.error(`[ep] ${league.name} REFUSÉ — ${layoutError}`);
      console.error('[ep]   pas d écriture pour cette ligue : mieux vaut 0 equipe');
      console.error('[ep]   qu un classement decale passe pour une mesure.');
      return [];
    }

    const teams = parseStandings(html, league);
    console.log(`[ep] ${league.name}: parsed ${teams.length} teams`);

    return teams;
  } catch (err) {
    console.error(`[ep] ${league.name} error:`, err.message);
    return [];
  }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }));

  const season = args.season || '2026-2027';

  const results = {
    updatedAt: new Date().toISOString(),
    source: 'eliteprospects.com',
    season,
    leagues: {},
  };

  for (const league of LEAGUES) {
    const teams = await scrapeLeague(league, season);
    results.leagues[league.id] = {
      name: league.name,
      country: league.country,
      season,
      teams,
    };
    if (LEAGUES.indexOf(league) < LEAGUES.length - 1) {
      await sleep(2000); // rate limit
    }
  }

  // Anti-écrasement, PAR LIGUE (et plus seulement au global).
  //
  // La garde d'origine ne testait que `totalTeams === 0`. Suffisant pour le
  // scénario « tout le scrap est mort », aveugle sur « une ligue sur deux a
  // échoué » : KHL vide + Magnus ok = total > 0 => écriture => le classement
  // Magnus frais partait, remplacé par 0 equipe.
  //
  // Cloudflare rend les échecs PARTIELS plausibles (mesuré : 403 sur une ligue
  // et 200 sur l'autre dans la même seconde), donc la garde doit être par ligue.
  const previous = existsSync(OUT)
    ? (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; } })()
    : null;

  let kept = 0;
  for (const [id, lg] of Object.entries(results.leagues)) {
    if (lg.teams.length > 0) continue;
    const prev = previous?.leagues?.[id];
    if (prev?.teams?.length) {
      console.warn(`[ep] ⚠️ ${id}: 0 equipe cette fois — classement précédent conservé (${prev.teams.length} equipes)`);
      lg.teams = prev.teams;
      kept++;
    } else {
      console.warn(`[ep] ⚠️ ${id}: 0 equipe et aucun historique — la ligue reste absente`);
    }
  }

  const totalTeams = Object.values(results.leagues).reduce(
    (n, lg) => n + ((lg && lg.teams) ? lg.teams.length : 0), 0,
  );
  if (totalTeams === 0 && existsSync(OUT)) {
    console.log('[ep] ⚠️ 0 teams (403 ?) — fichier existant conservé, pas d\'écriture');
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(`[ep] Saved to ${OUT}${kept ? ` (${kept} ligue(s) conservée(s) d'avant)` : ''}`);
  }

  // Resume
  for (const [leagueId, leagueData] of Object.entries(results.leagues)) {
    console.log(`\n--- ${leagueData.name} (${leagueData.teams.length} teams) ---`);
    for (const t of leagueData.teams.slice(0, 5)) {
      console.log(`  ${String(t.rank).padStart(2)}. ${t.name.padEnd(30)} GP:${t.gp} TP:${t.tp} PPG:${t.ppg}`);
    }
    if (leagueData.teams.length > 5) {
      console.log(`  ... and ${leagueData.teams.length - 5} more`);
    }
  }
}

main();
