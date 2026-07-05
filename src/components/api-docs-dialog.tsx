"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Check, Code, Copy, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Singleton open-state for the API docs dialog.
 *
 * Mirrors the pattern used by `PrivacyDialog` / `AboutDialog`: a module-level
 * `openFn` reference is registered when the dialog mounts, so any component
 * can call `openApiDocsDialog()` from an event handler without prop-drilling.
 *
 * The setter is only invoked from external event handlers (never from an
 * effect body), so the `react-hooks/set-state-in-effect` rule is respected.
 * The effect below only writes to the module-scoped `openFn` ref and cleans
 * it up on unmount.
 */
let openFn: ((open: boolean) => void) | null = null;
export function openApiDocsDialog() {
  openFn?.(true);
}

// ---------------------------------------------------------------------------
// Minimal OpenAPI 3.1 type subset — only what we need to render the dialog.
// Kept loose (`unknown` for the JSON-Schema parts we don't introspect) to
// avoid pulling in `openapi-types` as a dependency.
// ---------------------------------------------------------------------------

type OpenApiExample = { value: unknown; summary?: string };

type OpenApiMediaType = {
  schema?: { $ref?: string };
  examples?: Record<string, OpenApiExample>;
};

type OpenApiParameter = {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: { type?: string | string[]; example?: unknown };
  example?: unknown;
};

type OpenApiOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, OpenApiMediaType>;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, OpenApiMediaType>;
    }
  >;
};

type OpenApiPathItem = {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
};

type OpenApiSpec = {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, OpenApiPathItem>;
};

// Tag display order + locale labels
const TAG_ORDER = ["tennis", "push", "email"] as const;
const TAG_LABEL: Record<string, { fr: string; en: string }> = {
  tennis: { fr: "Tennis", en: "Tennis" },
  push: { fr: "Notifications Push", en: "Push notifications" },
  email: { fr: "Alertes Email", en: "Email alerts" },
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------

export function ApiDocsDialog() {
  const t = useTranslations("apiDocs");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Register the open function for external callers.
  useEffect(() => {
    openFn = setOpen;
    return () => {
      openFn = null;
    };
  }, []);

  // Fetch the spec once, the first time the dialog opens.
  // The first setState is deferred to a microtask so we don't trip the
  // `react-hooks/set-state-in-effect` rule (synchronous setState in effect
  // bodies causes cascading renders). All subsequent setStates run inside
  // promise callbacks, which are already asynchronous.
  useEffect(() => {
    if (!open || spec) return;
    let cancelled = false;
    void (async () => {
      // Defer to a microtask so setState is not called synchronously
      // inside the effect body.
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const r = await fetch("/openapi.json");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as OpenApiSpec;
        if (cancelled) return;
        setSpec(j);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, spec]);

  // Group endpoints by their first tag.
  const grouped = useMemo(() => {
    if (!spec) {
      return [] as Array<{
        tag: string;
        endpoints: Array<{ method: string; path: string; op: OpenApiOperation }>;
      }>;
    }
    const map = new Map<
      string,
      Array<{ method: string; path: string; op: OpenApiOperation }>
    >();
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const op = item[method];
        if (!op) continue;
        const tag = op.tags?.[0] ?? "other";
        if (!map.has(tag)) map.set(tag, []);
        map.get(tag)!.push({ method, path, op });
      }
    }
    const ordered: Array<{ tag: string; endpoints: Array<{ method: string; path: string; op: OpenApiOperation }> }> = [];
    for (const tag of TAG_ORDER) {
      if (map.has(tag)) ordered.push({ tag, endpoints: map.get(tag)! });
    }
    for (const tag of [...map.keys()].filter((t) => !(TAG_ORDER as readonly string[]).includes(t))) {
      ordered.push({ tag, endpoints: map.get(tag)! });
    }
    return ordered;
  }, [spec]);

  const baseUrl = spec?.servers?.[0]?.url ?? "https://setpoint.example";
  const endpointCount = spec ? Object.keys(spec.paths).length : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Code className="h-4 w-4 text-emerald-600" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("subtitle")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-160px)]">
          <div className="space-y-5 px-5 py-4">
            {/* Spec meta + download */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="min-w-0 text-xs">
                <p className="truncate font-semibold text-foreground">
                  {spec?.info.title ?? "OpenAPI"}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  OpenAPI {spec?.openapi ?? "3.1.0"} · {endpointCount}{" "}
                  {t("endpoints").toLowerCase()}
                </p>
              </div>
              <a
                href="/openapi.json"
                download="openapi.json"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  {t("downloadSpec")}
                </Button>
              </a>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}

            {spec &&
              grouped.map(({ tag, endpoints }) => (
                <section key={tag}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {TAG_LABEL[tag]?.[locale] ?? tag}
                  </h3>
                  <div className="space-y-3">
                    {endpoints.map(({ method, path, op }) => (
                      <EndpointCard
                        key={`${method}-${path}`}
                        method={method}
                        path={path}
                        op={op}
                        baseUrl={baseUrl}
                        t={t}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Single endpoint card
// ---------------------------------------------------------------------------

type EndpointCardProps = {
  method: string;
  path: string;
  op: OpenApiOperation;
  baseUrl: string;
  t: (key: string) => string;
};

function EndpointCard({ method, path, op, baseUrl, t }: EndpointCardProps) {
  const methodUpper = method.toUpperCase();
  const methodColor =
    method === "get"
      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
      : method === "post"
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        : "bg-muted text-muted-foreground";

  const curl = buildCurl(method, path, op, baseUrl);

  // First successful (2xx) response — 200 or 201.
  const okResp = op.responses?.["200"] ?? op.responses?.["201"];
  const okStatus = op.responses?.["200"] ? "200" : op.responses?.["201"] ? "201" : "200";
  const exampleValue =
    okResp?.content?.["application/json"]?.examples?.default?.value;
  const exampleStr = exampleValue
    ? JSON.stringify(exampleValue, null, 2)
    : null;

  const reqBodyExample =
    op.requestBody?.content?.["application/json"]?.examples?.default?.value;
  const reqBodyStr = reqBodyExample
    ? JSON.stringify(reqBodyExample, null, 2)
    : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      {/* Method + path header */}
      <div className="flex items-start gap-2 border-b border-border/40 bg-muted/20 px-3 py-2.5">
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
            methodColor,
          )}
        >
          {methodUpper}
        </span>
        <code className="flex-1 break-all font-mono text-xs">{path}</code>
      </div>

      <div className="space-y-3 px-3 py-2.5">
        {/* Summary + description */}
        <div>
          {op.summary && <p className="text-xs font-semibold">{op.summary}</p>}
          {op.description && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {op.description}
            </p>
          )}
        </div>

        {/* Parameters table */}
        {op.parameters && op.parameters.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("parameters")}
            </p>
            <div className="overflow-hidden rounded border border-border/40">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Name</th>
                    <th className="px-2 py-1 text-left font-medium">In</th>
                    <th className="px-2 py-1 text-left font-medium">Type</th>
                    <th className="px-2 py-1 text-left font-medium">Req.</th>
                  </tr>
                </thead>
                <tbody>
                  {op.parameters.map((p) => (
                    <tr key={p.name} className="border-t border-border/40">
                      <td className="px-2 py-1 font-mono">{p.name}</td>
                      <td className="px-2 py-1 text-muted-foreground">{p.in}</td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {schemaTypeStr(p.schema)}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {p.required ? "✓" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Request body example */}
        {reqBodyStr && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("example")} · request
            </p>
            <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px]">
              <code>{reqBodyStr}</code>
            </pre>
          </div>
        )}

        {/* Curl example */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("example")} · curl
            </p>
            <CopyButton text={curl} t={t} />
          </div>
          <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px]">
            <code>{curl}</code>
          </pre>
        </div>

        {/* Response example */}
        {exampleStr && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("response")} · {okStatus}
            </p>
            <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px]">
              <code>{exampleStr}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button (per-card state)
// ---------------------------------------------------------------------------

function CopyButton({
  text,
  t,
}: {
  text: string;
  t: (key: string) => string;
}) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be unavailable (insecure context); ignore silently.
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 gap-1 text-[10px]"
      onClick={handle}
      type="button"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? t("copied") : t("copyCurl")}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function schemaTypeStr(
  schema?: OpenApiParameter["schema"],
): string {
  if (!schema) return "—";
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  return schema.type ?? "—";
}

/**
 * Build a runnable `curl` command for the endpoint.
 *
 * - GET endpoints: substitutes query params from their example values.
 * - POST endpoints: includes a JSON request body from the `default` example.
 */
function buildCurl(
  method: string,
  path: string,
  op: OpenApiOperation,
  baseUrl: string,
): string {
  let url = `${baseUrl}${path}`;
  if (op.parameters && op.parameters.length > 0) {
    const qs = op.parameters
      .filter((p) => p.in === "query")
      .map((p) => {
        const ex = p.example ?? p.schema?.example;
        return ex != null
          ? `${p.name}=${encodeURIComponent(String(ex))}`
          : `${p.name}=...`;
      });
    if (qs.length > 0) url += `?${qs.join("&")}`;
  }

  const parts = ["curl", "-X", method.toUpperCase(), `'${url}'`];
  const bodyEx =
    op.requestBody?.content?.["application/json"]?.examples?.default?.value;
  if (bodyEx != null) {
    parts.push("-H", "'Content-Type: application/json'");
    parts.push("-d", `'${JSON.stringify(bodyEx)}'`);
  }
  return parts.join(" ");
}
