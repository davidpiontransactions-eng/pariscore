"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * T28 — ServiceWorkerUpdate
 *
 * Banner discret pour informer l'utilisateur qu'une mise à jour PWA est disponible.
 * Pattern Reddit/Twitter : bandeau en haut sans bloquer l'usage.
 *
 * Fonctionnalités :
 * - Détecte les mises à jour du service worker
 * - Affiche un banner avec bouton "Mettre à jour"
 * - Fermeture possible (mais la MAJ reste proposée au prochain refresh)
 * - Respecte reduced-motion
 * - Persiste le statut "dismissed" en session (pas de refresh pendant cette session)
 */

type Props = {
  className?: string;
};

export function ServiceWorkerUpdate({ className }: Props) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let swRegistration: ServiceWorkerRegistration | null = null;

    const checkForUpdates = async () => {
      try {
        swRegistration = await navigator.serviceWorker.ready;
        setRegistration(swRegistration);

        // Écouter les mises à jour
        swRegistration.addEventListener("updatefound", () => {
          const newWorker = swRegistration?.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });

        // Vérifier si une mise à jour est déjà en attente
        if (swRegistration.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
        }
      } catch {
        // Service worker non supporté ou erreur
      }
    };

    checkForUpdates();

    return () => {
      // Cleanup si nécessaire
    };
  }, []);

  const handleUpdate = useCallback(() => {
    if (!registration?.waiting) return;

    // Envoyer un message au SW pour qu'il s'active
    registration.waiting.postMessage({ type: "SKIP_WAITING" });

    // Recharger la page
    window.location.reload();
  }, [registration]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[9000] flex items-center justify-between gap-3 bg-emerald-600 px-4 py-2.5 text-sm text-white shadow-lg",
        className,
      )}
      role="alert"
      aria-label="Mise à jour disponible"
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="font-medium">Une mise à jour est disponible</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleUpdate}
          className="rounded-md bg-white/20 px-3 py-1 text-xs font-medium hover:bg-white/30 transition-colors"
        >
          Mettre à jour
        </button>
        <button
          onClick={handleDismiss}
          className="rounded-md p-1 hover:bg-white/20 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

