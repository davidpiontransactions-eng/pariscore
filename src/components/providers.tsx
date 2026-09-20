"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Providers globaux côté client.
 * Wrapping de l'app avec SessionProvider pour next-auth.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
