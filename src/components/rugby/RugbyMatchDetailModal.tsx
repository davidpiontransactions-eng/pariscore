"use client";

/**
 * Panneau détail d'un match rugby : prédiction complète, marchés dérivés
 * (over/under, handicap, bandes de marge), comparaison des équipes, historique
 * des confrontations et marqueurs d'essai probables.
 */

import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRugbyMatchDetail } from "@/lib/hooks/use-rugby";
import type { RugbyPrediction, TeamRating } from "@/lib/rugby/types";
import {
  Card,
  FormBadges,
  ProbBar,
  RugbyTeamLogo,
  VerdictBadge,
  fmtDateLong,
  fmtHandicap,
  fmtTime,
  pct,
} from "./rugby-ui";

export function RugbyMatchDetailModal({
  slug,
  matchId,
  onClose,
}: {
  slug: string | null;
  matchId: string | null;
  onClose: () => void;
}) {
  const open = Boolean(slug && matchId);
  const { data, isLoading } = useRugbyMatchDetail(open ? slug : null, open ? matchId : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const detail = data?.detail ?? null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0d1017] text-slate-100">
        <DialogHeader>
          <DialogTitle className="sr-only">Détail du match rugby</DialogTitle>
        </DialogHeader>

        {!detail ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <p className="text-sm text-slate-400">{isLoading ? "Chargement…" : "Détail indisponible."}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* En-tête */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-400">
                {detail.competition?.name ?? "Rugby"}
              </p>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <TeamBlock rating={detail.homeRating} name={detail.match.home.name} logo={detail.match.home.logo} align="left" />
                <div className="text-center">
                  <p className="text-[11px] font-semibold text-slate-500">{fmtDateLong(detail.match.date)}</p>
                  <p className="text-lg font-black text-white">{fmtTime(detail.match.date)}</p>
                  {detail.match.venue && <p className="mt-1 max-w-[160px] truncate text-[11px] text-slate-500">{detail.match.venue}</p>}
                </div>
                <TeamBlock rating={detail.awayRating} name={detail.match.away.name} logo={detail.match.away.logo} align="right" />
              </div>
            </div>

            {detail.prediction ? (
              <>
                <VerdictBanner prediction={detail.prediction} homeName={detail.match.home.name} awayName={detail.match.away.name} />
                <ProbSection prediction={detail.prediction} />
                <MarketsSection prediction={detail.prediction} />
                <ComparisonSection home={detail.homeRating} away={detail.awayRating} homeName={detail.match.home.name} awayName={detail.match.away.name} />
              </>
            ) : (
              <Card className="p-4 text-sm text-slate-400">Prédiction indisponible pour ce match.</Card>
            )}

            {detail.h2h.length > 0 && <H2HSection h2h={detail.h2h} homeId={detail.match.home.id} />}
            {detail.tryScorers.length > 0 && <TryScorersSection scorers={detail.tryScorers} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function TeamBlock({
  rating,
  name,
  logo,
  align,
}: {
  rating: TeamRating | null;
  name: string;
  logo: string;
  align: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <RugbyTeamLogo src={logo} name={name} size={40} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{name}</p>
        {rating && (
          <p className="text-[11px] font-semibold tabular-nums text-teal-300">Elo {Math.round(rating.elo)}</p>
        )}
        {rating && <div className={`mt-1 flex ${align === "right" ? "justify-end" : ""}`}><FormBadges form={rating.form} /></div>}
      </div>
    </div>
  );
}

function VerdictBanner({ prediction, homeName, awayName }: { prediction: RugbyPrediction; homeName: string; awayName: string }) {
  const pickName =
    prediction.verdictTeamId === null ? null : prediction.verdict === "backing-home" || prediction.verdict === "leaning-home" ? homeName : awayName;
  return (
    <Card className="flex items-center justify-between gap-3 border-teal-500/20 bg-teal-500/[0.06] p-4">
      <div>
        <VerdictBadge verdict={prediction.verdict} />
        {pickName && <p className="mt-1.5 text-sm font-bold text-white">{pickName}</p>}
      </div>
      <div className="text-right">
        <p className="text-2xl font-black tabular-nums text-teal-300">{pct(prediction.confidence)}</p>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">confiance</p>
      </div>
    </Card>
  );
}

function ProbSection({ prediction }: { prediction: RugbyPrediction }) {
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Probabilités 1X2</h4>
      <div className="mb-2 flex items-center justify-between text-sm font-bold tabular-nums">
        <span className="text-teal-300">{pct(prediction.homeWinProb)}</span>
        <span className="text-slate-500">{pct(prediction.drawProb)}</span>
        <span className="text-sky-300">{pct(prediction.awayWinProb)}</span>
      </div>
      <ProbBar homePct={prediction.homeWinProb} awayPct={prediction.awayWinProb} drawPct={prediction.drawProb} className="h-2.5" />
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <StatBox label="Score attendu" value={`${Math.round(prediction.expectedHomeScore)}–${Math.round(prediction.expectedAwayScore)}`} />
        <StatBox label="Score probable" value={prediction.mostLikelyScore} />
        <StatBox label="Marge attendue" value={`${prediction.expectedMargin > 0 ? "+" : ""}${prediction.expectedMargin.toFixed(1)}`} />
      </div>
    </Card>
  );
}

function MarketsSection({ prediction }: { prediction: RugbyPrediction }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-4">
        <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Total de points</h4>
        <div className="space-y-1.5">
          {prediction.overUnderLines.map((o) => (
            <div key={o.line} className="flex items-center justify-between text-xs tabular-nums">
              <span className="font-semibold text-slate-300">{o.line}</span>
              <span className="text-slate-400">
                <span className="text-emerald-300">O {pct(o.over)}</span> · <span className="text-red-300">U {pct(o.under)}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Handicap & marge</h4>
        <div className="mb-2 flex items-center justify-between text-xs tabular-nums">
          <span className="font-semibold text-slate-300">
            Spread domicile {fmtHandicap(prediction.handicap.line)}
          </span>
          <span className="text-slate-400">
            <span className="text-teal-300">{pct(prediction.handicap.homeCoverProb)}</span> / <span className="text-sky-300">{pct(prediction.handicap.awayCoverProb)}</span>
          </span>
        </div>
        {/* Histogramme des bandes de marge (probabilité cumulée de gagner de X+) */}
        <div className="mt-3 space-y-2" role="img" aria-label="Distribution des marges par bande">
          {prediction.marginBands.map((b) => {
            const h = Math.round(b.homeProb * 100);
            const a = Math.round(b.awayProb * 100);
            return (
              <div key={b.label}>
                <div className="mb-1 flex items-center justify-between text-[11px] tabular-nums">
                  <span className="font-semibold text-slate-400">Gagne de {b.label}</span>
                  <span className="text-slate-500">
                    <span className="text-teal-300">{h}%</span> / <span className="text-sky-300">{a}%</span>
                  </span>
                </div>
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="bg-teal-400" style={{ width: `${h}%` }} />
                  <div className="bg-sky-400" style={{ width: `${a}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ComparisonSection({
  home,
  away,
  homeName,
  awayName,
}: {
  home: TeamRating | null;
  away: TeamRating | null;
  homeName: string;
  awayName: string;
}) {
  if (!home || !away) return null;
  const rows: { label: string; home: string; away: string }[] = [
    { label: "Elo", home: String(Math.round(home.elo)), away: String(Math.round(away.elo)) },
    { label: "Attaque", home: home.attack.toFixed(2), away: away.attack.toFixed(2) },
    { label: "Défense", home: home.defence.toFixed(2), away: away.defence.toFixed(2) },
    { label: "Points marqués", home: String(home.pointsFor), away: String(away.pointsFor) },
    { label: "Points encaissés", home: String(home.pointsAgainst), away: String(away.pointsAgainst) },
    { label: "Bilan", home: `${home.wins}V-${home.draws}N-${home.losses}D`, away: `${away.wins}V-${away.draws}N-${away.losses}D` },
    { label: "Repos", home: home.restDays === null ? "—" : `${home.restDays} j`, away: away.restDays === null ? "—" : `${away.restDays} j` },
  ];
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Comparaison</h4>
      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center text-xs font-bold">
        <span className="truncate text-teal-300">{homeName}</span>
        <span className="px-3 text-slate-600">vs</span>
        <span className="truncate text-right text-sky-300">{awayName}</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center text-xs tabular-nums">
            <span className="font-semibold text-slate-200">{r.home}</span>
            <span className="px-3 text-[11px] uppercase tracking-wide text-slate-500">{r.label}</span>
            <span className="text-right font-semibold text-slate-200">{r.away}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function H2HSection({ h2h, homeId }: { h2h: { date: string; home: { id: string; name: string }; away: { id: string; name: string }; homeScore: number | null; awayScore: number | null }[]; homeId: string }) {
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Confrontations directes</h4>
      <div className="space-y-2">
        {h2h.map((m, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-[#0b0e14] px-3 py-2 text-xs ring-1 ring-white/5">
            <span className="w-20 shrink-0 truncate text-[11px] text-slate-500">{fmtDateLong(m.date)}</span>
            <span className="min-w-0 flex-1 truncate text-center font-semibold text-slate-200">
              {m.home.name} <span className="text-teal-300">{m.homeScore ?? "–"}</span> – <span className="text-sky-300">{m.awayScore ?? "–"}</span> {m.away.name}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TryScorersSection({ scorers }: { scorers: { playerName: string; teamName: string; position: string; anytimeProb: number; firstTryProb: number; expectedTries: number }[] }) {
  const top = scorers.slice(0, 8);
  return (
    <Card className="p-4">
      <h4 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Marqueurs d&apos;essai probables</h4>
      <div className="space-y-1.5">
        {top.map((s, i) => (
          <div key={`${s.playerName}-${s.teamName}`} className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-semibold text-slate-100">
                {s.playerName}
                {i < 3 && (
                  <span className="shrink-0 rounded-full bg-teal-500/15 px-1.5 py-px text-[9px] font-black text-teal-300 ring-1 ring-teal-500/40">
                    Top {i + 1}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">{s.teamName} · {s.position}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className="text-[11px] text-slate-500">{s.expectedTries.toFixed(2)} ess.</span>
              <span className="w-14 text-right font-bold text-teal-300">{pct(s.anytimeProb)}</span>
              <span className="w-14 text-right text-[11px] text-slate-500">1er {pct(s.firstTryProb)}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        Probabilité &quot;anytime&quot; de marquer au moins un essai, et probabilité d&apos;ouvrir le score (1er essai).
        Le top 3 est la sélection à valeur du modèle.
      </p>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#0b0e14] px-2 py-2.5 ring-1 ring-white/5">
      <p className="text-base font-black tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
