"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA offline support.
 * Renders nothing — purely a side-effect component.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // dev: skip SW

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        console.log("[PWA] Service worker registered");
      } catch (err) {
        console.warn("[PWA] SW registration failed", err);
      }
    };
    register();
  }, []);

  return null;
}
