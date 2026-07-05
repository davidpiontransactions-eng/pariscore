// Version: 1.2.0
// Page Agent - Browser automation via GUI AI agent (Alibaba, MIT).
// Injects page-agent.demo.js CDN via Playwright.
// Dual-mode: demo (free built-in qwen3.5-plus, no API key) or gemini (Gemini API).
// Requires for gemini mode: GEMINI_API_KEY environment variable.

import { tool } from "@opencode-ai/plugin"
import path from "path"

const runner = path.join(import.meta.dir, "page-agent-runner.mjs")

async function runPageAgent(url: string, command: string, llm?: string, timeout?: number): Promise<string> {
  const args = [runner, "--url", url, "--command", command]
  if (llm) args.push("--llm", llm)
  if (timeout) args.push("--timeout", String(timeout))
  const proc = await Bun.$`node ${args}`.nothrow()
  const out = proc.stdout.toString().trim()
  const err = proc.stderr.toString().trim()
  if (out) return out
  return JSON.stringify({ success: false, error: err || "no output" })
}

export const execute = tool({
  description: "Navigate to a URL, inject the Page Agent AI, and execute a natural-language command (click, scroll, extract, type, etc.). Default mode uses the free built-in demo LLM (qwen3.5-plus, no API key). Use llm='gemini' for Gemini 2.5 Flash (requires GEMINI_API_KEY). Returns structured JSON with success, result message, and page state.",
  args: {
    url: tool.schema.string().describe("Target URL to open (e.g. https://example.com)"),
    command: tool.schema.string().describe("Natural-language command for Page Agent (e.g. 'what matches are visible', 'click the Football tab')"),
    llm: tool.schema.string().optional().describe("LLM mode: 'demo' (default, free, no key) or 'gemini' (requires GEMINI_API_KEY)"),
    timeout: tool.schema.number().optional().describe("Navigation timeout in ms (default: 60000)"),
  },
  async execute(args) {
    try {
      const raw = await runPageAgent(args.url, args.command, args.llm, args.timeout)
      const parsed = JSON.parse(raw)
      return JSON.stringify(parsed, null, 2)
    } catch (error: any) {
      return error.stderr || error.stdout || error.message
    }
  },
})

export const getPageState = tool({
  description: "Navigate to a URL and return the current page state (URL, title, body length) using Page Agent. Default mode uses free demo LLM. Use llm='gemini' for Gemini (requires GEMINI_API_KEY).",
  args: {
    url: tool.schema.string().describe("Target URL to inspect"),
    llm: tool.schema.string().optional().describe("LLM mode: 'demo' (default) or 'gemini'"),
    timeout: tool.schema.number().optional().describe("Navigation timeout in ms (default: 60000)"),
  },
  async execute(args) {
    try {
      const raw = await runPageAgent(args.url, "describe the current page state briefly", args.llm, args.timeout)
      const parsed = JSON.parse(raw)
      return JSON.stringify(parsed, null, 2)
    } catch (error: any) {
      return error.stderr || error.stdout || error.message
    }
  },
})
