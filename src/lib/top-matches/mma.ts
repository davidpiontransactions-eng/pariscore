// Adapter MMA — fallback vide (pas d'API top dédiée)
import type { SportAdapter, TopLeague } from './types';

export const mmaAdapter: SportAdapter = {
  sport: 'mma',
  async fetch() {
    return [];
  },
};
