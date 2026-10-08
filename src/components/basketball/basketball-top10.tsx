"use client";

/**
 * BasketballTop10 — widget des opportunités basket.
 *
 * Source : `/api/basketball/opportunities` (lecture SQLite côté serveur —
 * `bun:sqlite` n'existe pas dans le navigateur).
 *
 * ⚠️ Le badge « Désaccord Modèle » est piloté par `strongDisagreement`, calculé
 * **côté serveur** à partir de `STRONG_DISAGREEMENT_PP` (12 pp). Le client ne
 * recalcule pas le seuil : une règle métier dupliquée finit toujours par
 * diverger de celle qui produit les données.
 *
 * ⚠️ Un EV > 0 signifie « le modèle désaccorde le marché », pas « le marché a
 * tort ». Réellement mesuré : Real Madrid — Partizan, modèle 38.5 % vs marché
 * 21.9 % → EV +101 %. Le badge n'est pas décoratif, il dit de ne pas parier
 * sans avoir instruit le désaccord.
 *
 * Tokens sémantiques uniquement (text-foreground, bg-background…) → mode sombre natif.
 */

import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type BasketballOpportunity = {
  bsdEventId: number;
  league: string;
  matchup: string;
  side: "home" | "away";
  prob: number;
  odds: number;
  ev: number;
  edge: number;
  disagreementPp: number;
  strongDisagreement: boolean;
};

type OpportunitiesResponse = {
  source: string;
  rule: { minEvExclusive: number; strongDisagreementPp: number; requiresCalibratedLeague: boolean };
  opportunities: BasketballOpportunity[];
  counts: {
    opportunities: number;
    totalOppo: number;
    strongDisagreement: number;
    fixtures: number;
    modeled: number;
  };
  calibratedLeagues: string[];
  predictionsAvailable: boolean;
  error?: string;
  details?: string;
};

const fetcher = async (url: string): Promise<OpportunitiesResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  let body: Partial<OpportunitiesResponse> | null = null;
  try {
    body = JSON.parse(text) as Partial<OpportunitiesResponse>;
  } catch {
    body = null;
  }
  // Pas de JSON ⇒ réponse d'infra (nginx 502, page d'erreur) → on THROW pour
  // que SWR conserve la dernière donnée valide, jamais un objet vide inventé.
  if (!res.ok && !body) throw new Error(`HTTP ${res.status}`);
  if (!body) throw new Error(`réponse illisible (HTTP ${res.status})`);
  return {
    source: "basketball_fixtures",
    rule: { minEvExclusive: 0, strongDisagreementPp: 12, requiresCalibratedLeague: true },
    opportunities: [],
    counts: { opportunities: 0, totalOppo: 0, strongDisagreement: 0, fixtures: 0, modeled: 0 },
    calibratedLeagues: [],
    predictionsAvailable: false,
    ...body,
  };
};

function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)} %`;
}

export function BasketballTop10({ className, limit = 10 }: { className?: string; limit?: number }) {
  const { data, error, isLoading } = useSWR<OpportunitiesResponse>(
    `/api/basketball/opportunities?top=${limit}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, keepPreviousData: true },
  );

  const notice = error
    ? "Les opportunités sont temporairement indisponibles. Réessayez dans un instant."
    : !data?.predictionsAvailable && data?.error
      ? (data.details ?? "Base basket indisponible.")
      : null;

  return (
    <section
      aria-label="Top opportunités basket"
      className={cn("rounded-lg border bg-card p-3", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">Top {limit} — opportunités</h3>
        {data && data.counts.totalOppo > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {data.counts.opportunities} / {data.counts.totalOppo} à EV positif
          </span>
        )}
      </div>

      {isLoading && !data ? (
        <p className="mt-2 text-xs text-muted-foreground">Lecture de la base…</p>
      ) : notice ? (
        <p
          className="mt-2 rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground"
          role="note"
        >
          {notice}
        </p>
      ) : !data || data.opportunities.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Aucune opportunité à EV strictement positif. Sur les{" "}
          {data?.counts.modeled ?? 0} matchs modélisés, aucun côté ne dépasse la
          cote dévigée. <span className="text-[10px]">(Ligues calibrées seules.)</span>
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-border/50">
            {data.opportunities.map((o) => (
              <li
                key={`${o.bsdEventId}-${o.side}`}
                className="flex items-start gap-2 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="px-1 py-0 font-mono text-[9px]">
                      {o.league}
                    </Badge>
                    <span className="truncate text-xs font-medium">{o.matchup}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {o.side === "home" ? "domicile" : "extérieur"} · modèle{" "}
                    <span className="tabular-nums">{pct(o.prob)}</span> · cote{" "}
                    <span className="tabular-nums">{o.odds.toFixed(2)}</span> · dévig{" "}
                    <span className="tabular-nums">{pct(1 / o.odds)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {/* EV toujours signé : négatif on ne l'affiche pas (filétre), mais
                      le désaccord, lui, s'affiche même quand EV est grand. */}
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    +{(o.ev * 100).toFixed(1)} %
                  </span>
                  {o.strongDisagreement && (
                    <Badge
                      variant="outline"
                      className="border-destructive/60 px-1 py-0 text-[9px] text-destructive"
                      title={`Écart modèle/cote de ${o.disagreementPp.toFixed(1)} pp — supérieur au seuil de ${data.rule.strongDisagreementPp} pp. À instruire avant toute mise.`}
                    >
                      Désaccord Modèle
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            EV &gt; 0 strictement · ligues calibrées uniquement · seuil de
            désaccord {data.rule.strongDisagreementPp} pp. Un EV positif signale
            un désaccord modèle/marché, pas une inefficience du marché.
            {data.counts.strongDisagreement > 0 && (
              <span className="block text-destructive">
                {data.counts.strongDisagreement} signal
                {data.counts.strongDisagreement > 1 ? "s" : ""} marqué
                {data.counts.strongDisagreement > 1 ? "s" : ""} « Désaccord Modèle »
                {data.counts.strongDisagreement > 1 ? "s" : ""} — ne pas parier sans
                analyse.
              </span>
            )}
          </p>
        </>
      )}
    </section>
  );
}