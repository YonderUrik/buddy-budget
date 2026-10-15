"use client";

/**
 * AuthFrame
 *
 * Scena delle pagine di accesso e onboarding, nello stesso mondo della landing «Sei domande»: a sinistra un pannello
 * (marchio, il form della pagina, i link al sito), a destra l'anteprima della Panoramica (`AuthPreview`, solo da `lg`).
 * Dove l'anteprima non serve (`asideHiddenOn`, es. l'onboarding) il pannello occupa tutta la larghezza, centrato.
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

/** Pannello del form a sinistra e anteprima dell'app a destra; senza anteprima, il pannello si allarga e si centra. */
export function AuthFrame({ brand, foot, aside, asideHiddenOn = [], children, className }: AuthFrameProps) {
  const pathname = usePathname();
  const showAside = !asideHiddenOn.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  return (
    <div className={cn("min-h-dvh bg-background", showAside && "lg:grid lg:grid-cols-[520px_minmax(0,1fr)]", className)}>
      <section className={cn("flex min-h-dvh flex-col bg-card px-5 pb-8 pt-6 lg:px-14 lg:pb-10 lg:pt-9", showAside && "lg:border-r lg:border-border")}>
        <div className={cn("flex w-full items-center justify-between gap-4", !showAside && "mx-auto max-w-2xl")}>{brand}</div>
        <div className={cn("my-auto w-full py-10 lg:py-12", showAside ? "max-w-[400px]" : "mx-auto max-w-2xl")}>{children}</div>
        {foot && <div className={cn("w-full", !showAside && "mx-auto max-w-2xl")}>{foot}</div>}
      </section>
      {showAside && (
        <aside className="hidden place-items-center overflow-hidden p-12 lg:grid" aria-label="Anteprima dell'app">
          {aside ?? <AuthPreview />}
        </aside>
      )}
    </div>
  );
}
