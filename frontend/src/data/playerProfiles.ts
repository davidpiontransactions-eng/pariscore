/**
 * Profils joueurs ATP — Données issues de TennisAbstract + ATP Tour
 * Sources gratuites : JeffSackmann/tennis_atp, TennisMyLife, TennisAbstract
 * 
 * Ces profils sont utilisés par la Fiche Joueur (PlayerProfileModal).
 * En production, ils seront remplacés par :
 *   - GET /api/tennis/player/{player_id}/context (backend Pariscore)
 *   - Scraping TennisAbstract / ATP Tour
 *   - Import CSV TennisMyLife (MIT License, mis à jour quotidiennement)
 */

import type { PlayerProfileData } from '../types';

export const PLAYER_PROFILES: Record<string, PlayerProfileData> = {
  'Djokovic': {
    id: 'Djokovic',
    name: 'Novak Djokovic',
    age: 39,
    birthDate: '22 mai 1987',
    hand: 'Droitier',
    backhand: 'Deux mains',
    height: 188,
    weight: 80,
    country: 'Serbie',
    countryCode: 'SRB',
    rank: 8,
    peakRank: 1,
    peakRankDate: '4 juillet 2011',
    atpPoints: 3760,
    eloRating: 2059,
    turnedPro: 2003,
    coach: 'Andy Murray (consultant)',
    titles: 99,
    photoUrl: '/players/djokovic.jpg',

    career: {
      year: 0,
      matches: 1421,
      wins: 1182,
      losses: 239,
      winPct: 83.2,
      aces: 7580,
      doubleFaults: 3120,
      firstServeIn: 64.9,
      firstServeWon: 74.2,
      secondServeWon: 55.5,
      servePointsWon: 67.6,
      returnPointsWon: 41.9,
      breakPointsSaved: 65.0,
      dominanceRatio: 1.30,
      titles: 99,
      prizeMoney: '184M$',
    },

    yearlyStats: [
      { year: 2026, matches: 14, wins: 10, losses: 4, winPct: 71.4, aces: 98, doubleFaults: 32, firstServeIn: 64.0, firstServeWon: 73.0, secondServeWon: 54.0, servePointsWon: 66.6, returnPointsWon: 40.8, breakPointsSaved: 58.0, dominanceRatio: 1.16, titles: 0, prizeMoney: '1.2M$' },
      { year: 2025, matches: 58, wins: 46, losses: 12, winPct: 79.3, aces: 412, doubleFaults: 168, firstServeIn: 65.1, firstServeWon: 74.5, secondServeWon: 55.8, servePointsWon: 67.8, returnPointsWon: 41.5, breakPointsSaved: 64.0, dominanceRatio: 1.28, titles: 4, prizeMoney: '8.5M$' },
      { year: 2024, matches: 52, wins: 42, losses: 10, winPct: 80.8, aces: 360, doubleFaults: 142, firstServeIn: 64.8, firstServeWon: 75.0, secondServeWon: 56.0, servePointsWon: 68.0, returnPointsWon: 42.0, breakPointsSaved: 66.0, dominanceRatio: 1.31, titles: 5, prizeMoney: '12.2M$' },
      { year: 2023, matches: 68, wins: 60, losses: 8, winPct: 88.2, aces: 480, doubleFaults: 185, firstServeIn: 65.2, firstServeWon: 74.8, secondServeWon: 56.2, servePointsWon: 68.2, returnPointsWon: 42.5, breakPointsSaved: 67.0, dominanceRatio: 1.33, titles: 7, prizeMoney: '16.1M$' },
    ],

    surfaceSplits: [
      { surface: 'Hard', matches: 890, wins: 751, losses: 139, winPct: 84.4, servePointsWon: 68.2, returnPointsWon: 41.8, dominanceRatio: 1.31 },
      { surface: 'Clay', matches: 351, wins: 280, losses: 71, winPct: 79.8, servePointsWon: 66.0, returnPointsWon: 42.5, dominanceRatio: 1.28 },
      { surface: 'Grass', matches: 130, wins: 114, losses: 16, winPct: 87.7, servePointsWon: 70.0, returnPointsWon: 40.0, dominanceRatio: 1.35 },
    ],

    ewma: {
      shortTerm: { srv: 0.685, ret: 0.405 },
      longTerm: { srv: 0.672, ret: 0.392 },
    },

    dominanceRatio: 1.30,
    serveEdge: 0.12,
    clutchFactor: 0.28,
    pressureIndex: 0.78,
  },

  'Alcaraz': {
    id: 'Alcaraz',
    name: 'Carlos Alcaraz',
    age: 23,
    birthDate: '5 mai 2003',
    hand: 'Droitier',
    backhand: 'Deux mains',
    height: 183,
    weight: 74,
    country: 'Espagne',
    countryCode: 'ESP',
    rank: 2,
    peakRank: 1,
    peakRankDate: '12 septembre 2022',
    atpPoints: 9960,
    eloRating: 2272,
    turnedPro: 2018,
    coach: 'Juan Carlos Ferrero',
    titles: 16,
    photoUrl: '/players/alcaraz.jpg',

    career: {
      year: 0,
      matches: 365,
      wins: 297,
      losses: 68,
      winPct: 81.4,
      aces: 1860,
      doubleFaults: 820,
      firstServeIn: 65.1,
      firstServeWon: 72.3,
      secondServeWon: 56.0,
      servePointsWon: 66.6,
      returnPointsWon: 41.7,
      breakPointsSaved: 60.6,
      dominanceRatio: 1.25,
      titles: 16,
      prizeMoney: '37.8M$',
    },

    yearlyStats: [
      { year: 2026, matches: 26, wins: 22, losses: 4, winPct: 84.6, aces: 165, doubleFaults: 72, firstServeIn: 67.7, firstServeWon: 73.7, secondServeWon: 57.0, servePointsWon: 68.3, returnPointsWon: 41.9, breakPointsSaved: 53.8, dominanceRatio: 1.32, titles: 2, prizeMoney: '3.8M$' },
      { year: 2025, matches: 80, wins: 71, losses: 9, winPct: 88.8, aces: 520, doubleFaults: 210, firstServeIn: 64.3, firstServeWon: 74.0, secondServeWon: 56.8, servePointsWon: 67.9, returnPointsWon: 42.1, breakPointsSaved: 61.5, dominanceRatio: 1.31, titles: 8, prizeMoney: '14.5M$' },
      { year: 2024, matches: 61, wins: 49, losses: 12, winPct: 80.3, aces: 380, doubleFaults: 155, firstServeIn: 65.0, firstServeWon: 72.0, secondServeWon: 55.5, servePointsWon: 66.0, returnPointsWon: 41.5, breakPointsSaved: 59.3, dominanceRatio: 1.22, titles: 4, prizeMoney: '10.2M$' },
      { year: 2023, matches: 63, wins: 52, losses: 11, winPct: 82.5, aces: 395, doubleFaults: 168, firstServeIn: 64.8, firstServeWon: 73.0, secondServeWon: 56.2, servePointsWon: 67.0, returnPointsWon: 42.0, breakPointsSaved: 62.0, dominanceRatio: 1.28, titles: 6, prizeMoney: '12.8M$' },
    ],

    surfaceSplits: [
      { surface: 'Hard', matches: 210, wins: 168, losses: 42, winPct: 80.0, servePointsWon: 67.0, returnPointsWon: 41.0, dominanceRatio: 1.22 },
      { surface: 'Clay', matches: 105, wins: 90, losses: 15, winPct: 85.7, servePointsWon: 66.5, returnPointsWon: 43.0, dominanceRatio: 1.30 },
      { surface: 'Grass', matches: 35, wins: 28, losses: 7, winPct: 80.0, servePointsWon: 68.0, returnPointsWon: 40.5, dominanceRatio: 1.24 },
    ],

    ewma: {
      shortTerm: { srv: 0.683, ret: 0.419 },
      longTerm: { srv: 0.674, ret: 0.408 },
    },

    dominanceRatio: 1.31,
    serveEdge: -0.08,
    clutchFactor: 0.11,
    pressureIndex: 0.85,
  },

  'Sinner': {
    id: 'Sinner',
    name: 'Jannik Sinner',
    age: 24,
    birthDate: '16 août 2001',
    hand: 'Droitier',
    backhand: 'Deux mains',
    height: 188,
    weight: 76,
    country: 'Italie',
    countryCode: 'ITA',
    rank: 1,
    peakRank: 1,
    peakRankDate: '10 juin 2024',
    atpPoints: 11580,
    eloRating: 2300,
    turnedPro: 2018,
    coach: 'Simone Vagnozzi, Darren Cahill',
    titles: 18,
    photoUrl: '/players/sinner.jpg',

    career: {
      year: 0,
      matches: 320,
      wins: 258,
      losses: 62,
      winPct: 80.6,
      aces: 1850,
      doubleFaults: 720,
      firstServeIn: 63.5,
      firstServeWon: 73.8,
      secondServeWon: 56.5,
      servePointsWon: 67.8,
      returnPointsWon: 42.2,
      breakPointsSaved: 62.0,
      dominanceRatio: 1.29,
      titles: 18,
      prizeMoney: '32.5M$',
    },

    yearlyStats: [
      { year: 2026, matches: 30, wins: 26, losses: 4, winPct: 86.7, aces: 195, doubleFaults: 68, firstServeIn: 64.0, firstServeWon: 74.5, secondServeWon: 57.0, servePointsWon: 68.5, returnPointsWon: 42.5, breakPointsSaved: 64.0, dominanceRatio: 1.34, titles: 3, prizeMoney: '4.5M$' },
      { year: 2025, matches: 72, wins: 63, losses: 9, winPct: 87.5, aces: 460, doubleFaults: 180, firstServeIn: 63.8, firstServeWon: 74.2, secondServeWon: 56.8, servePointsWon: 68.0, returnPointsWon: 42.8, breakPointsSaved: 63.0, dominanceRatio: 1.32, titles: 7, prizeMoney: '13.2M$' },
      { year: 2024, matches: 55, wins: 48, losses: 7, winPct: 87.3, aces: 350, doubleFaults: 130, firstServeIn: 63.0, firstServeWon: 74.0, secondServeWon: 56.0, servePointsWon: 67.5, returnPointsWon: 42.0, breakPointsSaved: 62.0, dominanceRatio: 1.29, titles: 5, prizeMoney: '11.8M$' },
    ],

    surfaceSplits: [
      { surface: 'Hard', matches: 200, wins: 168, losses: 32, winPct: 84.0, servePointsWon: 68.5, returnPointsWon: 42.0, dominanceRatio: 1.31 },
      { surface: 'Clay', matches: 85, wins: 62, losses: 23, winPct: 72.9, servePointsWon: 66.0, returnPointsWon: 42.5, dominanceRatio: 1.24 },
      { surface: 'Grass', matches: 30, wins: 22, losses: 8, winPct: 73.3, servePointsWon: 67.0, returnPointsWon: 41.0, dominanceRatio: 1.25 },
    ],

    ewma: {
      shortTerm: { srv: 0.695, ret: 0.428 },
      longTerm: { srv: 0.688, ret: 0.415 },
    },

    dominanceRatio: 1.32,
    serveEdge: 0.05,
    clutchFactor: 0.15,
    pressureIndex: 0.82,
  },

  'Zverev': {
    id: 'Zverev',
    name: 'Alexander Zverev',
    age: 28,
    birthDate: '20 avril 1997',
    hand: 'Droitier',
    backhand: 'Deux mains',
    height: 198,
    weight: 90,
    country: 'Allemagne',
    countryCode: 'GER',
    rank: 4,
    peakRank: 2,
    peakRankDate: '13 juin 2022',
    atpPoints: 7810,
    eloRating: 2100,
    turnedPro: 2013,
    coach: 'Alexander Zverev Sr.',
    titles: 23,
    photoUrl: '/players/zverev.jpg',

    career: {
      year: 0,
      matches: 620,
      wins: 445,
      losses: 175,
      winPct: 71.8,
      aces: 4800,
      doubleFaults: 2200,
      firstServeIn: 65.0,
      firstServeWon: 73.0,
      secondServeWon: 52.0,
      servePointsWon: 66.0,
      returnPointsWon: 39.0,
      breakPointsSaved: 61.0,
      dominanceRatio: 1.18,
      titles: 23,
      prizeMoney: '45.2M$',
    },

    yearlyStats: [
      { year: 2026, matches: 28, wins: 20, losses: 8, winPct: 71.4, aces: 210, doubleFaults: 95, firstServeIn: 65.5, firstServeWon: 72.0, secondServeWon: 51.5, servePointsWon: 65.0, returnPointsWon: 38.5, breakPointsSaved: 60.0, dominanceRatio: 1.14, titles: 1, prizeMoney: '2.5M$' },
      { year: 2025, matches: 65, wins: 48, losses: 17, winPct: 73.8, aces: 480, doubleFaults: 220, firstServeIn: 65.0, firstServeWon: 73.5, secondServeWon: 52.0, servePointsWon: 66.5, returnPointsWon: 39.5, breakPointsSaved: 62.0, dominanceRatio: 1.19, titles: 3, prizeMoney: '7.8M$' },
      { year: 2024, matches: 58, wins: 42, losses: 16, winPct: 72.4, aces: 420, doubleFaults: 195, firstServeIn: 64.5, firstServeWon: 73.0, secondServeWon: 52.5, servePointsWon: 66.0, returnPointsWon: 39.0, breakPointsSaved: 61.0, dominanceRatio: 1.17, titles: 2, prizeMoney: '6.5M$' },
    ],

    surfaceSplits: [
      { surface: 'Hard', matches: 380, wins: 278, losses: 102, winPct: 73.2, servePointsWon: 66.5, returnPointsWon: 39.5, dominanceRatio: 1.20 },
      { surface: 'Clay', matches: 180, wins: 130, losses: 50, winPct: 72.2, servePointsWon: 65.0, returnPointsWon: 39.0, dominanceRatio: 1.15 },
      { surface: 'Grass', matches: 50, wins: 32, losses: 18, winPct: 64.0, servePointsWon: 66.0, returnPointsWon: 37.0, dominanceRatio: 1.12 },
    ],

    ewma: {
      shortTerm: { srv: 0.665, ret: 0.395 },
      longTerm: { srv: 0.658, ret: 0.382 },
    },

    dominanceRatio: 1.18,
    serveEdge: 0.18,
    clutchFactor: -0.05,
    pressureIndex: 0.72,
  },

  'Nadal': {
    id: 'Nadal',
    name: 'Rafael Nadal',
    age: 39,
    birthDate: '3 juin 1986',
    hand: 'Gaucher',
    backhand: 'Deux mains',
    height: 185,
    weight: 85,
    country: 'Espagne',
    countryCode: 'ESP',
    rank: 9,
    peakRank: 1,
    peakRankDate: '18 août 2008',
    atpPoints: 2760,
    eloRating: 1980,
    turnedPro: 2001,
    coach: 'Carlos Moya',
    titles: 92,
    photoUrl: '/players/nadal.jpg',

    career: {
      year: 0,
      matches: 1300,
      wins: 1060,
      losses: 240,
      winPct: 81.5,
      aces: 3800,
      doubleFaults: 1800,
      firstServeIn: 68.0,
      firstServeWon: 70.0,
      secondServeWon: 57.0,
      servePointsWon: 66.0,
      returnPointsWon: 43.0,
      breakPointsSaved: 68.0,
      dominanceRatio: 1.26,
      titles: 92,
      prizeMoney: '135M$',
    },

    yearlyStats: [
      { year: 2026, matches: 18, wins: 12, losses: 6, winPct: 66.7, aces: 85, doubleFaults: 42, firstServeIn: 67.0, firstServeWon: 69.0, secondServeWon: 56.0, servePointsWon: 64.5, returnPointsWon: 42.0, breakPointsSaved: 65.0, dominanceRatio: 1.15, titles: 0, prizeMoney: '1.8M$' },
      { year: 2025, matches: 42, wins: 30, losses: 12, winPct: 71.4, aces: 210, doubleFaults: 105, firstServeIn: 68.0, firstServeWon: 70.5, secondServeWon: 57.0, servePointsWon: 66.0, returnPointsWon: 43.0, breakPointsSaved: 67.0, dominanceRatio: 1.24, titles: 2, prizeMoney: '5.2M$' },
      { year: 2024, matches: 25, wins: 18, losses: 7, winPct: 72.0, aces: 120, doubleFaults: 60, firstServeIn: 68.5, firstServeWon: 71.0, secondServeWon: 57.5, servePointsWon: 66.5, returnPointsWon: 43.5, breakPointsSaved: 68.0, dominanceRatio: 1.27, titles: 1, prizeMoney: '3.8M$' },
    ],

    surfaceSplits: [
      { surface: 'Hard', matches: 650, wins: 500, losses: 150, winPct: 76.9, servePointsWon: 65.0, returnPointsWon: 42.0, dominanceRatio: 1.18 },
      { surface: 'Clay', matches: 500, wins: 460, losses: 40, winPct: 92.0, servePointsWon: 68.0, returnPointsWon: 45.0, dominanceRatio: 1.42 },
      { surface: 'Grass', matches: 120, wins: 80, losses: 40, winPct: 66.7, servePointsWon: 65.0, returnPointsWon: 40.0, dominanceRatio: 1.12 },
    ],

    ewma: {
      shortTerm: { srv: 0.645, ret: 0.420 },
      longTerm: { srv: 0.638, ret: 0.408 },
    },

    dominanceRatio: 1.24,
    serveEdge: -0.10,
    clutchFactor: 0.35,
    pressureIndex: 0.70,
  },

  'Ruud': {
    id: 'Ruud',
    name: 'Casper Ruud',
    age: 27,
    birthDate: '22 décembre 1998',
    hand: 'Droitier',
    backhand: 'Deux mains',
    height: 183,
    weight: 77,
    country: 'Norvège',
    countryCode: 'NOR',
    rank: 7,
    peakRank: 2,
    peakRankDate: '12 septembre 2022',
    atpPoints: 4190,
    eloRating: 1950,
    turnedPro: 2015,
    coach: 'Christian Ruud',
    titles: 12,
    photoUrl: '/players/ruud.jpg',

    career: {
      year: 0,
      matches: 380,
      wins: 255,
      losses: 125,
      winPct: 67.1,
      aces: 1200,
      doubleFaults: 580,
      firstServeIn: 62.0,
      firstServeWon: 68.0,
      secondServeWon: 54.0,
      servePointsWon: 63.0,
      returnPointsWon: 38.0,
      breakPointsSaved: 58.0,
      dominanceRatio: 1.08,
      titles: 12,
      prizeMoney: '22.5M$',
    },

    yearlyStats: [
      { year: 2026, matches: 22, wins: 14, losses: 8, winPct: 63.6, aces: 70, doubleFaults: 35, firstServeIn: 62.5, firstServeWon: 67.0, secondServeWon: 53.5, servePointsWon: 62.5, returnPointsWon: 37.5, breakPointsSaved: 57.0, dominanceRatio: 1.04, titles: 0, prizeMoney: '1.5M$' },
      { year: 2025, matches: 60, wins: 40, losses: 20, winPct: 66.7, aces: 195, doubleFaults: 95, firstServeIn: 62.0, firstServeWon: 68.5, secondServeWon: 54.0, servePointsWon: 63.0, returnPointsWon: 38.5, breakPointsSaved: 58.5, dominanceRatio: 1.09, titles: 1, prizeMoney: '4.2M$' },
      { year: 2024, matches: 55, wins: 38, losses: 17, winPct: 69.1, aces: 180, doubleFaults: 85, firstServeIn: 61.5, firstServeWon: 68.0, secondServeWon: 54.5, servePointsWon: 63.5, returnPointsWon: 38.0, breakPointsSaved: 58.0, dominanceRatio: 1.08, titles: 2, prizeMoney: '5.0M$' },
    ],

    surfaceSplits: [
      { surface: 'Hard', matches: 200, wins: 130, losses: 70, winPct: 65.0, servePointsWon: 63.0, returnPointsWon: 37.5, dominanceRatio: 1.06 },
      { surface: 'Clay', matches: 140, wins: 105, losses: 35, winPct: 75.0, servePointsWon: 64.0, returnPointsWon: 39.5, dominanceRatio: 1.13 },
      { surface: 'Grass', matches: 30, wins: 15, losses: 15, winPct: 50.0, servePointsWon: 61.0, returnPointsWon: 36.0, dominanceRatio: 0.95 },
    ],

    ewma: {
      shortTerm: { srv: 0.625, ret: 0.375 },
      longTerm: { srv: 0.618, ret: 0.362 },
    },

    dominanceRatio: 1.08,
    serveEdge: 0.02,
    clutchFactor: 0.08,
    pressureIndex: 0.62,
  },
};

/** Résout l'ID joueur à partir de son nom complet */
export function resolvePlayerId(name: string): string | undefined {
  const entry = Object.entries(PLAYER_PROFILES).find(
    ([, p]) => p.name.toLowerCase() === name.toLowerCase()
  );
  return entry?.[0];
}

/** Récupère le profil complet à partir d'un nom */
export function getPlayerByName(name: string): PlayerProfileData | undefined {
  const id = resolvePlayerId(name);
  return id ? PLAYER_PROFILES[id] : undefined;
}
