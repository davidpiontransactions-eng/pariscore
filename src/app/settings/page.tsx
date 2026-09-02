"use client";

import { AbTestDebugBadge } from "@/components/ab-test-debug";

/**
 * Page Paramètres / Réglages.
 *
 * Centralise les outils de debug et de configuration disponibles
 * en mode développement. En production, tous les composants
 * retournent null (pas d'UI visible).
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold text-white">Paramètres</h1>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Debug &amp; Expérimentation
        </h2>
        <AbTestDebugBadge inline />
      </section>
    </div>
  );
}
