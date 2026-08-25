// Horaires de coup d'envoi exprimés en heure française (Europe/Paris),
// indépendamment du fuseau horaire du navigateur.

const PARIS_TZ = "Europe/Paris";

const parisFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayKeyFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const shortDayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const longDayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  weekday: "long",
  day: "numeric",
  month: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  day: "2-digit",
  month: "2-digit",
});

function parisDayKey(d: Date): string {
  return dayKeyFormatter.format(d);
}

/** HH:MM — heure de Paris (jamais l'heure du navigateur). */
export function parisKickoff(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return parisFormatter.format(d);
}

/** JJ/MM — date de Paris (jamais le fuseau du navigateur). */
export function parisDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return shortDateFormatter.format(d);
}

/** "Aujourd'hui" / "Demain" / "jeu. 20 août" — jour calculé dans le fuseau Paris. */
export function parisDayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = parisDayKey(new Date());
  const tomorrow = parisDayKey(new Date(Date.now() + 24 * 3_600_000));
  const match = parisDayKey(d);
  if (match === today) return "Aujourd'hui";
  if (match === tomorrow) return "Demain";
  return shortDayFormatter.format(d);
}

/** Libellé long du jour (en-têtes de groupes de matchs). */
export function parisDayLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return longDayFormatter.format(d);
}