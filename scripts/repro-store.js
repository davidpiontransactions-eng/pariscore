/** Test direct : set selectedMatchIds avec un id live réel → grille + scroll. */
const BASE = process.argv[2] || "http://localhost:3000";
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto(BASE + "/?sport=tennis&view=live", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => !!window.__ssStore, null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(6_000);

  // Récupère un match live réel depuis le même endpoint que la sidebar
  const target = await page.evaluate(async () => {
    const r = await fetch("/api/tennis/live");
    const j = await r.json();
    const m = (j.matches || []).find((x) => x.isLive && x.playerA?.name);
    return m ? { id: String(m.id), name: m.playerA.name } : null;
  });
  console.log("[1] cible live:", JSON.stringify(target));
  if (!target) { await browser.close(); return; }

  await page.evaluate((id) => {
    window.__ssStore.setState({ selectedMatchIds: [id], treeStatus: "all" });
    window.__selId = id;
  }, target.id);
  await page.waitForTimeout(1_500);

  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(1_000);
    const info = await page.evaluate(() => {
      const el = document.querySelector('[data-selected-match="true"]');
      const cards = document.querySelectorAll("main article").length;
      const box = el ? el.getBoundingClientRect() : null;
      return {
        cards,
        hasSelected: !!el,
        y: box ? Math.round(box.y + window.scrollY) : null,
        viewportY: box ? Math.round(box.y) : null,
        bodyHasName: document.body.innerText.toLowerCase().includes(String(window.__selName ?? "").toLowerCase()),
      };
    }).catch((e) => ({ err: String(e).slice(0, 100) }));
    console.log(`[t${i}]`, JSON.stringify(info));
    if (info.hasSelected && info.viewportY != null && info.viewportY > 100 && info.viewportY < 800) {
      console.log("[OK] carte sélectionnée visible et centrée");
      break;
    }
  }
  await page.screenshot({ path: ".context/repro-store-select.png" });
  await browser.close();
})().catch((e) => { console.error("FAIL:", e); process.exit(1); });
