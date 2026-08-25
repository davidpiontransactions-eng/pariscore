/**
 * Sonde QA — filtre de statut sidebar (Tout/Live/Avant-match) + noms de
 * tournois tennis dans l'arbre. Screenshots .context/sidebar-status-*.png
 * Usage : node scripts/probe-sidebar-status.js [baseUrl]
 */
const BASE = process.argv[2] || "http://localhost:3000";

let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(6_000);
  const consent = page.locator("button", { hasText: /accept|accepter/i }).first();
  if (await consent.isVisible().catch(() => false)) { await consent.click().catch(() => {}); }

  await page.getByRole("tab", { name: /^tennis$/i }).click();
  await page.waitForTimeout(5_000);

  const aside = page.locator("aside").first();
  const group = aside.getByRole("group").first();
  const tennisBtn = aside.locator('button[aria-expanded]', { hasText: /tennis/i }).first();

  const label = async () => (await tennisBtn.innerText()).replace(/\n/g, " ");
  const rows = async () => await aside.locator('button[title*="sélection"]').count();

  // Déplie tout (tennis → pays → ligues)
  if ((await tennisBtn.getAttribute("aria-expanded")) !== "true") await tennisBtn.click();
  await page.waitForTimeout(400);
  for (const b of await aside.locator('li button[aria-expanded]').all()) {
    if ((await b.getAttribute("aria-expanded")) !== "true") { await b.click().catch(() => {}); await page.waitForTimeout(100); }
  }
  await page.waitForTimeout(500);

  console.log("[Tout] badge:", JSON.stringify(await label()), "| lignes:", await rows());
  const leagues = (await aside.locator("button span.truncate, li div span").allInnerTexts())
    .filter((s) => /ATP|WTA|UTR|Challeng|Open|Cup|Salem|Tour|PTT/i.test(s));
  console.log("[noms tournois visibles]:", JSON.stringify([...new Set(leagues)].slice(0, 10)));
  await page.screenshot({ path: ".context/sidebar-status-all.png" });

  await group.getByRole("button", { name: /^live$/i }).click();
  await page.waitForTimeout(700);
  console.log("[Live] badge:", JSON.stringify(await label()), "| lignes:", await rows());

  await group.getByRole("button", { name: /avant-match/i }).click();
  await page.waitForTimeout(700);
  console.log("[Avant-match] badge:", JSON.stringify(await label()), "| lignes:", await rows());

  await group.getByRole("button", { name: /^tout$/i }).click();
  await page.waitForTimeout(700);
  console.log("[Retour Tout] badge:", JSON.stringify(await label()), "| lignes:", await rows());

  await page.screenshot({ path: ".context/sidebar-status-final.png" });
  console.log("erreurs console:", JSON.stringify(errors.slice(0, 5)));
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL:", e.message); process.exit(1); });
