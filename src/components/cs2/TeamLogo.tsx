"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { teamInitials } from "@/lib/cs2/types";
import { getFlagUrl } from "@/lib/flag-utils";

/**
 * Résolveur de logos résilient : affiche le logo officiel, et bascule sur un
 * badge d'initiales stylisé (couleur déterministe dérivée du nom) en cas
 * d'URL invalide, de 404 ou d'échec de chargement (onError).
 * Toutes les URLs externes sont sanitatisées (HTTPS obligatoire).
 */

function sanitizeLogoUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/** Teinte déterministe (HSL) dérivée du nom — "couleur de la structure". */
function teamHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

type Size = "sm" | "md" | "lg";

const SIZE_BOX: Record<Size, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-10 w-10 rounded-lg",
  lg: "h-14 w-14 rounded-xl",
};
const SIZE_IMG: Record<Size, string> = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-10 w-10" };
const SIZE_TEXT: Record<Size, string> = { sm: "text-[11px]", md: "text-xs", lg: "text-sm" };
const SIZE_FLAG: Record<Size, string> = {
  sm: "h-2.5 w-4",
  md: "h-3 w-4",
  lg: "h-3.5 w-5",
};

type Props = {
  name: string;
  logo?: string | null;
  country?: string | null;
  size?: Size;
  className?: string;
};

export function TeamLogo({ name, logo, country, size = "md", className }: Props) {
  const [failed, setFailed] = useState(false);
  const url = sanitizeLogoUrl(logo);
  const showImg = Boolean(url) && !failed;
  const hue = teamHue(name);

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center ring-1 ring-white/10",
          SIZE_BOX[size],
        )}
        style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 22% / 0.6), hsl(${hue} 45% 12% / 0.4))` }}
      >
        {showImg ? (
          <img
            src={url as string}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            className={cn("object-contain", SIZE_IMG[size])}
          />
        ) : (
          <span className={cn("font-bold text-zinc-200", SIZE_TEXT[size])}>
            {teamInitials(name)}
          </span>
        )}
      </div>
      {country && (
        <img
          src={getFlagUrl(country, 16, 12)}
          alt={country}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className={cn("absolute -bottom-1 -right-1 rounded-sm object-cover ring-1 ring-black", SIZE_FLAG[size])}
        />
      )}
    </div>
  );
}
