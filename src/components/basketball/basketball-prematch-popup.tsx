"use client";

/**
 * BasketballPreMatchPopup — popup pré-match alimentée par le cache BSD local.
 *
 * Hiérarchie validée :
 *   (a) HAUT  — cotes des bookmakers, devig, marge mesurée → c'est l'ADN
 *   (b) BAS   — classement + forme last-10 → réassurance analytique
 *
 * ⚠️ AUCUN SPINNER. La donnée vient de `data/basketball_bsd_cache.json` lu par
 * `/api/basketball/bsd` : il n'y a pas d'attente réseau externe à simuler.
 * Les trois états (donnée / cache absent / cache périmé) sont explicites.
 *
 * Tokens sémantiques uniquement (`text-foreground`, `bg-background`…) pour le
 * mode sombre natif.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CachedOdds } from "@/lib/basketball-bsd-cache";
import {
  useBsdCache,
  findBsdFixture,
  findBsdFixtureByTeam,
  type BsdPreMatchFixture,
} from "@/hooks/use-bsd-cache";

/** Chargé à la demande : la fiche H2H tire sa propre source (`useH2HTeams`),
 *  inutile de l'embarquer tant que le bouton n'est pas pressé. */
const BasketballH2H = dynamic(
  () => import("./basketball-h2h").then((m) => m.BasketballH2H),
  { ssr: false },
);

// ─── Helpers purs (exportés pour test, sans JSX) ───────────────────────────

export type OddsRow = {
  bookmaker: string;
  slug: string;
  oddsHome: number;
  oddsAway: number;
  fairHome: number | null;
  fairAway: number | null;
  /** Marge MESURÉE, négative si le book a coté deux côtés > 2. */
  vigPct: number | null;
  updatedAt: string | null;
  /** true sur la meilleure cote de sa colonne (le meilleur prix). */
  isBestHome: boolean;
  isBestAway: boolean;
};

/**
 * Grille de cotes triée par le côté le plus fort.
 *
 * `side` décide de la colonne maîtresse : le client qui mise côté domicile
 * veut voir les bookmakers classés par cote domicile. Tri STABLE sur une
 * clé unique — deux égalités ne se départagent pas au hasard.
 */
export function buildOddsGrid(
  odds: readonly CachedOdds[],
  side: "home" | "away",
): OddsRow[] {
  // `> 0` ET non `!= null` : une cote à 0 est une ABSENCE (repli `?? 0`),
  // pas un prix. Avec un simple filtre `!= null`, 0.00 serait affiché et
  // pourrait se classer en MEILLEURE cote — exactement le « 0 déguisé en
  // mesure » que le reste de ce pipeline refuse ailleurs.
  const valid = odds.filter(
    (o) => o.oddsHome !== null && o.oddsHome > 0 && o.oddsAway !== null && o.oddsAway > 0,
  );
  const bestHome = valid.reduce((m, o) => Math.max(m, o.oddsHome!), -Infinity);
  const bestAway = valid.reduce((m, o) => Math.max(m, o.oddsAway!), -Infinity);

  const rows: OddsRow[] = valid.map((o) => ({
    bookmaker: o.bookmaker,
    slug: o.slug,
    oddsHome: o.oddsHome!,
    oddsAway: o.oddsAway!,
    fairHome: o.fairHome,
    fairAway: o.fairAway,
    vigPct: o.vigPct,
    updatedAt: o.updatedAt,
    isBestHome: o.oddsHome === bestHome,
    isBestAway: o.oddsAway === bestAway,
  }));

  rows.sort((a, b) =>
    side === "home" ? b.oddsHome - a.oddsHome : b.oddsAway - a.oddsAway,
  );
  return rows;
}

export type OddsSummary = {
  /** Nombre de livres ayant coté CE match. */
  count: number;
  /** Marge moyenne mesurée, en %. `null` si aucune marge exploitable. */
  meanVigPct: number | null;
  /** Cotes incohérentes (marge négative) — à signaler, pas à masquer. */
  suspiciousCount: number;
  bestHome: number | null;
  bestAway: number | null;
};

export function summarizeOdds(odds: readonly CachedOdds[]): OddsSummary {
  // Même règle que buildOddsGrid : 0 = absence, jamais un prix (sinon
  // `bestHome` pourrait renvoyer 0.00 affiché comme meilleure cote).
  const valid = odds.filter(
    (o) => o.oddsHome !== null && o.oddsHome > 0 && o.oddsAway !== null && o.oddsAway > 0,
  );
  const vigs = valid.map((o) => o.vigPct).filter((v): v is number => v !== null);
  const négatifs = vigs.filter((v) => v < 0);
  const mean = vigs.length ? vigs.reduce((a, b) => a + b, 0) / vigs.length : null;
  return {
    count: valid.length,
    meanVigPct: mean === null ? null : Math.round(mean * 100) / 100,
    suspiciousCount: négatifs.length,
    bestHome: valid.length ? Math.max(...valid.map((o) => o.oddsHome!)) : null,
    bestAway: valid.length ? Math.max(...valid.map((o) => o.oddsAway!)) : null,
  };
}

/** Libellé d'une ligne de classement : « 6e — 1V-0D » plutôt que zéro brut. */
export function standingLabel(
  s: { position: number; wins: number; losses: number; matches: number } | null,
): string | null {
  if (!s || s.matches === 0) return null;
  return `${s.position}${s.position === 1 ? "er" : "e"} — ${s.wins}V ${s.losses}D`;
}

/**
 * Couverture H2H d'une fixture — la règle, isolée du rendu.
 *
 * ⚠️ `basketball-h2h.tsx` n'expose QUE `{ className, defaultLeague }` et son
 * sélecteur verrouille `league: "nba" | "wnba"`. La base `data/basketball_h2h/`
 * ne contient que des fichiers `nba_*` — mesuré le 2026-10-06.
 *
 * On refuse donc d'étendre le type de ligue : élargir `"nba" | "wnba"` à
 * l'EuroCup alors qu'aucun fichier de données n'existe produirait un sélecteur
 * qui affiche une liste vide en prétendant couvrir la ligue. Le support est
 * déclaré par les données, pas par le type.
 *
 * Ids BSD relevés sur `/basketball/api/v2/leagues/` : 1=NBA, 2=Euroleague,
 * 6=Eurocup, 7=WNBA.
 */
export type H2hSupport =
  | { supported: true; league: "nba" | "wnba" }
  | { supported: false; league: null; reason: string };

export function h2hSupport(leagueBsdId: number | null): H2hSupport {
  if (leagueBsdId === 1) return { supported: true, league: "nba" };
  if (leagueBsdId === 7) return { supported: true, league: "wnba" };
  return {
    supported: false,
    league: null,
    reason:
      "Analyse H2H approfondie disponible uniquement sur les ligues NBA / WNBA. " +
      "Le classement et le last-10 de cette fenêtre couvrent le contexte essentiel.",
  };
}

/**
 * Traduit une erreur d'infrastructure en message lisible — JAMAIS de code HTTP.
 *
 * ⚠️ Un 502 n'a pas le sens « cache manquant ». C'est nginx annonçant que
 * l'upstream Next n'a pas répondu (fenêtre de redéparrage PM2, timeout…).
 * Afficher « HTTP 502 » au parieur, c'est lui parler d'un reverse-proxy : il
 * ne peut rien en faire. La route, elle, ne renvoie que du JSON (400/503).
 *
 * Le message expose donc ce qui lui arrive : « bookmakers indisponibles ».
 */
export function infraMessage(error: string | null | undefined): string | null {
  if (!error) return null;
  if (/^HTTP \d{3}$/.test(error) || /fetch failed|network|timeout|ECONN/i.test(error)) {
    return "Les données bookmakers sont temporairement indisponibles. Réessayez dans un instant.";
  }
  return error;
}

// ─── Composant ─────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rencontre visée, issue du calendrier. */
  leagueBsdId: number | null;
  homeName: string | null;
  awayName: string | null;
  /**
   * Déclencheur « clic sur un nom d'équipe » (calendrier). Mutuellement
   * exclusif avec la paire : le calendrier ne fournit qu'une équipe quand
   * `onTeamClick` remonte, donc on résout la fixture depuis le cache.
   */
  teamName?: string | null;
  title?: string;
};

export function BasketballPreMatchPopup({
  open,
  onOpenChange,
  leagueBsdId,
  homeName,
  awayName,
  teamName,
  title,
}: Props) {
  const { data, isLoading, error, isUnavailable, isStale } = useBsdCache();
  const [h2hOpen, setH2hOpen] = useState(false);
  const fixture = useMemo(
    () =>
      teamName
        ? findBsdFixtureByTeam(data, teamName)
        : findBsdFixture(data, leagueBsdId, homeName, awayName),
    [data, leagueBsdId, homeName, awayName, teamName],
  );

  // ⚠️ L'erreur ne doit JAMAIS balayer ce qu'on a déjà. SWR garde la donnée
  // précédente (`keepPreviousData`) : si le cache a été lu une fois puis que
  // l'infrastructure redémarre, les sections doivent rester affichées. Avant,
  // la branche `error` était testée AVANT `fixture`, donc un simple blip
  // fermait toute la popup alors que ses données étaient en mémoire.
  const notice = infraMessage(error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] sm:max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {title ?? (homeName && awayName ? `${homeName} vs ${awayName}` : "Pré-match")}
          </DialogTitle>
        </DialogHeader>

        {isLoading && !fixture ? (
          <p className="text-xs text-muted-foreground">Lecture du cache local…</p>
        ) : fixture ? (
          <>
            {/* Avertissement non bloquant — muted, pas rouge : ce n'est pas
                une faute de l'utilisateur. */}
            {notice && (
              <p
                className="rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground"
                role="note"
              >
                {notice}
              </p>
            )}
            {/* Fraîcheur : le popup affiche QUAND, il ne prétend pas au temps réel */}
            {isStale && (
              <p
                className="rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground"
                role="note"
              >
                {data?.freshnessNote ?? `Cache de ${data?.ageMinutes ?? "?"} min.`}
              </p>
            )}

            <OddsSection fixture={fixture} />
            <FormSection fixture={fixture} />
            <H2hEntry fixture={fixture} onOpen={() => setH2hOpen(true)} />
          </>
        ) : notice ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground" role="note">
            {notice}
            <span className="mt-1 block text-[10px]">
              Le classement et le last-10 ne sont pas lisibles sans cache.
            </span>
          </p>
        ) : isUnavailable ? (
          <p className="text-xs text-muted-foreground">
            Aucune donnée 1xBet pour cette rencontre. Le cache couvre les ligues
            servies par le cron — la donnée n&apos;est pas simulée.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aucune donnée 1xBet pour cette rencontre.
          </p>
        )}
      </DialogContent>

      {/* Entonnoir : Calendrier → Pré-match → Fiche H2H. La fiche porte sa
          propre source ; on ne l'ouvre que sur une ligue qu'elle couvre
          réellement (NBA/WNBA), sinon on explique — pas de sélecteur qui
          afficherait une liste vide sur l'EuroCup. */}
      {h2hOpen && (
        <H2hDialog fixture={fixture} onClose={() => setH2hOpen(false)} />
      )}
    </Dialog>
  );
}

/** Fiche H2H, isolée pour que l'affinement du type se fasse UNE fois. */
function H2hDialog({ fixture, onClose }: { fixture: BsdPreMatchFixture | null; onClose: () => void }) {
  if (!fixture) return null;
  const support = h2hSupport(fixture.leagueBsdId);
  // Référence unique : deux appels à `h2hSupport` empêchent TS d'affiner le
  // type du second (la union n'est pas préservée entre deux expressions).
  const defaultLeague = support.supported ? support.league : "nba";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Analyse H2H — {fixture.home.shortName} vs {fixture.away.shortName}
          </DialogTitle>
        </DialogHeader>
        <BasketballH2H defaultLeague={defaultLeague} />
      </DialogContent>
    </Dialog>
  );
}

/** Entrée « Voir l'analyse H2H » — bouton OU explication, jamais les deux. */
function H2hEntry({ fixture, onOpen }: { fixture: BsdPreMatchFixture; onOpen: () => void }) {
  const support = h2hSupport(fixture.leagueBsdId);
  if (!support.supported) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground" role="note">
        {support.reason}
      </p>
    );
  }
  return (
    <div className="flex justify-end">
      <Button variant="outline" size="sm" onClick={onOpen} className="h-7 text-xs">
        Voir l&apos;analyse H2H
      </Button>
    </div>
  );
}

function OddsSection({ fixture }: { fixture: BsdPreMatchFixture }) {
  const { odds } = fixture;
  const rows = useMemo(() => buildOddsGrid(odds, "home"), [odds]);
  const sum = useMemo(() => summarizeOdds(odds), [odds]);

  if (sum.count === 0) {
    return (
      <section aria-label="Cotes" className="rounded-lg border p-3">
        <h4 className="text-xs font-semibold">Cotes</h4>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Aucun bookmaker n&apos;a coté ce match. Absence affichée, pas de valeur
          par défaut.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Cotes" className="rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold">Cotes — {sum.count} bookmakers</h4>
        <span className="text-[11px] text-muted-foreground">
          marge moyenne {sum.meanVigPct !== null ? `${sum.meanVigPct} %` : "n.c."}
        </span>
      </div>
      {sum.suspiciousCount > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {sum.suspiciousCount} cote{sum.suspiciousCount > 1 ? "s" : ""} à marge
          négative (cote bookmaker incohérente) — non corrigée.
        </p>
      )}

      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th className="py-1 text-left font-medium">Bookmaker</th>
              <th className="py-1 text-right font-medium">Dom.</th>
              <th className="py-1 text-right font-medium">Juste</th>
              <th className="py-1 text-right font-medium">Ext.</th>
              <th className="py-1 text-right font-medium">Juste</th>
              <th className="py-1 text-right font-medium">Marge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-t border-border/50">
                <td className="py-1 pr-2">{r.bookmaker}</td>
                <td
                  className={cn(
                    "py-1 text-right tabular-nums font-medium",
                    r.isBestHome && "text-primary",
                  )}
                >
                  {r.oddsHome.toFixed(2)}
                </td>
                <td className="py-1 text-right tabular-nums text-muted-foreground">
                  {r.fairHome !== null ? r.fairHome.toFixed(3) : "—"}
                </td>
                <td
                  className={cn(
                    "py-1 text-right tabular-nums font-medium",
                    r.isBestAway && "text-primary",
                  )}
                >
                  {r.oddsAway.toFixed(2)}
                </td>
                <td className="py-1 text-right tabular-nums text-muted-foreground">
                  {r.fairAway !== null ? r.fairAway.toFixed(3) : "—"}
                </td>
                <td
                  className={cn(
                    "py-1 text-right tabular-nums",
                    r.vigPct !== null && r.vigPct < 0 && "text-destructive",
                  )}
                >
                  {r.vigPct !== null ? `${r.vigPct.toFixed(2)} %` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Source {fixture.oddsSource ?? "n/a"} · juste = cote après retrait de la
        marge (proportionnel) · meilleure cote en surbrillance.
      </p>
    </section>
  );
}

/** Une cellule de métrique. Déclarée AU NIVEAU MODULE : une composant créée
 *  pendant le rendu redevient un type neuf à chaque render (state réinitialisé
 *  à chaque fois) — règle react-hooks/static-components. */
function StatCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs tabular-nums">{value ?? "—"}</span>
    </div>
  );
}

function FormSection({ fixture }: { fixture: BsdPreMatchFixture }) {
  const pre = fixture.pregame;
  if (!pre) {
    return (
      <section aria-label="Forme" className="rounded-lg border p-3">
        <h4 className="text-xs font-semibold">Forme & classement</h4>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Rapport pré-match non disponible pour ce match.
        </p>
      </section>
    );
  }

  const homeLabel = standingLabel(pre.homeStanding);
  const awayLabel = standingLabel(pre.awayStanding);

  return (
    <section aria-label="Forme et classement" className="rounded-lg border p-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-xs font-semibold">Forme & classement</h4>
        <Badge variant="outline" className="text-[10px] font-normal">
          {fixture.home.shortName} / {fixture.away.shortName}
        </Badge>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted/40 p-2">
          <div className="text-[11px] font-medium">{fixture.home.name}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-y-1">
            <StatCell label="Classement" value={homeLabel} />
            <StatCell
              label="Pts marqués (10)"
              value={pre.last10ScoredHome !== null ? String(pre.last10ScoredHome) : null}
            />
            <StatCell
              label="Total match (10)"
              value={pre.last10TotalHome !== null ? String(pre.last10TotalHome) : null}
            />
            <StatCell label="Entraîneur" value={pre.homeCoach} />
          </div>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <div className="text-[11px] font-medium">{fixture.away.name}</div>
          <div className="mt-1.5 grid grid-cols-2 gap-y-1">
            <StatCell label="Classement" value={awayLabel} />
            <StatCell
              label="Pts marqués (10)"
              value={pre.last10ScoredAway !== null ? String(pre.last10ScoredAway) : null}
            />
            <StatCell
              label="Total match (10)"
              value={pre.last10TotalAway !== null ? String(pre.last10TotalAway) : null}
            />
            <StatCell label="Entraîneur" value={pre.awayCoach} />
          </div>
        </div>
      </div>

      {pre.venue && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          {pre.venue.name} · {pre.venue.city} ·{" "}
          {pre.venue.capacity !== null ? `${pre.venue.capacity.toLocaleString("fr-FR")} places` : "capacité n.c."}
        </p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        Source {fixture.predictionSource ?? "n/a"} · les valeurs absentes sont
        rendues « — », jamais 0.
      </p>
    </section>
  );
}
