"use client";

import useSWR from "swr";
import { ExternalLink, Newspaper } from "lucide-react";
import type { HandballNewsPayload, HandballNewsSourceId } from "@/lib/handball-news";

/** Couleur de badge par source — repère visuel constant. */
const SOURCE_STYLES: Record<HandballNewsSourceId, string> = {
  handnews: "bg-sky-500/15 text-sky-400",
  planet: "bg-amber-500/15 text-amber-500",
  lequipe: "bg-red-500/15 text-red-400",
  eurosport: "bg-emerald-500/15 text-emerald-400",
  handball365: "bg-violet-500/15 text-violet-400",
};

/** « il y a 2 h » / « hier » — Intl gère les pluriels et la langue. */
const REL_FMT = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

function relativeTime(iso: string): string {
  const deltaMs = Date.parse(iso) - Date.now();
  if (!Number.isFinite(deltaMs)) return "";
  const minutes = Math.round(deltaMs / 60_000);
  if (Math.abs(minutes) < 60) return REL_FMT.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return REL_FMT.format(hours, "hour");
  return REL_FMT.format(Math.round(hours / 24), "day");
}

const fetchJson = <T,>(url: string): Promise<T> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });

/**
 * Actus handball — agrégation RSS des 4 sources (HandNews, Handball Planet,
 * L'Équipe, Eurosport), titres en français (traduction Gemini des titres EN,
 * fallback original). Rafraîchi toutes les 15 min, serveur cache 30 min.
 */
export function HandballNews() {
  const { data, error, isLoading } = useSWR<HandballNewsPayload>(
    "/api/handball/news",
    fetchJson,
    { refreshInterval: 15 * 60_000, dedupingInterval: 10 * 60_000, revalidateOnFocus: false },
  );

  const okSources = data?.sources.filter((s) => s.ok) ?? [];
  const items = data?.items ?? [];

  return (
    <section className="space-y-2 rounded border border-[#f0f0f0] bg-white p-3 text-[#222222]">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#222222]">
          <Newspaper className="h-4 w-4 text-[#00985f]" />
          Actus handball
        </h3>
        <span className="text-xs text-[#717171]">
          {okSources.length > 0
            ? `${items.length} article(s) · ${okSources.map((s) => s.name).join(" · ")}`
            : ""}
        </span>
      </div>

          {isLoading ? (
        <div className="py-3 text-center text-sm text-[#717171]" aria-live="polite">
          Chargement des actus…
        </div>
      ) : error || items.length === 0 ? (
        <div className="py-3 text-center text-sm text-[#717171]">Actus indisponibles</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((n) => (
            <li key={n.id}>
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded px-2 py-1.5 transition-colors hover:bg-[#fafafa]"
                aria-label={`${n.sourceName} — ${n.title}`}
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    SOURCE_STYLES[n.source] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {n.sourceName}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug text-[#222222]">{n.title}</span>
                  <span className="block text-[11px] text-[#717171]">
                    {relativeTime(n.publishedAt)}
                  </span>
                </span>
                <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-[#717171]" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
