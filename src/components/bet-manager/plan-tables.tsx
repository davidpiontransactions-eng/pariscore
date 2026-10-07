"use client";

// Dualité Simulé / Réel (mission ybz4) : deux tables distinctes pour la page
// Plan +20 %/j. Le Retard du tableau Réel utilise la MÊME formule que
// objectiveGainsAt / objective-chart (écart plan + amortissement de l'emprunt)
// → les trois vues restent strictement synchronisées.
import { cn } from "@/lib/utils";
import {
  diffDays,
  loanCumulatedAt,
  type BankLoan,
  type PlanParams,
  type PlanReal,
  type PlanRow,
} from "@/lib/bet-manager/plan";

const fmt = (n: number, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });

type TableShellProps = {
  caption: string;
  children: React.ReactNode;
};

function TableShell({ caption, children }: TableShellProps) {
  return (
    <div className="overflow-x-auto">
      <div className="border-b border-white/5 px-3 py-2.5">
        <p className="text-[11px] text-foreground">{caption}</p>
      </div>
      {children}
    </div>
  );
}

type CommonProps = {
  params: PlanParams;
  th: PlanRow[];
  real: PlanReal;
  loan: BankLoan;
  /** Emprunt actif : affiche la colonne Remb. (théorique). */
  showLoan: boolean;
  loanDaily: number | null;
};

/**
 * Tableau SIMULÉ — projection mathématique pure, non impactée par les
 * réussites/échecs réels : dérive uniquement des paramètres du plan.
 */
export function SimulatedTable({ th, real, loan, showLoan, loanDaily }: CommonProps) {
  return (
    <TableShell caption="Projection théorique — générée uniquement à partir des paramètres du plan (capital, objectif %/j, part banque, emprunt).">
      <table className="w-full min-w-[760px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-foreground">
            <th className="px-2 py-2 font-semibold">J</th>
            <th className="px-2 py-2 font-semibold">Date</th>
            <th className="px-2 py-2 text-right font-semibold">Début</th>
            <th className="px-2 py-2 text-right font-semibold">Gain G</th>
            {showLoan && <th className="px-2 py-2 text-right font-semibold">Remb.</th>}
            <th className="px-2 py-2 text-right font-semibold">Banque</th>
            <th className="px-2 py-2 text-right font-semibold">Réinvest</th>
            <th className="px-2 py-2 text-right font-semibold">Capital fin</th>
            <th className="px-2 py-2 text-right font-semibold">Banque cum.</th>
            <th className="px-2 py-2 text-right font-semibold">Total th.</th>
          </tr>
        </thead>
        <tbody>
          {th.map((t, i) => {
            const r = real.rows[i];
            const isLive = real.live?.d === t.d;
            // Emprunt : remboursement affiché uniquement dans la fenêtre d'amortissement.
            const loanDay = showLoan ? diffDays(loan.startDate, t.key) : -1;
            const remb =
              showLoan && loanDaily !== null && loanDay >= 0 && loanDay < loan.days ? fmt(loanDaily) : "—";
            return (
              <tr
                key={t.d}
                className={cn("border-b border-white/[0.03]", isLive && "bg-emerald-500/[0.06]")}
              >
                <td className="px-2 py-1.5 font-mono text-[11px] text-foreground">{t.d}</td>
                <td className="px-2 py-1.5 font-mono text-[11px] text-foreground">
                  {t.key.slice(8)}/{t.key.slice(5, 7)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(t.cStart)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(t.G)}</td>
                {showLoan && (
                  <td className="px-2 py-1.5 text-right font-mono text-foreground">{remb}</td>
                )}
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(t.toBank)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(t.reinvest)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-foreground">{fmt(t.C)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(t.B)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-foreground">{fmt(t.T)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}

/**
 * Tableau RÉEL — constaté : alimenté par les paris/transactions réels
 * (computeReal). Le Retard = écart vs (plan + emprunt), même formule que le
 * graphique et la colonne Retard du dashboard.
 */
export function RealTable({ params, real, loan }: CommonProps) {
  return (
    <TableShell caption="Constaté — alimenté par les paris et mouvements réels du Bet-Manager (mêmes règles d'arrondi que le journal).">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-foreground">
            <th className="px-2 py-2 font-semibold">J</th>
            <th className="px-2 py-2 font-semibold">Date</th>
            <th className="px-2 py-2 text-right font-semibold">Début réel</th>
            <th className="px-2 py-2 text-right font-semibold">Mises</th>
            <th className="px-2 py-2 text-right font-semibold">Gain P/L</th>
            <th className="px-2 py-2 text-right font-semibold">Virement</th>
            <th className="px-2 py-2 text-right font-semibold">Banque</th>
            <th className="px-2 py-2 text-right font-semibold">Capital fin</th>
            <th className="px-2 py-2 text-right font-semibold">T réel</th>
            <th className="px-2 py-2 text-right font-semibold">Retard</th>
            <th className="px-2 py-2 font-semibold">État</th>
          </tr>
        </thead>
        <tbody>
          {real.rows.map((r, i) => {
            const prevCap = i === 0 ? params.capital : real.rows[i - 1].cap;
            const isLive = real.live?.d === r.d;
            // MÊME formule que objectiveGainsAt/le chart : écart plan + amortissement cumulé.
            const retardTotal = r.future || r.retard === null ? null : r.retard + loanCumulatedAt(loan, r.key);
            return (
              <tr
                key={r.d}
                className={cn("border-b border-white/[0.03]", isLive && "bg-emerald-500/[0.06]")}
              >
                <td className="px-2 py-1.5 font-mono text-[11px] text-foreground">{r.d}</td>
                <td className="px-2 py-1.5 font-mono text-[11px] text-foreground">
                  {r.key.slice(8)}/{r.key.slice(5, 7)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(prevCap)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(r.staked)}</td>
                <td className={cn("px-2 py-1.5 text-right font-mono text-foreground", r.gRe < 0 && "font-semibold")}>
                  {r.settled > 0 ? `${r.gRe > 0 ? "+" : ""}${fmt(r.gRe)}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{r.toBank > 0 ? fmt(r.toBank) : "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(r.bank)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-foreground">{fmt(r.cap)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-foreground">{fmt(r.tRe)}</td>
                <td className="px-2 py-1.5 text-right font-mono font-semibold text-foreground">
                  {retardTotal !== null ? `${retardTotal > 0 ? "+" : ""}${fmt(retardTotal)}` : "—"}
                </td>
                <td className="px-2 py-1.5">
                  {r.future ? (
                    <span className="font-mono text-[10px] text-foreground">à venir</span>
                  ) : r.n > 0 ? (
                    <span className="font-mono text-[10px] text-foreground">
                      {r.won}G {r.lost}P {r.pending}C
                    </span>
                  ) : isLive ? (
                    <span className="font-mono text-[10px] text-foreground">aujourd'hui</span>
                  ) : (
                    <span className="font-mono text-[10px] text-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableShell>
  );
}
