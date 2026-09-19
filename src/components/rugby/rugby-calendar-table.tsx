"use client";

/**
 * RugbyCalendarTable — Calendrier rugby style FotMob.
 * Même palette de couleurs, même grille 5 colonnes, mêmes filtres
 * que le calendrier football (FotmobCalendarTable).
 *
 * Données : /api/rugby/predictions?slug={slug} + /api/rugby/prod2/predictions
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { RugbyTopStratTag } from "@/lib/top10-rugby-calendar-link";

/* ─── Teintes FotMob clair (identiques au foot) ─── */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  rowSep: "#f5f5f5",
  headerBg: "#f5f5f5",
  headerText: "#000000",
  score: "#222222",
  team: "#222222",
  time: "#717171",
  live: "#00985f",
  reason: "#717171",
  pillBorder: "#f5f5f5",
  countGray: "#9e9e9e",
} as const;

/* ─── Compétitions rugby avec couleurs ─── */
const COMP_COLORS: Record<string, { color: string; icon: string; country: string }> = {
  "top-14": { color: "#003DA5", icon: "🏉", country: "France" },
  "pro-d2": { color: "#E63946", icon: "🏉", country: "France" },
  "six-nations": { color: "#006B3F", icon: "🏉", country: "Europe" },
  "premiership": { color: "#C8102E", icon: "🏉", country: "Angleterre" },
  "super-rugby-pacific": { color: "#1C1C1C", icon: "🏉", country: "Océanie" },
  "united-rugby-championship": { color: "#003DA5", icon: "🏉", country: "Europe & SA" },
  "champions-cup": { color: "#D4AF37", icon: "🏉", country: "Europe" },
  "rugby-championship": { color: "#2D5F2D", icon: "🏉", country: "Hémisphère Sud" },
  "currie-cup": { color: "#FFD700", icon: "🏉", country: "Afrique du Sud" },
  "npc": { color: "#000000", icon: "🏉", country: "Nouvelle-Zélande" },
  "major-league-rugby": { color: "#1E3A5F", icon: "🏉", country: "USA" },
  "international-tests": { color: "#8B0000", icon: "🌍", country: "International" },
};

/* ─── Helpers ─── */
function teamLogoUrl(name: string, logo?: string | null): string {
  if (logo && /^(https?:|data:|blob:)/i.test(logo)) return logo;
  return (
    "https://api.dicebear.com/9.x/initials/svg?seed=" +
    encodeURIComponent(name) +
    "&backgroundType=gradientLinear"
  );
}

function parisKickoff(iso: string): string {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  } catch {
    return "--:--";
  }
}

function parisDateShort(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      timeZone: "Europe/Paris",
    });
  } catch {
    return "";
  }
}

function isLive(status?: string): boolean {
  return status === "inprogress" || status === "in_progress";
}

function isFinished(status?: string): boolean {
  return status === "finished";
}

/* ─── Types ─── */
export interface RugbyCalMatch {
  id: string;
  scheduledAt: string;
  home: { name: string; logo?: string };
  away: { name: string; logo?: string };
  status: "scheduled" | "inprogress" | "finished";
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  competition: string;
  competitionName: string;
  probPct?: number;
  confLabel?: string;
  verdict?: string;
  expectedHomeScore?: number;
  expectedAwayScore?: number;
  expectedMargin?: number;
  mostLikelyScore?: string;
}

/* ─── Props ─── */
type RugbyCalendarTableProps = {
  matches: RugbyCalMatch[];
  loading?: boolean;
  onMatchClick?: (matchId: string) => void;
  /** Tags Top stratégies par id match (pill verte). */
  topTagsFor?: (id: string) => RugbyTopStratTag[];
};

/* ─── Composant principal ─── */
export function RugbyCalendarTable({ matches, loading, onMatchClick, topTagsFor }: RugbyCalendarTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Grouper par compétition
  const groups = useMemo(() => {
    const map = new Map<string, RugbyCalMatch[]>();
    for (const m of matches) {
      const key = m.competition;
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort((a, b) => {
        const aLive = a[1].filter((m) => isLive(m.status)).length;
        const bLive = b[1].filter((m) => isLive(m.status)).length;
        if (bLive !== aLive) return bLive - aLive;
        return a[0].localeCompare(b[0]);
      })
      .map(([comp, m]) => ({
        comp,
        name: m[0]?.competitionName ?? comp,
        matches: m.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
      }));
  }, [matches]);

  const toggleCollapse = (comp: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(comp)) next.delete(comp);
      else next.add(comp);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl"
            style={{ height: 120, backgroundColor: C.headerBg }}
          />
        ))}
      </div>
    );
  }

  if (!matches.length) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl p-10 text-center"
        style={{ backgroundColor: C.card, border: `1px solid ${C.cardBorder}` }}
      >
        <p className="text-3xl">🏉</p>
        <p className="mt-3 font-semibold" style={{ color: C.team }}>
          Aucun match disponible
        </p>
        <p className="mt-1 text-sm" style={{ color: C.time }}>
          Le calendrier de cette compétition n&apos;est pas encore publié.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.comp);
        const liveCount = g.matches.filter((m) => isLive(m.status)).length;
        const meta = COMP_COLORS[g.comp] ?? { color: "#333", icon: "🏉", country: "" };

        return (
          <div
            key={g.comp}
            className="overflow-hidden"
            style={{
              borderRadius: 16,
              border: `1px solid ${C.cardBorder}`,
              backgroundColor: C.card,
            }}
          >
            {/* En-tête compétition */}
            <button
              type="button"
              onClick={() => toggleCollapse(g.comp)}
              className="flex w-full items-center gap-3 px-4 text-left"
              style={{ height: 48, backgroundColor: C.headerBg }}
            >
              <span className="text-base">{meta.icon}</span>
              <span className="flex-1 truncate text-sm font-bold" style={{ color: C.headerText }}>
                {g.name}
              </span>
              {meta.country && (
                <span className="text-xs" style={{ color: C.time }}>
                  {meta.country}
                </span>
              )}
              {liveCount > 0 ? (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{ backgroundColor: C.live, color: "#ffffff" }}
                >
                  {liveCount} live
                </span>
              ) : (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
                  style={{ backgroundColor: C.countGray + "22", color: C.countGray }}
                >
                  {g.matches.length}
                </span>
              )}
              <FotmobChevron collapsed={isCollapsed} />
            </button>

            {/* Lignes de match */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: isCollapsed ? "0fr" : "1fr",
                transition: "grid-template-rows 300ms",
              }}
            >
              <div className="overflow-hidden">
                {g.matches.map((m, idx) => (
                  <RugbyMatchRow
                    key={m.id}
                    match={m}
                    isLast={idx === g.matches.length - 1}
                    onClick={() => onMatchClick?.(m.id)}
                    topTags={topTagsFor?.(m.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Pastille "Top Stratégie" (pill verte) : visible bureau + mobile ─── */
function TopStratPills({ tags, onSelect }: { tags: RugbyTopStratTag[]; onSelect?: () => void }) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, 2);
  const extra = tags.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 pb-1.5" style={{ backgroundColor: C.card }}>
      {shown.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          title={`Top 10 · ${t.label} · ${t.value}`}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-transform active:scale-95"
          style={{ backgroundColor: "#00985f", color: "#ffffff" }}
        >
          <span aria-hidden="true">{t.emoji}</span>
          <span>Top {t.label}</span>
          <span className="font-mono tabular-nums opacity-90">{t.value}</span>
        </button>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
          style={{ backgroundColor: "#00985f1a", color: "#007a4c" }}
          title={tags.slice(2).map((t) => `Top ${t.label} · ${t.value}`).join(" · ")}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

/* ─── Ligne de match (grille 5 colonnes FotMob) ─── */
function RugbyMatchRow({
  match: m,
  isLast,
  onClick,
  topTags,
}: {
  match: RugbyCalMatch;
  isLast: boolean;
  onClick?: () => void;
  topTags?: RugbyTopStratTag[];
}) {
  const live = isLive(m.status);
  const finished = isFinished(m.status);

  return (
    <div style={{ backgroundColor: live ? C.live + "08" : C.card, borderBottom: isLast ? "none" : `1px solid ${C.rowSep}` }}>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center text-left transition-colors hover:bg-black/[0.02]"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto 1fr auto",
        alignItems: "center",
        padding: "8px 12px",
        borderBottom: isLast ? "none" : `1px solid ${C.rowSep}`,
        backgroundColor: live ? C.live + "08" : "transparent",
      }}
    >
      {/* Col 1 : Équipe domicile */}
      <div className="flex items-center gap-2 justify-end min-w-0">
        <span className="truncate text-[13px] font-medium" style={{ color: C.team }}>
          {m.home.name}
        </span>
        <img
          src={teamLogoUrl(m.home.name, m.home.logo)}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          className="shrink-0 rounded-full"
          style={{ border: `1px solid ${C.cardBorder}` }}
        />
      </div>

      {/* Col 2 : Minute / statut */}
      <div className="flex w-7 items-center justify-center">
        {live && m.minute != null && (
          <span className="text-[11px] font-bold" style={{ color: C.live }}>
            {m.minute}&apos;
          </span>
        )}
        {finished && (
          <span className="text-[10px] font-medium" style={{ color: C.reason }}>
            FT
          </span>
        )}
      </div>

      {/* Col 3 : Score / heure + date */}
      <div className="flex w-20 flex-col items-center justify-center">
        {live || finished ? (
          <>
            <span className="text-[14px] font-medium tabular-nums" style={{ color: C.score }}>
              {m.homeScore ?? 0} - {m.awayScore ?? 0}
            </span>
            {live && m.minute != null && (
              <span className="text-[10px] font-bold" style={{ color: C.live }}>
                {m.minute}&apos;
              </span>
            )}
            {finished && (
              <span className="text-[10px] font-medium" style={{ color: C.reason }}>
                Terminé
              </span>
            )}
          </>
        ) : (
          <>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: C.score }}>
              {parisKickoff(m.scheduledAt)}
            </span>
            <span className="text-[10px] font-medium" style={{ color: C.time }}>
              {parisDateShort(m.scheduledAt)}
            </span>
          </>
        )}
      </div>

      {/* Col 4 : Équipe extérieur */}
      <div className="flex items-center gap-2 min-w-0">
        <img
          src={teamLogoUrl(m.away.name, m.away.logo)}
          alt=""
          width={22}
          height={22}
          loading="lazy"
          className="shrink-0 rounded-full"
          style={{ border: `1px solid ${C.cardBorder}` }}
        />
        <span className="truncate text-[13px] font-medium" style={{ color: C.team }}>
          {m.away.name}
        </span>
      </div>

      {/* Col 5 : Probabilité de victoire */}
      <div className="flex w-16 items-center justify-end">
        {m.probPct != null && (
          <div className="flex flex-col items-center">
            <span
              className="text-[12px] font-bold tabular-nums"
              style={{ color: m.probPct >= 65 ? C.live : C.time }}
            >
              {m.probPct}%
            </span>
            {m.confLabel && (
              <span className="text-[9px] font-medium" style={{ color: C.countGray }}>
                {m.confLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
    {/* Pills Top stratégies */}
    <TopStratPills tags={topTags ?? []} onSelect={onClick} />
    </div>
  );
}

/* ─── Chevron repli (triangle FotMob) ─── */
function FotmobChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn(
        "size-5 shrink-0 transition-transform duration-300 motion-reduce:transition-none",
        !collapsed && "rotate-180"
      )}
    >
      <path
        d="M5.596 11.053l3.449-3.453c.123-.124.27-.222.431-.289a1.6 1.6 0 0 1 1.018 0c.162.067.308.165.431.289l3.453 3.453c.186.188.313.425.364.684.051.26.024.528-.077.772-.101.244-.273.452-.492.599-.22.147-.478.225-.742.225H6.525c-.27-.002-.526-.082-.744-.23-.218-.147-.387-.357-.486-.6-.1-.244-.124-.512-.072-.77.052-.258.18-.495.373-.68Z"
        fill="currentColor"
        style={{ color: C.time }}
      />
    </svg>
  );
}
