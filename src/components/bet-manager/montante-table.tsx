"use client";

import { useMemo, useState } from "react";
import { Target, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildMontante, tradeoffTable } from "@/lib/bet-manager/calculators";
import type { MontanteStep } from "@/lib/bet-manager/calculators";

/** Paliers d'arbitrage risque/gain : part du capital engagée contre cote moyenne requise. */
const TRADEOFF_PCTS = [5, 10, 15, 20, 30, 40, 50, 100];

const fmt = (n: number, d = 2) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (n: number) => `${fmt(n)} €`;

type Props = { initial: number; betsPerDay?: number };

export function MontanteTable({ initial, betsPerDay = 11 }: Props) {
  const [targetPct, setTargetPct] = useState(20);
  const [bankPct, setBankPct] = useState(50);
  const [stakePct, setStakePct] = useState(20);
  const [days, setDays] = useState(30);
  const [winProb, setWinProb] = useState(0.5);
  const [oddsTarget, setOddsTarget] = useState(2);

  const steps = useMemo<MontanteStep[]>(
    () => buildMontante({ capital: initial, days, targetPct, bankPct, stakePct, maxBets: betsPerDay, winProb }),
    [initial, days, targetPct, bankPct, stakePct, betsPerDay, winProb]
  );
  const tradeoff = useMemo(
    () => tradeoffTable(initial, targetPct, TRADEOFF_PCTS),
    [initial, targetPct]
  );

  const last = steps[steps.length - 1];
  const neutralOdds = winProb > 0 ? 1 / winProb : null;
  const maxTotal = Math.max(...steps.map((s) => s.total), 1);

  return (
    <div className="space-y-4">
      {/* ── Paramètres ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/8 bg-white/[.02] p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label={`Objectif / jour (${targetPct} %)`} min={1} max={50} step={1} value={targetPct} onChange={setTargetPct} suffix="%" />
          <Field label={`Part banque (${bankPct} %)`} min={0} max={100} step={5} value={bankPct} onChange={setBankPct} suffix="%" />
          <Field label={`Capital engagé / jour (${stakePct} %)`} min={0} max={100} step={5} value={stakePct} onChange={setStakePct} suffix="%" />
          <Field label={`Jours (${days})`} min={1} max={365} step={1} value={days} onChange={setDays} />
          <Field label={`Probabilité de réussite (${fmt(winProb * 100, 0)} %)`} min={5} max={90} step={1} value={winProb * 100} onChange={(v) => setWinProb(v / 100)} suffix="%" />
          <Field label={`Cote moyenne visée (${fmt(oddsTarget, 2)})`} min={1.01} max={20} step={0.05} value={oddsTarget} onChange={setOddsTarget} />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          Capital de départ{" "}
          <span className="font-mono font-semibold text-zinc-300">{eur(initial)}</span> · chaque palier part du
          capital réellement atteint au palier précédent, pas d’une projection figée. À stakePct = targetPct,
          la mise par pari et le gain visé par pari coïncident ; dès que tu les écartes, les deux colonnes divergent.
        </p>
      </div>

      {/* ── Bandeau final ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Outcome label={`Capital après ${days} j`} value={eur(last.capitalEnd)} sub={`de ${eur(initial)}`} />
        <Outcome label="Banque cumulée" value={eur(last.bankCum)} sub={`${bankPct} % des gains`} />
        <Outcome label="Total (capital + banque)" value={eur(last.total)} sub={`+${fmt(((last.total - initial) / initial) * 100, 1)} %`} />
        <Outcome
          label="Gain visé par pari (dernier palier)"
          value={eur(last.perBetTarget)}
          sub={`mise ${eur(last.perBet)} · cote ≥ ${fmt(last.requiredOdds ?? 0, 2)}`}
        />
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[.07] px-3 py-2 text-[11px] leading-relaxed text-amber-300/90">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>
          Projection mathématique composée : +{targetPct} % du capital par jour, dont {bankPct} % en banque et le
          reste réinvesti. Aucun écart de {targetPct} % journalier n’est statistiquement tenable sur 30 jours —
          ces montants sont des projections arithmétiques, pas une garantie. La cote d’espérance nulle pour ta
          probabilité de réussite affichée est {neutralOdds ? fmt(neutralOdds, 2) : "—"} : en dessous, l’espérance
          du pari est négative.
        </span>
      </p>

      {/* ── Table d'arbitrage ────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Arbitrage risque / gain
        </h3>
        <p className="mb-2 text-[11px] text-zinc-500">
          Pour viser {eur(steps[0].target)} de gain net sur {eur(initial)} de capital, voici la cote moyenne
          minimale à atteindre selon la part engagée.
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="bg-white/[.03] text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Capital engagé</th>
                {TRADEOFF_PCTS.map((p) => (
                  <th key={p} className="px-3 py-2 text-right font-semibold">{p} %</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-t border-white/5">
                <td className="px-3 py-2 text-left text-zinc-400">Mise à engager</td>
                {tradeoff.map((t) => (
                  <td key={t.pct} className="px-3 py-2 text-right">{eur(t.stake)}</td>
                ))}
              </tr>
              <tr className="border-t border-white/5 bg-white/[.015]">
                <td className="px-3 py-2 text-left text-zinc-400">Cote moyenne requise</td>
                {tradeoff.map((t) => (
                  <td key={t.pct} className={cn("px-3 py-2 text-right", t.pct === stakePct && "font-semibold text-emerald-400")}>
                    {fmt(t.odds, 2)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-white/5">
                <td className="px-3 py-2 text-left text-zinc-400">Mise par pari ({betsPerDay})</td>
                {tradeoff.map((t) => (
                  <td key={t.pct} className="px-3 py-2 text-right">{eur(t.stake / betsPerDay)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Progression palier par palier ────────────────────────────────── */}
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Progression palier par palier
        </h3>
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full min-w-[1040px] text-xs">
            <thead className="bg-white/[.03] text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-2.5 py-2 text-left font-semibold">J</th>
                <th className="px-2.5 py-2 text-left font-semibold">Date</th>
                <th className="px-2.5 py-2 text-right font-semibold">Capital début</th>
                <th className="px-2.5 py-2 text-right font-semibold">Gain visé</th>
                <th className="px-2.5 py-2 text-right font-semibold">→ Banque</th>
                <th className="px-2.5 py-2 text-right font-semibold">→ Capital</th>
                <th className="px-2.5 py-2 text-right font-semibold">Banque cum.</th>
                <th className="px-2.5 py-2 text-right font-semibold">Total</th>
                <th className="px-2.5 py-2 text-right font-semibold">Engagement</th>
                <th className="px-2.5 py-2 text-right font-semibold">Cote req.</th>
                <th className="px-2.5 py-2 text-right font-semibold">Mise / pari</th>
                <th className="px-2.5 py-2 text-right font-semibold">Gain / pari</th>
                <th className="px-2.5 py-2 text-left font-semibold">Faisabilité</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {steps.map((s) => {
                const overCapital = s.stake > s.capitalStart;
                const ok = !overCapital && oddsTarget >= (s.requiredOdds ?? Infinity);
                return (
                  <tr key={s.day} className="border-t border-white/5 hover:bg-white/[.02]">
                    <td className="px-2.5 py-1.5 text-left text-zinc-500">{s.day}</td>
                    <td className="px-2.5 py-1.5 text-left text-zinc-400">
                      {s.date.slice(8)}/{s.date.slice(5, 7)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(s.capitalStart)}</td>
                    <td className="px-2.5 py-1.5 text-right text-emerald-400">{fmt(s.target)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(s.toBank)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(s.capitalEnd)}</td>
                    <td className="px-2.5 py-1.5 text-right text-sky-400">{fmt(s.bankCum)}</td>
                    <td className="px-2.5 py-1.5 text-right font-semibold">{fmt(s.total)}</td>
                    <td className="px-2.5 py-1.5 text-right">{fmt(s.stake)}</td>
                    <td className={cn("px-2.5 py-1.5 text-right", ok && "text-emerald-400")}>
                      {s.requiredOdds === null ? "—" : fmt(s.requiredOdds, 2)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-zinc-300">{fmt(s.perBet)}</td>
                    <td className="px-2.5 py-1.5 text-right text-zinc-300">{fmt(s.perBetTarget)}</td>
                    <td className="px-2.5 py-1.5 text-left font-sans">
                      {overCapital ? (
                        <Badge tone="bad" icon={AlertTriangle}>Engagement &gt; capital</Badge>
                      ) : ok ? (
                        <Badge tone="good" icon={CheckCircle2}>Atteignable</Badge>
                      ) : (
                        <Badge tone="warn" icon={Target}>Cote trop basse</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-white/10 bg-white/[.03] font-mono font-semibold">
              <tr>
                <td className="px-2.5 py-2 text-left" colSpan={2}>Total</td>
                <td className="px-2.5 py-2 text-right">—</td>
                <td className="px-2.5 py-2 text-right text-emerald-400">{fmt(steps.reduce((a, s) => a + s.target, 0))}</td>
                <td className="px-2.5 py-2 text-right">{fmt(last.bankCum)}</td>
                <td className="px-2.5 py-2 text-right">{fmt(last.capitalEnd)}</td>
                <td className="px-2.5 py-2 text-right text-sky-400">{fmt(last.bankCum)}</td>
                <td className="px-2.5 py-2 text-right">{fmt(last.total)}</td>
                <td className="px-2.5 py-2 text-right">—</td>
                <td className="px-2.5 py-2 text-right">—</td>
                <td className="px-2.5 py-2 text-right">—</td>
                <td className="px-2.5 py-2 text-right">—</td>
                <td className="px-2.5 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── Courbe du total ──────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Évolution du total (capital + banque)
        </h3>
        <svg viewBox="0 0 720 180" className="w-full rounded-xl border border-white/8 bg-white/[.01]" role="img"
          aria-label={`Progression du total sur ${days} jours, de ${eur(initial)} à ${eur(last.total)}`}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line key={f} x1="46" x2="712" y1={170 - f * 150} y2={170 - f * 150} stroke="rgba(255,255,255,.06)" />
          ))}
          <polyline
            fill="none" stroke="#00e676" strokeWidth="2" strokeLinejoin="round"
            points={steps.map((s, i) => {
              const x = 46 + (i / Math.max(1, steps.length - 1)) * 666;
              const y = 170 - (s.total / maxTotal) * 150;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(" ")}
          />
          <text x="46" y={176} fill="#71717a" fontSize="9">{steps[0]?.date}</text>
          <text x="712" y={176} fill="#71717a" fontSize="9" textAnchor="end">{steps[steps.length - 1]?.date}</text>
          <text x="42" y="16" fill="#71717a" fontSize="9" textAnchor="end">{eur(maxTotal)}</text>
          <text x="42" y="174" fill="#71717a" fontSize="9" textAnchor="end">{eur(initial)}</text>
        </svg>
      </section>
    </div>
  );
}

function Field({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-500"
        />
        {suffix && <span className="shrink-0 font-mono text-[10px] text-zinc-600">{suffix}</span>}
      </div>
    </label>
  );
}

function Outcome({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[.02] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-0.5 font-mono text-[10px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function Badge({ tone, icon: Icon, children }: {
  tone: "good" | "warn" | "bad"; icon: React.ElementType; children: React.ReactNode;
}) {
  const styles = {
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    bad: "border-red-500/30 bg-red-500/10 text-red-400",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", styles)}>
      <Icon className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}