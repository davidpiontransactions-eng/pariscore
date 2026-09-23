"use client";
import { Component, type ReactNode } from "react";

/**
 * Error boundary de l'onglet Basket — fix audit 2026-09-23 : aucun boundary
 * n'était monté, un TypeError (ex. dialog EuroLeague) faisait tomber l'onglet.
 */
export class BasketballErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return (
        this.props.fallback ?? (
          <div className="text-center py-8 text-muted-foreground">Erreur chargement basket</div>
        )
      );
    return this.props.children;
  }
}
