// Nom collé à chaque tableau handball (demande user 2026-09-26) : les tableaux
// doivent être identifiés en mode mobile comme en mode desktop. Le <caption>
// natif reste attaché au tableau — même dans un conteneur overflow-x-auto,
// le nom défile avec le tableau et reste toujours visible au-dessus de l'en-tête.
import type { ReactNode } from "react";

export function HandballTableCaption({ children }: { children: ReactNode }) {
  return (
    <caption className="caption-top pb-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-[#222222] sm:text-xs">
      {children}
    </caption>
  );
}
