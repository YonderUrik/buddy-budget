"use client";

/** Tessera "Conti": i saldi si aggiornano a ogni movimento e la riga toccata si illumina un istante. */

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { WalletIcon } from "lucide-react";
import { MosaicTile } from "./mosaic-tile";
import { StoryCountUp } from "./story-count-up";
import type { MosaicLive, MosaicState } from "./login-mosaic.model";

interface AccountRow {
  id: keyof Pick<MosaicState, "checking" | "savings" | "card">;
  label: string;
  swatchVar: string;
}

const ACCOUNT_ROWS: readonly AccountRow[] = [
  { id: "checking", label: "Conto corrente", swatchVar: "--primary" },
  { id: "savings", label: "Risparmio", swatchVar: "--swatch-amber" },
  { id: "card", label: "Carta", swatchVar: "--swatch-violet" },
];

export interface MosaicAccountsTileProps {
  live: MosaicLive;
  className?: string;
}

export function MosaicAccountsTile({ live, className }: MosaicAccountsTileProps) {
  return (
    <MosaicTile title="Conti"
      icon={WalletIcon}
      color="var(--swatch-amber)" aside="3 conti collegati" index={4} className={className}>
      <ul className="mt-1.5">
        {ACCOUNT_ROWS.map((row) => {
          const value = live.state[row.id];
          const touched = row.id === "checking" && live.step > 0;
          return (
            <li key={row.id} className="relative flex items-center gap-2 border-b border-border py-1.5 text-[13px] last:border-b-0">
              {touched ? (
                <motion.span
                  key={live.step}
                  aria-hidden="true"
                  initial={{ opacity: 0.35 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0 rounded-md bg-primary/30"
                />
              ) : null}
              <span className="relative size-2 rounded-full" style={{ backgroundColor: `var(${row.swatchVar})` }} />
              <span className="relative">{row.label}</span>
              <span className={cn("relative ml-auto font-medium tabular-nums", value < 0 && "text-neg")}>
                <StoryCountUp value={value} duration={0.9} />
              </span>
            </li>
          );
        })}
      </ul>
    </MosaicTile>
  );
}
