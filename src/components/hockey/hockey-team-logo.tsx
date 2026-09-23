"use client";

/**
 * HockeyTeamLogo — Photo/logo réel d'équipe + fallback initiales.
 * Sources : CDN oddspedia (Magnus), frozenpool (NHL par abréviation).
 * Illustration fallback = disque rondelle SVG authored (pas d'emoji).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

// Magnus — ids réels oddspedia (scraping 2026-09-23)
const MAGNUS_LOGOS: Record<string, number> = {
  "aigles de nice": 36518, "nice": 36518,
  "hc briancon": 23012, "briancon": 23012, "briançon": 23012,
  "dragons de rouen": 23017, "rouen": 23017,
  "rapaces de gap": 22897, "gap": 22897,
  "pionniers de chamonix mont-blanc": 23014, "chamonix": 23014, "pionniers de chamonix": 23014,
  "hc cergy-pontoise": 88603, "cergy-pontoise": 88603, "cergy": 88603,
  "boxers de bordeaux": 23009, "bordeaux": 23009,
  "marseille": 90040, "hdj marseille": 90040,
  "brûleurs de loups de grenoble": 22899, "grenoble": 22899,
  "hc amiens": 23004, "amiens": 23004,
  "ducs d'angers": 23018, "angers": 23018,
  "anglet hormadi": 68315, "anglet": 68315,
};

// NHL — noms → abbr (logos SVGZ frozenpool)
const NHL_ABBR: Record<string, string> = {
  "anaheim ducks": "ANA", "anaheim": "ANA", "boston bruins": "BOS", "buffalo sabres": "BUF",
  "calgary flames": "CGY", "carolina hurricanes": "CAR", "chicago blackhawks": "CHI",
  "colorado avalanche": "COL", "columbus blue jackets": "CBJ", "dallas stars": "DAL",
  "detroit red wings": "DET", "edmonton oilers": "EDM", "florida panthers": "FLA",
  "los angeles kings": "L.A", "la kings": "L.A", "minnesota wild": "MIN",
  "montreal canadiens": "MTL", "montréal": "MTL", "nashville predators": "NSH",
  "new jersey devils": "N.J", "new york islanders": "NYI", "new york rangers": "NYR",
  "ottawa senators": "OTT", "philadelphia flyers": "PHI", "pittsburgh penguins": "PIT",
  "san jose sharks": "S.J", "seattle kraken": "SEA", "st louis blues": "STL",
  "st. louis blues": "STL", "tampa bay lightning": "T.B", "toronto maple leafs": "TOR",
  "toronto": "TOR", "utah mammoth": "UTA", "utah": "UTA", "vancouver canucks": "VAN",
  "vegas golden knights": "VGK", "washington capitals": "WSH", "winnipeg jets": "WPG",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, "");

// Maps pré-normalisées (évite le scan regex par logo rendu)
const MAGNUS_NORM = Object.fromEntries(Object.entries(MAGNUS_LOGOS).map(([k, v]) => [norm(k), v]));
const NHL_NORM = Object.fromEntries(Object.entries(NHL_ABBR).map(([k, v]) => [norm(k), v]));

export function teamLogoUrl(teamName: string): string | null {
  const n = norm(teamName);
  for (const [key, id] of Object.entries(MAGNUS_NORM)) {
    if (n.includes(key)) return `https://cdn.oddspedia.com/images/teams/small/2/${id}.png`;
  }
  for (const [key, abbr] of Object.entries(NHL_NORM)) {
    if (n.includes(key)) return `https://frozenpool.dobbersports.com/images/logos/${abbr}_logo.svgz`;
  }
  return null;
}

export function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** Rondelle SVG — illustration fallback (authored, pas d'emoji). */
export function PuckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-full w-full", className)} aria-hidden>
      <ellipse cx="16" cy="18" rx="13" ry="7" fill="#222222" />
      <ellipse cx="16" cy="15.5" rx="13" ry="7" fill="#3a3a3a" />
      <ellipse cx="16" cy="15.5" rx="8" ry="4" fill="#2a2a2a" />
      <path d="M4 15.5c0 1.2 5.4 2.2 12 2.2s12-1 12-2.2" stroke="#555" strokeWidth="0.7" fill="none" />
    </svg>
  );
}

export function HockeyTeamLogo({
  name,
  size = 24,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = teamLogoUrl(name);

  if (!url || failed) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
          "bg-[#f0f0f0] text-[10px] font-bold text-[#717171]",
          className,
        )}
        style={{ width: size, height: size }}
        title={name}
      >
        {teamInitials(name) || <PuckMark className="h-3/5 w-3/5" />}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Logo ligue — photo réelle si dispo, sinon disque teinté + code. */
export function HockeyLeagueMark({
  league,
  size = 20,
}: {
  league: "nhl" | "khl" | "magnus";
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  // Logos officiels hébergés liguemagnus (photo réelle Magnus) ; NHL/KHL = disque teinté
  const src =
    league === "magnus"
      ? "https://liguemagnus.com/wp-content/uploads/sites/2/2020/03/cropped-SynerglaceLigueMagnus2019_Vertical-1-267x300.png"
      : null;
  const tint = league === "nhl" ? "#0c1220" : league === "khl" ? "#c8102e" : "#1a3a6b";

  if (src && !failed) {
    return (
      <img
        src={src}
        alt="Ligue Magnus"
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 rounded object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
      style={{ width: size, height: size, backgroundColor: tint }}
      title={league.toUpperCase()}
    >
      <PuckMark className="h-1/2 w-1/2" />
    </span>
  );
}
