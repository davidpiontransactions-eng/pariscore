export const STRATEGY_KEYS = [
  // Football
  "BTTS_YES",
  "OVER_2_5",
  "OVER_1_5",
  "UNDER_2_5",
  "HOME_WIN",
  "AWAY_WIN",
  "DRAW",
  "CS_00",
  "ANGLE_CORNERS",
  "OVER_6_5_CORNERS",
  "VERROU_TACTIQUE",
  "GOLDEN_PPG_GAP",
  "DC_HOME",
  "DC_AWAY",
  "HT_HOME_FT_HOME",
  "HT_UNDER_FT_OVER",
  "STEAM_DETECTED",
  // Tennis
  "TENNIS_SERVE_HOLD",
  "TENNIS_RETURN_SPECIALIST",
  "TENNIS_DR_DOMINANCE",
  "TENNIS_SURFACE_SPECIALIST",
  "TENNIS_UNDERDOG_HOLD",
] as const;

export type StrategyKey = (typeof STRATEGY_KEYS)[number];

export interface StrategyEntry {
  key: StrategyKey;
  label: string;
  icon: string;
  tipster: string;
  tipsterDesc: string;
  tipsterFlag: string;
}

export function validateStrategyKeys(keys: string[]): {
  missing: string[];
  extra: string[];
} {
  const canonical = new Set<string>(STRATEGY_KEYS);
  const actual = new Set(keys);
  return {
    missing: STRATEGY_KEYS.filter((k) => !actual.has(k)),
    extra: keys.filter((k) => !canonical.has(k)),
  };
}
