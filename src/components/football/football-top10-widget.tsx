"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import type { StrategyTop5Key, StrategyMatchEntry } from "@/lib/football-strategy-top5";
import type { FootballMatch } from "@/lib/football-data";
import { useFootballTopN } from "@/hooks/use-football-top5";
import { isInKickoffWindow, type KickoffWindow } from "@/lib/football-time";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leagueCountryOf } from "@/lib/league-mapping";
import { CountryFlag } from "@/components/ui/country-flag";
import type { MarketBacktest } from "@/lib/football-backtest/market-engine";
import { useTop5SelectionStore } from "@/stores/use-top5-selection-store";
import { STRATEGIES, MatchRow, type WindowKey } from "./football-strategy-top5-widget";
import { TopStrategiesTable, type StrategyTableRow } from "./top-strategies-table";

/* Teintes FotMob clair — identiques au calendrier */
const C = {
  card: "#ffffff",
  cardBorder: "#f0f0f0",
  headerBg: "#f5f5f5",
  headerText: "#000000",
  team: "#222222",
  time: "#717171",
  live: "#00985f",
  accent: "#00985f",
} as const;

/**
 * Libellé du groupe « pays inconnu ».
 *
 * `leagueCountry` est optionnel (`leagueCountry?: string | null`) et certaines sources
 * (notament les replis de match sans `country`) ne le renseignent pas. Regrouper ces
 * ligues sous une entrée vide produirait un `SelectLabel` muet : pire que la liste
 * plate d'avant. Un libellé explicite vaut mieux qu'un silence.
 */
const AUTRE_PAYS = "Autres pays";

type StrategyDef = (typeof STRATEGIES)[number];

/** Cote BSD pertinente pour la stratégie (null = pas de marché direct). */
function strategyOdds(
  entry: StrategyMatchEntry,
  active: StrategyTop5Key,
): { odds: number | null; oddsLabel: string | null } {
  const o = entry.odds;
  if (!o) return { odds: null, oddsLabel: null };
  switch (active) {
    case "bestTeam":
    case "bestTeam1x2":
    case "gagnant": {
      if (entry.pick === "home") return { odds: o.home, oddsLabel: o.home != null ? "1" : null };
      if (entry.pick === "away") return { odds: o.away, oddsLabel: o.away != null ? "2" : null };
      if (o.home != null && o.away != null) {
        return o.home <= o.away ? { odds: o.home, oddsLabel: "1" } : { odds: o.away, oddsLabel: "2" };
      }
      return { odds: o.home ?? o.away, oddsLabel: o.home != null ? "1" : "2" };
    }
    case "doubleChance1X":
      return { odds: o.home, oddsLabel: o.home != null ? "1X" : null };
    case "doubleChance2X":
      return { odds: o.away, oddsLabel: o.away != null ? "2X" : null };
    case "doubleChance12":
      return { odds: null, oddsLabel: null };
    case "over15":
      return { odds: o.over15, oddsLabel: o.over15 != null ? "Over 1,5" : null };
    case "under35":
      return { odds: o.under35, oddsLabel: o.under35 != null ? "Under 3,5" : null };
    case "bttsYes":
      return { odds: o.bttsYes, oddsLabel: o.bttsYes != null ? "BTTS" : null };
    case "dnb": {
      if (entry.pick === "home") return { odds: o.dnbHome, oddsLabel: o.dnbHome != null ? "DNB 1" : null };
      if (entry.pick === "away") return { odds: o.dnbAway, oddsLabel: o.dnbAway != null ? "DNB 2" : null };
      return { odds: o.dnbHome ?? o.dnbAway, oddsLabel: o.dnbHome != null ? "DNB 1" : "DNB 2" };
    }
    default:
      return { odds: null, oddsLabel: null };
  }
}

/** Convertit les entrees StrategyMatchEntry en lignes pour TopStrategiesTable. */
function toTableRows(
  entries: StrategyMatchEntry[],
  def: StrategyDef,
  active: StrategyTop5Key,
): StrategyTableRow[] {
  return entries.map((e) => {
    const { odds, oddsLabel } = strategyOdds(e, active);
    return {
      matchId: e.matchId,
      league: e.league,
      leagueLogo: e.leagueLogo,
      kickoff: e.kickoff,
      home: { teamName: e.home.teamName, logo: e.home.logo },
      away: { teamName: e.away.teamName, logo: e.away.logo },
      value: e.value,
      display: def.format(e.value),
      probPct: def.isProb ? e.value : null,
      // I3 : badge de source sur bestTeam (PPG forme vs proba cotes).
      sourceLabel: active === "bestTeam" ? (e.source === "odds" ? "cotes" : "forme") : null,
      odds,
      oddsLabel,
      trend: "flat" as const,
      // I5 : repli « Nul probable » affiché grisé.
      muted: e.drawModal === true,
      note: e.drawModal === true ? "Nul probable" : null,
    };
  });
}

const TOP_N = 10;
/** Seuil minimal de probabilité du modèle pour l'inclusion forcée d'un match sélectionné. */
const MIN_PROB_PCT = 60;

const TIME_WINDOWS: { key: KickoffWindow; label: string; title: string }[] = [
  { key: "jour", label: "Jour", title: "Matchs du jour" },
  { key: "48h", label: "48h", title: "Matchs sous 48 heures" },
  { key: "semaine", label: "Sem.", title: "Matchs de la semaine" },
];

const HOUR_WINDOWS: { key: KickoffWindow; label: string }[] = [
  { key: "1h", label: "≤1h" },
  { key: "2h", label: "≤2h" },
  { key: "4h", label: "≤4h" },
  { key: "8h", label: "≤8h" },
];

/**
 * Widget central « Top 10 matchs par stratégie » — global (Toutes les ligues)
 * ou par championnat via le sélecteur. Remplace le Top5 sidebar.
 *
 * Design : FotMob clair — même teintes que FotmobCalendarTable.
 */
const STRAT_KEYS = new Set(STRATEGIES.map((s) => s.key));

/** État initial lu depuis l'URL (?league=&strat=&win=&forme=) — deep-link/partage. */
function readUrlState(): {
  league: string | null;
  active: StrategyTop5Key;
  winKey: WindowKey;
  timeWin: KickoffWindow;
} {
  const fallback = { league: null as string | null, active: "bestTeam" as StrategyTop5Key, winKey: "l5" as WindowKey, timeWin: "semaine" as KickoffWindow };
  if (typeof window === "undefined") return fallback;
  try {
    const p = new URLSearchParams(window.location.search);
    const league = p.get("league");
    const strat = p.get("strat");
    const win = p.get("win");
    const forme = p.get("forme");
    return {
      league: league && league !== "__all__" ? league : null,
      active: strat && STRAT_KEYS.has(strat as StrategyTop5Key) ? (strat as StrategyTop5Key) : fallback.active,
      winKey: forme === "l5" || forme === "l10" ? forme : fallback.winKey,
      timeWin: (["jour", "48h", "semaine", "1h", "2h", "4h", "8h"] as string[]).includes(win ?? "") ? (win as KickoffWindow) : fallback.timeWin,
    };
  } catch {
    return fallback;
  }
}

export function FootballTop10Widget({ matches }: { matches: FootballMatch[] }) {
  const [league, setLeague] = useState<string | null>(() => readUrlState().league);
  const [active, setActive] = useState<StrategyTop5Key>(() => readUrlState().active);
  const [winKey, setWinKey] = useState<WindowKey>(() => readUrlState().winKey);
  const [timeWin, setTimeWin] = useState<KickoffWindow>(() => readUrlState().timeWin);

  // Miroir des filtres dans l'URL (replaceState — sans navigation).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const p = new URLSearchParams(window.location.search);
      if (league) p.set("league", league); else p.delete("league");
      p.set("strat", active);
      p.set("win", timeWin);
      p.set("forme", winKey);
      const qs = p.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    } catch {
      // Navigation privée / iframe : filtres locaux uniquement.
    }
  }, [league, active, timeWin, winKey]);

  const { data, matchesFor, isLoading, error } = useFootballTopN(TOP_N, league, timeWin);
  const selectedItems = useTop5SelectionStore((s) => s.items);
  const toggleStore = useTop5SelectionStore((s) => s.toggle);

  const handleLeagueChange = useCallback((v: string) => setLeague(v === "__all__" ? null : v), []);
  const handleStratChange = useCallback((v: string) => setActive(v as StrategyTop5Key), []);
  const handleWinKeyChange = useCallback((k: WindowKey) => () => setWinKey(k), []);
  const handleTimeWinChange = useCallback((w: KickoffWindow) => () => setTimeWin(w), []);

  const def = useMemo(() => STRATEGIES.find((s) => s.key === active) ?? STRATEGIES[0], [active]);

  // Ligues groupées par pays, pays triés alphabétiquement (`localeCompare` en
  // locale fr : sinon "Angleterre" passe après "Zambie" sur un tri ASCII).
  //
  // `leagueCountryOf` résout le pays d'un NOM de ligue en trois passes : correspondance
  // exacte dans `LEAGUE_INFO`, puis préfixe pays (« Austrian Bundesliga », « Brasileirão
  // Serie A »). L'entrée `leagueCountry` du flux reste la source la plus fiable quand
  // elle est renseignée ; le nom seul ne couvrait qu'une partie des ligues.
  //
  // Le groupement résout au passage une ambiguïté réelle : la valeur d'un `SelectItem`
  // est le NOM de la ligue, et `Serie A` existe en Italie ET en Équateur, `Bundesliga`
  // en Allemagne ET en Autriche. Sans groupe, l'utilisateur voit deux « Serie A »
  // indistinguables et ne sait pas lequel il filtre. Le `SelectLabel` rend le pays
  // visible au-dessus de ses ligues.
  const leaguesByCountry = useMemo(() => {
    // country -> Set<league>
    const byCountry = new Map<string, Set<string>>();
    const add = (country: string, league: string) => {
      const key = country.trim() || AUTRE_PAYS;
      let set = byCountry.get(key);
      if (!set) {
        set = new Set<string>();
        byCountry.set(key, set);
      }
      set.add(league);
    };

    if (data) {
      for (const list of Object.values(data.strategies)) {
        for (const e of list) {
          if (e.league) add(leagueCountryOf(e.league) ?? "", e.league);
        }
      }
    }
    if (byCountry.size === 0) {
      // Repli sur la prop `matches` pendant le chargement de l'API.
      for (const m of matches) {
        if (m.league?.name) add(m.league.country ?? "", m.league.name);
      }
    }

    return [...byCountry.entries()]
      .map(([country, set]) => ({
        country,
        leagues: [...set].sort((a, b) => a.localeCompare(b, "fr")),
      }))
      .sort((a, b) => a.country.localeCompare(b.country, "fr"));
  }, [data, matches]);

  // Liste plate conservée pour le filtrage (l'état `league` reste le nom de la ligue).
  const leagues = useMemo(
    () => leaguesByCountry.flatMap((g) => g.leagues),
    [leaguesByCountry],
  );

  // 2 meilleurs marchés backtestés pour le championnat sélectionné.
  //
  // La requête ne part QUE lorsqu'un championnat est choisi : sans lui, l'onglet affiche
  // « Toutes les ligues » et un classement par marché n'aurait aucun sens à comparer à
  // une sélection. Aucun pari n'est déduit ici : la route rejoue le même moteur que le
  // backtest et renvoie ROI / taux de réussite déjà calculés.
  const [topMarkets, setTopMarkets] = useState<MarketBacktest[] | null>(null);
  useEffect(() => {
    if (!league) {
      setTopMarkets(null);
      return;
    }
    const ctrl = new AbortController();
    const url = `/api/football/backtest/markets?league=${encodeURIComponent(league)}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { markets?: MarketBacktest[] } | null) => setTopMarkets(d?.markets ?? []))
      .catch(() => {
        // Annulé (changement de ligue rapide) ou réseau coupé : on laisse l'état
        // précédent plutôt que d'afficher un classement faux. Pas d'erreur bloquante —
        // le tableau principal reste la fonction première du widget.
        if (!ctrl.signal.aborted) setTopMarkets(null);
      });
    return () => ctrl.abort();
  }, [league]);

  // `sampleOk` d'abord : un marché à 3 paris et +400 % de ROI n'est pas un « meilleur
  // marché », c'est du bruit. Le seuil MIN_SAMPLE_BETS est déjà appliqué côté moteur.
  const bestMarkets = useMemo(
    () =>
      (topMarkets ?? [])
        .filter((m) => m.sampleOk && m.nWithOdds > 0 && m.roiPct != null)
        .sort((a, b) => (b.roiPct ?? -Infinity) - (a.roiPct ?? -Infinity))
        .slice(0, 2),
    [topMarkets],
  );

  const rawRows = matchesFor(active);
  const rows = useMemo(
    () => rawRows.filter((e) => isInKickoffWindow(e.kickoff, timeWin)),
    [rawRows, timeWin],
  );

  // I5 : repli « Nul probable » quand gagnant est vide (max 3, fenêtre temporelle appliquée).
  const drawModalRows = useMemo(() => {
    if (active !== "gagnant" || rows.length > 0 || !data?.drawModal) return [];
    return data.drawModal.filter((e) => isInKickoffWindow(e.kickoff, timeWin));
  }, [active, rows.length, data, timeWin]);

  const forced = useMemo(() => {
    if (rows.length >= TOP_N) return [];
    const inRows = new Set(rows.map((r) => r.matchId));
    const out: StrategyMatchEntry[] = [];
    for (const item of Object.values(selectedItems)) {
      const defSel = STRATEGIES.find((s) => s.key === item.strategy);
      if (!defSel?.isProb) continue;
      if (item.entry.value < MIN_PROB_PCT) continue;
      if (inRows.has(item.entry.matchId)) continue;
      if (league && item.entry.league !== league) continue;
      out.push(item.entry);
    }
    return out;
  }, [rows, selectedItems, league]);

  const selectedCount = useMemo(() => Object.keys(selectedItems).length, [selectedItems]);

  const toggleSelect = (entry: StrategyMatchEntry) => {
    toggleStore(entry, active);
  };

  return (
    <section
      aria-label="Top 10 matchs par stratégie"
      className="w-full min-w-0 rounded-2xl p-3 sm:p-4"
      style={{ background: C.card, border: `1px solid ${C.cardBorder}` }}
    >
      {/* Header — même style que FotmobLeagueSection */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <h2
          className="text-[13px] font-semibold"
          style={{ color: C.headerText }}
        >
          Top 10 matchs
          {selectedCount > 0 && (
            <span
              className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-px align-middle font-mono text-[9px] font-bold"
              style={{ background: `${C.accent}15`, color: C.accent }}
              title="Matchs sélectionnés"
            >
              {selectedCount}
            </span>
          )}
        </h2>

        {/* Sélecteur de championnat */}
        <Select
          value={league ?? "__all__"}
          onValueChange={handleLeagueChange}
        >
          <SelectTrigger
            size="sm"
            aria-label="Championnat du Top 10"
            className="h-9 w-full rounded-lg text-base sm:text-xs font-medium sm:h-7 sm:w-52 !bg-white !border-[#f0f0f0] !text-[#222] dark:!bg-white dark:!text-[#222]"
          >
            <SelectValue placeholder="Toutes les ligues" />
          </SelectTrigger>
          <SelectContent className="!bg-white !border-[#f0f0f0] !text-[#222] dark:!bg-white dark:!text-[#222]">
            <SelectItem value="__all__" className="text-xs dark:!bg-white dark:!text-[#222]">
              Toutes les ligues
            </SelectItem>
            {leaguesByCountry.map((group) => (
              <SelectGroup key={group.country}>
                <SelectLabel className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#717171]">
                  <CountryFlag country={group.country} size={12} />
                  {group.country}
                </SelectLabel>
                {group.leagues.map((l) => (
                  <SelectItem key={l} value={l} className="text-xs dark:!bg-white dark:!text-[#222]">
                    {l}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {/* Top 2 marchés backtestés du championnat sélectionné — n'apparaît QUE
            lorsqu'un championnat est choisi, sinon le classement porterait sur
            l'ensemble des ligues et ne répondrait à rien. */}
        {league && bestMarkets.length > 0 && (
          <div
            className="flex w-full flex-wrap items-center gap-1.5"
            aria-label={`Meilleurs marchés backtestés — ${league}`}
          >
            {bestMarkets.map((m, i) => (
              <span
                key={m.key}
                title={`${m.label} · ${m.nWithOdds} paris cotés · ROI ${m.roiPct?.toFixed(1)} % · réussite ${m.winRatePct?.toFixed(0) ?? "—"} %`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0f0f0] bg-[#f5f5f5] px-2 py-1 text-[11px]"
              >
                <span aria-hidden>{i === 0 ? "🏆" : "🥈"}</span>
                <span className="font-semibold text-[#222]">{m.label}</span>
                <span className="font-mono tabular-nums text-[#717171]">
                  ROI {(m.roiPct ?? 0).toFixed(1)} %
                </span>
                <span className="font-mono tabular-nums text-[#717171]">
                  {(m.winRatePct ?? 0).toFixed(0)} %
                </span>
              </span>
            ))}
          </div>
        )}
        <Select value={active} onValueChange={handleStratChange}>
          <SelectTrigger
            size="sm"
            aria-label="Stratégie du Top 10"
            className="h-9 w-full rounded-lg text-base sm:text-xs font-medium sm:h-7 sm:w-56 !bg-white !border-[#f0f0f0] !text-[#222] dark:!bg-white dark:!text-[#222]"
          >
            <SelectValue placeholder="Choisir une stratégie…" />
          </SelectTrigger>
          <SelectContent className="!bg-white !border-[#f0f0f0] !text-[#222] dark:!bg-white dark:!text-[#222]">
            {STRATEGIES.map((s) => (
              <SelectItem key={s.key} value={s.key} className="text-xs dark:!bg-white dark:!text-[#222]">
                <span aria-hidden>{s.emoji}</span> {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtre temporel + fenêtre de forme */}
        <div className="flex shrink-0 items-center gap-1">
          <div
            className="flex overflow-hidden rounded"
            style={{ border: `1px solid ${C.cardBorder}` }}
            role="group"
            aria-label="Période des matchs"
          >
            {TIME_WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={handleTimeWinChange(w.key)}
                aria-pressed={timeWin === w.key}
                title={w.title}
                className={cn(
                  "min-h-[44px] px-3 font-mono text-[10px] font-bold uppercase transition-colors sm:min-h-0 sm:px-2 sm:py-0.5",
                  timeWin === w.key
                    ? "bg-[#00985f]/10 text-[#00985f]"
                    : "bg-transparent text-[#717171] hover:text-[#222]",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div
            className="flex overflow-hidden rounded"
            style={{ border: `1px solid ${C.cardBorder}` }}
            role="group"
            aria-label="Horaires des matchs"
          >
            {HOUR_WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={handleTimeWinChange(w.key)}
                aria-pressed={timeWin === w.key}
                title={`Matchs dans les ${w.label}`}
                className={cn(
                  "min-h-[44px] px-3 font-mono text-[10px] font-bold uppercase transition-colors sm:min-h-0 sm:px-2 sm:py-0.5",
                  timeWin === w.key
                    ? "bg-[#00985f]/10 text-[#00985f]"
                    : "bg-transparent text-[#717171] hover:text-[#222]",
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <div
            className="flex overflow-hidden rounded"
            style={{ border: `1px solid ${C.cardBorder}` }}
            role="group"
            aria-label="Fenêtre de forme"
          >
            {(["l5", "l10"] as WindowKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={handleWinKeyChange(k)}
                aria-pressed={winKey === k}
                className={cn(
                  "min-h-[44px] px-3 font-mono text-[10px] font-bold uppercase transition-colors sm:min-h-0 sm:px-2 sm:py-0.5",
                  winKey === k
                    ? "bg-[#00985f]/10 text-[#00985f]"
                    : "bg-transparent text-[#717171] hover:text-[#222]",
                )}
              >
                {k.replace("l", "L")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div role="status" aria-live="polite" className="flex items-center gap-2 px-1 py-3 text-xs" style={{ color: C.accent }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Calcul du Top 10…
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-1 py-3 text-xs text-[#EF4444]">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Top 10 indisponible ({(error as Error).message})
        </div>
      ) : rows.length === 0 && forced.length === 0 && drawModalRows.length === 0 ? (
        <div className="px-1 py-3 text-xs" style={{ color: C.time }}>
          <p>
            Aucun match qualifié pour cette stratégie sur «{" "}
            {TIME_WINDOWS.find((w) => w.key === timeWin)?.label ?? timeWin}
            »{league ? ` en ${league}` : ""}.
          </p>
          <p className="mt-1 opacity-80">Élargissez la période ou changez de championnat.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <TopStrategiesTable
            rows={toTableRows(rows, def, active)}
            strategy={active}
            windowLabel={TIME_WINDOWS.find((w) => w.key === timeWin)?.label}
          />
          {/* I5 : repli « Nul probable » grisé quand gagnant est vide */}
          {drawModalRows.length > 0 && (
            <div>
              <div className="mb-1 px-1 text-[11px] font-medium" style={{ color: C.time }}>
                Nul probable — pas de gagnant fiable
              </div>
              <TopStrategiesTable
                rows={toTableRows(drawModalRows, def, active)}
                strategy={active}
              />
            </div>
          )}
          {/* Sélections forcées (≥60%) */}
          {forced.length > 0 && (
            <div
              className="rounded-xl p-3"
              style={{ background: `${C.accent}08`, border: `1px solid ${C.accent}20` }}
            >
              <div className="mb-2 text-xs font-semibold" style={{ color: C.accent }}>
                Sélections forcées (≥60%)
              </div>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 md:grid-cols-2">
                {forced.map((entry) => (
                  <MatchRow
                    key={`forced-${entry.matchId}`}
                    entry={entry}
                    def={def}
                    winKey={winKey}
                    selected
                    onToggle={() => toggleSelect(entry)}
                    badge="Sélection"
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
