"use client";

/** Stati comuni delle schede di Debiti: caricamento, errore e nessun debito (con invito ad aggiungerne uno). */

import type { ReactNode } from "react";
import { LandmarkIcon } from "lucide-react";
import { EmptyState, LoadError } from "@/components/domain/shared";
import { useDebtsActions } from "./debts-actions";
import { DEBTS_COLORS } from "./debts-theme";

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
      <div className="flex flex-col gap-8" aria-busy="true">
        <div className="h-44 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (error) return <LoadError message="Impossibile caricare i debiti." onRetry={onRetry} />;
  if (empty) {
    return (
      <EmptyState
        icon={LandmarkIcon}
        title={EMPTY_TITLE}
        description={EMPTY_TEXT}
        color={DEBTS_COLORS.list}
        primary={{ label: "Aggiungi un finanziamento", onClick: openAdd }}
      />
    );
  }
  return <>{children}</>;
}
