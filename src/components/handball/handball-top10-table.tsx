"use client";

import { useMemo, useState } from "react";
import {
  countryFlag,
  formatTop10DateTime,
  type TopMatchStrategy,
  type TopMatchStrategyKind,
} from "@/lib/handball-top10";
import { HandballTeamLogo } from "./handball-team-logo";
import { HandballTableCaption } from "./handball-table-caption";

// ─── Sous-composants ───

/**
 * Drapeau + championnat, avec repli propre.
 *
 * Si l'emoji n'est pas supporté (Windows sans Segoe UI Emoji, readers RSS,
 * captures serveur), l'emoji s'affiche en tofu — on affiche alors le code ISO
 * en pastille. `title` porte toujours le nom complet pour l'accessibilité.
 */
export function LeagueFlag({
  iso,
  name,
}: {
  iso: string | null;
  name: string;
}) {
  const flag = countryFlag(iso);
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" title={`${name}${iso ? ` (${iso})` : ""}`}>
      {flag ? (
        <span aria-hidden="true" className="text-sm leading-none">
          {flag}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-4 min-w-[1.5rem] items-center justify-center rounded bg-[#f0f0f0] px-1 text-[9px] font-bold uppercase text-[#717171] dark:bg-white/10 dark:text-slate-300"
        >
          {iso ?? "··"}
        </span>
      )}
      <span className="truncate text-[11px] text-[#717171] dark:text-slate-400">{name}</span>
    </span>
  );
}

/**
 * Date & heure d'une ligne.
 *
 * Desktop : deux lignes compactes (daterelative ou JJ/MM, puis HH:MM).
 * Inline : une seule ligne « JJ/MM | HH:MM » avec séparateur, pour rester lisible
 * quand la colonne est rétrécie.
 */
function DateTimeCell({ dateTime }: { dateTime: string }) {
  const f = formatTop10DateTime(dateTime);
  if (!f) {
    return <span className="text-[11px] text-[#717171]">—</span>;
  }
  const icon = (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="h-3 w-3 shrink-0 text-[#717171] dark:text-slate-500"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <circle cx="6" cy="6" r="4.6" />
      <path d="M6 3.4V6l1.8 1.1" strokeLinecap="round" />
    </svg>
  );
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium tabular-nums text-[#717171] dark:text-slate-400">
      {icon}
      <span>
        {f.relative ?? f.day}
        <span className="mx-1 opacity-50">|</span>
        {f.time}
      </span>
    </span>
  );
}

// ─── Composant ───

/** Libellé lisible d'un filtre, par famille de stratégie. */
const KIND_LABEL: Record<TopMatchStrategyKind, string> = {
  over: "Over",
  under: "Under",
  favorite: "Victoire (1N2)",
  none: "Sans conseil",
};

/**
 * Badge « Total de points » — la LIGNE vient du modèle CMP via `totalLine`,
 * exposée par `buildTopMatchStrategy`. Ce composant ne recalcule rien : il
 * affiche le nombre du modèle, ou son absence.
 *
 * `totalLine === null` signifie « pas de marché de total sur cette ligne »
 * (stratégie favori 1N2). On l'affiche alors explicitement plutôt que de
 * masquer la colonne ou d'y mettre un tiret ambigu.
 */
function TotalPointsCell({ row }: { row: TopMatchStrategy }) {
  if (row.totalLine == null) {
    return (
      <span className="text-[11px] text-slate-500 dark:text-slate-400">
        Ligne indisponible
      </span>
    );
  }
  const isOver = row.kind === "over";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
          isOver
            ? "bg-sky-500/15 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300"
            : "bg-orange-500/15 text-orange-700 dark:bg-orange-400/20 dark:text-orange-300"
        }`}
      >
        {isOver ? "Over" : "Under"} {row.totalLine}
      </span>
      {row.prob != null && (
        <span className="font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {row.prob.toFixed(1)}%
        </span>
      )}
    </span>
  );
}

/**
 * HandballTop10Table — Top 10 des matchs par stratégie, filtrable.
 *
 * Responsive : sur mobile la ligne se replie en carte empilée (date/heure sous
 * le match, comme demandé) au lieu de défiler horizontalement ; à partir de
 * `md` le tableau 6 colonnes s'affiche.
 *
 * Ligne sans stratégie qualifiante : elle n'est jamais rendue (voir
 * `buildTop10`) — un tableau de lignes « — » n'aide pas l'utilisateur.
 */
export function HandballTop10Table({ rows }: { rows: TopMatchStrategy[] }) {
  // Filtre « ascenseur » : `<select>` natif plutôt qu'un listbox maison.
  // Le natif donne le picker mobile, la navigation clavier et le scroll de la
  // liste gratuitement ; un composant custom serait ~80 lignes de gestion
  // focus/ARIA pour un gain d'apparence, et une surface de bugs.
  const [filtre, setFiltre] = useState<TopMatchStrategyKind | "all">("all");

  // Seules les familles RÉELLEMENT présentes sont proposées : une option qui
  // ne filtrerait rien est un piège, pas une fonctionnalité.
  const familles = useMemo(() => {
    const presentes = new Set(rows.map((r) => r.kind));
    return (["over", "under", "favorite"] as const).filter((k) => presentes.has(k));
  }, [rows]);

  const visibles = useMemo(
    () => (filtre === "all" ? rows : rows.filter((r) => r.kind === filtre)),
    [rows, filtre],
  );

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[#717171] dark:text-slate-400">
        Aucun match n&apos;atteint 65 % de probabilité avec une cote ≥ 1.15 — aucun
        conseil n&apos;est publié.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* ── Filtre ascenseur ── */}
      {familles.length > 1 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="handball-top10-filtre"
            className="shrink-0 text-[11px] font-medium text-slate-700 dark:text-slate-300"
          >
            Stratégie
          </label>
          <select
            id="handball-top10-filtre"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as TopMatchStrategyKind | "all")}
            className="min-w-[9rem] rounded-md border border-[#f0f0f0] bg-white px-2 py-1 text-xs text-slate-900 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100"
          >
            <option value="all">Toutes ({rows.length})</option>
            {familles.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]} ({rows.filter((r) => r.kind === k).length})
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-600 dark:text-slate-400">
            {visibles.length} ligne{visibles.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Aucune ligne pour ce filtre.
        </p>
      ) : (
        <>
      {/* ── Mobile : cartes empilées ── */}
      <ul className="space-y-2 md:hidden">
        {visibles.map((r) => (
          <li
            key={`${r.matchId}-${r.kind}`}
            className="rounded-xl border border-[#f0f0f0] bg-white p-2.5 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0A2E5C] text-[10px] font-bold text-white">
                {r.rank}
              </span>
              <LeagueFlag iso={r.countryCode} name={r.leagueName} />
            </div>
            {/* Date/heure sous la ligue : pas de colonne dédiée qui écrase la
                largeur de l'écran. */}
            <div className="mt-1.5">
              <DateTimeCell dateTime={r.dateTime} />
            </div>
            <div className="mt-1 flex w-full min-w-0 items-center gap-1.5">
              <HandballTeamLogo name={r.home} size={16} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#222222] dark:text-white">
                {r.home} – {r.away}
              </span>
              <HandballTeamLogo name={r.away} size={16} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#0A2E5C]/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0A2E5C] dark:bg-[#0A2E5C]/40 dark:text-sky-300">
                {r.label}
              </span>
              {r.prob != null && (
                <span className="font-mono text-xs font-bold tabular-nums text-emerald-500">
                  {r.prob.toFixed(1)}%
                </span>
              )}
              {r.odds != null && (
                <span className="font-mono text-xs tabular-nums text-[#717171] dark:text-slate-400">
                  @{r.odds.toFixed(2)}
                </span>
              )}
              {r.qualifies && <ConfidenceBadge />}
            </div>
            {r.totalLine != null && (
              <div className="mt-1.5">
                <TotalPointsCell row={r} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ── Desktop : tableau 7 colonnes ── */}
      {/* `overflow-x-auto` seul ne sert à rien si le tableau peut rétrécir pour
          tenir dans la largeur : sans largeur MINIMALE, le navigateur compresse
          les colonnes au lieu de laisser défiler, et le nom des clubs écrase
          les colonnes voisines. `min-w` est le seuil qui déclenche réellement le
          scroll horizontal. 7 colonnes ⇒ seuil remonté de 640 à 760 px. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-xs">
          <HandballTableCaption>
            Top {rows.length} matchs par stratégie — probabilité ≥ 65 % et cote ≥ 1.15
          </HandballTableCaption>
          <thead>
            <tr className="border-b border-[#f0f0f0] text-left text-slate-700 dark:border-white/10 dark:text-slate-300">
              <th className="w-8 py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">Date / Heure</th>
              {/* Bornes identiques au <td> : sans elles, c'est l'en-tête qui
                  dimensionne la colonne et le `truncate` se recomprime. */}
              <th className="py-2 pr-2 font-medium min-w-[210px] max-w-[320px]">
                Match / Ligue
              </th>
              <th className="py-2 pr-2 font-medium">Stratégie</th>
              <th className="py-2 pr-2 font-medium min-w-[130px]">Total pts</th>
              <th className="py-2 pr-2 text-right font-medium">Probabilité</th>
              <th className="py-2 text-right font-medium">Cote</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr
                key={`${r.matchId}-${r.kind}`}
                className="border-t border-[#f0f0f0]/70 transition-colors hover:bg-[#fafafa] dark:border-white/5 dark:hover:bg-white/[0.03]"
              >
                <td className="py-2 pr-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#0A2E5C] text-[10px] font-bold text-white">
                    {r.rank}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <DateTimeCell dateTime={r.dateTime} />
                </td>
                <td className="py-2 pr-2 align-middle min-w-[210px] max-w-[320px]">
                  <LeagueFlag iso={r.countryCode} name={r.leagueName} />
                  <span className="mt-0.5 flex w-full min-w-0 items-center gap-1.5">
                    <HandballTeamLogo name={r.home} size={14} />
                    {/* `min-w-0 flex-1` : sans base de largeur, le nom le plus
                        long du tableau ne peut pas réduire et gonfle la colonne
                        jusqu'à écraser les 5 autres. */}
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                      {r.home} – {r.away}
                    </span>
                    <HandballTeamLogo name={r.away} size={14} />
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <span className="rounded bg-[#0A2E5C]/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0A2E5C] dark:bg-[#0A2E5C]/40 dark:text-sky-300">
                    {r.label}
                  </span>
                </td>
                <td className="py-2 pr-2 align-middle min-w-[130px]">
                  <TotalPointsCell row={r} />
                </td>
                <td className="py-2 pr-2 text-right">
                  {r.prob != null ? (
                    <span className="font-mono text-sm font-bold tabular-nums text-emerald-500">
                      {r.prob.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-400">—</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    {r.odds != null && (
                      <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {r.odds.toFixed(2)}
                      </span>
                    )}
                    {r.qualifies && <ConfidenceBadge />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

/** Badge « Sécurisé » — la ligne respecte P ≥ 65 % ET cote ≥ 1.15. */
function ConfidenceBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-500 ring-1 ring-emerald-500/25">
      <span aria-hidden="true">✓</span> Sécurisé
    </span>
  );
}
