// CSS Variables — Micro-interactions Theme Tokens
// These variables are defined in global CSS but also exported as TypeScript
// for type-safe usage in JSX when needed (e.g., via styled-components or
// CSS-in-JS solutions that support TS variable resolution).

// --mi-* prefix = Micro-interactions namespace
// Usage: var(--mi-primary), var(--mi-success), etc.

export const microInteractionTokens = {
  // Animation timing
  animationDurationBase: "var(--mi-animation-duration-base, 0.2s)",
  animationDurationFast: "var(--mi-animation-duration-fast, 0.15s)",
  animationDurationSlow: "var(--mi-animation-duration-slow, 0.4s)",

  // Easing functions
  animationEasing: "var(--mi-animation-easing, cubic-bezier(0.4, 0, 0.2, 1))",
  animationEasingSharp: "var(--mi-animation-easing-sharp, cubic-bezier(0.4, 0, 0.6, 1))",
  animationEasingSoft: "var(--mi-animation-easing-soft, cubic-bezier(0.4, 0, 0.2, 1))",

  // Transform
  transformScaleUp: "var(--mi-transform-scale-up, 1.05)",
  transformScaleDown: "var(--mi-transform-scale-down, 0.98)",

  // Will-change triggers
  willChangeTransform: "var(--mi-will-change-transform, transform)",
  willChangeOpacity: "var(--mi-will-change-opacity, opacity)",

  // Reduced motion fallback
  reducedMotionDisabled: "var(--mi-reduced-motion-disabled, none)",

  // Confetti / celebration
  confettiDuration: "var(--mi-confetti-duration, 3s)",
  confettiIterationCount: "var(--mi-confetti-iteration-count, 1)",

  // Status badge
  badgeTransitionDuration: "var(--mi-badge-transition-duration, 0.2s)",

  // Filter toggle
  filterHoverTransition: "var(--mi-filter-hover-transition, 0.15s)",
} as const;

// Déclarations TypeScript pour les variables CSS globales
// Ces déclarations aident les outils d'analyse statique à reconnaître
// les variables --mi-* sans erreur de type
// Utilisation via le tableau `microInteractionTokens` exporté ci-dessus.

export default microInteractionTokens;