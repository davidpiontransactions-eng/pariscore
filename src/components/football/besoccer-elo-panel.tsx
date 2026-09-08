"use client";

import { useMemo } from "react";
import { eloBarForMatch } from "@/lib/elo-bar";

/* ─── Comparatif Win probability façon BeSoccer (barre 1X2 + blasons) ───
   N'intègre QUE des données réelles : logos + proba 1X2 du modèle
   (blend Poisson/cotes). Pas de ratings ELO, Tilt ni rankings (inexistants).
   Libellé « Win probability » (pas « ELO ») : honnêteté des données. */

export function BesoccerEloPanel({
  homeName,
  homeLogo,
  awayName,
  awayLogo,
  homeOdds,
  drawOdds,
  awayOdds,
}: {
  homeName: string;
  homeLogo?: string | null;
  awayName: string;
  awayLogo?: string | null;
  homeOdds?: number | null;
  drawOdds?: number | null;
  awayOdds?: number | null;
}) {
  const bar = useMemo(
    () => eloBarForMatch({ homeOdds, drawOdds, awayOdds }),
    [homeOdds, drawOdds, awayOdds]
  );
  const fmt = (v: number) => `${parseFloat(v.toFixed(1))}%`;
  return (
    <div className="w-full rounded-2xl border p-4" style={{ backgroundColor: "#ffffff", borderColor: "#f0f0f0" }}>
      <div className="mb-3 flex items-center justify-between">
        {[
          { name: homeName, logo: homeLogo },
          { name: awayName, logo: awayLogo },
        ].map((t, i) => (
          <div key={i} className="flex w-16 flex-col items-center gap-1">
            {t.logo ? (
              <img src={t.logo} alt={t.name} width="60" height="60" loading="lazy" className="size-[60px] object-contain" />
            ) : (
              <span className="flex size-[60px] items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: "#9e9e9e" }}>
                {t.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="max-w-full truncate text-[11px] font-medium" style={{ color: "#222222" }}>{t.name}</span>
          </div>
        ))}
      </div>
      <div className="mb-1 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "#717171" }}>
        Win probability
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full" role="img" aria-label={`Win probability : ${homeName} ${fmt(bar.home)}, nul ${fmt(bar.draw)}, ${awayName} ${fmt(bar.away)}`}>
        <div style={{ width: `${bar.home}%`, backgroundColor: "#16a34a" }} />
        <div style={{ width: `${bar.draw}%`, backgroundColor: "#bdbdbd" }} />
        <div style={{ width: `${bar.away}%`, backgroundColor: "#374151" }} />
      </div>
      <div className="mt-1.5 grid grid-cols-3 text-center">
        <div>
          <div className="text-sm font-bold tabular-nums" style={{ color: "#222222" }}>{fmt(bar.home)}</div>
          <div className="truncate text-[11px]" style={{ color: "#717171" }}>{homeName}</div>
        </div>
        <div>
          <div className="text-sm font-bold tabular-nums" style={{ color: "#222222" }}>{fmt(bar.draw)}</div>
          <div className="text-[11px]" style={{ color: "#717171" }}>Draw</div>
        </div>
        <div>
          <div className="text-sm font-bold tabular-nums" style={{ color: "#222222" }}>{fmt(bar.away)}</div>
          <div className="truncate text-[11px]" style={{ color: "#717171" }}>{awayName}</div>
        </div>
      </div>
    </div>
  );
}
