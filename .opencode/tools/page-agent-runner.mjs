/**
 * Page Agent Runner - Browser automation via Page Agent AI
 * Dual-mode: demo (free built-in LLM, no API key) or gemini (Gemini API via Node.js proxy).
 * The gemini mode uses page.route() to proxy Gemini API calls through Node.js,
 * bypassing CORS restrictions that would block browser-side fetch() calls.
 *
 * Usage:
 *   node page-agent-runner.mjs --url <url> --command <cmd>               (demo mode, default)
 *   node page-agent-runner.mjs --url <url> --command <cmd> --llm gemini   (Gemini mode)
 * Requires for gemini mode: GEMINI_API_KEY environment variable
 */

import { chromium } from "playwright";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env file if present (standalone runner won't have Bun's auto-load)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes if present
    const cleanVal = val.replace(/^['"](.*)['"]$/, "");
    if (!process.env[key]) {
      process.env[key] = cleanVal;
    }
  }
}

const CDN_AUTOINIT = "https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js";
const CDN_MANUAL = "https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js?autoInit=false";

/**
 * Set up a route proxy for localhost/127.0.0.1 URLs.
 * Chromium on this Windows machine cannot reach localhost directly (system-level
 * restriction). This proxy intercepts all requests to the target URL origin and
 * relays them through Node.js http.request(), bypassing the restriction.
 * Also handles OPTIONS preflight for any fetch() calls.
 */
function setupLocalhostProxy(page, targetUrl) {
  const parsed = new URL(targetUrl);
  const origin = parsed.origin; // e.g. "http://127.0.0.1:3000"
  const pattern = origin + "/**";

  console.error("[localhost-proxy] Intercepting:", pattern);

  return page.route(pattern, async (route) => {
    const req = route.request();
    const reqUrl = req.url();
    const method = req.method();
    const isNavigation = req.isNavigationRequest();

    // Handle CORS preflight (for fetch() calls from the page)
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    try {
      // Relay through Node.js http.request
      const backendUrl = new URL(reqUrl);
      const options = {
        hostname: backendUrl.hostname,
        port: backendUrl.port || 80,
        path: backendUrl.pathname + backendUrl.search,
        method: method,
        headers: { ...req.headers() },
      };
      // Remove headers that would conflict with the relay
      delete options.headers["host"];
      delete options.headers["proxy-connection"];

      const response = await new Promise((resolve, reject) => {
        const backendReq = http.request(options, (backendRes) => {
          let data = "";
          backendRes.on("data", (chunk) => { data += chunk; });
          backendRes.on("end", () => {
            resolve({
              status: backendRes.statusCode,
              headers: { ...backendRes.headers },
              body: data,
            });
          });
        });
        backendReq.on("error", reject);
        const postBody = req.postData();
        if (postBody) backendReq.write(postBody);
        backendReq.end();
      });

      if (isNavigation) {
        console.error("[localhost-proxy] Navigation:", method, backendUrl.pathname, "->", response.status);
      }

      await route.fulfill({
        status: response.status,
        headers: { ...response.headers, "Access-Control-Allow-Origin": "*" },
        body: response.body,
      });
    } catch (err) {
      console.error("[localhost-proxy] Error:", err.message);
      await route.fulfill({
        status: 502,
        contentType: "text/plain",
        body: "Proxy error: " + err.message,
      });
    }
  });
}

/**
 * Set up a route proxy for Gemini API calls.
 * Intercepts fetch() requests from the browser to generativelanguage.googleapis.com
 * and relays them through Node.js https.request(), avoiding CORS issues.
 * Also fixes the double-slash bug (//chat/completions -> /chat/completions).
 */
function setupGeminiProxy(page) {
  return page.route("**/generativelanguage.googleapis.com/**", async (route) => {
    const req = route.request();
    const reqUrl = req.url();
    const method = req.method();

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-goog-api-client",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (method !== "POST") {
      return route.continue();
    }

    // Fix double-slash bug: "//chat" -> "/chat"
    const fixedUrl = reqUrl.replace("//chat", "/chat");
    const urlObj = new URL(fixedUrl);
    const postBody = req.postData();

    try {
      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postBody || ""),
            ...(route.request().headers()["authorization"] ? { "Authorization": route.request().headers()["authorization"] } : {}),
          },
        };

        const backendReq = https.request(options, (backendRes) => {
          let data = "";
          backendRes.on("data", (chunk) => { data += chunk; });
          backendRes.on("end", () => {
            resolve({
              status: backendRes.statusCode,
              headers: { ...backendRes.headers },
              body: data,
            });
          });
        });
        backendReq.on("error", reject);
        if (postBody) backendReq.write(postBody);
        backendReq.end();
      });

      console.error("[proxy] Gemini responded with status:", response.status);

      await route.fulfill({
        status: response.status,
        headers: {
          ...response.headers,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
        body: response.body,
      });
    } catch (err) {
      console.error("[proxy] Error:", err.message);
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Proxy error: " + err.message }),
      });
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length < 1) {
    console.log("Usage: node page-agent-runner.mjs --url <url> --command <cmd> [--llm demo|gemini] [--screenshot <path>] [--timeout <ms>]");
    console.log("  --llm: LLM mode - 'demo' (default, free built-in, no key) or 'gemini' (requires GEMINI_API_KEY)");
    process.exit(0);
  }
  let url = null, command = null, screenshotPath = null, timeout = 60000, llm = "demo";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url") url = args[++i];
    else if (args[i] === "--command") command = args[++i];
    else if (args[i] === "--screenshot") screenshotPath = args[++i];
    else if (args[i] === "--timeout") timeout = parseInt(args[++i]);
    else if (args[i] === "--llm") llm = args[++i];
    else if (!url) url = args[i];
    else if (!command) command = args[i];
  }
  if (!url || !command) { console.error("URL and command required"); process.exit(1); }
  if (llm !== "demo" && llm !== "gemini") { console.error("Invalid --llm value. Use 'demo' or 'gemini'."); process.exit(1); }
  if (llm === "gemini" && !process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable required for gemini mode"); process.exit(1);
  }

  console.error("[page-agent] Launching browser...");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // Set up localhost relay proxy BEFORE navigating (bypasses Chromium network restriction)
    const targetUrlObj = new URL(url);
    if (targetUrlObj.hostname === "localhost" || targetUrlObj.hostname === "127.0.0.1") {
      // Normalize to IP for consistent proxy pattern
      if (targetUrlObj.hostname === "localhost") {
        url = url.replace("localhost", "127.0.0.1");
      }
      console.error("[page-agent] Setting up localhost relay proxy...");
      await setupLocalhostProxy(page, url);
    }

    // Use "load" instead of "networkidle" because pariscore.html has live polling
    // that never lets the network idle
    await page.goto(url, { waitUntil: "load", timeout });
    console.error("[page-agent] Page loaded:", url);

    // Capture page state BEFORE any interaction that might cause navigation
    // (pariscore.html SPA can navigate when Page Agent interacts with it)
    const initialPageState = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
    })).catch(() => ({ url, title: "" }));

    if (llm === "demo") {
      // --- DEMO MODE: auto-init CDN, window.pageAgent already ready ---
      console.error("[page-agent] Injecting Page Agent CDN (auto-init mode)...");
      await page.addScriptTag({ url: CDN_AUTOINIT });
      await page.waitForFunction(() => typeof window.pageAgent?.execute === "function", { timeout: 15000 });
      // Small settle delay to let page stabilize (SPA might trigger navigation on load)
      await new Promise(r => setTimeout(r, 1500));
      console.error("[page-agent] pageAgent ready. Executing command with demo LLM...");

      let result;
      try {
        result = await page.evaluate(async (cmd) => {
          try {
            const output = await window.pageAgent.execute(cmd);
            // Extract just the data field from Page Agent response
            const parsed = typeof output === "string" ? JSON.parse(output) : output;
            const data = parsed?.data || (typeof output === "string" ? output : JSON.stringify(output));
            return { success: true, message: typeof data === "string" ? data : JSON.stringify(data) };
          } catch (err) { return { success: false, message: err.message || String(err) }; }
        }, command);
      } catch (evalErr) {
        // Execution context destroyed = Page Agent triggered a navigation on the SPA
        result = { success: false, message: "[navigation] Page navigated during Page Agent execution: " + evalErr.message };
      }

      if (screenshotPath) { try { await page.screenshot({ path: screenshotPath }); } catch {} }

      console.log(JSON.stringify({
        success: result.success,
        result: result.message,
        page: { url: initialPageState.url, title: initialPageState.title },
        meta: { llm: "demo" },
      }, null, 2));
    } else {
      // --- GEMINI MODE: manual init with Gemini API via Node.js proxy ---
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

      // Set up page.route() proxy BEFORE injecting CDN, so all Gemini API
      // calls from the browser are intercepted and relayed through Node.js
      console.error("[page-agent] Setting up Gemini API proxy (page.route)...");
      await setupGeminiProxy(page);

      console.error("[page-agent] Injecting Page Agent CDN (autoInit=false)...");
      await page.addScriptTag({ url: CDN_MANUAL });
      await page.waitForFunction(() => typeof window.PageAgent === "function", { timeout: 15000 });
      // Small settle delay to let page stabilize (SPA might trigger navigation on load)
      await new Promise(r => setTimeout(r, 1500));
      console.error("[page-agent] Page Agent constructor ready. Initializing with Gemini...");

      let result;
      try {
        result = await page.evaluate(async ({ cmd, apiKey }) => {
          try {
            const instance = new window.PageAgent({
              baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
              model: "gemini-2.5-flash",
              apiKey: apiKey,
              language: "en-US",
            });
            const output = await instance.execute(cmd);
            // Extract just the data field from Page Agent response
            const parsed = typeof output === "string" ? JSON.parse(output) : output;
            const data = parsed?.data || (typeof output === "string" ? output : JSON.stringify(output));
            return { success: true, message: typeof data === "string" ? data : JSON.stringify(data) };
          } catch (err) { return { success: false, message: err.message || String(err) }; }
        }, { cmd: command, apiKey: GEMINI_API_KEY });
      } catch (evalErr) {
        result = { success: false, message: "[navigation] Page navigated during Page Agent execution: " + evalErr.message };
      }

      if (screenshotPath) { try { await page.screenshot({ path: screenshotPath }); } catch {} }

      console.log(JSON.stringify({
        success: result.success,
        result: result.message,
        page: { url: initialPageState.url, title: initialPageState.title },
        meta: { llm: "gemini-2.5-flash", proxy: "page.route" },
      }, null, 2));
    }
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();