/**
 * notify_telegram_cdm.js
 * Broadcast CdM 2026 launch announcement via Telegram.
 *
 * Recipients:
 *   1. TELEGRAM_CHAT_IDS from .env  (admin channels)
 *   2. All users with chatId stored in DB kv (alert_prefs_*)
 *
 * Usage:
 *   node scripts/notify_telegram_cdm.js           # production
 *   node scripts/notify_telegram_cdm.js --dry-run # admin chat IDs only
 */

'use strict';

const path  = require('path');
const https = require('https');
const fs    = require('fs');
const Database = require('better-sqlite3');

// ─── Load .env ────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const DRY_RUN       = process.argv.includes('--dry-run');
const BOT_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_IDS     = new Set(
  (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const DB_PATH = path.join(__dirname, '..', 'pariscore.db');

if (!BOT_TOKEN) {
  console.error('  ✗ TELEGRAM_BOT_TOKEN manquant dans .env');
  process.exit(1);
}

// ─── Message ──────────────────────────────────────────────────────────────────
const MESSAGE = [
  '🏆 <b>NOUVEAU SUR PARISCORE : Coupe du Monde 2026</b> 🇺🇸🇨🇦🇲🇽',
  '',
  '⚽ 48 équipes · 12 groupes · 104 matchs',
  '',
  'Le module CdM 2026 est maintenant disponible sur PariScore :',
  '',
  '📊 <b>Classements temps réel</b> — 12 groupes A→L',
  '📅 <b>Calendrier complet</b> — poules + phases finales',
  '🏅 <b>Tableau de bracket</b> — 8es, QF, SF, Finale',
  '💰 <b>Value Bets activés</b> dès le coup d\'envoi (11 juin)',
  '',
  '🗓 Tournoi : 11 juin → 19 juillet 2026',
  '🌍 Hôtes : États-Unis · Canada · Mexique',
  '',
  '👉 <a href="https://pariscore.fr">pariscore.fr</a> → onglet <b>CdM 2026</b>',
].join('\n');

// ─── HTTPS helper ─────────────────────────────────────────────────────────────
function httpsPost(url, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const u    = new URL(url);
    const req  = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendOne(chatId) {
  const r = await httpsPost(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text: MESSAGE, parse_mode: 'HTML', disable_web_page_preview: false }
  );
  if (r.status >= 400) {
    const desc = (r.data && r.data.description) || `HTTP ${r.status}`;
    console.log(`  ✗ Chat ${chatId}: ${desc}`);
    return false;
  }
  console.log(`  ✓ Chat ${chatId}`);
  return true;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Collect recipient chat IDs ───────────────────────────────────────────────
function collectChatIds() {
  const ids = new Set([...ADMIN_IDS]);

  if (DRY_RUN) {
    console.log(`  ℹ DRY-RUN — ${ADMIN_IDS.size} chat(s) admin uniquement`);
    return ids;
  }

  if (!fs.existsSync(DB_PATH)) {
    console.warn('  ⚠ pariscore.db introuvable — ADMIN_IDS seulement');
    return ids;
  }

  const sqldb = new Database(DB_PATH, { readonly: true });
  try {
    const rows = sqldb.prepare("SELECT value FROM kv WHERE key LIKE 'alert_prefs_%'").all();
    for (const row of rows) {
      try {
        const prefs = JSON.parse(row.value);
        if (prefs && prefs.chatId && prefs.chatId.trim()) ids.add(prefs.chatId.trim());
      } catch (_) {}
    }
  } finally {
    sqldb.close();
  }

  const userCount = ids.size - ADMIN_IDS.size;
  console.log(`  ℹ ${userCount} chat(s) utilisateurs + ${ADMIN_IDS.size} admin(s) → total ${ids.size}`);
  return ids;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n  [notify_telegram_cdm] ${DRY_RUN ? '🧪 DRY-RUN' : '🚀 PRODUCTION'}\n`);

  const chatIds = collectChatIds();

  if (!chatIds.size) {
    console.error('  ✗ Aucun chat ID configuré. Ajouter TELEGRAM_CHAT_IDS dans .env');
    process.exit(1);
  }

  console.log(`\n  → Envoi à ${chatIds.size} destinataire(s)...\n`);

  let ok = 0, fail = 0;
  for (const chatId of chatIds) {
    const success = await sendOne(chatId);
    success ? ok++ : fail++;
    await sleep(100); // Telegram rate limit: max ~30 msg/s
  }

  console.log(`\n  ─────────────────────────────────`);
  console.log(`  ✓ ${ok} envoyé(s)  ✗ ${fail} échec(s)\n`);
})();
