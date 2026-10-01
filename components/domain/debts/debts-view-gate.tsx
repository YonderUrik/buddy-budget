"use client";

/** Stati comuni delle schede di Debiti: caricamento, errore e nessun debito (con invito ad aggiungerne uno). */

import type { ReactNode } from "react";
import { LoadError } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { useDebtsActions } from "./debts-actions";

export interface DebtsViewGateProps {
  loading: boolean;
  error: boolean;
  /** Nessun debito registrato. */
  empty: boolean;
  onRetry: () => void;
  children: ReactNode;
}

const EMPTY_TITLE = "Tieni d'occhio i tuoi debiti";
const EMPTY_TEXT =
  "Aggiungi un finanziamento, nuovo o già in corso: vedrai il piano rata per rata, quanto paghi di interessi e quando finisci.";

export function DebtsViewGate({ loading, error, empty, onRetry, children }: DebtsViewGateProps) {
  const { openAdd } = useDebtsActions();
  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-44 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (error) return <LoadError message="Impossibile caricare i debiti." onRetry={onRetry} />;
  if (empty) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-heading text-lg font-medium text-foreground">{EMPTY_TITLE}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{EMPTY_TEXT}</p>
        <Button className="mt-4" onClick={openAdd}>
          Aggiungi un finanziamento
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
