#!/usr/bin/env node
/**
 * qa-h2h-screenshots.js — Screenshots Playwright de l'onglet H2H Basketball.
 *
 * Usage: node scripts/qa-h2h-screenshots.js [--base-url=http://localhost:3000]
 *
 * Sortie: .context/qa-h2h/desktop-1440.png, .context/qa-h2h/mobile-390.png
 */

'use strict';

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1] || 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', '.context', 'qa-h2h');

async function main() {
  // Créer le dossier de sortie
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // ── Desktop 1440px ──
  console.log('Screenshot desktop 1440px...');
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const desktopPage = await desktopCtx.newPage();
  await desktopPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await desktopPage.waitForTimeout(5000);

  // Cliquer sur l'onglet Basket
  const basketTab = desktopPage.locator('button:has-text("Basket"), [data-sport="basketball"]').first();
  if (await basketTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await basketTab.click();
    await desktopPage.waitForTimeout(2000);
  }

  // Cliquer sur le toggle H2H
  const h2hToggle = desktopPage.locator('button:has-text("H2H")').first();
  if (await h2hToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await h2hToggle.click();
    await desktopPage.waitForTimeout(3000);
  }

  await desktopPage.screenshot({
    path: path.join(OUT_DIR, 'desktop-1440.png'),
    fullPage: true,
  });
  console.log('  → .context/qa-h2h/desktop-1440.png');
  await desktopCtx.close();

  // ── Mobile 390px ──
  console.log('Screenshot mobile 390px...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    isMobile: true,
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mobilePage.waitForTimeout(5000);

  // Cliquer sur l'onglet Basket
  const mobileBasketTab = mobilePage.locator('button:has-text("Basket"), [data-sport="basketball"]').first();
  if (await mobileBasketTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await mobileBasketTab.click();
    await mobilePage.waitForTimeout(2000);
  }

  // Cliquer sur le toggle H2H
  const mobileH2hToggle = mobilePage.locator('button:has-text("H2H")').first();
  if (await mobileH2hToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await mobileH2hToggle.click();
    await mobilePage.waitForTimeout(3000);
  }

  await mobilePage.screenshot({
    path: path.join(OUT_DIR, 'mobile-390.png'),
    fullPage: true,
  });
  console.log('  → .context/qa-h2h/mobile-390.png');
  await mobileCtx.close();

  await browser.close();
  console.log('\n✔ Screenshots générés dans .context/qa-h2h/');
}

main().catch(e => {
  console.error('ERREUR:', e.message);
  process.exit(1);
});
