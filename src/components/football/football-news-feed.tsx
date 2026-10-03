"use client";

import useSWR from "swr";
import { Newspaper, ExternalLink, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsItem, NewsResult } from "@/lib/football-news";

/**
 * FootballNewsFeed — fil d'actu du football, cartes avec photo.
 *
 * SWR comme le reste du projet (`useFootballMatches` etc.) : revalidation au
 * focus, pas de cascade de state local. Le composant reste affichable sans
 * donnée (squelette + message), ce qui évite une page vide au premier fetch.
 *
 * **Pas de photo** (décision du 2026-10-03, risque assumé par le
 * propriétaire) : les URL d'images étaient simplement les liens des CDN des
 * éditeurs, en *hotlink*. Beaucoup d'éditeurs l'interdisent, la photo pouvait
 * ne pas s'afficher, et une carte à photo fantôme est pire qu'une carte sans
 * photo. Titre + source + heure suffisent à une accroche.
 */

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

/** « il y a 3 h », en français. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-white/[0.06]",
        "bg-white/[0.02] transition-colors hover:border-emerald-500/30",
      )}
    >

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
          <span className="font-bold text-emerald-400">{item.source}</span>
          {item.lang === "fr" && (
            <span className="rounded border border-white/10 px-1 text-zinc-500">FR</span>
          )}
          {item.publishedAt && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Clock className="h-2.5 w-2.5" aria-hidden />
              {relativeTime(item.publishedAt)}
            </span>
          )}
        </div>

        <p className="line-clamp-3 flex-1 text-[13px] font-medium leading-snug text-zinc-200 group-hover:text-white">
          {item.title}
        </p>

        <span className="flex items-center gap-1 text-[10px] text-zinc-500">
          Lire l'article
          <ExternalLink className="h-2.5 w-2.5" aria-hidden />
        </span>
      </div>
    </a>
  );
}

export function FootballNewsFeed({ className }: { className?: string }) {
  const { data, error, isLoading } = useSWR<NewsResult>("/api/football/news", fetcher);

  if (error) {
    return (
      <div className={cn("rounded-xl border border-dashed border-border/60 px-6 py-10 text-center", className)}>
        <Newspaper className="mx-auto h-6 w-6 text-zinc-600" aria-hidden />
        <p className="mt-2 text-sm font-medium">Fil d&apos;actu indisponible</p>
        <p className="mt-1 text-xs text-muted-foreground">Réessaie dans quelques instants.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div
        className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}
        aria-busy="true"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02]" />
        ))}
      </div>
    );
  }

  if (data.items.length === 0) {
    const failed = data.sources.filter((s) => !s.ok);
    return (
      <div className={cn("rounded-xl border border-dashed border-border/60 px-6 py-10 text-center", className)}>
        <Newspaper className="mx-auto h-6 w-6 text-zinc-600" aria-hidden />
        <p className="mt-2 text-sm font-medium">Aucune actu pour le moment</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {failed.length > 0
            ? `${failed.length} source(s) sur ${data.sources.length} ne répondent pas.`
            : "Les sources sont joignables mais n'ont rien publié."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
      <p className="text-[10px] text-zinc-600">
        {data.items.length} articles ·{" "}
        {data.sources.filter((s) => s.ok).length}/{data.sources.length} sources ·{" "}
        {new Date(data.fetchedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}