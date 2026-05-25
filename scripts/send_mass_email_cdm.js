/**
 * send_mass_email_cdm.js
 * Broadcast CdM 2026 launch announcement via email to all registered users.
 * Uses SendGrid HTTP API — zero npm dep (native https module only).
 *
 * Requires in .env:
 *   SENDGRID_API_KEY=SG.xxxx
 *   ADMIN_EMAIL=you@example.com         (required for --dry-run)
 *   FROM_EMAIL=noreply@pariscore.fr     (optional, default below)
 *   FROM_NAME=PariScore                 (optional)
 *
 * Usage:
 *   node scripts/send_mass_email_cdm.js           # tous les users en DB
 *   node scripts/send_mass_email_cdm.js --dry-run # ADMIN_EMAIL uniquement
 *
 * Notes:
 *   - SendGrid free tier: 100 emails/jour
 *   - Batches of 50 with 1s pause between batches (well within rate limits)
 *   - HTTP 202 = accepted by SendGrid (success)
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
const SG_KEY        = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL    = process.env.FROM_EMAIL || 'noreply@pariscore.fr';
const FROM_NAME     = process.env.FROM_NAME  || 'PariScore';
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL || '';
const DB_PATH       = path.join(__dirname, '..', 'pariscore.db');
const BATCH_SIZE    = 50;
const BATCH_DELAY   = 1000; // ms between batches

if (!SG_KEY) {
  console.error('  ✗ SENDGRID_API_KEY manquant dans .env');
  console.error('    → Créer un compte gratuit sur sendgrid.com (100 emails/jour)');
  console.error('    → Ajouter SENDGRID_API_KEY=SG.xxxx dans .env');
  process.exit(1);
}
if (DRY_RUN && !ADMIN_EMAIL) {
  console.error('  ✗ ADMIN_EMAIL manquant dans .env (requis pour --dry-run)');
  process.exit(1);
}

// ─── Email content ────────────────────────────────────────────────────────────
const SUBJECT = '🏆 Nouveau : Module Coupe du Monde 2026 sur PariScore';

const HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PariScore — Coupe du Monde 2026</title>
</head>
<body style="margin:0;padding:0;background:#0a0d0f;font-family:Arial,sans-serif;color:#e8eaed;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d0f;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr>
    <td style="background:linear-gradient(135deg,#001F5B 0%,#003399 100%);padding:40px 32px;border-radius:12px 12px 0 0;text-align:center;">
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#7eb3ff;font-weight:600;">PARISCORE</p>
      <h1 style="margin:0 0 12px;font-size:32px;font-weight:800;color:#ffffff;line-height:1.2;">
        &#127942; Coupe du Monde 2026
      </h1>
      <p style="margin:0;font-size:16px;color:#a8c8ff;">
        Le module est en ligne. Suivez les 104 matchs en temps r&eacute;el.
      </p>
    </td>
  </tr>
  <tr>
    <td style="background:#111417;padding:32px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 24px;font-size:15px;color:#b0b8c1;line-height:1.6;">
        PariScore int&egrave;gre d&eacute;sormais un <strong style="color:#e8eaed;">onglet d&eacute;di&eacute; &agrave; la Coupe du Monde 2026</strong>,
        aliment&eacute; en temps r&eacute;el par notre source de donn&eacute;es officielle BSD.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="padding:12px 16px;background:#181c20;border-radius:8px;border-left:3px solid #3366cc;">
            <strong style="color:#ffffff;">&#128202; Classements en direct</strong><br>
            <span style="font-size:14px;color:#8d9399;">12 groupes A&rarr;L &middot; 48 &eacute;quipes &middot; classement FIFA int&eacute;gr&eacute;</span>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background:#181c20;border-radius:8px;border-left:3px solid #3366cc;">
            <strong style="color:#ffffff;">&#128197; Calendrier complet</strong><br>
            <span style="font-size:14px;color:#8d9399;">Phase de poules &middot; 8es de finale &middot; Quarts &middot; Demies &middot; Finale</span>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background:#181c20;border-radius:8px;border-left:3px solid #00e676;">
            <strong style="color:#ffffff;">&#128176; Value Bets activ&eacute;s d&egrave;s le J-1</strong><br>
            <span style="font-size:14px;color:#8d9399;">Cotes &middot; Edge Poisson &middot; Analyse IA &mdash; sur chaque match du tournoi</span>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 24px;font-size:14px;color:#8d9399;text-align:center;">
        &#128197; <strong style="color:#e8eaed;">11 juin &rarr; 19 juillet 2026</strong> &nbsp;|&nbsp;
        &#127757; <strong style="color:#e8eaed;">&Eacute;tats-Unis &middot; Canada &middot; Mexique</strong>
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <a href="https://pariscore.fr"
               style="display:inline-block;padding:16px 40px;background:#3366cc;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;letter-spacing:0.5px;">
              &#9917; Voir le module CdM 2026
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:12px;color:#5a6068;text-align:center;line-height:1.5;">
        PariScore &middot; Analyse math&eacute;matique des paris sportifs<br>
        <a href="https://pariscore.fr" style="color:#5a6068;">pariscore.fr</a> &middot;
        <a href="https://pariscore.fr/unsubscribe" style="color:#5a6068;">Se d&eacute;sabonner</a>
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;

const TEXT = [
  'PariScore — Coupe du Monde 2026',
  '',
  'Le module CdM 2026 est maintenant disponible !',
  '',
  '- Classements temps réel (12 groupes A→L)',
  '- Calendrier complet (poules + phases finales)',
  '- Tableau de bracket (8es, QF, SF, Finale)',
  '- Value Bets activés dès le 11 juin',
  '',
  'Tournoi : 11 juin → 19 juillet 2026',
  'Hôtes : États-Unis, Canada, Mexique',
  '',
  'Voir le module : https://pariscore.fr',
  '',
  '---',
  'Se désabonner : https://pariscore.fr/unsubscribe',
].join('\n');

// ─── SendGrid send ────────────────────────────────────────────────────────────
function sendOne(toEmail) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      personalizations: [{ to: [{ email: toEmail }] }],
      from:    { email: FROM_EMAIL, name: FROM_NAME },
      subject: SUBJECT,
      content: [
        { type: 'text/plain', value: TEXT },
        { type: 'text/html',  value: HTML },
      ],
    });
    const req = https.request(
      {
        hostname: 'api.sendgrid.com',
        path:     '/v3/mail/send',
        method:   'POST',
        headers:  {
          'Authorization':  `Bearer ${SG_KEY}`,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Collect emails from DB ───────────────────────────────────────────────────
function collectEmails() {
  if (!fs.existsSync(DB_PATH)) {
    console.warn('  ⚠ pariscore.db introuvable');
    return [];
  }
  const sqldb = new Database(DB_PATH, { readonly: true });
  try {
    return sqldb
      .prepare('SELECT email FROM users WHERE email IS NOT NULL AND email != ""')
      .all()
      .map(r => r.email)
      .filter(e => e && e.includes('@'));
  } finally {
    sqldb.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n  [send_mass_email_cdm] ${DRY_RUN ? '🧪 DRY-RUN' : '🚀 PRODUCTION'}\n`);

  const recipients = DRY_RUN ? [ADMIN_EMAIL] : collectEmails();

  if (DRY_RUN) {
    console.log(`  ℹ DRY-RUN: envoi uniquement à ${ADMIN_EMAIL}`);
  } else {
    console.log(`  ℹ ${recipients.length} utilisateur(s) en DB`);
  }

  if (!recipients.length) {
    console.log('  ✗ Aucun destinataire. Arrêt.');
    process.exit(0);
  }

  console.log(`  → ${Math.ceil(recipients.length / BATCH_SIZE)} batch(es) de ${BATCH_SIZE}\n`);

  let ok = 0, fail = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`  ── Batch ${batchNum} (${batch.length} emails) ──`);

    for (const email of batch) {
      try {
        const r = await sendOne(email);
        if (r.status === 202) {
          console.log(`  ✓ ${email}`);
          ok++;
        } else {
          console.log(`  ✗ ${email} [HTTP ${r.status}] ${String(r.data).slice(0, 100)}`);
          fail++;
        }
      } catch (e) {
        console.log(`  ✗ ${email} [${e.message}]`);
        fail++;
      }
    }

    if (i + BATCH_SIZE < recipients.length) {
      console.log(`  ⏳ Pause ${BATCH_DELAY}ms...\n`);
      await sleep(BATCH_DELAY);
    }
  }

  console.log(`\n  ─────────────────────────────────`);
  console.log(`  ✓ ${ok} envoyé(s)  ✗ ${fail} échec(s) — total ${recipients.length}\n`);
})();
