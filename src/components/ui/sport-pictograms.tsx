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
        d="m12 7.2 3.6 2.6-1.4 4.2H9.8l-1.4-4.2L12 7.2Zm0-4.2v4.2M8.4 9.8 4 8.5m4.4 1.3 1.4 4.2-3 3.4m3-3.4h4.4l1.4 4.2m-1.4-4.2 3-3.4h4.4l1.4 4.2m-1.4-4.2 3-3.4h4.4l1.4 4.2m-3 3.4-1.4-4.2"
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
        d="M8 10V5.5A1.5 1.5 0 0 1 9.5 4v0A1.5 1.5 0 0 1 11 5.5V9m0-4.5A1.5 1.5 0 0 1 12.5 3v0A1.5 1.5 0 0 1 13 4.5V9m0-3.5A1.5 1.5 0 0 1 14 4.5V9m0-3.5A1.5 1.5 0 0 1 15.5 4v0A1.5 1.5 0 0 1 16 5.5v5c0 3.6-2 6.5-5.5 6.5-2.3 0-4-1-5.2-2.7L4 11.5c-.5-.7-.3-1.6.4-2.1 6-.4 1.4-.3 2 .2L8 11V8.5"
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
        d="M16.9 3.6c1.7-.5 3.1-.4 3.5 0s.5 1.8 0 3.5c-.7 2.7-2.4 6-5.2 8.8s-6.1 4.5-8.8 5.2c-1.7.5-3.1.4-3.5 0s-.5-1.8 0-3.5c.7-2.7 2.4-6 5.2-8.8s6.1-4.5 8.8-5.2Z"
      />
      <path {...strokeProps} d="m9.5 9.5 5 5m-4-3 -1.4 1.4m4-4 1.4-1.4m-3 3-1.4 1.4m4-4 1.4-1.4" />
    </Base>
  );
}

/** Snooker — bille n°8 (cercle + médaillon central). */
export function SnookerPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <circle {...strokeProps} cx="12" cy="12" r="9" />
      <circle {...strokeProps} cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" />
    </Base>
  );
}

/** Hockey — patin + palet. */
export function HockeyPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <path {...strokeProps} d="M12 3v5m0 12v5M4.93 4.93l2.83 2.83m8.38 8.38l2.83-2.83M15.06 15.06l-2.83-2.83m-8.38-8.38l2.83 2.83" />
      <circle {...strokeProps} cx="12" cy="12" r="5" />
      <circle {...strokeProps} cx="12" cy="12" r="1.5" fill="none" />
    </Base>
  );
}

/** Handball — ballon + joueur. */
export function HandballPicto(props: PictoProps) {
  return (
    <Base {...props}>
      <circle {...strokeProps} cx="12" cy="12" r="9" />
      <path {...strokeProps} d="M12 7.2l3.6 2.6-1.4 4.2H9.8l-1.4-4.2L12 7.2Z" />
      <path {...strokeProps} d="M8 16.5c2.5-1 6.5-1 8 0" opacity=".55" />
    </Base>
  );
}

// ─── Pictos « charte Flashscore » ────────────────────────────────────────────
// Aires pleines viewBox 20 relevées sur la nav scores de flashscore.com (2026),
// demandées pour le headbar sport. Les pictos line-art 24 ci-dessus restent la
// référence des autres écrans (sidebar, fiches athlètes).

/** Fabrique un picto Flashscore (fill currentColor, fill-rule evenodd). */
function fsPicto(name: string, d: string) {
  const Picto = (props: PictoProps) => (
    <svg viewBox="0 0 20 20" fill="currentColor" focusable="false" aria-hidden {...props}>
      <path fillRule="evenodd" d={d} />
    </svg>
  );
  Picto.displayName = `Fs${name}Picto`;
  return Picto;
}

export const FsFootballPicto = fsPicto(
  "Football",
  "M17 2.93a9.96 9.96 0 1 0-14.08 14.1A9.96 9.96 0 0 0 17 2.92Zm.41 2.77a8.5 8.5 0 0 1 1.1 3.43L16.66 8.1l.75-2.4Zm-1.37-1.8.37.4-1.11 3.57-1.33.4-3.32-2.41V4.5l3.16-2.2a8.6 8.6 0 0 1 2.22 1.6ZM9.96 1.4c.78-.01 1.55.1 2.3.3l-2.3 1.6-2.3-1.6c.75-.2 1.52-.31 2.3-.3ZM3.9 3.9a8.6 8.6 0 0 1 2.22-1.6l3.16 2.2v1.36l-3.32 2.4-1.32-.4L3.52 4.3l.37-.4ZM2.52 5.7l.75 2.4-1.85 1.03a8.5 8.5 0 0 1 1.1-3.43Zm1.37 10.35-.22-.23H5.7l.65 1.95a8.6 8.6 0 0 1-2.45-1.72Zm2.01-1.6H2.63A8.5 8.5 0 0 1 1.4 10.7l2.75-1.55 1.41.43 1.28 3.91-.95.95Zm6.05 3.89c-1.3.3-2.66.3-3.97 0l-1.01-3.02 1.1-1.1h3.79l1.1 1.1-1.01 3.02Zm-.07-5.44H8.05L6.86 9.25 9.96 7l3.1 2.25-1.18 3.65Zm4.15 3.15a8.6 8.6 0 0 1-2.45 1.72l.66-1.94h2.01l-.22.22Zm-2-1.6-.95-.95 1.27-3.91 1.41-.43 2.76 1.55a8.5 8.5 0 0 1-1.22 3.74h-3.27Z"
);

export const FsTennisPicto = fsPicto(
  "Tennis",
  "M13.16.14A5.96 5.96 0 0 1 18.3 1.7a5.98 5.98 0 0 1 1.56 5.14 9.67 9.67 0 0 1-2.83 5.49c-.76.76-1.64 1.4-2.6 1.9a8.9 8.9 0 0 1-2.58.88l-7.58 1.6L.99 20H0v-.96l3.3-3.3 1.6-7.58a9.77 9.77 0 0 1 2.78-5.18A9.67 9.67 0 0 1 13.16.14ZM7.74 14.58a5.36 5.36 0 0 1-2.3-2.3l-.62 2.92 2.92-.62ZM18.5 6.66c-.12.86-.4 1.7-.8 2.47a9.14 9.14 0 0 1-5.72 4.56l-.4.08-.22.03c-1.6.21-3.02-.2-3.98-1.17a4.64 4.64 0 0 1-1.14-4.21l.09-.4a8.53 8.53 0 0 1 2.32-4.07 8.3 8.3 0 0 1 4.7-2.44c.26-.04.53-.06.8-.06a4.4 4.4 0 0 1 3.18 1.22 4.64 4.64 0 0 1 1.17 4ZM2.75.08a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Zm0 4.12a1.37 1.37 0 1 1 0-2.75 1.37 1.37 0 0 1 0 2.75Z"
);

export const FsBasketballPicto = fsPicto(
  "Basketball",
  "M15.782 16.392A27.055 27.055 0 0 0 8.438 6.027c.488-.37.998-.71 1.537-1.008 1.184 1.16 2.743 1.715 3.843 2.1.189.064.365.126.523.185 2.666 1 3.361 1.443 4.264 2.147.011.182.028.364.028.548a8.607 8.607 0 0 1-2.851 6.393ZM9.735 18.62c-.64-1.44-1.117-2.933-1.552-4.905-.347-1.575-.932-3.528-2.332-5.06a12.89 12.89 0 0 1 1.535-1.739 25.73 25.73 0 0 1 7.271 10.342A8.587 8.587 0 0 1 10 18.633c-.09 0-.176-.01-.265-.013Zm-6.323-3.053c.096-2.08.689-4.03 1.668-5.735.801.971 1.347 2.266 1.768 4.178.377 1.708.797 3.118 1.318 4.422a8.64 8.64 0 0 1-4.754-2.865ZM1.469 8.738a3.636 3.636 0 0 1 2.544.221 14.02 14.02 0 0 0-1.773 4.8A8.578 8.578 0 0 1 1.367 10c0-.429.042-.848.102-1.26Zm2.135-4.517a25.941 25.941 0 0 1 2.707 1.831 14.128 14.128 0 0 0-1.538 1.765c-.65-.339-1.697-.714-2.953-.557a8.62 8.62 0 0 1 1.784-3.039Zm5.524-.297c-.623.356-1.209.766-1.768 1.208A27.728 27.728 0 0 0 4.631 3.25a8.592 8.592 0 0 1 3.971-1.76 5.353 5.353 0 0 0 .526 2.434Zm.843-2.557H10c1.376 0 2.673.331 3.828.906a13.98 13.98 0 0 0-3.484 1.03 3.946 3.946 0 0 1-.373-1.936Zm8.306 6.198c-.741-.444-1.695-.88-3.456-1.54a20.046 20.046 0 0 0-.554-.198c-.902-.315-2.047-.718-2.958-1.437a12.663 12.663 0 0 1 4.305-.936 8.646 8.646 0 0 1 2.663 4.111ZM10 0C4.486 0 0 4.485 0 10s4.486 10 10 10 10-4.486 10-10S15.514 0 10 0Z"
);

export const FsHockeyPicto = fsPicto(
  "Hockey",
  "M7.73 6.92a9.67 9.67 0 0 1-3.98-.75v1.3c0 .3 1.37 1.1 3.98 1.1 2.62 0 4-.8 4-1.1v-1.3c-1.05.51-2.55.75-4 .75Zm4-2.46c0-.28-1.38-1.1-4-1.1-2.61 0-3.98.82-3.98 1.1 0 .28 1.37 1.1 3.98 1.1 2.62 0 4-.82 4-1.1Zm1.36 3.02c0 1.69-2.78 2.46-5.36 2.46-2.57 0-5.35-.77-5.35-2.46V4.46C2.38 2.77 5.16 2 7.73 2c2.58 0 5.36.77 5.36 2.46v3.02Zm-1.31 10h1.1l1.63-3.03H1.87l-.5.5v2.03l.5.5h9.91ZM1.3 13.08h13.94L20 4.25v2.88l-6.3 11.72H1.3L0 17.55v-3.17l1.3-1.3Z"
);

export const FsHandballPicto = fsPicto(
  "Handball",
  "M3.45 4.14a2.07 2.07 0 1 0 0-4.14 2.07 2.07 0 0 0 0 4.14Zm0-2.76a.69.69 0 1 1 0 1.38.69.69 0 0 1 0-1.38Zm10 4.83a3.1 3.1 0 1 0 0-6.21 3.1 3.1 0 0 0 0 6.2Zm0-4.83a1.72 1.72 0 1 1 0 3.45 1.72 1.72 0 0 1 0-3.45ZM8.28 11.72 0 20h1.96l7-7.08 6.23 4.32-.02 2.76h1.38v-3.45l-6.9-4.83H8.29ZM3.14 5.76 6.9 8.28H20v1.38H6.47L2.34 6.9l.8-1.14Z"
);

export const FsRugbyPicto = fsPicto(
  "Rugby",
  "M18.97 1.03S17.1 0 14.54.08c-1.54.05-3.05.4-4.46 1.03-1.81.8-3.58 2.06-5.28 3.75v.01a17.68 17.68 0 0 0-3.76 5.28c-.65 1.48-1 2.97-1.03 4.46-.07 2.56.95 4.43.95 4.43s1.76.96 4.16.96c1.66 0 3.25-.39 4.73-1.04 1.81-.8 3.58-2.06 5.28-3.75v-.01a17.63 17.63 0 0 0 3.76-5.28c.63-1.4.98-2.92 1.03-4.46.07-2.56-.95-4.43-.95-4.43Zm-1.02 1.02c.27.6.65 1.88.6 3.46a10.11 10.11 0 0 1-.58 2.99L11.5 2.03c.96-.34 1.97-.54 3-.58a8.28 8.28 0 0 1 3.45.6ZM1.38 14.65c-.04 1.72.4 2.94.6 3.37.6.27 1.88.65 3.46.6 1.05-.04 2.08-.25 3.07-.6l-6.52-6.53a10.1 10.1 0 0 0-.61 3.15Zm12.79-.43-.02.02a16.85 16.85 0 0 1-4.28 3.19l-7.3-7.3c.74-1.46 1.8-2.9 3.2-4.28v-.02c1.42-1.4 2.88-2.49 4.37-3.23l7.26 7.26a16.85 16.85 0 0 1-3.23 4.36Zm-3.06-6.3.86-.86.97.97-.86.86.66.65-.98.97-.65-.65-1.27 1.27.65.65-.97.97-.63-.63-1.27 1.27-.63-.63.97-.97.63-.63.97-.97.63-.63 1.27-1.27-.63-.63.97-.97.63-.63Z"
);