/* Helpers purs de la barre filtre FotMob (datepicker + fenêtre horaire). */

const parisDayFmt = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Clé jour Paris `YYYY-MM-DD` (défaut : maintenant). */
export function parisTodayKey(from: Date = new Date()): string {
  return parisDayFmt.format(from);
}

/** Décale une clé jour de `deltaDays` (négatif = hier). */
export function shiftDateKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + deltaDays * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Libellé datepicker : Aujourd'hui / Demain / date courte. */
export function matchDayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return "Aujourd’hui";
  if (key === shiftDateKey(todayKey, 1)) return "Demain";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

type Dated = { scheduledAt: string; live?: { status?: string | null } | null };

function isLiveStatus(s?: string | null): boolean {
  return s === "LIVE" || s === "HT";
}

/**
 * Filtre prematch par fenêtre de coup d'envoi (heures à venir).
 * `null` = tout. Les matchs live sont toujours gardés.
 */
export function filterByKickoffWindow<T extends Dated>(
  matches: T[],
  hours: number | null,
  now: Date = new Date(),
): T[] {
  if (hours == null) return matches;
  const from = now.getTime();
  const to = from + hours * 3_600_000;
  return matches.filter((m) => {
    if (isLiveStatus(m.live?.status)) return true;
    const ts = new Date(m.scheduledAt).getTime();
    return Number.isFinite(ts) && ts >= from && ts <= to;
  });
}
