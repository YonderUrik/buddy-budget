"use client";

/**
 * Novità come etichetta accanto alla data della Panoramica: un testo in colore primario con una scintilla che gira
 * una volta e un riflesso che attraversa il testo un paio di volte, poi resta ferma. Toccandola si apre un popover
 * (foglio dal basso sul telefono) con la spiegazione, il pulsante per provarla e «Non mostrare più».
 */

import Link from "next/link";
import { motion } from "motion/react";
import { SparklesIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import type { WhatsNewEntry } from "@/lib/whats-new/entries";

export interface WhatsNewChipProps {
  entry: WhatsNewEntry;
  onDismiss: (id: string) => void;
  /** Ritardo d'ingresso in secondi, per farla arrivare dopo il saluto. */
  delay?: number;
}

export function WhatsNewChip({ entry, onDismiss, delay = 0.6 }: WhatsNewChipProps) {
  return (
    <Popover onOpenChange={(open) => open && track("whats_new_opened", { id: entry.id })}>
      <motion.span
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex"
      >
        <PopoverTrigger className="group inline-flex items-center gap-1.5 rounded-full py-0.5 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <motion.span
            initial={{ rotate: -90, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex"
          >
            <SparklesIcon className="size-3.5" aria-hidden />
          </motion.span>
          <span className="text-sweep-once font-medium underline-offset-4 group-hover:underline">Novità: {entry.title}</span>
        </PopoverTrigger>
      </motion.span>
      <PopoverContent align="start" className="w-80 gap-3 p-4">
        <PopoverTitle className="flex items-center gap-2 font-heading text-base font-medium">
          <SparklesIcon className="size-4 text-primary" aria-hidden />
          {entry.title}
        </PopoverTitle>
        <PopoverDescription className="text-sm leading-relaxed text-muted-foreground">{entry.summary}</PopoverDescription>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              track("whats_new_dismissed", { id: entry.id });
              onDismiss(entry.id);
            }}
          >
            Non mostrare più
          </Button>
          <Link href={entry.href} className={buttonVariants({ size: "sm" })} onClick={() => track("whats_new_clicked", { id: entry.id })}>
            {entry.ctaLabel}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
