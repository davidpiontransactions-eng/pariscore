/** Repro minimal : sélection live sidebar → présence carte grille (déjà sur Tennis). */
const BASE = process.argv[2] || "http://localhost:3000";
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto(BASE + "/?sport=tennis", { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Clear sidebar store to reset treeStatus to "all"
  await page.evaluate(() => {
    localStorage.removeItem('pariscore.sportsSidebar');
  });
  // Reload to apply cleared store
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  // Wait for sidebar to fully populate with sports tree
  await page
    .waitForFunction(
      () => {
        const asides = Array.from(document.querySelectorAll("aside"));
        const aside = asides.find(a => a.offsetParent !== null);
        if (!aside) return false;
        // Check if tennis sport exists in the tree
        const tennisBtn = aside.querySelector('button[aria-expanded]');
        return !!tennisBtn;
      },
      { timeout: 30_000 },
    )
    .catch(() => {});
  // Extra wait for tree data to load
  await page.waitForTimeout(3000);
  // Wait for sidebar tree to populate with sport buttons
  await page
    .waitForFunction(
      () => {
        const aside = document.querySelector("aside:visible");
        if (!aside) return false;
        return aside.querySelectorAll('button[aria-expanded]').length > 0;
      },
      { timeout: 30_000 },
    )
    .catch(() => {});
  const aside = page.locator("aside:visible").first();
  console.log("[1] aside ok");

  // Debug: list all sport buttons in sidebar
  const sportBtns = await aside.locator('button[aria-expanded]').all();
  console.log("[debug] sport buttons count:", sportBtns.length);
  for (let i = 0; i < Math.min(sportBtns.length, 10); i++) {
    try {
      const text = (await sportBtns[i].innerText()).replace(/\s+/g, " ").slice(0, 50);
      console.log(`[debug] sport ${i}:`, text);
    } catch {}
  }

  // Don't click treeStatus "live" filter - keep "all" to see tennis matches
  // await aside.getByRole("group").first().getByRole("button", { name: /^live$/i }).click().catch((e) => console.log("filtre ERR"));
  // await page.waitForTimeout(400);

  const tBtn = aside.locator('button[aria-expanded]', { hasText: /tennis/i }).first();
  try {
    if ((await tBtn.getAttribute("aria-expanded")) !== "true") await tBtn.click();
  } catch (e) { console.log("tennis expand err:", e.message); }
  for (const b of await aside.locator("li button[aria-expanded]").all()) {
    try { if ((await b.getAttribute("aria-expanded")) !== "true") { await b.click().catch(() => {}); } } catch {}
  }
  await page.waitForTimeout(500);

  // Find tennis-specific match rows (look for tennis player names, not CS2 teams)
  const rows = await aside.locator('li').all();
  let tennisRow = null;
  for (const row of rows) {
    const btn = row.locator('button[title*="sélection"]').first();
    if (await btn.count() > 0) {
      const text = (await btn.innerText()).replace(/\s+/g, " ");
      // Check if this looks like a tennis match (has " – " separator, no CS2 team names)
      if (text.includes(" – ") && !text.toLowerCase().includes("gaming") && !text.toLowerCase().includes("esports")) {
        tennisRow = btn;
        console.log("[3] found tennis row:", JSON.stringify(text.slice(0, 80)));
        try { await btn.click(); } catch (e) { console.log("click err:", e.message); }
        break;
      }
    }
  }
  if (!tennisRow) {
    console.log("[3] NO TENNIS ROW FOUND - trying first row");
    const rows2 = aside.locator('button[title*="sélection"]');
    console.log("[2] total rows:", await rows2.count());
    if (await rows2.count() > 0) {
      const rowText = (await rows2.first().innerText()).replace(/\s+/g, " ");
      console.log("[3] clic sur (fallback):", JSON.stringify(rowText.slice(0, 80)));
      await rows2.first().click();
    }
  }
  await page.waitForTimeout(600);
  try {
    console.log("[4] pressed:", await tennisRow?.getAttribute("aria-pressed") ?? "n/a");
  } catch (e) { console.log("pressed err:", e.message); }

  // Debug: check liveMatchList and liveStates in the component via React DevTools
  const debugState = await page.evaluate(() => {
    const store = window.__ssStore?.getState?.();
    return {
      selectedMatchIds: store?.selectedMatchIds,
      liveStatesKeys: store ? Object.keys(store.liveStates || {}) : 'no store',
    };
  });
  console.log("[debug] store:", JSON.stringify(debugState));

  // Also check what the API returns for live matches
  const apiLive = await page.evaluate(async () => {
    const res = await fetch("/api/tennis/live");
    const data = await res.json();
    return { count: data.matches?.length, ids: data.matches?.map(m => m.id).slice(0, 5) };
  });
  console.log("[debug] API live:", JSON.stringify(apiLive));

  // Wait longer for polling/SSE to populate data
  console.log("[wait] waiting 15s for live data to populate...");
  await page.waitForTimeout(15_000);

  // Check the component's computed liveMatchList and restForGrid via debug object
  const compDebug = await page.evaluate(() => {
    try {
      return window.__TENNIS_DEBUG__ || { error: 'no debug object' };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log("[debug] component state:", JSON.stringify(compDebug));

  // Check the component's computed liveMatchList and restForGrid
  const compState = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return { error: 'no main' };
    const articles = main.querySelectorAll('article');
    return {
      articleCount: articles.length,
      firstArticleHtml: articles[0]?.outerHTML?.slice(0, 200),
      selectedAttr: articles[0]?.closest('[data-selected-match]')?.getAttribute('data-selected-match') ?? null,
    };
  });
  console.log("[debug] DOM after 15s:", JSON.stringify(compState));

  for (let i = 1; i <= 20; i++) {
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
