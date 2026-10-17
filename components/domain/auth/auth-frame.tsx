"use client";

/**
 * AuthFrame
 *
 * Scene of the sign-in and onboarding pages, in the same world as the landing: on the left a panel (brand, the page's
 * form, links to the site), on the right the Panoramica preview (`AuthPreview`, only from `lg`) on the landing's navy
 * ground. Where the preview is not needed (`asideHiddenOn`, e.g. onboarding) the panel takes the whole width, centred.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AuthPreview } from "./auth-preview";

export interface AuthFrameProps {
  /** Riga in alto del pannello (marchio e, a destra, la scelta della lingua). */
  brand: React.ReactNode;
  /** Riga in fondo al pannello (link al sito, sicurezza, aiuto). */
  foot?: React.ReactNode;
  /** Contenuto a destra del form; di default l'anteprima della Panoramica. */
  aside?: React.ReactNode;
  /** Percorsi in cui il contenuto a destra non si mostra (es. l'onboarding, dove conta solo il form). */
  asideHiddenOn?: readonly string[];
  /** Il form della pagina. */
  children: React.ReactNode;
  className?: string;
}

/** Form panel on the left and the app preview on navy on the right; without the preview, the panel widens and centres. */
export function AuthFrame({ brand, foot, aside, asideHiddenOn = [], children, className }: AuthFrameProps) {
  const pathname = usePathname();
  const showAside = !asideHiddenOn.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <div className={cn("min-h-dvh bg-background", showAside && "lg:grid lg:grid-cols-[520px_minmax(0,1fr)]", className)}>
      <section className={cn("flex min-h-dvh flex-col bg-card px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] lg:px-14 lg:pb-10 lg:pt-[calc(2.25rem+env(safe-area-inset-top))]", showAside && "lg:border-r lg:border-border")}>
        <div className={cn("flex w-full items-center justify-between gap-4", !showAside && "mx-auto max-w-2xl")}>{brand}</div>
        <div className={cn("my-auto w-full py-10 lg:py-12", showAside ? "max-w-[400px]" : "mx-auto max-w-2xl")}>{children}</div>
        {foot && <div className={cn("w-full", !showAside && "mx-auto max-w-2xl")}>{foot}</div>}
      </section>
      {showAside && (
        <aside className="hidden place-items-center overflow-hidden bg-brand-navy p-12 lg:grid" aria-label="Anteprima dell'app">
          {aside ?? <AuthPreview />}
        </aside>
      )}
    </div>
  );
}
