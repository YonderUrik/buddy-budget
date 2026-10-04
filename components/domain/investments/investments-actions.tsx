"use client";

/**
 * Azioni condivise dalle schede di Investimenti (Portafoglio, Proventi, Tasse): aprire il dialog "Registra operazione"
 * precompilato e l'import. I dialog vivono nel layout, così ogni scheda li usa senza duplicarli.
 */

import * as React from "react";
import { resolvePrice } from "@/lib/calc/investments";
import { toDateKey } from "@/lib/calc/net-worth";
import type { InvestmentsView } from "@/lib/investments/view";
import type { RegisterOperationInitial } from "./register-operation-form";
import { prefillPurchase } from "./register-operation-form.state";

export interface InvestmentsActions {
  openRegister: (initial: RegisterOperationInitial) => void;
  openImport: () => void;
}

const InvestmentsActionsContext = React.createContext<InvestmentsActions | null>(null);

export function InvestmentsActionsProvider({ value, children }: { value: InvestmentsActions; children: React.ReactNode }) {
  return <InvestmentsActionsContext.Provider value={value}>{children}</InvestmentsActionsContext.Provider>;
}

/** Azioni del layout di Investimenti; fuori dal layout lancia (errore di programmazione). */
export function useInvestmentsActions(): InvestmentsActions {
  const actions = React.useContext(InvestmentsActionsContext);
  if (!actions) throw new Error("useInvestmentsActions va usato dentro il layout di Investimenti");
  return actions;
}

/**
 * Apre "Registra operazione" precompilato da un suggerimento d'acquisto (strumento e importo): quote
 * stimate dall'ultimo prezzo.
 */
export function useRegisterPurchase(view: InvestmentsView | null, today: Date) {
  const { openRegister } = useInvestmentsActions();
  return React.useCallback(
    (purchase: { instrumentId: string; amount: string }) => {
      if (!view) return;
      const last = resolvePrice(view.priceIndex, purchase.instrumentId, toDateKey(today));
      const prefill = prefillPurchase(purchase, last?.close ?? null);
      openRegister({ ...prefill, instrument: view.instrumentsById.get(purchase.instrumentId) ?? null });
    },
    [view, today, openRegister]
  );
}
