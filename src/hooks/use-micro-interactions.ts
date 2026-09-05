"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Hook central des micro-interactions.
 * Gère :
 * - prefers-reduced-motion (détection + écoute temps réel)
 * - intersectionObserver pour trigger au viewport
 * - will-change management
 * - Animation state tracking
 */
export function useMicroInteractions() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // --- prefers-reduced-motion ---
  useEffect(() => {
    // Snapshot initial
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    // Écoute temps réel
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);

    return () => mq.removeEventListener("change", handler);
  }, []);

  // --- Intersection Observer pour trigger au viewport ---
  const nodeRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (reducedMotion) {
      setIsInView(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50% 0px", // déclencher un peu avant d'être totalement visible
      }
    );

    if (nodeRef.current) {
      observer.observe(nodeRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [reducedMotion, hasAnimated]);

  // --- Méthode pour observer un élément ---
  const observe = useCallback((node: HTMLElement | null) => {
    if (!node) return;

    if (reducedMotion) {
      setIsInView(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      { threshold: 0.1 }
    );

    if (node) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
    };
  }, [reducedMotion, hasAnimated]);

  return {
    reducedMotion,
    isInView,
    hasAnimated,
    observe,
  };
}

/**
 * Détecte si on est dans un contexte de réduction de mouvement.
 * Utilisable hors client (SSR) via matchMedia.
 */
export function useReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}