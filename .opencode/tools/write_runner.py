import os, sys

content = r"""/**
 * Page Agent Runner - Browser automation via Page Agent AI
 * Usage: node page-agent-runner.mjs --url <url> --command <command>
 */

import { chromium } from "playwright";

const PAGE_AGENT_CDN = "https://cdn.jsdelivr.net/npm/page-agent@1.11.0/dist/iife/page-agent.demo.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h") || args.length < 1) {
    console.log("Usage: node page-agent-runner.mjs --url <url> --command <cmd> [--screenshot <path>] [--timeout <ms>]");
    process.exit(0);
  }
  let url = null, command = null, screenshotPath = null, timeout = 30000;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url") url = args[++i];
    else if (args[i] === "--command") command = args[++i];
    else if (args[i] === "--screenshot") screenshotPath = args[++i];
    else if (args[i] === "--timeout") timeout = parseInt(args[++i]);
    else if (!url) url = args[i];
    else if (!command) command = args[i];
  }
  if (!url || !command) { console.error("URL and command required"); process.exit(1); }

  console.error("[page-agent] Launching browser...");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout });
    console.error("[page-agent] Page loaded, injecting Page Agent...");
    await page.addScriptTag({ url: PAGE_AGENT_CDN });
    await page.waitForFunction(() => {
      return typeof window.PageAgentDemo !== "undefined" || typeof window.PageAgent !== "undefined";
    }, { timeout: 15000 });

    console.error("[page-agent] Page Agent loaded, executing command...");
    const result = await page.evaluate(async (cmd) => {
      try {
        const agent = window.PageAgentDemo || window.PageAgent;
        if (agent && typeof agent.execute === "function") {
          const output = await agent.execute(cmd);
          return { success: true, message: typeof output === "string" ? output : JSON.stringify(output) };
        }
        if (window.PageAgent) {
          const inst = new window.PageAgent({ language: "en-US" });
          const output = await inst.execute(cmd);
          return { success: true, message: typeof output === "string" ? output : JSON.stringify(output) };
        }
        return { success: false, message: "PageAgent not available on window" };
      } catch (err) { return { success: false, message: err.message || String(err) }; }
    }, command);

    const pageState = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      bodyLength: document.body ? document.body.innerText.length : 0,
    }));

    if (screenshotPath) { await page.screenshot({ path: screenshotPath }); }

    console.log(JSON.stringify({
      success: result.success,
      result: result.message,
      page: { url: pageState.url, title: pageState.title },
    }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
"""

path = os.path.join(r"C:\Users\david\Documents\dev PariScore\ParisScorebis\.opencode\tools", "page-agent-runner.mjs")
with open(path, "w", encoding="utf8") as f:
    f.write(content)
print(f"OK {os.path.getsize(path)} bytes")
