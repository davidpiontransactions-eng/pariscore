/**
 * Sonde QA — widget Top 5 matchs tennis dans la sidebar.
 * Vérifie : rendu sous l'onglet Tennis, ≥1 ligne, changement de métrique
 * via le Select, filtre surface. Screenshot .context/tennis-top5.png
 * Usage : node scripts/probe-tennis-top5.js [baseUrl]
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
  if (await consent.isVisible().catch(() => false)) {
    await consent.click().catch(() => {});
    await page.waitForTimeout(400);
  }

  await page.getByRole("tab", { name: /^tennis$/i }).click();
  await page.waitForTimeout(5_000);

  const widget = page.locator('section[aria-label="Top 5 matchs tennis par métrique"]');
  console.log("[1] widget visible:", await widget.isVisible().catch(() => false));
  if (!(await widget.isVisible().catch(() => false))) {
    const secs = await page.locator("section[aria-label]").allInnerTexts();
    console.log("[1b] sections:", JSON.stringify(secs.map((s) => s.slice(0, 40))));
    await page.screenshot({ path: ".context/tennis-top5-fail.png" });
    await browser.close();
    return;
  }

  // Lignes initiales (métrique par défaut : Élo surface)
  let rows = widget.locator("li");
  console.log("[2] lignes (Élo surface):", await rows.count());

  // Change la métrique → « Domination service » (source leaderboard)
  await widget.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /Domination service/i }).click();
  await page.waitForTimeout(3_000);
  rows = widget.locator("li");
  console.log("[3] lignes (service):", await rows.count());
  console.log("[3b] description:", JSON.stringify(await widget.locator("p.text-emerald-400").first().innerText().catch(() => "")));

  // Filtre surface « Terre battue »
  await widget.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: /Terre battue/i }).click();
  await page.waitForTimeout(3_000);
  rows = widget.locator("li");
  console.log("[4] lignes (service × terre):", await rows.count());

  // Retour métrique Élo surface avec surface Terre battue
  await widget.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /surface/i }).click();
  await page.waitForTimeout(3_000);
  rows = widget.locator("li");
  console.log("[5] lignes (élo surface × terre):", await rows.count());

  await widget.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".context/tennis-top5.png" });
  console.log("[6] screenshot: .context/tennis-top5.png");
  console.log("[7] erreurs console:", JSON.stringify(errors.slice(0, 6)));
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL:", e.message); process.exit(1); });
