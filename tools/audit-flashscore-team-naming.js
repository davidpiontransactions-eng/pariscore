#!/usr/bin/env node
/**
 * bd qm6a Plan C — Cross-ref team naming validation audit
 *
 * Compare Flashscore team_name → canonical normName (aligné server.js:5159).
 * Mode offline (par défaut) : dump heuristiques affixes + multi-word + slash.
 * Mode online (si database.json présent) : match exact + fuzzy contre db.teamStats.
 *
 * USAGE:
 *   node tools/audit-flashscore-team-naming.js [--db=database.json] [--out=.context/audits/audit-flashscore-team-naming.md]
 *
 * Sortie : markdown report .context/audits/audit-flashscore-team-naming.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname.replace(/\\tools$/, '').replace(/\/tools$/, '');
const args = Object.fromEntries(process.argv.slice(2)
  .filter(a => a.startsWith('--'))
  .map(a => { const [k, v = true] = a.slice(2).split('='); return [k, v]; }));

const DB_PATH = args.db ? path.resolve(ROOT, args.db) : path.join(ROOT, 'database.json');
const OUT_PATH = args.out
  ? path.resolve(ROOT, args.out)
  : path.join(ROOT, '.context', 'audits', 'audit-flashscore-team-naming.md');

// Aligné server.js:5159 — normName canonique
function normName(name) {
  return (name || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Affixes corporate communs strip pour matching tolérant (aligné server.js:5168 _CLUB_AFFIX)
const CLUB_AFFIX = new Set([
  'fc', 'afc', 'cf', 'cfc', 'fco', 'ac', 'acf', 'as', 'aas', 'ss', 'ssc', 'ssd',
  'sc', 'usl', 'us', 'ud', 'cd', 'ca', 'club', 'sk', 'bk', 'fk', 'sv',
]);

function stripAffix(s) {
  const tokens = s.split(' ').filter(t => !CLUB_AFFIX.has(t));
  return tokens.join(' ').trim();
}

// Levenshtein simple (cap distance 4 pour skip rapide)
function lev(a, b, cap = 4) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > cap) return cap + 1;
  const prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    let curr = i;
    let minRow = curr;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(prev[j] + 1, curr + 1, prev[j - 1] + cost);
      prev[j - 1] = curr;
      curr = next;
      if (curr < minRow) minRow = curr;
    }
    prev[lb] = curr;
    if (minRow > cap) return cap + 1;
  }
  return prev[lb];
}

function findDatasets() {
  return fs.readdirSync(ROOT)
    .filter(f => /^dataset_flashscore-team-stats_.*\.json$/.test(f))
    .map(f => path.join(ROOT, f));
}

function loadFlashscoreFootballTeams() {
  const out = [];
  for (const file of findDatasets()) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) continue;
    for (const r of data) {
      if (r.sport_name !== 'football' || !r.team_name) continue;
      out.push({
        team_name: r.team_name,
        team_id: r.team_id || null,
        team_slug: r.team_slug || null,
        country: r.country_name || null,
        league: r.league_name || null,
        standing_position: r.standing_position || null,
      });
    }
  }
  return out;
}

function loadCanonicalTeams() {
  if (!fs.existsSync(DB_PATH)) return null;
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const teamStats = db.teamStats || {};
    // Index par leagueId (utile pour réduire le candidate set au match-ligue)
    const byLeague = new Map();
    for (const [key, s] of Object.entries(teamStats)) {
      const lid = s.leagueId;
      if (lid == null) continue;
      if (!byLeague.has(lid)) byLeague.set(lid, []);
      byLeague.get(lid).push({ key, normKey: normName(key), source: s._source || null });
    }
    return byLeague;
  } catch (e) {
    console.warn('  [audit] WARN read database.json:', e.message);
    return null;
  }
}

function loadLeaguesConfig() {
  const f = path.join(ROOT, 'leagues_config.json');
  if (!fs.existsSync(f)) return [];
  try {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(c.leagues) ? c.leagues : [];
  } catch (_) { return []; }
}

function resolveLeagueConfigId(country, league, cfg) {
  const c = normName(country);
  const l = normName(league);
  for (const lg of cfg) {
    if (normName(lg.country) === c && normName(lg.name) === l) return lg.id;
  }
  return null;
}

function classify(team, canonicalForLeague) {
  const nn = normName(team.team_name);
  const stripped = stripAffix(nn);
  const flags = [];
  if (nn !== stripped) flags.push('affix');
  if (team.team_name.includes('/')) flags.push('slash');
  if (/\d/.test(team.team_name)) flags.push('digit');
  if (team.team_name.split(/\s+/).length >= 3) flags.push('multiword');

  if (!canonicalForLeague || !canonicalForLeague.length) {
    return { normName: nn, stripped, flags, match: null, fuzzy: [] };
  }

  // Match exact
  const exact = canonicalForLeague.find(c => c.normKey === nn);
  if (exact) return { normName: nn, stripped, flags, match: { mode: 'exact', key: exact.key, source: exact.source }, fuzzy: [] };

  // Match stripped affix
  const strippedHit = canonicalForLeague.find(c => stripAffix(c.normKey) === stripped);
  if (strippedHit) return { normName: nn, stripped, flags: flags.concat('affix-match'), match: { mode: 'stripped', key: strippedHit.key, source: strippedHit.source }, fuzzy: [] };

  // Fuzzy lev distance ≤ 3 sur normName ou stripped
  const fuzzy = [];
  for (const c of canonicalForLeague) {
    const d1 = lev(nn, c.normKey, 3);
    const d2 = lev(stripped, stripAffix(c.normKey), 3);
    const d = Math.min(d1, d2);
    if (d <= 3) fuzzy.push({ key: c.key, dist: d, source: c.source });
  }
  fuzzy.sort((a, b) => a.dist - b.dist);
  return { normName: nn, stripped, flags, match: null, fuzzy: fuzzy.slice(0, 5) };
}

function buildReport(teams, canonical, leaguesConfig) {
  const lines = [];
  lines.push('# Audit Flashscore team naming — Plan C (bd qm6a)');
  lines.push('');
  lines.push(`> Généré ${new Date().toISOString()} via \`tools/audit-flashscore-team-naming.js\``);
  lines.push(`> Source : dataset Apify Flashscore team-stats (sport=football)`);
  lines.push(`> Canonique : ${canonical ? `database.json (${DB_PATH})` : '⚠ database.json absent — mode offline'}`);
  lines.push('');

  // Grouper par (country, league)
  const byLeague = new Map();
  for (const t of teams) {
    const lk = `${t.country || '?'} | ${t.league || '?'}`;
    if (!byLeague.has(lk)) byLeague.set(lk, []);
    byLeague.get(lk).push(t);
  }

  const summary = { total: teams.length, exact: 0, stripped: 0, fuzzy: 0, missing: 0 };
  const sections = [];

  for (const [lk, ts] of byLeague) {
    const [country, league] = lk.split(' | ');
    const configId = resolveLeagueConfigId(country, league, leaguesConfig);
    const lidLine = configId ? `configId=${configId}` : '⚠ UNMAPPED config_id';
    const canonicalForLeague = (canonical && configId) ? (canonical.get(configId) || []) : null;

    const rows = ts.map(t => {
      const c = classify(t, canonicalForLeague);
      if (c.match?.mode === 'exact') summary.exact++;
      else if (c.match?.mode === 'stripped') summary.stripped++;
      else if (c.fuzzy.length) summary.fuzzy++;
      else summary.missing++;
      return { team: t, c };
    });

    sections.push({ lk, configId, lidLine, canonicalSize: canonicalForLeague ? canonicalForLeague.length : null, rows });
  }

  lines.push('## Récapitulatif');
  lines.push('');
  lines.push(`- **Total équipes Flashscore** : ${summary.total}`);
  if (canonical) {
    lines.push(`- **Match exact normName** : ${summary.exact}`);
    lines.push(`- **Match stripped affix** : ${summary.stripped} (corporate prefixe normalisé)`);
    lines.push(`- **Candidates fuzzy lev≤3** : ${summary.fuzzy}`);
    lines.push(`- **Absentes canonique** : ${summary.missing}`);
  } else {
    lines.push('- Mode offline : pas de match canonique (charger `database.json` pour comparaison)');
  }
  lines.push('');

  for (const sec of sections) {
    lines.push(`## ${sec.lk}`);
    lines.push(`- ${sec.lidLine}`);
    if (sec.canonicalSize != null) lines.push(`- Canonique teamStats : ${sec.canonicalSize} équipes`);
    lines.push('');
    lines.push('| # | Team | normName | Flags | Match | Fuzzy candidates |');
    lines.push('|---|---|---|---|---|---|');
    for (const { team, c } of sec.rows) {
      const flagStr = c.flags.length ? c.flags.join(',') : '—';
      let matchStr = '—';
      if (c.match?.mode === 'exact') matchStr = `✅ exact: \`${c.match.key}\` (${c.match.source || '?'})`;
      else if (c.match?.mode === 'stripped') matchStr = `🟡 affix: \`${c.match.key}\` (${c.match.source || '?'})`;
      else if (canonical) matchStr = '❌ no match';
      const fuzzyStr = c.fuzzy.length
        ? c.fuzzy.map(f => `\`${f.key}\` d=${f.dist}`).join(', ')
        : '—';
      lines.push(`| ${team.standing_position || '?'} | ${team.team_name} | \`${c.normName}\` | ${flagStr} | ${matchStr} | ${fuzzyStr} |`);
    }
    lines.push('');
  }

  // Heuristique offline : noms Flashscore probables shorthand
  // (suspect divergence vs canonical API-Football/BSD/ESPN full name)
  if (!canonical) {
    const KNOWN_SHORTHAND = {
      'manchester utd': 'manchester united',
      'nottingham': 'nottingham forest',
      'wolves': 'wolverhampton wanderers',
      'newcastle': 'newcastle united',
      'leeds': 'leeds united',
      'west ham': 'west ham united',
      'brighton': 'brighton hove albion',
      'spurs': 'tottenham hotspur',
      'tottenham': 'tottenham hotspur',
      'sheff utd': 'sheffield united',
      'sheff wed': 'sheffield wednesday',
      'man city': 'manchester city',
      'man utd': 'manchester united',
    };
    const suspects = [];
    for (const sec of sections) {
      for (const { team, c } of sec.rows) {
        const full = KNOWN_SHORTHAND[c.normName];
        if (full) suspects.push({ league: sec.lk, fs: team.team_name, normFs: c.normName, expectedFull: full });
      }
    }
    if (suspects.length) {
      lines.push('## ⚠ Heuristique offline — shorthand suspect');
      lines.push('');
      lines.push('Noms Flashscore probablement raccourcis vs canonical (API-Football/BSD/ESPN). Validation manuelle requise quand `database.json` chargé.');
      lines.push('');
      lines.push('| Ligue | Flashscore | normName | Probable full name canonique |');
      lines.push('|---|---|---|---|');
      for (const s of suspects) {
        lines.push(`| ${s.league} | ${s.fs} | \`${s.normFs}\` | \`${s.expectedFull}\` |`);
      }
      lines.push('');
    }
  }

  lines.push('## Action items DG');
  lines.push('');
  if (canonical) {
    if (summary.missing > 0) {
      lines.push(`- ⚠ ${summary.missing} équipes Flashscore sans analog canonique → vérifier si normName divergent OU absente (ligue/saison hors scope)`);
    }
    if (summary.stripped > 0) {
      lines.push(`- 🟡 ${summary.stripped} matches via affix strip — ajouter alias mapping dans server.js si fréquence élevée`);
    }
    if (summary.fuzzy > 0) {
      lines.push(`- 🔍 ${summary.fuzzy} candidates fuzzy → validation manuelle (lev distance 1-3)`);
    }
    if (!summary.missing && !summary.fuzzy && !summary.stripped) {
      lines.push('- ✅ Naming coverage parfait (100% exact match) — aucune action requise');
    }
  } else {
    lines.push('- Mode offline : run sur VPS avec `database.json` runtime pour audit complet');
    lines.push('  ```');
    lines.push('  scp ubuntu@vps:/home/ubuntu/pariscore/database.json /tmp/');
    lines.push('  node tools/audit-flashscore-team-naming.js --db=/tmp/database.json');
    lines.push('  ```');
  }
  lines.push('');

  return { md: lines.join('\n'), summary };
}

function run() {
  const teams = loadFlashscoreFootballTeams();
  console.log(`  [audit] ${teams.length} équipes Flashscore football chargées`);
  if (!teams.length) {
    console.warn('  [audit] aucune équipe — abort');
    process.exit(1);
  }

  const canonical = loadCanonicalTeams();
  if (canonical) {
    console.log(`  [audit] canonical loaded — ${canonical.size} ligues indexées`);
  } else {
    console.log('  [audit] mode offline (database.json absent ou unreadable)');
  }

  const cfg = loadLeaguesConfig();
  const { md, summary } = buildReport(teams, canonical, cfg);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, md, 'utf8');
  console.log(`  [audit] report written → ${OUT_PATH}`);
  console.log(`  [audit] summary:`, summary);
}

if (require.main === module) {
  try { run(); }
  catch (e) { console.error('  [audit] ERR:', e.message); process.exit(1); }
}

module.exports = { normName, stripAffix, lev, classify };
