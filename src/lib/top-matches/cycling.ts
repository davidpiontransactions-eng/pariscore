// Adapter Cycling — fallback vide (pas d'API top dédiée)
import type { SportAdapter, TopLeague } from './types';

export const cyclingAdapter: SportAdapter = {
  sport: 'cycling',
  async fetch() {
    return [];
  },
};
