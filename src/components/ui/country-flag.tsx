"use client";

/**
 * CountryFlag — drapeau SVG local (jamais d'emoji).
 * Les emojis drapeaux (🇩🇪…) s'affichent en lettres "DE" sous Windows
 * (pas de glyphe) → on sert public/flags/<iso>.svg avec repli monogramme.
 * Accepte : code ISO ("DE"), nom flashscore ("GERMANY"), nom courant ("germany").
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

/* Noms flashscore MAJUSCULES → ISO (miroir handball-logos, sans import circulaire). */
const NAME_TO_ISO: Record<string, string> = {
  GERMANY: "de",
  FRANCE: "fr",
  SPAIN: "es",
  DENMARK: "dk",
  NORWAY: "no",
  SWEDEN: "se",
  HUNGARY: "hu",
  PORTUGAL: "pt",
  ITALY: "it",
  AUSTRIA: "at",
  SWITZERLAND: "ch",
  NETHERLANDS: "nl",
  BELGIUM: "be",
  TURKEY: "tr",
  GREECE: "gr",
  POLAND: "pl",
  "CZECH REPUBLIC": "cz",
  CZECHIA: "cz",
  SLOVAKIA: "sk",
  SLOVENIA: "si",
  CROATIA: "hr",
  SERBIA: "rs",
  LUXEMBOURG: "lu",
  LITHUANIA: "lt",
  ESTONIA: "ee",
  FINLAND: "fi",
  ICELAND: "is",
  BELARUS: "by",
  "NORTH MACEDONIA": "mk",
  RUSSIA: "ru",
  EUROPE: "eu",
  ENGLAND: "gb",
  ROMANIA: "ro",
  BULGARIA: "bg",
  CYPRUS: "cy",
  UKRAINE: "ua",
};

/** Résout un nom/code pays vers un code ISO minuscule, ou "" si inconnu. */
export function resolveFlagIso(input: string | undefined | null): string {
  if (!input) return "";
  const t = input.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toLowerCase();
  return NAME_TO_ISO[t.toUpperCase()] ?? "";
}

export function CountryFlag({
  country,
  size = 14,
  className,
}: {
  country: string | undefined | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const iso = resolveFlagIso(country);
  // ASIA et inconnus : pictogramme globe (rendu OK sous Windows, pas d'indicateur régional).
  if (!iso || country?.toUpperCase() === "ASIA") {
    return (
      <span aria-hidden className={cn("shrink-0 leading-none", className)} style={{ fontSize: size }}>
        🌏
      </span>
    );
  }
  if (failed) {
    return (
      <span
        aria-hidden
        title={country ?? undefined}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground",
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(8, size - 6) }}
      >
        {iso.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`/flags/${iso}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-[2px] object-cover", className)}
      style={{ width: size, height: Math.round(size * 0.75) }}
    />
  );
}
