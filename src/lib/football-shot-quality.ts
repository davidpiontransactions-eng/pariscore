// Qualité des tirs — métriques dérivées de la qualité de tir (option 1 du plan
// T4, choisie faute de coordonnées spatiales disponibles).
//
// ⚠️ Pourquoi pas de heatmap : le `shotmap` BSD est vide sur le plan courant
// (sonde : 30 matchs, 0 shotmap) et **aucun fournisseur accessible ne donne de
// x/y par tir** — Sportmonks documente explicitement l'absence de coordonnées
// sur les events. On calcule donc ce qui est **réellement dérivable** des
// agrégats boxscore, sans rien inventer.
//
// Dérivations (arithmétique pure sur des agrégats déjà présents) :
//   tirs sauvés    = SOT − buts          (ce qui va au gardien)
//   tirs non cadrés= tirs totaux − SOT   (ratés + bloqués)
//   taux de conversion = buts / tirs totaux
//   taux de cadrement = SOT / tirs totaux
//   xG moyen par tir = xG cumulé / tirs totaux
//   écart xG–réel   = buts − xG cumulé  ← signal de sur/surperformance
//
// `xG` est souvent `null` sur le plan gratuit API-Football : dans ce cas les
// métriques xG sont `null` et le panneau les masque. Jamais de 0 substitué —
// afficher « 0.00 » pour un xG absent ferait croire à une précision inexistante.

export type ShotSide = "home" | "away";

export interface ShotQualitySide {
  /** Buts marqués (score, pas xG). */
  goals: number;
  /** Tirs totaux. */
  shots: number;
  /** Tirs cadrés sur le but. */
  sot: number;
  /** Tirs cadrés non buts = sauvés. */
  saved: number;
  /** Tirs non cadrés = ratés + bloqués. */
  offTarget: number;
  /** xG cumulé, null si la source ne le fournit pas. */
  xg: number | null;
  /** xG moyen par tir, null si xG ou tirs absents. */
  xgPerShot: number | null;
  /** Taux de conversion buts/tirs en %, null si aucun tir. */
  conversionPct: number | null;
  /** Taux de cadrement SOT/tirs en %, null si aucun tir. */
  onTargetPct: number | null;
  /**
   * Buts − xG. Positif = surperformance (plus de buts que la qualité ne le
   * justifiait), négatif = sous-performance. null si xG absent.
   */
  xgDelta: number | null;
}

export interface ShotQuality {
  home: ShotQualitySide;
  away: ShotQualitySide;
  /** true → au moins un xG disponible, donc les métriques xG sont affichables. */
  hasXg: boolean;
  /** true → données trop pauvres pour être significatives (< 1 tir par camp). */
  thinData: boolean;
}

const n = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : Number(v);
  return v == null || !Number.isFinite(x) ? null : x;
};

/** Arrondi à 2 décimales — évite le bruit float en affichage. */
const r2 = (v: number): number => Math.round(v * 100) / 100;

function side(args: {
  goals: unknown;
  shots: unknown;
  sot: unknown;
  xg: unknown;
}): ShotQualitySide {
  const goals = Math.max(0, n(args.goals) ?? 0);
  const shots = Math.max(0, n(args.shots) ?? 0);
  const sot = Math.max(0, Math.min(shots, n(args.sot) ?? 0));
  const xg = n(args.xg);

  const saved = Math.max(0, sot - goals);
  const offTarget = Math.max(0, shots - sot);
  const xgPerShot = xg != null && shots > 0 ? r2(xg / shots) : null;

  return {
    goals,
    shots,
    sot,
    saved,
    offTarget,
    xg,
    xgPerShot,
    conversionPct: shots > 0 ? r2((goals / shots) * 100) : null,
    onTargetPct: shots > 0 ? r2((sot / shots) * 100) : null,
    xgDelta: xg != null ? r2(goals - xg) : null,
  };
}

export interface ShotQualityInput {
  goals: { home: unknown; away: unknown };
  shots: { home: unknown; away: unknown };
  sot: { home: unknown; away: unknown };
  /** xG cumulé par camp. null/undefined → métriques xG masquées. */
  xg?: { home: unknown; away: unknown } | null;
}

/** Construit les deux profils de qualité de tir à partir des agrégats. */
export function buildShotQuality(input: ShotQualityInput): ShotQuality {
  const home = side({
    goals: input.goals.home,
    shots: input.shots.home,
    sot: input.sot.home,
    xg: input.xg?.home,
  });
  const away = side({
    goals: input.goals.away,
    shots: input.shots.away,
    sot: input.sot.away,
    xg: input.xg?.away,
  });
  return {
    home,
    away,
    hasXg: home.xg != null || away.xg != null,
    thinData: home.shots + away.shots < 3,
  };
}
