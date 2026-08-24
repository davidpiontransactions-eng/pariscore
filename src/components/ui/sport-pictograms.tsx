/**
 * Pictogrammes sportifs PariScore — SVG originaux line-art.
 * viewBox 24 · trait currentColor 1.8 · caps/joints arrondis · lisibles dès 16px.
 * Dessinés maison (aucun asset tiers copié) ; langage visuel proche des
 * bookmakers (picto monochrome par sport dans conteneur arrondi).
 */
import type { SVGProps } from "react";

type PictoProps = SVGProps<SVGSVGElement>;

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Base({ children, ...props }: PictoProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden {...props}>
      {children}
    </svg>
  );
}

/** Accueil — maison. */
export function HomePicto(props: PictoProps) {
  return (
    <Base {...props}>
      <path {...strokeProps} d="M3.5 11 12 3.5 20.5 11M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" />
    </Base>
  );
}

/** Tennis — raquette cordée + balle. */
export function TennisPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <path
        {...strokeProps}
        d="M13.5 11.5 8 17.2m5.5-5.7c2.6-2 4.3-4.6 4.6-7-.4-.3-1-.5-1.7-.5-2.4 0-5.4 1.7-7.4 4.3-1.6 2.1-2.3 4.3-2 6 .4.3 1 .5 1.7.5 1.2 0 2.7-.5 4.1-1.4l-5.4 5.7m5.4-5.7L6.7 18.9"
      />
      <circle {...strokeProps} cx="5.4" cy="18.6" r="2.6" />
      <path {...strokeProps} d="M9 8c1.5 1.5 4 4 7 7" opacity=".55" />
    </Base>
  );
}

/** Football — ballon à facettes. */
export function FootballPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <circle {...strokeProps} cx="12" cy="12" r="9" />
      <path
        {...strokeProps}
        d="m12 7.2 3.6 2.6-1.4 4.2H9.8l-1.4-4.2L12 7.2Zm0-4.2v4.2M8.4 9.8 4 8.5m4.4 1.3 1.4 4.2-3 3.4m3-3.4h4.4l1.4 4.2m-1.4-4.2 3-3.4 4.4-1.3m-3 3.4-1.4-4.2"
      />
    </Base>
  );
}

/** CS2 / eSport — viseur. */
export function CrosshairPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <circle {...strokeProps} cx="12" cy="12" r="6.5" />
      <path {...strokeProps} d="M12 2.5V7m0 10v4.5M2.5 12H7m10 0h4.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </Base>
  );
}

/** MMA — gant de combat. */
export function MmaPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <path
        {...strokeProps}
        d="M8 10V5.5A1.5 1.5 0 0 1 9.5 4v0A1.5 1.5 0 0 1 11 5.5V9m0-4.5A1.5 1.5 0 0 1 12.5 3v0A1.5 1.5 0 0 1 14 4.5V9m0-3.5A1.5 1.5 0 0 1 15.5 4v0A1.5 1.5 0 0 1 17 5.5v5c0 3.6-2 6.5-5.5 6.5-2.3 0-4-1-5.2-2.7L4 11.5c-.5-.7-.3-1.6.4-2.1.6-.4 1.4-.3 2 .2L8 11V8.5"
      />
      <path {...strokeProps} d="M8 16.5c2.5 1 5.5 1 8-.5" opacity=".6" />
    </Base>
  );
}

/** Basket — ballon coutures. */
export function BasketballPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <circle {...strokeProps} cx="12" cy="12" r="9" />
      <path {...strokeProps} d="M3.2 12h17.6M12 3.2v17.6M5.6 5.6c3.5 3.7 3.5 9.1 0 12.8M18.4 5.6c-3.5 3.7-3.5 9.1 0 12.8" />
    </Base>
  );
}

/** Cyclisme — vélo. */
export function CyclingPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <circle {...strokeProps} cx="5.5" cy="16.5" r="3.8" />
      <circle {...strokeProps} cx="18.5" cy="16.5" r="3.8" />
      <path {...strokeProps} d="M5.5 16.5 9.5 8h5.5l3.5 8.5M9.5 8H7.8M13 8l1.5 4.5H7.2m9.3 0-2-6.5h2.7" />
      <path {...strokeProps} d="M14 4.5h3" />
    </Base>
  );
}

/** F1 — casque profil. */
export function HelmetPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <path
        {...strokeProps}
        d="M12 4a9 9 0 0 0-9 9v2.8c0 1 .8 1.7 1.7 1.7H9l1.6-2.5h8.8c1 0 1.6-.7 1.6-1.6V13a9 9 0 0 0-9-9Z"
      />
      <path {...strokeProps} d="M7.8 8.2c.6-.5 1.3-.9 2.2-1.1v2.4H7.6m4.4-2.6c1 .1 1.9.4 2.7 1v1.6H12V6.9m5.6 1.6a7 7 0 0 1 1.5 2h-2.3l-.8-1.7" />
    </Base>
  );
}

/** Baseball — coutures. */
export function BaseballPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <circle {...strokeProps} cx="12" cy="12" r="9" />
      <path {...strokeProps} d="M5.9 4.9c3.4 3.7 3.4 10.5 0 14.2M18.1 4.9c-3.4 3.7-3.4 10.5 0 14.2" />
      <path {...strokeProps} d="M7.3 6.9 5.6 8.2m3.4.3L7.3 9.7m9.4-2.8 1.7 1.3m-3.4.3 1.7 1.2" opacity=".65" />
    </Base>
  );
}

/** Rugby — ballon ovale lacets. */
export function RugbyPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <path
        {...strokeProps}
        d="M16.9 3.6c1.7-.5 3.1-.4 3.5 0s.5 1.8 0 3.5c-.7 2.7-2.4 6-5.2 8.8s-6.1 4.5-8.8 5.2c-1.7.5-3.1.4-3.5 0s-.4-1.8 0-3.5c.7-2.7 2.4-6 5.2-8.8s6.1-4.5 8.8-5.2Z"
      />
      <path {...strokeProps} d="m9.5 9.5 5 5m-4-3 -1.4 1.4m4-4 1.4-1.4m-3 3-1.4 1.4m4-4 1.4-1.4" />
    </Base>
  );
}
