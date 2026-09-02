"use client";

import { AbTestDebugBadge } from "@/components/ab-test-debug";
import { DensityToggle } from "@/components/ui/density-toggle";

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
          Affichage
        </h2>
        <div className="rounded-lg border border-border/40 bg-zinc-900/40 p-4">
          <p className="mb-3 text-sm text-zinc-300">Densité d'affichage</p>
          <DensityToggle />
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Debug &amp; Expérimentation
        </h2>
        <AbTestDebugBadge inline />
      </section>
    </div>
  );
}
