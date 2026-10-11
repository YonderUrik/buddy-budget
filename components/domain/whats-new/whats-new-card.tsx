"use client";

/**
 * Riquadro «Novità» della Panoramica: una sola voce alla volta, con titolo, spiegazione, pulsante e (se c'è)
 * un'immagine. Si chiude con la X e non ricompare su quel dispositivo. Nessun valore proprio: tutto arriva da `entry`.
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
    <section aria-label="Novità" className="relative flex items-center gap-5 rounded-xl bg-primary/5 p-4 sm:p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15">
            <SparklesIcon className="size-3.5" aria-hidden />
          </span>
          Novità
        </p>
        <h2 className="font-heading text-lg font-medium text-foreground">{entry.title}</h2>
        <p className="text-sm text-muted-foreground">{entry.summary}</p>
        <div>
          <Button
            nativeButton={false}
            size="sm"
            render={<Link href={entry.href} onClick={() => track("whats_new_clicked", { id: entry.id })} />}
          >
            {entry.ctaLabel}
          </Button>
        </div>
      </div>
      {entry.image && (
        // eslint-disable-next-line @next/next/no-img-element -- immagine fissa e già dimensionata, con spazio riservato dalle dimensioni
        <img
          src={entry.image.src}
          alt={entry.image.alt}
          width={entry.image.width}
          height={entry.image.height}
          loading="lazy"
          decoding="async"
          className="hidden h-36 w-auto shrink-0 rounded-lg border border-border object-cover object-top sm:block"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2"
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
