/** Diag rapide : que rend la home ? (onglets, cartes, variantes) */
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(12_000);
  console.log("articles:", await page.locator("article").count());
  console.log("skeletons:", await page.locator("[data-slot=skeleton], .animate-pulse").count());
  const tabs = await page.locator('[role="tab"], [role="tablist"] button').allInnerTexts();
  console.log("tabs:", JSON.stringify(tabs));
  const h = await page.locator("h1, h2").allInnerTexts();
  console.log("headings:", JSON.stringify(h.slice(0, 8)));
  const bodyTxt = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
  console.log("body:", bodyTxt);
  await page.screenshot({ path: ".context/diag-home.png", fullPage: false });
  await browser.close();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
