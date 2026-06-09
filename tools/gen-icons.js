#!/usr/bin/env node
/**
 * gen-icons.js — Rasterize icon.svg → PWA PNG set (iOS apple-touch + Android maskable).
 *
 * Build-time tool ONLY. Uses `sharp` (NOT a runtime dep — install transient:
 *   npm install --no-save sharp && node tools/gen-icons.js
 * server.js stays zero-dep). Source: bd ParisScorebis-4n12.
 *
 * Outputs (project root, siblings of icon.svg):
 *   icon-192.png            192² "any"      (Android home, transparency kept)
 *   icon-512.png            512² "any"      (splash / store)
 *   icon-512-maskable.png   512² "maskable" (full-bleed opaque, content in 80% safe zone)
 *   apple-touch-icon.png    180² opaque     (iOS Add-to-Home, flattened — iOS rounds itself)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'icon.svg');
const BG = { r: 2, g: 6, b: 23, alpha: 1 }; // #020617 — matches icon.svg radial floor

async function main() {
  const svg = fs.readFileSync(SRC);
  const out = (name) => path.join(ROOT, name);

  // "any" purpose — transparency preserved (rounded-rect corners stay clean)
  await sharp(svg, { density: 384 }).resize(192, 192).png().toFile(out('icon-192.png'));
  await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(out('icon-512.png'));

  // maskable — content scaled to 80% safe zone, padded onto opaque bg, fully flattened.
  // Android masks crop to circle/squircle: 51px pad each side (512→410 content) keeps
  // ring + P/S + PARI label inside the 40%-radius safe circle.
  await sharp(svg, { density: 384 })
    .resize(410, 410, { fit: 'contain', background: { r: 2, g: 6, b: 23, alpha: 0 } })
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(out('icon-512-maskable.png'));

  // iOS apple-touch — opaque (iOS fills transparent corners black otherwise), iOS rounds.
  await sharp(svg, { density: 384 })
    .resize(180, 180)
    .flatten({ background: BG })
    .png()
    .toFile(out('apple-touch-icon.png'));

  for (const f of ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png']) {
    const { size } = fs.statSync(out(f));
    console.log(`✓ ${f.padEnd(24)} ${(size / 1024).toFixed(1)} KB`);
  }
}

main().catch((e) => { console.error('gen-icons FAILED:', e.message); process.exit(1); });
