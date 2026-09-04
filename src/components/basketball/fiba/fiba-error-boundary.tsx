"use client";

import { Component, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class FibaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("FIBA component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="destructive" className="text-[10px]">Erreur</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Une erreur est survenue lors du chargement des données FIBA.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
