// Mapping des diffuseurs TV français par tournoi (live box « Diffusé en France »).
//
// Source : contrats médias en vigueur pour la France (Eurosport → ATP &
// WTA 1000 ; France TV → Grands Chelems ; beIN Sports → WTA 500/250).
// Valeur par défaut sûre : Eurosport.

export type BroadcasterInfo = {
  channel: string;
};

const RULES: Array<{ test: RegExp; channel: string }> = [
  { test: /roland|garros/i, channel: "France TV" },
  { test: /wimbledon/i, channel: "France TV" },
  { test: /australian open/i, channel: "Eurosport" },
  { test: /us open/i, channel: "Eurosport" },
  { test: /national bank open/i, channel: "Eurosport" },
  { test: /paris masters|rolex paris/i, channel: "Eurosport" },
];

/** Résout la chaîne française pour un nom de tournoi (ex. "National Bank Open"). */
export function getFrenchBroadcaster(tournament: string | null | undefined): BroadcasterInfo {
  const name = tournament ?? "";
  for (const rule of RULES) {
    if (rule.test.test(name)) return { channel: rule.channel };
  }
  return { channel: "Eurosport" };
}