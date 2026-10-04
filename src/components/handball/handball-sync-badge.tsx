"use client";

// Badge « Dernière mise à jour » partagé par les sous-onglets Résultats et
// Backtesting.
//
// Rôle opérationnel : la fenêtre « Résultats » et les KPI du backtesting sont
// alimentés par le cron de scraping (toutes les 4 h). Sans rappel de fraîcheur
// affiché, une donnée figée est indiscernable d'une donnée à jour — c'est
// exactement le symptôme du 28/09→04/10, resté invisible.
//
// Trois états, jamais aucun :
//   • < 6 h  → vert « à l'heure » ;
//   • < 24 h → ambre « données un peu datées » ;
//   • sinon  → rouge + mention explicite que le cron est peut-être arrêté.
// `scrapedAt` null = source inconnue → état neutre, jamais « à l'heure ».

const MS_PER_HOUR = 3_600_000;
const FRESH_HOURS = 6;
const STALE_HOURS = 24;

const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Âge de la source en heures ; null si inconnue ou illisible. */
export function handballSyncAgeHours(scrapedAt: string | null | undefined): number | null {
  if (!scrapedAt) return null;
  const t = Date.parse(scrapedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / MS_PER_HOUR);
}

export function HandballSyncBadge({
  scrapedAt,
  cadence = "Synchronisé toutes les 4 h",
  className,
}: {
  scrapedAt: string | null | undefined;
  /** Mention de cadence affichée à côté de l'horodatage. */
  cadence?: string;
  className?: string;
}) {
  const ageH = handballSyncAgeHours(scrapedAt);

  // `scrapedAt` non vide ET parseable est garanti par le age != null ci-dessus,
  // mais TypeScript ne le sait pas : on le capture une fois pour le formatter.
  const at = typeof scrapedAt === "string" && Number.isFinite(Date.parse(scrapedAt))
    ? scrapedAt
    : "";

  if (ageH == null) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-medium text-[#717171] dark:bg-white/10 dark:text-slate-300 ${className ?? ""}`}
        title="Horodatage de scraping inconnu"
      >
        🕐 Dernière mise à jour : inconnue
      </span>
    );
  }

  const tooOld = ageH > STALE_HOURS;
  const fresh = ageH <= FRESH_HOURS;
  const tone = tooOld
    ? "bg-red-500/15 text-red-500 ring-1 ring-red-500/30"
    : fresh
      ? "bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25"
      : "bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/25";
  const label = tooOld
    ? `dernière synchro ${Math.round(ageH)} h — cron possiblement arrêté`
    : `Dernière mise à jour : ${TIME_FMT.format(new Date(at))}`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone} ${className ?? ""}`}
      title={`${label} (${cadence})`}
    >
      {/* pastille de fraîcheur : 2 clignotements quand c'est vraiment vieux */}
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          tooOld ? "animate-pulse bg-red-500" : fresh ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {label}
      <span className="opacity-70">· {cadence}</span>
    </span>
  );
}
