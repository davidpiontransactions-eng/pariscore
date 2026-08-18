// Test de connectivite + inference sur tous les modeles Alibaba (Model Studio / DashScope Intl)
// Usage: node scripts/test-alibaba-models.cjs [--key KEY] [--timeout MS]
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const TIMEOUT_MS = parseInt(getArg("--timeout") || "30000", 10);
const prompt = "Reponds uniquement par le mot OK.";
const maxTokens = 16;

function loadKeys() {
  const keys = [];
  const candidates = [
    path.join(__dirname, "..", ".env"),
    path.join(process.env.USERPROFILE || "", ".config", "opencode", ".env"),
  ];
  for (const p of candidates) {
    try {
      const txt = fs.readFileSync(p, "utf8");
      const m = txt.match(/^BAILIAN_API_KEY=(.+)$/m);
      if (m) keys.push({ file: p, key: m[1].trim() });
    } catch {}
  }
  return keys;
}

const endpoints = {
  "workspace-ap-southeast-1": {
    base: "https://ws-qjbxkqsny26cc8sx.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
    format: "openai",
    models: ["qwen3.8-max", "qwen3.7-max", "qwen3.7-plus", "qwen3.6-flash", "glm-5.2", "deepseek-v4-pro", "deepseek-v4-pro-0813", "deepseek-v4-flash-0731", "qwen3-max", "qwen-max"],
  },
};

async function testModel(epName, ep, model, key) {
  const url =
    ep.format === "anthropic" ? `${ep.base}/messages` : `${ep.base}/chat/completions`;
  const headers = { "content-type": "application/json" };
  let body;
  if (ep.format === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    body = JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] });
  } else {
    headers.authorization = `Bearer ${key}`;
    body = JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] });
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
    const ms = Date.now() - start;
    const text = await res.text();
    let ok = false;
    let detail = "";
    if (res.ok) {
      try {
        const j = JSON.parse(text);
        const content = j.content ? j.content.map((c) => c.text || "").join("") : j.choices?.[0]?.message?.content || "";
        ok = true;
        detail = `content=${JSON.stringify(content.slice(0, 60))}`;
      } catch (e) {
        detail = `reponse non-JSON: ${text.slice(0, 120)}`;
      }
    } else {
      detail = `HTTP ${res.status}: ${text.slice(0, 160)}`;
    }
    clearTimeout(t);
    return { ok, ms, detail };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, ms: Date.now() - start, detail: `ERR ${e.name}: ${e.message}` };
  }
}

(async () => {
  const keys = loadKeys();
  const overrideKey = getArg("--key");
  const activeKeys = overrideKey ? [{ file: "--key", key: overrideKey }] : keys;
  if (!activeKeys.length) {
    console.error("AUCUNE cle BAILIAN_API_KEY trouvee (.env projet ou ~/.config/opencode/.env)");
    process.exit(2);
  }
  console.log(`== Test des modeles Alibaba — ${new Date().toISOString()} ==\n`);
  const results = [];
  for (const k of activeKeys) {
    console.log(`## Cle: ${k.file}\n`);
    for (const [epName, ep] of Object.entries(endpoints)) {
      console.log(`### Endpoint ${epName} (${ep.base})`);
      for (const model of ep.models) {
        const r = await testModel(epName, ep, model, k.key);
        const status = r.ok ? "PASS" : "FAIL";
        console.log(`  [${status}] ${model} — ${r.ms}ms — ${r.detail}`);
        results.push({ endpoint: epName, model, keyFile: k.file, ...r });
      }
      console.log("");
    }
  }
  const summary = { results };
  fs.writeFileSync(path.join(__dirname, "..", "alibaba-models-test.json"), JSON.stringify(summary, null, 2));
  console.log(`\nResultats sauves dans alibaba-models-test.json (${results.length} tests)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});