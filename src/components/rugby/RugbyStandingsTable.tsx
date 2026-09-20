"use client";

/**
 * Classement rugby enrichi : Elo, bilan (J/V/N/D), bonus, points marqués/encaissés,
 * forme, trend, barres attaque/défense, points terrain (4/2/0) et probabilité de titre.
 */

import type { StandingRow } from "@/lib/rugby/types";
import { FormBadges, RugbyTeamLogo, pct } from "./rugby-ui";

/* ─── Trend (flèche direction forme) ─── */
function TrendArrow({ form }: { form: string }) {
  if (!form || form.length < 3) return <span className="text-slate-600">—</span>;
  const recent = form.slice(-3).split("");
  const wins = recent.filter((c) => c === "W").length;
  const losses = recent.filter((c) => c === "L").length;
  if (wins >= 2) return <span className="text-emerald-400 text-xs font-bold">▲</span>;
  if (losses >= 2) return <span className="text-red-400 text-xs font-bold">▼</span>;
  return <span className="text-slate-500 text-xs">—</span>;
}

/* ─── Barre attaque/défense visuelle ─── */
function AttackDefBar({ attack, defence }: { attack: number; defence: number }) {
  const maxVal = Math.max(attack, defence, 1.2);
  const attWidth = Math.min(100, (attack / maxVal) * 100);
  const defWidth = Math.min(100, (defence / maxVal) * 100);
  return (
    <div className="flex flex-col gap-0.5 w-16">
      <div className="flex items-center gap-1">
        <div className="h-1 flex-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-400/80" style={{ width: `${attWidth}%` }} />
        </div>
        <span className="text-[9px] tabular-nums text-emerald-300/70 w-6 text-right">{attack.toFixed(1)}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-1 flex-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-sky-400/80" style={{ width: `${defWidth}%` }} />
        </div>
        <span className="text-[9px] tabular-nums text-sky-300/70 w-6 text-right">{defence.toFixed(1)}</span>
      </div>
    </div>
  );
}

/* ─── Bonus (offensif 4+ essais, défensif ≤7 pts) ─── */
function BonusEstimate({ row }: { row: StandingRow }) {
  // Bonus offensif estimé : ~40% si attaque > 1.0
  const offensive = row.attack > 1.0 ? 1 : 0;
  // Bonus défensif estimé : ~30% si défense < 0.85
  const defensive = row.defence < 0.85 ? 1 : 0;
  const total = offensive + defensive;
  return (
    <span className="text-[11px] tabular-nums text-slate-400">
      {total > 0 ? `+${total}` : "—"}
    </span>
  );
}

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
        <table className="w-full min-w-[600px] text-sm sm:min-w-[860px]">
          <thead>
            <tr className="border-b border-white/8 text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400">
              <th scope="col" className="px-2 py-2.5 text-left font-bold sm:px-3 sm:py-3 sticky left-0 z-20 bg-[#12151f]">#</th>
              <th scope="col" className="px-2 py-2.5 text-left font-bold sm:px-3 sm:py-3 sticky left-8 z-20 bg-[#12151f]">Équipe</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">J</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">V</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">N</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">D</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">±</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">Bonus</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">Pts</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">Elo</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">Att/Déf</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">Forme</th>
              <th scope="col" className="px-1.5 py-2.5 text-center font-bold sm:px-2 sm:py-3">Trend</th>
              <th scope="col" className="px-2 py-2.5 text-right font-bold sm:px-3 sm:py-3">Titre</th>
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
                  <td className="px-2 py-2.5 font-bold tabular-nums text-slate-400 sm:px-3 sticky left-0 z-10 bg-[#12151f]">{i + 1}</td>
                  <td className="px-2 py-2.5 sm:px-3 sticky left-8 z-10 bg-[#12151f]">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <RugbyTeamLogo src={row.logo} name={row.name} size={22} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-100 text-xs sm:text-sm">{row.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-1.5 py-2.5 text-center tabular-nums text-slate-300 sm:px-2">{row.gamesPlayed}</td>
                  <td className="px-1.5 py-2.5 text-center tabular-nums text-emerald-300 sm:px-2">{row.wins}</td>
                  <td className="px-1.5 py-2.5 text-center tabular-nums text-slate-400 sm:px-2">{row.draws}</td>
                  <td className="px-1.5 py-2.5 text-center tabular-nums text-red-300 sm:px-2">{row.losses}</td>
                  <td
                    className={`px-1.5 py-2.5 text-center font-semibold tabular-nums sm:px-2 ${
                      diff > 0 ? "text-emerald-300" : diff < 0 ? "text-red-300" : "text-slate-400"
                    }`}
                  >
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="px-1.5 py-2.5 text-center sm:px-2">
                    <BonusEstimate row={row} />
                  </td>
                  <td className="px-1.5 py-2.5 text-center font-black tabular-nums text-white sm:px-2">{row.points}</td>
                  <td className="px-1.5 py-2.5 text-center font-semibold tabular-nums text-teal-300 sm:px-2">
                    {row.elo}
                  </td>
                  <td className="px-1.5 py-2.5 sm:px-2">
                    <AttackDefBar attack={row.attack} defence={row.defence} />
                  </td>
                  <td className="px-1.5 py-2.5 sm:px-2">
                    <div className="flex justify-center">
                      <FormBadges form={row.form} />
                    </div>
                  </td>
                  <td className="px-1.5 py-2.5 text-center sm:px-2">
                    <TrendArrow form={row.form} />
                  </td>
                  <td className="px-2 py-2.5 text-right sm:px-3">
                    <TitleChance value={row.titleChance} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {simulatedRuns > 0 && (
        <p className="border-t border-white/5 px-4 py-2.5 text-[11px] text-slate-400">
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
