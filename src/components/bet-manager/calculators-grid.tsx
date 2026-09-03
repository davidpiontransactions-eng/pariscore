"use client";

import { useMemo, useState } from "react";
import {
  Percent,
  Layers,
  Target,
  ShieldCheck,
  Split,
  RotateCcw,
  Scale,
  Wallet,
  PieChart,
  LineChart as LineChartIcon,
  ArrowLeftRight,
  Handshake,
  ScanSearch,
  CircleDot,
  Route,
  Dice5,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Bet } from "@/lib/bet-manager/types";
import {
  oddsConverter,
  parlayCalculator,
  breakEven,
  dnbSplit,
  doubleChance,
  trj,
  expectedValue,
  kelly,
  hedgeCalculator,
  dutching,
  fairOdds,
  layCalculator,
  arbitrage,
  middleCalculator,
  handicapConverter,
  monteCarlo,
  stakingPlans,
} from "@/lib/bet-manager/calculators";

type FieldDef = {
  key: string;
  label: string;
  type: "number" | "text" | "oddslist";
  def?: string;
  step?: string;
};

type CalcResult = { label: string; value: string; tone?: "good" | "bad" | "default" };

type CalcDef = {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  tier: "Gratuit" | "PRO" | "Expert";
  fields: FieldDef[];
  compute: (vals: Record<string, number | string>) => CalcResult[];
};

const parseList = (v: string): number[] =>
  v
    .split(/[\n,;]+/)
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !isNaN(n) && n > 1);

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const CALCS: CalcDef[] = [
  {
    id: "odds-converter",
    title: "Convertisseur de cotes",
    desc: "Décimal ↔ fractionnel ↔ américain ↔ probabilité implicite",
    icon: ArrowLeftRight,
    tier: "Gratuit",
    fields: [{ key: "decimal", label: "Cote décimale", type: "number", def: "1.85" }],
    compute: (v) => {
      const r = oddsConverter(Number(v.decimal) || 1.01);
      return [
        { label: "Fractionnelle", value: r.fractional },
        { label: "Américaine", value: r.american },
        { label: "Probabilité implicite", value: r.impliedProb + "%" },
      ];
    },
  },
  {
    id: "parlay",
    title: "Calculateur combiné",
    desc: "Cote totale et gain d'un combiné",
    icon: Layers,
    tier: "Gratuit",
    fields: [
      { key: "odds", label: "Cotes (séparées par virgule)", type: "oddslist", def: "1.85, 2.10, 1.50" },
      { key: "stake", label: "Mise (€)", type: "number", def: "10" },
    ],
    compute: (v) => {
      const r = parlayCalculator(parseList(String(v.odds)), Number(v.stake) || 0);
      return [
        { label: "Cote totale", value: r.totalOdds.toFixed(2) },
        { label: "Gain potentiel", value: eur(r.payout), tone: "good" },
        { label: "Profit net", value: eur(r.profit), tone: r.profit >= 0 ? "good" : "bad" },
      ];
    },
  },
  {
    id: "break-even",
    title: "Seuil de rentabilité",
    desc: "Combien de paris gagnants pour être rentable à cette cote",
    icon: Target,
    tier: "Gratuit",
    fields: [{ key: "odds", label: "Cote", type: "number", def: "1.85" }],
    compute: (v) => {
      const r = breakEven(Number(v.odds) || 1.01);
      return [{ label: "Taux de réussite requis", value: r.winRateRequired + "%" }];
    },
  },
  {
    id: "dnb",
    title: "Remboursé si nul",
    desc: "Répartition victoire / couverture nul",
    icon: ShieldCheck,
    tier: "Gratuit",
    fields: [
      { key: "stake", label: "Mise totale (€)", type: "number", def: "100" },
      { key: "oddsWin", label: "Cote victoire", type: "number", def: "2.10" },
      { key: "oddsDraw", label: "Cote nul", type: "number", def: "3.40" },
    ],
    compute: (v) => {
      const r = dnbSplit(Number(v.stake) || 0, Number(v.oddsWin) || 1.01, Number(v.oddsDraw) || 1.01);
      if ("error" in r) return [{ label: "Erreur", value: String((r as any).error), tone: "bad" }];
      const d = r as { winStake: number; drawStake: number; guaranteed: number };
      return [
        { label: "Mise sur la victoire", value: eur(d.winStake) },
        { label: "Mise sur la couverture nul", value: eur(d.drawStake) },
        { label: "Gain garanti", value: eur(d.guaranteed), tone: "good" },
      ];
    },
  },
  {
    id: "double-chance",
    title: "Double chance",
    desc: "Couvrir deux issues (1X / X2 / 12)",
    icon: Split,
    tier: "Gratuit",
    fields: [
      { key: "odds1", label: "Cote issue A", type: "number", def: "1.40" },
      { key: "odds2", label: "Cote issue B", type: "number", def: "3.20" },
      { key: "odds12", label: "Cote double chance", type: "number", def: "1.18" },
    ],
    compute: (v) => {
      const r = doubleChance(Number(v.odds1) || 1, Number(v.odds2) || 1, Number(v.odds12) || 1);
      return [
        { label: "Probabilité combinée", value: r.combinedProb + "%" },
        { label: "Cote juste (démarginée)", value: r.fairOdds.toFixed(2) },
      ];
    },
  },
  {
    id: "trj",
    title: "Taux de retour (TRJ)",
    desc: "Redistribution du bookmaker et marge",
    icon: Percent,
    tier: "Gratuit",
    fields: [{ key: "odds", label: "Cotes du marché", type: "oddslist", def: "2.10, 3.40, 3.60" }],
    compute: (v) => {
      const r = trj(parseList(String(v.odds)));
      return [
        { label: "TRJ", value: r.trj + "%", tone: r.trj >= 95 ? "good" : "bad" },
        { label: "Marge bookmaker", value: r.margin + "%", tone: r.margin <= 5 ? "good" : "bad" },
      ];
    },
  },
  {
    id: "ev",
    title: "Valeur attendue (EV)",
    desc: "Un pari a-t-il une espérance positive ?",
    icon: Scale,
    tier: "PRO",
    fields: [
      { key: "odds", label: "Cote", type: "number", def: "2.10" },
      { key: "prob", label: "Probabilité estimée (%)", type: "number", def: "55" },
      { key: "stake", label: "Mise (€)", type: "number", def: "10" },
    ],
    compute: (v) => {
      const r = expectedValue(Number(v.odds) || 1.01, Number(v.prob) || 0, Number(v.stake) || 0);
      return [
        { label: "EV", value: eur(r.ev), tone: r.ev > 0 ? "good" : "bad" },
        { label: "ROI attendu", value: (r.roi >= 0 ? "+" : "") + r.roi + "%", tone: r.roi > 0 ? "good" : "bad" },
        { label: "Valeur", value: (r.value >= 0 ? "+" : "") + r.value.toFixed(4), tone: r.value > 0 ? "good" : "bad" },
      ];
    },
  },
  {
    id: "kelly",
    title: "Critère de Kelly",
    desc: "Mise optimale selon votre avantage (cap 25%)",
    icon: Wallet,
    tier: "PRO",
    fields: [
      { key: "prob", label: "Probabilité estimée (%)", type: "number", def: "55" },
      { key: "decimal", label: "Cote décimale", type: "number", def: "2.10" },
      { key: "bankroll", label: "Bankroll (€)", type: "number", def: "1000" },
    ],
    compute: (v) => {
      const r = kelly(Number(v.prob) || 0, Number(v.decimal) || 1.01, Number(v.bankroll) || 0);
      return [
        { label: "Mise recommandée", value: eur(r.stake), tone: "good" },
        { label: "Part de bankroll", value: r.pct + "%" + (r.capped ? " (cap 25%)" : "") },
      ];
    },
  },
  {
    id: "hedge",
    title: "Couverture (hedge)",
    desc: "Garantir un profit en cours de pari",
    icon: Handshake,
    tier: "PRO",
    fields: [
      { key: "originalStake", label: "Mise initiale (€)", type: "number", def: "50" },
      { key: "originalOdds", label: "Cote initiale", type: "number", def: "3.00" },
      { key: "hedgeOdds", label: "Cote live de couverture", type: "number", def: "2.00" },
    ],
    compute: (v) => {
      const r = hedgeCalculator(Number(v.originalStake) || 0, Number(v.originalOdds) || 1.01, Number(v.hedgeOdds) || 1.01);
      return [
        { label: "Mise de couverture", value: eur(r.hedgeStake) },
        { label: "Profit garanti", value: eur(r.guaranteedProfit), tone: r.guaranteedProfit >= 0 ? "good" : "bad" },
        { label: "Si le pari initial passe", value: eur(r.profitIfOriginalWins), tone: "good" },
        { label: "Si la couverture passe", value: eur(r.lossIfHedgeWins), tone: "bad" },
      ];
    },
  },
  {
    id: "dutching",
    title: "Dutching",
    desc: "Gain identique quel que soit le résultat",
    icon: PieChart,
    tier: "PRO",
    fields: [
      { key: "stake", label: "Mise totale (€)", type: "number", def: "100" },
      { key: "odds", label: "Cotes", type: "oddslist", def: "2.10, 3.40" },
    ],
    compute: (v) => {
      const r = dutching(Number(v.stake) || 0, parseList(String(v.odds)));
      if ("error" in r) return [{ label: "Erreur", value: String((r as any).error), tone: "bad" }];
      const d = r as { stakes: number[]; guaranteed: number; profit: number };
      return [
        { label: "Mises", value: d.stakes.map((s) => eur(s)).join(" / ") },
        { label: "Gain garanti", value: eur(d.guaranteed), tone: "good" },
        { label: "Profit", value: eur(d.profit), tone: d.profit >= 0 ? "good" : "bad" },
      ];
    },
  },
  {
    id: "fair-odds",
    title: "Cotes justes sans marge",
    desc: "Retirer la marge du bookmaker",
    icon: LineChartIcon,
    tier: "PRO",
    fields: [{ key: "odds", label: "Cotes du marché", type: "oddslist", def: "2.10, 3.40, 3.60" }],
    compute: (v) => {
      const r = fairOdds(parseList(String(v.odds)));
      return [
        { label: "Cotes justes", value: r.fairOdds.map((x) => x.toFixed(2)).join(" / ") },
        { label: "Probabilités réelles", value: r.probabilities.map((x) => x + "%").join(" / ") },
      ];
    },
  },
  {
    id: "lay",
    title: "Pari Lay",
    desc: "Responsabilité et profit sur les exchanges",
    icon: RotateCcw,
    tier: "PRO",
    fields: [
      { key: "backStake", label: "Mise back (€)", type: "number", def: "10" },
      { key: "backOdds", label: "Cote back", type: "number", def: "2.00" },
      { key: "layOdds", label: "Cote lay", type: "number", def: "2.02" },
      { key: "commission", label: "Commission (%)", type: "number", def: "2" },
    ],
    compute: (v) => {
      const r = layCalculator(Number(v.backStake) || 0, Number(v.backOdds) || 1.01, Number(v.layOdds) || 1.01, Number(v.commission) / 100 || 0.02);
      return [
        { label: "Responsabilité (lay)", value: eur(r.liability), tone: "bad" },
        { label: "Si le back passe", value: eur(r.profitIfBackWins), tone: "good" },
        { label: "Si le lay passe", value: eur(r.profitIfLayWins), tone: "good" },
      ];
    },
  },
  {
    id: "arbitrage",
    title: "Détecteur d'arbitrage",
    desc: "Paris sans risque entre bookmakers",
    icon: ScanSearch,
    tier: "Expert",
    fields: [
      { key: "odds", label: "Cotes (meilleures de chaque bookmaker)", type: "oddslist", def: "2.00, 2.10" },
      { key: "stake", label: "Mise totale (€)", type: "number", def: "100" },
    ],
    compute: (v) => {
      const r = arbitrage(parseList(String(v.odds)), Number(v.stake) || 0);
      if ("error" in r) return [{ label: "Erreur", value: String((r as any).error), tone: "bad" }];
      const d = r as { isArbitrage: boolean; margin: number; stakes: number[]; profit: number };
      return [
        { label: "Arbitrage", value: d.isArbitrage ? "✅ Oui" : "❌ Non", tone: d.isArbitrage ? "good" : "bad" },
        { label: "Marge", value: (d.margin >= 0 ? "+" : "") + d.margin + "%", tone: d.margin > 0 ? "good" : "bad" },
        { label: "Mises", value: d.stakes.map((s) => eur(s)).join(" / ") },
        { label: "Profit garanti", value: eur(d.profit), tone: d.profit > 0 ? "good" : "bad" },
      ];
    },
  },
  {
    id: "middle",
    title: "Pari Middle",
    desc: "Profit garanti ou gain doublé (totals, handicaps)",
    icon: CircleDot,
    tier: "Expert",
    fields: [
      { key: "totalPoints", label: "Total points final", type: "number", def: "220" },
      { key: "lineA", label: "Ligne A", type: "number", def: "215.5" },
      { key: "lineB", label: "Ligne B", type: "number", def: "224.5" },
      { key: "oddsA", label: "Cote côté A", type: "number", def: "1.91" },
      { key: "oddsB", label: "Cote côté B", type: "number", def: "1.91" },
      { key: "stakePerSide", label: "Mise par côté (€)", type: "number", def: "50" },
    ],
    compute: (v) => {
      const r = middleCalculator(
        Number(v.totalPoints) || 0,
        Number(v.lineA) || 0,
        Number(v.lineB) || 0,
        Number(v.oddsA) || 1.01,
        Number(v.oddsB) || 1.01,
        Number(v.stakePerSide) || 0
      );
      return [
        { label: "Largeur du middle", value: String(r.middleWidth) },
        { label: "Les deux passent", value: eur(r.winBoth), tone: "good" },
        { label: "Un seul passe", value: eur(r.winOne) },
        { label: "Aucun ne passe", value: eur(r.loseBoth), tone: "bad" },
      ];
    },
  },
  {
    id: "handicap",
    title: "Convertisseur handicap",
    desc: "Européen / asiatique / spread US",
    icon: Route,
    tier: "Gratuit",
    fields: [
      { key: "odds", label: "Cote", type: "number", def: "1.90" },
      { key: "handicap", label: "Handicap", type: "number", def: "0" },
    ],
    compute: (v) => {
      const r = handicapConverter(Number(v.odds) || 1.01, Number(v.handicap) || 0);
      return [
        { label: "Probabilité européenne", value: r.european + "%" },
        { label: "Probabilité ajustée (asiatique)", value: r.asianAdjusted + "%" },
      ];
    },
  },
  {
    id: "monte-carlo",
    title: "Simulateur Monte Carlo",
    desc: "1 000 trajectoires de bankroll selon votre taux de réussite",
    icon: Dice5,
    tier: "Expert",
    fields: [
      { key: "bankroll", label: "Bankroll initiale (€)", type: "number", def: "1000" },
      { key: "winRate", label: "Taux de réussite (%)", type: "number", def: "55" },
      { key: "avgOdds", label: "Cote moyenne", type: "number", def: "1.90" },
      { key: "stakePct", label: "Mise (% bankroll)", type: "number", def: "2" },
      { key: "betsPerSim", label: "Paris par simulation", type: "number", def: "100" },
    ],
    compute: (v) => {
      const r = monteCarlo(Number(v.bankroll) || 1000, Number(v.winRate) || 0, Number(v.avgOdds) || 1.01, Number(v.stakePct) || 0, 1000, Number(v.betsPerSim) || 100);
      return [
        { label: "Médiane", value: eur(r.median), tone: r.median >= 0 ? "good" : "bad" },
        { label: "P10 (scénario pessimiste)", value: eur(r.p10), tone: "bad" },
        { label: "P90 (scénario optimiste)", value: eur(r.p90), tone: "good" },
        { label: "Risque de ruine (<20%)", value: r.ruinProb + "%", tone: r.ruinProb > 20 ? "bad" : "good" },
        { label: "Espérance", value: eur(r.expectedFinal) },
      ];
    },
  },
];

function CalcCard({ calc }: { calc: CalcDef }) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(calc.fields.map((f) => [f.key, f.def ?? ""]))
  );

  const results = useMemo(() => {
    const numVals: Record<string, number | string> = {};
    for (const f of calc.fields) {
      numVals[f.key] = f.type === "number" ? Number(vals[f.key]) || 0 : vals[f.key] ?? "";
    }
    return calc.compute(numVals);
  }, [calc, vals]);

  return (
    <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.03] p-4 transition-colors hover:border-white/10">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <calc.icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{calc.title}</h3>
            <p className="text-[11px] leading-tight text-zinc-400">{calc.desc}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
            calc.tier === "Gratuit" && "bg-zinc-500/10 text-zinc-400",
            calc.tier === "PRO" && "bg-sky-500/10 text-sky-400",
            calc.tier === "Expert" && "bg-purple-500/10 text-purple-400"
          )}
        >
          {calc.tier}
        </span>
      </div>

      <div className="grid flex-1 gap-2.5">
        {calc.fields.map((f) =>
          f.type === "oddslist" ? (
            <div key={f.key} className="space-y-1">
              <Label className="text-[10px] text-zinc-400">{f.label}</Label>
              <Textarea
                className="h-16 resize-none border-white/10 bg-white/5 font-mono text-xs text-zinc-200"
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ) : (
            <div key={f.key} className="space-y-1">
              <Label className="text-[10px] text-zinc-400">{f.label}</Label>
              <Input
                className="h-8 border-white/10 bg-white/5 font-mono text-xs text-zinc-100"
                inputMode={f.type === "number" ? "decimal" : undefined}
                value={vals[f.key] ?? ""}
                onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          )
        )}

        <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2.5">
          {results.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-zinc-400">{r.label}</span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  r.tone === "good" ? "text-emerald-400" : r.tone === "bad" ? "text-red-400" : "text-zinc-100"
                )}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalculatorsGrid({ bets, initial }: { bets: Bet[]; initial: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {CALCS.map((calc) => (
        <CalcCard key={calc.id} calc={calc} />
      ))}
      {/* Cas spécial : plan de mise sur historique réel */}
      <div className="flex flex-col rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Plan de mise</h3>
            <p className="text-[11px] text-zinc-400">Compare les stratégies sur ton historique réel</p>
          </div>
          <span className="ml-auto rounded bg-purple-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-purple-400">
            Expert
          </span>
        </div>
        <div className="space-y-1.5">
          {stakingPlans(bets, initial).map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs"
            >
              <span className="text-zinc-300">{p.name}</span>
              <span className={cn("font-mono font-semibold", p.profit > 0 ? "text-emerald-400" : p.profit < 0 ? "text-red-400" : "text-zinc-400")}>
                {p.profit > 0 ? "+" : ""}
                {p.profit.toFixed(0)} €
              </span>
              <span className="font-mono text-[10px] text-zinc-600">DD {p.maxDrawdown.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="mt-3 border-white/10 text-[11px] text-zinc-300" disabled>
          Compare tes stratégies de mise
        </Button>
      </div>
    </div>
  );
}