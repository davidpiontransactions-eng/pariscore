"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEditorialSummary, type EditorialSummary } from "@/hooks/use-editorial-summaries";
import type { EditorialLang } from "@/lib/match-editorial-service";
import { cn } from "@/lib/utils";

/**
 * Encart « analyse prédictive écrite » — texte 2-3 phrases d'un site de
 * référence (whitelist), traduit EN→FR selon la locale (fr) sinon source EN.
 *
 * - `compact`  : une ligne (cartes match) — masqué si aucun article.
 * - `full`     : paragraphe + lien source (modale de détail).
 *
 * Ne remonte JAMAIS d'erreur : pas d'article → rend null (l'encart disparaît).
 */
export function EditorialInsight({
  sport,
  matchId,
  playerA,
  playerB,
  variant = "compact",
  className,
}: {
  sport: "tennis" | "football";
  matchId: string;
  playerA: string;
  playerB: string;
  variant?: "compact" | "full";
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("editorial");
  const lang: EditorialLang = locale === "fr" ? "fr" : "en";

  const { summary } = useEditorialSummary(sport, matchId, playerA, playerB, lang);
  if (!summary) return null;

  if (variant === "compact") {
    return (
      <p
        className={cn(
          "mt-1 line-clamp-1 text-[10px] italic leading-snug text-slate-500",
          className,
        )}
        title={`${summary.text} — ${t("source")} ${summary.source}`}
      >
        📰 {summary.text}
      </p>
    );
  }

  return <EditorialFull summary={summary} className={className} />;
}

/** Version complète (modale) : paragraphe + lien vers l'article source. */
function EditorialFull({
  summary,
  className,
}: {
  summary: EditorialSummary;
  className?: string;
}) {
  const t = useTranslations("editorial");
  return (
    <div className={cn("rounded-lg border border-border/60 bg-muted/30 p-3", className)}>
      <p className="text-[13px] leading-relaxed text-card-foreground/90">{summary.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        <span>
          {t("source")} <span className="font-medium text-slate-600">{summary.source}</span>
          {summary.translated ? ` · ${t("translated")}` : ""}
        </span>
        <a
          href={summary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto underline decoration-dotted underline-offset-2 hover:text-primary"
        >
          {t("readMore")}
        </a>
      </div>
    </div>
  );
}
