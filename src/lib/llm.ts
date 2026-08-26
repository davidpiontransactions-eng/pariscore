/**
 * Client LLM unifié — Gemini (cloud) ↔ inférence locale OpenAI-compatible
 * (MAX serve / Ollama, ex: Llama 3.1 GGUF) avec bascule automatique.
 *
 * Modes (env LLM_PROVIDER) :
 * - "gemini" (défaut) : Gemini uniquement. Si LLM_FALLBACK_ENABLED=true →
 *   bascule locale en cas d'erreur.
 * - "local"           : inférence locale uniquement (offline / zéro coût).
 *   Si LLM_FALLBACK_ENABLED=true → bascule Gemini en cas d'erreur.
 * - "auto"            : Gemini d'abord, bascule locale automatique en cas
 *   d'erreur (quota 429, timeout, 5xx).
 *
 * Vars d'env :
 *   LLM_PROVIDER        : gemini | local | auto (défaut gemini)
 *   LOCAL_LLM_BASE_URL  : ex http://127.0.0.1:8000/v1 (MAX serve / Ollama)
 *   LOCAL_LLM_MODEL     : ex llama-3.1-8b-instruct (défaut)
 *   LOCAL_LLM_API_KEY   : optionnel (si le serveur local exige une clé)
 *   LLM_FALLBACK_ENABLED: "true" active la bascule en mode explicite
 *   GEMINI_MODEL        : ex gemini-2.5-flash (défaut)
 *   LLM_TIMEOUT_MS      : timeout par appel (défaut 30s)
 *
 * Server-only : utilise fetch global, jamais importé côté client.
 */

export type LlmProviderMode = "gemini" | "local" | "auto";

export interface LlmGenerateOptions {
  /** Prompt utilisateur (contenu principal). */
  prompt: string;
  /** Instruction système optionnelle. */
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** true → demande un objet JSON en sortie (response_format / json). */
  json?: boolean;
  timeoutMs?: number;
  /** Override ponctuel du mode (sinon LLM_PROVIDER). */
  provider?: LlmProviderMode;
}

export interface LlmResult {
  text: string;
  /** Provider effectivement utilisé pour cette réponse. */
  provider: "gemini" | "local";
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
// Config (env)
// ---------------------------------------------------------------------------

export interface LlmConfig {
  mode: LlmProviderMode;
  fallbackEnabled: boolean;
  geminiModel: string;
  geminiConfigured: boolean;
  localBaseUrl: string;
  localModel: string;
  localConfigured: boolean;
  timeoutMs: number;
}

export function llmConfig(): LlmConfig {
  const mode = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase() as LlmProviderMode;
  const baseUrl = (process.env.LOCAL_LLM_BASE_URL ?? "http://127.0.0.1:8000/v1").replace(/\/+$/, "");
  return {
    mode: mode === "local" || mode === "auto" ? mode : "gemini",
    fallbackEnabled: String(process.env.LLM_FALLBACK_ENABLED ?? "false") === "true",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    localBaseUrl: baseUrl,
    localModel: process.env.LOCAL_LLM_MODEL ?? "llama-3.1-8b-instruct",
    localConfigured: Boolean(baseUrl),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 30_000),
  };
}

// ---------------------------------------------------------------------------
// Transport Gemini (generateContent)
// ---------------------------------------------------------------------------

async function callGemini(
  cfg: LlmConfig,
  opts: LlmGenerateOptions,
): Promise<LlmResult> {
  if (!cfg.geminiConfigured) {
    throw new LlmError("GEMINI_API_KEY non configurée", 503, "GEMINI_NOT_CONFIGURED");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent`;
  const timeoutMs = opts.timeoutMs ?? cfg.timeoutMs;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
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
    const code = res.status === 429 ? "GEMINI_RATE_LIMITED" : `GEMINI_UPSTREAM_${res.status}`;
    throw new LlmError(
      `Gemini API error ${res.status}: ${errText.slice(0, 200)}`,
      res.status,
      code,
    );
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
// Transport local (OpenAI-compatible chat/completions — MAX serve / Ollama)
// ---------------------------------------------------------------------------

async function callLocal(
  cfg: LlmConfig,
  opts: LlmGenerateOptions,
): Promise<LlmResult> {
  if (!cfg.localConfigured) {
    throw new LlmError("LOCAL_LLM_BASE_URL non configurée", 503, "LOCAL_NOT_CONFIGURED");
  }

  const url = `${cfg.localBaseUrl}/chat/completions`;
  const timeoutMs = opts.timeoutMs ?? cfg.timeoutMs;

  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: opts.prompt },
  ];

  const body: Record<string, unknown> = {
    model: cfg.localModel,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxOutputTokens ?? 1024,
    stream: false,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.LOCAL_LLM_API_KEY) {
    headers.Authorization = `Bearer ${process.env.LOCAL_LLM_API_KEY}`;
  }

  const started = Date.now();
  const doFetch = () =>
    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

  let res = await doFetch();
  // Certains serveurs OpenAI-compatibles rejettent response_format (400/422) :
  // on retente une fois sans l'option JSON.
  if ((res.status === 400 || res.status === 422) && opts.json) {
    delete body.response_format;
    res = await doFetch();
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new LlmError(
      `Local LLM error ${res.status}: ${errText.slice(0, 200)}`,
      res.status,
      `LOCAL_UPSTREAM_${res.status}`,
    );
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawText = json?.choices?.[0]?.message?.content ?? "";
  if (!rawText) {
    throw new LlmError("Le serveur local a retourné une réponse vide", 502, "LOCAL_EMPTY");
  }

  return {
    text: rawText,
    provider: "local",
    model: cfg.localModel,
    latencyMs: Date.now() - started,
  };
}

// ---------------------------------------------------------------------------
// Routage + fallback
// ---------------------------------------------------------------------------

function primaryOf(mode: LlmProviderMode, fallbackEnabled: boolean): {
  primary: "gemini" | "local";
  secondary: "gemini" | "local";
  allowFallback: boolean;
} {
  if (mode === "local") {
    return { primary: "local", secondary: "gemini", allowFallback: fallbackEnabled };
  }
  if (mode === "auto") {
    return { primary: "gemini", secondary: "local", allowFallback: true };
  }
  return { primary: "gemini", secondary: "local", allowFallback: fallbackEnabled };
}

/**
 * Génère du texte via le provider configuré, avec bascule automatique.
 * Lève LlmError si tous les providers disponibles échouent.
 */
export async function generateText(opts: LlmGenerateOptions): Promise<LlmResult> {
  const cfg = llmConfig();
  const mode = opts.provider ?? cfg.mode;
  const { primary, secondary, allowFallback } = primaryOf(mode, cfg.fallbackEnabled);

  const attempt = async (p: "gemini" | "local"): Promise<LlmResult> =>
    p === "gemini" ? callGemini(cfg, opts) : callLocal(cfg, opts);

  let firstError: LlmError | null = null;
  try {
    return await attempt(primary);
  } catch (err) {
    firstError = err instanceof LlmError ? err : new LlmError(String(err), 500, "LLM_UNKNOWN");
    if (!allowFallback) throw firstError;
  }

  try {
    return await attempt(secondary);
  } catch (err) {
    const secondError = err instanceof LlmError ? err : new LlmError(String(err), 500, "LLM_UNKNOWN");
    throw new LlmError(
      `Tous les providers LLM ont échoué (${primary}: ${firstError.message} | ${secondary}: ${secondError.message})`,
      502,
      "LLM_ALL_PROVIDERS_FAILED",
    );
  }
}

// ---------------------------------------------------------------------------
// Statut (diagnostic / ops)
// ---------------------------------------------------------------------------

export interface LlmStatus {
  mode: LlmProviderMode;
  fallbackEnabled: boolean;
  gemini: { configured: boolean; model: string };
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

/** Statut des providers : configuration + sondage du serveur local (/models). */
export async function llmStatus(): Promise<LlmStatus> {
  const cfg = llmConfig();
  const status: LlmStatus = {
    mode: cfg.mode,
    fallbackEnabled: cfg.fallbackEnabled,
    gemini: { configured: cfg.geminiConfigured, model: cfg.geminiModel },
    local: {
      configured: cfg.localConfigured,
      baseUrl: cfg.localBaseUrl,
      model: cfg.localModel,
      reachable: false,
      latencyMs: null,
      error: null,
    },
    timestamp: new Date().toISOString(),
  };

  if (cfg.localConfigured) {
    const started = Date.now();
    try {
      const res = await fetch(`${cfg.localBaseUrl}/models`, {
        signal: AbortSignal.timeout(3_000),
      });
      status.local.reachable = res.ok;
      status.local.latencyMs = Date.now() - started;
      if (!res.ok) status.local.error = `HTTP ${res.status}`;
    } catch (err) {
      status.local.error = err instanceof Error ? err.message : String(err);
    }
  }

  return status;
}