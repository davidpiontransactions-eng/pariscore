#!/usr/bin/env node
/**
 * PariScore — Export liste utilisateurs
 * Usage : node tools/export-users.js [--csv] [--email-only]
 *
 * Options :
 *   --csv         Sortie CSV (défaut : tableau console)
 *   --email-only  Uniquement les adresses email, une par ligne
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Localiser la DB
const DB_PATHS = [
  path.join(__dirname, '..', 'pariscore.db'),
  path.join(__dirname, '..', 'data', 'pariscore.db'),
  '/home/ubuntu/pariscore/pariscore.db',
];

let dbPath = null;
for (const p of DB_PATHS) {
  if (fs.existsSync(p)) { dbPath = p; break; }
}

if (!dbPath) {
  console.error('DB introuvable. Chemins testés :\n' + DB_PATHS.join('\n'));
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const args = process.argv.slice(2);
const csvMode = args.includes('--csv');
const emailOnly = args.includes('--email-only');

const users = db.prepare(`
  SELECT
    id,
    email,
    created_at,
    premium_until,
    stripe_customer_id,
    stripe_subscription_id
  FROM users
  ORDER BY created_at DESC
`).all();

db.close();

if (emailOnly) {
  users.forEach(u => console.log(u.email));
  process.exit(0);
}

if (csvMode) {
  const header = 'id,email,created_at,premium_until,stripe_customer_id,stripe_subscription_id';
  console.log(header);
  users.forEach(u => {
    const row = [
      u.id,
      u.email || '',
      u.created_at || '',
      u.premium_until || '',
      u.stripe_customer_id || '',
      u.stripe_subscription_id || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    console.log(row);
  });
  process.exit(0);
}

// Tableau console
console.log(`\n📋 Utilisateurs PariScore — ${users.length} compte(s)\n`);
console.log(
  'ID'.padEnd(6) +
  'Email'.padEnd(40) +
  'Inscription'.padEnd(22) +
  'Premium jusqu\'au'.padEnd(22) +
  'Stripe'
);
console.log('─'.repeat(120));

const now = Date.now();
users.forEach(u => {
  const premiumDate = u.premium_until ? new Date(u.premium_until) : null;
  const isPremium = premiumDate && premiumDate.getTime() > now;
  const premiumStr = premiumDate ? premiumDate.toISOString().slice(0, 10) + (isPremium ? ' ✓' : ' ✗') : '—';
  console.log(
    String(u.id).padEnd(6) +
    (u.email || '—').padEnd(40) +
    (u.created_at || '—').slice(0, 19).padEnd(22) +
    premiumStr.padEnd(22) +
    (u.stripe_customer_id ? u.stripe_customer_id.slice(0, 18) + '…' : '—')
  );
});

const premiumCount = users.filter(u => u.premium_until && new Date(u.premium_until).getTime() > now).length;
console.log('─'.repeat(120));
console.log(`Total : ${users.length} · Premium actifs : ${premiumCount}\n`);
