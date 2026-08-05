"use client";

// Hook Document Picture-in-Picture API + FENÊTRE POPUP.
//
// Ouvre une fenêtre contenant du contenu React live — pas une vidéo. Idéal
// pour le widget PariScore : score + DR + bets visibles pendant que
// l'utilisateur parie sur 1xWin+.
//
// 2 transports selon le support navigateur :
//
//   1. Document PiP natif (`documentPictureInPicture.requestWindow()`)
//      - Chrome/Edge 116+, Opera 102+
//      - Fenêtre ALWAYS-ON-TOP (reste au-dessus du bookmaker)
//      - Le PiP a son PROPRE `document` (DOM isolé) → on clone les styles
//
//   2. Fallback fenêtre popup (`window.open()`)
//      - Brave (Désactive Document PiP via Shields), Firefox, Safari, vieux Chromium
//      - Pas d'always-on-top natif (mais l'utilisateur peut la garder au premier
//        plan via Alt+Space → "Toujours au premier plan" sur Win11, ou la placer
//        manuellement à côté du bookmaker)
//      - Même isolation `document` que PiP → on clone aussi les styles
//      - Survit aux changements d'onglet dans la fenêtre principale
//
// L'API publique est identique dans les 2 cas : le caller (tennis-tab-content)
// ne sait pas quel transport est utilisé. `mode` expose l'info pour debug/UI.

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";

export type PipMode = "pip" | "popup";

export type UseDocumentPipResult = {
  /** true si AU MOINS UN des 2 transports est dispo (toujours vrai en pratique). */
  supported: boolean;
  /** Quel transport sera utilisé : "pip" (natif) ou "popup" (fallback). */
  mode: PipMode;
  /** true si la fenêtre est actuellement ouverte. */
  isOpen: boolean;
  /** Ouvre le widget et mount le `content` React dedans. No-op si déjà ouvert. */
  open: (content: ReactNode) => Promise<void>;
  /** Ferme la fenêtre. No-op si fermée. */
  close: () => void;
};

// Augmentation du type global pour `documentPictureInPicture` (non dans les
// lib.dom.d.ts anciens). On déclare le minimum nécessaire.
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: {
        width?: number;
        height?: number;
      }) => Promise<Window>;
      window: Window | null;
    };
  }
}

const WIDGET_WIDTH = 440;
const WIDGET_HEIGHT = 620;

export function useDocumentPip(): UseDocumentPipResult {
  // SSR-safe : en serveur `window` n'existe pas → pas de carte "pip" côté
  // serveur. Le support réel DocPiP est détecté APRES hydration (useEffect)
  // pour éviter un hydration mismatch sur `mode` (server=popup, client=pip).
  const [pipSupported, setPipSupported] = useState(false);
  // Ref miroir : `open()` peut être invoqué par un timer/effet auto-open qui a
  // capturé le state SSR initial (false). On lit le ref au moment de l'appel
  // pour toujours voir le support réel détecté post-hydration.
  const pipSupportedRef = useRef(false);

  useEffect(() => {
    const canPip = typeof window !== "undefined" && "documentPictureInPicture" in window;
    setPipSupported(canPip);
    pipSupportedRef.current = canPip;
  }, []);

  // Popup toujours dispo (window.open existe partout). Le hook est donc
  // "supported" même sur Brave/Firefox/Safari.
  const supported = true;
  const mode: PipMode = pipSupported ? "pip" : "popup";

  const [isOpen, setIsOpen] = useState(false);
  // `Window` pour les 2 transports (PiP ET popup retournent un Window).
  const winRef = useRef<Window | null>(null);
  const rootRef = useRef<Root | null>(null);

  /** Clone tous les <style> et <link rel="stylesheet"> du document principal
   *  vers la fenêtre cible. Sans ça, Tailwind n'est pas appliqué. */
  const cloneStyles = useCallback((targetDoc: Document) => {
    // 1. <style> inline (Tailwind 4 injecte ses styles ici en dev).
    document.querySelectorAll('style:not([data-pip="skip"])').forEach((style) => {
      const clone = style.cloneNode(true) as HTMLStyleElement;
      targetDoc.head.appendChild(clone);
    });
    // 2. <link rel="stylesheet"> (CSS externes — typiquement la prod).
    document
      .querySelectorAll('link[rel="stylesheet"]')
      .forEach((link) => {
        const clone = link.cloneNode(true) as HTMLLinkElement;
        targetDoc.head.appendChild(clone);
      });
  }, []);

  /** Initialise le document de la fenêtre cible (PiP ou popup) :
   *  styles + fond sombre + mount React. */
  const mountInWindow = useCallback(
    (targetWindow: Window, content: ReactNode) => {
      cloneStyles(targetWindow.document);
      targetWindow.document.body.style.backgroundColor = "#0E1217";
      targetWindow.document.body.style.margin = "0";
      targetWindow.document.body.style.padding = "0";
      targetWindow.document.documentElement.setAttribute("data-theme", "dark");
      targetWindow.document.documentElement.classList.add("dark");

      const root = createRoot(targetWindow.document.body);
      rootRef.current = root;
      root.render(content);
      setIsOpen(true);

      // Cleanup auto quand l'utilisateur ferme la fenêtre manuellement
      // (croix, Alt+F4, ou fermeture popup).
      const cleanup = () => {
        if (rootRef.current) {
          try {
            rootRef.current.unmount();
          } catch {
            // ignore
          }
        }
        rootRef.current = null;
        winRef.current = null;
        setIsOpen(false);
      };
      // `pagehide` couvre PiP (spec) ET popup (déclenche au close).
      targetWindow.addEventListener("pagehide", cleanup);
      // `beforeunload` est plus fiable pour les popups sur certains navigateurs.
      targetWindow.addEventListener("beforeunload", cleanup);
    },
    [cloneStyles],
  );

  /** Ouvre via window.open() — fallback Brave/Firefox/Safari/vieux Chromium.
   *  Déclaré AVANT openPip car openPip y fait référence (fallback runtime). */
  const openPopup = useCallback(
    async (content: ReactNode) => {
      // about:blank pour avoir un document vierge à contrôler entièrement
      // (sinon le popup charge une page complète et on perd le contrôle du DOM).
      const popup = window.open(
        "about:blank",
        "pariscore-widget",
        // Features Win11 : dimensions + position + pas de toolbar (compact).
        `width=${WIDGET_WIDTH},height=${WIDGET_HEIGHT},` +
          `left=${window.screenX + window.outerWidth - WIDGET_WIDTH - 20},` +
          `top=${window.screenY + 80},` +
          `toolbar=no,menubar=no,location=no,status=no,resizable=yes`,
      );
      if (!popup) {
        // Bloqueur de popup actif → on prévient l'utilisateur.
        console.error("[use-document-pip] popup bloqué par le navigateur");
        alert(
          "Le widget n'a pas pu s'ouvrir : popup bloqué par le navigateur.\n" +
            "Autorise les popups pour pariscore.fr dans les paramètres.",
        );
        setIsOpen(false);
        return;
      }
      winRef.current = popup;
      // Donne un titre à la fenêtre popup (visible dans la barre des tâches Win11).
      popup.document.title = "PariScore Live — Widget";
      mountInWindow(popup, content);
    },
    [mountInWindow],
  );

  /** Ouvre via Document PiP natif (Chrome/Edge 116+).
   *  Bascule sur openPopup si le PiP échoue runtime (Brave bloque au runtime
   *  même si l'API est présente dans `window`). */
  const openPip = useCallback(
    async (content: ReactNode) => {
      try {
        const pipWindow = await window.documentPictureInPicture!.requestWindow({
          width: WIDGET_WIDTH,
          height: WIDGET_HEIGHT,
        });
        winRef.current = pipWindow;
        mountInWindow(pipWindow, content);
      } catch (err) {
        console.error("[use-document-pip] requestWindow failed, fallback popup:", err);
        await openPopup(content);
      }
    },
    [mountInWindow, openPopup],
  );

  /** Ferme proprement : unmount React + ferme la fenêtre. */
  const close = useCallback(() => {
    if (rootRef.current) {
      try {
        rootRef.current.unmount();
      } catch {
        // déjà unmount
      }
      rootRef.current = null;
    }
    if (winRef.current) {
      try {
        winRef.current.close();
      } catch {
        // déjà fermée
      }
      winRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const open = useCallback(
    async (content: ReactNode) => {
      // Si déjà ouvert, on met juste à jour le contenu (re-render).
      if (winRef.current && rootRef.current) {
        rootRef.current.render(content);
        return;
      }
      // Détection au moment de l'appel (pas le state SSR capturé par un
      // éventuel timer auto-open) — voir pipSupportedRef.
      if (pipSupportedRef.current) {
        await openPip(content);
      } else {
        await openPopup(content);
      }
    },
    [openPip, openPopup],
  );

  // Cleanup au unmount du caller (ex: changement de page dans l'app principale).
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        try {
          rootRef.current.unmount();
        } catch {
          // ignore
        }
      }
      if (winRef.current) {
        try {
          winRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { supported, mode, isOpen, open, close };
}
