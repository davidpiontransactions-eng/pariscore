// Adapter CS2 — fallback vide (pas d'API top dédiée)
import type { SportAdapter, TopLeague } from './types';

export const cs2Adapter: SportAdapter = {
  sport: 'cs2',
  async fetch() {
    return [];
  },
};
