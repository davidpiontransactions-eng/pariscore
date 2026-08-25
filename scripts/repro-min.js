/** Repro minimal : sélection live sidebar → présence carte grille (déjà sur Tennis). */
const BASE = process.argv[2] || "http://localhost:3000";
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto(BASE + "/?sport=tennis&view=live", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page
    .waitForFunction(
      () => Array.from(document.querySelectorAll("aside")).some((a) => a.offsetParent !== null && a.querySelector('button[aria-expanded]')),
      { timeout: 30_000 },
    )
    .catch(() => {});
  const aside = page.locator("aside:visible").first();
  console.log("[1] aside ok");

  await aside.getByRole("group").first().getByRole("button", { name: /^live$/i }).click().catch((e) => console.log("filtre ERR"));
  await page.waitForTimeout(400);

  const tBtn = aside.locator('button[aria-expanded]', { hasText: /tennis/i }).first();
  if ((await tBtn.getAttribute("aria-expanded")) !== "true") await tBtn.click();
  for (const b of await aside.locator("li button[aria-expanded]").all()) {
    if ((await b.getAttribute("aria-expanded")) !== "true") { await b.click().catch(() => {}); }
  }
  await page.waitForTimeout(500);

  const rows = aside.locator('button[title*="sélection"]');
  console.log("[2] rows:", await rows.count());
  const rowText = (await rows.first().innerText()).replace(/\s+/g, " ");
  console.log("[3] clic sur:", JSON.stringify(rowText.slice(0, 50)));
  await rows.first().click();
  await page.waitForTimeout(600);
  console.log("[4] pressed:", await rows.first().getAttribute("aria-pressed"));

  for (let i = 1; i <= 10; i++) {
    await page.waitForTimeout(1_000);
    const cards = await page.locator("main article").count();
    const selAttr = cards > 0 ? await page.locator("main article").first().evaluate((el) => el.closest("[data-selected-match]")?.getAttribute("data-selected-match") ?? null).catch(() => null) : null;
    console.log(`[t${i}] cartes=${cards} selected=${selAttr}`);
    if (cards > 0) {
      const txt = await page.locator("main article").first().innerText();
      console.log("[final]", JSON.stringify(txt.replace(/\n+/g, " | ").slice(0, 160)));
      await page.screenshot({ path: ".context/repro-min-ok.png" });
      break;
    }
  }
  await browser.close();
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
