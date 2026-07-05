#!/usr/bin/env node
/**
 * Page Agent Tool for Zcode/GLM
 * Standalone CLI - Browser automation via Page Agent AI.
 * Dual-mode: demo (free built-in LLM, no API key) or gemini (Gemini API).
 *
 * Usage:
 *   node GLM/page-agent-tool.mjs <url> <command>              (demo mode, default)
 *   node GLM/page-agent-tool.mjs --url <url> --command <cmd>   (demo mode)
 *   node GLM/page-agent-tool.mjs --url <url> --command <cmd> --llm gemini
 *
 * Requires for gemini mode: GEMINI_API_KEY environment variable
 */

import { chromium } from "../.opencode/node_modules/playwright/index.mjs";

const CDN_AUTOINIT = "https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js";
const CDN_MANUAL = "https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js?autoInit=false";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { url: null, cmd: null, screenshot: null, timeout: 60000, llm: "demo" };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url") opts.url = args[++i];
    else if (args[i] === "--command" || args[i] === "--cmd") opts.cmd = args[++i];
    else if (args[i] === "--screenshot") opts.screenshot = args[++i];
    else if (args[i] === "--timeout") opts.timeout = parseInt(args[++i]) || 60000;
    else if (args[i] === "--llm") opts.llm = args[++i];
    else if (!opts.url) opts.url = args[i];
    else if (!opts.cmd) opts.cmd = args[i];
  }
  return opts;
}

function help() {
  console.log("Page Agent Tool for Zcode/GLM");
  console.log("Usage: node GLM/page-agent-tool.mjs --url <url> --command <cmd> [--llm demo|gemini]");
  console.log("       node GLM/page-agent-tool.mjs <url> <cmd> [--llm demo|gemini]");
  process.exit(0);
}

async function main() {
  const opts = parseArgs();
  if (process.argv.includes("--help") || process.argv.includes("-h") || !opts.url || !opts.cmd) help();
  if (opts.llm !== "demo" && opts.llm !== "gemini") {
    console.error("Invalid --llm value. Use 'demo' or 'gemini'.");
    process.exit(1);
  }
  if (opts.llm === "gemini" && !process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY environment variable required for gemini mode");
    process.exit(1);
  }

  console.error("[page-agent] Launching browser...");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();

  try {
    await page.goto(opts.url, { waitUntil: "networkidle", timeout: opts.timeout });
    console.error("[page-agent] Page loaded.");

    if (opts.llm === "demo") {
      console.error("[page-agent] Injecting Page Agent CDN (auto-init mode)...");
      await page.addScriptTag({ url: CDN_AUTOINIT });
      await page.waitForFunction(() => typeof window.pageAgent?.execute === "function", { timeout: 15000 });
      console.error("[page-agent] pageAgent ready. Executing command with demo LLM...");

      const result = await page.evaluate(async (cmd) => {
        try {
          const output = await window.pageAgent.execute(cmd);
          return { success: true, message: typeof output === "string" ? output : JSON.stringify(output).substring(0, 5000) };
        } catch (err) {
          return { success: false, message: err.message || String(err) };
        }
      }, opts.cmd);

      const pageState = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
      }));

      if (opts.screenshot) await page.screenshot({ path: opts.screenshot });

      console.log(JSON.stringify({
        success: result.success,
        result: result.message,
        page: { url: pageState.url, title: pageState.title },
        meta: { tool: "page-agent", version: "1.11.0", llm: "demo" },
      }));
    } else {
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      console.error("[page-agent] Injecting Page Agent CDN (autoInit=false)...");
      await page.addScriptTag({ url: CDN_MANUAL });
      await page.waitForFunction(() => typeof window.PageAgent === "function", { timeout: 15000 });
      console.error("[page-agent] Initializing Page Agent with Gemini...");

      const result = await page.evaluate(async ({ cmd, apiKey }) => {
        try {
          const instance = new window.PageAgent({
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
            model: "gemini-2.0-flash",
            apiKey: apiKey,
            language: "en-US",
          });
          const output = await instance.execute(cmd);
          return { success: true, message: typeof output === "string" ? output : JSON.stringify(output).substring(0, 5000) };
        } catch (err) {
          return { success: false, message: err.message || String(err) };
        }
      }, { cmd: opts.cmd, apiKey: GEMINI_API_KEY });

      const pageState = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
      }));

      if (opts.screenshot) await page.screenshot({ path: opts.screenshot });

      console.log(JSON.stringify({
        success: result.success,
        result: result.message,
        page: { url: pageState.url, title: pageState.title },
        meta: { tool: "page-agent", version: "1.11.0", llm: "gemini-2.0-flash" },
      }));
    }
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
