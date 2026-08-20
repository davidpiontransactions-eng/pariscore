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
    // Garde anti-reload au premier claim : sur une PREMIÈRE visite, le SW
    // fraîchement activé appelle clients.claim() (public/sw.js) →
    // 'controllerchange' se déclenche alors qu'aucun ancien SW ne contrôlait
    // la page. Sans cette garde, chaque première visite rechargeait la page
    // 1-3 s après le load (flash visible, double chargement — notamment dans
    // la WebView APK juste après le splash). Le reload n'est légitime que
    // lorsqu'un SW déjà actif est remplacé par une nouvelle version.
    let hadController = !!navigator.serviceWorker.controller;
    const handleControllerChange = () => {
      if (refreshing) return;
      if (!hadController) {
        hadController = true; // premier claim : on prend note, pas de reload
        return;
      }
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
            if (installingWorker.state === "installed" && hadController) {
              // SKIP_WAITING uniquement pour une MISE À JOUR (un SW actif
              // est déjà présent, hadController=true). Au premier install le
              // SW s'active seul via son skipWaiting() (public/sw.js) —
              // poster ici créerait un controllerchange fantôme → double
              // reload de la page (bug observé en QA mobile 375px).
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
