"use client";

/**
 * SVG refraction filters pour le liquid glass effect.
 * Chromium uniquement (pas de Firefox/Safari).
 * Les filtres sont rendus en SVG invisible dans le body.
 *
 * #lg-refract    — macro (navbar, sidebar) : baseFrequency 0.008, scale 0.45
 * #lg-refract-sm — petit (cards)           : baseFrequency 0.012, scale 0.30
 *
 * CSS gate dans globals.css :
 * html[data-lg-refraction] .liquid-glass { backdrop-filter: url("#lg-refract") }
 */

export function LiquidGlassFilter() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
    >
      <defs>
        {/* Macro refraction — navbar, sidebar */}
        <filter id="lg-refract">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008"
            numOctaves="3"
            seed="42"
            result="turbulence"
          />
          <feGaussianBlur
            in="turbulence"
            stdDeviation="1.5"
            result="blurred"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurred"
            scale="0.45"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Small refraction — cards */}
        <filter id="lg-refract-sm">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="2"
            seed="7"
            result="turbulence"
          />
          <feGaussianBlur
            in="turbulence"
            stdDeviation="1"
            result="blurred"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurred"
            scale="0.30"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
