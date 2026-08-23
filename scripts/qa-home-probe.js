/* Sonde QA visuelle — Page d'accueil par défaut (post-deploy 9f37e573) */
const { chromium } = require("@playwright/test");
const BASE = process.env.QA_BASE_URL || "https://pariscore.fr";

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(5000);

  const result = {};
  // 1. La vue Accueil est affichée par défaut
  result.welcomePanel = await page.locator("text=Bienvenue sur PariScore").count() > 0;
  result.homeSection = await page.locator('section[aria-label="Accueil PariScore"]').count();
  // 2. Pas de grille tennis par défaut
  result.tennisGridVisible = await page.locator("text=Choisis ton sport").count(); // onboarding présent = home
  // 3. Onglet Accueil en tête de SportTabs
  result.firstTabIsAccueil = await page
    .locator('[role="tablist"] [role="tab"]')
    .first()
    .textContent()
    .then((t) => (t || "").trim().startsWith("Accueil"))
    .catch(() => false);
  // 4. CTA primaire fonctionne → bascule Football + Top5 select présent
  await page.locator('button:has-text("Explorer le football")').first().click();
  await page.waitForTimeout(5000);
  result.top5AfterCta = await page
    .locator('section[aria-label="Top 5 matchs par stratégie"]')
    .count();
  result.urlHasSportParam = page.url();

  await page.screenshot({ path: ".context/qa-home-prod.png" });

  // Retour accueil via logo (bouton contenant le nom de l'app)
  const logoBtn = page.locator('button', { hasText: 'PariScore' }).first();
  if ((await logoBtn.count()) > 0) {
    await logoBtn.click();
    await page.waitForTimeout(2000);
  }
  result.backToHome = await page.locator("text=Bienvenue sur PariScore").count() > 0;

  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  const pass =
    result.welcomePanel && result.homeSection > 0 && result.firstTabIsAccueil &&
    result.top5AfterCta > 0;
  console.log(pass ? "QA_HOME_PASS" : "QA_HOME_FAIL");
})().catch((e) => {
  console.error("PROBE_ERROR:", e.message);
  process.exit(1);
});
