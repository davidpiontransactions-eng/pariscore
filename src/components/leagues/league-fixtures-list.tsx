import type { LeagueFixture } from "@/lib/leagues-stats/types";

function OddsChips({ odds }: { odds: NonNullable<LeagueFixture["odds"]> }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {(
        [
          ["1", odds.home],
          ["X", odds.draw],
          ["2", odds.away],
        ] as const
      ).map(([label, value]) => (
        <span
          key={label}
          className="inline-flex min-w-9 flex-col items-center rounded-md border bg-muted/40 px-1.5 py-0.5"
          title={`Cote ${label}`}
        >
          <span className="text-[9px] font-medium text-muted-foreground leading-none">
            {label}
          </span>
          <span className="text-[11px] font-bold tabular-nums leading-tight">
            {value.toFixed(2)}
          </span>
        </span>
      ))}
    </div>
  );
}

function TeamRow({
  name,
  badge,
  bold,
}: {
  name: string;
  badge: string | null;
  bold?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {badge ? (
         
        <img
          src={badge}
          alt=""
          loading="lazy"
          className="h-4 w-4 shrink-0 object-contain"
        />
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-full bg-muted" />
      )}
      <span
        className={`truncate text-xs ${bold ? "font-semibold" : "text-muted-foreground"}`}
      >
        {name}
      </span>
    </div>
  );
}

export function LeagueFixturesList({ fixtures }: { fixtures: LeagueFixture[] }) {
  if (!fixtures.length) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        Aucun match à venir programmé.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {fixtures.map((fx, i) => (
        <li key={`${fx.kickoffText}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
          <span className="w-24 shrink-0 text-[11px] font-medium text-muted-foreground">
            {fx.kickoffText ?? "—"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <TeamRow name={fx.home.name} badge={fx.home.badge} />
            <TeamRow name={fx.away.name} badge={fx.away.badge} />
          </div>
          {fx.odds ? (
            <OddsChips odds={fx.odds} />
          ) : (
            <span className="text-[10px] text-muted-foreground">cotes à venir</span>
          )}
        </li>
      ))}
    </ul>
  );
}
