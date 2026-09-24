"use client";

/**
 * HandballLeagueBadge — logo ligue locale + drapeau + nom.
 * Remplace le "🤾 NomLigue" brut (aucun emoji en prod).
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { leagueCountry, leagueLogo } from "@/lib/handball-logos";
import { CountryFlag } from "@/components/ui/country-flag";

export function HandballLeagueBadge({
  leagueName,
  country,
  className,
}: {
  leagueName: string;
  country?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const resolvedCountry = leagueCountry(leagueName, country);
  const logo = leagueLogo(leagueName, resolvedCountry);

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1", className)}
      title={resolvedCountry ? `${leagueName} (${resolvedCountry})` : leagueName}
    >
      {logo && !failed && (
        <img
          src={logo}
          alt=""
          aria-hidden
          width={16}
          height={16}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-4 w-4 shrink-0 object-contain"
        />
      )}
      {resolvedCountry && <CountryFlag country={resolvedCountry} size={14} />}
      <span className="truncate">{leagueName}</span>
    </span>
  );
}
