"use client";

/**
 * Tessera del mosaico del login: entra con una molla (scaglionata per `index`), segue il puntatore con un riflesso
 * e, quando cambia `pulse`, emette un anello che si dissolve per segnalare che i suoi dati sono appena cambiati.
 */

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Ritardo tra l'ingresso di una tessera e la successiva, in secondi. */
const TILE_STAGGER_S = 0.09;

export interface MosaicTileProps {
  title: string;
  /** Testo a destra dell'intestazione. */
  aside?: React.ReactNode;
  /** Posizione nell'ordine di ingresso. */
  index: number;
  /** Cambia valore quando i dati della tessera cambiano: scatena l'anello. */
  pulse?: number;
  className?: string;
  children: React.ReactNode;
}

export function MosaicTile({ title, aside, index, pulse, className, children }: MosaicTileProps) {
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--my", `${event.clientY - rect.top}px`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 170, damping: 20, delay: index * TILE_STAGGER_S }}
      whileHover={{ y: -2 }}
      onPointerMove={handlePointerMove}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-sidebar-foreground/15 bg-sidebar-foreground/[0.04] p-3.5",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(150px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--primary) 18%, transparent), transparent 70%)",
        }}
      />
      <AnimatePresence>
        {pulse ? (
          <motion.span
            key={pulse}
            aria-hidden="true"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.1 }}
            className="pointer-events-none absolute inset-0 rounded-xl border border-primary"
          />
        ) : null}
      </AnimatePresence>

      <div className="relative flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
        <span>{title}</span>
        {aside ? <span className="normal-case tracking-normal">{aside}</span> : null}
      </div>
      <div className="relative flex flex-1 flex-col">{children}</div>
    </motion.div>
  );
}
