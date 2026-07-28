"use client";

// Notifications natives locales quand le feu tricolore passe à ✅ PARIE.
//
// Approche : `registration.showNotification()` (pas de serveur, pas de web-push).
// Le feu tricolore est calculé côté client (pip-match-row.tsx) à chaque maj SSE,
// on a donc déjà la donnée — inutile de repasser par le serveur.
//
// Anti-spam : le DR tanh-smoothed peut osciller autour du seuil 0.55, produisant
// plusieurs transitions bet→wait→bet. On limite à :
//   - 1 notif uniquement sur TRANSITION !bet → bet (jamais bet → bet)
//   - cooldown 2 min par match (même si transition il y a)
//   - tag `bet-${matchId}` pour dédoublonnage natif navigateur
//
// Compat : le Document PiP partage `navigator.serviceWorker` avec la fenêtre
// principale (même window/origin), donc `showNotification` marche depuis le PiP.
// Le handler `notificationclick` existant (public/sw.js:163) gère le focus +
// navigate gratuitement — pas de modification du SW nécessaire.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DrDecisionLevel } from "@/lib/dr-decision";

const STORAGE_KEY = "setpoint-bet-notify";
const COOLDOWN_MS = 120_000; // 2 min entre 2 notifs pour un même match

type MatchState = {
  lastLevel: DrDecisionLevel;
  lastNotifiedAt: number;
};

export type UseBetNotifyResult = {
  /** true si l'API Notification + ServiceWorker sont dispo. */
  supported: boolean;
  /** true si l'utilisateur a activé les notifs (persisté en localStorage). */
  enabled: boolean;
  /** Permission navigateur : "default" | "granted" | "denied". */
  permission: NotificationPermission;
  /** Active/désactive les notifs. Demande la permission au 1er enable. */
  toggle: () => Promise<void>;
  /**
   * À appeler à chaque maj du feu tricolore d'un match. Ne notifie QUE sur
   * transition `!bet → bet` + cooldown respecté. No-op si `enabled` est off.
   */
  notifyBet: (matchId: string, label: string, level: DrDecisionLevel) => void;
};

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEnabled(v: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {
    // localStorage désactivé — silently ignore
  }
}

export function useBetNotify(): UseBetNotifyResult {
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator,
  );
  const [enabled, setEnabled] = useState(readEnabled);
  const [permission, setPermission] = useState<NotificationPermission>(
    () => (typeof Notification !== "undefined" ? Notification.permission : "default"),
  );
  // Map<matchId, MatchState> en ref — persiste entre renders sans trigger re-render.
  const statesRef = useRef<Map<string, MatchState>>(new Map());

  const toggle = useCallback(async () => {
    if (!supported) return;
    const next = !enabled;
    if (next && Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        // L'utilisateur a refusé ou fermé le prompt → on n'active pas.
        return;
      }
    }
    setEnabled(next);
    writeEnabled(next);
    // Reset des états anti-spam au toggle on (fresh start).
    if (next) statesRef.current.clear();
  }, [enabled, supported]);

  const notifyBet = useCallback(
    async (matchId: string, label: string, level: DrDecisionLevel) => {
      if (!enabled || !supported) return;
      if (Notification.permission !== "granted") return;

      const now = Date.now();
      const prev = statesRef.current.get(matchId);

      // Détection de TRANSITION !bet → bet uniquement.
      const isTransition = (!prev || prev.lastLevel !== "bet") && level === "bet";
      if (!isTransition) {
        // Mémorise le niveau courant pour la détection de prochaine transition.
        if (prev) prev.lastLevel = level;
        else statesRef.current.set(matchId, { lastLevel: level, lastNotifiedAt: 0 });
        return;
      }

      // Cooldown par match.
      if (prev && now - prev.lastNotifiedAt < COOLDOWN_MS) {
        prev.lastLevel = level;
        return;
      }

      // Maj de l'état AVANT d'envoyer (évite double-notif si la promise résout lentement).
      statesRef.current.set(matchId, { lastLevel: level, lastNotifiedAt: now });

      try {
        // registration.showNotification > new Notification : gère le clic via sw.js
        // (focus + navigate) et survit à la fermeture du document émetteur.
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(`🎯 ${label} — moment de parier`, {
          body: "Dominance nette détectée · feu tricolore ✅",
          tag: `bet-${matchId}`, // dédoublonnage natif : remplace l'existante pour ce match
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          // requireInteraction: false (défaut) — auto-dismiss, l'utilisateur
          // parie et voit vite la notif sans avoir à la fermer manuellement.
        });
      } catch (err) {
        // Fallback si pas de SW (typiquement en dev hors prod-build).
        // new Notification est moins puissant (pas d'actions, pas de clic SW)
        // mais dépanne pour tester en local.
        if ("Notification" in window) {
          try {
            new Notification(`🎯 ${label} — moment de parier`, {
              body: "Dominance nette détectée · feu tricolore ✅",
              tag: `bet-${matchId}`,
            });
          } catch {
            console.warn("[use-bet-notify] notification failed:", err);
          }
        }
      }
    },
    [enabled, supported],
  );

  // Sync permission si elle change ailleurs (ex: paramètres navigateur).
  useEffect(() => {
    if (!supported) return;
    const handler = () => setPermission(Notification.permission);
    // Pas d'event natif fiable pour le changement de permission ; on check au focus.
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [supported]);

  return { supported, enabled, permission, toggle, notifyBet };
}
