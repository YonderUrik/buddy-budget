"use client";

/**
 * Novità come ultima frase del racconto della Panoramica: entra dopo il saluto emergendo dalla sfocatura, con il nome
 * della funzione come link sottolineato che si disegna da sinistra a destra. Una piccola X la nasconde per sempre.
 */

import Link from "next/link";
import { motion } from "motion/react";
import { XIcon } from "lucide-react";
import { track } from "@/lib/analytics";
import type { WhatsNewEntry } from "@/lib/whats-new/entries";

export interface WhatsNewLineProps {
  entry: WhatsNewEntry;
  onDismiss: (id: string) => void;
  /** Ritardo d'ingresso in secondi. */
  delay?: number;
}

export function WhatsNewLine({ entry, onDismiss, delay = 0.9 }: WhatsNewLineProps) {
  return (
    <motion.span
      initial={{ opacity: 0, filter: "blur(8px)", y: 6 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="inline"
    >
      <span className="text-primary">Novità: </span>
      <Link
        href={entry.href}
        title={entry.summary}
        onClick={() => track("whats_new_clicked", { id: entry.id })}
        className="draw-underline font-heading font-medium text-foreground"
        style={{ animationDelay: `${delay + 0.4}s` }}
      >
        {entry.title.toLowerCase().startsWith("categorizza") ? "puoi categorizzare con l'AI" : entry.title}
      </Link>
      <button
        type="button"
        aria-label="Nascondi la novità"
        onClick={() => {
          track("whats_new_dismissed", { id: entry.id });
          onDismiss(entry.id);
        }}
        className="ml-1 inline-flex size-6 translate-y-0.5 items-center justify-center rounded-full align-baseline text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <XIcon className="size-3.5" aria-hidden />
      </button>
    </motion.span>
  );
}
