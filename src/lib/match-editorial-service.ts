// Service éditorial « analyse prédictive écrite » pour les cartes match.
//
// Orchestration à 4 étapes (boucle engineering) au-dessus du scraper éditorial
// existant (`editorial-scraper-service.ts`) :
//   1. Récupérer  — résumé source (EN) via le pipeline editorial-scraper (cache 24h).
//   2. Traduire   — si locale demandée = fr : traduction EN→FR via Gemini
//                   (cache 24h mémoire + disque, un seul appel LLM par contenu).
//   3. Enrichir   — attacher source / url / lang / ttl au résultat.
//   4. Vérifier   — ne JAMAIS jeter ; toute erreur → status "absent" (l'UI masque).
//
// Service server-only (node:fs + clé Gemini). Jamais importé côté client.

import { promises as fs } from "fs";
import path from "path";
import {
  getEditorialSummary,
  type EditorialQuery,
  type EditorialSummary,
} from "@/lib/scraping/editorial-scraper-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Langues réellement desservies (Q2 : fr + en, les autres locales → en). */
export type EditorialLang = "fr" | "en";

export type MatchEditorialAvailable = {
  status: "available";
  /** Texte dans la langue demandée (fr = traduit, sinon inchangé). */
  text: string;
  /** Domaine source (ex: "lastwordonsports.com"). */
  source: string;
  /** URL de l'article complet (whitelist). */
  url: string;
  /** true si `text` est le résultat d'une traduction EN→FR. */
  translated: boolean;
  fetchedAt: string;
};

export type MatchEditorialResult =
  | MatchEditorialAvailable
  | { status: "absent" };

const TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_TRANSLATION_CHARS = 600;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GEMINI_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Cache traduction (mémoire + fichier .cache/editorial/<sport>-<id>.fr.json)
// ---------------------------------------------------------------------------

type FrCacheEntry = { translated: string | null; at: number };
function translationCacheDir(): string {
  return path.join(process.cwd(), ".cache", "editorial");
}
function frCacheFilePath(query: EditorialQuery): string {
  const safeId = query.matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(translationCacheDir(), `${query.sport}-${safeId}.fr.json`);
}
function frMemoKey(query: EditorialQuery): string {
  return `__editorial_fr_${query.sport}_${query.matchId}`;
}
const g = globalThis as unknown as Record<string, FrCacheEntry | undefined>;
function frMemoGet(query: EditorialQuery): string | null | undefined {
  const entry = g[frMemoKey(query)];
  if (!entry) return undefined;
  if (Date.now() - entry.at < TTL_MS) return entry.translated;
  return undefined;
}
function frMemoSet(query: EditorialQuery, translated: string | null): void {
  g[frMemoKey(query)] = { translated, at: Date.now() };
}
async function frCacheRead(query: EditorialQuery): Promise<string | null | undefined> {
  try {
    const raw = await fs.readFile(frCacheFilePath(query), "utf8");
    const entry = JSON.parse(raw) as FrCacheEntry;
    if (entry && Date.now() - entry.at < TTL_MS) return entry.translated;
    return undefined;
  } catch {
    return undefined;
  }
}
async function frCacheWrite(query: EditorialQuery, translated: string | null): Promise<void> {
  try {
    await fs.mkdir(translationCacheDir(), { recursive: true });
    await fs.writeFile(
      frCacheFilePath(query),
      JSON.stringify({ translated, at: Date.now() }),
      "utf8",
    );
  } catch {
    // cache best-effort.
  }
}

// ---------------------------------------------------------------------------
// Traduction EN→FR (Gemini 2.0 Flash) — appel unique par contenu + cache 24h
// ---------------------------------------------------------------------------

async function translateEnToFr(text: string): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  if (text.length > MAX_TRANSLATION_CHARS) text = text.slice(0, MAX_TRANSLATION_CHARS);

  const body = {
    contents: [
      {
        parts: [
          {
            text: `Translate the following match preview from English to natural French. Keep it concise (2-3 sentences), keep proper names unchanged. Output only the French translation, no commentary, no quotes.
---
${text}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
  };

  try {
    const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const candidates = (data as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      ?.candidates;
    const raw = candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof raw !== "string" || raw.trim().length === 0) return null;
    const out = raw.trim().replace(/^["'«]+|["'»]+$/g, "");
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Entry point — orchestration 4 étapes, ne jette jamais
// ---------------------------------------------------------------------------

/**
 * Analyse éditoriale d'un duel dans la langue demandée (fr/en, fallback → source).
 * Retourne `{ status: "absent" }` si aucun article fiable / aucune traduction
 * (cas nominal attendu — l'UI masque l'encart, jamais d'erreur).
 */
export async function getMatchEditorial(
  query: EditorialQuery,
  lang: EditorialLang = "fr",
): Promise<MatchEditorialResult> {
  const summary: EditorialSummary | null = await getEditorialSummary(query);
  if (!summary) return { status: "absent" };

  // en → texte source (les sites de référence sont anglophones).
  if (lang === "en") {
    return { status: "available", ...summary, translated: false };
  }

  // fr → traduction mise en cache (mémoire → disque → LLM).
  const cached = frMemoGet(query) ?? (await frCacheRead(query));
  if (cached !== undefined && cached !== null) {
    return { status: "available", ...summary, text: cached, translated: true };
  }
  if (cached === null) {
    return { status: "available", ...summary, translated: false };
  }

  const translated = await translateEnToFr(summary.text);
  if (translated) {
    frMemoSet(query, translated);
    await frCacheWrite(query, translated);
    return { status: "available", ...summary, text: translated, translated: true };
  }

  // Traduction indisponible → fallback source (l'anglais).
  frMemoSet(query, null);
  await frCacheWrite(query, null);
  return { status: "available", ...summary, translated: false };
}

/** Vide les caches d'un match (tests). */
export async function invalidateMatchEditorial(query: EditorialQuery): Promise<void> {
  frMemoSet(query, null);
  try {
    await fs.rm(frCacheFilePath(query), { force: true });
  } catch {
    // ignoré
  }
}