// Connecteurs revue de presse — routing par domaine, fetch direct → Jina.
// Server-only. Extraction ciblée (méta, JSON-LD, blocs « Prediction ») avec
// circuit-breaker par domaine. Aucun appel LLM.

import {
  extractJsonLd,
  extractMetaDescription,
  extractOgDescription,
  extractPredictionBlock,
  markdownToText,
  stripHtml,
} from "./press-extractors";
import { fetchViaJina } from "./press-jina-fallback";

export type FetchedArticle = {
  text: string; // texte complet (résumé expert)
  predictText?: string; // bloc ciblé « Prediction » (si trouvé)
  host: string;
  url: string;
  sourceName: string;
  icon: string;
  viaJina: boolean;
};

type FetchOutcome =
  | { kind: "html"; html: string }
  | { kind: "markdown"; text: string };

// ---- Circuit-breaker par domaine ──────────────────────────────────────────

const DOMAIN_MAX_FAILS = 2;
const DOMAIN_COOLDOWN_MS = 30 * 60 * 1000;
const domainState = new Map<string, { fails: number; until: number }>();

export function isDomainBlocked(host: string): boolean {
  const s = domainState.get(host);
  return !!s && Date.now() < s.until;
}

export function reportDomainResult(host: string, ok: boolean): void {
  if (ok) {
    domainState.delete(host);
    return;
  }
  const s = domainState.get(host) || { fails: 0, until: 0 };
  s.fails++;
  if (s.fails >= DOMAIN_MAX_FAILS) {
    s.until = Date.now() + DOMAIN_COOLDOWN_MS;
    s.fails = 0;
    console.warn("[press-connectors] domaine bloqué 30 min : " + host);
  }
  domainState.set(host, s);
}

export function resetDomainState(): void {
  domainState.clear();
}

// ---- Fetch article avec fallback Jina ─────────────────────────────────────

/**
 * Fetch direct (8 s) ; en cas d'échec (HTTP >= 400, timeout, réseau)
 * bascule sur r.jina.ai. Ne lève jamais : retourne null en échec total.
 */
export async function fetchArticleWithFallback(url: string): Promise<FetchOutcome | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PariScoreBot/1.0; +https://pariscore.fr)" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error("http " + res.status);
    const html = await res.text();
    if (html.length < 200) throw new Error("empty page");
    return { kind: "html", html };
  } catch (err) {
    try {
      const text = await fetchViaJina(url);
      return { kind: "markdown", text };
    } catch (jinaErr) {
      return null;
    }
  }
}

// ---- Extraction ciblée par source ─────────────────────────────────────────

type Targeted = { predictText?: string; text: string };

function cleanHtml(html: string): string {
  return stripHtml(html);
}

/** Extraction ciblée : JSON-LD / méta / bloc « Prediction » prioritaire, sinon texte complet. */
export function extractTargeted(host: string, raw: string, markdown: boolean): Targeted {
  const json = markdown ? null : extractJsonLd(raw);

  // 1. Bloc mot-clé « Prediction » (le plus précis) — HTML ou Markdown
  let predictText: string | null = extractPredictionBlock(raw);
  // 2. JSON-LD description / articleBody si plus riche que le bloc
  if (json) {
    const ldText = json.articleBody || json.description;
    if (!predictText && ldText) predictText = ldText.slice(0, 400);
    if (predictText && ldText && ldText.length > predictText.length && ldText.length > 300) {
      predictText = ldText.slice(0, 400);
    }
  }
  // 3. Méta description / og:description
  if (!predictText) {
    predictText = (markdown ? null : extractMetaDescription(raw))
      || (markdown ? null : extractOgDescription(raw));
  }

  const text = markdown ? raw : cleanHtml(raw);
  return { predictText: predictText && predictText.length > 10 ? predictText.slice(0, 400) : undefined, text };
}

/** Point d'entrée : fetch + extraction ciblée pour un article découvert. */
export async function fetchArticleTargeted(
  url: string,
  host: string,
): Promise<{ text: string; predictText?: string; viaJina: boolean } | null> {
  const outcome = await fetchArticleWithFallback(url);
  if (!outcome) return null;

  const targeted = extractTargeted(host, outcome.kind === "html" ? outcome.html : outcome.text, outcome.kind === "markdown");
  return {
    text: targeted.text,
    predictText: targeted.predictText,
    viaJina: outcome.kind === "markdown",
  };
}

export { markdownToText };