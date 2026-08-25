/**
 * Sonde repro — sélection d'un match live tennis dans la sidebar → visibilité
 * dans la grille centrale (onglet Tennis). Compare aussi un match prematch.
 */
const BASE = process.argv[2] || "http://localhost:3000";

let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const consent = page.locator("button", { hasText: /accept|accepter/i }).first();
  if (await consent.isVisible().catch(() => false)) { await consent.click().catch(() => {}); }

  // Attendre un aside VISIBLE avec l'arbre hydraté (évite les drawers cachés)
  await page
    .waitForFunction(
      () => Array.from(document.querySelectorAll("aside")).some((a) => a.offsetParent !== null && a.querySelector('button[aria-expanded]')),
      { timeout: 30_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(3_000);

  const aside = page.locator("aside:visible").first();
  console.log("[0] asides visibles:", await page.locator("aside:visible").count());
  // Filtre sidebar sur Live pour n'avoir QUE des matchs live
  await aside.getByRole("group").first().getByRole("button", { name: /^live$/i }).click();
  await page.waitForTimeout(500);

  // Déplie tennis côté sidebar (le clic tab peut être superflu si déjà actif)
  const tennisBtn = aside.locator('button[aria-expanded]', { hasText: /tennis/i }).first();
  if (!(await tennisBtn.isVisible().catch(() => false))) {
    console.log("[1a] bouton Tennis absent — page pas sur vue avec arbre ?");
    await page.screenshot({ path: ".context/repro-fail.png" });
    await browser.close();
    return;
  }
  if ((await tennisBtn.getAttribute("aria-expanded")) !== "true") await tennisBtn.click();
  await page.waitForTimeout(300);
  for (const b of await aside.locator('li button[aria-expanded]').all()) {
    if ((await b.getAttribute("aria-expanded")) !== "true") { await b.click().catch(() => {}); await page.waitForTimeout(100); }
  }
  await page.waitForTimeout(400);

  // Lignes de matchs = boutons title contenant 'sélection'
  const rows = aside.locator('button[title*="sélection"]');
  console.log("[1] lignes live visibles:", await rows.count());
  if ((await rows.count()) === 0) { console.log("pas de lignes — stop"); await browser.close(); return; }

  const first = rows.first();
  const rowText = (await first.innerText()).replace(/\n/g, " ");
  console.log("[2] je clique:", JSON.stringify(rowText.slice(0, 60)));
  try {
    await first.click({ timeout: 5_000 });
    console.log("[2b] clic ok");
  } catch (e) {
    console.log("[2b] clic ERR:", String(e.message).slice(0, 120));
  }
  await page.waitForTimeout(500);
  const pressedNow = await first.getAttribute("aria-pressed").catch(() => "?");
  const bannersNow = await page.locator("text=/sélectionné/i").count();
  console.log("[2e] aria-pressed immédiat:", pressedNow, "| bannières:", bannersNow);
  await page.waitForTimeout(700);

  // Bascule sur la grille centrale Tennis (onglet principal)
  await page.evaluate(() => { window.__probeFlag = "alive"; });
  const dumpStore = async (tag) => {
    const s = await page
      .evaluate(() => {
        const st = window.__ssStore;
        if (!st) return { missing: true };
        const g = st.getState();
        return { sel: g.selectedMatchIds, tree: g.treeStatus, sport: g.selectedSportId };
      })
      .catch((e) => ({ err: String(e).slice(0, 80) }));
    console.log(`[S:${tag}]`, JSON.stringify(s));
  };
  await dumpStore("avant-clic");
  try {
    await page.getByRole("tab", { name: /^tennis$/i }).click({ timeout: 8_000 });
    console.log("[2c] onglet tennis cliqué");
  } catch (e) {
    console.log("[2c] onglet ERR:", String(e.message).slice(0, 120));
  }
  await page.waitForTimeout(4_000);
  const flag = await page.evaluate(() => window.__probeFlag ?? "PERDU(reload?)").catch(() => "?");
  console.log("[2f] flag window:", flag, "| url:", page.url());
  await dumpStore("après-tab");
  // Timeline cartes/bannière/aside après le switch
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(1_000);
    const c = await gridCards.count().catch(() => -1);
    const b = await page.locator("text=/sélectionné/i").count();
    const av = await page.locator("aside:visible").count();
    console.log(`[t+${i}s] cartes=${c} bannières=${b} asidesVisibles=${av}`);
    if (c > 0) break;
  }

  // Compte les cartes de la grille centrale + cherche le joueur cliqué
  const gridCards = page.locator("main article");
  const nCards = await gridCards.count().catch(() => -1);
  console.log("[3] cartes grille:", nCards);
  const bodyTxt = await page.locator("main").innerText().catch(() => "(err)");
  const keyName = rowText.split(/\s+[–-]\s+|\svs\s/i)[0].trim();
  const found = bodyTxt.toLowerCase().includes(keyName.toLowerCase());
  console.log("[4] texte cliqué retrouvé dans main:", found, "| nom:", JSON.stringify(keyName));
  const banner = await page.locator("text=/match sélectionné/i").first().innerText().catch(() => null);
  console.log("[5] bannière sélection:", banner && banner.replace(/\n/g, " "));
  const selCount = bodyTxt.match(/(\d+)\s*match(?:es|s)?\s*sélection/i);
  console.log("[6] compteur sélection:", selCount ? selCount[1] : "non trouvé");
  // Dump de la carte unique : quel match est réellement rendu, et OÙ ?
  if (nCards > 0) {
    const cardTxt = await gridCards.first().innerText().catch(() => "(err)");
    console.log("[7] carte[0]:", JSON.stringify(cardTxt.replace(/\n+/g, " | ").slice(0, 220)));
    const ancestry = await gridCards
      .first()
      .evaluate((el) => {
        const out = [];
        let e = el.parentElement;
        while (e && e !== document.body) {
          const heads = e.querySelectorAll(":scope h2, :scope h3, :scope h4");
          if (heads.length) out.push(Array.from(heads).map((h) => h.textContent.trim()).slice(0, 3).join(" / "));
          if (out.length >= 4) break;
          e = e.parentElement;
        }
        return out;
      })
      .catch(() => []);
    console.log("[8] ancêtres (titres):", JSON.stringify(ancestry));
    // Y a-t-il un état vide visible ailleurs ?
    const emptyMsg = await page.locator("text=/aucun match/i").count();
    console.log("[9] messages 'aucun match':", emptyMsg);
    // Dialog de détail ouvert automatiquement au clic ?
    const dlg = page.locator('[role="dialog"]').first();
    const dlgVisible = await dlg.isVisible().catch(() => false);
    console.log("[10] dialog détail visible:", dlgVisible);
    if (dlgVisible) {
      const dt = await dlg.innerText().catch(() => "");
      console.log("[11] dialog contenu:", JSON.stringify(dt.replace(/\n+/g, " | ").slice(0, 200)));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      const stillOpen = await dlg.isVisible().catch(() => false);
      console.log("[12] dialog après Escape:", stillOpen);
    }
    // Position de la carte (auto-scroll => centrée ?)
    const box = await gridCards.first().boundingBox().catch(() => null);
    console.log("[13] carte y=", box && Math.round(box.y), "(viewport 1100px)");
    const selAttr = await gridCards
      .first()
      .evaluate((el) => el.closest("[data-selected-match]")?.getAttribute("data-selected-match") ?? null)
      .catch(() => null);
    console.log("[14] data-selected-match:", selAttr);
    // Nom court attendu : initiale + nom de famille du 1er joueur
    const parts = keyName.split(/\s+/);
    const shortExpected = `${parts[0][0]}. ${parts[parts.length - 1]}`.toUpperCase();
    const cardTxt2 = await gridCards.first().innerText();
    console.log("[15] shortName attendu:", JSON.stringify(shortExpected), "| trouvé:", cardTxt2.toUpperCase().includes(shortExpected));
  } else {
    console.log("[7] aucune carte — état vide ?", (await page.locator("main").innerText()).slice(0, 150));
  }
  await page.screenshot({ path: ".context/repro-live-select.png" });
  await browser.close();
})().catch((e) => { console.error("PROBE FAIL:", e.message); process.exit(1); });
