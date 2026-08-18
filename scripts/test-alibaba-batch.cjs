// Batch test chat-capability sur TOUS les modeles du workspace Alibaba
// Usage: node scripts/test-alibaba-batch.cjs [--concurrency N] [--timeout MS]
const fs = require("fs");
const path = require("path");

const KEY = process.env.BAILIAN_WS_KEY || "sk-ws-H.DMRDDEI.0TRe.MEQCIHwrUPb33uj9WRufPK_xVQQuatLMIWUL3KixMOEWANCgAiAGhK2OytkjoQ1TXdUlhs7rPqgsWe6QWSVqeBn-Z0qJ_w";
const BASE = "https://ws-qjbxkqsny26cc8sx.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";
const args = process.argv.slice(2);
const getArg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const CONCURRENCY = parseInt(getArg("--concurrency") || "8", 10);
const TIMEOUT_MS = parseInt(getArg("--timeout") || "20000", 10);

const ids = JSON.parse(fs.readFileSync(path.join(__dirname, "alibaba-model-ids.json"), "utf8"));
const SKIP_PREFIXES = ["text-embedding", "qwen3.7-text", "qwen-image", "qwen-audio", "qwen3-asr", "qwen3-tts", "qwen-mt", "tongyi", "qwen-vl-ocr", "qwen3-vl", "qwen3-omni", "z-image", "wan2.7"];

async function testOne(model) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "Reponds: OK" }] }),
      signal: ctrl.signal,
    });
    const ms = Date.now() - start;
    const text = await res.text();
    let kind = "?";
    let detail = "";
    if (res.ok) {
      try {
        const j = JSON.parse(text);
        const msg = j.choices?.[0]?.message || {};
        const hasContent = typeof msg.content === "string" && msg.content.trim().length > 0;
        const hasReasoning = typeof msg.reasoning_content === "string" && msg.reasoning_content.trim().length > 0;
        kind = hasContent ? "CHAT_OK" : hasReasoning ? "REASONING_OK" : "CHAT_EMPTY";
        detail = `content=${JSON.stringify(String(msg.content || "").slice(0, 40))}`;
      } catch { kind = "NON_JSON"; detail = text.slice(0, 80); }
    } else if (res.status === 404) {
      kind = "NOT_CHAT";
      try { const j = JSON.parse(text); detail = j.message || j.error?.message || ""; } catch { detail = text.slice(0, 80); }
    } else if (res.status === 400) {
      kind = "BAD_REQUEST";
      try { const j = JSON.parse(text); detail = (j.message || j.error?.message || "").slice(0, 100); } catch { detail = text.slice(0, 80); }
    } else {
      kind = `HTTP_${res.status}`;
      detail = text.slice(0, 80);
    }
    clearTimeout(t);
    return { model, kind, ms, detail };
  } catch (e) {
    clearTimeout(t);
    return { model, kind: "ERR", ms: Date.now() - start, detail: `${e.name}: ${e.message}` };
  }
}

(async () => {
  const candidates = ids.filter((id) => !SKIP_PREFIXES.some((p) => id.startsWith(p)));
  console.log(`Testing ${candidates.length} candidats chat (sur ${ids.length} modeles)...`);
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < candidates.length) {
      const m = candidates[idx++];
      const r = await testOne(m);
      results.push(r);
      process.stdout.write(`  ${r.kind.padEnd(14)} ${r.model} (${r.ms}ms)\n`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.sort((a, b) => (a.kind === b.kind ? a.model.localeCompare(b.model) : a.kind.localeCompare(b.kind)));
  fs.writeFileSync(path.join(__dirname, "..", "alibaba-batch-results.json"), JSON.stringify(results, null, 1));
  const summary = results.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc; }, {});
  console.log("\n=== RESUME ===");
  console.log(JSON.stringify(summary, null, 1));
  const ok = results.filter((r) => r.kind === "CHAT_OK" || r.kind === "REASONING_OK");
  console.log("\n=== MODELES CHAT OPERATIONNELS ===");
  console.log(ok.map((r) => r.model).join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });