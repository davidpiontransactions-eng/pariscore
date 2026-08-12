// Fallback Jina Reader (r.jina.ai) — conversion article → Markdown propre.
// Server-only. Couche de secours quand le fetch direct échoue (403, CAPTCHA, JS-only).
// Quota gratuit (~20 RPM anonyme) → throttling interne + circuit-breaker.

import { markdownToText } from "./press-extractors";

const JINA_BASE = "https://r.jina.ai";
const MIN_INTERVAL_MS = 1_500; // throttling : 1 appel toutes les 1,5 s
const BREAKER_MAX_FAILS = 5; // 5 échecs consécutifs → pause 10 min
const BREAKER_COOLDOWN_MS = 10 * 60 * 1000;

let lastCallAt = 0;
let consecutiveFails = 0;
let breakerUntil = 0;

export function isJinaOpen(): boolean {
  return Date.now() < breakerUntil;
}

function recordResult(ok: boolean): void {
  if (ok) {
    consecutiveFails = 0;
    return;
  }
  consecutiveFails++;
  if (consecutiveFails >= BREAKER_MAX_FAILS) {
    breakerUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.warn("[press-jina] circuit ouvert 10 min après " + consecutiveFails + " échecs consécutifs");
  }
}

/** Conversion d'un article via https://r.jina.ai/{url} → texte propre (Markdown dépouillé). */
export async function fetchViaJina(url: string, timeoutMs = 12_000): Promise<string> {
  if (isJinaOpen()) throw new Error("jina circuit-breaker open");

  // Throttle : espacement minimal entre deux appels
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCallAt = Date.now();

  try {
    const res = await fetch(JINA_BASE + "/" + url.replace(/^https?:\/\//, ""), {
      headers: {
        Accept: "text/markdown, text/plain",
        "X-Timeout": "10",
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) {
      recordResult(false);
      throw new Error("jina http " + res.status);
    }
    const md = await res.text();
    if (md.length < 200) {
      recordResult(false);
      throw new Error("jina empty body");
    }
    recordResult(true);
    return markdownToText(md);
  } catch (err) {
    recordResult(false);
    throw err;
  }
}