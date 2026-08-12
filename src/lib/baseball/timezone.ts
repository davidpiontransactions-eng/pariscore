/**
 * Conversion horaire — affichage 24h local Paris (CEST/CET selon DST).
 * Les heures MLB (nuit) et KBO (matin/début d'après-midi) sont converties
 * depuis les timestamps UTC fournis par les sources.
 */

export const PARIS_TIME_ZONE = "Europe/Paris";

const parisTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const parisTimeWithZone = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

const parisDate = new Intl.DateTimeFormat("fr-CA", {
  timeZone: PARIS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const parisWeekday = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "14:05" (24h, Paris). */
export function formatParisTime(isoUtc: string): string {
  return parisTime.format(new Date(isoUtc));
}

/** "14:05 CEST" (abréviation de fuseau détectée automatiquement). */
export function formatParisTimeWithZone(isoUtc: string): string {
  const parts = parisTimeWithZone.formatToParts(new Date(isoUtc));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "--";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "--";
  const zone = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  return `${hour}:${minute} ${zone.replace("UTC+", "").replace("heure ", "")}`;
}

/** "2026-08-12" (date locale Paris). */
export function parisDateString(isoUtc: string): string {
  return parisDate.format(new Date(isoUtc));
}

/** "mar. 12 août" (label jour, Paris). */
export function parisWeekdayLabel(isoUtc: string): string {
  return parisWeekday.format(new Date(isoUtc));
}

/** Date du jour côté client au format YYYY-MM-DD (Paris). */
export function todayParisIso(): string {
  return parisDateString(new Date().toISOString());
}

/** Déplace une date YYYY-MM-DD de `delta` jours (calcul UTC sans dérive DST). */
export function shiftIsoDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map((v) => parseInt(v, 10));
  const shifted = new Date(Date.UTC(y, m - 1, d + delta));
  return shifted.toISOString().slice(0, 10);
}

/** "aujourd'hui" | "demain" | "hier" | "mar. 12 août" selon l'écart. */
export function dayLabel(iso: string): string {
  const today = todayParisIso();
  if (iso === today) return "Aujourd'hui";
  if (iso === shiftIsoDate(today, 1)) return "Demain";
  if (iso === shiftIsoDate(today, -1)) return "Hier";
  return parisWeekdayLabel(new Date(`${iso}T12:00:00Z`).toISOString());
}
