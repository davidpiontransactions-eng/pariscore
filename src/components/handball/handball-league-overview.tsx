"use client";

import { useMemo } from "react";
import useSWR from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HandballTeamLogo } from "./handball-team-logo";
import { HandballLeagueBadge } from "./handball-league-badge";
import { computePower } from "@/lib/handball-pariscore";
import { CMP_NEUTRAL_LAMBDA } from "@/lib/handball-cmp";
import {
  findVitibetCoveredLeague,
  vitibetLeagueRegistryId,
  type CoveredLeague,
} from "@/lib/handball-vitibet-leagues";
import type { BacktestDbPayload } from "@/app/api/handball/backtest-db/route";
import type { BacktestSettledBet } from "@/lib/handball-backtest-pariscore";

// ─── Types ───

/**
 * Répartition des issues sur les matchs TERMINÉS, et écart de buts domicile.
 *
 * `n` ne compte que les matchs RÉELS : les entrées `synthetic` sont exclues et
 * comptées à part, sinon un agrégat présenterait comme mesuré ce qui a été
 * généré pour couvrir l'historique manquant.
 */
export type OutcomeSplit = {
  /** Matchs réels analysés (hors synthétique). */
  n: number;
  /** Entrées synthétiques EXCLUES du calcul. */
  nSyntheticExcluded: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  /**
   * Buts du domicile moins ceux de l'extérieur, par match.
   *
   * ⚠️ À ne pas confondre avec `thresholds.homeAdvantageIndex` du moteur de
   * backtest : celui-ci est un PARAMÈTRE du modèle (comment il penche pour le
   * 1N2), celui-ci est une MESURE descriptive du championnat affiché.
   */
  goalsHomeMinusAwayPerMatch: number | null;
};

/** Une ligne de total (Over/Under) et sa rentabilité mesurée. */
export type TotalLineStat = {
  line: string;
  n: number;
  won: number;
  /** Taux de réussite 0-100 sur les paris réglés (annulés exclus). */
  winrate: number | null;
  /** Profit net cumulé en unités. */
  profitU: number;
};

/** Classement par Team Power. */
export type PowerRow = {
  team: string;
  /** Team Power 0-100 (50 = niveau moyen de la ligue). null si profil trop mince. */
  power: number | null;
  played: number;
  scoredAvg: number;
  concededAvg: number;
  form: string;
};

// ─── Calculs purs (testables, aucune valeur inventée) ───

/**
 * Répartition domicile / nul / extérieur d'une ligue couverte.
 *
 * Les matchs synthétiques (`synthetic: true`) sont retirés AVANT tout calcul et
 * comptés dans `nSyntheticExcluded` : les afficher comme des résultats réels
 * serait la faute de provenance exacte que ce projet refuse partout ailleurs.
 */
export function buildOutcomeSplit(league: CoveredLeague): OutcomeSplit {
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let n = 0;
  let nSyntheticExcluded = 0;

  for (const r of league.results) {
    if (r.synthetic) {
      nSyntheticExcluded++;
      continue;
    }
    n++;
    homeGoals += r.homeGoals;
    awayGoals += r.awayGoals;
    if (r.homeGoals > r.awayGoals) homeWins++;
    else if (r.homeGoals < r.awayGoals) awayWins++;
    else draws++;
  }

  return {
    n,
    nSyntheticExcluded,
    homeWins,
    draws,
    awayWins,
    homeGoals,
    awayGoals,
    goalsHomeMinusAwayPerMatch: n > 0 ? (homeGoals - awayGoals) / n : null,
  };
}

/**
 * Classement par Team Power, calculé avec la MÊME formule que le modèle live.
 *
 * On réutilise `computePower` au lieu d'inventer des pondérations : un
 * « Team Power » défini autrement ici afficherait un classement que rien ne
 * corrobore ailleurs dans l'application. `computePower` attend des HISTORIQUES
 * de buts, donc on les reconstruit depuis les matchs terminés de la ligue.
 *
 * `power: null` quand l'équipe n'a pas assez de matchs joués — une valeur sur
 * un profil mince est du bruit, pas un indice.
 */
export function buildPowerRanking(league: CoveredLeague): PowerRow[] {
  const gfByTeam = new Map<string, number[]>();
  const gaByTeam = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, v: number) => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  };

  // `results` est en ordre chronologique croissant : `computePower` prend la
  // FIN de la fenêtre, donc l'ordre doit être conservé tel quel.
  for (const r of league.results) {
    if (r.synthetic) continue;
    push(gfByTeam, r.home, r.homeGoals);
    push(gaByTeam, r.home, r.awayGoals);
    push(gfByTeam, r.away, r.awayGoals);
    push(gaByTeam, r.away, r.homeGoals);
  }

  const rows: PowerRow[] = league.standings.map((s) => ({
    team: s.team,
    power: computePower(gfByTeam.get(s.team) ?? [], gaByTeam.get(s.team) ?? [], league.baseline),
    played: s.played,
    scoredAvg: s.scoredAvg,
    concededAvg: s.concededAvg,
    form: s.form,
  }));

  // null en dernier : une equipe sans profil ne doit pas monter en tete du tableau.
  return rows.sort((a, b) => (b.power ?? -1) - (a.power ?? -1));
}

/**
 * Lignes de total les plus fréquentes, avec leur rentabilité RÉELLE.
 *
 * On regroupe par `pick` (« Over 53.5 », « Under 61.5 »…). Les paris annulés
 * (« void ») sortent du taux de réussite mais restent dans le volume : les
 * exclure ferait gonfler le win-rate d'un pari qui n'a pas été réglé.
 */
export function buildTotalLineStats(bets: BacktestSettledBet[], limit = 8): TotalLineStat[] {
  const byLine = new Map<string, { n: number; won: number; settled: number; profitU: number }>();
  for (const b of bets) {
    if (b.market !== "total") continue;
    const cur = byLine.get(b.pick) ?? { n: 0, won: 0, settled: 0, profitU: 0 };
    cur.n++;
    cur.profitU += b.profitU;
    if (b.result === "won") {
      cur.won++;
      cur.settled++;
    } else if (b.result === "lost") {
      cur.settled++;
    }
    byLine.set(b.pick, cur);
  }
  return [...byLine.entries()]
    .map(([line, v]) => ({
      line,
      n: v.n,
      won: v.won,
      winrate: v.settled > 0 ? (v.won / v.settled) * 100 : null,
      profitU: v.profitU,
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

// ─── Sous-composants ───

function fmt(v: number | null | undefined, digits = 1): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);
}

function Absent({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded bg-muted px-2 py-1.5 text-[11px] leading-snug text-[#717171]">
      {children}
    </p>
  );
}

// ─── Composant ───

const fetchJson = (url: string): Promise<BacktestDbPayload> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<BacktestDbPayload>;
  });

export type HandballLeagueOverviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nom de la ligue tel qu'il vient du match ou du sélecteur. */
  leagueName: string;
};

/**
 * HandballLeagueOverview — synthèse globale d'un championnat (bead f9p6.2).
 *
 * Trois sections, trois sources distinctes, et rien de plus :
 *   • Profil statistique → classement + matchs terminés Vitibet (les
 *     synthétiques sont exclus et COMPTÉS, jamais fusionnés en silence) ;
 *   • Marchés & backtest → `/api/handball/backtest-db`, via le pont
 *     `vitibetLeagueRegistryId`. `reason` est affiché tel quel : c'est lui qui
 *     distingue « pas d'historique » de « pas de cotes » ;
 *   • Team Power → `computePower`, la formule du modèle live, pas une autre.
 *
 * Ne rend RIEN hors ligue couverte par Vitibet : jamais la synthèse d'un autre
 * championnat sous le titre de celui demandé.
 */
export function HandballLeagueOverview({ open, onOpenChange, leagueName }: HandballLeagueOverviewProps) {
  const league = useMemo(() => findVitibetCoveredLeague(leagueName), [leagueName]);
  const registryId = useMemo(() => vitibetLeagueRegistryId(leagueName), [leagueName]);

  const { data, isLoading } = useSWR<BacktestDbPayload>(
    registryId ? `/api/handball/backtest-db?league=${encodeURIComponent(registryId)}` : null,
    fetchJson,
    { dedupingInterval: 30 * 60_000, revalidateOnFocus: false },
  );

  const split = useMemo(() => (league ? buildOutcomeSplit(league) : null), [league]);
  const power = useMemo(() => (league ? buildPowerRanking(league) : null), [league]);
  const lines = useMemo(
    () => buildTotalLineStats(data?.result?.bets ?? []),
    [data?.result?.bets],
  );

  if (!league || !split || !power) return null;

  const bt = data?.result ?? null;
  const btReason = data?.reason ?? null;
  const deltaVsGeneric = league.baseline - CMP_NEUTRAL_LAMBDA;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandballLeagueBadge leagueName={league.name} country={league.country} />
            Synthèse de championnat
          </DialogTitle>
          <DialogDescription>
            {league.gender === "F" ? "Féminin" : "Masculin"} · D{league.level} · Vitibet{" "}
            {league.vitibetLeagueId}
          </DialogDescription>
        </DialogHeader>

        {/* 1 — Profil statistique */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Profil statistique
          </h3>
          <table className="w-full text-[11px]">
            <tbody>
              <tr>
                <td className="py-0.5 pr-2 text-[#717171]">Base de buts (mesurée)</td>
                <td className="py-0.5 text-right font-mono tabular-nums">
                  {fmt(league.baseline)} /équipe
                </td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 text-[#717171]">vs générique modèle</td>
                <td
                  className={`py-0.5 text-right font-mono tabular-nums ${
                    deltaVsGeneric >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {deltaVsGeneric >= 0 ? "+" : ""}
                  {fmt(deltaVsGeneric)} ({fmt((deltaVsGeneric / CMP_NEUTRAL_LAMBDA) * 100)} %)
                </td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 text-[#717171]">Buts par match</td>
                <td className="py-0.5 text-right font-mono tabular-nums">
                  {fmt(league.goalsPerMatch)}
                </td>
              </tr>
            </tbody>
          </table>

          {split.n === 0 ? (
            <Absent>
              Aucun match TERMINÉ réel collecté pour cette ligue — la répartition
              domicile / nul / extérieur et l&apos;avantage du terrain ne sont pas
              mesurables.
              {split.nSyntheticExcluded > 0 &&
                ` ${split.nSyntheticExcluded} entrée(s) synthétique(s) existent mais sont exclues des métriques : elles ne sont pas des résultats.`}
            </Absent>
          ) : (
            <>
              <table className="w-full text-[11px]">
                <caption className="sr-only">
                  Issues des {split.n} matchs réels : {split.homeWins} victoires
                  domicile, {split.draws} nuls, {split.awayWins} victoires
                  extérieur
                </caption>
                <tbody>
                  <tr>
                    <td className="py-0.5 pr-2 text-[#717171]">Domicile / Nul / Extérieur</td>
                    <td className="py-0.5 text-right font-mono tabular-nums">
                      {split.homeWins} / {split.draws} / {split.awayWins}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-2 text-[#717171]">
                      Écart de buts domicile
                    </td>
                    <td className="py-0.5 text-right font-mono tabular-nums">
                      {fmt(split.goalsHomeMinusAwayPerMatch, 2)} /match
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-2 text-[#717171]">Matchs réels analysés</td>
                    <td className="py-0.5 text-right tabular-nums">{split.n}</td>
                  </tr>
                </tbody>
              </table>
              {split.nSyntheticExcluded > 0 && (
                <p className="text-[10px] leading-snug text-[#717171]">
                  {split.nSyntheticExcluded} entrée(s) synthétique(s) exclue(s) des
                  métriques ci-dessus.
                </p>
              )}
            </>
          )}
        </section>

        {/* 2 — Marchés & backtest */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Marchés &amp; backtest
          </h3>
          {registryId ? null : (
            <Absent>
              Cette ligue n&apos;est pas au registre de l&apos;historique — aucun
              backtest mesurable. Le panneau affiche donc ses métriques de
              classement sans chiffres de marché.
            </Absent>
          )}
          {registryId && isLoading && <Absent>Chargement du backtest…</Absent>}
          {registryId && !isLoading && btReason && !bt && (
            <Absent>{btReason}</Absent>
          )}
          {registryId && bt && (
            <>
              <table className="w-full text-[11px]">
                <tbody>
                  <tr>
                    <td className="py-0.5 pr-2 text-[#717171]">Volume / taux / ROI</td>
                    <td className="py-0.5 text-right font-mono tabular-nums">
                      {bt.global.nBets} paris · {fmt(bt.global.winrate)} % ·{" "}
                      {bt.global.roiPct == null ? "—" : `${fmt(bt.global.roiPct)} %`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-2 text-[#717171]">Marché 1N2</td>
                    <td className="py-0.5 text-right font-mono tabular-nums">
                      {bt.byMarket["1N2"]?.nBets ?? 0} paris
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-2 text-[#717171]">Marché total</td>
                    <td className="py-0.5 text-right font-mono tabular-nums">
                      {bt.byMarket.total?.nBets ?? 0} paris
                    </td>
                  </tr>
                </tbody>
              </table>

              {bt.nFormMatches === 0 && (
                <p className="text-[10px] leading-snug text-amber-500">
                  Aucun match n&apos;a utilisé le modèle ajusté (forme ≥ 3 matchs par
                  équipe) : ces KPI mesurent le prior neutre, pas la qualité de la
                  forme.
                </p>
              )}

              <h4 className="pt-1 text-[11px] font-semibold text-[#717171]">
                Lignes de total les plus fréquentes
              </h4>
              {lines.length === 0 ? (
                <Absent>Aucun pari de total émis sur cette ligue.</Absent>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[#717171]">
                      <th className="py-1 pr-2 font-medium">Ligne</th>
                      <th className="py-1 pr-2 text-right font-medium">n</th>
                      <th className="py-1 pr-2 text-right font-medium">Réussite</th>
                      <th className="py-1 text-right font-medium">Profit u</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.line} className="border-b border-border/50">
                        <td className="py-1 pr-2 font-mono">{l.line}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{l.n}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {fmt(l.winrate)} %
                        </td>
                        <td
                          className={`py-1 text-right font-mono tabular-nums ${
                            l.profitU >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {l.profitU >= 0 ? "+" : ""}
                          {fmt(l.profitU, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <p className="text-[10px] leading-snug text-[#717171]">{bt.methodology}</p>
            </>
          )}
        </section>

        {/* 3 — Team Power */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Team Power
          </h3>
          <table className="w-full text-[11px]">
            <caption className="sr-only">
              Team Power 0-100, 50 = niveau moyen de la ligue
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-[#717171]">
                <th className="py-1 pr-2 font-medium">Équipe</th>
                <th className="py-1 pr-2 text-right font-medium">Marq/ext</th>
                <th className="py-1 pr-2 text-right font-medium">Forme</th>
                <th className="py-1 text-right font-medium">Power</th>
              </tr>
            </thead>
            <tbody>
              {power.map((p) => (
                <tr key={p.team} className="border-b border-border/50">
                  <td className="py-1 pr-2">
                    <span className="flex items-center gap-1.5">
                      <HandballTeamLogo name={p.team} size={14} />
                      <span className="min-w-0 truncate font-medium">{p.team}</span>
                    </span>
                  </td>
                  <td className="py-1 pr-2 text-right font-mono tabular-nums">
                    {fmt(p.scoredAvg)}/{fmt(p.concededAvg)}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono text-[10px]">
                    {p.form || "—"}
                  </td>
                  <td
                    className={`py-1 text-right font-mono tabular-nums ${
                      p.power == null
                        ? "text-[#717171]"
                        : p.power >= 50
                          ? "text-emerald-600"
                          : "text-rose-600"
                    }`}
                  >
                    {fmt(p.power)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] leading-snug text-[#717171]">
            Power = formule du modèle live (`computePower`), 50 = niveau moyen de la
            ligue. « — » : pas assez de matchs joués.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}