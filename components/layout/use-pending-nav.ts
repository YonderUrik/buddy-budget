"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Voce di navigazione appena toccata, prima che la nuova pagina arrivi: serve a spostare subito l'indicatore della voce
 * attiva (sidebar e barra in basso) invece di aspettare il caricamento. Torna `null` appena cambia il percorso, perché
 * da lì in poi la voce attiva la dice il percorso stesso.
 */
export function usePendingNavHref(): [string | null, (href: string) => void] {
  const pathname = usePathname();
  const [pending, setPending] = React.useState<{ href: string; from: string } | null>(null);
  const href = pending && pending.from === pathname ? pending.href : null;
  const start = React.useCallback((next: string) => setPending({ href: next, from: pathname }), [pathname]);
  return [href, start];
}
