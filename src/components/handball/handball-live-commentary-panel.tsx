"use client";

import useSWR from "swr";
import {
  buildCommentary,
  intensityGauge,
  readStat,
  type LiveFeed,
} from "@/lib/handball-live-commentary";

// Suivi live commenté (bead xx78) — section du popup détail si match en direct.
// Source : /api/handball/live-detail (API-Sports events/stats/players).
// Sans source → « détail indisponible » (JAMAIS d'événements fabricés).
// Refresh 30 s (aligné cache route).

type DetailPayload = {
  available: boolean;
  fixtureId?: number;
  events?: LiveFeed["events"];
  homeStats?: LiveFeed["homeStats"];
  awayStats?: LiveFeed["awayStats"];
  homeScorers?: { name: string; goals: number }[];
  awayScorers?: { name: string; goals: number }[];
  updatedAt?: string;
};

const fetcher = async (url: string): Promise<DetailPayload> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

/** Lecture stats par candidats API-Sports handball (valeurs absentes = « — »). */
const SAVE_KEYS = ["Goalkeeper Saves", "Saves", "Goalkeeper saves"];
const TO_KEYS = ["Turnovers", "Lost Balls", "Ball Lost"];
const FOUL_KEYS = ["Fouls", "Total Fouls"];

function StatRow({
  label,
  home,
  away,
}: {
  label: string;
  home: number | null;
  away: number | null;
}) {
  const fmt = (v: number | null) => (v == null ? "—" : String(v));
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="w-8 text-right font-mono tabular-nums text-emerald-600">{fmt(home)}</span>
      <span className="flex-1 text-center text-[#717171]">{label}</span>
      <span className="w-8 font-mono tabular-nums text-sky-600">{fmt(away)}</span>
    </div>
  );
}

export function HandballLiveCommentaryPanel({
  fixtureId,
  homeName,
  awayName,
  minute,
}: {
  fixtureId: number;
  homeName: string;
  awayName: string;
  minute?: number;
}) {
  const { data } = useSWR<DetailPayload>(
    `/api/handball/live-detail?fixture=${fixtureId}`,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false, dedupingInterval: 15_000 },
  );

  if (!data?.available) {
    return (
      <p className="rounded border border-[#f0f0f0] bg-white px-2.5 py-2 text-[11px] text-[#717171]">
        Détail live indisponible (source événements injoignable) — score seul.
      </p>
    );
  }

  const events = data.events ?? [];
  const feed: LiveFeed = {
    events,
    homeStats: data.homeStats ?? [],
    awayStats: data.awayStats ?? [],
    homeScorers: data.homeScorers ?? [],
    awayScorers: data.awayScorers ?? [],
  };
  const lines = buildCommentary(feed, homeName, awayName);
  const gauge = intensityGauge(feed);

  return (
    <section className="space-y-2 rounded border border-[#f0f0f0] bg-white p-3 text-[#222222]">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#222222]">
          🎙️ Suivi live commenté
        </h4>
        <span className="text-[10px] tabular-nums text-[#717171]">
          {minute != null ? `${minute}'` : ""} · maj{" "}
          {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"}
        </span>
      </div>

      {/* Jauge d'intensité par équipe */}
      <div>
        <div className="flex justify-between text-[10px] font-semibold text-[#717171]">
          <span>Intensité {homeName}</span>
          <span className="tabular-nums">{gauge}/100</span>
        </div>
        <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-[#f5f5f5]">
          <div className="h-full rounded-full bg-[#00985f] transition-all" style={{ width: `${gauge}%` }} />
        </div>
      </div>

      {/* Chronologie commentée */}
      {lines.length > 0 ? (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto overscroll-contain text-[11px]">
          {[...lines].reverse().map((l, i) => (
            <li key={`${i}-${l}`} className="rounded px-1.5 py-0.5 odd:bg-[#fafafa]">
              {l}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[#717171]">Aucun événement reçu pour l'instant.</p>
      )}

      {/* Stats équipes (clés absentes → « — ») */}
      <div className="space-y-0.5 border-t border-[#f0f0f0] pt-1.5">
        <StatRow label="Arrêts gardiens" home={readStat(feed.homeStats, SAVE_KEYS)} away={readStat(feed.awayStats, SAVE_KEYS)} />
        <StatRow label="Balles perdues" home={readStat(feed.homeStats, TO_KEYS)} away={readStat(feed.awayStats, TO_KEYS)} />
        <StatRow label="Fautes" home={readStat(feed.homeStats, FOUL_KEYS)} away={readStat(feed.awayStats, FOUL_KEYS)} />
        <StatRow
          label="Suspensions 2'"
          home={events.filter((e) => e.team === "home" && e.type === "Card").length}
          away={events.filter((e) => e.team === "away" && e.type === "Card").length}
        />
      </div>

      {/* Meilleurs buteurs du match */}
      {(feed.homeScorers.length > 0 || feed.awayScorers.length > 0) && (
        <div className="grid grid-cols-2 gap-2 border-t border-[#f0f0f0] pt-1.5 text-[11px]">
          <ul className="space-y-0.5">
            {feed.homeScorers.slice(0, 3).map((s) => (
              <li key={s.name} className="flex justify-between gap-1">
                <span className="truncate">{s.name}</span>
                <span className="font-mono font-semibold tabular-nums text-emerald-600">{s.goals}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-0.5">
            {feed.awayScorers.slice(0, 3).map((s) => (
              <li key={s.name} className="flex justify-between gap-1">
                <span className="truncate">{s.name}</span>
                <span className="font-mono font-semibold tabular-nums text-sky-600">{s.goals}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
