/**
 * PariScore — Vault Incident Logger
 *
 * Crée une note d'incident dans le vault Obsidian quand une erreur survient
 * (API down, crash serveur, régression modèle, etc.)
 *
 * USAGE:
 *   node scripts/vault-incidents.js --title="API BSD Down" --severity=high --desc="Timeout 429"
 *   node scripts/vault-incidents.js --dry --title="Test" --severity=low --desc="Dry run test"
 *   node scripts/vault-incidents.js --title="..." --severity=critical --desc="..." --type=api
 *
 * CLI ARGS:
 *   --title=TEXT     Titre court de l'incident (obligatoire)
 *   --severity=LEVEL low | medium | high | critical (défaut: medium)
 *   --desc=TEXT      Description détaillée (obligatoire)
 *   --type=TYPE      api | model | server | data (défaut: server)
 *   --dry            Affiche dans stdout, n'écrit pas
 *
 * EXIT CODES:
 *   0 = OK
 *   1 = Erreur fatale
 *   2 = Note déjà existante (skip)
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
  console.error('[vault-incidents] .env introuvable — abandon');
  process.exit(1);
}

const VAULT_PATH = ENV.VAULT_PATH;
if (!VAULT_PATH) {
  console.error('[vault-incidents] VAULT_PATH absent du .env — abandon');
  process.exit(1);
}

// ── CLI args ────────────────────────────────────────────────────────
const args = {};
process.argv.slice(2).forEach(a => {
  const m = a.match(/^--([^=]+)=?(.*)$/);
  if (m) args[m[1]] = m[2] || true;
});

const isDry = args.dry === true || args.dry === 'true';
const title = args.title;
const severity = args.severity || 'medium';
const desc = args.desc || '';
const type = args.type || 'server';

if (!title) {
  console.error('[vault-incidents] --title est obligatoire');
  process.exit(1);
}

// ── Severity helpers ────────────────────────────────────────────────
const SEVERITY_EMOJI = { low: '🟢', medium: '🟡', high: '🔴', critical: '🚨' };
const SEVERITY_LABEL = { low: 'Basse', medium: 'Moyenne', high: 'Haute', critical: 'Critique' };
const TYPE_ICON = { api: '🌐', model: '🧠', server: '💻', data: '💾' };

// ── Build note ──────────────────────────────────────────────────────
const now = new Date();
const dateStr = now.toISOString().split('T')[0];

// Generate slug from title
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .substring(0, 50);

const fileName = `${dateStr}-${slug}.md`;
const emoji = SEVERITY_EMOJI[severity] || '🟡';
const sevLabel = SEVERITY_LABEL[severity] || 'Moyenne';
const typeIcon = TYPE_ICON[type] || '💻';
const statusEmoji = '❌';

const hours = String(now.getUTCHours()).padStart(2, '0');
const minutes = String(now.getUTCMinutes()).padStart(2, '0');
const timeStr = `${hours}:${minutes}`;

const severityBadge = severity === 'critical' ? '🔴' : severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🟢';

function buildMarkdown() {
  const lines = [];

  lines.push('---');
  lines.push('type: incident');
  lines.push(`title: ${title.replace(/"/g, "'")}`);
  lines.push(`severity: ${severity}`);
  lines.push(`date: ${dateStr}`);
  lines.push(`time: ${timeStr}`);
  lines.push('resolved: false');
  lines.push('resolved_at:');
  lines.push(`type: ${type}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${emoji} ${title}`);
  lines.push('');
  lines.push(`**Date :** ${dateStr} à ${timeStr} UTC`);
  lines.push(`**Sévérité :** ${severityBadge} ${sevLabel}`);
  lines.push(`**Type :** ${typeIcon} ${type}`);
  lines.push(`**Statut :** ${statusEmoji} Non résolu`);
  lines.push('');

  if (desc) {
    lines.push('## Description');
    lines.push('');
    lines.push(desc);
    lines.push('');
  }

  lines.push('## Chronologie');
  lines.push('');
  lines.push('| Heure (UTC) | Événement |');
  lines.push('|-------------|-----------|');
  lines.push(`| ${timeStr} | Incident détecté |`);
  lines.push('| ... | ... |');
  lines.push('');

  lines.push('## Impact');
  lines.push('');
  lines.push('- À déterminer');
  lines.push('');

  lines.push('## Checklist Résolution');
  lines.push('');
  lines.push('- [ ] Diagnostiqué');
  lines.push('- [ ] Root cause identifiée');
  lines.push('- [ ] Correction appliquée');
  lines.push('- [ ] Vérifié');
  lines.push('- [ ] Monitoring ajouté');
  lines.push('- [ ] Note mise à jour (résolu)');
  lines.push('');

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────
try {
  const markdown = buildMarkdown();

  if (isDry) {
    console.log(markdown);
    console.error(`[vault-incidents] ✅ Dry run — note générée (${markdown.length} caractères)`);
    process.exit(0);
  }

  const incidentsDir = path.join(VAULT_PATH, 'incidents');
  if (!fs.existsSync(incidentsDir)) {
    fs.mkdirSync(incidentsDir, { recursive: true });
  }

  const outputPath = path.join(incidentsDir, fileName);

  // Check if note already exists
  if (fs.existsSync(outputPath)) {
    console.error(`[vault-incidents] ⚠️ Note déjà existante: ${outputPath} — skip`);
    process.exit(2);
  }

  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.error(`[vault-incidents] ✅ Note écrite: ${outputPath}`);
  process.exit(0);
} catch (e) {
  console.error(`[vault-incidents] ❌ Erreur fatale: ${e.message}`);
  process.exit(1);
}
