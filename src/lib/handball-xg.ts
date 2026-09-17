// xG Handball — modèle simplifié basé sur H-xT (Broermann 2026)
// Zones de tir → probabilité de but

export type HandballShotZone =
  | "6m_center"
  | "6m_wing"
  | "9m_center"
  | "9m_wing"
  | "7m"
  | "fastbreak"
  | "backcourt";

// xG par zone (Broermann 2026: H-xT surface 2024/25)
const XG_BY_ZONE: Record<HandballShotZone, number> = {
  "6m_center": 0.4,
  "6m_wing": 0.3,
  "9m_center": 0.2,
  "9m_wing": 0.15,
  "7m": 0.75,
  fastbreak: 0.55,
  backcourt: 0.05,
};

export type HandballXgResult = {
  xg: number;
  zone: HandballShotZone;
  confidence: number;
};

export function shotXg(
  zone: HandballShotZone,
  shooterEfficiency?: number,
): HandballXgResult {
  const baseXg = XG_BY_ZONE[zone];
  const efficiency = shooterEfficiency ?? 1.0;
  const xg = Math.min(baseXg * efficiency, 0.99);
  return { xg, zone, confidence: 0.7 };
}

export function teamMatchXg(
  shotsPerGame: number,
  zoneDistribution: Partial<Record<HandballShotZone, number>>,
  teamEfficiency: number = 1.0,
): number {
  let totalXg = 0;
  for (const [zone, pct] of Object.entries(zoneDistribution)) {
    const zoneKey = zone as HandballShotZone;
    const shotsInZone = shotsPerGame * (pct ?? 0);
    totalXg += shotsInZone * XG_BY_ZONE[zoneKey] * teamEfficiency;
  }
  return totalXg;
}

export const TYPICAL_ZONE_DISTRIBUTION: Record<HandballShotZone, number> = {
  "6m_center": 0.25,
  "6m_wing": 0.2,
  "9m_center": 0.15,
  "9m_wing": 0.1,
  "7m": 0.1,
  fastbreak: 0.1,
  backcourt: 0.1,
};

export const BASELINE_TEAM_XG = teamMatchXg(55, TYPICAL_ZONE_DISTRIBUTION);
