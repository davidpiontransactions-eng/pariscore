#!/usr/bin/env node
// tools/grant-pro-access.js
//
// Grant ou prolonge un accès Pro complet (role=pro_all) à un email pour N jours.
// Crée le user si inexistant (mot de passe temporaire affiché en stdout — à
// communiquer manuellement au bénéficiaire). Si existant, met à jour role +
// premium_until + subscription_status sans toucher au mot de passe (sauf flag
// --force-reset-password).
//
// Auto-expiration : premium_until = epoch(now) + days*86400. Le gate serveur
// (srvAccess + premium_until comparison) bascule le user en freemium dès que
// premium_until < now (aucun cron requis).
//
// Usage :
//   node tools/grant-pro-access.js --email=user@host.tld --days=14
//   node tools/grant-pro-access.js --email=user@host.tld --days=14 --force-reset-password
//   node tools/grant-pro-access.js --email=user@host.tld --days=14 --db=/path/to/pariscore.db
//
// Sortie : JSON détaillant (created|updated) + premium_until (ISO) + temp_password si created.

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) continue;
    out[m[1]] = m[2] == null ? true : m[2];
  }
  return out;
}

function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function genTempPassword() {
  // 16 chars alphanum sûrs (sans 0/O/1/I/l) pour lecture humaine
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const email = (args.email || '').trim().toLowerCase();
  const days = parseInt(args.days || '0', 10);
  const dbPath = args.db || path.join(process.cwd(), 'pariscore.db');
  const forceReset = !!args['force-reset-password'];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('ERROR: --email=<valid-email> requis');
    process.exit(2);
  }
  if (!days || days < 1 || days > 365) {
    console.error('ERROR: --days=<1..365> requis');
    process.exit(2);
  }

  const db = new Database(dbPath, { fileMustExist: true });
  db.pragma('journal_mode = WAL');

  const now = Math.floor(Date.now() / 1000);
  const premiumUntil = now + days * 86400;

  const existing = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(email);

  let result;
  if (existing) {
    if (forceReset) {
      const tempPwd = genTempPassword();
      const { hash, salt } = hashPasswordSync(tempPwd);
      db.prepare(
        'UPDATE users SET role = ?, password_hash = ?, salt = ?, subscription_status = ?, premium_until = ? WHERE id = ?'
      ).run('pro_all', hash, salt, 'active', premiumUntil, existing.id);
      result = { action: 'updated_with_reset', user_id: existing.id, temp_password: tempPwd };
    } else {
      db.prepare(
        'UPDATE users SET role = ?, subscription_status = ?, premium_until = ? WHERE id = ?'
      ).run('pro_all', 'active', premiumUntil, existing.id);
      result = { action: 'updated', user_id: existing.id };
    }
  } else {
    const tempPwd = genTempPassword();
    const { hash, salt } = hashPasswordSync(tempPwd);
    const insertRes = db.prepare(
      'INSERT INTO users (email, password_hash, salt, role, subscription_status, premium_until) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(email, hash, salt, 'pro_all', 'active', premiumUntil);
    result = { action: 'created', user_id: Number(insertRes.lastInsertRowid), temp_password: tempPwd };
  }

  db.close();

  const out = {
    ok: true,
    email,
    role: 'pro_all',
    days,
    premium_until_epoch: premiumUntil,
    premium_until_iso: new Date(premiumUntil * 1000).toISOString(),
    db_path: dbPath,
    ...result,
  };
  console.log(JSON.stringify(out, null, 2));
}

try { main(); } catch (e) {
  console.error('FATAL:', e.message);
  process.exit(1);
}
