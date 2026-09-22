"use client";

/** Riquadro di errore di caricamento con bottone "Riprova", condiviso dalle pagine dell'app. */

import { Button } from "@/components/ui/button";

export interface LoadErrorProps {
  /** Messaggio che nomina cosa non è stato caricato (es. "Impossibile caricare i conti."). */
  message: string;
  onRetry: () => void;
}

export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
    >
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Riprova
      </Button>
    </div>
  );
}
