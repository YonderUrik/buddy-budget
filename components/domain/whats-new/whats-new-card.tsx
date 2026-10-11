"use client";

/**
 * Striscia «Novità» della Panoramica: una riga con titolo e link, una sola voce alla volta. Si chiude con la X e non
 * ricompare su quel dispositivo. Nessun valore proprio: tutto arriva da `entry`; la spiegazione sta nel `title` del link.
 */

import Link from "next/link";
import { SparklesIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import type { WhatsNewEntry } from "@/lib/whats-new/entries";

export interface WhatsNewCardProps {
  entry: WhatsNewEntry;
  onDismiss: (id: string) => void;
}

export function WhatsNewCard({ entry, onDismiss }: WhatsNewCardProps) {
  return (
    <section aria-label="Novità" className="flex items-center gap-2 rounded-lg bg-primary/5 py-1 pr-1 pl-3 text-sm">
      <SparklesIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="shrink-0 text-xs font-semibold tracking-wide text-primary uppercase">Novità</span>
      <Link
        href={entry.href}
        title={entry.summary}
        onClick={() => track("whats_new_clicked", { id: entry.id })}
        className="min-w-0 flex-1 truncate text-foreground hover:underline"
      >
        {entry.title}
        <span className="ml-2 text-muted-foreground">{entry.ctaLabel} →</span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Chiudi la novità"
        onClick={() => {
          track("whats_new_dismissed", { id: entry.id });
          onDismiss(entry.id);
        }}
      >
        <XIcon />
      </Button>
    </section>
  );
}
