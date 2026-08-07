import { test, expect, devices } from "@playwright/test";

/**
 * QA APK — contexte WebView Android.
 *
 * L'APK Android (Capacitor, mode remote) charge exactement cette URL dans sa
 * WebView. Cette suite émule un téléphone Android (Pixel 7, 412x915, tactile)
 * et vérifie tout ce que l'APK affiche : boot, thème, APIs critiques,
 * navigation mobile, stockage, et absence d'erreur JS fatale.
 *
 * Surcharger la cible (ex. serveur local pour l'émulateur) :
 *   QA_BASE_URL=http://10.0.2.2:3000 npx playwright test tests/apk-webview.spec.ts
 *
 * NB : indépendante de baseURL (playwright.config.ts) — URLs absolues.
 */

const BASE = process.env.QA_BASE_URL ?? "https://pariscore.fr";

test.use({ ...devices["Pixel 7"] });

/**
 * Évalue la page en tolérant un rechargement en cours.
 * NB : jusqu'au déploiement du fix sw-register (garde premier claim), la prod
 * recharge la page une fois ~1-3 s après le load (clients.claim() du SW).
 */
async function evaluateStable<R>(
  page: import("@playwright/test").Page,
  fn: () => R,
  attempts = 6,
): Promise<R> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await page.evaluate(fn);
    } catch (e) {
      lastErr = e;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(1200);
    }
  }
  throw lastErr;
}

test.describe(`APK WebView QA — ${BASE}`, () => {
  let fatalErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    fatalErrors = [];
    page.on("pageerror", (err) => fatalErrors.push(err.message));
  });

  test("boot : page chargée, titre et lang fr valides", async ({ page }) => {
    const resp = await page.goto(BASE, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    expect(resp?.status(), "statut HTTP").toBeLessThan(400);
    await expect(page).toHaveTitle(/SetPoint|PariScore/i);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("thème sombre appliqué (cohérent splash APK #0E1217)", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 8_000 });
  });

  test("API critique /api/tennis/live répond 200", async ({ page }) => {
    const resp = await page.request.get(`${BASE}/api/tennis/live`, {
      timeout: 15_000,
    });
    expect(resp.status()).toBe(200);
  });

  test("au moins un appel /api de la page réussit (<500)", async ({ page }) => {
    const waitApi = page.waitForResponse(
      (r) => r.url().includes("/api/") && r.status() < 500,
      { timeout: 15_000 },
    );
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const r = await waitApi;
    expect(r.status()).toBeLessThan(500);
  });

  test("pas de débordement horizontal à 412px", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_500);
    // Tolère le reload SW éventuel (voir evaluateStable).
    const m = await evaluateStable(page, () => ({
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
    }));
    expect(m.sw).toBeLessThanOrEqual(m.iw + 1);
  });

  test("navigation mobile présente (bottom nav / tabs)", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const nav = page
      .locator("nav, [role='tablist'], [role='navigation']")
      .first();
    await expect(nav).toBeVisible({ timeout: 10_000 });
  });

  test("localStorage disponible (favoris / bet slip)", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const v = await page.evaluate(() => {
      localStorage.setItem("__qa_apk_probe", "ok");
      return localStorage.getItem("__qa_apk_probe");
    });
    expect(v).toBe("ok");
  });

  test("aucune erreur JS fatale au boot", async ({ page }) => {
    await page
      .goto(BASE, { waitUntil: "networkidle", timeout: 25_000 })
      .catch(() => {
        /* networkidle peut ne jamais arriver (SSE/polling) — on ignore */
      });
    await page.waitForTimeout(1_500);
    expect(fatalErrors, fatalErrors.join(" | ")).toHaveLength(0);
  });
});
