import { describe, it, expect, afterEach } from "bun:test";
import { probeEmbeddable } from "@/lib/livetv-stream-service";

const realFetch = globalThis.fetch;

function stubFetch(status: number, headers: Record<string, string> = {}, fail = false) {
  (globalThis as Record<string, unknown>).fetch = async () => {
    if (fail) throw new Error("network down");
    return new Response(null, { status, headers });
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("probeEmbeddable", () => {
  it("451/403 → non enchâssable", async () => {
    stubFetch(451);
    expect(await probeEmbeddable("https://x.test/e")).toBe(false);
    stubFetch(403);
    expect(await probeEmbeddable("https://x.test/e")).toBe(false);
  });

  it("X-Frame-Options DENY/SAMEORIGIN → non enchâssable", async () => {
    stubFetch(200, { "x-frame-options": "DENY" });
    expect(await probeEmbeddable("https://x.test/e")).toBe(false);
    stubFetch(200, { "x-frame-options": "SAMEORIGIN" });
    expect(await probeEmbeddable("https://x.test/e")).toBe(false);
  });

  it("CSP frame-ancestors restrictif → non enchâssable, * → ok", async () => {
    stubFetch(200, { "content-security-policy": "default-src 'self'; frame-ancestors 'self'" });
    expect(await probeEmbeddable("https://x.test/e")).toBe(false);
    stubFetch(200, { "content-security-policy": "frame-ancestors *" });
    expect(await probeEmbeddable("https://x.test/e")).toBe(true);
  });

  it("200 sans restrictions → ok, erreur réseau → fail-open", async () => {
    stubFetch(200);
    expect(await probeEmbeddable("https://x.test/e")).toBe(true);
    stubFetch(0, {}, true);
    expect(await probeEmbeddable("https://x.test/e")).toBe(true);
  });
});
