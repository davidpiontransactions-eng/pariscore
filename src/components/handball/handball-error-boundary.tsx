"use client";
import { Component, type ReactNode } from "react";

export class HandballErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback ?? <div className="text-center py-8 text-muted-foreground">Erreur chargement handball</div>;
    return this.props.children;
  }
}
