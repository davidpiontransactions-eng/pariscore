const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto("https://pariscore.fr", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.waitForTimeout(3000);
  const seasons = await p.evaluate(async () => {
    const r = await fetch("/api/football/rankings?league=ligue1&scope=overall");
    const j = await r.json();
    return j.availableSeasons;
  });
  await p.locator('button span.text-sm.font-semibold', { hasText: /^Football$/ }).click();
  await p.waitForTimeout(6000);
  const top5 = p.locator('section[aria-label="Top 5 matchs par stratégie"]');
  await top5.locator('[data-slot="select-trigger"]').first().click();
  await p.waitForTimeout(400);
  await p.locator('[role="option"]:has-text("Over 1,5 buts")').click();
  await p.waitForTimeout(1200);
  const txt = await top5.innerText();
  console.log(JSON.stringify({ seasons, top5Text: txt.slice(0, 500) }, null, 2));
  await b.close();
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
