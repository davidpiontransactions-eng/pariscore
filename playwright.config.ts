import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the SetPoint · Tennis Prematch app.
 *
 * The Next.js dev server is ALREADY running on port 3000 (auto-started by the
 * sandbox). We MUST NOT auto-start a second instance — `reuseExistingServer`
 * is implicitly true when `webServer` is omitted.
 *
 * See:
 *   https://playwright.dev/docs/test-webserver#reusing-existing-server
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // Don't run tests in parallel against a single dev server — SWR cache + WS
  // can race. We still get file-level parallelism disabled here; tests inside
  // a file run serially by default.
  forbidOnly: !!isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Ensure deterministic locale/timezone — the app reads NEXT_LOCALE cookie
    // for translations; default is French.
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    // Ignore hydration warnings from next-themes (suppressHydrationWarning on
    // <html> already silences them in-app; this is for console noise only).
    // Keep strict mode OFF so we see real warnings.
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
