"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Sezione di un percorso: il primo segmento (`/liquidita/conti` → `liquidita`). */
export function sectionOf(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

/**
 * Fa entrare il contenuto con una dissolvenza breve (200 ms, leggero scorrimento dal basso) quando si cambia sezione
 * dalla navigazione, mai alla prima apertura. Solo in entrata: la pagina vecchia sparisce subito, così il cambio resta
 * istantaneo. Le schede dentro una stessa sezione non ripartono (hanno già il loro indicatore). Con il movimento ridotto
 * non si anima.
 */
export function SectionTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  const section = sectionOf(usePathname());
  // Alla prima apertura il contenuto non si anima: solo dopo un cambio di sezione.
  const [previous, setPrevious] = React.useState(section);
  const [moved, setMoved] = React.useState(false);
  if (previous !== section) {
    setPrevious(section);
    setMoved(true);
  }
  return (
    <div
      key={section}
      className={cn(
        moved && "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-out motion-reduce:animate-none",
        className
      )}
    >
      {children}
    </div>
  );
}
