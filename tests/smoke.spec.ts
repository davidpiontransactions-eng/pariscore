import { test, expect } from "@playwright/test";
import { waitForMatches } from "./page-objects";

/**
 * Smoke tests — verifies the app boots, renders the header / hero / cards /
 * footer, and that the SWR-backed API call returns 3 match cards.
 *
 * These tests run against the already-running dev server on :3000.
 */

test.describe("Smoke — page boots and renders core structure", () => {
  test("page title is 'SetPoint · Tennis Prematch'", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SetPoint.*Tennis Prematch/);
  });

  test("html lang attribute defaults to French", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("default theme is dark (html has class 'dark')", async ({ page }) => {
    await page.goto("/");
    // next-themes sets the class on <html> after mount. Wait briefly.
    await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 5000 });
  });

  test("3 match cards are visible after SWR fetch", async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page, 3);
    await expect(page.locator("article")).toHaveCount(3);
  });

  test("header contains SetPoint logo, language toggle, and theme toggle", async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page);

    // The page <header> has role="banner"; each match card also has a <header>
    // (tournament/round), so use the role selector to disambiguate.
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
    await expect(header).toContainText("SetPoint");

    // Language toggle (button with "FR" or "EN" text + Languages icon)
    const langBtn = header
      .getByRole("button")
      .filter({ hasText: /^(FR|EN)$/ });
    await expect(langBtn.first()).toBeVisible();

    // Theme toggle (icon button with Sun or Moon icon)
    const themeBtn = header.locator(
      "button:has(svg.lucide-sun), button:has(svg.lucide-moon)",
    );
    await expect(themeBtn).toBeVisible();
  });

  test("header has live status indicator (role=status)", async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page);

    // The header contains at least one role="status" element (WebSocket
    // connection indicator and/or value bet scanner indicator).
    const header = page.getByRole("banner");
    const status = header.locator("[role='status']");
    await expect(status.first()).toBeVisible();
  });

  test("footer is visible with copyright text", async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page);

    // The page <footer> has role="contentinfo"; each match card also has a
    // <footer> (CTA bar), so use the role selector.
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    // Copyright mentions © 2026 and SetPoint
    await expect(footer).toContainText(/©\s*2026/);
    await expect(footer).toContainText("SetPoint");
  });

  test("hero section shows hero title + 3 matches today hint", async ({ page }) => {
    await page.goto("/");
    await waitForMatches(page, 3);

    // Hero title is "Tennis · Prematch" (FR) or "Tennis · Prematch" (EN)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Tennis/i);

    // The "X matchs aujourd'hui" badge text in the hero
    await expect(page.locator("main").locator("..")).toContainText(/3/);
  });
});
