"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { APP_BUILD_INFO } from "@/lib/app-version";
import { sanitizePath, type ReportContext } from "@/lib/support";

/**
 * Contesto tecnico da allegare alla segnalazione: pagina da cui l'utente è arrivato, versione, schermo e tema.
 * Mai dati finanziari. `from` è la pagina precedente passata dal link (`?da=`), altrimenti la pagina corrente.
 */
export function useReportContext(from: string | null): ReportContext {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const viewport = typeof window === "undefined" ? "0x0" : `${window.innerWidth}x${window.innerHeight}`;
  return {
    path: sanitizePath(from ?? pathname),
    version: APP_BUILD_INFO.version,
    viewport: /^\d{2,5}x\d{2,5}$/.test(viewport) ? viewport : "100x100",
    theme: resolvedTheme === "dark" ? "scuro" : "chiaro",
  };
}
