"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ExternalLink, Loader2, Tv, X } from "lucide-react";
import type { LiveTvResolveResult, LiveTvSport } from "@/lib/livetv-stream-service";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport: LiveTvSport;
  home: string;
  away: string;
  /** Label court affiché dans le header (ex. "Tennis · ATP Montreal"). */
  subtitle?: string;
};

async function resolveStream(sport: LiveTvSport, home: string, away: string): Promise<LiveTvResolveResult> {
  const q = new URLSearchParams({
    sport,
    home,
    away,
    // Ajout d'un nonce anti-cache navigateur pour forcer un re-scrape frais.
    t: String(Date.now()),
  });
  const res = await fetch(`/api/stream/resolve?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* corps non-JSON → message générique */
    }
    throw new Error(message);
  }
  return (await res.json()) as LiveTvResolveResult;
}

/**
 * Modal de lecture d'un stream LiveTV.
 * - à l'ouverture : résolution via /api/stream/resolve
 * - sélecteur de chaînes + iframe sandboxé `/export/webplayer.iframe.php`
 * - fallback : lien externe vers la page événement LiveTV
 */
export function StreamPlayerModal({ open, onOpenChange, sport, home, away, subtitle }: Props) {
  const [result, setResult] = useState<LiveTvResolveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  // Reset des états + déclenchement de la résolution à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setResult(null);
    setError(null);
    setActiveIndex(0);
    setIframeSrc(null);

    const t = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      resolveStream(sport, home, away)
        .then((data) => {
          if (cancelled) return;
          setResult(data);
          if (data.found && data.streams.length > 0) {
            setIframeSrc(data.streams[0].embedUrl);
          }
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, sport, home, away]);

  const selectChannel = useCallback(
    (index: number) => {
      setActiveIndex(index);
      setIframeSrc(result?.streams[index]?.embedUrl ?? null);
    },
    [result],
  );

  const streams = useMemo(() => result?.streams ?? [], [result]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/40 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Tv className="h-4 w-4 text-emerald-500" />
              <span className="truncate">
                {home} – {away}
              </span>
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fermer"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {subtitle && (
            <DialogDescription className="text-xs text-muted-foreground">{subtitle}</DialogDescription>
          )}
        </DialogHeader>

        <div className="relative flex min-h-[260px] flex-col sm:min-h-[360px]">
          {/* État : chargement */}
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-14">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-sm text-muted-foreground">Recherche de streams LiveTV…</p>
            </div>
          )}

          {/* État : erreur réseau/service */}
          {!loading && error && !result && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-14 px-4">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-center text-sm text-muted-foreground">
                Impossible de contacter le service de streams. {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setResult(null);
                  setActiveIndex(0);
                  setIframeSrc(null);
                  setLoading(true);
                  resolveStream(sport, home, away)
                    .then((data) => {
                      setResult(data);
                      if (data.found && data.streams.length > 0) setIframeSrc(data.streams[0].embedUrl);
                    })
                    .catch((err: Error) => setError(err.message))
                    .finally(() => setLoading(false));
                }}
                className="btn-smish rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* État : stream trouvé */}
          {!loading && !error && result?.found && streams.length > 0 && (
            <div className="flex flex-col gap-3 p-3 sm:p-4">
              {/* Sélecteur de chaînes */}
              {streams.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Chaînes disponibles">
                  {streams.map((s, i) => (
                    <button
                      key={s.cid}
                      type="button"
                      role="tab"
                      aria-selected={i === activeIndex}
                      onClick={() => selectChannel(i)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                        i === activeIndex
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Player iframe sandboxé */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
                {iframeSrc ? (
                  <iframe
                    key={iframeSrc}
                    src={iframeSrc}
                    title={`Stream ${streams[activeIndex]?.label ?? ""} — ${home} vs ${away}`}
                    className="absolute inset-0 h-full w-full"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="origin-when-cross-origin"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    La lecture du stream échoue sur ce canal.
                  </div>
                )}
              </div>

              <p className="text-center text-[11px] text-muted-foreground">
                Les flux LiveTV sont fournis par des tiers. Qualité et disponibilité peuvent varier.
              </p>
            </div>
          )}

          {/* État : événement trouvé mais aucun flux actif */}
          {!loading && !error && result?.found && streams.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-14 px-6">
              <Tv className="h-8 w-8 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                {result.event?.title ?? "L'événement"} est trouvé, mais aucun flux actif en ce moment.
              </p>
              {result.event && (
                <a
                  href={result.event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Voir sur LiveTV
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* État : aucun événement matché */}
          {!loading && !error && result && !result.found && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-14 px-6">
              <Tv className="h-8 w-8 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                Aucun stream LiveTV détecté pour ce match (pas encore diffusé ou indisponible).
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}