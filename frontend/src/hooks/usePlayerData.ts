/**
 * Hook usePlayerData — Récupère les données Fiche Joueur
 * 
 * Sources (par ordre de priorité) :
 *   1. Backend Pariscore → GET /api/tennis/player/{id}/context
 *   2. PLAYER_PROFILES (données TennisAbstract intégrées)
 *   3. Scraping TennisAbstract / ATP Tour (fallback futur)
 */

import { useCallback, useEffect, useState } from 'react';
import type { PlayerProfileData } from '../types';
import { PLAYER_PROFILES, resolvePlayerId } from '../data/playerProfiles';

interface UsePlayerDataResult {
  profile: PlayerProfileData | null;
  loading: boolean;
  error: string | null;
  /** Recharge manuelle depuis l'API */
  refresh: () => void;
}

// Cache local (évite re-recherche)
const profileCache = new Map<string, PlayerProfileData>();

export function usePlayerData(playerName: string | null): UsePlayerDataResult {
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (name: string) => {
    // Cache check
    if (profileCache.has(name)) {
      setProfile(profileCache.get(name)!);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Tentative API backend
      const playerId = resolvePlayerId(name);
      if (!playerId) throw new Error('Joueur non trouvé');

      const baseUrl = import.meta.env.VITE_API_BASE ?? '';
      const res = await fetch(`${baseUrl}/api/tennis/player/${encodeURIComponent(playerId)}/context`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        // Timeout court : si l'API est hors ligne, on utilise les données locales
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data: PlayerProfileData = await res.json();
        profileCache.set(name, data);
        setProfile(data);
        return;
      }
      throw new Error('API indisponible');
    } catch {
      // 2. Fallback : données locales TennisAbstract
      const local = PLAYER_PROFILES[resolvePlayerId(name) ?? ''];
      if (local) {
        profileCache.set(name, local);
        setProfile(local);
      } else {
        setError(`Profil non trouvé pour "${name}"`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (playerName) {
      profileCache.delete(playerName);
      fetchProfile(playerName);
    }
  }, [playerName, fetchProfile]);

  useEffect(() => {
    if (playerName) {
      fetchProfile(playerName);
    } else {
      setProfile(null);
      setError(null);
    }
  }, [playerName, fetchProfile]);

  return { profile, loading, error, refresh };
}
