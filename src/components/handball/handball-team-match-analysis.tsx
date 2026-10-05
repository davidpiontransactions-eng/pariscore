"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HandballTeamLogo } from "./handball-team-logo";
import { useHandballH2H } from "@/hooks/use-handball-h2h";
import {
  findFixture,
  findTeamStats,
  findVitibetCoveredLeague,
  type CoveredLeague,
} from "@/lib/handball-vitibet-leagues";
import type {
  TeamSeasonStats,
  VitibetFixtureRow,
} from "@/lib/handball-vitibet-league";

// ─── Types ───

/** Un profil d'équipe, ventilé domicile / extérieur / global. */
export type TeamProfile = {
  stats: TeamSeasonStats;
  /** Buts marqués par match (moyenne globale). */
  scoredAvg: number;
  /** Buts encaissés par match (moyenne globale). */
  concededAvg: number;
};

/**
 * Confrontation attaque/défense, rapportée à la base de buts de la ligue.
 *
 * `ratio` = (attaque de A) / (défense de B), en buts/équipe. Le repère est la
 * base MESURÉE de la ligue (`league.baseline`), jamais `CMP_NEUTRAL_LAMBDA` :
 * sur la Superlig (33.5) un repère à 28.5 ferait passer une défense normale
 * pour une défense faible.
 */
export type MatchupCell = {
  /** Attaque de l'équipe A confrontée à la défense de l'équipe B. */
  ratio: number;
  /** Interprétation face à la base de la ligue (>1 = avantage). */
  verdict: "avantage" | "equilibre" | "influence";
};

/** Ce que la source publie réellement sur ce match — jamais complété. */
export type PredictionAvailability = {
  available: boolean;
  reason: string;
  fixture: VitibetFixtureRow | null;
};

// ─── Calculs (déterministes, testables, sans donnée simulée) ───

/**
 * Attaque de `attacker` contre défense de `defender`, rapportée à la base.
 *
 * La défense est utilisée telle quelle : une bonne défense encaisse peu, donc
 * `ratio` monte quand l'attaque frappe une défense faible. Un ratio de 1.0
 * signifie « cette attaque lit la base de la ligue des deux côtés ».
 */
export function buildMatchup(
  attacker: TeamProfile,
  defender: TeamProfile,
  leagueBaseline: number,
): MatchupCell {
  const ratio = leagueBaseline > 0 ? attacker.scoredAvg / defender.concededAvg : 0;
  return {
    ratio,
    verdict: ratio > 1.15 ? "avantage" : ratio < 0.85 ? "influence" : "equilibre",
  };
}

/**
 * Vitibet publie-t-il une prédiction pour CE match ?
 *
 * `predictions_available` est porté par le MATCH, pas par la ligue : mesuré,
 * la Superlig publie 10 prédictions sur 19 matchs et la Liga NA Women 0 sur 16.
 * Une ligue peut donc avoir les deux. On ne comble JAMAIS un `null` par un
 * calcul maison : une valeur présentée comme Vitibet qui n'en vient pas de
 * Vitibet est un mensonge de provenance.
 */
export function predictionAvailability(
  league: CoveredLeague,
  homeTeamName: string,
  awayTeamName: string,
): PredictionAvailability {
  const fixture = findFixture(league, homeTeamName, awayTeamName);
  if (!fixture) {
    return {
      available: false,
      reason: "Match absent du calendrier Vitibet collecté — aucune donnée source.",
      fixture: null,
    };
  }
  if (fixture.predictionsAvailable !== true) {
    return {
      available: false,
      reason:
        "Vitibet ne publie pas de prévision sur ce match (match terminé ou non couvert).",
      fixture,
    };
  }
  return { available: true, reason: "Prévision publiée par Vitibet.", fixture };
}

// ─── Sous-composants ───

function fmt(v: number | null | undefined, digits = 1): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);
}

function RatioRow({
  label,
  cell,
}: {
  label: string;
  cell: MatchupCell | null;
}) {
  const tone =
    cell?.verdict === "avantage"
      ? "text-emerald-600 dark:text-emerald-400"
      : cell?.verdict === "influence"
        ? "text-rose-600 dark:text-rose-400"
        : "text-[#717171]";
  return (
    <tr>
      <td className="py-0.5 pr-2 text-[#717171]">{label}</td>
      <td className={`py-0.5 text-right font-mono tabular-nums ${tone}`}>
        {cell ? `${fmt(cell.ratio, 2)}×` : "—"}
      </td>
      <td className="py-0.5 pl-2 text-right text-[10px] text-[#717171]">
        {cell?.verdict === "avantage"
          ? "avantage"
          : cell?.verdict === "influence"
            ? "défense forte"
            : cell
              ? "équilibre"
              : "—"}
      </td>
    </tr>
  );
}

/** Bloc « cette donnée n'existe pas » — jamais une ligne de « — » silencieuse. */
function Absent({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded bg-muted px-2 py-1.5 text-[11px] leading-snug text-[#717171]">
      {children}
    </p>
  );
}

// ─── Composant ───

export type HandballTeamMatchAnalysisProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nom de la ligue tel qu'il vient du match (peut porter le préfixe pays). */
  leagueName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
};

/**
 * HandballTeamMatchAnalysis — analyse approfondie d'un duel (bead f9p6.1).
 *
 * Squelette câblé sur les sources EXISTANTES, aucune source inventée :
 *   • Forces/Faiblesses  → classement Vitibet (global + splits D/E + forme)
 *   • Matchup Matrix    → ces mêmes chiffres rapportés à la base MESURÉE
 *   • H2H + forme       → /api/handball/h2h (snapshot BetExplorer)
 *   • Prévision / EV    → `predictions_available` DU MATCH, jamais la ligue
 *
 * Contrat d'honnêteté : chaque section absente affiche POURQUOI elle est
 * absente. Aucune valeur n'est estimée, extrapolée ou complétée par un calcul
 * maison pour meubler l'écran.
 */
export function HandballTeamMatchAnalysis({
  open,
  onOpenChange,
  leagueName,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
}: HandballTeamMatchAnalysisProps) {
  const league = useMemo(
    () => findVitibetCoveredLeague(leagueName),
    [leagueName],
  );

  const { home, away, matchup, availability } = useMemo(() => {
    if (!league) {
      return { home: null, away: null, matchup: null, availability: null };
    }
    const byName = (name: string, id?: number | null) =>
      findTeamStats(league, name) ??
      (id != null ? league.standings.find((s) => s.teamId === id) ?? null : null);
    const h = byName(homeTeamName, homeTeamId);
    const a = byName(awayTeamName, awayTeamId);
    const hp = h ? { stats: h, scoredAvg: h.scoredAvg, concededAvg: h.concededAvg } : null;
    const ap = a ? { stats: a, scoredAvg: a.scoredAvg, concededAvg: a.concededAvg } : null;
    return {
      home: hp,
      away: ap,
      matchup:
        hp && ap
          ? {
              homeAttack: buildMatchup(hp, ap, league.baseline),
              awayAttack: buildMatchup(ap, hp, league.baseline),
            }
          : null,
      availability: predictionAvailability(league, homeTeamName, awayTeamName),
    };
  }, [league, homeTeamName, awayTeamName, homeTeamId, awayTeamId]);

  const { h2h, source, scrapedAt, isLoading: h2hLoading } = useHandballH2H(
    homeTeamName,
    awayTeamName,
  );

  // Ligue non couverte : rien à analyser, et surtout pas l'affichage des chiffres
  // d'un autre championnat. L'appelant garde son affichage générique.
  if (!league) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Analyse du duel</DialogTitle>
          <DialogDescription>
            {league.name} · base mesurée {fmt(league.baseline)} buts/équipe · Vitibet{" "}
            {league.vitibetLeagueId}
          </DialogDescription>
        </DialogHeader>

        {/* 1 — Forces & faiblesses */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Forces &amp; faiblesses
          </h3>
          {home && away ? (
            <div className="grid grid-cols-2 gap-2">
              {[home, away].map((p) => (
                <div key={p.stats.team} className="rounded-lg border border-border p-2">
                  <div className="mb-1 flex items-center gap-1.5">
                    <HandballTeamLogo name={p.stats.team} size={16} />
                    <span className="min-w-0 truncate text-[11px] font-semibold">
                      {p.stats.team}
                    </span>
                  </div>
                  <table className="w-full text-[11px]">
                    <tbody>
                      <tr>
                        <td className="py-0.5 pr-2 text-[#717171]">Marqués/m</td>
                        <td className="py-0.5 text-right tabular-nums">{fmt(p.scoredAvg)}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 pr-2 text-[#717171]">Encaissés/m</td>
                        <td className="py-0.5 text-right tabular-nums">{fmt(p.concededAvg)}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 pr-2 text-[#717171]">Domicile</td>
                        <td className="py-0.5 text-right tabular-nums">
                          {p.stats.home.played} m
                        </td>
                      </tr>
                      <tr>
                        <td className="py-0.5 pr-2 text-[#717171]">Forme</td>
                        <td className="py-0.5 text-right font-mono">{p.stats.form || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <Absent>
              Au moins une des deux équipes est absente du classement Vitibet de cette
              ligue — ratios non calculables.
            </Absent>
          )}
        </section>

        {/* 2 — Matchup Matrix */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Matchup Matrix
          </h3>
          {matchup ? (
            <table className="w-full text-[11px]">
              <caption className="sr-only">
                Attaque de chaque équipe rapportée à la défense de l&apos;adversaire, base{" "}
                {fmt(league.baseline)} buts par équipe
              </caption>
              <tbody>
                <RatioRow label={`Attaque ${home?.stats.team} vs défense ${away?.stats.team}`} cell={matchup.homeAttack} />
                <RatioRow label={`Attaque ${away?.stats.team} vs défense ${home?.stats.team}`} cell={matchup.awayAttack} />
              </tbody>
            </table>
          ) : (
            <Absent>Matchup indisponible : un des deux profils manque.</Absent>
          )}
        </section>

        {/* 3 — H2H (BetExplorer) */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Confrontations passées
          </h3>
          {h2hLoading ? (
            <Absent>Chargement de l&apos;historique…</Absent>
          ) : source === "none" ? (
            <Absent>
              Snapshot BetExplorer absent — l&apos;historique H2H n&apos;est pas disponible
              {scrapedAt ? "" : " (aucun scrape enregistré)"}. Ce n&apos;est pas un
              dossier vierge : c&apos;est une source manquante.
            </Absent>
          ) : h2h.length === 0 ? (
            <Absent>
              Aucune confrontation enregistrée entre ces deux clubs dans le périmètre
              BetExplorer collecté.
            </Absent>
          ) : (
            <ul className="space-y-1 text-[11px]">
              {h2h.map((m, i) => (
                <li
                  key={`${m.meeting_date ?? "?"}-${m.home}-${m.away}-${i}`}
                  className="flex justify-between gap-2"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-[#717171]">{m.meeting_date ?? "date n/a"}</span>{" "}
                    {m.home} – {m.away}
                    {m.league ? (
                      <span className="text-[#717171]"> · {m.league}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">
                    {m.score.home}:{m.score.away}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4 — Diagnostic Pariscore / value bet */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Diagnostic Pariscore
          </h3>
          {availability?.available && availability.fixture ? (
            <table className="w-full text-[11px]">
              <tbody>
                <tr>
                  <td className="py-0.5 pr-2 text-[#717171]">Score prédit Vitibet</td>
                  <td className="py-0.5 text-right font-mono tabular-nums">
                    {availability.fixture.predictedHome} : {availability.fixture.predictedAway}
                  </td>
                </tr>
                {availability.fixture.tip && (
                  <tr>
                    <td className="py-0.5 pr-2 text-[#717171]">Tip Vitibet</td>
                    <td className="py-0.5 text-right font-mono">{availability.fixture.tip}</td>
                  </tr>
                )}
                {availability.fixture.probHome != null &&
                  availability.fixture.probDraw != null &&
                  availability.fixture.probAway != null && (
                    <tr>
                      <td className="py-0.5 pr-2 text-[#717171]">P(1) / P(X) / P(2)</td>
                      <td className="py-0.5 text-right font-mono tabular-nums">
                        {availability.fixture.probHome} / {availability.fixture.probDraw} /{" "}
                        {availability.fixture.probAway}
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          ) : (
            /* Panneau financier DÉSACTIVÉ : ni EV ni ligne Over/Under ne sont
               calculés ici. Un EV sans cote de marché n'a pas de sens, et le
               nombre affiché serait une invention. */
            <Absent>
              {availability?.reason ?? "Donnée de prévision indisponible."} Les Expected
              Value et lignes Over/Under restent masqués — sans cote, un EV est
              indéfini, pas « nul ».
            </Absent>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}