"use client";

/** Striscia sempre visibile mentre ci sono dati d'esempio: dice che non sono reali e li azzera. Presentazionale. */

import { FlaskConicalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DemoBannerProps {
  onClear: () => void;
  pending?: boolean;
  errorMessage?: string | null;
  className?: string;
}

export function DemoBanner({ onClear, pending, errorMessage, className }: DemoBannerProps) {
  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3", className)}
    >
      <FlaskConicalIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 basis-60 text-sm text-foreground">
        <strong className="font-semibold">Dati d&apos;esempio.</strong> Quello che vedi è inventato. Azzera per aggiungere i tuoi conti e movimenti.
      </p>
      <Button size="sm" className="h-11 px-4 sm:h-9" onClick={onClear} disabled={pending}>
        {pending ? "Azzero…" : "Azzera e inizia"}
      </Button>
      {errorMessage ? (
        <p className="basis-full text-sm text-neg" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
