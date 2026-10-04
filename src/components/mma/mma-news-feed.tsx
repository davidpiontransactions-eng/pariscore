"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Newspaper, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type NewsItem = {
  id: string;
  title: string;
  titleFr: string;
  translated: boolean;
  link: string;
  source: string;
  publishedAt: string | null;
  image: string | null;
  summary: string | null;
};

type NewsPayload = {
  items: NewsItem[];
  sources: { id: string; name: string; ok: boolean; count: number }[];
  translated: boolean;
  error?: string;
};

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function when(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return timeFmt.format(d);
}

/**
 * Fil d'actu MMA — cartes avec vignette, titre traduit et lien vers la source.
 *
 * Les images sont des URL distantes en hotlink :BBC y répond (mesuré), mais un
 * éditeur peut l'interdire un jour. D'où le `onError` qui retire la vignette au
 * lieu de laisser un cadre cassé — le titre reste lisible dans tous les cas.
 */
export function MmaNewsFeed({ limit = 12 }: { limit?: number }) {
  const [data, setData] = useState<NewsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/mma/news?limit=${limit}`)
      .then((r) => r.json())
      .then((d: NewsPayload) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" aria-busy="true">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des actus…
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {data?.error || "Aucune actualité MMA disponible."}
      </p>
    );
  }

  return (
    <section aria-labelledby="mma-actu-titre" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mma-actu-titre" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          <Newspaper className="h-4 w-4" />
          Actu MMA
        </h2>
        {/* La traduction est un bonus, pas un contrat : on ne pretend pas qu'elle
            a eu lieu si le quota IA a échoué. */}
        {data?.translated ? (
          <span className="text-[11px] text-muted-foreground">traduit automatiquement</span>
        ) : data?.items.some((i) => !i.translated) ? (
          <span className="text-[11px] text-muted-foreground">version originale</span>
        ) : null}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group flex h-full gap-3 rounded-xl border border-border bg-card p-2.5",
                "transition-colors hover:border-sport-mma/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sport-mma",
              )}
            >
              <NewsThumb src={item.image} alt="" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug text-foreground group-hover:text-sport-mma">
                  {item.titleFr}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-sport-mma">{item.source}</span>
                  {when(item.publishedAt) && <span>{when(item.publishedAt)}</span>}
                  <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Vignette avec repli propre : une image qui ne charge pas ne laisse pas de trou. */
function NewsThumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900"
      />
    );
  }
  return (
    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="64px"
        className="object-cover"
        onError={() => setFailed(true)}
        unoptimized
      />
    </span>
  );
}