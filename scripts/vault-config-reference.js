/**
 * PariScore — Vault Config Reference
 *
 * Génère une note de référence listant toutes les configurations actives
 * de PariScore : APIs, ligues, feature flags, cache, crons, services, DB.
 *
 * USAGE:
 *   node scripts/vault-config-reference.js              # Production
 *   node scripts/vault-config-reference.js --dry         # Dry run (stdout only)
 *
 * EXIT CODES:
 *   0 = OK
 *   1 = Erreur fatale (vault path manquant)
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
const ENV = {};
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const m = line.match(/^([^=#]+)=(.*)$/);
    if (m) ENV[m[1].trim()] = m[2].trim();
  });
} catch (e) {
  console.error('[vault-config] .env introuvable — abandon');
  process.exit(1);
}

const VAULT_PATH = ENV.VAULT_PATH;
if (!VAULT_PATH) {
  console.error('[vault-config] VAULT_PATH absent du .env — abandon');
  process.exit(1);
}

const isDry = process.argv.includes('--dry');

// ── Helpers ─────────────────────────────────────────────────────────

function readJSON(fileName) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, fileName), 'utf8'));
  } catch (e) {
    console.warn(`[vault-config] Lecture ${fileName} impossible: ${e.message}`);
    return null;
  }
}

function fmtBool(val) {
  return val ? '✅' : '❌';
}

function fmtUnknown(val) {
  if (val === true || val === 'true' || val === '1' || val === 1) return '✅';
  if (val === false || val === 'false' || val === '0' || val === 0) return '❌';
  return '⚠️ Inconnu';
}

// ── Data Sources ────────────────────────────────────────────────────

function getApiStatus() {
  const keys = {
    'BSD API': ENV.BSD_API_KEY,
    'The Odds API': ENV.ODDS_API_KEY,
    'API-Football': ENV.API_FOOTBALL_KEY,
    'Stripe': ENV.STRIPE_SECRET_KEY,
    'Gemini AI': ENV.GEMINI_API_KEY,
    'RapidAPI (MatchStat)': ENV.MATCHSTAT_API_KEY,
    'Telegram Bot': ENV.TELEGRAM_BOT_TOKEN,
    'Discord Webhooks': ENV.DISCORD_WEBHOOK_URL,
    'Apify (Transfermarkt)': ENV.APIFY_TOKEN,
    'OddsPapi v4': ENV.ODDSPAPI_V4_KEY,
    'CatBoost ML': ENV.CATBOOST_ENABLED,
  };
  return Object.entries(keys).map(([name, val]) => ({
    name,
    status: val && val !== '' && val !== 'false' ? '✅' : '❌',
  }));
}

function getLeagues() {
  const leagues = readJSON('leagues_config.json');
  if (!leagues) return [];
  return Object.entries(leagues).slice(0, 15).map(([key, val]) => ({
    key,
    name: val.name || val.league || key,
    country: val.country || '-',
  }));
}

function getFlags() {
  const flags = readJSON('flags_config.json');
  if (!flags) return [];
  return Object.entries(flags)
    .filter(([k]) => !k.startsWith('_'))
    .slice(0, 20)
    .map(([k, v]) => ({ name: k, status: fmtUnknown(v) }));
}

function getCache() {
  const cache = readJSON('cache_profiles.json');
  if (!cache) return [];
  return Object.entries(cache).slice(0, 10).map(([key, val]) => ({
    name: key,
    ttl: val.ttl || val.TTL || val.maxAge || '-',
    strategy: val.strategy || 'default',
  }));
}

function getDbInfo() {
  const dbPath = ENV.DATABASE_PATH || path.join(ROOT, 'pariscore.db');
  try {
    const stats = fs.statSync(dbPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(0);
    return { path: dbPath, sizeMB, exists: true };
  } catch {
    return { path: dbPath, sizeMB: '-', exists: false };
  }
}

// ── Build markdown ──────────────────────────────────────────────────

function buildMarkdown() {
  const apis = getApiStatus();
  const leagues = getLeagues();
  const flags = getFlags();
  const caches = getCache();
  const db = getDbInfo();
  const now = new Date();

  const lines = [];

  // Frontmatter
  lines.push('---');
  lines.push('type: reference');
  lines.push('title: Configuration PariScore');
  lines.push(`generated_at: ${now.toISOString()}`);
  lines.push('sources:');
  lines.push('  - .env');
  lines.push('  - leagues_config.json');
  lines.push('  - flags_config.json');
  lines.push('  - cache_profiles.json');
  lines.push('  - ecosystem.config.js');
  lines.push('---');
  lines.push('');
  lines.push('# ⚙️ Configuration PariScore');
  lines.push('');
  lines.push(`_Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}_`);
  lines.push('');

  // 1. APIs
  lines.push('## 🌐 API Externes');
  lines.push('');
  lines.push('| Service | Statut |');
  lines.push('|---------|--------|');
  for (const api of apis) {
    lines.push(`| ${api.name} | ${api.status} |`);
  }
  lines.push('');

  // 2. Leagues
  if (leagues.length > 0) {
    lines.push('## ⚽ Ligues Suivies');
    lines.push('');
    lines.push('| Clé | Nom | Pays |');
    lines.push('|-----|-----|------|');
    for (const l of leagues) {
      lines.push(`| ${l.key} | ${l.name} | ${l.country} |`);
    }
    lines.push('');
  }

  // 3. Feature Flags
  if (flags.length > 0) {
    lines.push('## 🚩 Feature Flags');
    lines.push('');
    lines.push('| Flag | Statut |');
    lines.push('|------|--------|');
    for (const f of flags) {
      lines.push(`| ${f.name} | ${f.status} |`);
    }
    lines.push('');
  }

  // 4. Cache
  if (caches.length > 0) {
    lines.push('## ⚡ Profils Cache');
    lines.push('');
    lines.push('| Type | TTL | Stratégie |');
    lines.push('|------|-----|-----------|');
    for (const c of caches) {
      lines.push(`| ${c.name} | ${c.ttl} | ${c.strategy} |`);
    }
    lines.push('');
  }

  // 5. DB
  lines.push('## 💾 Base de Données');
  lines.push('');
  lines.push('| Métrique | Valeur |');
  lines.push('|----------|--------|');
  lines.push(`| Chemin | ${db.path} |`);
  lines.push(`| Taille | ${db.sizeMB} MB |`);
  lines.push(`| Accessible | ${db.exists ? '✅' : '❌'} |`);

  // Try to get table count
  try {
    const Database = require('better-sqlite3');
    const dblocal = new Database(db.path, { readonly: true });
    const tables = dblocal.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'").get();
    lines.push(`| Tables | ${tables ? tables.cnt : '-'} |`);
    dblocal.close();
  } catch {}
  lines.push('');

  // 6. Services
  lines.push('## 🛠️ Services Actifs');
  lines.push('');
  lines.push('| Service | Technologie | Statut |');
  lines.push('|---------|-------------|--------|');
  const services = [
    ['Serveur HTTP', 'Node.js', '✅'],
    ['CatBoost ML', 'Python + Node.js', ENV.CATBOOST_ENABLED === 'true' ? '✅' : '⚠️ Désactivé'],
    ['CS2 Pipeline', 'Node.js', '✅'],
    ['NBA/WNBA', 'Node.js', '✅'],
    ['F1', 'Node.js (Monte Carlo)', '✅'],
    ['MMA/UFC', 'Node.js + LogReg', '⚠️ POC'],
    ['Tennis Elo/Glicko-2', 'Node.js', '✅'],
    ['Surface PowerScore', 'Python', '✅'],
    ['Betfair WOM', 'Node.js', ENV.WOM_AUTOPUBLISH === 'true' ? '✅' : '❌'],
    ['Discord Alerts', 'Webhook', '✅'],
    ['Telegram Bot', 'API', ENV.TELEGRAM_BOT_TOKEN ? '✅' : '❌'],
  ];
  for (const [name, tech, status] of services) {
    lines.push(`| ${name} | ${tech} | ${status} |`);
  }
  lines.push('');

  // 7. Cron Jobs
  lines.push('## ⏰ Cron Jobs');
  lines.push('');
  const crons = [
    ['pariscore (server)', 'continu', '✅'],
    ['pariscore-cron-match-stats', '0 3 * * * (03:00 UTC)', '✅'],
    ['pariscore-vault-daily', '0 5 * * * (05:00 UTC)', '✅'],
    ['pariscore-cron-rg', '0 */2 * * * (toutes les 2h)', '✅'],
    ['Tennis Elo hebdo', 'Lundi 06:00 (crontab)', '⚠️ Manuel'],
  ];
  lines.push('| Job | Schedule | Statut |');
  lines.push('|-----|----------|--------|');
  for (const [name, sched, status] of crons) {
    lines.push(`| ${name} | ${sched} | ${status} |`);
  }
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('_Mettez à jour cette note avec : `node scripts/vault-config-reference.js` après chaque changement de configuration._');

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

try {
  const markdown = buildMarkdown();

  if (isDry) {
    console.log(markdown);
    console.error(`[vault-config] ✅ Dry run — note générée (${markdown.length} caractères)`);
    process.exit(0);
  }

  const outputPath = path.join(VAULT_PATH, 'config-reference.md');
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.error(`[vault-config] ✅ Note écrite: ${outputPath} (${markdown.length} caractères)`);
  process.exit(0);
} catch (e) {
  console.error(`[vault-config] ❌ Erreur fatale: ${e.message}`);
  process.exit(1);
}
