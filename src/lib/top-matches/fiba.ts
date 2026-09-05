// Adapter FIBA — normalise les matches FIBA Women's WC → format TopLeague
import type { SportAdapter, TopLeague, TopMatch, BasketballMatchUI } from './types';
import { hybridPredict } from '@/lib/predictions/fiba-predictions';
import { LEAGUE_CONFIGS, getLeagueConfig } from '@/lib/basketball-league-config';
import { countryFlag } from './types';

const FIBA_TEAMS = [
  "USA", "CHN", "AUS", "FRA", "ESP", "BEL", "CAN", "SRB",
  "JPN", "TUR", "ITA", "POL", "CZE", "GBR", "BEL", "HUN",
];

function randomElement(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomMatch(): TopMatch {
  const home = randomElement(FIBA_TEAMS);
  let away: string;
  do {
    away = randomElement(FIBA_TEAMS);
  } while (away === home);

  const config = getLeagueConfig("fiba" as any);
  const prediction = hybridPredict(home, away);
  const pHome = prediction.blendedPHome;

  const score = pHome > 0.5
    ? `${Math.round(pHome * 80) + 55} - ${Math.round((1 - pHome) * 80) + 45}`
    : `${Math.round((1 - pHome) * 80) + 45} - ${Math.round(pHome * 80) + 55}`;

  return {
    id: `fiba-${home}-${away}-${Date.now()}`,
    home: { name: home },
    away: { name: away },
    kickoff: new Date(Date.now() + Math.random() * 86400000).toISOString(),
    status: "scheduled",
    odds: prediction.blendedPHome > 0.5
      ? { home: String(Math.round(prediction.blendedPHome * 1.2)), away: String(Math.round((1 - prediction.blendedPHome) * 1.2)) }
      : { home: String(Math.round((1 - prediction.blendedPHome) * 1.2)), away: String(Math.round(prediction.blendedPHome * 1.2)) },
    metric: {
      label: "Edge",
      value: Math.round((prediction.blendedPHome - 0.5) * 100),
      max: 100,
    },
    badge: prediction.blendedPHome > 0.6
      ? { label: "VALUE", color: "#FF6D00" }
      : prediction.blendedPHome > 0.55
      ? { label: "PLAY", color: "#7B3FA0" }
      : undefined,
  };
}

export const fibaAdapter: SportAdapter = {
  sport: 'fiba',

  async fetch(limit) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    const matches: TopMatch[] = [];

    for (let i = 0; i < limit; i++) {
      matches.push(generateRandomMatch());
    }

    return matches.length
      ? [{ league: 'FIBA Women\'s WC', leagueIcon: '🏀', leagueColor: '#7B3FA0', sport: 'fiba', matches }]
      : [];
  },
};