"use client";

/**
 * Lista i cui elementi entrano con una molla e fanno spazio agli altri scivolando, ed escono sfumando. Idea di
 * Animated List di Magic UI (MIT). Pensata per liste brevi che cambiano mentre le guardi (conti in sync, risultati
 * di un import), non per liste lunghe: ogni riga misura la propria posizione a ogni cambio.
 */

import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { SPRING_BOUNCY, SPRING_SNAPPY } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

export interface AnimatedListItem {
  /** Chiave stabile dell'elemento. */
  key: string;
  content: React.ReactNode;
}

export interface AnimatedListProps {
  items: readonly AnimatedListItem[];
  className?: string;
  itemClassName?: string;
  /** Etichetta accessibile della lista (facoltativa). */
  ariaLabel?: string;
}

export function AnimatedList({ items, className, itemClassName, ariaLabel }: AnimatedListProps) {
  return (
    <ul className={cn("flex flex-col", className)} aria-label={ariaLabel}>
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.key}
            layout="position"
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: SPRING_BOUNCY }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={SPRING_SNAPPY}
            className={itemClassName}
          >
            {item.content}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
