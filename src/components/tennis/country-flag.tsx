"use client";

import { cn } from "@/lib/utils";

export type CountryFlagSize = "sm" | "md" | "lg";

type CountryFlagProps = {
  countryCode?: string | null;
  size?: CountryFlagSize;
  className?: string;
};

const SIZE_MAP: Record<CountryFlagSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
};

function getFlagEmoji(countryCode?: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CountryFlag({ countryCode, size = "md", className }: CountryFlagProps) {
  return (
    <span
      className={cn("inline-flex shrink-0", SIZE_MAP[size], className)}
      role="img"
      aria-label={countryCode ?? "unknown"}
    >
      {getFlagEmoji(countryCode)}
    </span>
  );
}