const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto("https://pariscore.fr", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.querySelectorAll('[role="dialog"]').forEach((d) => d.remove());
  });
  await p.locator('nav[aria-label="Navigation principale"] button:has-text("Favoris")').click();
  await p.waitForTimeout(1500);
  const headings = await p.evaluate(() =>
    [...document.querySelectorAll("h2")].map((h) => h.textContent.trim()).slice(0, 8),
  );
  const hasFavorisHeading = await p
    .locator('section h2:text-is("Favoris")')
    .count()
    .catch(() => -1);
  const bodyStart = await p.evaluate(() => document.body.innerText.slice(0, 300));
  console.log(JSON.stringify({ url: p.url(), headings, hasFavorisHeading, bodyStart }, null, 2));
  await b.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
