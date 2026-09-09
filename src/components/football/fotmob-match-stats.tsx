"use client";

import type { FootballMatch } from "@/lib/football-data";
import { parisKickoff } from "@/lib/football-time";

/* ─── Encarts façon FotMob : Meilleures statistiques + infos stade ───
   Carte blanche (page FotMob), texte #222/#717171.
   Live : possession, xG, tirs + barres (tirs cadrés, corners, fautes).
   Prematch : xG (xGa) + buts marqués/encaissés pg. Ligne omise si vide. */

const INK = "#222222";
const MUTED = "#717171";
const HOME_BAR = "#1a1a1a";
const AWAY_BAR = "#bdbdbd";

type StatRow = { label: string; home: string; away: string; hpct: number | null };

function pct(home: number, away: number): number | null {
  const t = home + away;
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.round((home / t) * 100);
}

function fmt(v: number | null | undefined, digits = 0): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return digits > 0 ? v.toFixed(digits) : String(Math.round(v));
}

/** Formatte un MetricValue ({value}) — null si absent. */
function fmtMv(v: { value: number | null } | undefined, digits = 2): string | null {
  return fmt(v?.value ?? null, digits);
}

function buildRows(m: FootballMatch): StatRow[] {
  const rows: StatRow[] = [];
  const live = m.live ?? null;
  const push = (label: string, h: string | null, a: string | null, hp: number | null) => {
    if (h == null || a == null) return;
    rows.push({ label, home: h, away: a, hpct: hp });
  };
  if (live) {
    const poss = Math.max(0, Math.min(100, Math.round(live.homePossession)));
    push("Possession de balle", `${poss}%`, `${100 - poss}%`, poss);
    const xgH = fmt(live.homeXg, 2);
    const xgA = fmt(live.awayXg, 2);
    push("Buts attendus (xG)", xgH, xgA,
      live.homeXg != null && live.awayXg != null ? pct(live.homeXg, live.awayXg) : null);
    const sH = fmt(live.homeShots);
    const sA = fmt(live.awayShots);
    push("Nombre de tirs", sH, sA,
      live.homeShots != null && live.awayShots != null ? pct(live.homeShots, live.awayShots) : null);
    const stH = fmt(live.homeShotsOnTarget);
    const stA = fmt(live.awayShotsOnTarget);
    push("Tirs cadrés", stH, stA,
      live.homeShotsOnTarget != null && live.awayShotsOnTarget != null
        ? pct(live.homeShotsOnTarget, live.awayShotsOnTarget) : null);
    const cH = fmt(live.homeCorners);
    const cA = fmt(live.awayCorners);
    push("Corners", cH, cA,
      live.homeCorners != null && live.awayCorners != null ? pct(live.homeCorners, live.awayCorners) : null);
    const fH = fmt(live.homeFouls);
    const fA = fmt(live.awayFouls);
    push("Fautes", fH, fA,
      live.homeFouls != null && live.awayFouls != null ? pct(live.homeFouls, live.awayFouls) : null);
  } else {
    const xga = m.prediction.xGa;
    if (xga && xga.total > 0) {
      push("Buts attendus (xG)", xga.home.toFixed(2), xga.away.toFixed(2), pct(xga.home, xga.away));
    }
    const gh = m.prediction.metricStats?.home.goals;
    const ga = m.prediction.metricStats?.away.goals;
    if (gh && ga) {
      const sH = fmtMv(gh.scoredPg);
      const sA = fmtMv(ga.scoredPg);
      if (sH && sA) push("Buts marqués / match", sH, sA, null);
      const cH = fmtMv(gh.concededPg);
      const cA = fmtMv(ga.concededPg);
      if (cH && cA) push("Buts encaissés / match", cH, cA, null);
    }
  }
  return rows;
}

export function FotmobMatchStats({ match }: { match: FootballMatch }) {
  const rows = buildRows(match);
  const venue = match.venue;
  if (rows.length === 0 && !venue) return null;
  return (
    <div
      className="w-full rounded-2xl border p-4"
      style={{ backgroundColor: "#ffffff", borderColor: "#f0f0f0" }}
    >
      {rows.length > 0 && (
        <>
          <h3 className="mb-3 text-sm font-bold" style={{ color: INK }}>
            Meilleures statistiques
          </h3>
          <div className="flex flex-col gap-2.5">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm tabular-nums">
                  <span className="text-right font-semibold" style={{ color: INK }}>{r.home}</span>
                  <span className="text-center text-xs" style={{ color: MUTED }}>{r.label}</span>
                  <span className="font-semibold" style={{ color: INK }}>{r.away}</span>
                </div>
                {r.hpct != null && (
                  <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#f0f0f0" }} aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${r.hpct}%`, backgroundColor: HOME_BAR }} />
                    <div className="h-full flex-1" style={{ backgroundColor: AWAY_BAR, opacity: 0.55 }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {venue && (
        <div className="mt-3 border-t pt-3 text-xs" style={{ borderColor: "#f0f0f0", color: MUTED }}>
          <span className="font-semibold" style={{ color: INK }}>{venue.name}</span>
          {[venue.city, venue.country].filter(Boolean).join(", ") ? ` · ${[venue.city, venue.country].filter(Boolean).join(", ")}` : ""}
          {` · Coup d'envoi ${parisKickoff(match.scheduledAt)}`}
        </div>
      )}
    </div>
  );
}
