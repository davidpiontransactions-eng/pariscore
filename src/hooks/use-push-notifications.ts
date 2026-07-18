"use client";

import { useEffect, useState } from "react";
import { useAnalytics } from "@/components/analytics-provider";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type SubscriptionState = "unsupported" | "not-subscribed" | "subscribing" | "subscribed" | "denied";

// In-memory cache of the current subscription state (persists across hook instances)
let cachedSubscription: PushSubscription | null = null;

export function usePushNotifications() {
  const [state, setState] = useState<SubscriptionState>("not-subscribed");
  const [mounted, setMounted] = useState(false);
  const { track } = useAnalytics();

  useEffect(() => {
    Promise.resolve().then(async () => {
      setMounted(true);
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      if (!supported) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          cachedSubscription = sub;
          setState("subscribed");
        } else {
          setState("not-subscribed");
        }
      } catch {
        setState("not-subscribed");
      }
    });
  }, []);

  const subscribe = async (): Promise<boolean> => {
    if (state === "unsupported" || !VAPID_PUBLIC_KEY) return false;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        track("push_permission_denied");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      cachedSubscription = sub;
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState("subscribed");
      track("push_subscribed");
      return true;
    } catch (err) {
      console.error("[push] subscribe failed", err);
      return false;
    }
  };

  const unsubscribe = async (): Promise<boolean> => {
    if (!cachedSubscription) return false;
    try {
      await cachedSubscription.unsubscribe();
      cachedSubscription = null;
      setState("not-subscribed");
      track("push_unsubscribed");
      return true;
    } catch (err) {
      console.error("[push] unsubscribe failed", err);
      return false;
    }
  };

  const sendTestAlert = async (matchData: {
    matchId: string;
    playerA: string;
    playerB: string;
    probA: number;
    bookmaker: string;
    decimalA: number;
    impliedProbA: number;
  }): Promise<boolean> => {
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchData),
      });
      if (!res.ok) return false;
      track("push_test_alert_sent", {
        match_id: matchData.matchId,
        bookmaker: matchData.bookmaker,
      });
      return true;
    } catch (err) {
      console.error("[push] test alert failed", err);
      return false;
    }
  };

  return {
    supported: state !== "unsupported" && mounted,
    state,
    subscribed: state === "subscribed",
    subscribe,
    unsubscribe,
    sendTestAlert,
  };
}

// Convert VAPID public key (base64url) to Uint8Array for PushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
