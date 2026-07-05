"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Optional fallback render. Defaults to the built-in French fallback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * SentryErrorBoundary — captures uncaught render errors and forwards them to Sentry,
 * then renders a user-friendly fallback UI with a reload button.
 *
 * Note: this is a *client* boundary. For errors thrown in server components /
 * root layout, Sentry's instrumentation already captures them server-side.
 */
export class SentryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Forward the error (with its React component stack) to Sentry.
    Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) return fallback(error, this.handleReset);

      return (
        <div
          role="alert"
          className="flex min-h-[60vh] w-full items-center justify-center p-6"
        >
          <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">
                Une erreur est survenue
              </h2>
              <p className="text-sm text-muted-foreground">
                L&apos;équipe a été notifiée. Veuillez réessayer.
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
