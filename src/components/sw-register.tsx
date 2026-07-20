"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA offline support + gère le cycle
 * d'update pour que les nouveaux déploiements soient visibles automatiquement
 * chez les visiteurs existants (sans intervention DevTools).
 *
 * HOTFIX 2026-07-20 (BUG-2) : avant, le composant enregistrait le SW mais
 * n'écoutait jamais 'controllerchange' ni ne postait SKIP_WAITING → les
 * nouveaux SW installés restaient en attente indéfiniment, et les utilisateurs
 * existants ne voyaient jamais les nouvelles versions sans fermer tous leurs
 * onglets. Désormais :
 *   - on écoute 'updatefound' → si un nouveau SW passe en 'waiting',
 *     on lui poste SKIP_WAITING pour qu'il s'active immédiatement
 *   - on écoute 'controllerchange' → reload auto de la page une fois le
 *     nouveau SW actif
 *
 * Renders nothing — purely a side-effect component.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // dev: skip SW

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        console.log("[PWA] Service worker registered");

        // Quand un nouveau SW est téléchargé et passe en 'installed/waiting',
        // on le pousse à s'activer immédiatement (skipWaiting côté SW).
        const handleUpdateFound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;
          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Il y a déjà un SW actif → un nouveau vient d'arriver.
              // On poste SKIP_WAITING pour forcer son activation.
              installingWorker.postMessage("SKIP_WAITING");
            }
          });
        };
        reg.addEventListener("updatefound", handleUpdateFound);

        // Si un SW est déjà en 'waiting' au chargement (déployé depuis la
        // dernière visite), on l'active tout de suite.
        if (reg.waiting) {
          reg.waiting.postMessage("SKIP_WAITING");
        }
      } catch (err) {
        console.warn("[PWA] SW registration failed", err);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    register();

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
