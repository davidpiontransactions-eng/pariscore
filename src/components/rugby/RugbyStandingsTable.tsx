"use client";

/**
 * Classement rugby : Elo, bilan (J/V/N/D), points marqués/encaissés, forme,
 * points terrain (4/2/0) et probabilité de titre issue du Monte Carlo.
 */

import type { StandingRow } from "@/lib/rugby/types";
import { FormBadges, RugbyTeamLogo, pct } from "./rugby-ui";

export function RugbyStandingsTable({
  standings,
  simulatedRuns,
}: {
  standings: StandingRow[];
  simulatedRuns: number;
}) {
  if (!standings.length) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#12151f] p-10 text-center">
        <p className="text-3xl" aria-hidden>🏉</p>
        <p className="mt-3 font-semibold text-white">Pas encore de classement</p>
        <p className="mt-1 text-sm text-slate-400">
          Les données de cette compétition ne sont pas encore synchronisées.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#12151f] shadow-lg shadow-black/20">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/8 text-[11px] uppercase tracking-wider text-slate-500">
              <th scope="col" className="px-3 py-3 text-left font-bold">#</th>
              <th scope="col" className="px-3 py-3 text-left font-bold">Équipe</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">J</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">V</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">N</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">D</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">±</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">Pts</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">Elo</th>
              <th scope="col" className="px-2 py-3 text-center font-bold">Forme</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Titre</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const diff = row.pointsFor - row.pointsAgainst;
              return (
                <tr
                  key={row.teamId}
                  className="border-b border-white/4 transition-colors last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-2.5 font-bold tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <RugbyTeamLogo src={row.logo} name={row.name} size={26} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-100">{row.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Att {row.attack.toFixed(2)} · Déf {row.defence.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-300">{row.gamesPlayed}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-emerald-300">{row.wins}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-slate-400">{row.draws}</td>
                  <td className="px-2 py-2.5 text-center tabular-nums text-red-300">{row.losses}</td>
                  <td
                    className={`px-2 py-2.5 text-center font-semibold tabular-nums ${
                      diff > 0 ? "text-emerald-300" : diff < 0 ? "text-red-300" : "text-slate-400"
                    }`}
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="px-2 py-2.5 text-center font-black tabular-nums text-white">{row.points}</td>
                  <td className="px-2 py-2.5 text-center font-semibold tabular-nums text-teal-300">
                    {row.elo}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex justify-center">
                      <FormBadges form={row.form} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <TitleChance value={row.titleChance} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {simulatedRuns > 0 && (
        <p className="border-t border-white/5 px-4 py-2.5 text-[11px] text-slate-500">
          Chances de titre estimées par simulation Monte Carlo ({simulatedRuns.toLocaleString("fr-FR")} itérations).
        </p>
      )}
    </div>
  );
}

function TitleChance({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-600">—</span>;
  const p = value * 100;
  const strong = p >= 25;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
        <div
          className={strong ? "h-full bg-teal-400" : "h-full bg-slate-500"}
          style={{ width: `${Math.min(100, p)}%` }}
        />
      </div>
      <span className={`w-10 text-right text-xs font-bold tabular-nums ${strong ? "text-teal-300" : "text-slate-400"}`}>
        {pct(value, p < 1 ? 1 : 0)}
      </span>
    </div>
  );
}
