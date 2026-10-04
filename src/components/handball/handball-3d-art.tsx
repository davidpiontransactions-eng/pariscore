"use client";

import Image from "next/image";
import {
  HANDBALL_ART_BLUE,
  HANDBALL_ART_RED,
  handballArtSrc,
  type HandballArt,
  type HandballArtSize,
} from "@/lib/handball-art";

// ─── Primitive ───────────────────────────────────────────────────────────────

/**
 * Une illustration 3D de l'onglet Handball.
 *
 * `onError` masque le nœud si l'asset est absent : sans ça, un 404 affiche une
 * icône cassée au milieu de la page. Le dégradé du parent reste, donc la mise
 * en page ne bouge pas.
 */
function Art({
  art,
  size = "banner",
  className,
  priority = false,
}: {
  art: HandballArt;
  size?: HandballArtSize;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={handballArtSrc(art, size)}
      alt={art.alt}
      width={art.width}
      height={art.height}
      // PAS de `srcSet` manuel : `next/image` le construit lui-même depuis
      // `sizes` + la config `deviceSizes`. Passer le nôtre entre en conflit avec
      // le loader et court-circuite l'optimisation.
      sizes={size === "banner" ? "100vw" : "(max-width: 640px) 200px, 280px"}
      priority={priority}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLElement).style.display = "none";
      }}
    />
  );
}

// ─── Bannière d'onglet ───────────────────────────────────────────────────────

/**
 * HandballHeroBanner — bandeau d'en-tête de l'onglet Handball.
 *
 * Les rendus ont un fond **opaque** (arène floutée) : l'image est donc en
 * `absolute inset-0 object-cover` — pleine largeur, pas un joueur détouré — et le
 * dégradé passe par-dessus. C'est la composition initialement demandée
 * (`from-slate-900 via-slate-900/80 to-transparent`).
 *
 * Le dégradé est indispensable, pas décoratif : sans lui, le texte blanc se pose
 * sur un public photo non contrôlé et le contraste n'est plus garanti. `via` à
 * 80 % maintient la zone texte opaque, `to-transparent` laisse voir la photo à
 * droite.
 *
 * L'illustration est `aria-hidden` : décorative, le titre porte le sens.
 */
export function HandballHeroBanner({
  title = "Handball",
  subtitle,
  art = HANDBALL_ART_BLUE,
}: {
  title?: string;
  subtitle?: string;
  art?: HandballArt;
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl bg-slate-900">
      <div aria-hidden className="absolute inset-0">
        <Art
          art={art}
          priority
          className="h-full w-full object-cover object-[70%_35%]"
        />
      </div>
      {/* Voile supplémentaire : le dégradé seul laisse fuir le texte sur les
          zones claires de la photo. `from-slate-900/95` garantit le contraste
          sans tuer l'image à droite. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"
      />
      <div className="relative px-4 py-5 sm:px-6 sm:py-7">
        <h2 className="text-lg font-black uppercase tracking-wide text-white sm:text-xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 max-w-[62%] text-xs text-slate-300">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Carte avec illustration ────────────────────────────────────────────────

/**
 * MatchCard3D — en-tête de carte de prédiction, illustration adoucie à droite
 * du score prédit.
 *
 * L'image étant **opaque**, elle ne peut pas « flotter » : un rectangle photo
 * posé sur une carte blanche se voit immédiatement. D'où le `mask-image`
 * radial — l'image se fond dans la carte au lieu de poser un rectangle. En
 * repli (navigateurs sans `mask-image`), `opacity-25` garde le rendu discret.
 *
 * Effets au survol demandés : scaling + glow néon. Sous `motion-safe:` pour
 * respecter `prefers-reduced-motion` — une animation au survol chez quelqu'un
 * qui a demandé moins de mouvement est un défaut d'accessibilité.
 */
export function MatchCard3D({
  home,
  away,
  score,
  art = HANDBALL_ART_RED,
  hint,
}: {
  home: string;
  away: string;
  /** Score prédit, ex. « 28 - 26 ». null = pas encore de prédiction. */
  score?: string | null;
  art?: HandballArt;
  hint?: string;
}) {
  return (
    <div className="group relative isolate overflow-hidden rounded-xl border border-[#f0f0f0] bg-white p-3 transition-shadow duration-200 hover:shadow-[0_0_0_1px_rgba(0,230,118,0.35),0_8px_28px_rgba(0,230,118,0.12)] dark:border-white/10 dark:bg-white/[0.04]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-25 transition-all duration-300 [mask-image:radial-gradient(ellipse_at_center,#000_25%,transparent_72%)] motion-safe:group-hover:scale-105 motion-safe:group-hover:opacity-40"
      >
        <Art art={art} size="card" className="h-full w-full object-cover object-left" />
      </div>
      <div className="relative max-w-[62%] sm:max-w-[68%]">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-[#717171]">
          {home} <span className="mx-1 text-[#b0b0b0]">vs</span> {away}
        </p>
        <p className="mt-0.5 font-mono text-xl font-black tabular-nums text-[#222222] dark:text-white">
          {score ?? "—"}
        </p>
        {hint ? <p className="mt-0.5 text-[10px] text-[#717171]">{hint}</p> : null}
      </div>
    </div>
  );
}

// ─── État vide / chargement ─────────────────────────────────────────────────

/**
 * HandballArtEmpty — illustration pour les états d'attente de la vue Live.
 * `role="status"` + `aria-live` pour que le changement soit annoncé.
 */
export function HandballArtEmpty({
  label,
  art = HANDBALL_ART_RED,
}: {
  label: string;
  art?: HandballArt;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-2 py-6 text-center"
    >
      <Art
        art={art}
        size="badge"
        className="h-24 w-40 rounded-xl object-cover object-[65%_35%] motion-safe:animate-pulse"
      />
      <p className="text-sm text-[#717171]">{label}</p>
    </div>
  );
}

export { Art as HandballArt3D };