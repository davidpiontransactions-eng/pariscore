/**
 * Client LLM unifié — 6 providers avec bascule automatique :
 * - Gemini (Google AI Studio) — defaut
 * - OrcaRouter — multi-provider, free tiers DeepSeek V4
 * - OpenRouter — 28+ free models, auto-router
 * - NVIDIA NIM — 46+ free models
 * - Groq — ultra-rapide LPU
 * - Local (Ollama / MAX serve)
 *
 * Modes (env LLM_PROVIDER) :
 *   gemini / local / orcarouter / openrouter / nvidia / groq / auto
 *
 * Vars d'env :
 *   LLM_PROVIDER, GEMINI_MODEL, GEMINI_API_KEY,
 *   ORCA_API_KEY, ORCA_MODEL_FREE, ORCA_MODEL, ORCA_TIMEOUT_MS,
 *   OPENROUTER_API_KEY, OPENROUTER_MODEL_FREE, OPENROUTER_MODEL, OPENROUTER_TIMEOUT_MS,
 *   NIM_API_KEY, NIM_MODEL_FREE, NIM_MODEL, NIM_TIMEOUT_MS,
 *   GROQ_API_KEY, GROQ_MODEL, GROQ_TIMEOUT_MS,
 *   LOCAL_LLM_BASE_URL, LOCAL_LLM_MODEL, LOCAL_LLM_API_KEY,
 *   LLM_FALLBACK_ENABLED, LLM_TIMEOUT_MS
 *
 * Server-only : utilise fetch global, jamais importé côté client.
 */

export type LlmProviderMode =
  | "gemini"
  | "local"
  | "orcarouter"
  | "orcarouter+gemini"
  | "openrouter"
  | "nvidia"
  | "groq"
  | "auto";

export interface LlmGenerateOptions {
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
  timeoutMs?: number;
  provider?: LlmProviderMode;
}

export interface LlmResult {
  text: string;
  provider: "gemini" | "local" | "orcarouter" | "openrouter" | "nvidia" | "groq";
  model: string;
  latencyMs: number;
}

export class LlmError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "LlmError";
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Config (env) — boolean flags only, API keys read at call time
// ---------------------------------------------------------------------------

export interface LlmConfig {
  mode: LlmProviderMode;
  fallbackEnabled: boolean;
  geminiModel: string;
  geminiConfigured: boolean;
  localBaseUrl: string;
  localModel: string;
  localConfigured: boolean;
  orcaModelFree: string;
  orcaModel: string;
  orcaConfigured: boolean;
  orcaTimeoutMs: number;
  openrouterModelFree: string;
  openrouterModel: string;
  openrouterConfigured: boolean;
  openrouterTimeoutMs: number;
  nimModelFree: string;
  nimModel: string;
  nimConfigured: boolean;
  nimTimeoutMs: number;
  groqModel: string;
  groqConfigured: boolean;
  groqTimeoutMs: number;
  timeoutMs: number;
}

const VALID_MODES: LlmProviderMode[] = [
  "local", "auto", "orcarouter", "orcarouter+gemini",
  "openrouter", "nvidia", "groq", "gemini",
];

export function llmConfig(): LlmConfig {
  const mode = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase() as LlmProviderMode;
  const baseUrl = (process.env.LOCAL_LLM_BASE_URL ?? "http://127.0.0.1:8000/v1").replace(/\/+$/, "");
  return {
    mode: VALID_MODES.includes(mode) ? mode : "gemini",
    fallbackEnabled: String(process.env.LLM_FALLBACK_ENABLED ?? "false") === "true",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    localBaseUrl: baseUrl,
    localModel: process.env.LOCAL_LLM_MODEL ?? "llama-3.1-8b-instruct",
    localConfigured: Boolean(baseUrl),
    orcaModelFree: process.env.ORCA_MODEL_FREE ?? "orcarouter/free",
    orcaModel: process.env.ORCA_MODEL ?? "orcarouter/auto",
    orcaConfigured: Boolean(process.env.ORCA_API_KEY),
    orcaTimeoutMs: Number(process.env.ORCA_TIMEOUT_MS ?? 30_000),
    openrouterModelFree: process.env.OPENROUTER_MODEL_FREE ?? "openrouter/free",
    openrouterModel: process.env.OPENROUTER_MODEL ?? "openrouter/auto",
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    openrouterTimeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 30_000),
    nimModelFree: process.env.NIM_MODEL_FREE ?? "deepseek-ai/deepseek-v4-flash-0731",
    nimModel: process.env.NIM_MODEL ?? "moonshotai/kimi-k3",
    nimConfigured: Boolean(process.env.NIM_API_KEY),
    nimTimeoutMs: Number(process.env.NIM_TIMEOUT_MS ?? 30_000),
    groqModel: process.env.GROQ_MODEL ?? "qwen/qwen3.8-27b",
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    groqTimeoutMs: Number(process.env.GROQ_TIMEOUT_MS ?? 15_000),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 30_000),
  };
}

// ---------------------------------------------------------------------------
// Helper OpenAI-compatible (DRY — 6 providers partagent ce pattern)
// ---------------------------------------------------------------------------

interface OpenAICompatibleOpts {
  url: string;
  apiKey: string;
  model: string;
  provider: LlmResult["provider"];
  timeoutMs: number;
  opts: LlmGenerateOptions;
  /** Headers supplémentaires (ex: OpenRouter HTTP-Referer). */
  extraHeaders?: Record<string, string>;
  /** Gérer le 429 avec Retry-After (OrcaRouter, OpenRouter). */
  retry429?: boolean;
}

/** Helper générique pour les transports OpenAI-compatible chat/completions. */
async function callOpenAICompatible(cfg: OpenAICompatibleOpts): Promise<LlmResult> {
  const messages = [
    ...(cfg.opts.system ? [{ role: "system", content: cfg.opts.system }] : []),
    { role: "user", content: cfg.opts.prompt },
  ];

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: cfg.opts.temperature ?? 0.4,
    max_tokens: cfg.opts.maxOutputTokens ?? 1024,
    stream: false,
  };
  if (cfg.opts.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
    ...cfg.extraHeaders,
  };

  const started = Date.now();
  const doFetch = () =>
    fetch(cfg.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });

  let res = await doFetch();

  // Retry 429 free tier (respect Retry-After, 1 essai)
  if (cfg.retry429 && res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0 && seconds <= 3600) {
        await new Promise((r) => setTimeout(r, seconds * 1000));
        res = await doFetch();
      }
    }
  }

  // Fallback : certains serveurs rejettent response_format (400/422)
  if ((res.status === 400 || res.status === 422) && cfg.opts.json) {
    delete body.response_format;
    res = await doFetch();
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    // Log serveur : détail complet pour debug
    console.error(`[llm] ${cfg.provider} upstream ${res.status}:`, errText.slice(0, 200));
    // Message générique côté client (pas de fuite d'info upstream)
    const code = res.status === 429
      ? `${cfg.provider.toUpperCase()}_RATE_LIMITED`
      : `${cfg.provider.toUpperCase()}_UPSTREAM_${res.status}`;
    throw new LlmError(
      `Erreur ${cfg.provider} (${res.status})`,
      res.status,
      code,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawText = json?.choices?.[0]?.message?.content ?? "";
  if (!rawText) {
    throw new LlmError(`${cfg.provider} a retourné une réponse vide`, 502, `${cfg.provider.toUpperCase()}_EMPTY`);
  }

  return {
    text: rawText,
    provider: cfg.provider,
    model: cfg.model,
    latencyMs: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// Transport Gemini (generateContent — pas OpenAI-compatible)
// ---------------------------------------------------------------------------

async function callGemini(
  cfg: LlmConfig,
  opts: LlmGenerateOptions,
): Promise<LlmResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmError("GEMINI_API_KEY non configurée", 503, "GEMINI_NOT_CONFIGURED");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent`;
  const timeoutMs = opts.timeoutMs ?? cfg.timeoutMs;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt }] }],
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    console.error(`[llm] gemini upstream ${res.status}:`, errText.slice(0, 200));
    const code = res.status === 429 ? "GEMINI_RATE_LIMITED" : `GEMINI_UPSTREAM_${res.status}`;
    throw new LlmError(`Erreur gemini (${res.status})`, res.status, code);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) {
    throw new LlmError("Gemini a retourné une réponse vide", 502, "GEMINI_EMPTY");
  }

  return { text: rawText, provider: "gemini", model: cfg.geminiModel, latencyMs: 0 };
}

// ---------------------------------------------------------------------------
// Transports OpenAI-compatible (6 wrappers fins autour du helper)
// ---------------------------------------------------------------------------

async function callLocal(cfg: LlmConfig, opts: LlmGenerateOptions): Promise<LlmResult> {
  if (!cfg.localConfigured) throw new LlmError("LOCAL_LLM_BASE_URL non configurée", 503, "LOCAL_NOT_CONFIGURED");
  return callOpenAICompatible({
    url: `${cfg.localBaseUrl}/chat/completions`,
    apiKey: process.env.LOCAL_LLM_API_KEY ?? "",
    model: cfg.localModel,
    provider: "local",
    timeoutMs: opts.timeoutMs ?? cfg.timeoutMs,
    opts,
  });
}

async function callOrcaRouter(cfg: LlmConfig, opts: LlmGenerateOptions, useFree = false): Promise<LlmResult> {
  const key = process.env.ORCA_API_KEY;
  if (!key) throw new LlmError("ORCA_API_KEY non configurée", 503, "ORCA_NOT_CONFIGURED");
  return callOpenAICompatible({
    url: "https://api.orcarouter.ai/v1/chat/completions",
    apiKey: key,
    model: useFree ? cfg.orcaModelFree : cfg.orcaModel,
    provider: "orcarouter",
    timeoutMs: opts.timeoutMs ?? cfg.orcaTimeoutMs,
    opts,
    retry429: true,
  });
}

async function callOpenRouter(cfg: LlmConfig, opts: LlmGenerateOptions, useFree = false): Promise<LlmResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new LlmError("OPENROUTER_API_KEY non configurée", 503, "OPENROUTER_NOT_CONFIGURED");
  return callOpenAICompatible({
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: key,
    model: useFree ? cfg.openrouterModelFree : cfg.openrouterModel,
    provider: "openrouter",
    timeoutMs: opts.timeoutMs ?? cfg.openrouterTimeoutMs,
    opts,
    extraHeaders: { "HTTP-Referer": "https://pariscore.fr", "X-Title": "PariScore" },
    retry429: true,
  });
}

async function callNvidiaNIM(cfg: LlmConfig, opts: LlmGenerateOptions, useFree = false): Promise<LlmResult> {
  const key = process.env.NIM_API_KEY;
  if (!key) throw new LlmError("NIM_API_KEY non configurée", 503, "NIM_NOT_CONFIGURED");
  return callOpenAICompatible({
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    apiKey: key,
    model: useFree ? cfg.nimModelFree : cfg.nimModel,
    provider: "nvidia",
    timeoutMs: opts.timeoutMs ?? cfg.nimTimeoutMs,
    opts,
    retry429: true,
  });
}

async function callGroq(cfg: LlmConfig, opts: LlmGenerateOptions): Promise<LlmResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new LlmError("GROQ_API_KEY non configurée", 503, "GROQ_NOT_CONFIGURED");
  return callOpenAICompatible({
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: key,
    model: cfg.groqModel,
    provider: "groq",
    timeoutMs: opts.timeoutMs ?? cfg.groqTimeoutMs,
    opts,
    retry429: true,
  });
}

// ---------------------------------------------------------------------------
// Routage + fallback
// ---------------------------------------------------------------------------

type ProviderTarget = "gemini" | "local" | "orcarouter" | "openrouter" | "nvidia" | "groq";

function primaryOf(mode: LlmProviderMode, fallbackEnabled: boolean): {
  primary: ProviderTarget;
  secondary: ProviderTarget;
  tertiary: ProviderTarget | null;
  allowFallback: boolean;
} {
  if (mode === "local") return { primary: "local", secondary: "gemini", tertiary: null, allowFallback: fallbackEnabled };
  if (mode === "orcarouter") return { primary: "orcarouter", secondary: "openrouter", tertiary: "gemini", allowFallback: fallbackEnabled };
  if (mode === "orcarouter+gemini") return { primary: "orcarouter", secondary: "gemini", tertiary: null, allowFallback: true };
  if (mode === "openrouter") return { primary: "openrouter", secondary: "orcarouter", tertiary: "gemini", allowFallback: fallbackEnabled };
  if (mode === "nvidia") return { primary: "nvidia", secondary: "openrouter", tertiary: "gemini", allowFallback: fallbackEnabled };
  if (mode === "groq") return { primary: "groq", secondary: "openrouter", tertiary: "gemini", allowFallback: fallbackEnabled };
  if (mode === "auto") return { primary: "gemini", secondary: "openrouter", tertiary: "local", allowFallback: true };
  return { primary: "gemini", secondary: "openrouter", tertiary: "local", allowFallback: fallbackEnabled };
}

export async function generateText(opts: LlmGenerateOptions): Promise<LlmResult> {
  const cfg = llmConfig();
  const mode = opts.provider ?? cfg.mode;
  const { primary, secondary, tertiary, allowFallback } = primaryOf(mode, cfg.fallbackEnabled);

  const attempt = async (p: ProviderTarget): Promise<LlmResult> => {
    if (p === "gemini") return callGemini(cfg, opts);
    if (p === "orcarouter") return callOrcaRouter(cfg, opts, true);
    if (p === "openrouter") return callOpenRouter(cfg, opts, true);
    if (p === "nvidia") return callNvidiaNIM(cfg, opts, true);
    if (p === "groq") return callGroq(cfg, opts);
    return callLocal(cfg, opts);
  };

  const errors: LlmError[] = [];

  try {
    return await attempt(primary);
  } catch (err) {
    const e = err instanceof LlmError ? err : new LlmError(String(err), 500, "LLM_UNKNOWN");
    errors.push(e);
    if (!allowFallback) throw e;
  }

  try {
    return await attempt(secondary);
  } catch (err) {
    const e = err instanceof LlmError ? err : new LlmError(String(err), 500, "LLM_UNKNOWN");
    errors.push(e);
    if (!tertiary) {
      throw new LlmError(
        `Tous les providers LLM ont échoué (${primary}: ${errors[0].message} | ${secondary}: ${e.message})`,
        502, "LLM_ALL_PROVIDERS_FAILED",
      );
    }
  }

  try {
    return await attempt(tertiary);
  } catch (err) {
    const e = err instanceof LlmError ? err : new LlmError(String(err), 500, "LLM_UNKNOWN");
    errors.push(e);
    throw new LlmError(
      `Tous les providers LLM ont échoué (${errors.map((x, i) => `${[primary, secondary, tertiary!][i]}: ${x.message}`).join(" | ")})`,
      502, "LLM_ALL_PROVIDERS_FAILED",
    );
  }
}

// ---------------------------------------------------------------------------
// Statut (diagnostic / ops) — 6 providers sondés concurrentiellement
// ---------------------------------------------------------------------------

export interface LlmStatus {
  mode: LlmProviderMode;
  fallbackEnabled: boolean;
  gemini: {
    configured: boolean;
    model: string;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  orca: {
    configured: boolean;
    modelFree: string;
    modelPaid: string;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  openrouter: {
    configured: boolean;
    modelFree: string;
    modelPaid: string;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  nvidia: {
    configured: boolean;
    modelFree: string;
    modelPaid: string;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  groq: {
    configured: boolean;
    model: string;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  local: {
    configured: boolean;
    baseUrl: string;
    model: string;
    reachable: boolean;
    latencyMs: number | null;
    error: string | null;
  };
  timestamp: string;
}

/** Statut des providers : configuration + sondage concurrent de chaque endpoint. */
export async function llmStatus(): Promise<LlmStatus> {
  const cfg = llmConfig();
  const status: LlmStatus = {
    mode: cfg.mode,
    fallbackEnabled: cfg.fallbackEnabled,
    gemini: { configured: cfg.geminiConfigured, model: cfg.geminiModel, reachable: false, latencyMs: null, error: null },
    orca: { configured: cfg.orcaConfigured, modelFree: cfg.orcaModelFree, modelPaid: cfg.orcaModel, reachable: false, latencyMs: null, error: null },
    openrouter: { configured: cfg.openrouterConfigured, modelFree: cfg.openrouterModelFree, modelPaid: cfg.openrouterModel, reachable: false, latencyMs: null, error: null },
    nvidia: { configured: cfg.nimConfigured, modelFree: cfg.nimModelFree, modelPaid: cfg.nimModel, reachable: false, latencyMs: null, error: null },
    groq: { configured: cfg.groqConfigured, model: cfg.groqModel, reachable: false, latencyMs: null, error: null },
    local: { configured: cfg.localConfigured, baseUrl: cfg.localBaseUrl, model: cfg.localModel, reachable: false, latencyMs: null, error: null },
    timestamp: new Date().toISOString(),
  };

  const probe = async (
    url: string,
    headers: Record<string, string>,
    timeout: number,
  ): Promise<{ reachable: boolean; latencyMs: number; error: string | null }> => {
    const started = Date.now();
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
      return { reachable: res.ok, latencyMs: Date.now() - started, error: res.ok ? null : `HTTP ${res.status}` };
    } catch (err) {
      return { reachable: false, latencyMs: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const geminiKey = process.env.GEMINI_API_KEY ?? "";
  const orcaKey = process.env.ORCA_API_KEY ?? "";
  const openrouterKey = process.env.OPENROUTER_API_KEY ?? "";
  const nimKey = process.env.NIM_API_KEY ?? "";
  const groqKey = process.env.GROQ_API_KEY ?? "";

  const probes = await Promise.allSettled([
    cfg.geminiConfigured
      ? probe(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, {}, 5_000)
      : Promise.resolve({ reachable: false, latencyMs: 0, error: null }),
    cfg.orcaConfigured
      ? probe("https://api.orcarouter.ai/v1/models", { Authorization: `Bearer ${orcaKey}` }, 5_000)
      : Promise.resolve({ reachable: false, latencyMs: 0, error: null }),
    cfg.openrouterConfigured
      ? probe("https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${openrouterKey}` }, 5_000)
      : Promise.resolve({ reachable: false, latencyMs: 0, error: null }),
    cfg.nimConfigured
      ? probe("https://integrate.api.nvidia.com/v1/models", { Authorization: `Bearer ${nimKey}` }, 5_000)
      : Promise.resolve({ reachable: false, latencyMs: 0, error: null }),
    cfg.groqConfigured
      ? probe("https://api.groq.com/openai/v1/models", { Authorization: `Bearer ${groqKey}` }, 5_000)
      : Promise.resolve({ reachable: false, latencyMs: 0, error: null }),
    cfg.localConfigured
      ? probe(`${cfg.localBaseUrl}/models`, {}, 3_000)
      : Promise.resolve({ reachable: false, latencyMs: 0, error: null }),
  ]);

  const ok = (p: PromiseSettledResult<{ reachable: boolean; latencyMs: number; error: string | null }>) =>
    p.status === "fulfilled" ? p.value : { reachable: false, latencyMs: 0, error: "probe failed" };

  const [geminiProbe, orcaProbe, openrouterProbe, nimProbe, groqProbe, localProbe] = probes.map(ok);

  status.gemini.reachable = geminiProbe.reachable;
  status.gemini.latencyMs = geminiProbe.latencyMs;
  status.gemini.error = geminiProbe.error;
  status.orca.reachable = orcaProbe.reachable;
  status.orca.latencyMs = orcaProbe.latencyMs;
  status.orca.error = orcaProbe.error;
  status.openrouter.reachable = openrouterProbe.reachable;
  status.openrouter.latencyMs = openrouterProbe.latencyMs;
  status.openrouter.error = openrouterProbe.error;
  status.nvidia.reachable = nimProbe.reachable;
  status.nvidia.latencyMs = nimProbe.latencyMs;
  status.nvidia.error = nimProbe.error;
  status.groq.reachable = groqProbe.reachable;
  status.groq.latencyMs = groqProbe.latencyMs;
  status.groq.error = groqProbe.error;
  status.local.reachable = localProbe.reachable;
  status.local.latencyMs = localProbe.latencyMs;
  status.local.error = localProbe.error;

  return status;
}
