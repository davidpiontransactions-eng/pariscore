/* Analyse sidebar Winamax : structure sports + style icônes (lecture seule) */
const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  await page.goto("https://www.winamax.fr/paris-sportifs/sports/5/3/176509", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(8000);

  // Consentement
  try {
    const btn = page.locator('button:has-text("Accepter"), button:has-text("Tout accepter"), #didomi-notice-agree-button').first();
    if ((await btn.count()) > 0) await btn.click({ timeout: 5000 });
    await page.waitForTimeout(3000);
  } catch {}

  // La sidebar sportive : chercher la liste des sports
  const info = await page.evaluate(() => {
    const out = { navCandidates: [], svgUses: [], iconClasses: new Set() };
    document.querySelectorAll("aside, nav, [class*=sport-tree], [class*=sidebar], [id*=menu]").forEach((el) => {
      const cls = el.className || "";
      out.navCandidates.push({ tag: el.tagName, id: el.id, cls: String(cls).slice(0, 80) });
    });
    // Icônes SVG référencées (sprite) avec leur contexte texte
    document.querySelectorAll("svg use, svg symbol").forEach((u) => {
      const ref = u.getAttribute("xlink:href") || u.getAttribute("href") || u.id || "";
      if (ref) out.svgUses.push(ref);
    });
    // Classes d'icônes font/sprite à côté des noms de sports connus
    const known = ["Football","Tennis","Basketball","Basket","Rugby","Volleyball","Handball","Hockey","Golf","Boxe","MMA","Cyclisme","Formule 1","Baseball","NFL","Snooker","Fléchettes","eSport","Esport","Politique"];
    document.querySelectorAll("li, a").forEach((li) => {
      const txt = (li.textContent || "").trim();
      if (known.some((k) => txt === k || txt.startsWith(k))) {
        const iconEl = li.querySelector("[class*=icon], svg, i, span[class*=picto]");
        out.iconClasses.add(JSON.stringify({
          sport: txt.slice(0, 30),
          html: li.innerHTML.replace(/\s+/g, " ").slice(0, 220),
        }));
      }
    });
    out.iconClasses = [...out.iconClasses].slice(0, 40);
    return out;
  });

  console.log(JSON.stringify(info, null, 2).slice(0, 6000));
  await page.screenshot({ path: ".context/winamax-sidebar-full.png" });
  // Screenshot de la zone sidebar gauche si identifiable
  const aside = page.locator("aside, [class*=sidebar]").first();
  if ((await aside.count()) > 0) {
    await aside.screenshot({ path: ".context/winamax-sidebar.png" }).catch(() => {});
  }
  await browser.close();
})().catch((e) => {
  console.error("ERR:", e.message);
  process.exit(1);
});
