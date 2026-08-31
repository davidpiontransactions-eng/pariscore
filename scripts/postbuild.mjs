#!/usr/bin/env node
/**
 * scripts/postbuild.mjs — copie cross-platform des assets vers le bundle
 * Next.js standalone (`output: "standalone"`).
 *
 * Remplace l'ancien chaînage `cp -rf` (Unix-only) / `xcopy` (Windows-only)
 * qui cassait le build sur le VPS Linux : les backslashes `mkdir .next\standalone`
 * étaient avalées par bash, `xcopy` introuvable, et `.next/standalone/.next/`
 * n'était jamais peuplé → 404 sur /_next/static/css/*.
 *
 * Utilise `fs.cpSync` (Node 16.7+) : comportement identique sur Windows,
 * Linux (VPS) et macOS, peu importe le shell hôte.
 *
 * Équivalence avec l'ancien script Unix :
 *   cp -rf .next/static .next/standalone/.next/   →  cpSync(.../static, .../standalone/.next/static)
 *   cp -rf public .next/standalone/               →  cpSync(public, .../standalone/public)
 *   + caches tennis-elo / tennis-dr (tolérants à l'absence de fichier).
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

const OK = [];
const WARN = [];
let FAIL = 0;

function warn(msg) {
  WARN.push(msg);
  console.warn('  warn: ' + msg);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    warn('source absente (skip): ' + path.relative(root, src));
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  OK.push(path.relative(root, dest));
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    warn('fichier absent (skip): ' + path.relative(root, src));
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  OK.push(path.relative(root, dest));
}

try {
  // 1. static → standalone/.next/static (CSS/JS chunks, media, fonts)
  copyDir(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'));

  // 2. public → standalone/public (favicons, manifest, sw.js, logos, cache)
  copyDir(path.join(root, 'public'), path.join(standalone, 'public'));

  // 3. Caches tennis (essentiels au runtime ; tolérants si absents)
  copyFile(
    path.join(root, 'src', 'lib', 'tennis-elo', 'abstract-cache.json'),
    path.join(standalone, 'src', 'lib', 'tennis-elo', 'abstract-cache.json'),
  );
  copyFile(
    path.join(root, 'src', 'lib', 'tennis-dr', 'dr-cache.json'),
    path.join(standalone, 'src', 'lib', 'tennis-dr', 'dr-cache.json'),
  );

  console.log('[postbuild] Copiés vers standalone:');
  for (const p of OK) console.log('  ✓ ' + p);
  if (WARN.length) console.log('[postbuild] ' + WARN.length + ' avertissement(s) (non bloquant).');
  console.log('[postbuild] OK');
} catch (err) {
  console.error('[postbuild] ÉCHEC: ' + err.message);
  FAIL = 1;
}

// Garde-fou final : .next/standalone/server.js doit exister (Next.js le produit).
if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error('[postbuild] ERREUR: .next/standalone/server.js absent — build standalone incomplet.');
  FAIL = 1;
}

process.exit(FAIL);