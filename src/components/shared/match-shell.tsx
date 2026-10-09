import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchStateBadge } from "@/components/shared/match-state-badge";
import { parisKickoff, parisDayLabel } from "@/lib/football-time";
import type { MatchState } from "@/lib/match-state";

/** Identité de la compétition — obligatoire, jamais optionnelle (voir doc du shell). */
export interface MatchShellCompetition {
  name: string;
  flagIso?: string;
}

export interface MatchShellProps {
  /** État du match → `MatchStateBadge`. */
  state: MatchState;
  /** Raison affichée quand l'état est bloqué (suspended / postponed / canceled). */
  stateReason?: string;
  competition: MatchShellCompetition;
  /**
   * Horodatage ISO du coup d'envoi. **Optionnel** : plusieurs sports ne le portent pas
   * encore sur leur type local. Quand il manque ou est illisible, le bloc temps est
   * **omis** plutôt qu'affiché en `--:--` — un tiret horaire est une information fausse,
   * pas une donnée manquante signalée.
   */
  startTime?: string;
  /**
   * En-tête personnalisé (bannière image, overlay…). **Remplace** la barre d'identité
   * par défaut : ne pas passer les deux, sinon la ligue et l'heure apparaissent deux fois.
   * Utilisez `MatchShellIdentity` dans le banner pour conserver le badge d'état.
   *
   * Attention : si le banner rend son propre `MatchStateBadge`, il doit passer
   * `stateReason` — sinon un `postponed` sans raison affiche « Raison non communiquée par
   * le flux » (c'est le repli du badge, pas un blanc : il n'a jamais rien d'inventé).
   */
  banner?: ReactNode;
  /** Contenu sport-spécifique : scores, sets, rounds, frames. */
  children: ReactNode;
  /** Slot optionnel : cote bookmaker vs probabilité modèle. */
  decision?: ReactNode;
  /** Slot optionnel : boutons d'action (suivi, pari, partage). */
  actions?: ReactNode;
  className?: string;
}

interface MatchShellIdentityProps {
  state: MatchState;
  stateReason?: string;
  competition: MatchShellCompetition;
  /** Voir `MatchShellProps.startTime` — optionnel, omet le bloc temps si illisible. */
  startTime?: string;
  /** `overlay` = posé sur une image sombre (blanc), `inline` = barre sur fond clair. */
  tone?: "overlay" | "inline";
  className?: string;
}

/**
 * `true` si l'horodatage rend une heure lisible.
 *
 * `parisKickoff` se contente de renvoyer `--:--` sur une date illisible : un tiret est
 * une information **fausse** (elle ressemble à une heure valide), pas une donnée manquante
 * annoncée. Mieux vaut omettre le bloc temps — l'heure n'est jamais la seule piste de
 * navigation d'une carte de match.
 */
function hasReadableKickoff(iso: string | undefined): boolean {
  return iso != null && iso !== "" && !Number.isNaN(Date.parse(iso));
}

/**
 * MatchShellIdentity — le bloc « compétition + heure + état », à part.
 *
 * Extrait pour deux raisons : les sports qui rendent un banner image doivent pouvoir
 * poser ce bloc **dedans** (au-dessus d'une image sombre → `tone="overlay"`), et c'est
 * ainsi que l'état reste visible même quand la barre par défaut est remplacée.
 */
export function MatchShellIdentity({
  state,
  stateReason,
  competition,
  startTime,
  tone = "inline",
  className,
}: MatchShellIdentityProps) {
  const overlay = tone === "overlay";
  // `kickoff` est null quand l'horodatage manque ou est illisible : le bloc temps est
  // alors omis. Un `--:--` ressemble à une heure valide et ment sur le fond ; l'heure
  // n'est pas la seule piste de navigation d'une carte, contrairement à l'état, rendu
  // toujours.
  const kickoff = startTime && hasReadableKickoff(startTime) ? startTime : null;
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="flex min-w-0 items-center gap-1.5">
        {competition.flagIso ? (
          <span aria-hidden className="text-xs">
            {competition.flagIso}
          </span>
        ) : null}
        <span
          className={cn(
            "truncate text-xs font-semibold",
            overlay ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {competition.name}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {kickoff ? (
          <span
            className={cn(
              "flex items-center gap-1 text-xs tabular-nums",
              overlay ? "text-white/60" : "text-muted-foreground",
            )}
          >
            <Clock className="h-3 w-3" aria-hidden />
            <time dateTime={kickoff}>{parisKickoff(kickoff)}</time>
            <span className="hidden sm:inline">· {parisDayLabel(kickoff)}</span>
          </span>
        ) : null}
        <MatchStateBadge state={state} reason={stateReason} />
      </div>
    </div>
  );
}

/**
 * MatchShell — coquille commune des cartes de match, tous sports.
 *
 * **Ce que le shell standardise** : la présence explicite de l'état, l'identité du match,
 * et les slots `decision` / `actions`. C'est ce qui traite la dette « plusieurs cartes,
 * aucune convention d'état » — le football n'affichait aucun état du tout avant.
 *
 * **Ce que le shell ne fait PAS** : imposer un layout. Une carte tennis TV-style et une
 * carte snooker n'ont pas la même silhouette ; forcer l'une sur l'autre serait une
 * régression. Le shell est une **contrainte d'API**, pas un gabarit visuel.
 *
 * Contrat : `competition` est **obligatoire**, `startTime` **optionnel**. Une carte sans
 * identité n'est pas navigable — « PSG – OM » sans compétition n'a aucun sens dans une
 * liste qu'on scrolle. L'heure, elle, est absente de certains types locaux : elle est
 * rendue quand elle est lisible, omise sinon, jamais devinée.
 */
export function MatchShell({
  state,
  stateReason,
  competition,
  startTime,
  banner,
  children,
  decision,
  actions,
  className,
}: MatchShellProps) {
  return (
    <article
      className={cn(
        "group relative max-w-full overflow-hidden rounded-2xl border border-border/70 bg-card transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5",
        className,
      )}
    >
      {banner ?? (
        <div className="border-b border-border/40 px-3 py-2">
          <MatchShellIdentity
            state={state}
            stateReason={stateReason}
            competition={competition}
            startTime={startTime}
          />
        </div>
      )}

      <div className="p-4 pt-3">
        {children}

        {/* Slot `decision` : absent = aucun pari proposé sur ce match. C'est ce qui
            rend le shell polymorphe sans forcer un pari là où il n'y en a pas. */}
        {decision ? <div className="mt-3">{decision}</div> : null}

        {actions ? (
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border/40 pt-3">
            {actions}
          </div>
        ) : null}
      </div>
    </article>
  );
}