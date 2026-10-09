/**
 * Sezione del mosaico del login, nello stile della Panoramica: nessun riquadro, solo icona su fondo tinto e titolo.
 * Entra con una molla (scaglionata per `index`) e, quando cambia `pulse`, l'icona emette un anello che si dissolve
 * per segnalare che i suoi dati sono appena cambiati.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Ritardo tra l'ingresso di una sezione e la successiva, in secondi. */
const TILE_STAGGER_S = 0.09;

export interface MosaicTileProps {
  title: string;
  icon: LucideIcon;
  /** Token CSS del colore dell'ambito (es. `var(--swatch-teal)`): tinge l'icona e il suo fondo. */
  color: string;
  /** Testo a destra dell'intestazione. */
  aside?: React.ReactNode;
  /** Posizione nell'ordine di ingresso. */
  index: number;
  /** Cambia valore quando i dati della sezione cambiano: scatena l'anello. */
  pulse?: number | string;
  className?: string;
  children: React.ReactNode;
}

export function MosaicTile({ title, icon: Icon, color, aside, index, pulse, className, children }: MosaicTileProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 170, damping: 22, delay: index * TILE_STAGGER_S }}
      className={cn("flex flex-col", className)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="relative grid size-8 place-items-center rounded-full"
            style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}
            aria-hidden="true"
          >
            <Icon className="size-4" />
            <AnimatePresence>
              {pulse ? (
                <motion.span
                  key={pulse}
                  initial={{ opacity: 0.9, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  transition={{ duration: 1.1 }}
                  className="pointer-events-none absolute inset-0 rounded-full border"
                  style={{ borderColor: color }}
                />
              ) : null}
            </AnimatePresence>
          </span>
          <h3 className="font-heading text-base font-medium text-foreground">{title}</h3>
        </div>
        {aside ? <span className="text-xs text-text-3">{aside}</span> : null}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </motion.section>
  );
}
