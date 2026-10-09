"use client";

/**
 * Tessera "Movimenti": ogni movimento entra dall'alto come arriva dalla banca (testo grezzo con una scansione di
 * luce), poi si trasforma nel movimento pulito con categoria colorata. Gli altri scivolano giù, l'ultimo svanisce.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { MOSAIC_TIMING, type MosaicFeedItem } from "./login-mosaic.model";
import { ReceiptTextIcon } from "lucide-react";
import { MosaicTile } from "./mosaic-tile";
import { STORY_EASE } from "./story-motion";

function MovementRow({ item }: { item: MosaicFeedItem }) {
  const reduceMotion = useReducedMotion() ?? false;
  const { event } = item;
  const [resolved, setResolved] = React.useState(reduceMotion);

  React.useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => setResolved(true), MOSAIC_TIMING.resolveMs);
    return () => clearTimeout(timer);
  }, [reduceMotion]);

  const isIncome = event.amount > 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.5, ease: STORY_EASE, layout: { duration: 0.45, ease: STORY_EASE } }}
      className="relative h-11 shrink-0 overflow-hidden border-b border-border last:border-b-0"
    >
      <AnimatePresence mode="wait" initial={false}>
        {resolved ? (
          <motion.div
            key="clean"
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.4, ease: STORY_EASE }}
            className="flex h-full items-center gap-2.5"
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 14 }}
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: `var(${event.swatchVar})` }}
            />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium">{event.merchant}</span>
              <span className="block truncate text-[11px] text-text-3">{event.category}</span>
            </span>
            <span className={cn("text-[13px] font-medium tabular-nums", isIncome && "text-pos")}>
              {isIncome ? "+" : ""}
              {formatCurrency(event.amount, "EUR")}
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="raw"
            exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.2 } }}
            className="relative flex h-full items-center"
          >
            <span className="truncate font-mono text-[11px] text-text-3">{event.raw}</span>
            <motion.span
              aria-hidden="true"
              className="absolute inset-y-1 w-1/3 bg-gradient-to-r from-transparent via-primary/30 to-transparent"
              initial={{ x: "-120%" }}
              animate={{ x: "380%" }}
              transition={{ duration: MOSAIC_TIMING.resolveMs / 1000, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export interface MosaicMovementsTileProps {
  feed: readonly MosaicFeedItem[];
  className?: string;
}

export function MosaicMovementsTile({ feed, className }: MosaicMovementsTileProps) {
  return (
    <MosaicTile title="Movimenti" icon={ReceiptTextIcon} color="var(--swatch-violet)" aside="in automatico" index={1} pulse={feed[0]?.key} className={className}>
      <ul className="mt-2 flex min-h-[8.5rem] flex-1 flex-col overflow-hidden [mask-image:linear-gradient(to_bottom,black_72%,transparent)]">
        <AnimatePresence initial={false}>
          {feed.map((item) => (
            <MovementRow key={item.key} item={item} />
          ))}
        </AnimatePresence>
      </ul>
    </MosaicTile>
  );
}
