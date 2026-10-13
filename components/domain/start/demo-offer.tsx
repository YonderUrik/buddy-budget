"use client";

/** Invito a guardare l'app con dati d'esempio prima di inserire i propri; dice chiaramente che sono finti e si azzerano. */

import { SparklesIcon } from "lucide-react";
import { SectionHeading } from "@/components/domain/overview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DemoOfferProps {
  onStart: () => void;
  pending?: boolean;
  errorMessage?: string | null;
  className?: string;
}

export function DemoOffer({ onStart, pending, errorMessage, className }: DemoOfferProps) {
  return (
    <section aria-labelledby="demo-offer" className={cn("flex flex-col gap-3", className)}>
      <SectionHeading id="demo-offer" icon={SparklesIcon} title="Prima dai un'occhiata" color="var(--swatch-purple)" />
      <p className="text-sm text-text-2">
        Due conti e sei mesi di movimenti inventati, per vedere come si legge la Panoramica. Sono segnati come demo, non si
        mescolano ai tuoi dati e li azzeri con un tocco.
      </p>
      <div>
        <Button variant="outline" className="h-11 px-4" onClick={onStart} disabled={pending}>
          {pending ? "Preparo l'esempio…" : "Esplora con dati d'esempio"}
        </Button>
      </div>
      {errorMessage ? (
        <p className="text-sm text-neg" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
