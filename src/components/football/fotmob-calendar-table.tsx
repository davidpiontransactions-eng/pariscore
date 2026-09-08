"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useFollowStore } from "@/stores/use-follow-store";
import { partitionFollowed, toFollowId } from "@/lib/fotmob-follow";
import { countryFlag } from "@/lib/bsd-football-fetcher";
import { parisKickoff } from "@/lib/football-time";
import { cn } from "@/lib/utils";

/* ─── Types (miroir API /api/football/calendar) ─── */
export type FotmobCalTeam = { name: string; logo?: string | null };
export type FotmobCalLive = {
  status: string; minute?: number | null; homeScore?: number | null; awayScore?: number | null;
};
export type FotmobCalMatch = {
  id: string;
  scheduledAt: string;
  home: FotmobCalTeam;
  away: FotmobCalTeam;
  league?: { name?: string; country?: string | null; logo?: string | null } | null;
  round?: string | null;
  live?: FotmobCalLive | null;
};

/* ─── Teintes FotMob clair (mesurées getComputedStyle, cf. T1) ─── */
const C = {
  card: "#ffffff", cardBorder: "#f0f0f0", rowSep: "#f5f5f5",
  headerBg: "#f5f5f5", headerText: "#000000",
  score: "#222222", team: "#222222", time: "#717171",
  live: "#00985f", reason: "#717171",
  followBg: "#f0f0f0", starOff: "#222222", starOn: "#00985f",
  pillBorder: "#f5f5f5", countGray: "#9e9e9e",
} as const;

function teamLogo(name: string, logo?: string | null): string {
  if (logo) return logo;
  return (
    "https://api.dicebear.com/9.x/initials/svg?seed=" +
    encodeURIComponent(name) +
    "&backgroundType=gradientLinear"
  );
}

function isLiveStatus(s?: string | null): boolean {
  return s === "LIVE" || s === "HT";
}

/* ─── Étoile Suivre (SVG FotMob 28×16, câblée au useFollowStore) ─── */
function FotmobFollowStar({ id, name }: { id: string; name: string }) {
  // Lecture bi-forme (ids bruts legacy + conventionnels), écriture conventionnelle.
  const convId = toFollowId(id);
  const isFollowed = useFollowStore((s) => s.isFollowed(convId) || s.isFollowed(id));
  const toggle = useFollowStore((s) => s.toggle);
  return (
    <button
      type="button"
      title="Suivre"
      aria-label={isFollowed ? `Ne plus suivre ${name}` : `Suivre ${name}`}
      aria-pressed={isFollowed}
      onClick={(e) => {
        e.stopPropagation();
        toggle({ id: convId, category: "match", name, sport: "football", notifications: true });
      }}
      className="shrink-0 rounded-full transition-transform active:scale-95"
      style={{ backgroundColor: C.followBg }}
    >
      <svg width="28" height="16" viewBox="0 0 28 16" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="27" height="15" rx="7.5" stroke={C.starOff} strokeOpacity="0.35" />
        <rect x="1.5" y="1.5" width="25" height="13" rx="7.5" fill={C.followBg} />
        <path
          d="M14.0019 10.9568 16.4259 12.415c.098.059.212.088.327.084.115-.004.226-.042.319-.11.093-.067.164-.16.204-.267.04-.107.047-.224.021-.335l-.643-2.741 2.144-1.847c.087-.075.15-.173.181-.283.031-.11.028-.227-.007-.336-.036-.108-.103-.204-.193-.275-.09-.071-.16-.114-.275-.123l-2.821-.238-1.105-2.592c-.045-.105-.12-.194-.215-.257-.095-.063-.207-.096-.322-.096s-.227.033-.322.096c-.095.063-.17.152-.215.257l-1.104 2.585-2.822.238c-.115.008-.226.05-.316.121-.09.07-.158.166-.194.275-.036.109-.038.226-.007.336.031.11.094.209.181.284l2.144 1.847-.642 2.742c-.026.111-.019.228.021.335.04.107.111.2.204.267.093.067.204.105.319.11.115.004.229-.026.327-.085l2.426-1.452Z"
          fill={isFollowed ? C.starOn : C.starOff}
        />
      </svg>
    </button>
  );
}

/* ─── Chevron repli (triangle FotMob) ─── */
function FotmobChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"
      className={cn("size-5 shrink-0 transition-transform duration-300 motion-reduce:transition-none", !collapsed && "rotate-180")}
    >
      <path
        d="M5.596 11.053l3.449-3.453c.123-.124.27-.222.431-.289a1.6 1.6 0 0 1 1.018 0c.162.067.308.165.431.289l3.453 3.453c.186.188.313.425.364.684.051.26.024.528-.077.772-.101.244-.273.452-.492.599-.22.147-.478.225-.742.225H6.525c-.27-.002-.526-.082-.744-.23-.218-.147-.387-.357-.486-.6-.1-.244-.124-.512-.072-.77.052-.258.18-.495.373-.68Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ─── Ligne match (clic → analyse, étoile isolée via stopPropagation) ─── */
function FotmobMatchRow({ m, onSelect }: { m: FotmobCalMatch; onSelect?: (m: FotmobCalMatch) => void }) {
  const st = m.live?.status ?? null;
  const live = isLiveStatus(st);
  const finished = st === "FT";
  const showScore = (live || finished) && m.live?.homeScore != null && m.live?.awayScore != null;
  const label = `${m.home.name} - ${m.away.name}`;
  return (
    <div
      data-testid="livescores-match"
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? label : undefined}
      onClick={onSelect ? () => onSelect(m) : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(m); } } : undefined}
      className="grid items-center gap-1 px-3 py-1.5 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00985f]"
      style={{
        gridTemplateColumns: "1fr auto auto 1fr auto",
        backgroundColor: C.card,
        borderBottom: `1px solid ${C.rowSep}`,
      }}
    >
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <span className="truncate text-right text-[14px]" style={{ color: C.team }}>{m.home.name}</span>
        <img src={teamLogo(m.home.name, m.home.logo)} alt="" width="22" height="22" loading="lazy" className="size-[22px] shrink-0" />
      </div>
      <span
        className="w-7 shrink-0 text-center text-[12px] font-medium tabular-nums"
        style={{ color: live ? C.live : C.reason }}
        title={finished ? "Fin du match" : undefined}
      >
        {live && m.live?.minute != null ? `${m.live.minute}` : finished ? "FM" : ""}
      </span>
      <div className="flex w-14 shrink-0 flex-col items-center tabular-nums">
        {showScore ? (
          <>
            <span data-testid="status-score" className="text-[14px] font-medium" style={{ color: C.score }}>
              {m.live!.homeScore} - {m.live!.awayScore}
            </span>
            {live && m.live?.minute != null ? (
              <span data-testid="status-live" className="text-[12px] font-medium" style={{ color: C.live }}>
                {m.live.minute}’
              </span>
            ) : finished ? (
              <span data-testid="status-reason" className="text-[12px]" style={{ color: C.reason }}>FM</span>
            ) : null}
          </>
        ) : (
          <span data-testid="status-time" className="text-[14px] font-medium" style={{ color: C.time }}>
            {parisKickoff(m.scheduledAt)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <img src={teamLogo(m.away.name, m.away.logo)} alt="" width="22" height="22" loading="lazy" className="size-[22px] shrink-0" />
        <span className="truncate text-[14px]" style={{ color: C.team }}>{m.away.name}</span>
      </div>
      <FotmobFollowStar id={m.id} name={label} />
    </div>
  );
}

/* ─── Section ligue ─── */
function FotmobLeagueSection({
  leagueName, country, logo, icon, matches, collapsed, onToggle, onSelectMatch,
}: {
  leagueName: string; country?: string | null; logo?: string | null;
  /** Icône custom à la place du logo (ex. étoile de la section « Suivis »). */
  icon?: ReactNode;
  matches: FotmobCalMatch[]; collapsed: boolean; onToggle: () => void;
  onSelectMatch?: (m: FotmobCalMatch) => void;
}) {
  const liveCount = matches.filter((m) => isLiveStatus(m.live?.status)).length;
  return (
    <div
      data-testid="livescores-league"
      className="overflow-hidden"
      style={{ backgroundColor: C.card, borderRadius: 16, border: `1px solid ${C.cardBorder}` }}
    >
      <div className="flex h-12 items-center justify-between overflow-hidden" style={{ backgroundColor: C.headerBg }}>
        <div className="flex h-full min-w-0 flex-1 items-center gap-3 px-4">
          {icon ?? (logo ? (
            <img src={logo} alt="" width="20" height="20" loading="lazy" className="size-5 shrink-0" />
          ) : (
            <span className="text-lg leading-none">{country ? countryFlag(country) : "🏆"}</span>
          ))}
          <span className="truncate text-[14px] font-medium" style={{ color: C.headerText }}>
            {country ? `${country} - ${leagueName}` : leagueName}
          </span>
        </div>
        <button
          type="button" onClick={onToggle}
          aria-expanded={!collapsed} aria-label={collapsed ? "Déployer" : "Réduire"}
          className="flex h-full shrink-0 items-center gap-0 px-3 transition-colors hover:bg-black/5 motion-reduce:transition-none"
          style={{ color: C.time }}
        >
          <span
            className="flex min-w-5 items-center justify-center rounded-xl px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
            style={{ backgroundColor: liveCount > 0 ? C.live : C.countGray, color: "#ffffff" }}
          >
            {liveCount > 0 ? `${liveCount}/${matches.length}` : matches.length}
          </span>
          <FotmobChevron collapsed={collapsed} />
        </button>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] ease-out motion-reduce:transition-none",
          collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
        style={{ transitionDuration: "300ms" }}
      >
        <div className="min-h-0 overflow-hidden">
          {matches.map((m) => <FotmobMatchRow key={m.id} m={m} onSelect={onSelectMatch} />)}
        </div>
      </div>
    </div>
  );
}

/* ─── Étoile 24px du header « Suivis » (sample FotMob) ─── */
function FotmobStarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4 shrink-0 fill-current">
      <path d="M12.004 17.914l4.848 2.916c.196.12.423.179.501.17.23-.01.453-.086.639-.22.186-.134.328-.32.408-.534.08-.215.095-.448.042-.67l-1.285-5.483 4.287-3.694c.174-.15.3-.347.361-.567.062-.22.057-.453-.014-.67-.071-.217-.205-.408-.385-.55-.18-.142-.398-.227-.627-.246l-5.643-.476-2.209-5.184a1.06 1.06 0 0 0-.43-.514 1.062 1.062 0 0 0-1.288 0c-.191.126-.341.305-.431.514l-3.284 5.17-5.644.476c-.23.017-.45.09-.631.231-.181.142-.316.333-.388.551-.071.217-.077.451-.015.672.062.22.19.417.364.566l4.289 3.682-1.285 5.483c-.053.222-.039.455.042.67.08.214.222.4.408.534.186.134.408.21.638.219.23.01.451-.05.647-.169l4.853-2.904Z" />
    </svg>
  );
}

/* ─── Tableau (Suivis épinglés + tri live d'abord, repli global) ─── */
export function FotmobCalendarTable({
  matches,
  onSelectMatch,
}: {
  matches: FotmobCalMatch[];
  onSelectMatch?: (m: FotmobCalMatch) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const follows = useFollowStore((s) => s.follows);
  const followedIds = useMemo(
    () => Object.values(follows).filter((e) => e.category === "match").map((e) => e.id),
    [follows]
  );
  const { followed, rest } = useMemo(
    () => partitionFollowed(matches, followedIds),
    [matches, followedIds]
  );
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; country?: string | null; logo?: string | null; list: FotmobCalMatch[] }>();
    for (const m of rest) {
      const key = m.league?.name ?? "Autres";
      const g = map.get(key) ?? { name: key, country: m.league?.country, logo: m.league?.logo, list: [] };
      g.list.push(m);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => {
      const al = a.list.filter((m) => isLiveStatus(m.live?.status)).length;
      const bl = b.list.filter((m) => isLiveStatus(m.live?.status)).length;
      if (al !== bl) return bl - al;
      return a.name.localeCompare(b.name);
    });
  }, [rest]);

  const sectionKeys = [
    ...(followed.length > 0 ? ["__suivis"] : []),
    ...groups.map((g) => g.name),
  ];
  const allCollapsed = sectionKeys.length > 0 && sectionKeys.every((k) => collapsed[k] === true);

  if (sectionKeys.length === 0) {
    return (
      <div className="py-10 text-center text-sm" style={{ color: C.time }}>
        Aucun match pour cette journée.
      </div>
    );
  }
  return (
    <div className="w-full">
      <div className="mb-2 flex justify-end">
        <button
          type="button" aria-expanded={!allCollapsed}
          onClick={() => setCollapsed(allCollapsed ? {} : Object.fromEntries(sectionKeys.map((k) => [k, true])))}
          className="text-xs font-medium underline underline-offset-2"
          style={{ color: C.time }}
        >
          {allCollapsed ? "Tout afficher" : "Tout masquer"}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {followed.length > 0 && (
          <FotmobLeagueSection
            key="__suivis"
            leagueName="Suivis"
            icon={<FotmobStarIcon />}
            matches={followed}
            collapsed={collapsed.__suivis === true}
            onToggle={() => setCollapsed((p) => ({ ...p, __suivis: !(p.__suivis === true) }))}
            onSelectMatch={onSelectMatch}
          />
        )}
        {groups.map((g) => (
          <FotmobLeagueSection
            key={g.name}
            leagueName={g.name} country={g.country} logo={g.logo}
            matches={g.list}
            collapsed={collapsed[g.name] === true}
            onToggle={() => setCollapsed((p) => ({ ...p, [g.name]: !(p[g.name] === true) }))}
            onSelectMatch={onSelectMatch}
          />
        ))}
      </div>
    </div>
  );
}
