"use client";

// Hook Document Picture-in-Picture API.
//
// Ouvre une fenêtre "always-on-top" (reste au-dessus de 1xWin+, le bookmaker)
// contenant du contenu React live — pas une vidéo. Idéal pour le widget
// PariScore : score + DR + bets visibles pendant que l'utilisateur parie.
//
// Spécifiques Document PiP (vs l'ancien `<video>.requestPictureInPicture`) :
//   - `window.documentPictureInPicture.requestWindow()` (Chrome/Edge 116+)
//   - Le PiP a son PROPRE `document` (DOM isolé du document principal)
//   - Il faut donc CLONER manuellement les `<style>`/`<link>` du parent vers
//     le PiP, sinon Tailwind/shadcn ne s'appliquent pas.
//   - On mount un `createRoot` React séparé dans `pipWindow.document.body`.
//
// Compatibilité : Chrome/Edge 116+, Opera 102+. PAS Firefox/Safari.
// Feature detection via `"documentPictureInPicture" in window`.

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";

export type UseDocumentPipResult = {
  /** true si l'API Document PiP est supportée par le navigateur. */
  supported: boolean;
  /** true si la fenêtre PiP est actuellement ouverte. */
  isOpen: boolean;
  /** Ouvre le PiP et mount le `content` React dedans. No-op si déjà ouvert. */
  open: (content: ReactNode) => Promise<void>;
  /** Ferme le PiP. No-op si fermé. */
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

export function useDocumentPip(): UseDocumentPipResult {
  const [supported] = useState(
    () =>
      typeof window !== "undefined" && "documentPictureInPicture" in window,
  );
  const [isOpen, setIsOpen] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const rootRef = useRef<Root | null>(null);
  // Contenu React à render — on le garde en ref pour pouvoir le re-render
  // si le caller appelle `open()` à nouveau avec un nouveau contenu.
  const contentRef = useRef<ReactNode>(null);

  /** Clone tous les <style> et <link rel="stylesheet"> du document principal
   *  vers le PiP. Sans ça, Tailwind n'est pas appliqué dans le PiP. */
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
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch {
        // déjà fermée
      }
      pipWindowRef.current = null;
    }
    setIsOpen(false);
  }, []);

  const open = useCallback(
    async (content: ReactNode) => {
      if (!supported) {
        console.warn("[use-document-pip] API non supportée (Chrome/Edge 116+ requis)");
        return;
      }
      // Si déjà ouvert, on met juste à jour le contenu (re-render).
      if (pipWindowRef.current && rootRef.current) {
        contentRef.current = content;
        rootRef.current.render(content);
        return;
      }

      try {
        const pipWindow = await window.documentPictureInPicture!.requestWindow({
          width: 420,
          height: 580,
        });
        pipWindowRef.current = pipWindow;
        contentRef.current = content;

        // Clone les styles AVANT le 1er render (sinon flash sans styles).
        cloneStyles(pipWindow.document);

        // Fond sombre cohérent avec l'app principale (bg-card du thème).
        pipWindow.document.body.style.backgroundColor = "#0E1217";
        pipWindow.document.body.style.margin = "0";
        pipWindow.document.body.style.padding = "0";
        // data-theme pour que les sélecteurs CSS dark mode du projet matchent.
        pipWindow.document.documentElement.setAttribute("data-theme", "dark");
        pipWindow.document.documentElement.classList.add("dark");

        // Mount React dans le document PiP (arbre React séparé du principal).
        const root = createRoot(pipWindow.document.body);
        rootRef.current = root;
        root.render(content);
        setIsOpen(true);

        // Cleanup auto quand l'utilisateur ferme la fenêtre manuellement
        // (croix ou Alt+F4) — sinon les refs restent vivantes et le prochain
        // open() pense que c'est déjà ouvert.
        pipWindow.addEventListener("pagehide", () => {
          if (rootRef.current) {
            try {
              rootRef.current.unmount();
            } catch {
              // ignore
            }
          }
          rootRef.current = null;
          pipWindowRef.current = null;
          setIsOpen(false);
        });
      } catch (err) {
        console.error("[use-document-pip] requestWindow failed:", err);
        setIsOpen(false);
      }
    },
    [supported, cloneStyles],
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
      if (pipWindowRef.current) {
        try {
          pipWindowRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { supported, isOpen, open, close };
}
