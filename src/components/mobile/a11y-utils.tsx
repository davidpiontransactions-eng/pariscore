import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * LiveRegion
 *
 * Composant pour announce dynamique aux screen readers.
 * Utilise aria-live pour announcements non-intrusives.
 *
 * Usage :
 * <LiveRegion>
 *   {matchCount} matchs disponibles
 * </LiveRegion>
 *
 * <LiveRegion politeness="assertive">
 *   Erreur de chargement
 * </LiveRegion>
 */

type Props = {
  children: ReactNode;
  /** Politeness level : "polite" (défaut) ou "assertive" (urgent) */
  politeness?: "polite" | "assertive";
  /** Classe CSS optionnelle */
  className?: string;
};

export function LiveRegion({
  children,
  politeness = "polite",
  className,
}: Props) {
  return (
    <div
      aria-live={politeness}
      aria-atomic="true"
      className={cn("sr-only", className)}
    >
      {children}
    </div>
  );
}

/**
 * StatusRegion
 *
 * Pour les status updates (loading, success, error).
 * Visible visuellement + annoncé aux screen readers.
 *
 * Usage :
 * <StatusRegion status="loading">Chargement des matchs...</StatusRegion>
 * <StatusRegion status="success">12 matchs chargés</StatusRegion>
 * <StatusRegion status="error">Erreur de chargement</StatusRegion>
 */

type StatusProps = {
  children: ReactNode;
  status: "loading" | "success" | "error" | "info";
  className?: string;
};

const STATUS_STYLES = {
  loading: "text-zinc-400",
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-sky-400",
};

export function StatusRegion({ children, status, className }: StatusProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-sm", STATUS_STYLES[status], className)}
    >
      {status === "loading" && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status === "success" && (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === "error" && (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {children}
    </div>
  );
}

/**
 * SkipLink
 *
 * Lien "Aller au contenu principal" pour keyboard navigation.
 * Visible au focus, masqué sinon.
 */

type SkipLinkProps = {
  href?: string;
  children?: ReactNode;
};

export function SkipLink({ href = "#main-content", children = "Aller au contenu principal" }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
        "focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white",
        "focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-background"
      )}
    >
      {children}
    </a>
  );
}

/**
 * FocusIndicator
 *
 * Indicateur visuel de focus pour les éléments interactifs.
 * Améliore la visibilité du focus pour keyboard navigation.
 */

export function FocusIndicator() {
  return (
    <style jsx global>{`
      /* Focus ring amélioré pour tous les éléments interactifs */
      :focus-visible {
        outline: 2px solid rgba(0, 230, 118, 0.5);
        outline-offset: 2px;
        border-radius: 4px;
      }

      /* Désactiver le focus ring par défaut sur les boutons */
      button:focus:not(:focus-visible),
      a:focus:not(:focus-visible),
      input:focus:not(:focus-visible),
      select:focus:not(:focus-visible),
      textarea:focus:not(:focus-visible) {
        outline: none;
      }

      /* Focus ring personnalisé pour les boutons */
      button:focus-visible {
        outline: 2px solid rgba(0, 230, 118, 0.5);
        outline-offset: 2px;
      }
    `}</style>
  );
}
