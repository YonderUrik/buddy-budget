"use client";

/**
 * Stati comuni delle schede di Investimenti: caricamento, errore e portafoglio vuoto (con "Registra un acquisto" e
 * "Importa"). Quando i dati ci sono, mostra i figli.
 */

import { useBrokerSelection } from "@/lib/investments/broker-selection";
import { track } from "@/lib/analytics";
import type { ReactNode } from "react";
import { TrendingUpIcon } from "lucide-react";
import { EmptyState, LoadError } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { useInvestmentsActions } from "./investments-actions";

export interface InvestmentsViewGateProps {
  loading: boolean;
  error: boolean;
  /** Portafoglio senza operazioni. */
  empty: boolean;
  onRetry: () => void;
  /** Messaggio d'errore (default generico). */
  errorMessage?: string;
  children: ReactNode;
}

export function InvestmentsViewGate({
  loading,
  error,
  empty,
  onRetry,
  errorMessage = "Impossibile caricare gli investimenti.",
  children,
}: InvestmentsViewGateProps) {
  const { disabled, showAll } = useBrokerSelection();
  const { openRegister, openImport } = useInvestmentsActions();
  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (error) return <LoadError message={errorMessage} onRetry={onRetry} />;
  if (empty && disabled.size) return <div className="space-y-3 rounded-xl border p-6 text-center"><p>Nessuna operazione per i broker selezionati.</p><Button variant="outline" onClick={() => { showAll(); track("investment_broker_filter_changed", { action: "all" }); }}>Mostra tutti i broker</Button></div>;
  if (empty) {
    return (
      <EmptyState
        icon={TrendingUpIcon}
        title="Registra il tuo primo investimento"
        description="Cerca uno strumento per nome, ticker o ISIN (ETF, azioni, BTP, fondi, crypto) e inserisci l'acquisto: valore e guadagno si aggiornano da soli con i prezzi di chiusura."
        primary={{ label: "Registra un acquisto", onClick: () => openRegister({ instrument: null }) }}
        secondary={{ label: "Importa da file CSV", onClick: openImport }}
      />
    );
  }
  return <>{children}</>;
}
