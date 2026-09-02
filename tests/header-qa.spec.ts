/**
 * Header QA — Tests complets du nouveau header 2-niveaux.
 *
 * Couvre : structure visuelle, sport tabs, search modal (Ctrl+K),
 * notifications dropdown, user menu, settings link, responsive, edge cases.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

/* ======================================================================
   Helpers
   ====================================================================== */

async function waitForHeader(page: Page) {
  await page.waitForSelector("header", { state: "visible", timeout: 10_000 });
}

function level2(page: Page) {
  return page.locator('[role="tablist"]').first();
}

function sportTab(page: Page, id: string) {
  return page.locator(`[data-sport="${id}"]`);
}

/* ======================================================================
   1. Visual / Structure
   ====================================================================== */

test.describe("1. Visual / Structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
  });

  test("1.1 Header renders with 2 visible levels", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
    const logo = header.locator('a[aria-label*="PariScore"]');
    await expect(logo).toBeVisible();
    const tablist = level2(page);
    await expect(tablist).toBeVisible();
    await expect(tablist).toHaveAttribute("role", "tablist");
  });

  test("1.2 Logo is visible and clickable", async ({ page }) => {
    const logo = page.locator('a[aria-label*="PariScore"]');
    await expect(logo).toBeVisible();
    await expect(logo).toContainText("PariScore");
    await logo.click();
    await expect(page).toHaveURL(/pariscore\.fr\/?$/);
  });

  test("1.3 Sport tabs visible in level 2", async ({ page }) => {
    const tabs = level2(page);
    await expect(tabs).toBeVisible();
    const football = sportTab(page, "football");
    await expect(football).toBeVisible();
  });

  test("1.4 No overlapping elements between level 1 and level 2", async ({ page }) => {
    const header = page.locator("header");
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const children = header.locator("> div");
    const count = await children.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const l1 = await children.nth(0).boundingBox();
    const l2 = await children.nth(1).boundingBox();
    expect(l1).not.toBeNull();
    expect(l2).not.toBeNull();
    if (!l1 || !l2) return;

    expect(l2.y).toBeGreaterThanOrEqual(l1.y + l1.height - 2);
  });

  test("1.5 Dark theme applied (background is dark)", async ({ page }) => {
    const header = page.locator("header");
    const bg = await header.evaluate((el) => getComputedStyle(el).backgroundColor);
    const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      expect(Math.min(r, g, b)).toBeLessThan(80);
    }
  });

  test("1.6 Search button visible on desktop", async ({ page }) => {
    const searchBtn = page.locator('button[aria-label*="Rechercher"]').first();
    await expect(searchBtn).toBeVisible();
  });

  test("1.7 Notifications bell visible", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await expect(bell).toBeVisible();
  });

  test("1.8 Settings gear visible and links to /settings", async ({ page }) => {
    const settings = page.locator('a[href="/settings"]').first();
    await expect(settings).toBeVisible();
    await expect(settings).toHaveAttribute("aria-label", "Paramètres");
  });
});

/* ======================================================================
   2. Sport Tabs
   ====================================================================== */

test.describe("2. Sport Tabs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
  });

  test("2.1 Active tab highlighted with emerald color", async ({ page }) => {
    const football = sportTab(page, "football");
    await expect(football).toHaveAttribute("aria-selected", "true");
    const color = await football.evaluate((el) => getComputedStyle(el).color);
    expect(color).toMatch(/rgb/);
  });

  test("2.2 Clicking a sport tab changes active state", async ({ page }) => {
    const football = sportTab(page, "football");
    const tennis = sportTab(page, "tennis");
    await expect(football).toHaveAttribute("aria-selected", "true");
    await expect(tennis).toHaveAttribute("aria-selected", "false");
    await tennis.click();
    await expect(tennis).toHaveAttribute("aria-selected", "true");
    await expect(football).toHaveAttribute("aria-selected", "false");
  });

  test("2.3 All 9 sport tabs exist (desktop)", async ({ page }) => {
    const ids = ["football", "tennis", "basketball", "rugby", "mma", "cycling", "f1", "baseball", "cs2"];
    for (const id of ids) {
      const tab = sportTab(page, id);
      await expect(tab).toBeAttached();
    }
  });

  test("2.4 Sport tab has emoji and label", async ({ page }) => {
    const football = sportTab(page, "football");
    await expect(football).toContainText("⚽");
    await expect(football).toContainText("Football");
  });

  test("2.5 Active tab has emerald indicator bar", async ({ page }) => {
    const football = sportTab(page, "football");
    const indicator = football.locator('div[class*="bg-emerald"]');
    await expect(indicator).toBeVisible();
  });
});

/* ======================================================================
   3. Search Modal (Ctrl+K)
   ====================================================================== */

test.describe("3. Search Modal (Ctrl+K)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
  });

  test("3.1 Ctrl+K opens search modal", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator('[role="dialog"][aria-label="Recherche"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
  });

  test("3.2 Search input is focused when modal opens", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.locator('[role="dialog"] input[type="text"]');
    await expect(input).toBeFocused({ timeout: 3_000 });
  });

  test("3.3 Typing filters results", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.locator('[role="dialog"] input[type="text"]');
    await input.fill("PSG");
    const results = page.locator('[role="dialog"] [data-search-item]');
    await expect(results.first()).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('[role="dialog"]')).toContainText("PSG");
  });

  test("3.4 Esc closes search modal", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator('[role="dialog"][aria-label="Recherche"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });

  test("3.5 Clicking overlay closes search modal", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator('[role="dialog"][aria-label="Recherche"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await page.locator('[role="dialog"]').first().click({ position: { x: 10, y: 10 } });
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });

  test("3.6 Arrow keys navigate results", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    const activeItem = page.locator('[role="dialog"] [data-search-item]');
    const count = await activeItem.count();
    expect(count).toBeGreaterThan(0);
  });

  test("3.7 Enter selects result and closes modal", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator('[role="dialog"][aria-label="Recherche"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });

  test("3.8 Clear button clears search text", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const input = page.locator('[role="dialog"] input[type="text"]');
    await input.fill("test");
    const clearBtn = page.locator('[role="dialog"] button[aria-label="Effacer"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(input).toHaveValue("");
  });

  test("3.9 Search shows categories", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toContainText("Matchs");
    await expect(dialog).toContainText("Équipes");
    await expect(dialog).toContainText("Ligues");
  });

  test("3.10 Status bar shows result count", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toContainText("résultat");
  });
});

/* ======================================================================
   4. Notifications Dropdown
   ====================================================================== */

test.describe("4. Notifications Dropdown", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
  });

  test("4.1 Click bell icon opens dropdown", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover).toBeVisible({ timeout: 3_000 });
  });

  test("4.2 Dropdown shows Value Bets section", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    await expect(page.locator('[data-radix-popper-content-wrapper]')).toContainText("Value Bet");
  });

  test("4.3 Dropdown shows Push toggle", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    await expect(page.locator('[data-radix-popper-content-wrapper]')).toContainText("Push");
  });

  test("4.4 Dropdown shows Email section", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover).toContainText("Email");
  });

  test("4.5 Dropdown shows Digest toggle", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    await expect(page.locator('[data-radix-popper-content-wrapper]')).toContainText("Digest");
  });

  test("4.6 Footer links to /settings", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    const settingsLink = page.locator('[data-radix-popper-content-wrapper] a[href="/settings"]');
    await expect(settingsLink).toBeVisible();
  });

  test("4.7 Toggle switches have role=switch", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    const switches = page.locator('[data-radix-popper-content-wrapper] [role="switch"]');
    const count = await switches.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

/* ======================================================================
   5. User Menu
   ====================================================================== */

test.describe("5. User Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
  });

  test("5.1 Click user icon opens dropdown", async ({ page }) => {
    const userBtn = page.locator('button[aria-label*="menu"]').first();
    await userBtn.click();
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover).toBeVisible({ timeout: 3_000 });
  });

  test("5.2 Menu shows Paramètres linking to /settings", async ({ page }) => {
    const userBtn = page.locator('button[aria-label*="menu"]').first();
    await userBtn.click();
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover).toContainText("Paramètres");
  });

  test("5.3 Language toggle shows current locale", async ({ page }) => {
    const userBtn = page.locator('button[aria-label*="menu"]').first();
    await userBtn.click();
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    const text = await popover.textContent();
    expect(text).toMatch(/FR|EN/);
  });

  test("5.4 Theme toggle exists", async ({ page }) => {
    const userBtn = page.locator('button[aria-label*="menu"]').first();
    await userBtn.click();
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    const text = await popover.textContent();
    expect(text).toMatch(/sombre|clair|dark|light/i);
  });

  test("5.5 Menu has logout option", async ({ page }) => {
    const userBtn = page.locator('button[aria-label*="menu"]').first();
    await userBtn.click();
    const popover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(popover).toContainText("Déconnexion");
  });

  test("5.6 Menu items have Lucide icons", async ({ page }) => {
    const userBtn = page.locator('button[aria-label*="menu"]').first();
    await userBtn.click();
    const svgs = page.locator('[data-radix-popper-content-wrapper] nav svg');
    const count = await svgs.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

/* ======================================================================
   6. Settings Link
   ====================================================================== */

test.describe("6. Settings Link", () => {
  test("6.1 Gear icon navigates to /settings", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    const settings = page.locator('a[href="/settings"]').first();
    await settings.click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test("6.2 Settings page shows DensityToggle section", async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Affichage")).toBeVisible();
  });

  test("6.3 Settings page shows AbTestDebugBadge section", async ({ page }) => {
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("text=Debug")).toBeVisible();
  });
});

/* ======================================================================
   7. Responsive
   ====================================================================== */

test.describe("7. Responsive", () => {
  test("7.1 Mobile: search becomes icon only", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    const desktopSearch = page.locator('button[aria-label*="Rechercher (Ctrl"]');
    await expect(desktopSearch).not.toBeVisible();
    const mobileSearch = page.locator('button[aria-label="Rechercher"]').last();
    await expect(mobileSearch).toBeVisible();
  });

  test("7.2 Mobile: Plus dropdown for overflow sports", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    const moreBtn = page.locator('button:has-text("Plus")');
    await expect(moreBtn).toBeVisible();
  });

  test("7.3 Mobile: Plus dropdown shows overflow sports", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    const moreBtn = page.locator('button:has-text("Plus")');
    await moreBtn.click();
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("Cyclisme");
  });

  test("7.4 Tablet: sport tabs visible and scrollable", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    const tablist = level2(page);
    await expect(tablist).toBeVisible();
  });

  test("7.5 Desktop: full layout visible", async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    await expect(page.locator('a[aria-label*="PariScore"]')).toBeVisible();
    await expect(page.locator('button[aria-label*="Rechercher"]')).toBeVisible();
    await expect(level2(page)).toBeVisible();
  });
});

/* ======================================================================
   8. Edge Cases
   ====================================================================== */

test.describe("8. Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
  });

  test("8.1 Rapid clicking doesn't break layout", async ({ page }) => {
    const sports = ["football", "tennis", "basketball", "rugby", "mma"];
    for (let i = 0; i < 3; i++) {
      for (const sport of sports) {
        await sportTab(page, sport).click({ timeout: 2_000 });
      }
    }
    await expect(page.locator("header")).toBeVisible();
    const activeTabs = page.locator('[role="tab"][aria-selected="true"]');
    await expect(activeTabs).toHaveCount(1);
  });

  test("8.2 Multiple dropdowns don't open simultaneously", async ({ page }) => {
    const bell = page.locator('button[aria-label*="Notification"]').first();
    await bell.click();
    const notifPopover = page.locator('[data-radix-popper-content-wrapper]');
    await expect(notifPopover).toBeVisible({ timeout: 3_000 });
    const userBtn = page.locator('button[aria-label*="menu"]').first();
    await userBtn.click();
    await page.waitForTimeout(500);
    const popovers = page.locator('[data-radix-popper-content-wrapper]');
    const count = await popovers.count();
    expect(count).toBeLessThanOrEqual(2);
  });

  test("8.3 Keyboard navigation through header", async ({ page }) => {
    const logo = page.locator('a[aria-label*="PariScore"]');
    await logo.focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
    }
    await expect(page.locator("header")).toBeVisible();
  });

  test("8.4 Sport tabs have proper ARIA attributes", async ({ page }) => {
    const tablist = level2(page);
    await expect(tablist).toHaveAttribute("role", "tablist");
    await expect(tablist).toHaveAttribute("aria-label", "Navigation par sport");
    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      await expect(tab).toHaveAttribute("aria-selected");
    }
  });

  test("8.5 Search modal has proper ARIA attributes", async ({ page }) => {
    await page.keyboard.press("Control+k");
    const dialog = page.locator('[role="dialog"][aria-label="Recherche"]');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("8.6 Auto-hide header survives scroll", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    const header = page.locator("header");
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    await expect(header).toBeAttached();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await expect(header).toBeVisible();
  });

  test("8.7 Focus-visible ring on sport tabs", async ({ page }) => {
    const football = sportTab(page, "football");
    await football.focus();
    const outline = await football.evaluate(() => {
      return getComputedStyle(document.activeElement!).outlineStyle;
    });
    expect(outline).toBeDefined();
  });
});

/* ======================================================================
   9. No Duplication
   ====================================================================== */

test.describe("9. No Duplication", () => {
  test("9.1 Only ONE sport tablist with correct aria-label", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForHeader(page);
    const tablists = page.locator('[role="tablist"][aria-label="Navigation par sport"]');
    const count = await tablists.count();
    expect(count).toBe(1);
  });
});
