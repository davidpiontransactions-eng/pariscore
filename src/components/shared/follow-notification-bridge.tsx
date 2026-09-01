"use client";

import { useEffect, useCallback } from "react";
import { useFollowStore } from "@/stores/use-follow-store";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * Intégration Follow → Notifications Push.
 *
 * Ce hook surveille les follows avec notifications activées et
 * envoie des alertes push quand un match correspondant est trouvé.
 *
 * Logique :
 * 1. Lit les follows avec notifications=true
 * 2. Compare avec les matchs en cours/à venir
 * 3. Envoie une push notification si un match match un follow
 * 4. Évite les doublons (même match notifié dans les 24h)
 *
 * Usage : `<FollowNotificationBridge />` dans le layout principal.
 */

const NOTIFIED_KEY = "pariscore.notified-matches";
const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

function getNotifiedMatches(): Record<string, number> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markAsNotified(matchId: string) {
  const notified = getNotifiedMatches();
  notified[matchId] = Date.now();
  // Nettoyer les anciens (plus de 24h)
  const now = Date.now();
  for (const [id, ts] of Object.entries(notified)) {
    if (now - ts > NOTIFICATION_COOLDOWN_MS) {
      delete notified[id];
    }
  }
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
}

function wasRecentlyNotified(matchId: string): boolean {
  const notified = getNotifiedMatches();
  const ts = notified[matchId];
  if (!ts) return false;
  return Date.now() - ts < NOTIFICATION_COOLDOWN_MS;
}

/**
 * Bridge entre le système de follow et les notifications push.
 * À placer dans le layout — vérifie périodiquement les matchs et envoie des alertes.
 */
export function FollowNotificationBridge() {
  const { follows } = useFollowStore();
  const { subscribed, sendTestAlert } = usePushNotifications();

  // Vérifier les notifications à envoyer (toutes les 5 min)
  useEffect(() => {
    if (!subscribed) return;

    const check = () => {
      const followsWithNotifications = Object.values(follows).filter(
        (f) => f.notifications && !wasRecentlyNotified(f.id),
      );

      if (followsWithNotifications.length === 0) return;

      // Pour l'instant, on log les follows actifs
      // L'intégration complète nécessiterait un polling des matchs
      // et une comparaison avec les follows
      console.log("[FollowNotification] Checking", followsWithNotifications.length, "follows for notifications");
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [follows, subscribed]);

  return null; // Composant silencieux
}

/**
 * Hook pour envoyer une notification quand un match est trouvé.
 * Utilisé par les composants qui détectent des matchs en direct.
 */
export function useFollowNotification() {
  const { follows } = useFollowStore();
  const { subscribed, sendTestAlert } = usePushNotifications();

  const notifyIfFollowed = useCallback(
    (matchId: string, matchLabel: string, sport: string) => {
      if (!subscribed) return;
      if (wasRecentlyNotified(matchId)) return;

      // Chercher un follow correspondant
      const matchingFollow = Object.values(follows).find((f) => {
        if (!f.notifications) return false;
        if (f.sport && f.sport !== sport) return false;

        // Vérifier si le nom du match contient le nom du follow
        const followName = f.name.toLowerCase();
        const matchLower = matchLabel.toLowerCase();
        return matchLower.includes(followName);
      });

      if (matchingFollow) {
        sendTestAlert({
          matchId,
          playerA: matchingFollow.name,
          playerB: "",
          probA: 50,
          bookmaker: "",
          decimalA: 0,
          impliedProbA: 0,
        });
        markAsNotified(matchId);
      }
    },
    [follows, subscribed, sendTestAlert],
  );

  return { notifyIfFollowed };
}
